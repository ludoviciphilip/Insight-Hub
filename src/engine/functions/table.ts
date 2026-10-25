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

/**
 * Helper to normalize any table input (DaxTableValue, Table model, or Array of rows) into a DaxTableValue
 */
export function toDaxTable(input: any, model?: ModelAccess, filterContext?: FilterContext): DaxTableValue {
  if (isDaxTable(input)) {
    return input;
  }

  if (input && typeof input === 'object' && input.__isModifier && input.rows) {
    const table = model?.getTable(input.tableId || input.tableName);
    const cols = input.columns || (table ? table.columns.map((c: any) => c.name) : (input.rows[0] ? Object.keys(input.rows[0]) : []));
    const lineage: Record<string, { tableId: string; tableName: string; column: string }> = {};
    if (table) {
      for (const c of cols) {
        lineage[c] = { tableId: table.id, tableName: table.name, column: c };
      }
    }
    return {
      __isDaxTable: true,
      columns: cols,
      rows: input.rows,
      tableId: table ? table.id : input.tableId,
      tableName: table ? table.name : input.tableName,
      lineage,
    };
  }

  // String table name or ColumnRef object
  let tableName = '';
  if (typeof input === 'string') {
    tableName = input.replace(/^[\[']|['\]]$/g, '');
  } else if (input && typeof input === 'object' && (input.table || input.column)) {
    tableName = input.table || input.column;
  }

  if (tableName && model) {
    const table = model.getTable(tableName);
    if (table) {
      const rows = filterContext ? filterContext.getFilteredRows(table.id, model) : (table.rows || []);
      const cols = table.columns.map(c => c.name);
      const lineage: Record<string, { tableId: string; tableName: string; column: string }> = {};
      for (const c of cols) {
        lineage[c] = { tableId: table.id, tableName: table.name, column: c };
      }
      return {
        __isDaxTable: true,
        columns: cols,
        rows: rows,
        tableId: table.id,
        tableName: table.name,
        lineage,
      };
    }
  }

  // Array of rows or primitive values
  if (Array.isArray(input)) {
    if (input.length === 0) {
      return {
        __isDaxTable: true,
        columns: [],
        rows: [],
      };
    }

    if (typeof input[0] === 'object' && input[0] !== null) {
      if (Array.isArray(input[0])) {
        const maxCols = Math.max(...input.map(r => (Array.isArray(r) ? r.length : 1)));
        const cols = Array.from({ length: maxCols }, (_, i) => (i === 0 ? 'Value' : `Value${i + 1}`));
        const rows = input.map(r => {
          const rowObj: Record<string, any> = {};
          cols.forEach((c, idx) => {
            rowObj[c] = Array.isArray(r) && r[idx] !== undefined ? r[idx] : (idx === 0 ? r : DAX_BLANK);
          });
          return rowObj;
        });
        return {
          __isDaxTable: true,
          columns: cols,
          rows,
        };
      }
      const cols = Object.keys(input[0]);
      return {
        __isDaxTable: true,
        columns: cols,
        rows: input,
      };
    }

    // Array of primitives (e.g. from VALUES)
    const colName = 'Value';
    return {
      __isDaxTable: true,
      columns: [colName],
      rows: input.map(v => ({ [colName]: v })),
    };
  }

  // Single scalar fallback
  return {
    __isDaxTable: true,
    columns: ['Value'],
    rows: [{ Value: input }],
  };
}

/**
 * Factorial helper with memoization for combinatorial functions
 */
function factorial(n: number): number {
  if (n < 0) throw new DaxError('Execution', 'Fatorial não definido para números negativos');
  if (n === 0 || n === 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) {
    res *= i;
  }
  return res;
}

