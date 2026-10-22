import { Table, Measure, Filter } from '../types/bi';
import { ModelAccess, InMemoryModelAccess } from './model/modelAccess';
import { parseNumber } from './shared/valueParser';
import { DaxError } from './shared/errors';
import { validateDax } from './expr/validator';
import type { DaxValidationResult } from './expr/validator';
import { generateQuickMeasure } from './expr/quickMeasures';
import type { QuickMeasureType, QuickMeasureResult } from './expr/quickMeasures';
import { evaluateExpression } from './expr/evaluator';

export type { DaxValidationResult, QuickMeasureType, QuickMeasureResult };

export class DaxEngine {
  private static activeModelAccess: ModelAccess | null = null;

  /**
   * Injects an active ModelAccess instance into DaxEngine
   */
  public static setModelAccess(model: ModelAccess | null): void {
    DaxEngine.activeModelAccess = model;
  }

  /**
   * Retrieves current active ModelAccess instance
   */
  public static getModelAccess(): ModelAccess | null {
    return DaxEngine.activeModelAccess;
  }

  /**
   * Validate a DAX expression syntax and references using unified AST validator
   */
  public static validate(
    formula: string,
    availableTables: Table[],
    availableMeasures: Measure[]
  ): DaxValidationResult {
    return validateDax(formula, availableTables, availableMeasures);
  }

  /**
   * Split top-level arguments respecting quotes and parentheses (compatibility helper)
   */
  public static splitArgs(str: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString: false | "'" | '"' = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
        if (!inString) inString = char;
        else if (inString === char) inString = false;
      }

      if (!inString) {
        if (char === '(' || char === '[' || char === '{') depth++;
        else if (char === ')' || char === ']' || char === '}') depth--;
        else if (char === ',' && depth === 0) {
          args.push(current.trim());
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim().length > 0) {
      args.push(current.trim());
    }

    return args;
  }

  /**
   * Parse numeric values supporting currency formatting, decimals with comma, and string numbers
   * Delegates to unified valueParser.parseNumber
   */
  public static parseNumeric(val: any): number {
    const res = parseNumber(val);
    return res.value ?? 0;
  }

