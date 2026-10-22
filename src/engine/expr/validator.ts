import { ASTNode } from './ast';
import { parseExpression } from './parser';
import { lookupFunction, getAllFunctionNames } from './registry';
import { Table, Measure } from '../../types/bi';
import { DaxError } from '../shared/errors';

export interface DaxValidationResult {
  isValid: boolean;
  errorMessage?: string;
  referencedTables: string[];
  referencedColumns: string[];
  referencedMeasures: string[];
  suggestedFix?: string;
}

export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn][an];
}

export function findClosestMatch(target: string, candidates: string[]): string | null {
  if (!target || candidates.length === 0) return null;
  const lowerTarget = target.toLowerCase();

  let closest: string | null = null;
  let minDistance = Infinity;

  for (const c of candidates) {
    const dist = levenshteinDistance(lowerTarget, c.toLowerCase());
    if (dist < minDistance) {
      minDistance = dist;
      closest = c;
    }
  }

  // Threshold: at most 3 edits and distance < length of target
  if (minDistance <= Math.max(3, Math.floor(target.length / 2)) && minDistance < target.length) {
    return closest;
  }
  return null;
}

export class SemanticValidator {
  private tables: Table[];
  private measures: Measure[];
  private currentMeasureName?: string;

  constructor(tables: Table[] = [], measures: Measure[] = [], currentMeasureName?: string) {
    this.tables = tables;
    this.measures = measures;
    this.currentMeasureName = currentMeasureName;
  }

  public validate(formula: string): DaxValidationResult {
    const trimmed = formula.trim();
    if (!trimmed) {
      return {
        isValid: false,
        errorMessage: 'Fórmula vazia',
        referencedTables: [],
        referencedColumns: [],
        referencedMeasures: [],
      };
    }

    let ast: ASTNode;
    try {
      ast = parseExpression(trimmed, { dialect: 'dax' });
    } catch (err: any) {
      const msg = err instanceof DaxError ? err.message : err.message || 'Erro de sintaxe';
      return {
        isValid: false,
        errorMessage: msg,
        referencedTables: [],
        referencedColumns: [],
        referencedMeasures: [],
      };
    }

    const referencedTables = new Set<string>();
    const referencedColumns = new Set<string>();
    const referencedMeasures = new Set<string>();

    try {
      this.traverse(ast, referencedTables, referencedColumns, referencedMeasures);
    } catch (err: any) {
      return {
        isValid: false,
        errorMessage: err.message,
        referencedTables: Array.from(referencedTables),
        referencedColumns: Array.from(referencedColumns),
        referencedMeasures: Array.from(referencedMeasures),
      };
    }

    // Check for circular reference if validating a measure
    if (this.currentMeasureName) {
      const cyclePath = this.detectCircularReference(
        this.currentMeasureName,
        Array.from(referencedMeasures)
      );
      if (cyclePath) {
        return {
          isValid: false,
          errorMessage: `Referência circular detectada entre medidas: ${cyclePath.join(' -> ')}`,
          referencedTables: Array.from(referencedTables),
          referencedColumns: Array.from(referencedColumns),
          referencedMeasures: Array.from(referencedMeasures),
        };
      }
    }

    return {
      isValid: true,
      referencedTables: Array.from(referencedTables),
      referencedColumns: Array.from(referencedColumns),
      referencedMeasures: Array.from(referencedMeasures),
    };
  }

