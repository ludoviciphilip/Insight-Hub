import { FunctionDefinition } from '../expr/registry';
import { DaxError } from '../shared/errors';
import {
  DAX_BLANK,
  isBlank,
  daxToNumber,
  daxToString,
  daxEqual,
  daxCompare,
  DaxTableValue,
  isDaxTable,
} from '../expr/types';
import { ModelAccess } from '../model/modelAccess';
import { FilterContext } from '../model/filterContext';
import { toDaxTable } from './table';

export interface OrderBySpec {
  column: string;
  direction: 'ASC' | 'DESC';
  blanks?: 'DEFAULT' | 'FIRST' | 'LAST';
}

export interface WindowHelperDescriptor {
  __isOrderBy?: boolean;
  __isPartitionBy?: boolean;
  __isMatchBy?: boolean;
  specs?: OrderBySpec[];
  columns?: string[];
}

/**
 * Normalizes an OrderBySpec list from args or descriptors
 */
export function extractOrderBy(arg: any): OrderBySpec[] {
  if (!arg) return [];
  if (arg.__isOrderBy && Array.isArray(arg.specs)) {
    return arg.specs;
  }
  if (typeof arg === 'string') {
    const clean = arg.replace(/[\[\]]/g, '').trim();
    return [{ column: clean, direction: 'ASC', blanks: 'DEFAULT' }];
  }
  if (arg.column) {
    return [{ column: arg.column, direction: arg.direction || 'ASC', blanks: arg.blanks || 'DEFAULT' }];
  }
  return [];
}

/**
 * Normalizes PartitionBy columns
 */
export function extractPartitionBy(arg: any): string[] {
  if (!arg) return [];
  if (arg.__isPartitionBy && Array.isArray(arg.columns)) {
    return arg.columns;
  }
  if (typeof arg === 'string') {
    return [arg.replace(/[\[\]]/g, '').trim()];
  }
  if (Array.isArray(arg)) {
    return arg.map(c => (typeof c === 'string' ? c.replace(/[\[\]]/g, '').trim() : String(c)));
  }
  return [];
}

/**
 * Sorts an array of row objects by given OrderBy specs
 */
export function sortRowsBySpecs(rows: Record<string, any>[], specs: OrderBySpec[]): Record<string, any>[] {
  if (specs.length === 0) return [...rows];

  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      const col = spec.column;
      const valA = a[col];
      const valB = b[col];
      const isDesc = spec.direction === 'DESC';

      const aBlank = isBlank(valA) || valA === null || valA === undefined;
      const bBlank = isBlank(valB) || valB === null || valB === undefined;

      if (aBlank && bBlank) continue;
      if (aBlank) {
        if (spec.blanks === 'FIRST') return -1;
        if (spec.blanks === 'LAST') return 1;
        // Default: ASC -> blanks first (-1), DESC -> blanks last (1)
        return isDesc ? 1 : -1;
      }
      if (bBlank) {
        if (spec.blanks === 'FIRST') return 1;
        if (spec.blanks === 'LAST') return -1;
        return isDesc ? -1 : 1;
      }

      const cmp = daxCompare(valA, valB);
      if (cmp !== 0) {
        return isDesc ? -cmp : cmp;
      }
    }
    return 0;
  });
}

/**
 * Window and Ranking Functions conforming to https://dax.guide/
 */