  /**
   * Evaluate a DAX formula against active rows and context.
   * Supports both ModelAccess and legacy (tables, measures) signatures.
   */
  public static evaluate(
    formula: string,
    tablesOrModel: Table[] | ModelAccess,
    measures?: Measure[],
    activeFilters: Filter[] = [],
    callStack?: Set<string>
  ): number {
    let model: ModelAccess;
    let tables: Table[];
    let measuresList: Measure[];

    if ('getTables' in tablesOrModel && typeof (tablesOrModel as ModelAccess).getTables === 'function') {
      model = tablesOrModel as ModelAccess;
      tables = model.getTables();
      measuresList = measures || model.getMeasures();
    } else {
      tables = tablesOrModel as Table[];
      measuresList = measures || [];
      model = DaxEngine.activeModelAccess || new InMemoryModelAccess(tables, [], measuresList);
    }

    const trimmed = (formula || '').trim();
    if (!trimmed) return 0;

    // 1. DIVIDE(A, B, alt)
    const divideMatch = trimmed.match(/^DIVIDE\s*\(\s*(.+?)\s*,\s*(.+?)(?:\s*,\s*(.+?))?\s*\)$/i);
    if (divideMatch) {
      const numExpr = divideMatch[1];
      const denExpr = divideMatch[2];
      const altExpr = divideMatch[3] ? Number(divideMatch[3]) : 0;
      const num = this.evaluate(numExpr, model, measuresList, activeFilters, callStack);
      const den = this.evaluate(denExpr, model, measuresList, activeFilters, callStack);
      if (den === 0 || isNaN(den)) return altExpr;
      return num / den;
    }

    // 2. CALCULATE(Expr, Filter1, Filter2, Filter3...)
    const calcMatch = trimmed.match(/^CALCULATE\s*\(([\s\S]*)\)$/i);
    if (calcMatch) {
      const args = this.splitArgs(calcMatch[1]);
      if (args.length >= 1) {
        const innerExpr = args[0];
        const filterArgs = args.slice(1);

        let modifiedFilters = [...activeFilters];

        for (const filterArg of filterArgs) {
          const fTrim = filterArg.trim();
          if (!fTrim) continue;

          // ALL(Table) or ALL('Table') or ALL(Table[Column]) or ALL()
          const allMatch = fTrim.match(/^ALL\s*\((.*?)\)$/i);
          if (allMatch) {
            const allTarget = allMatch[1].trim();
            if (!allTarget) {
              modifiedFilters = [];
            } else {
              const tc = allTarget.match(/(?:'([^']+)'|([a-zA-Z0-9_\u00C0-\u017F ]+))(?:\[([^\]]+)\])?/);
              if (tc) {
                const targetTable = (tc[1] || tc[2] || '').trim();
                const targetCol = (tc[3] || '').trim();
                if (targetCol) {
                  modifiedFilters = modifiedFilters.filter(
                    f => !(f.tableId.toLowerCase() === targetTable.toLowerCase() && f.column.toLowerCase() === targetCol.toLowerCase())
                  );
                } else {
                  modifiedFilters = modifiedFilters.filter(
                    f => f.tableId.toLowerCase() !== targetTable.toLowerCase()
                  );
                }
              }
            }
            continue;
          }

          // IN filter: Table[Column] IN {"A", "B"} or [Column] IN {"A", "B"}
          const inMatch = fTrim.match(/(?:(?:'([^']+)'|([a-zA-Z0-9_\u00C0-\u017F ]+))\[)?([^\]]+)\]?\s+IN\s*\{([^}]+)\}/i);
          if (inMatch) {
            const tName = (inMatch[1] || inMatch[2] || '').trim();
            const cName = inMatch[3].trim();
            const rawVals = inMatch[4].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
            modifiedFilters.push({
              id: 'dax_ctx_' + Math.random(),
              level: 'visual',
              tableId: tName,
              column: cName,
              operator: 'in',
              value: rawVals,
            });
            continue;
          }

          // Comparison operators: >=, <=, !=, <>, ==, =, >, <
          const compMatch = fTrim.match(/(?:(?:'([^']+)'|([a-zA-Z0-9_\u00C0-\u017F ]+))\[)?([^\]]+)\]?\s*(>=|<=|!=|<>|==|=|>|<)\s*["']?([^"']*)["']?/);
          if (compMatch) {
            const tName = (compMatch[1] || compMatch[2] || '').trim();
            const cName = compMatch[3].trim();
            const opRaw = compMatch[4];
            const valRaw = compMatch[5].trim();

            let operator: Filter['operator'] = 'equals';
            if (opRaw === '=' || opRaw === '==') operator = 'equals';
            else if (opRaw === '!=' || opRaw === '<>') operator = 'notEquals';
            else if (opRaw === '>') operator = 'greaterThan';
            else if (opRaw === '>=') operator = 'greaterThanOrEqual';
            else if (opRaw === '<') operator = 'lessThan';
            else if (opRaw === '<=') operator = 'lessThanOrEqual';

            modifiedFilters.push({
              id: 'dax_ctx_' + Math.random(),
              level: 'visual',
              tableId: tName,
              column: cName,
              operator,
              value: valRaw,
            });
          }
        }

        return this.evaluate(innerExpr, model, measuresList, modifiedFilters, callStack);
      }
    }

    // 3. Time Intelligence: TOTALYTD(Expr, DateCol)
    const ytdMatch = trimmed.match(/^TOTALYTD\s*\(\s*(.+?)\s*,\s*(?:'([^']+)'|([a-zA-Z0-9_\u00C0-\u017F ]+))?\[([^\]]+)\]\s*\)$/i);
    if (ytdMatch) {
      const expr = ytdMatch[1];
      return this.evaluate(expr, model, measuresList, activeFilters, callStack);
    }

    // 4. Aggregations: SUM, AVERAGE, MIN, MAX, COUNT, COUNTROWS, DISTINCTCOUNT
    const aggMatch = trimmed.match(
      /^(SUM|AVERAGE|AVG|MIN|MAX|COUNT|DISTINCTCOUNT)\s*\(\s*(?:(?:'([^']+)'|([a-zA-Z0-9_\u00C0-\u017F ]+))\[)?([^\]]+)\]?\s*\)$/i
    );
    if (aggMatch) {
      const func = aggMatch[1].toUpperCase();
      const rawTName = (aggMatch[2] || aggMatch[3] || '').trim();
      const cName = aggMatch[4].trim();

      // Find table by name or ID via model
      let table = rawTName ? model.getTable(rawTName) : undefined;
      if (!table) {
        table = tables.find(t => t.columns.some(c => c.name.toLowerCase() === cName.toLowerCase()));
      }
      if (!table && tables.length > 0) {
        table = tables[0];
      }
      if (!table) return 0;

      // Filter rows dynamically using model
      let rows: Record<string, any>[] = [];
      if (typeof model.getFilteredRows === 'function') {
        rows = model.getFilteredRows(table.id, activeFilters);
      } else {
        rows = table.rows;
        activeFilters.forEach(f => {
          if (!f.tableId || f.tableId === table!.id || f.tableId === table!.name) {
            rows = rows.filter(r => String(r[f.column] ?? '').toLowerCase() === String(f.value ?? '').toLowerCase());
          }
        });
      }

      // Convert values with unified parseNumeric
      const values = rows.map(r => DaxEngine.parseNumeric(r[cName]));
      if (values.length === 0) return 0;

      switch (func) {
        case 'SUM':
          return values.reduce((a, b) => a + b, 0);
        case 'AVERAGE':
        case 'AVG':
          return values.reduce((a, b) => a + b, 0) / values.length;
        case 'MIN':
          return Math.min(...values);
        case 'MAX':
          return Math.max(...values);
        case 'COUNT':
          return values.length;
        case 'DISTINCTCOUNT':
          return new Set(values).size;
      }
    }

    // 5. COUNTROWS(Table)
    const countRowsMatch = trimmed.match(/^COUNTROWS\s*\(\s*([a-zA-Z0-9_]+)\s*\)$/i);
    if (countRowsMatch) {
      const tName = countRowsMatch[1];
      const table = model.getTable(tName);
      if (!table) return 0;
      if (typeof model.getFilteredRows === 'function') {
        return model.getFilteredRows(table.id, activeFilters).length;
      }
      let filtered = table.rows;
      activeFilters.forEach(f => {
        if (!f.tableId || f.tableId === table!.id || f.tableId === table!.name) {
          filtered = filtered.filter(r => String(r[f.column] ?? '').toLowerCase() === String(f.value ?? '').toLowerCase());
        }
      });
      return filtered.length;
    }

    // 6. Single Measure Reference alone: [Faturamento Total]
    const singleMeasureMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (singleMeasureMatch) {
      const rawName = singleMeasureMatch[1].trim();
      const targetM = measuresList.find(m => m.name.toLowerCase() === rawName.toLowerCase())
        || (typeof model.getMeasure === 'function' ? model.getMeasure(rawName) : undefined);
      if (targetM) {
        const stack = callStack || new Set<string>();
        const normKey = targetM.name.toLowerCase();
        if (stack.has(normKey)) {
          throw new DaxError('Execution', `Referência circular detectada entre medidas: [${targetM.name}]`);
        }
        const nextStack = new Set(stack);
        nextStack.add(normKey);
        return this.evaluate(targetM.formula, model, measuresList, activeFilters, nextStack);
      }
    }

    // 7. General Expression / VAR RETURN / Evaluator with measure resolution & measure-to-measure arithmetic
    try {
      const evaluated = evaluateExpression(trimmed, {
        dialect: 'dax',
        measures: measuresList,
        tables,
        model,
        activeFilters,
        callStack,
        resolveMeasure: (name: string) => {
          const rawName = name.trim();
          const targetM = measuresList.find(m => m.name.toLowerCase() === rawName.toLowerCase())
            || (typeof model.getMeasure === 'function' ? model.getMeasure(rawName) : undefined);
          if (targetM) {
            const stack = callStack || new Set<string>();
            const normKey = targetM.name.toLowerCase();
            if (stack.has(normKey)) {
              throw new DaxError('Execution', `Referência circular detectada entre medidas: [${targetM.name}]`);
            }
            const nextStack = new Set(stack);
            nextStack.add(normKey);
            return this.evaluate(targetM.formula, model, measuresList, activeFilters, nextStack);
          }
          return undefined;
        },
      });

      if (typeof evaluated === 'number') return evaluated;
      if (typeof evaluated === 'boolean') return evaluated ? 1 : 0;
      if (evaluated === null || evaluated === undefined) return 0;
      const num = Number(evaluated);
      return isNaN(num) ? 0 : num;
    } catch (err: any) {
      if (err instanceof DaxError && (err.kind === 'Execution' || (err as any).type === 'Execution') && err.message.toLowerCase().includes('circular')) {
        throw err;
      }
      // Fallback: numeric constant or 0
      const constantVal = Number(trimmed);
      return isNaN(constantVal) ? 0 : constantVal;
    }
  }

  /**
   * Helper: Generate Quick Measure formulas
   * Delegates to dedicated module
   */
  public static generateQuickMeasure(
    type: QuickMeasureType,
    baseMeasure: string,
    dimensionCol: string,
    table: string
  ): QuickMeasureResult {
    return generateQuickMeasure(type, baseMeasure, dimensionCol, table);
  }
}
