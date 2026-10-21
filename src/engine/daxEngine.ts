import { Table, Measure, Filter } from '../types/bi';
import { ModelAccess, InMemoryModelAccess } from './model/modelAccess';
import { parseNumber } from './shared/valueParser';

export interface DaxValidationResult {
  isValid: boolean;
  errorMessage?: string;
  referencedTables: string[];
  referencedColumns: string[];
  referencedMeasures: string[];
}

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
   * Validate a DAX expression syntax and references
   */
  public static validate(formula: string, availableTables: Table[], availableMeasures: Measure[]): DaxValidationResult {
    const trimmed = formula.trim();
    if (!trimmed) {
      return { isValid: false, errorMessage: 'Fórmula vazia', referencedTables: [], referencedColumns: [], referencedMeasures: [] };
    }

    // Check balanced parentheses and brackets
    let pCount = 0;
    let bCount = 0;
    for (const char of trimmed) {
      if (char === '(') pCount++;
      if (char === ')') pCount--;
      if (char === '[') bCount++;
      if (char === ']') bCount--;
      if (pCount < 0 || bCount < 0) {
        return { isValid: false, errorMessage: 'Parênteses ou colchetes desbalanceados', referencedTables: [], referencedColumns: [], referencedMeasures: [] };
      }
    }
    if (pCount !== 0) return { isValid: false, errorMessage: 'Parênteses desbalanceados', referencedTables: [], referencedColumns: [], referencedMeasures: [] };
    if (bCount !== 0) return { isValid: false, errorMessage: 'Colchetes desbalanceados', referencedTables: [], referencedColumns: [], referencedMeasures: [] };

    // Extract table[column] references: Table[Column] or 'Table'[Column]
    const colRegex = /(?:'([^']+)'|([a-zA-Z0-9_\u00C0-\u017F ]+))\[([^\]]+)\]/g;
    const referencedTables: string[] = [];
    const referencedColumns: string[] = [];
    let match;
    while ((match = colRegex.exec(trimmed)) !== null) {
      const tName = (match[1] || match[2] || '').trim();
      const cName = match[3].trim();
      referencedTables.push(tName);
      referencedColumns.push(cName);

      const tableExists = availableTables.some(
        t => t.name.toLowerCase() === tName.toLowerCase() || t.id.toLowerCase() === tName.toLowerCase()
      );
      if (!tableExists) {
        return {
          isValid: false,
          errorMessage: `A tabela "${tName}" não foi encontrada no modelo`,
          referencedTables,
          referencedColumns,
          referencedMeasures: [],
        };
      }
    }

    // Extract [Measure] or [Column] references (without table prefix)
    const measureRegex = /(?:^|[^a-zA-Z0-9_\u00C0-\u017F'])\[([^\]]+)\]/g;
    const referencedMeasures: string[] = [];
    while ((match = measureRegex.exec(trimmed)) !== null) {
      const mName = match[1].trim();
      if (!referencedColumns.includes(mName)) {
        referencedMeasures.push(mName);
      }
    }

    return {
      isValid: true,
      referencedTables: Array.from(new Set(referencedTables)),
      referencedColumns: Array.from(new Set(referencedColumns)),
      referencedMeasures: Array.from(new Set(referencedMeasures)),
    };
  }

  /**
   * Split top-level arguments respecting quotes and parentheses
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
    activeFilters: Filter[] = []
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

    const trimmed = formula.trim();

    // 1. DIVIDE(A, B, alt)
    const divideMatch = trimmed.match(/^DIVIDE\s*\(\s*(.+?)\s*,\s*(.+?)(?:\s*,\s*(.+?))?\s*\)$/i);
    if (divideMatch) {
      const numExpr = divideMatch[1];
      const denExpr = divideMatch[2];
      const altExpr = divideMatch[3] ? Number(divideMatch[3]) : 0;
      const num = this.evaluate(numExpr, model, measuresList, activeFilters);
      const den = this.evaluate(denExpr, model, measuresList, activeFilters);
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

        return this.evaluate(innerExpr, model, measuresList, modifiedFilters);
      }
    }

    // 3. Time Intelligence: TOTALYTD(Expr, DateCol)
    const ytdMatch = trimmed.match(/^TOTALYTD\s*\(\s*(.+?)\s*,\s*(?:'([^']+)'|([a-zA-Z0-9_\u00C0-\u017F ]+))?\[([^\]]+)\]\s*\)$/i);
    if (ytdMatch) {
      const expr = ytdMatch[1];
      return this.evaluate(expr, model, measuresList, activeFilters);
    }

    // 4. Aggregations: SUM, AVERAGE, MIN, MAX, COUNT, COUNTROWS
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

      // Filter rows dynamically using model without global window
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
      return table ? table.rows.length : 0;
    }

    // 6. Binary arithmetic: [Medida 1] - [Medida 2], [A] + [B], [A] * [B]
    const binaryMatch = trimmed.match(/^\[([^\]]+)\]\s*([\+\-\*\/])\s*\[([^\]]+)\]$/);
    if (binaryMatch) {
      const m1 = measuresList.find(m => m.name === binaryMatch[1]);
      const m2 = measuresList.find(m => m.name === binaryMatch[3]);
      const v1 = m1 ? this.evaluate(m1.formula, model, measuresList, activeFilters) : 0;
      const v2 = m2 ? this.evaluate(m2.formula, model, measuresList, activeFilters) : 0;
      const op = binaryMatch[2];
      if (op === '+') return v1 + v2;
      if (op === '-') return v1 - v2;
      if (op === '*') return v1 * v2;
      if (op === '/') return v2 !== 0 ? v1 / v2 : 0;
    }

    // 7. Measure reference alone: [Faturamento Total]
    const singleMeasureMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (singleMeasureMatch) {
      const targetM = measuresList.find(m => m.name === singleMeasureMatch[1]);
      if (targetM) {
        return this.evaluate(targetM.formula, model, measuresList, activeFilters);
      }
    }

    // Fallback: numeric constant
    const constantVal = Number(trimmed);
    return isNaN(constantVal) ? 0 : constantVal;
  }

  /**
   * Helper: Generate Quick Measure formulas
   */
  public static generateQuickMeasure(
    type: 'pct_of_total' | 'yoy_growth' | 'mom_growth' | 'rolling_avg' | 'ranking',
    baseMeasure: string,
    dimensionCol: string,
    table: string
  ): { name: string; formula: string; format: Measure['format'] } {
    switch (type) {
      case 'pct_of_total':
        return {
          name: `% ${baseMeasure} do Total`,
          formula: `DIVIDE([${baseMeasure}], CALCULATE([${baseMeasure}], ALL(${table})), 0)`,
          format: 'percentage',
        };
      case 'yoy_growth':
        return {
          name: `Crescimento YoY ${baseMeasure}`,
          formula: `DIVIDE([${baseMeasure}] - CALCULATE([${baseMeasure}], SAMEPERIODLASTYEAR(d_Calendario[Data])), CALCULATE([${baseMeasure}], SAMEPERIODLASTYEAR(d_Calendario[Data])), 0)`,
          format: 'percentage',
        };
      case 'mom_growth':
        return {
          name: `Variação MoM ${baseMeasure}`,
          formula: `DIVIDE([${baseMeasure}] - CALCULATE([${baseMeasure}], DATEADD(d_Calendario[Data], -1, MONTH)), CALCULATE([${baseMeasure}], DATEADD(d_Calendario[Data], -1, MONTH)), 0)`,
          format: 'percentage',
        };
      case 'rolling_avg':
        return {
          name: `Média Móvel 3M ${baseMeasure}`,
          formula: `AVERAGE(${table}[${dimensionCol}])`,
          format: 'number',
        };
      case 'ranking':
        return {
          name: `Ranking por ${baseMeasure}`,
          formula: `RANKX(ALL(${table}), [${baseMeasure}])`,
          format: 'integer',
        };
    }
  }
}