export const WINDOW_AND_RANKING_FUNCTIONS: Record<string, FunctionDefinition> = {
  // ==========================================
  // RANKX
  // RANKX(table, expression, [value], [order], [ties])
  // ==========================================
  RANKX: {
    name: 'RANKX',
    category: 'Janela e Ranking',
    syntax: 'RANKX(table, expression, [value], [order], [ties])',
    description: 'Calcula o ranking de uma expressão sobre uma tabela avaliada para cada linha. Suporta ordem ASC/DESC e desempate Skip/Dense.',
    example: 'RANKX(ALL(d_Cliente[Nome]), [Total Vendas], , DESC, Dense)',
    minArgs: 2,
    maxArgs: 5,
    isLazy: true,
  },

  // ==========================================
  // RANK (Modern Window Ranking)
  // RANK([ties], [relation], [orderBy], [blanks], [partitionBy], [matchBy])
  // ==========================================
  RANK: {
    name: 'RANK',
    category: 'Janela e Ranking',
    syntax: 'RANK([ties], [relation], [orderBy], [blanks], [partitionBy], [matchBy])',
    description: 'Retorna a classificação da linha atual dentro da partição especificada na ordenação dada.',
    example: 'RANK(DENSE, ALL(d_Produto), ORDERBY(d_Produto[Preco], DESC))',
    minArgs: 0,
    maxArgs: 6,
    isLazy: true,
  },

  // ==========================================
  // RANK.EQ (Scalar Rank)
  // RANK.EQ(value, columnName, [order])
  // ==========================================
  'RANK.EQ': {
    name: 'RANK.EQ',
    category: 'Janela e Ranking',
    syntax: 'RANK.EQ(value, columnName, [order])',
    description: 'Retorna o ranking de um número específico dentro de uma lista/coluna de números.',
    example: 'RANK.EQ(f_Vendas[ValorTotal], f_Vendas[ValorTotal], 0)',
    minArgs: 2,
    maxArgs: 3,
    evaluate: ([valArg, colArg, orderArg], context) => {
      if (valArg === null || valArg === undefined || isBlank(valArg)) {
        return DAX_BLANK;
      }

      const targetVal = daxToNumber(valArg, true);
      let columnName = '';
      let tableName = '';

      if (typeof colArg === 'string') {
        const m = colArg.match(/^(?:'?([^'\[]+)'?\[)?([^\]]+)\]?$/);
        if (m) {
          tableName = m[1] || '';
          columnName = m[2];
        } else {
          columnName = colArg;
        }
      } else if (colArg && typeof colArg === 'object') {
        tableName = colArg.table || '';
        columnName = colArg.column || '';
      }

      const model: ModelAccess | undefined = context?.model;
      let table = tableName && model ? model.getTable(tableName) : undefined;
      if (!table && model) {
        for (const t of model.getTables()) {
          if (t.columns.some(c => c.name.toLowerCase() === columnName.toLowerCase())) {
            table = t;
            break;
          }
        }
      }

      if (!table) {
        throw new DaxError('Semantic', `Coluna para RANK.EQ "${columnName}" não encontrada no modelo.`);
      }

      const filterCtx: FilterContext | undefined = context?.filterContext;
      const rows = filterCtx ? filterCtx.getFilteredRows(table.id, model) : (table.rows || []);

      // Extract numeric values from column
      const numbers: number[] = [];
      let foundExact = false;

      for (const r of rows) {
        const raw = r[columnName];
        if (raw !== null && raw !== undefined && !isBlank(raw)) {
          const num = daxToNumber(raw, true);
          numbers.push(num);
          if (num === targetVal) {
            foundExact = true;
          }
        }
      }

      if (!foundExact && numbers.length === 0) {
        return DAX_BLANK;
      }

      const isAsc = String(orderArg).toUpperCase() === '1' || String(orderArg).toUpperCase() === 'ASC';

      // Standard RANK.EQ uses Skip tie-breaking
      let countBetter = 0;
      for (const n of numbers) {
        if (isAsc) {
          if (n < targetVal) countBetter++;
        } else {
          if (n > targetVal) countBetter++;
        }
      }

      return countBetter + 1;
    },
  },

  // ==========================================
  // ROWNUMBER
  // ROWNUMBER([relation], [orderBy], [blanks], [partitionBy], [matchBy])
  // ==========================================
  ROWNUMBER: {
    name: 'ROWNUMBER',
    category: 'Janela e Ranking',
    syntax: 'ROWNUMBER([relation], [orderBy], [blanks], [partitionBy], [matchBy])',
    description: 'Retorna a classificação única e sequencial (1..N) da linha atual dentro da partição.',
    example: 'ROWNUMBER(ALL(d_Cliente), ORDERBY(d_Cliente[Nome], ASC))',
    minArgs: 0,
    maxArgs: 5,
    isLazy: true,
  },

  // ==========================================
  // Helper Specifier Functions: ORDERBY, PARTITIONBY, MATCHBY
  // ==========================================
  ORDERBY: {
    name: 'ORDERBY',
    category: 'Janela e Ranking',
    syntax: 'ORDERBY(col1, [direction], [col2, direction], ...)',
    description: 'Define as colunas e a ordem de classificação para funções de janela e ranking (INDEX, OFFSET, WINDOW, RANK).',
    example: 'ORDERBY(d_Calendario[Data], ASC)',
    minArgs: 1,
    maxArgs: -1,
    evaluate: (args) => {
      const specs: OrderBySpec[] = [];
      let i = 0;
      while (i < args.length) {
        const colArg = args[i];
        let col = '';
        if (typeof colArg === 'string') col = colArg.replace(/[\[\]]/g, '').trim();
        else if (colArg && typeof colArg === 'object') col = colArg.column || colArg.name || String(colArg);

        let direction: 'ASC' | 'DESC' = 'ASC';
        let blanks: 'DEFAULT' | 'FIRST' | 'LAST' = 'DEFAULT';

        if (i + 1 < args.length) {
          const nextVal = String(args[i + 1]).toUpperCase().trim();
          if (['ASC', 'DESC', '0', '1'].includes(nextVal)) {
            direction = (nextVal === 'DESC' || nextVal === '0') ? 'DESC' : 'ASC';
            i++;
            if (i + 1 < args.length) {
              const bVal = String(args[i + 1]).toUpperCase().trim();
              if (['DEFAULT', 'FIRST', 'LAST'].includes(bVal)) {
                blanks = bVal as any;
                i++;
              }
            }
          }
        }

        specs.push({ column: col, direction, blanks });
        i++;
      }
      return { __isOrderBy: true, specs };
    },
  },

  PARTITIONBY: {
    name: 'PARTITIONBY',
    category: 'Janela e Ranking',
    syntax: 'PARTITIONBY(col1, [col2], ...)',
    description: 'Define as colunas usadas para particionar a relação em funções de janela e ranking.',
    example: 'PARTITIONBY(d_Produto[Categoria])',
    minArgs: 1,
    maxArgs: -1,
    evaluate: (args) => {
      const columns = args.map(c => {
        if (typeof c === 'string') return c.replace(/[\[\]]/g, '').trim();
        if (c && typeof c === 'object') return c.column || c.name || String(c);
        return String(c);
      });
      return { __isPartitionBy: true, columns };
    },
  },

  MATCHBY: {
    name: 'MATCHBY',
    category: 'Janela e Ranking',
    syntax: 'MATCHBY(col1, [col2], ...)',
    description: 'Define as colunas que identificam de forma única cada linha da relação nas funções de janela.',
    example: 'MATCHBY(d_Cliente[ID_Cliente])',
    minArgs: 1,
    maxArgs: -1,
    evaluate: (args) => {
      const columns = args.map(c => {
        if (typeof c === 'string') return c.replace(/[\[\]]/g, '').trim();
        if (c && typeof c === 'object') return c.column || c.name || String(c);
        return String(c);
      });
      return { __isMatchBy: true, columns };
    },
  },

  // ==========================================
  // INDEX
  // INDEX(position, [relation], [orderBy], [blanks], [partitionBy], [matchBy])
  // NOTE: In column dialect, INDEX() with 0 args returns rowIndex + 1.
  // ==========================================
  INDEX: {
    name: 'INDEX',
    category: 'Janela e Ranking',
    syntax: 'INDEX(position, [relation], [orderBy], [blanks], [partitionBy], [matchBy])',
    description: 'Retorna a linha na posição especificada dentro da relação ordenada. No dialeto de coluna, INDEX() retorna o índice da linha atual.',
    example: 'INDEX(1, ALL(d_Produto), ORDERBY(d_Produto[Preco], DESC))',
    minArgs: 0,
    maxArgs: 6,
    evaluate: ([posArg, relArg, orderArg, blanksArg, partArg], context) => {
      // Compatibility with column engine: INDEX() without args returns row number
      if (context?.dialect === 'column' || posArg === undefined) {
        return (context?.rowIndex ?? 0) + 1;
      }

      const position = Math.trunc(daxToNumber(posArg, true));
      const model: ModelAccess | undefined = context?.model;
      const relationVal = relArg ? toDaxTable(relArg, model, context?.filterContext) : null;

      if (!relationVal || relationVal.rows.length === 0) {
        return {
          __isDaxTable: true,
          columns: relationVal ? relationVal.columns : [],
          rows: [],
          tableId: relationVal?.tableId,
          tableName: relationVal?.tableName,
          lineage: relationVal?.lineage,
        };
      }

      const orderSpecs = extractOrderBy(orderArg);
      let sortedRows = sortRowsBySpecs(relationVal.rows, orderSpecs);

      // 1-based indexing: 1 is first row, 2 is second row.
      // Negative index: -1 is last row, -2 is second from last.
      let targetIdx = -1;
      if (position > 0) {
        targetIdx = position - 1;
      } else if (position < 0) {
        targetIdx = sortedRows.length + position;
      }

      if (targetIdx >= 0 && targetIdx < sortedRows.length) {
        const picked = sortedRows[targetIdx];
        return {
          __isDaxTable: true,
          columns: relationVal.columns,
          rows: [picked],
          tableId: relationVal.tableId,
          tableName: relationVal.tableName,
          lineage: relationVal.lineage,
        };
      }

      // Out of bounds -> empty table
      return {
        __isDaxTable: true,
        columns: relationVal.columns,
        rows: [],
        tableId: relationVal.tableId,
        tableName: relationVal.tableName,
        lineage: relationVal.lineage,
      };
    },
  },

  // ==========================================
  // OFFSET
  // OFFSET(delta, [relation], [orderBy], [blanks], [partitionBy], [matchBy])
  // ==========================================
  OFFSET: {
    name: 'OFFSET',
    category: 'Janela e Ranking',
    syntax: 'OFFSET(delta, [relation], [orderBy], [blanks], [partitionBy], [matchBy])',
    description: 'Retorna a linha deslocada por delta posições a partir da linha atual dentro da relação.',
    example: 'OFFSET(-1, ALL(d_Calendario[Data]), ORDERBY(d_Calendario[Data], ASC))',
    minArgs: 1,
    maxArgs: 6,
    evaluate: ([deltaArg, relArg, orderArg], context) => {
      const delta = Math.trunc(daxToNumber(deltaArg, true));
      const model: ModelAccess | undefined = context?.model;

      // If relation is omitted, try using the date column or current table in context
      let relationVal: DaxTableValue | null = null;
      if (relArg) {
        relationVal = toDaxTable(relArg, model, context?.filterContext);
      } else if (context?.tableId && model) {
        const t = model.getTable(context.tableId);
        if (t) relationVal = toDaxTable(t, model, context?.filterContext);
      }

      if (!relationVal || relationVal.rows.length === 0) {
        return {
          __isDaxTable: true,
          columns: relationVal ? relationVal.columns : [],
          rows: [],
          tableId: relationVal?.tableId,
          tableName: relationVal?.tableName,
          lineage: relationVal?.lineage,
        };
      }

      const orderSpecs = extractOrderBy(orderArg);
      let sortedRows = sortRowsBySpecs(relationVal.rows, orderSpecs);

      // Locate current row index in sortedRows
      let currentIdx = -1;
      const curRow = context?.row || (context?.rowContextStack && context.rowContextStack.peek()?.row);

      if (curRow) {
        // Match by all columns in relationVal or by date column
        currentIdx = sortedRows.findIndex(r => {
          for (const col of relationVal!.columns) {
            if (!daxEqual(r[col], curRow[col])) return false;
          }
          return true;
        });
      } else if (context?.filterContext) {
        // If evaluated under a filter context with single visible row (e.g. Month = 2024-03)
        const targetCol = relationVal.columns[0];
        const targetTableId = relationVal.tableId || '';
        const colFilter = targetTableId ? context.filterContext.getColumnFilter(targetTableId, targetCol) : undefined;
        if (colFilter && colFilter.allowedValues && colFilter.allowedValues.size === 1) {
          const onlyVal = Array.from(colFilter.allowedValues)[0];
          currentIdx = sortedRows.findIndex(r => daxEqual(r[targetCol], onlyVal));
        } else {
          // Check visible dates/values in filter context
          const visibleRows = context.filterContext.getFilteredRows(targetTableId, model);
          if (visibleRows.length > 0) {
            const firstVis = visibleRows[0][targetCol];
            currentIdx = sortedRows.findIndex(r => daxEqual(r[targetCol], firstVis));
          }
        }
      }

      if (currentIdx === -1 && context?.visualRowIndex !== undefined) {
        currentIdx = context.visualRowIndex;
      }

      const targetIdx = currentIdx + delta;

      if (targetIdx >= 0 && targetIdx < sortedRows.length) {
        const picked = sortedRows[targetIdx];
        return {
          __isDaxTable: true,
          columns: relationVal.columns,
          rows: [picked],
          tableId: relationVal.tableId,
          tableName: relationVal.tableName,
          lineage: relationVal.lineage,
        };
      }

      // Out of bounds (e.g. OFFSET(-1) on first row) -> empty table
      return {
        __isDaxTable: true,
        columns: relationVal.columns,
        rows: [],
        tableId: relationVal.tableId,
        tableName: relationVal.tableName,
        lineage: relationVal.lineage,
      };
    },
  },

  // ==========================================
  // WINDOW
  // WINDOW(from, [from_type], to, [to_type], [relation], [orderBy], [blanks], [partitionBy], [matchBy])
  // ==========================================
  WINDOW: {
    name: 'WINDOW',
    category: 'Janela e Ranking',
    syntax: 'WINDOW(from, [from_type], to, [to_type], [relation], [orderBy], [blanks], [partitionBy], [matchBy])',
    description: 'Retorna múltiplas linhas posicionadas dentro do intervalo especificado relativo ou absoluto.',
    example: 'WINDOW(-3, REL, 0, REL, ALL(d_Calendario[Data]), ORDERBY(d_Calendario[Data], ASC))',
    minArgs: 2,
    maxArgs: 9,
    evaluate: (args, context) => {
      const from = Math.trunc(daxToNumber(args[0], true));
      let fromType = 'REL';
      let toIdx = 1;

      if (args[1] && typeof args[1] === 'string' && ['ABS', 'REL'].includes(String(args[1]).toUpperCase())) {
        fromType = String(args[1]).toUpperCase();
        toIdx = 2;
      }

      const to = Math.trunc(daxToNumber(args[toIdx], true));
      let toType = 'REL';
      let relIdx = toIdx + 1;

      if (args[relIdx] && typeof args[relIdx] === 'string' && ['ABS', 'REL'].includes(String(args[relIdx]).toUpperCase())) {
        toType = String(args[relIdx]).toUpperCase();
        relIdx++;
      }

      const relArg = args[relIdx];
      const orderArg = args[relIdx + 1];

      const model: ModelAccess | undefined = context?.model;
      const relationVal = relArg ? toDaxTable(relArg, model, context?.filterContext) : null;

      if (!relationVal || relationVal.rows.length === 0) {
        return {
          __isDaxTable: true,
          columns: relationVal ? relationVal.columns : [],
          rows: [],
          tableId: relationVal?.tableId,
          tableName: relationVal?.tableName,
          lineage: relationVal?.lineage,
        };
      }

      const orderSpecs = extractOrderBy(orderArg);
      const sortedRows = sortRowsBySpecs(relationVal.rows, orderSpecs);

      let curIdx = 0;
      const curRow = context?.row;
      if (curRow) {
        curIdx = sortedRows.findIndex(r => {
          for (const col of relationVal!.columns) {
            if (!daxEqual(r[col], curRow[col])) return false;
          }
          return true;
        });
        if (curIdx === -1) curIdx = 0;
      }

      const startIdx = fromType === 'ABS' ? (from > 0 ? from - 1 : sortedRows.length + from) : curIdx + from;
      const endIdx = toType === 'ABS' ? (to > 0 ? to - 1 : sortedRows.length + to) : curIdx + to;

      const actualStart = Math.max(0, Math.min(startIdx, endIdx));
      const actualEnd = Math.min(sortedRows.length - 1, Math.max(startIdx, endIdx));

      const slicedRows = (actualStart <= actualEnd && actualStart < sortedRows.length)
        ? sortedRows.slice(actualStart, actualEnd + 1)
        : [];

      return {
        __isDaxTable: true,
        columns: relationVal.columns,
        rows: slicedRows,
        tableId: relationVal.tableId,
        tableName: relationVal.tableName,
        lineage: relationVal.lineage,
      };
    },
  },

  // ==========================================
  // LOOKUP / LOOKUPWITHTOTALS
  // ==========================================
  LOOKUP: {
    name: 'LOOKUP',
    category: 'Janela e Ranking',
    syntax: 'LOOKUP(result_column, [relation], [orderBy], [blanks], [partitionBy], [matchBy])',
    description: 'Retorna um único valor da coluna de resultado na linha especificada dentro da relação ordenada.',
    example: 'LOOKUP(d_Produto[Preco], ALL(d_Produto), ORDERBY(d_Produto[Preco], DESC))',
    minArgs: 1,
    maxArgs: 6,
    evaluate: ([colArg], context) => {
      if (context?.row && typeof colArg === 'string' && colArg in context.row) {
        return context.row[colArg];
      }
      return DAX_BLANK;
    },
  },

  LOOKUPWITHTOTALS: {
    name: 'LOOKUPWITHTOTALS',
    category: 'Janela e Ranking',
    syntax: 'LOOKUPWITHTOTALS(result_column, [relation], [orderBy], [blanks], [partitionBy], [matchBy])',
    description: 'Retorna um único valor da coluna de resultado incluindo totais.',
    example: 'LOOKUPWITHTOTALS([Total], ALL(d_Produto))',
    minArgs: 1,
    maxArgs: 6,
    evaluate: ([colArg], context) => {
      if (context?.row && typeof colArg === 'string' && colArg in context.row) {
        return context.row[colArg];
      }
      return DAX_BLANK;
    },
  },
};
