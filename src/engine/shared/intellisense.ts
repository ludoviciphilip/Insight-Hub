import { ALL_SCALAR_FUNCTIONS } from '../functions';
import { Table, Measure, UserDefinedFunction, DaxSnippet } from '../../types/bi';
import { UdfManager } from '../model/udfManager';

export interface CompletionItem {
  label: string;
  kind: 'function' | 'measure' | 'column' | 'table' | 'udf' | 'keyword' | 'snippet';
  detail: string;
  documentation?: string;
  insertText: string;
  daxGuideUrl?: string;
  parameters?: string[];
  category?: string;
}

export const DAX_SNIPPETS: DaxSnippet[] = [
  {
    id: 'snippet_yoy',
    title: 'Crescimento YoY (Year-over-Year)',
    category: 'Time Intelligence',
    description: 'Calcula o valor da mesma métrica no mesmo período do ano anterior usando SAMEPERIODLASTYEAR',
    template: `VAR ValorAtual = [Medida]\nVAR AnoAnterior = CALCULATE([Medida], SAMEPERIODLASTYEAR('d_Calendario'[Data]))\nRETURN DIVIDE(ValorAtual - AnoAnterior, AnoAnterior, 0)`,
  },
  {
    id: 'snippet_ytd',
    title: 'Acumulado no Ano (YTD)',
    category: 'Time Intelligence',
    description: 'Calcula o acumulado do ano até a data atual usando TOTALYTD',
    template: `TOTALYTD([Medida], 'd_Calendario'[Data])`,
  },
  {
    id: 'snippet_mom',
    title: 'Crescimento MoM (Month-over-Month)',
    category: 'Growth',
    description: 'Calcula a variação percentual mês a mês usando DATEADD',
    template: `VAR MesAtual = [Medida]\nVAR MesAnterior = CALCULATE([Medida], DATEADD('d_Calendario'[Data], -1, MONTH))\nRETURN DIVIDE(MesAtual - MesAnterior, MesAnterior, 0)`,
  },
  {
    id: 'snippet_pareto',
    title: 'Curva ABC / Pareto Acumulado',
    category: 'ABC / Pareto',
    description: 'Classifica os itens em percentual acumulado de Pareto sobre o total geral',
    template: `VAR TotalGeral = CALCULATE([Medida], ALL('d_Produtos'))\nVAR ValorItem = [Medida]\nVAR Acumulado = CALCULATE(\n  [Medida],\n  FILTER(ALL('d_Produtos'), [Medida] >= ValorItem)\n)\nRETURN DIVIDE(Acumulado, TotalGeral, 0)`,
  },
  {
    id: 'snippet_topn_others',
    title: 'Top N + Outros Dinâmico',
    category: 'Ranking',
    description: 'Retorna os top 5 itens individualmente e agrupa os demais em "Outros"',
    template: `VAR Ranking = RANKX(ALL('d_Produtos'[Nome]), [Medida], , DESC)\nRETURN\n  IF(\n    Ranking <= 5,\n    [Medida],\n    CALCULATE([Medida], ALL('d_Produtos')) - CALCULATE([Medida], TOPN(5, ALL('d_Produtos'[Nome]), [Medida], DESC))\n  )`,
  },
  {
    id: 'snippet_query_template',
    title: 'Modelo de Consulta DAX (DEFINE & EVALUATE)',
    category: 'Growth',
    description: 'Estrutura completa de consulta DAX com medida temporária e agrupamento ordenado',
    template: `DEFINE\n  MEASURE f_Vendas[Margem] = [Receita] - [Custo]\n\nEVALUATE\n  SUMMARIZECOLUMNS(\n    'd_Calendario'[Ano],\n    "Margem", [Margem]\n  )\nORDER BY\n  'd_Calendario'[Ano] ASC`,
  },
];

export const DAX_KEYWORDS = [
  'EVALUATE',
  'DEFINE',
  'MEASURE',
  'COLUMN',
  'TABLE',
  'VAR',
  'RETURN',
  'FUNCTION',
  'ORDER BY',
  'START AT',
  'ASC',
  'DESC',
  'NOT',
  'IN',
  'TRUE',
  'FALSE',
  'BLANK',
];

/**
 * Returns the dax.guide URL for any function.
 */
export function getDaxGuideUrl(functionName: string): string {
  const clean = functionName.trim().toLowerCase().replace(/\./g, '-');
  return `https://dax.guide/${clean}/`;
}

/**
 * Parses active function and parameter index at cursor offset in a formula.
 */
