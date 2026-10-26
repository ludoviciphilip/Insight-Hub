import { FunctionDefinition } from '../expr/registry';
import { DaxError } from '../shared/errors';
import { DAX_BLANK, isBlank, isDaxTable, DaxTableValue } from '../expr/types';
import { toDaxTable } from './table';

/**
 * Deterministic hash function for HASH()
 */
export function computeDaxHash(...args: any[]): string {
  const combined = args
    .map(a => (a === null || a === undefined || a === DAX_BLANK ? 'BLANK' : String(a)))
    .join('§');

  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hash32_1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hash32_2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hash32_1}${hash32_2}`;
}

export const UTILITY_FUNCTIONS: Record<string, FunctionDefinition> = {
  NAMEOF: {
    name: 'NAMEOF',
    category: 'Texto',
    syntax: 'NAMEOF(<ColumnOrMeasure>)',
    description: 'Retorna o nome da coluna ou medida fornecida como referência de texto.',
    example: 'NAMEOF(d_Produtos[PrecoUnitario])',
    minArgs: 1,
    maxArgs: 1,
    isLazy: true,
    evaluate: (args) => {
      const ref = args[0];
      return String(ref || '');
    },
  },

  TABLEOF: {
    name: 'TABLEOF',
    category: 'Tabela',
    syntax: 'TABLEOF(<Table>)',
    description: 'Retorna a tabela especificada mantendo sua estrutura e contexto.',
    example: 'TABLEOF(f_Vendas)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const arg = args[0];
      if (isDaxTable(arg)) return arg;
      if (typeof arg === 'string' && context?.model) {
        const tbl = context.model.getTable(arg);
        if (tbl) return toDaxTable(tbl.rows);
      }
      return toDaxTable([]);
    },
  },

  EVALUATEANDLOG: {
    name: 'EVALUATEANDLOG',
    category: 'Informação',
    syntax: 'EVALUATEANDLOG(<ValueOrTable> [, <Message>] [, <MaxRows>])',
    description: 'Avalia uma expressão DAX, registra seu resultado no console/log de depuração e retorna o resultado inalterado.',
    example: 'EVALUATEANDLOG([Faturamento Total], "Depurando faturamento")',
    minArgs: 1,
    maxArgs: 3,
    evaluate: (args) => {
      const val = args[0];
      const msg = args[1] ? String(args[1]) : 'DAX EVALUATEANDLOG';
      // In dev/test environment, emit log safely
      if (typeof console !== 'undefined' && console.log) {
        console.log(`[${msg}]`, val);
      }
      return val;
    },
  },

  TOJSON: {
    name: 'TOJSON',
    category: 'Texto',
    syntax: 'TOJSON(<ValueOrTable>)',
    description: 'Serializa uma tabela DAX ou valor escalar em uma cadeia de caracteres no formato JSON.',
    example: 'TOJSON(TOPN(3, f_Vendas))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args) => {
      const val = args[0];
      if (isBlank(val)) return DAX_BLANK;
      if (isDaxTable(val)) {
        return JSON.stringify(val.rows);
      }
      return JSON.stringify(val);
    },
  },

  TOCSV: {
    name: 'TOCSV',
    category: 'Texto',
    syntax: 'TOCSV(<Table> [, <Delimiter>] [, <IncludeHeaders>])',
    description: 'Converte uma tabela DAX em uma cadeia de caracteres formatada como CSV.',
    example: 'TOCSV(d_Produtos, ";", TRUE())',
    minArgs: 1,
    maxArgs: 3,
    evaluate: (args) => {
      const val = args[0];
      const delimiter = args[1] !== undefined ? String(args[1]) : ';';
      const includeHeaders = args[2] !== undefined ? Boolean(args[2]) : true;

      if (isBlank(val)) return DAX_BLANK;

      const rows: Record<string, any>[] = isDaxTable(val)
        ? val.rows
        : Array.isArray(val)
        ? val
        : [];

      if (rows.length === 0) return '';

      const headers = Object.keys(rows[0]);
      const lines: string[] = [];

      if (includeHeaders) {
        lines.push(headers.join(delimiter));
      }

      for (const row of rows) {
        const line = headers.map(h => {
          const cell = row[h];
          if (cell === null || cell === undefined || cell === DAX_BLANK) return '';
          const str = String(cell);
          if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(delimiter);
        lines.push(line);
      }

      return lines.join('\n');
    },
  },

  HASH: {
    name: 'HASH',
    category: 'Texto',
    syntax: 'HASH(<Value1> [, <Value2> ...])',
    description: 'Calcula um código hash criptográfico/determinístico em hexadecimal a partir dos argumentos.',
    example: 'HASH(d_Clientes[ID_Cliente], d_Clientes[Regiao])',
    minArgs: 1,
    maxArgs: -1,
    evaluate: (args) => {
      if (args.length === 0) return DAX_BLANK;
      return computeDaxHash(...args);
    },
  },

  KEYWORDMATCH: {
    name: 'KEYWORDMATCH',
    category: 'Lógica / Condicional',
    syntax: 'KEYWORDMATCH(<Text>, <Keywords> [, <Delimiter>])',
    description: 'Verifica se o texto contém palavras-chave especificadas.',
    example: 'KEYWORDMATCH(d_Produtos[NomeProduto], "Pro, Ultrawide", ", ")',
    minArgs: 2,
    maxArgs: 3,
    evaluate: (args) => {
      const textVal = args[0];
      const kwVal = args[1];
      const delim = args[2] !== undefined ? String(args[2]) : ' ';

      if (isBlank(textVal) || isBlank(kwVal)) return false;
      const text = String(textVal).toLowerCase();
      const keywords = String(kwVal)
        .split(delim)
        .map(k => k.trim().toLowerCase())
        .filter(Boolean);

      if (keywords.length === 0) return false;
      return keywords.some(k => text.includes(k));
    },
  },

  COLUMNSTATISTICS: {
    name: 'COLUMNSTATISTICS',
    category: 'Tabela',
    syntax: 'COLUMNSTATISTICS([<Table>])',
    description: 'Retorna estatísticas detalhadas de todas as colunas do modelo ou da tabela especificada.',
    example: 'COLUMNSTATISTICS(d_Produtos)',
    minArgs: 0,
    maxArgs: 1,
    evaluate: (args, context) => {
      const targetTableArg = args[0];
      let tables: any[] = [];

      if (targetTableArg) {
        if (isDaxTable(targetTableArg)) {
          const tName = targetTableArg.tableName || 'ExpressionTable';
          const rows = targetTableArg.rows || [];
          const cols = targetTableArg.columns || (rows[0] ? Object.keys(rows[0]) : []);
          const res: Record<string, any>[] = [];

          for (const c of cols) {
            const vals = rows.map(r => r[c]).filter(v => v !== null && v !== undefined && v !== DAX_BLANK);
            const dist = new Set(vals);
            const sorted = [...vals].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
            res.push({
              TableName: tName,
              ColumnName: c,
              DataType: 'text',
              Min: sorted.length > 0 ? sorted[0] : DAX_BLANK,
              Max: sorted.length > 0 ? sorted[sorted.length - 1] : DAX_BLANK,
              Cardinality: dist.size,
              MaxLength: Math.max(0, ...vals.map(v => String(v).length)),
              NullCount: rows.length - vals.length,
            });
          }
          return toDaxTable(res);
        }
        const nameOrId = String(targetTableArg).replace(/^'|'$/g, '');
        const found = context?.model?.getTable?.(nameOrId);
        if (found) tables = [found];
      } else if (context?.model?.getTables) {
        tables = context.model.getTables();
      } else if (context?.tables) {
        tables = context.tables;
      }

      const statsRows: Record<string, any>[] = [];

      for (const t of tables) {
        for (const col of t.columns || []) {
          const colName = col.name;
          const vals: any[] = [];
          let maxLen = 0;
          let nullCount = 0;

          for (const row of t.rows || []) {
            const v = row[colName];
            if (v === null || v === undefined || v === DAX_BLANK) {
              nullCount++;
            } else {
              vals.push(v);
              const s = String(v);
              if (s.length > maxLen) maxLen = s.length;
            }
          }

          const distinctSet = new Set(vals);
          let minVal: any = DAX_BLANK;
          let maxVal: any = DAX_BLANK;
          if (vals.length > 0) {
            const sorted = [...vals].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
            minVal = sorted[0];
            maxVal = sorted[sorted.length - 1];
          }

          statsRows.push({
            TableName: t.name,
            ColumnName: colName,
            DataType: col.dataType || 'text',
            Min: minVal,
            Max: maxVal,
            Cardinality: distinctSet.size,
            MaxLength: maxLen,
            NullCount: nullCount,
          });
        }
      }

      return toDaxTable(statsRows);
    },
  },

  DEPENDON: {
    name: 'DEPENDON',
    category: 'Informação',
    syntax: 'DEPENDON(<ResultExpression>, <Dependency1> [, <Dependency2> ...])',
    description: 'Força a avaliação das dependências antes de avaliar e retornar a expressão de resultado (dax.guide/dependon/).',
    example: 'DEPENDON([Faturamento Total], [Margem Bruta], [Meta])',
    minArgs: 2,
    maxArgs: -1,
    isLazy: true,
    evaluate: (args) => {
      // Handled directly in Evaluator; returns the evaluated ResultExpression
      return args[0];
    },
  },

  // ==========================================
  // Explicit Stubs (throw clear DaxError)
  // ==========================================
  EXTERNALMEASURE: {
    name: 'EXTERNALMEASURE',
    category: 'Informação',
    syntax: 'EXTERNALMEASURE(<MeasureName> [, <Source>])',
    description: 'Não suportada no navegador: requer instância externa do Analysis Services / DirectQuery remoto.',
    example: 'EXTERNALMEASURE("RemoteSales")',
    minArgs: 0,
    maxArgs: 2,
    evaluate: () => {
      throw new DaxError(
        'Execution',
        'A função DAX "EXTERNALMEASURE" não é suportada no navegador: requer instância corporativa externa do SSAS / Azure Analysis Services.'
      );
    },
  },

  SHADOWCLUSTER: {
    name: 'SHADOWCLUSTER',
    category: 'Informação',
    syntax: 'SHADOWCLUSTER(...)',
    description: 'Não suportada no navegador: clusterização de infraestrutura interna do Analysis Services.',
    example: 'SHADOWCLUSTER(...)',
    minArgs: 0,
    maxArgs: -1,
    evaluate: () => {
      throw new DaxError(
        'Execution',
        'A função DAX "SHADOWCLUSTER" não é suportada no navegador: recurso de clusterização interno do servidor corporativo.'
      );
    },
  },

  FILTERCLUSTER: {
    name: 'FILTERCLUSTER',
    category: 'Informação',
    syntax: 'FILTERCLUSTER(...)',
    description: 'Não suportada no navegador: clusterização de infraestrutura interna do Analysis Services.',
    example: 'FILTERCLUSTER(...)',
    minArgs: 0,
    maxArgs: -1,
    evaluate: () => {
      throw new DaxError(
        'Execution',
        'A função DAX "FILTERCLUSTER" não é suportada no navegador: recurso interno do servidor corporativo.'
      );
    },
  },

  GROUPCROSSAPPLY: {
    name: 'GROUPCROSSAPPLY',
    category: 'Informação',
    syntax: 'GROUPCROSSAPPLY(...)',
    description: 'Não suportada no navegador: operação interna de motor distribuído.',
    example: 'GROUPCROSSAPPLY(...)',
    minArgs: 0,
    maxArgs: -1,
    evaluate: () => {
      throw new DaxError(
        'Execution',
        'A função DAX "GROUPCROSSAPPLY" não é suportada no navegador: operação interna de motor corporativo.'
      );
    },
  },

  GROUPCROSSAPPLYTABLE: {
    name: 'GROUPCROSSAPPLYTABLE',
    category: 'Informação',
    syntax: 'GROUPCROSSAPPLYTABLE(...)',
    description: 'Não suportada no navegador: operação interna de motor distribuído.',
    example: 'GROUPCROSSAPPLYTABLE(...)',
    minArgs: 0,
    maxArgs: -1,
    evaluate: () => {
      throw new DaxError(
        'Execution',
        'A função DAX "GROUPCROSSAPPLYTABLE" não é suportada no navegador: operação interna de motor corporativo.'
      );
    },
  },

  SAMPLEAXISWITHLOCALMINMAX: {
    name: 'SAMPLEAXISWITHLOCALMINMAX',
    category: 'Informação',
    syntax: 'SAMPLEAXISWITHLOCALMINMAX(...)',
    description: 'Não suportada no navegador: algoritmo interno de amostragem de eixos de alta densidade do Power BI.',
    example: 'SAMPLEAXISWITHLOCALMINMAX(...)',
    minArgs: 0,
    maxArgs: -1,
    evaluate: () => {
      throw new DaxError(
        'Execution',
        'A função DAX "SAMPLEAXISWITHLOCALMINMAX" não é suportada no navegador: algoritmo de alta densidade exclusivo do motor Power BI Desktop.'
      );
    },
  },

  SAMPLECARTESIANPOINTSBYCOVER: {
    name: 'SAMPLECARTESIANPOINTSBYCOVER',
    category: 'Informação',
    syntax: 'SAMPLECARTESIANPOINTSBYCOVER(...)',
    description: 'Não suportada no navegador: algoritmo interno de amostragem espacial do Power BI.',
    example: 'SAMPLECARTESIANPOINTSBYCOVER(...)',
    minArgs: 0,
    maxArgs: -1,
    evaluate: () => {
      throw new DaxError(
        'Execution',
        'A função DAX "SAMPLECARTESIANPOINTSBYCOVER" não é suportada no navegador: algoritmo de amostragem gráfica do Power BI Desktop.'
      );
    },
  },
};
