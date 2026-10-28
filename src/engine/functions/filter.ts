import { FunctionDefinition } from '../expr/registry';
import { DaxError } from '../shared/errors';
import { DAX_BLANK, isBlank, daxEqual, isDaxTable } from '../expr/types';
import { ModelAccess } from '../model/modelAccess';
import { FilterContext } from '../model/filterContext';

export interface FilterModifier {
  __isModifier: true;
  type: 'ALL' | 'ALLEXCEPT' | 'REMOVEFILTERS' | 'KEEPFILTERS' | 'USERELATIONSHIP' | 'CROSSFILTER' | 'FILTER_EXPR';
  tableId?: string;
  tableName?: string;
  columns?: string[];
  filterContext?: FilterContext;
  expression?: any;
}

export const FILTER_FUNCTIONS: Record<string, FunctionDefinition> = {
  ALL: {
    name: 'ALL',
    category: 'Filtro',
    syntax: 'ALL([table_or_column], [column2], ...)',
    description: 'Remove os filtros do contexto para a tabela ou colunas especificadas. Retorna todas as linhas ou valores distintos sem filtro.',
    example: 'CALCULATE([Total], ALL(f_Vendas))',
    minArgs: 0,
    maxArgs: -1,
    evaluate: (args, context) => {
      // When used inside CALCULATE or as modifier
      if (args.length === 0) {
        return {
          __isModifier: true,
          type: 'ALL',
        };
      }

      const model: ModelAccess | undefined = context?.model;
      const first = args[0];
      let tableName = '';
      let colName = '';

      if (typeof first === 'string') {
        const m = first.match(/^(?:'?([^'\[]+)'?\[)?([^\]]+)\]?$/);
        if (m && m[1]) {
          tableName = m[1];
          colName = m[2];
        } else if (m) {
          tableName = m[2];
        } else {
          tableName = first;
        }
      } else if (first && typeof first === 'object') {
        tableName = first.table || first.column || '';
        colName = first.table ? first.column : '';
      }

      const table = model?.getTable(tableName);

      if (args.length === 1 && !colName && table) {
        // ALL(Table): modifier to clear table filters, or returns entire table.rows
        const cols = table.columns.map(c => c.name);
        const lineage: Record<string, { tableId: string; tableName: string; column: string }> = {};
        for (const c of cols) {
          lineage[c] = { tableId: table.id, tableName: table.name, column: c };
        }
        return {
          __isDaxTable: true,
          __isModifier: true,
          type: 'ALL',
          tableId: table.id,
          tableName: table.name,
          columns: cols,
          rows: table.rows || [],
          lineage,
        };
      }

      // Column-specific ALL
      const cols: string[] = [];
      if (colName) cols.push(colName);
      for (let i = 1; i < args.length; i++) {
        const c = args[i];
        if (typeof c === 'string') cols.push(c.replace(/^[\[]|\]$/g, ''));
        else if (c?.column) cols.push(c.column);
      }

      return {
        __isModifier: true,
        type: 'ALL',
        tableId: table ? table.id : tableName,
        tableName: table ? table.name : tableName,
        columns: cols,
      };
    },
  },

  ALLEXCEPT: {
    name: 'ALLEXCEPT',
    category: 'Filtro',
    syntax: 'ALLEXCEPT(table, [column1], [column2], ...)',
    description: 'Remove todos os filtros de contexto da tabela, exceto os filtros que foram aplicados às colunas especificadas.',
    example: 'CALCULATE([Total], ALLEXCEPT(f_Vendas, f_Vendas[Segmento]))',
    minArgs: 1,
    maxArgs: -1,
    evaluate: (args, context) => {
      const model: ModelAccess | undefined = context?.model;
      const targetTableArg = args[0];
      const tableName = typeof targetTableArg === 'string' ? targetTableArg : targetTableArg?.table || targetTableArg?.column;
      const table = model?.getTable(tableName);

      const keepCols: string[] = [];
      for (let i = 1; i < args.length; i++) {
        const c = args[i];
        if (typeof c === 'string') {
          const m = c.match(/\[([^\]]+)\]/);
          keepCols.push(m ? m[1] : c);
        } else if (c?.column) {
          keepCols.push(c.column);
        }
      }

      return {
        __isModifier: true,
        type: 'ALLEXCEPT',
        tableId: table ? table.id : tableName,
        tableName: table ? table.name : tableName,
        columns: keepCols,
      };
    },
  },

  ALLNOBLANKROW: {
    name: 'ALLNOBLANKROW',
    category: 'Filtro',
    syntax: 'ALLNOBLANKROW(table_or_column)',
    description: 'Semelhante a ALL, mas exclui a linha em branco adicionada pelo DAX para relacionamentos órfãos.',
    example: 'ALLNOBLANKROW(d_Clientes[Segmento])',
    minArgs: 1,
    maxArgs: -1,
    evaluate: (args, context) => {
      const res = FILTER_FUNCTIONS.ALL.evaluate!(args, context);
      return res;
    },
  },

  ALLSELECTED: {
    name: 'ALLSELECTED',
    category: 'Filtro',
    syntax: 'ALLSELECTED([table_or_column])',
    description: 'Retorna todas as linhas em uma tabela ou todos os valores em uma coluna, ignorando filtros do visual atual mas mantendo filtros externos.',
    example: 'CALCULATE([Total], ALLSELECTED(f_Vendas))',
    minArgs: 0,
    maxArgs: 1,
    evaluate: (args, _context) => {
      return {
        __isModifier: true,
        type: 'ALL',
        tableId: args[0]?.table || args[0],
      };
    },
  },

  ALLCROSSFILTERED: {
    name: 'ALLCROSSFILTERED',
    category: 'Filtro',
    syntax: 'ALLCROSSFILTERED(table)',
    description: 'Limpa todos os filtros aplicados à tabela e a todas as outras tabelas relacionadas a ela.',
    example: 'CALCULATE([Total], ALLCROSSFILTERED(f_Vendas))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (_args, _context) => {
      return {
        __isModifier: true,
        type: 'ALL',
      };
    },
  },

  REMOVEFILTERS: {
    name: 'REMOVEFILTERS',
    category: 'Filtro',
    syntax: 'REMOVEFILTERS([table_or_column], ...)',
    description: 'Remove filtros das tabelas ou colunas especificadas. É sinônimo de ALL quando usado como modificador de filtro.',
    example: 'CALCULATE([Total], REMOVEFILTERS(d_Calendario[Ano]))',
    minArgs: 0,
    maxArgs: -1,
    evaluate: (args, context) => {
      return FILTER_FUNCTIONS.ALL.evaluate!(args, context);
    },
  },

  KEEPFILTERS: {
    name: 'KEEPFILTERS',
    category: 'Filtro',
    syntax: 'KEEPFILTERS(expression)',
    description: 'Modifica como os filtros são aplicados durante a avaliação de uma função CALCULATE, fazendo interseção em vez de sobrescrever.',
    example: 'CALCULATE([Total], KEEPFILTERS(f_Vendas[Regiao] = "Sul"))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([expr]) => {
      return {
        __isModifier: true,
        type: 'KEEPFILTERS',
        expression: expr,
      };
    },
  },

  VALUES: {
    name: 'VALUES',
    category: 'Filtro',
    syntax: 'VALUES(table_or_column)',
    description: 'Retorna uma tabela de uma coluna que contém os valores distintos da coluna ou tabela no contexto atual.',
    example: 'VALUES(d_Clientes[Segmento])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const model: ModelAccess | undefined = context?.model;
      const target = args[0];
      let tableName = '';
      let colName = '';

      if (typeof target === 'string') {
        const m = target.match(/^(?:'?([^'\[]+)'?\[)?([^\]]+)\]?$/);
        if (m && m[1]) {
          tableName = m[1];
          colName = m[2];
        } else {
          colName = target;
        }
      } else if (target && typeof target === 'object') {
        tableName = target.table || '';
        colName = target.column || '';
      }

      let table = tableName ? model?.getTable(tableName) : undefined;
      if (!table && model) {
        for (const t of model.getTables()) {
          if (t.columns.some(c => c.name.toLowerCase() === colName.toLowerCase())) {
            table = t;
            break;
          }
        }
      }

      if (!table) {
        return {
          __isDaxTable: true,
          columns: colName ? [colName] : [],
          rows: [],
        };
      }

      const filterContext: FilterContext | undefined = context?.filterContext;
      const rows = filterContext ? filterContext.getFilteredRows(table.id, model!) : table.rows;

      if (!colName) {
        return {
          __isDaxTable: true,
          columns: table.columns.map(c => c.name),
          rows: rows || [],
          tableId: table.id,
          tableName: table.name,
          lineage: Object.fromEntries(
            table.columns.map(c => [c.name, { tableId: table!.id, tableName: table!.name, column: c.name }])
          ),
        };
      }

      const distinctSet = new Set<any>();
      (rows || []).forEach(r => {
        if (r[colName] !== undefined) {
          distinctSet.add(r[colName]);
        }
      });
      const distinctArray = Array.from(distinctSet);
      const resRows = distinctArray.map(v => ({ [colName]: v }));

      return {
        __isDaxTable: true,
        columns: [colName],
        rows: resRows,
        tableId: table.id,
        tableName: table.name,
        lineage: {
          [colName]: { tableId: table.id, tableName: table.name, column: colName },
        },
      };
    },
  },

  DISTINCT: {
    name: 'DISTINCT',
    category: 'Filtro',
    syntax: 'DISTINCT(table_or_column)',
    description: 'Retorna uma tabela de uma coluna contendo valores distintos no contexto de filtro atual.',
    example: 'DISTINCT(f_Vendas[Canal])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      return FILTER_FUNCTIONS.VALUES.evaluate!(args, context);
    },
  },

  SELECTEDVALUE: {
    name: 'SELECTEDVALUE',
    category: 'Filtro',
    syntax: 'SELECTEDVALUE(column, [alternateResult])',
    description: 'Retorna o valor quando o contexto para a coluna foi filtrado para apenas um valor distinto. Caso contrário, retorna o resultado alternativo (ou BLANK).',
    example: 'SELECTEDVALUE(d_Calendario[Ano], "Vários Anos")',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([colArg, altResult], context) => {
      const distinctValsRaw: any = FILTER_FUNCTIONS.VALUES.evaluate!([colArg], context);
      let distinctVals: any[] = [];
      if (isDaxTable(distinctValsRaw)) {
        const col = distinctValsRaw.columns[0];
        distinctVals = distinctValsRaw.rows.map(r => r[col]);
      } else if (Array.isArray(distinctValsRaw)) {
        if (distinctValsRaw.length > 0 && typeof distinctValsRaw[0] === 'object' && distinctValsRaw[0] !== null) {
          const firstKey = Object.keys(distinctValsRaw[0])[0];
          distinctVals = distinctValsRaw.map(r => r[firstKey]);
        } else {
          distinctVals = distinctValsRaw;
        }
      }

      const filtered = distinctVals.filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '');

      if (filtered.length === 1) {
        return filtered[0];
      }
      return altResult !== undefined ? altResult : DAX_BLANK;
    },
  },

  HASONEVALUE: {
    name: 'HASONEVALUE',
    category: 'Filtro',
    syntax: 'HASONEVALUE(column)',
    description: 'Retorna TRUE quando o contexto de coluna tem exatamente um valor distinto visível.',
    example: 'HASONEVALUE(d_Clientes[Segmento])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([colArg], context) => {
      const distinctValsRaw: any = FILTER_FUNCTIONS.VALUES.evaluate!([colArg], context);
      let distinctVals: any[] = [];
      if (isDaxTable(distinctValsRaw)) {
        const col = distinctValsRaw.columns[0];
        distinctVals = distinctValsRaw.rows.map(r => r[col]);
      } else if (Array.isArray(distinctValsRaw)) {
        if (distinctValsRaw.length > 0 && typeof distinctValsRaw[0] === 'object' && distinctValsRaw[0] !== null) {
          const firstKey = Object.keys(distinctValsRaw[0])[0];
          distinctVals = distinctValsRaw.map(r => r[firstKey]);
        } else {
          distinctVals = distinctValsRaw;
        }
      }
      const filtered = distinctVals.filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '');
      return filtered.length === 1;
    },
  },

  HASONEFILTER: {
    name: 'HASONEFILTER',
    category: 'Filtro',
    syntax: 'HASONEFILTER(column)',
    description: 'Retorna TRUE quando o número de valores diretamente filtrados na coluna for exatamente um.',
    example: 'HASONEFILTER(d_Calendario[Ano])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([colArg], context) => {
      const filterContext: FilterContext | undefined = context?.filterContext;
      if (!filterContext) return false;

      let colName = typeof colArg === 'string' ? colArg.replace(/^[\[]|\]$/g, '') : colArg?.column;
      let tableName = colArg?.table || '';

      const filter = filterContext.getAllColumnFilters().find(
        f => f.column.toLowerCase() === colName.toLowerCase() &&
             (!tableName || f.tableId.toLowerCase() === tableName.toLowerCase())
      );

      if (!filter) return false;
      if (filter.allowedValues) {
        return filter.allowedValues.size === 1;
      }
      return false;
    },
  },

  ISFILTERED: {
    name: 'ISFILTERED',
    category: 'Filtro',
    syntax: 'ISFILTERED(table_or_column)',
    description: 'Retorna TRUE quando há filtros diretos aplicados à coluna ou tabela.',
    example: 'ISFILTERED(d_Clientes[Cidade])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([target], context) => {
      const filterContext: FilterContext | undefined = context?.filterContext;
      if (!filterContext) return false;

      let colName = typeof target === 'string' ? target.replace(/^[\[]|\]$/g, '') : target?.column;
      let tableName = target?.table || '';

      return filterContext.getAllColumnFilters().some(
        f => (!colName || f.column.toLowerCase() === colName.toLowerCase()) &&
             (!tableName || f.tableId.toLowerCase() === tableName.toLowerCase())
      );
    },
  },

  ISCROSSFILTERED: {
    name: 'ISCROSSFILTERED',
    category: 'Filtro',
    syntax: 'ISCROSSFILTERED(table_or_column)',
    description: 'Retorna TRUE quando a coluna ou tabela está sendo filtrada direta ou indiretamente por outra tabela relacionada.',
    example: 'ISCROSSFILTERED(f_Vendas)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([target], context) => {
      const filterContext: FilterContext | undefined = context?.filterContext;
      if (!filterContext) return false;

      // In DAX, ISCROSSFILTERED is TRUE if direct filter exists OR any related table has filters
      const direct = FILTER_FUNCTIONS.ISFILTERED.evaluate!([target], context);
      if (direct) return true;

      return filterContext.getAllColumnFilters().length > 0;
    },
  },

  ISEMPTY: {
    name: 'ISEMPTY',
    category: 'Filtro',
    syntax: 'ISEMPTY(table)',
    description: 'Retorna TRUE se a tabela ou expressão de tabela não contiver nenhuma linha no contexto de filtro atual.',
    example: 'ISEMPTY(f_Vendas)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([target], context) => {
      const model: ModelAccess | undefined = context?.model;
      const tableName = typeof target === 'string' ? target : target?.table || target?.column;
      const table = model?.getTable(tableName);
      if (!table) return true;

      const filterContext: FilterContext | undefined = context?.filterContext;
      if (filterContext && model) {
        return filterContext.getVisibleRowIndices(table.id, model).length === 0;
      }
      return (table.rows?.length || 0) === 0;
    },
  },

  FILTERS: {
    name: 'FILTERS',
    category: 'Filtro',
    syntax: 'FILTERS(columnName)',
    description: 'Retorna os valores que estão sendo aplicados diretamente como filtros à coluna especificada.',
    example: 'FILTERS(d_Clientes[Segmento])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([colArg], context) => {
      return FILTER_FUNCTIONS.VALUES.evaluate!([colArg], context);
    },
  },

  LOOKUPVALUE: {
    name: 'LOOKUPVALUE',
    category: 'Filtro',
    syntax: 'LOOKUPVALUE(result_column, search_column1, search_value1, [search_column2, search_value2, ...], [alternateResult])',
    description: 'Retorna o valor de result_column para a linha que atende a todos os critérios especificados por search_column e search_value.',
    example: 'LOOKUPVALUE(d_Produtos[Preco], d_Produtos[ID_Produto], f_Vendas[ID_Produto])',
    minArgs: 3,
    maxArgs: -1,
    evaluate: (args, context) => {
      const model: ModelAccess | undefined = context?.model;
      if (!model) return DAX_BLANK;

      const parseCol = (c: any) => {
        if (typeof c === 'string') {
          const m = c.match(/^(?:'?([^'\[]+)'?\[)?([^\]]+)\]?$/);
          return { table: m ? m[1] : '', column: m ? m[2] : c };
        }
        return { table: c?.table || '', column: c?.column || '' };
      };

      const resultRef = parseCol(args[0]);
      const table = model.getTable(resultRef.table);
      if (!table) return DAX_BLANK;

      // Extract search criteria pairs
      const pairs: { column: string; value: any }[] = [];
      let i = 1;
      let alternateResult = DAX_BLANK;

      while (i < args.length) {
        if (i === args.length - 1 && (args.length % 2 === 0)) {
          // Odd trailing argument is alternateResult
          alternateResult = args[i];
          break;
        }
        const col = parseCol(args[i]);
        const val = args[i + 1];
        pairs.push({ column: col.column, value: val });
        i += 2;
      }

      const matchedRows = table.rows.filter(row => {
        return pairs.every(p => {
          const cellVal = row[p.column];
          return daxEqual(cellVal, p.value);
        });
      });

      if (matchedRows.length === 1) {
        return matchedRows[0][resultRef.column] ?? DAX_BLANK;
      }
      if (matchedRows.length > 1) {
        throw new DaxError('Execution', `LOOKUPVALUE encontrou mais de uma linha correspondente na tabela "${table.name}"`);
      }
      return alternateResult;
    },
  },

  EARLIER: {
    name: 'EARLIER',
    category: 'Filtro',
    syntax: 'EARLIER(column, [number])',
    description: 'Retorna o valor atual da coluna especificada em um passo de avaliação externa da tabela atual.',
    example: 'EARLIER(f_Vendas[ValorTotal], 1)',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([colArg, numArg], context) => {
      const stack = context?.rowContextStack;
      if (!stack) {
        throw new DaxError('Semantic', 'EARLIER requer uma pilha de contexto de linha ativa');
      }
      const levels = numArg !== undefined ? Math.max(1, Math.trunc(Number(numArg))) : 1;
      const earlierCtx = stack.getEarlier(levels);
      const colName = typeof colArg === 'string' ? colArg.replace(/^[\[]|\]$/g, '') : colArg?.column;
      return earlierCtx.row[colName] ?? DAX_BLANK;
    },
  },

  EARLIEST: {
    name: 'EARLIEST',
    category: 'Filtro',
    syntax: 'EARLIEST(column)',
    description: 'Retorna o valor atual da coluna especificada na etapa de avaliação mais externa da tabela.',
    example: 'EARLIEST(f_Vendas[ValorTotal])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([colArg], context) => {
      const stack = context?.rowContextStack;
      if (!stack) {
        throw new DaxError('Semantic', 'EARLIEST requer uma pilha de contexto de linha ativa');
      }
      const earliestCtx = stack.getEarliest();
      const colName = typeof colArg === 'string' ? colArg.replace(/^[\[]|\]$/g, '') : colArg?.column;
      return earliestCtx.row[colName] ?? DAX_BLANK;
    },
  },

  // ==========================================
  // CALCULATE & Context Modifiers
  // ==========================================
  CALCULATE: {
    name: 'CALCULATE',
    category: 'Filtro',
    syntax: 'CALCULATE(expression, [filter1], [filter2], ...)',
    description: 'Avalia uma expressão sob um contexto modificado pelos filtros informados (transição de contexto e sobreposição de filtros).',
    example: 'CALCULATE([Total Vendas], d_Produto[Categoria] = "Eletrônicos")',
    minArgs: 1,
    maxArgs: -1,
  },

  CALCULATETABLE: {
    name: 'CALCULATETABLE',
    category: 'Filtro',
    syntax: 'CALCULATETABLE(table, [filter1], [filter2], ...)',
    description: 'Avalia uma expressão de tabela em um contexto modificado pelos filtros informados.',
    example: 'CALCULATETABLE(f_Vendas, d_Produto[Preco] > 1000)',
    minArgs: 1,
    maxArgs: -1,
  },

  FILTER: {
    name: 'FILTER',
    category: 'Filtro',
    syntax: 'FILTER(table, filter_expression)',
    description: 'Retorna uma tabela contendo apenas as linhas que satisfazem a condição de filtro avaliada linha a linha.',
    example: 'FILTER(f_Vendas, f_Vendas[Qtd] > 1)',
    minArgs: 2,
    maxArgs: 2,
  },
};