export function getSignatureHelpAtOffset(
  text: string,
  cursorOffset: number
): {
  functionName?: string;
  activeParameterIndex: number;
  daxGuideUrl?: string;
  syntax?: string;
  description?: string;
} | null {
  const beforeCursor = text.substring(0, cursorOffset);

  // Scan backwards to find the enclosing unclosed '('
  let depth = 0;
  let parenIndex = -1;

  for (let i = beforeCursor.length - 1; i >= 0; i--) {
    const ch = beforeCursor[i];
    if (ch === ')') depth++;
    else if (ch === '(') {
      if (depth === 0) {
        parenIndex = i;
        break;
      } else {
        depth--;
      }
    }
  }

  if (parenIndex === -1) return null;

  // Extract function identifier immediately preceding '('
  const textBeforeParen = beforeCursor.substring(0, parenIndex).trimEnd();
  const fnMatch = textBeforeParen.match(/([a-zA-Z_][a-zA-Z0-9_\.]*)$/);
  if (!fnMatch) return null;

  const fnName = fnMatch[1].toUpperCase();

  // Count commas and semicolons between parenIndex and cursorOffset at depth 0
  let activeParamIndex = 0;
  let innerDepth = 0;
  for (let i = parenIndex + 1; i < beforeCursor.length; i++) {
    const ch = beforeCursor[i];
    if (ch === '(' || ch === '[' || ch === '{') innerDepth++;
    else if (ch === ')' || ch === ']' || ch === '}') innerDepth--;
    else if ((ch === ',' || ch === ';') && innerDepth === 0) {
      activeParamIndex++;
    }
  }

  const fnDef = ALL_SCALAR_FUNCTIONS[fnName];
  const udf = UdfManager.getFunction(fnName);

  if (fnDef) {
    return {
      functionName: fnDef.name,
      activeParameterIndex: activeParamIndex,
      daxGuideUrl: getDaxGuideUrl(fnDef.name),
      syntax: fnDef.syntax,
      description: fnDef.description,
    };
  }

  if (udf) {
    return {
      functionName: udf.name,
      activeParameterIndex: activeParamIndex,
      syntax: `${udf.name}(${udf.parameters.join(', ')})`,
      description: udf.description || `Função definida pelo usuário (UDF)`,
    };
  }

  return {
    functionName: fnName,
    activeParameterIndex: activeParamIndex,
    daxGuideUrl: getDaxGuideUrl(fnName),
  };
}

/**
 * Returns autocomplete completion items matching a search query.
 */
export function getDaxCompletions(
  query: string,
  tables: Table[] = [],
  measures: Measure[] = [],
  udfs: UserDefinedFunction[] = []
): CompletionItem[] {
  const clean = (query || '').toLowerCase().trim();
  const items: CompletionItem[] = [];

  // 1. Scalar DAX Functions
  for (const [key, fn] of Object.entries(ALL_SCALAR_FUNCTIONS)) {
    if (!clean || key.toLowerCase().includes(clean)) {
      items.push({
        label: fn.name,
        kind: 'function',
        detail: fn.syntax,
        documentation: fn.description,
        insertText: `${fn.name}(`,
        daxGuideUrl: getDaxGuideUrl(fn.name),
        category: fn.category,
      });
    }
  }

  // 2. User Defined Functions (UDF)
  for (const fn of [...udfs, ...UdfManager.getFunctions()]) {
    if (!clean || fn.name.toLowerCase().includes(clean)) {
      items.push({
        label: fn.name,
        kind: 'udf',
        detail: `UDF: ${fn.name}(${fn.parameters.join(', ')})`,
        documentation: fn.description || `Corpo: ${fn.body}`,
        insertText: `${fn.name}(`,
        category: 'UDF',
      });
    }
  }

  // 3. Measures
  for (const m of measures) {
    const label = `[${m.name}]`;
    if (!clean || label.toLowerCase().includes(clean) || m.name.toLowerCase().includes(clean)) {
      items.push({
        label,
        kind: 'measure',
        detail: `Medida (${m.tableName})`,
        documentation: `Fórmula: ${m.formula}`,
        insertText: `[${m.name}]`,
        category: 'Medidas',
      });
    }
  }

  // 4. Tables and Columns
  for (const t of tables) {
    const tLabel = `'${t.name}'`;
    if (!clean || t.name.toLowerCase().includes(clean)) {
      items.push({
        label: tLabel,
        kind: 'table',
        detail: `Tabela (${t.rows.length} linhas)`,
        insertText: `'${t.name}'`,
        category: 'Tabelas',
      });
    }

    for (const c of t.columns) {
      const colLabel = `'${t.name}'[${c.name}]`;
      const shortColLabel = `[${c.name}]`;
      if (!clean || colLabel.toLowerCase().includes(clean) || c.name.toLowerCase().includes(clean)) {
        items.push({
          label: colLabel,
          kind: 'column',
          detail: `Coluna (${c.dataType})`,
          insertText: `'${t.name}'[${c.name}]`,
          category: 'Colunas',
        });
      }
    }
  }

  // 5. DAX Keywords
  for (const kw of DAX_KEYWORDS) {
    if (!clean || kw.toLowerCase().includes(clean)) {
      items.push({
        label: kw,
        kind: 'keyword',
        detail: 'Instrução / Palavra-chave DAX',
        insertText: kw,
        category: 'Instruções',
      });
    }
  }

  // 6. Snippets
  for (const snip of DAX_SNIPPETS) {
    if (!clean || snip.title.toLowerCase().includes(clean) || snip.category.toLowerCase().includes(clean)) {
      items.push({
        label: `Snippet: ${snip.title}`,
        kind: 'snippet',
        detail: snip.description,
        documentation: snip.template,
        insertText: snip.template,
        category: 'Snippets',
      });
    }
  }

  return items;
}