  private traverse(
    node: ASTNode,
    tables: Set<string>,
    columns: Set<string>,
    measures: Set<string>
  ): void {
    switch (node.kind) {
      case 'Literal':
      case 'VariableRef':
        break;

      case 'ColumnRef': {
        const tName = node.table;
        const cName = node.column;

        if (tName) {
          const tableObj = this.tables.find(
            t => t.name.toLowerCase() === tName.toLowerCase() || t.id.toLowerCase() === tName.toLowerCase()
          );
          if (!tableObj) {
            const tableNames = this.tables.map(t => t.name);
            const suggestion = findClosestMatch(tName, tableNames);
            const hint = suggestion ? ` Você quis dizer "${suggestion}"?` : '';
            throw new DaxError('Reference', `A tabela "${tName}" não foi encontrada no modelo.${hint}`);
          }
          tables.add(tableObj.name);

          // Check if column exists in table
          if (tableObj.columns && tableObj.columns.length > 0) {
            const colObj = tableObj.columns.find(
              c => c.name.toLowerCase() === cName.toLowerCase() || c.id.toLowerCase() === cName.toLowerCase()
            );
            if (!colObj) {
              const colNames = tableObj.columns.map(c => c.name);
              const suggestion = findClosestMatch(cName, colNames);
              const hint = suggestion ? ` Você quis dizer "${suggestion}"?` : '';
              throw new DaxError(
                'Reference',
                `A coluna [${cName}] não existe na tabela "${tableObj.name}".${hint}`
              );
            }
          }
          columns.add(cName);
        } else {
          // Naked [Identifier]: Check measure first, then columns
          const measureObj = this.measures.find(
            m => m.name.toLowerCase() === cName.toLowerCase()
          );
          if (measureObj) {
            measures.add(measureObj.name);
          } else {
            let foundInAnyTable = false;
            for (const t of this.tables) {
              if (t.columns?.some(c => c.name.toLowerCase() === cName.toLowerCase())) {
                foundInAnyTable = true;
                columns.add(cName);
                tables.add(t.name);
                break;
              }
            }

            if (!foundInAnyTable) {
              const allCandidates = [
                ...this.measures.map(m => m.name),
                ...this.tables.flatMap(t => (t.columns || []).map(c => c.name)),
              ];
              const suggestion = findClosestMatch(cName, allCandidates);
              const hint = suggestion ? ` Você quis dizer "[${suggestion}]"?` : '';
              throw new DaxError(
                'Reference',
                `O identificador [${cName}] não foi encontrado como medida nem coluna no modelo.${hint}`
              );
            }
          }
        }
        break;
      }

      case 'MeasureRef': {
        const mName = node.measure;
        // Check if it's a known measure
        const measureObj = this.measures.find(
          m => m.name.toLowerCase() === mName.toLowerCase()
        );
        if (measureObj) {
          measures.add(measureObj.name);
        } else {
          // Could be a column reference in naked format [Column]
          let foundInAnyTable = false;
          for (const t of this.tables) {
            if (t.columns?.some(c => c.name.toLowerCase() === mName.toLowerCase())) {
              foundInAnyTable = true;
              columns.add(mName);
              tables.add(t.name);
              break;
            }
          }

          if (!foundInAnyTable) {
            // Suggest either measure or column
            const allCandidates = [
              ...this.measures.map(m => m.name),
              ...this.tables.flatMap(t => (t.columns || []).map(c => c.name)),
            ];
            const suggestion = findClosestMatch(mName, allCandidates);
            const hint = suggestion ? ` Você quis dizer "[${suggestion}]"?` : '';
            throw new DaxError(
              'Reference',
              `O identificador [${mName}] não foi encontrado como medida nem coluna no modelo.${hint}`
            );
          }
        }
        break;
      }

      case 'UnaryOp':
        this.traverse(node.operand, tables, columns, measures);
        break;

      case 'BinaryOp':
        this.traverse(node.left, tables, columns, measures);
        this.traverse(node.right, tables, columns, measures);
        break;

      case 'FunctionCall': {
        const fnName = node.name.toUpperCase();
        // Aggregations and filter functions like CALCULATE, ALL, etc. are also valid in DAX
        const isCoreOrAgg =
          lookupFunction(fnName) !== undefined ||
          ['CALCULATE', 'CALCULATETABLE', 'ALL', 'ALLEXCEPT', 'ALLSELECTED', 'FILTER', 'VALUES', 'DISTINCT', 'RELATED', 'RELATEDTABLE', 'SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'COUNTROWS', 'DISTINCTCOUNT', 'MIN', 'MAX', 'SUMX', 'AVERAGEX', 'COUNTX', 'MINX', 'MAXX', 'RANKX', 'DATEADD', 'SAMEPERIODLASTYEAR', 'TOTALYTD', 'TOTALQTD', 'TOTALMTD', 'DATESYTD', 'CLOSINGBALANCEMONTH', 'OPENINGBALANCEMONTH'].includes(fnName);

        if (!isCoreOrAgg) {
          const allFns = [...getAllFunctionNames(), 'CALCULATE', 'ALL', 'FILTER', 'VALUES', 'SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX'];
          const suggestion = findClosestMatch(fnName, allFns);
          const hint = suggestion ? ` Você quis dizer "${suggestion}"?` : '';
          throw new DaxError('Semantic', `Função "${node.name}" não foi reconhecida no catálogo DAX.${hint}`);
        }

        // Check arity if in registry
        const fnDef = lookupFunction(fnName);
        if (fnDef) {
          if (node.args.length < fnDef.minArgs) {
            throw new DaxError(
              'Semantic',
              `Função ${fnDef.name} requer no mínimo ${fnDef.minArgs} argumento(s), fornecidos: ${node.args.length}`
            );
          }
          if (fnDef.maxArgs !== -1 && node.args.length > fnDef.maxArgs) {
            throw new DaxError(
              'Semantic',
              `Função ${fnDef.name} aceita no máximo ${fnDef.maxArgs} argumento(s), fornecidos: ${node.args.length}`
            );
          }
        }

        for (const arg of node.args) {
          if (arg) {
            this.traverse(arg, tables, columns, measures);
          }
        }
        break;
      }

      case 'TableConstructor':
        for (const el of node.elements) {
          if (Array.isArray(el)) {
            for (const sub of el) {
              this.traverse(sub, tables, columns, measures);
            }
          } else {
            this.traverse(el, tables, columns, measures);
          }
        }
        break;

      case 'VarReturn':
        for (const v of node.variables) {
          this.traverse(v.expr, tables, columns, measures);
        }
        this.traverse(node.returnExpr, tables, columns, measures);
        break;
    }
  }

  private detectCircularReference(
    startMeasure: string,
    initialReferences: string[]
  ): string[] | null {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (current: string, path: string[]): string[] | null => {
      visited.add(current.toLowerCase());
      recursionStack.add(current.toLowerCase());

      const measureObj = this.measures.find(
        m => m.name.toLowerCase() === current.toLowerCase()
      );
      if (measureObj) {
        // Find referenced measures inside measureObj formula
        const childRefs = this.extractDirectMeasures(measureObj.formula);
        for (const child of childRefs) {
          if (child.toLowerCase() === startMeasure.toLowerCase()) {
            return [...path, child];
          }
          if (!visited.has(child.toLowerCase())) {
            const cycle = dfs(child, [...path, child]);
            if (cycle) return cycle;
          } else if (recursionStack.has(child.toLowerCase())) {
            return [...path, child];
          }
        }
      }

      recursionStack.delete(current.toLowerCase());
      return null;
    };

    for (const ref of initialReferences) {
      if (ref.toLowerCase() === startMeasure.toLowerCase()) {
        return [startMeasure, ref];
      }
      const cycle = dfs(ref, [startMeasure, ref]);
      if (cycle) return cycle;
    }

    return null;
  }

  private extractDirectMeasures(formula: string): string[] {
    try {
      const ast = parseExpression(formula, { dialect: 'dax' });
      const measures = new Set<string>();
      const walk = (n: ASTNode) => {
        if (n.kind === 'MeasureRef') {
          measures.add(n.measure);
        } else if (n.kind === 'ColumnRef' && !n.table) {
          measures.add(n.column);
        } else if (n.kind === 'UnaryOp') {
          walk(n.operand);
        } else if (n.kind === 'BinaryOp') {
          walk(n.left);
          walk(n.right);
        } else if (n.kind === 'FunctionCall') {
          n.args.forEach(a => a && walk(a));
        } else if (n.kind === 'VarReturn') {
          n.variables.forEach(v => walk(v.expr));
          walk(n.returnExpr);
        }
      };
      walk(ast);
      return Array.from(measures);
    } catch {
      return [];
    }
  }
}

export function validateDax(
  formula: string,
  availableTables: Table[] = [],
  availableMeasures: Measure[] = [],
  currentMeasureName?: string
): DaxValidationResult {
  const validator = new SemanticValidator(availableTables, availableMeasures, currentMeasureName);
  return validator.validate(formula);
}