export const TABLE_FUNCTIONS: Record<string, FunctionDefinition> = {
  // ==========================================
  // ROW: Single-row table constructor
  // ==========================================
  ROW: {
    name: 'ROW',
    category: 'Tabela',
    syntax: 'ROW(name1, expression1, [name2, expression2, ...])',
    description: 'Retorna uma tabela com uma única linha contendo valores calculados a partir das expressões fornecidas.',
    example: 'ROW("Total Vendas", [Total], "Meta", 10000)',
    minArgs: 2,
    maxArgs: -1,
    evaluate: (args) => {
      if (args.length % 2 !== 0) {
        throw new DaxError('Semantic', 'A função ROW requer pares de (nome, expressão)');
      }
      const columns: string[] = [];
      const row: Record<string, any> = {};

      for (let i = 0; i < args.length; i += 2) {
        const colName = daxToString(args[i]);
        const val = args[i + 1];
        columns.push(colName);
        row[colName] = val;
      }

      const tableValue: DaxTableValue = {
        __isDaxTable: true,
        columns,
        rows: [row],
      };
      return tableValue;
    },
  },

  // ==========================================
  // GENERATESERIES
  // ==========================================
  GENERATESERIES: {
    name: 'GENERATESERIES',
    category: 'Tabela',
    syntax: 'GENERATESERIES(startValue, endValue, [incrementValue])',
    description: 'Retorna uma tabela de uma única coluna [Value] com uma série de valores de startValue até endValue com o incremento especificado.',
    example: 'GENERATESERIES(1, 10, 2)',
    minArgs: 2,
    maxArgs: 3,
    evaluate: ([startVal, endVal, incVal]) => {
      const start = daxToNumber(startVal, true);
      const end = daxToNumber(endVal, true);
      let step = incVal !== undefined ? daxToNumber(incVal, true) : (start <= end ? 1 : -1);

      if (step === 0) {
        throw new DaxError('Execution', 'O incremento em GENERATESERIES não pode ser 0');
      }

      const rows: Record<string, any>[] = [];
      const maxRows = 100000;

      if (step > 0) {
        for (let v = start; v <= end + 1e-9 && rows.length < maxRows; v += step) {
          // Fix floating point precision
          const rounded = Math.round(v * 1e9) / 1e9;
          rows.push({ Value: rounded });
        }
      } else {
        for (let v = start; v >= end - 1e-9 && rows.length < maxRows; v += step) {
          const rounded = Math.round(v * 1e9) / 1e9;
          rows.push({ Value: rounded });
        }
      }

      const result: DaxTableValue = {
        __isDaxTable: true,
        columns: ['Value'],
        rows,
      };
      return result;
    },
  },

  // ==========================================
  // DATATABLE
  // ==========================================
  DATATABLE: {
    name: 'DATATABLE',
    category: 'Tabela',
    syntax: 'DATATABLE(columnName1, dataType1, [columnName2, dataType2, ...], data)',
    description: 'Define uma tabela inline com colunas, tipos e valores estáticos.',
    example: 'DATATABLE("Cor", STRING, "Codigo", INTEGER, { {"Azul", 1}, {"Verde", 2} })',
    minArgs: 3,
    maxArgs: -1,
    evaluate: (args) => {
      const rawData = args[args.length - 1];
      const colDefs = args.slice(0, args.length - 1);
      if (colDefs.length % 2 !== 0) {
        throw new DaxError('Semantic', 'DATATABLE requer pares de (nomeDaColuna, tipoDeDado) antes dos dados');
      }

      const columns: string[] = [];
      for (let i = 0; i < colDefs.length; i += 2) {
        columns.push(daxToString(colDefs[i]));
      }

      const rows: Record<string, any>[] = [];
      if (Array.isArray(rawData)) {
        for (const r of rawData) {
          const rowObj: Record<string, any> = {};
          if (Array.isArray(r)) {
            columns.forEach((col, idx) => {
              rowObj[col] = r[idx] !== undefined ? r[idx] : DAX_BLANK;
            });
          } else if (typeof r === 'object' && r !== null) {
            columns.forEach(col => {
              rowObj[col] = r[col] !== undefined ? r[col] : DAX_BLANK;
            });
          }
          rows.push(rowObj);
        }
      }

      return {
        __isDaxTable: true,
        columns,
        rows,
      };
    },
  },

  // ==========================================
  // UNION
  // ==========================================
  UNION: {
    name: 'UNION',
    category: 'Tabela',
    syntax: 'UNION(table1, table2, [table3, ...])',
    description: 'Cria uma tabela unindo as linhas de duas ou mais tabelas. A tabela resultante herda as colunas da primeira tabela.',
    example: 'UNION(f_Vendas2023, f_Vendas2024)',
    minArgs: 2,
    maxArgs: -1,
    evaluate: (args, context) => {
      const model = context?.model;
      const tables = args.map(a => toDaxTable(a, model, context?.filterContext));
      const first = tables[0];
      const cols = first.columns;

      const mergedRows: Record<string, any>[] = [];
      for (const t of tables) {
        for (const row of t.rows) {
          const newRow: Record<string, any> = {};
          cols.forEach((col, idx) => {
            if (row[col] !== undefined) {
              newRow[col] = row[col];
            } else if (t.columns[idx] !== undefined) {
              newRow[col] = row[t.columns[idx]];
            } else {
              newRow[col] = DAX_BLANK;
            }
          });
          mergedRows.push(newRow);
        }
      }

      return {
        __isDaxTable: true,
        columns: cols,
        rows: mergedRows,
        lineage: first.lineage,
      };
    },
  },

  // ==========================================
  // INTERSECT
  // ==========================================
  INTERSECT: {
    name: 'INTERSECT',
    category: 'Tabela',
    syntax: 'INTERSECT(leftTable, rightTable)',
    description: 'Retorna a interseção de linhas entre duas tabelas, mantendo as duplicatas de leftTable se presentes em rightTable.',
    example: 'INTERSECT(VALUES(ClientesA), VALUES(ClientesB))',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([t1Arg, t2Arg], context) => {
      const model = context?.model;
      const t1 = toDaxTable(t1Arg, model, context?.filterContext);
      const t2 = toDaxTable(t2Arg, model, context?.filterContext);

      const makeKey = (row: Record<string, any>, cols: string[]) => {
        return cols.map(c => JSON.stringify(row[c] ?? null)).join('|');
      };

      const set2 = new Set(t2.rows.map(r => makeKey(r, t2.columns)));
      const matchingRows = t1.rows.filter(r => set2.has(makeKey(r, t1.columns)));

      return {
        __isDaxTable: true,
        columns: t1.columns,
        rows: matchingRows,
        lineage: t1.lineage,
      };
    },
  },

  // ==========================================
  // EXCEPT
  // ==========================================
  EXCEPT: {
    name: 'EXCEPT',
    category: 'Tabela',
    syntax: 'EXCEPT(leftTable, rightTable)',
    description: 'Retorna as linhas de leftTable que não aparecem em rightTable.',
    example: 'EXCEPT(VALUES(TodosClientes), VALUES(ClientesInadimplentes))',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([t1Arg, t2Arg], context) => {
      const model = context?.model;
      const t1 = toDaxTable(t1Arg, model, context?.filterContext);
      const t2 = toDaxTable(t2Arg, model, context?.filterContext);

      const makeKey = (row: Record<string, any>, cols: string[]) => {
        return cols.map(c => JSON.stringify(row[c] ?? null)).join('|');
      };

      const set2 = new Set(t2.rows.map(r => makeKey(r, t2.columns)));
      const diffRows = t1.rows.filter(r => !set2.has(makeKey(r, t1.columns)));

      return {
        __isDaxTable: true,
        columns: t1.columns,
        rows: diffRows,
        lineage: t1.lineage,
      };
    },
  },

  // ==========================================
  // CROSSJOIN
  // ==========================================
  CROSSJOIN: {
    name: 'CROSSJOIN',
    category: 'Tabela',
    syntax: 'CROSSJOIN(table1, table2, [table3, ...])',
    description: 'Retorna o produto cartesiano das linhas de duas ou mais tabelas.',
    example: 'CROSSJOIN(d_Produtos, d_Canais)',
    minArgs: 2,
    maxArgs: -1,
    evaluate: (args, context) => {
      const model = context?.model;
      const tables = args.map(a => toDaxTable(a, model, context?.filterContext));

      let resultRows: Record<string, any>[] = [{}];
      let allCols: string[] = [];
      const lineage: Record<string, any> = {};

      for (const t of tables) {
        const nextRows: Record<string, any>[] = [];
        for (const curr of resultRows) {
          for (const row of t.rows) {
            nextRows.push({ ...curr, ...row });
          }
        }
        resultRows = nextRows;
        allCols = [...allCols, ...t.columns];
        if (t.lineage) {
          Object.assign(lineage, t.lineage);
        }
      }

      return {
        __isDaxTable: true,
        columns: Array.from(new Set(allCols)),
        rows: resultRows,
        lineage,
      };
    },
  },

  // ==========================================
  // NATURALINNERJOIN & NATURALLEFTOUTERJOIN
  // ==========================================
  NATURALINNERJOIN: {
    name: 'NATURALINNERJOIN',
    category: 'Tabela',
    syntax: 'NATURALINNERJOIN(leftTable, rightTable)',
    description: 'Executa uma junção interna baseada nas colunas comuns entre as duas tabelas.',
    example: 'NATURALINNERJOIN(Tabela1, Tabela2)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([t1Arg, t2Arg], context) => {
      const model = context?.model;
      const t1 = toDaxTable(t1Arg, model, context?.filterContext);
      const t2 = toDaxTable(t2Arg, model, context?.filterContext);

      const commonCols = t1.columns.filter(c => t2.columns.includes(c));
      const rightOnlyCols = t2.columns.filter(c => !commonCols.includes(c));

      const matchedRows: Record<string, any>[] = [];

      for (const r1 of t1.rows) {
        for (const r2 of t2.rows) {
          const matches = commonCols.every(c => daxEqual(r1[c], r2[c]));
          if (matches) {
            const combined: Record<string, any> = { ...r1 };
            for (const roc of rightOnlyCols) {
              combined[roc] = r2[roc];
            }
            matchedRows.push(combined);
          }
        }
      }

      return {
        __isDaxTable: true,
        columns: [...t1.columns, ...rightOnlyCols],
        rows: matchedRows,
        lineage: { ...t1.lineage, ...t2.lineage },
      };
    },
  },

  NATURALLEFTOUTERJOIN: {
    name: 'NATURALLEFTOUTERJOIN',
    category: 'Tabela',
    syntax: 'NATURALLEFTOUTERJOIN(leftTable, rightTable)',
    description: 'Executa uma junção externa à esquerda baseada nas colunas comuns entre as duas tabelas.',
    example: 'NATURALLEFTOUTERJOIN(Tabela1, Tabela2)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([t1Arg, t2Arg], context) => {
      const model = context?.model;
      const t1 = toDaxTable(t1Arg, model, context?.filterContext);
      const t2 = toDaxTable(t2Arg, model, context?.filterContext);

      const commonCols = t1.columns.filter(c => t2.columns.includes(c));
      const rightOnlyCols = t2.columns.filter(c => !commonCols.includes(c));

      const joinedRows: Record<string, any>[] = [];

      for (const r1 of t1.rows) {
        let matchFound = false;
        for (const r2 of t2.rows) {
          const matches = commonCols.every(c => daxEqual(r1[c], r2[c]));
          if (matches) {
            matchFound = true;
            const combined: Record<string, any> = { ...r1 };
            for (const roc of rightOnlyCols) {
              combined[roc] = r2[roc];
            }
            joinedRows.push(combined);
          }
        }
        if (!matchFound) {
          const combined: Record<string, any> = { ...r1 };
          for (const roc of rightOnlyCols) {
            combined[roc] = DAX_BLANK;
          }
          joinedRows.push(combined);
        }
      }

      return {
        __isDaxTable: true,
        columns: [...t1.columns, ...rightOnlyCols],
        rows: joinedRows,
        lineage: { ...t1.lineage, ...t2.lineage },
      };
    },
  },

  // ==========================================
  // NAMEOF: Identifier to text
  // ==========================================
  NAMEOF: {
    name: 'NAMEOF',
    category: 'Informação',
    syntax: 'NAMEOF(measure_or_column)',
    description: 'Retorna o nome da coluna ou medida fornecida como uma cadeia de texto.',
    example: 'NAMEOF([Total Vendas])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([arg]) => {
      if (typeof arg === 'string') {
        const m = arg.match(/\[([^\]]+)\]/);
        return m ? m[1] : arg;
      }
      if (arg && typeof arg === 'object') {
        return arg.column || arg.name || arg.measure || '';
      }
      return daxToString(arg);
    },
  },

  // ==========================================
  // TOPN Runtime Fallback (Full AST in Evaluator)
  // ==========================================
  TOPN: {
    name: 'TOPN',
    category: 'Tabela',
    syntax: 'TOPN(n_value, table, [orderBy_expression], [order], ...)',
    description: 'Retorna as primeiras N linhas de uma tabela ordenada por uma ou mais expressões.',
    example: 'TOPN(5, VALUES(d_Produtos[Nome]), [Total Vendas], DESC)',
    minArgs: 2,
    maxArgs: -1,
    evaluate: (args, context) => {
      const n = Math.max(0, Math.trunc(daxToNumber(args[0], true)));
      const model = context?.model;
      const t = toDaxTable(args[1], model, context?.filterContext);
      if (n === 0 || t.rows.length === 0) {
        return {
          __isDaxTable: true,
          columns: t.columns,
          rows: [],
          lineage: t.lineage,
        };
      }
      // Simple slice fallback when evaluated without AST
      return {
        __isDaxTable: true,
        columns: t.columns,
        rows: t.rows.slice(0, n),
        lineage: t.lineage,
      };
    },
  },

  TOPNSKIP: {
    name: 'TOPNSKIP',
    category: 'Tabela',
    syntax: 'TOPNSKIP(n_value, skip_value, table, [orderBy_expression], [order])',
    description: 'Ignora as primeiras skip_value linhas e retorna as próximas n_value linhas.',
    example: 'TOPNSKIP(10, 5, d_Clientes)',
    minArgs: 3,
    maxArgs: 5,
    evaluate: (args, context) => {
      const n = Math.max(0, Math.trunc(daxToNumber(args[0], true)));
      const skip = Math.max(0, Math.trunc(daxToNumber(args[1], true)));
      const model = context?.model;
      const t = toDaxTable(args[2], model, context?.filterContext);

      return {
        __isDaxTable: true,
        columns: t.columns,
        rows: t.rows.slice(skip, skip + n),
        lineage: t.lineage,
      };
    },
  },

  TOPNPERLEVEL: {
    name: 'TOPNPERLEVEL',
    category: 'Tabela',
    syntax: 'TOPNPERLEVEL(n_value, table, level_column, [orderBy], [order])',
    description: 'Retorna as N primeiras linhas por nível de agrupamento.',
    example: 'TOPNPERLEVEL(3, f_Vendas, f_Vendas[Categoria])',
    minArgs: 3,
    maxArgs: 5,
    evaluate: (args, context) => {
      const n = Math.max(0, Math.trunc(daxToNumber(args[0], true)));
      const model = context?.model;
      const t = toDaxTable(args[1], model, context?.filterContext);
      const levelCol = daxToString(args[2]).replace(/^[\[]|\]$/g, '');

      const groups = new Map<any, Record<string, any>[]>();
      for (const r of t.rows) {
        const key = r[levelCol];
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }

      const resRows: Record<string, any>[] = [];
      for (const [, rows] of groups) {
        resRows.push(...rows.slice(0, n));
      }

      return {
        __isDaxTable: true,
        columns: t.columns,
        rows: resRows,
        lineage: t.lineage,
      };
    },
  },

  SAMPLE: {
    name: 'SAMPLE',
    category: 'Tabela',
    syntax: 'SAMPLE(n_value, table, [order_by_col], [order])',
    description: 'Retorna uma amostra de N linhas da tabela especificada.',
    example: 'SAMPLE(10, f_Vendas)',
    minArgs: 2,
    maxArgs: 4,
    evaluate: (args, context) => {
      const n = Math.max(0, Math.trunc(daxToNumber(args[0], true)));
      const model = context?.model;
      const t = toDaxTable(args[1], model, context?.filterContext);
      return {
        __isDaxTable: true,
        columns: t.columns,
        rows: t.rows.slice(0, n),
        lineage: t.lineage,
      };
    },
  },

  DETAILROWS: {
    name: 'DETAILROWS',
    category: 'Tabela',
    syntax: 'DETAILROWS(measure)',
    description: 'Retorna a tabela detalhada associada a uma medida.',
    example: 'DETAILROWS([Total Vendas])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (_args, context) => {
      const model = context?.model;
      const tables = model?.getTables() || [];
      const first = tables[0];
      return first ? toDaxTable(first, model, context?.filterContext) : { __isDaxTable: true, columns: [], rows: [] };
    },
  },

  SUBSTITUTEWITHINDEX: {
    name: 'SUBSTITUTEWITHINDEX',
    category: 'Tabela',
    syntax: 'SUBSTITUTEWITHINDEX(table, indexColumnName, indexTable, orderByColumn, [order])',
    description: 'Substitui ou adiciona uma coluna de índice baseada em outra tabela indexada.',
    example: 'SUBSTITUTEWITHINDEX(t1, "Index", t2, t2[Nome], ASC)',
    minArgs: 4,
    maxArgs: 5,
    evaluate: (args, context) => {
      const model = context?.model;
      const t1 = toDaxTable(args[0], model, context?.filterContext);
      const idxColName = daxToString(args[1]);
      const rows = t1.rows.map((r, i) => ({ ...r, [idxColName]: i + 1 }));
      return {
        __isDaxTable: true,
        columns: [...t1.columns, idxColName],
        rows,
        lineage: t1.lineage,
      };
    },
  },

  NATURALJOINUSAGE: {
    name: 'NATURALJOINUSAGE',
    category: 'Tabela',
    syntax: 'NATURALJOINUSAGE(...)',
    description: 'Dica de junção para execução DAX.',
    example: 'NATURALJOINUSAGE()',
    minArgs: 0,
    maxArgs: -1,
    evaluate: () => DAX_BLANK,
  },

  // ==========================================
  // SUMMARIZE / GROUPBY / ROLLUP Modifiers
  // ==========================================
  CURRENTGROUP: {
    name: 'CURRENTGROUP',
    category: 'Tabela',
    syntax: 'CURRENTGROUP()',
    description: 'Retorna o subconjunto de linhas do grupo atual em uma expressão GROUPBY.',
    example: 'CURRENTGROUP()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: (_args, context) => {
      const groupRows = (context as any)?.currentGroupRows || [];
      return {
        __isDaxTable: true,
        columns: groupRows.length > 0 ? Object.keys(groupRows[0]) : [],
        rows: groupRows,
      };
    },
  },

  ROLLUP: {
    name: 'ROLLUP',
    category: 'Tabela',
    syntax: 'ROLLUP(column1, [column2, ...])',
    description: 'Modificador para SUMMARIZE que adiciona linhas de subtotal à agregação.',
    example: 'SUMMARIZE(f_Vendas, ROLLUP(d_Produtos[Categoria]), "Total", [Total])',
    minArgs: 1,
    maxArgs: -1,
    evaluate: (args) => ({ __isRollup: true, columns: args }),
  },

  ROLLUPGROUP: {
    name: 'ROLLUPGROUP',
    category: 'Tabela',
    syntax: 'ROLLUPGROUP(column1, [column2, ...])',
    description: 'Agrupa colunas para evitar subtotais intermediários indesejados em um ROLLUP.',
    example: 'ROLLUPGROUP(d_Calendario[Ano], d_Calendario[Mes])',
    minArgs: 1,
    maxArgs: -1,
    evaluate: (args) => ({ __isRollupGroup: true, columns: args }),
  },

  ROLLUPISSUBTOTAL: {
    name: 'ROLLUPISSUBTOTAL',
    category: 'Tabela',
    syntax: 'ROLLUPISSUBTOTAL(column, subtotalColName)',
    description: 'Adiciona uma coluna que indica se uma linha é uma linha de subtotal em SUMMARIZE.',
    example: 'ROLLUPISSUBTOTAL(d_Produtos[Categoria], "IsSubtotal")',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([col, name]) => ({ __isRollupIsSubtotal: true, column: col, name }),
  },

  ROLLUPADDISSUBTOTAL: {
    name: 'ROLLUPADDISSUBTOTAL',
    category: 'Tabela',
    syntax: 'ROLLUPADDISSUBTOTAL(column, subtotalColName)',
    description: 'Modificador para SUMMARIZECOLUMNS que gera totais/subtotais e adiciona uma coluna de flag.',
    example: 'SUMMARIZECOLUMNS(ROLLUPADDISSUBTOTAL(d_Produtos[Categoria], "IsTotal"), "Total", [Total])',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([col, name]) => ({ __isRollupAddIsSubtotal: true, column: col, name }),
  },

  IGNORE: {
    name: 'IGNORE',
    category: 'Tabela',
    syntax: 'IGNORE(expression)',
    description: 'Modificador para SUMMARIZECOLUMNS que impede que a expressão omita linhas em branco.',
    example: 'SUMMARIZECOLUMNS(d_Clientes[Cliente], "Total", IGNORE([Total]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => ({ __isIgnore: true, value: val }),
  },

  NONVISUAL: {
    name: 'NONVISUAL',
    category: 'Tabela',
    syntax: 'NONVISUAL(expression)',
    description: 'Modificador para SUMMARIZECOLUMNS que marca um filtro como não visual.',
    example: 'NONVISUAL(FILTER(d_Produtos, d_Produtos[Preco] > 100))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => ({ __isNonVisual: true, value: val }),
  },

  ADDMISSINGITEMS: {
    name: 'ADDMISSINGITEMS',
    category: 'Tabela',
    syntax: 'ADDMISSINGITEMS(showAll_column1, [showAll_column2, ...], table, [groupBy_col1, ...])',
    description: 'Adiciona itens com valores em branco a uma tabela resumida para manter todas as categorias visíveis.',
    example: 'ADDMISSINGITEMS(d_Calendario[Mes], Resumo, d_Calendario[Ano])',
    minArgs: 2,
    maxArgs: -1,
    evaluate: (args, context) => {
      // Find table in args
      const model = context?.model;
      for (const arg of args) {
        if (isDaxTable(arg) || (arg && typeof arg === 'object' && arg.rows)) {
          return toDaxTable(arg, model, context?.filterContext);
        }
      }
      return { __isDaxTable: true, columns: [], rows: [] };
    },
  },

  // ==========================================
  // Combinatorial Math Functions
  // ==========================================
  COMBIN: {
    name: 'COMBIN',
    category: 'Matemática',
    syntax: 'COMBIN(number, number_chosen)',
    description: 'Retorna o número de combinações para um determinado número de itens sem repetição: n! / (k! * (n - k)!).',
    example: 'COMBIN(8, 2)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([nVal, kVal]) => {
      const n = Math.trunc(daxToNumber(nVal, true));
      const k = Math.trunc(daxToNumber(kVal, true));
      if (n < 0 || k < 0) {
        throw new DaxError('Execution', 'COMBIN não aceita números negativos');
      }
      if (k > n) return 0;
      if (k === 0 || k === n) return 1;
      return factorial(n) / (factorial(k) * factorial(n - k));
    },
  },

  COMBINA: {
    name: 'COMBINA',
    category: 'Matemática',
    syntax: 'COMBINA(number, number_chosen)',
    description: 'Retorna o número de combinações com repetições para um determinado número de itens: (n + k - 1)! / (k! * (n - 1)!).',
    example: 'COMBINA(4, 3)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([nVal, kVal]) => {
      const n = Math.trunc(daxToNumber(nVal, true));
      const k = Math.trunc(daxToNumber(kVal, true));
      if (n < 0 || k < 0) {
        throw new DaxError('Execution', 'COMBINA não aceita números negativos');
      }
      if (n === 0 && k === 0) return 1;
      if (n === 0) return 0;
      if (k === 0) return 1;
      return factorial(n + k - 1) / (factorial(k) * factorial(n - 1));
    },
  },

  PERMUT: {
    name: 'PERMUT',
    category: 'Matemática',
    syntax: 'PERMUT(number, number_chosen)',
    description: 'Retorna o número de permutações para um determinado número de objetos que podem ser selecionados de um total de objetos: n! / (n - k)!).',
    example: 'PERMUT(5, 3)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([nVal, kVal]) => {
      const n = Math.trunc(daxToNumber(nVal, true));
      const k = Math.trunc(daxToNumber(kVal, true));
      if (n < 0 || k < 0) {
        throw new DaxError('Execution', 'PERMUT não aceita números negativos');
      }
      if (k > n) return 0;
      if (k === 0) return 1;
      return factorial(n) / factorial(n - k);
    },
  },

  // ==========================================
  // Table Expressions & Iterative Shapes
  // ==========================================
  ADDCOLUMNS: {
    name: 'ADDCOLUMNS',
    category: 'Tabela',
    syntax: 'ADDCOLUMNS(table, name1, expression1, [name2, expression2, ...])',
    description: 'Adiciona colunas calculadas à tabela ou expressão de tabela fornecida.',
    example: 'ADDCOLUMNS(d_Cliente, "Total Vendas", [Total])',
    minArgs: 3,
    maxArgs: -1,
  },

  SELECTCOLUMNS: {
    name: 'SELECTCOLUMNS',
    category: 'Tabela',
    syntax: 'SELECTCOLUMNS(table, name1, expression1, [name2, expression2, ...])',
    description: 'Retorna uma tabela com as colunas selecionadas da tabela e as novas colunas especificadas.',
    example: 'SELECTCOLUMNS(f_Vendas, "ID", f_Vendas[ID_Venda], "Cliente", RELATED(d_Cliente[Cliente]))',
    minArgs: 3,
    maxArgs: -1,
  },

  GENERATE: {
    name: 'GENERATE',
    category: 'Tabela',
    syntax: 'GENERATE(table1, table2)',
    description: 'Retorna uma tabela com o produto cartesiano entre table1 e a avaliação de table2 no contexto de cada linha de table1.',
    example: 'GENERATE(d_Cliente, TOPN(1, CALCULATETABLE(f_Vendas), f_Vendas[Valor], DESC))',
    minArgs: 2,
    maxArgs: 2,
  },

  GENERATEALL: {
    name: 'GENERATEALL',
    category: 'Tabela',
    syntax: 'GENERATEALL(table1, table2)',
    description: 'Similar ao GENERATE, mas preserva linhas de table1 mesmo quando table2 retorna vazio (left outer join).',
    example: 'GENERATEALL(d_Cliente, TOPN(1, CALCULATETABLE(f_Vendas), f_Vendas[Valor], DESC))',
    minArgs: 2,
    maxArgs: 2,
  },

  SUMMARIZE: {
    name: 'SUMMARIZE',
    category: 'Tabela',
    syntax: 'SUMMARIZE(table, groupBy_column1, [groupBy_column2, ...], [name1, expression1, ...])',
    description: 'Retorna uma tabela de resumo para os totais solicitados em um conjunto de grupos.',
    example: 'SUMMARIZE(f_Vendas, d_Produto[Categoria], "Total", [Total])',
    minArgs: 2,
    maxArgs: -1,
  },

  SUMMARIZECOLUMNS: {
    name: 'SUMMARIZECOLUMNS',
    category: 'Tabela',
    syntax: 'SUMMARIZECOLUMNS(groupBy_column1, ..., [filterTable1, ...], [name1, expression1, ...])',
    description: 'Retorna uma tabela de resumo em um conjunto de grupos aplicando tabelas de filtro e agregando expressões.',
    example: 'SUMMARIZECOLUMNS(d_Produto[Categoria], "Total", [Total])',
    minArgs: 1,
    maxArgs: -1,
  },

  GROUPBY: {
    name: 'GROUPBY',
    category: 'Tabela',
    syntax: 'GROUPBY(table, groupBy_column1, [groupBy_column2, ...], [name1, expression1, ...])',
    description: 'Agrupa linhas e avalia agregações usando CURRENTGROUP().',
    example: 'GROUPBY(f_Vendas, f_Vendas[ID_Cliente], "Qtd", SUMX(CURRENTGROUP(), f_Vendas[Qtd]))',
    minArgs: 2,
    maxArgs: -1,
  },
};
