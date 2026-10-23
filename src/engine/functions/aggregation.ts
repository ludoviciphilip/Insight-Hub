import { FunctionDefinition } from '../expr/registry';
import { DaxError } from '../shared/errors';
import { DAX_BLANK, isBlank, daxToNumber, daxToString, daxToBoolean } from '../expr/types';
import { FilterContext } from '../model/filterContext';
import { ModelAccess } from '../model/modelAccess';

/**
 * Extracts column values from model respecting active FilterContext
 */
export function getColumnValuesFromContext(
  arg: any,
  context: any
): { values: any[]; count: number } {
  // If argument is already evaluated array
  if (Array.isArray(arg)) {
    return { values: arg, count: arg.length };
  }

  const model: ModelAccess | undefined = context?.model;
  let tableName = '';
  let columnName = '';

  if (typeof arg === 'string') {
    const match = arg.match(/^(?:'?([^'\[]+)'?\[)?([^\]]+)\]?$/);
    if (match) {
      tableName = match[1] || '';
      columnName = match[2];
    } else {
      columnName = arg;
    }
  } else if (arg && typeof arg === 'object' && arg.column) {
    tableName = arg.table || '';
    columnName = arg.column;
  }

  if (!columnName) {
    return { values: [], count: 0 };
  }

  // Find table
  let table = tableName ? model?.getTable(tableName) : undefined;
  if (!table && model) {
    // If table not specified, search tables for this column
    for (const t of model.getTables()) {
      if (t.columns.some(c => c.name.toLowerCase() === columnName.toLowerCase())) {
        table = t;
        break;
      }
    }
  }

  if (!table) {
    return { values: [], count: 0 };
  }

  // Use FilterContext to get visible rows
  const filterContext: FilterContext | undefined = context?.filterContext;
  let rows: Record<string, any>[] = [];

  if (filterContext) {
    rows = filterContext.getFilteredRows(table.id, model!);
  } else if (typeof (model as any)?.getFilteredRows === 'function' && context?.activeFilters) {
    rows = (model as any).getFilteredRows(table.id, context.activeFilters);
  } else {
    rows = table.rows || [];
  }

  const values = rows.map(r => r[columnName]);
  return { values, count: rows.length };
}

export const AGGREGATION_FUNCTIONS: Record<string, FunctionDefinition> = {
  SUM: {
    name: 'SUM',
    category: 'Agregação',
    syntax: 'SUM(column)',
    description: 'Calcula a soma de todos os números em uma coluna no contexto de filtro ativo.',
    example: 'SUM(f_Vendas[ValorTotal])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      let sum = 0;
      let hasValid = false;

      for (const v of values) {
        if (!isBlank(v) && v !== null && v !== undefined && v !== '') {
          sum += daxToNumber(v);
          hasValid = true;
        }
      }

      return hasValid ? sum : DAX_BLANK;
    },
  },

  AVERAGE: {
    name: 'AVERAGE',
    aliases: ['AVG'],
    category: 'Agregação',
    syntax: 'AVERAGE(column)',
    description: 'Calcula a média aritmética de todos os números de uma coluna. Ignora BLANKs.',
    example: 'AVERAGE(f_Vendas[ValorTotal])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      let sum = 0;
      let nonBlankCount = 0;

      for (const v of values) {
        if (!isBlank(v) && v !== null && v !== undefined && v !== '') {
          sum += daxToNumber(v);
          nonBlankCount++;
        }
      }

      return nonBlankCount > 0 ? sum / nonBlankCount : DAX_BLANK;
    },
  },

  AVERAGEA: {
    name: 'AVERAGEA',
    category: 'Agregação',
    syntax: 'AVERAGEA(column)',
    description: 'Calcula a média tratando TRUE como 1, FALSE como 0 e texto não numérico como 0.',
    example: 'AVERAGEA(Tabela[Coluna])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      let sum = 0;
      let validCount = 0;

      for (const v of values) {
        if (!isBlank(v) && v !== null && v !== undefined && v !== '') {
          if (typeof v === 'boolean') {
            sum += v ? 1 : 0;
          } else {
            const num = Number(v);
            sum += isNaN(num) ? 0 : num;
          }
          validCount++;
        }
      }

      return validCount > 0 ? sum / validCount : DAX_BLANK;
    },
  },

  MIN: {
    name: 'MIN',
    category: 'Agregação',
    syntax: 'MIN(column)',
    description: 'Retorna o menor valor de uma coluna (numérica, data ou texto).',
    example: 'MIN(f_Vendas[Data])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      const nonBlanks = values.filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '');
      if (nonBlanks.length === 0) return DAX_BLANK;

      // Check if numbers
      const allNumbers = nonBlanks.every(v => typeof v === 'number' || (!isNaN(Number(v)) && typeof v !== 'boolean'));
      if (allNumbers) {
        return Math.min(...nonBlanks.map(v => Number(v)));
      }

      // Strings/Dates
      return nonBlanks.reduce((min, cur) => (cur < min ? cur : min));
    },
  },

  MAX: {
    name: 'MAX',
    category: 'Agregação',
    syntax: 'MAX(column)',
    description: 'Retorna o maior valor de uma coluna (numérica, data ou texto).',
    example: 'MAX(f_Vendas[ValorTotal])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      const nonBlanks = values.filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '');
      if (nonBlanks.length === 0) return DAX_BLANK;

      const allNumbers = nonBlanks.every(v => typeof v === 'number' || (!isNaN(Number(v)) && typeof v !== 'boolean'));
      if (allNumbers) {
        return Math.max(...nonBlanks.map(v => Number(v)));
      }

      return nonBlanks.reduce((max, cur) => (cur > max ? cur : max));
    },
  },

  MINA: {
    name: 'MINA',
    category: 'Agregação',
    syntax: 'MINA(column)',
    description: 'Retorna o menor valor tratando TRUE=1, FALSE=0 e texto=0.',
    example: 'MINA(Tabela[Coluna])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      const converted = values.map(v => {
        if (typeof v === 'boolean') return v ? 1 : 0;
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      });
      return Math.min(...converted);
    },
  },

  MAXA: {
    name: 'MAXA',
    category: 'Agregação',
    syntax: 'MAXA(column)',
    description: 'Retorna o maior valor tratando TRUE=1, FALSE=0 e texto=0.',
    example: 'MAXA(Tabela[Coluna])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      const converted = values.map(v => {
        if (typeof v === 'boolean') return v ? 1 : 0;
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      });
      return Math.max(...converted);
    },
  },

  COUNT: {
    name: 'COUNT',
    category: 'Agregação',
    syntax: 'COUNT(column)',
    description: 'Conta o número de valores que não são BLANK em uma coluna. Retorna BLANK se a tabela estiver vazia.',
    example: 'COUNT(f_Vendas[ID_Venda])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      let nonBlank = 0;
      for (const v of values) {
        if (!isBlank(v) && v !== null && v !== undefined && v !== '') {
          nonBlank++;
        }
      }
      return nonBlank;
    },
  },

  COUNTA: {
    name: 'COUNTA',
    category: 'Agregação',
    syntax: 'COUNTA(column)',
    description: 'Conta qualquer valor que não esteja em branco (números, texto, datas, booleanos).',
    example: 'COUNTA(f_Vendas[Canal])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      let nonBlank = 0;
      for (const v of values) {
        if (!isBlank(v) && v !== null && v !== undefined && v !== '') {
          nonBlank++;
        }
      }
      return nonBlank;
    },
  },

  COUNTBLANK: {
    name: 'COUNTBLANK',
    category: 'Agregação',
    syntax: 'COUNTBLANK(column)',
    description: 'Conta o número de valores em branco (BLANK/nulo) em uma coluna.',
    example: 'COUNTBLANK(d_Clientes[Telefone])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return 0;

      let blankCount = 0;
      for (const v of values) {
        if (isBlank(v) || v === null || v === undefined || v === '') {
          blankCount++;
        }
      }
      return blankCount;
    },
  },

  COUNTROWS: {
    name: 'COUNTROWS',
    category: 'Agregação',
    syntax: 'COUNTROWS([table])',
    description: 'Conta o número de linhas na tabela especificada no contexto de filtro atual.',
    example: 'COUNTROWS(f_Vendas)',
    minArgs: 0,
    maxArgs: 1,
    evaluate: (args, context) => {
      const model: ModelAccess | undefined = context?.model;
      const targetTableArg = args[0];

      let tableName = '';
      if (typeof targetTableArg === 'string') tableName = targetTableArg;
      else if (targetTableArg && typeof targetTableArg === 'object') {
        tableName = targetTableArg.table || targetTableArg.column || '';
      }

      const table = tableName
        ? model?.getTable(tableName)
        : (context?.tables?.[0] || model?.getTables()?.[0]);

      if (!table) return 0;

      const filterContext: FilterContext | undefined = context?.filterContext;
      if (filterContext && model) {
        return filterContext.getVisibleRowIndices(table.id, model).length;
      }

      if (typeof (model as any)?.getFilteredRows === 'function' && context?.activeFilters) {
        return (model as any).getFilteredRows(table.id, context.activeFilters).length;
      }

      return table.rows ? table.rows.length : 0;
    },
  },

  DISTINCTCOUNT: {
    name: 'DISTINCTCOUNT',
    category: 'Agregação',
    syntax: 'DISTINCTCOUNT(column)',
    description: 'Conta o número de valores distintos em uma coluna, incluindo BLANK se existir. Retorna BLANK se não houver linhas.',
    example: 'DISTINCTCOUNT(f_Vendas[ID_Cliente])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      const distinctSet = new Set<string>();
      let hasBlank = false;

      for (const v of values) {
        if (isBlank(v) || v === null || v === undefined || v === '') {
          hasBlank = true;
        } else {
          distinctSet.add(String(v));
        }
      }

      return distinctSet.size + (hasBlank ? 1 : 0);
    },
  },

  DISTINCTCOUNTNOBLANK: {
    name: 'DISTINCTCOUNTNOBLANK',
    category: 'Agregação',
    syntax: 'DISTINCTCOUNTNOBLANK(column)',
    description: 'Conta o número de valores distintos em uma coluna, excluindo BLANKs.',
    example: 'DISTINCTCOUNTNOBLANK(f_Vendas[ID_Cliente])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      const distinctSet = new Set<string>();
      for (const v of values) {
        if (!isBlank(v) && v !== null && v !== undefined && v !== '') {
          distinctSet.add(String(v));
        }
      }
      return distinctSet.size;
    },
  },

  APPROXIMATEDISTINCTCOUNT: {
    name: 'APPROXIMATEDISTINCTCOUNT',
    category: 'Agregação',
    syntax: 'APPROXIMATEDISTINCTCOUNT(column)',
    description: 'Retorna a contagem aproximada de valores distintos de uma coluna.',
    example: 'APPROXIMATEDISTINCTCOUNT(f_Vendas[ID_Cliente])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      return AGGREGATION_FUNCTIONS.DISTINCTCOUNT.evaluate!(args, context);
    },
  },

  PRODUCT: {
    name: 'PRODUCT',
    category: 'Agregação',
    syntax: 'PRODUCT(column)',
    description: 'Retorna o produto de todos os números em uma coluna.',
    example: 'PRODUCT(Tabela[Taxa])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      let prod = 1;
      let hasNum = false;

      for (const v of values) {
        if (!isBlank(v) && v !== null && v !== undefined && v !== '') {
          prod *= daxToNumber(v);
          hasNum = true;
        }
      }

      return hasNum ? prod : DAX_BLANK;
    },
  },

  MEDIAN: {
    name: 'MEDIAN',
    category: 'Agregação',
    syntax: 'MEDIAN(column)',
    description: 'Retorna a mediana dos valores em uma coluna.',
    example: 'MEDIAN(f_Vendas[ValorTotal])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const { values, count } = getColumnValuesFromContext(args[0], context);
      if (count === 0) return DAX_BLANK;

      const nums = values
        .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
        .map(v => Number(v))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);

      if (nums.length === 0) return DAX_BLANK;

      const mid = Math.floor(nums.length / 2);
      if (nums.length % 2 === 1) {
        return nums[mid];
      }
      return (nums[mid - 1] + nums[mid]) / 2;
    },
  },

  // ==========================================
  // DAX Iterators (X-Functions)
  // ==========================================
  SUMX: {
    name: 'SUMX',
    category: 'Agregação',
    syntax: 'SUMX(table, expression)',
    description: 'Itera linha a linha sobre uma tabela avaliando a expressão e somando os resultados no contexto de filtro ativo.',
    example: 'SUMX(f_Vendas, f_Vendas[Qtd] * RELATED(d_Produto[Preco]))',
    minArgs: 2,
    maxArgs: 2,
  },

  AVERAGEX: {
    name: 'AVERAGEX',
    category: 'Agregação',
    syntax: 'AVERAGEX(table, expression)',
    description: 'Calcula a média de uma expressão avaliada para cada linha de uma tabela.',
    example: 'AVERAGEX(f_Vendas, f_Vendas[Qtd] * f_Vendas[Preco])',
    minArgs: 2,
    maxArgs: 2,
  },

  COUNTX: {
    name: 'COUNTX',
    category: 'Agregação',
    syntax: 'COUNTX(table, expression)',
    description: 'Conta o número de linhas onde a expressão avaliada não resulta em BLANK.',
    example: 'COUNTX(f_Vendas, f_Vendas[ValorTotal])',
    minArgs: 2,
    maxArgs: 2,
  },

  COUNTAX: {
    name: 'COUNTAX',
    category: 'Agregação',
    syntax: 'COUNTAX(table, expression)',
    description: 'Conta os valores não em branco incluindo strings e booleanos ao avaliar a expressão para cada linha de uma tabela.',
    example: 'COUNTAX(d_Cliente, d_Cliente[Cidade])',
    minArgs: 2,
    maxArgs: 2,
  },

  MINX: {
    name: 'MINX',
    category: 'Agregação',
    syntax: 'MINX(table, expression)',
    description: 'Retorna o menor valor resultante da avaliação de uma expressão para cada linha de uma tabela.',
    example: 'MINX(f_Vendas, f_Vendas[ValorTotal])',
    minArgs: 2,
    maxArgs: 2,
  },

  MAXX: {
    name: 'MAXX',
    category: 'Agregação',
    syntax: 'MAXX(table, expression)',
    description: 'Retorna o maior valor resultante da avaliação de uma expressão para cada linha de uma tabela.',
    example: 'MAXX(f_Vendas, f_Vendas[ValorTotal])',
    minArgs: 2,
    maxArgs: 2,
  },

  PRODUCTX: {
    name: 'PRODUCTX',
    category: 'Agregação',
    syntax: 'PRODUCTX(table, expression)',
    description: 'Retorna o produto de uma expressão avaliada para cada linha de uma tabela.',
    example: 'PRODUCTX(Tabela, 1 + Tabela[Taxa])',
    minArgs: 2,
    maxArgs: 2,
  },

  MEDIANX: {
    name: 'MEDIANX',
    category: 'Agregação',
    syntax: 'MEDIANX(table, expression)',
    description: 'Calcula a mediana de uma expressão avaliada para cada linha de uma tabela.',
    example: 'MEDIANX(f_Vendas, f_Vendas[Qtd] * f_Vendas[Preco])',
    minArgs: 2,
    maxArgs: 2,
  },

  GEOMEANX: {
    name: 'GEOMEANX',
    category: 'Agregação',
    syntax: 'GEOMEANX(table, expression)',
    description: 'Calcula a média geométrica de uma expressão avaliada para cada linha de uma tabela.',
    example: 'GEOMEANX(Investimentos, 1 + Investimentos[Retorno])',
    minArgs: 2,
    maxArgs: 2,
  },

  CONCATENATEX: {
    name: 'CONCATENATEX',
    category: 'Agregação',
    syntax: 'CONCATENATEX(table, expression, [delimiter], [orderBy_expression], [order])',
    description: 'Concatena o resultado de uma expressão avaliada para cada linha em uma tabela com delimitador e ordenação opcionais.',
    example: 'CONCATENATEX(d_Cliente, d_Cliente[Cliente], ", ", d_Cliente[Cliente], ASC)',
    minArgs: 2,
    maxArgs: 5,
  },

  RANKX: {
    name: 'RANKX',
    category: 'Agregação',
    syntax: 'RANKX(table, expression, [value], [order], [ties])',
    description: 'Retorna o ranking de uma expressão avaliada no contexto atual para cada linha da tabela especificada.',
    example: 'RANKX(ALL(d_Produto[Nome]), [Total Vendas])',
    minArgs: 2,
    maxArgs: 5,
  },
};
