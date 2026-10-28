import { Table, Measure } from '../types/bi';

export interface LocalAskResult {
  source?: 'gemini' | 'local';
  interpretation: string;
  suggestedVisual: {
    type: 'column' | 'bar' | 'line' | 'pie' | 'donut' | 'card' | 'table' | 'treemap';
    title: string;
    recommendedTable: string;
    xAxisField?: string;
    valueField?: string;
    aggregation: 'SUM' | 'AVG' | 'COUNT' | 'DISTINCTCOUNT' | 'MIN' | 'MAX';
  };
  sqlQuery: string;
  daxFormula?: string;
  explanation: string;
  insights: string[];
}

export interface LocalDaxResult {
  source?: 'gemini' | 'local';
  suggestedMeasureName: string;
  targetTable: string;
  dax: string;
  explanation: string;
  performanceTips: string;
}

export interface LocalSummaryResult {
  source?: 'gemini' | 'local';
  summary: string;
}

function removeAccents(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function cleanString(str?: string | null): string {
  return removeAccents(str).replace(/[\s_\-]+/g, '');
}

export function extractTablesAndMeasures(
  schemaOrTables?: { tables?: Table[]; measures?: Measure[] } | Table[],
  fallbackMeasures?: Measure[]
): { tables: Table[]; measures: Measure[] } {
  if (Array.isArray(schemaOrTables)) {
    return {
      tables: schemaOrTables,
      measures: fallbackMeasures || [],
    };
  }
  return {
    tables: schemaOrTables?.tables || [],
    measures: schemaOrTables?.measures || fallbackMeasures || [],
  };
}

/**
 * Pure function: local heuristic analysis of natural language questions using real model schema.
 */
export function localAsk(
  question: string,
  schemaOrTables?: { tables?: Table[]; measures?: Measure[] } | Table[],
  fallbackMeasures?: Measure[]
): LocalAskResult {
  const normQ = removeAccents(question);
  const cleanQ = cleanString(question);
  const { tables, measures } = extractTablesAndMeasures(schemaOrTables, fallbackMeasures);

  if (tables.length === 0) {
    return {
      source: 'local',
      interpretation: `Nenhuma tabela encontrada no modelo para responder: "${question}"`,
      suggestedVisual: {
        type: 'card',
        title: question,
        recommendedTable: '',
        aggregation: 'COUNT',
      },
      sqlQuery: '-- Nenhuma tabela disponível no modelo',
      explanation: 'Importe dados ou crie uma tabela para habilitar a geração de visuais.',
      insights: ['Modelo de dados vazio.'],
    };
  }

  // 1. Find matching table
  let matchedTable: Table | null = null;
  let maxTableScore = 0;

  for (const t of tables) {
    const tClean = cleanString(t.name);
    let score = 0;
    if (cleanQ.includes(tClean)) score += 10;
    // Check columns
    for (const c of t.columns) {
      const cClean = cleanString(c.name);
      if (cleanQ.includes(cClean)) score += 3;
    }
    if (score > maxTableScore) {
      maxTableScore = score;
      matchedTable = t;
    }
  }

  if (!matchedTable) {
    matchedTable = tables[0];
  }

  // 2. Aggregation detection
  let aggregation: 'SUM' | 'AVG' | 'COUNT' | 'DISTINCTCOUNT' | 'MIN' | 'MAX' = 'SUM';
  if (normQ.includes('media') || normQ.includes('medio')) {
    aggregation = 'AVG';
  } else if (normQ.includes('distinto') || normQ.includes('unico') || normQ.includes('unicos')) {
    aggregation = 'DISTINCTCOUNT';
  } else if (
    normQ.includes('quantidade') ||
    normQ.includes('contagem') ||
    normQ.includes('quantos') ||
    normQ.includes('quantas') ||
    normQ.includes('numero de')
  ) {
    aggregation = 'COUNT';
  } else if (normQ.includes('minimo') || normQ.includes('menor')) {
    aggregation = 'MIN';
  } else if (normQ.includes('maximo') || normQ.includes('maior')) {
    aggregation = 'MAX';
  }

  // 3. Measure match
  const matchedMeasure = measures.find(m => cleanQ.includes(cleanString(m.name)));

  // 4. Value column detection - prioritize non-ID metric columns and currency
  const numericColumns = matchedTable.columns.filter(
    c => c.dataType === 'number' || c.dataType === 'currency' || c.dataType === 'percentage'
  );

  // Sort candidate columns: matching question > currency > non-id numbers > id numbers
  const sortedNumericCols = [...numericColumns].sort((a, b) => {
    const aClean = cleanString(a.name);
    const bClean = cleanString(b.name);
    const aMatch = cleanQ.includes(aClean) ? 10 : 0;
    const bMatch = cleanQ.includes(bClean) ? 10 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;

    const aIsId = /^id_|^id$|_id$/i.test(a.name) ? -5 : 0;
    const bIsId = /^id_|^id$|_id$/i.test(b.name) ? -5 : 0;
    if (aIsId !== bIsId) return bIsId - aIsId;

    const aIsCurr = a.dataType === 'currency' ? 3 : 0;
    const bIsCurr = b.dataType === 'currency' ? 3 : 0;
    return bIsCurr - aIsCurr;
  });

  // Check if question asks for revenue/sales/amount/value
  let valueCol: string | undefined;
  if (/faturamento|receita|venda|valor|total|montante|preco/.test(normQ)) {
    const valCandidate = sortedNumericCols.find(
      c => /valor|total|preco|receita|faturam|preco/i.test(c.name) || c.dataType === 'currency'
    );
    if (valCandidate) valueCol = valCandidate.name;
  }

  if (!valueCol) {
    valueCol = sortedNumericCols.find(c => cleanQ.includes(cleanString(c.name)))?.name;
  }
  if (!valueCol && sortedNumericCols.length > 0) {
    valueCol = sortedNumericCols[0].name;
  }

  // 5. Dimension / Category detection
  const dateColumns = matchedTable.columns.filter(
    c => c.dataType === 'date' || /data|date|ano|mes|periodo/i.test(c.name)
  );
  const isTimeIntent = /mes|ano|tempo|periodo|dia|historico|evolucao|tendencia|data/.test(normQ);

  let xAxisCol: string | undefined;
  if (isTimeIntent && dateColumns.length > 0) {
    xAxisCol = dateColumns.find(c => cleanQ.includes(cleanString(c.name)))?.name || dateColumns[0].name;
  } else {
    // Look for categorical column
    const catColumns = matchedTable.columns.filter(
      c => c.dataType === 'text' || (c.name !== valueCol && c.dataType !== 'date' && !/^id_/i.test(c.name))
    );
    xAxisCol = catColumns.find(c => cleanQ.includes(cleanString(c.name)))?.name || catColumns[0]?.name;
  }

  // 6. Visual type determination
  let visualType: 'column' | 'bar' | 'line' | 'pie' | 'donut' | 'card' | 'table' | 'treemap' = 'column';
  if (isTimeIntent && (dateColumns.length > 0 || /tempo|data|mes|ano/.test(normQ))) {
    visualType = 'line';
  } else if (/distribuicao|proporcao|participacao|pizza|donut/.test(normQ)) {
    visualType = 'donut';
  } else if (/ranking|top|barras/.test(normQ)) {
    visualType = 'bar';
  } else if (/total|geral|kpi|resumo|cartao/.test(normQ) && !xAxisCol) {
    visualType = 'card';
  }

  const valExpr = matchedMeasure ? `[${matchedMeasure.name}]` : valueCol || '1';
  const aggSql = matchedMeasure ? `SUM(${matchedMeasure.name})` : `${aggregation}(${valueCol || '*'})`;
  const sqlQuery = xAxisCol
    ? `SELECT [${xAxisCol}] AS Categoria, ${aggSql} AS Valor FROM [${matchedTable.name}] GROUP BY [${xAxisCol}] ORDER BY Valor DESC`
    : `SELECT ${aggSql} AS Total FROM [${matchedTable.name}]`;

  const daxFormula = matchedMeasure
    ? `[${matchedMeasure.name}]`
    : valueCol
    ? `${aggregation}('${matchedTable.name}'[${valueCol}])`
    : `COUNTROWS('${matchedTable.name}')`;

  return {
    source: 'local',
    interpretation: `Análise heurística local identificando métrica ${valExpr} agrupada por ${xAxisCol || 'Total'} na tabela ${matchedTable.name}.`,
    suggestedVisual: {
      type: visualType,
      title: question,
      recommendedTable: matchedTable.name,
      xAxisField: xAxisCol,
      valueField: matchedMeasure ? matchedMeasure.name : valueCol,
      aggregation,
    },
    sqlQuery,
    daxFormula,
    explanation: `Consulta gerada por regras locais com base no esquema real da tabela '${matchedTable.name}'. Para análise semântica profunda, configure sua chave do Gemini.`,
    insights: [
      `Tabela selecionada: ${matchedTable.name}`,
      xAxisCol ? `Eixo de agrupamento: ${xAxisCol}` : 'Agregação escalar global',
      `Agregação aplicada: ${aggregation}`,
    ],
  };
}

/**
 * Pure function: generates an executive narrative summary from real tables and metrics.
 */
export function localSummary(
  datasetSummaryOrMetrics?: any,
  currentMetrics?: Record<string, any>,
  schemaOrTables?: { tables?: Table[]; measures?: Measure[] } | Table[],
  fallbackMeasures?: Measure[]
): LocalSummaryResult {
  const { tables, measures } = extractTablesAndMeasures(schemaOrTables, fallbackMeasures);
  const parts: string[] = [];
  parts.push('### Resumo Executivo (Geração Automática Local - Sem IA)');

  // Merge table count and rows
  const actualTables = tables.length > 0 ? tables : (datasetSummaryOrMetrics?.tables || []);
  if (actualTables.length > 0) {
    const totalRows = actualTables.reduce((acc: number, t: any) => acc + (t.rows?.length || t.rows || 0), 0);
    const tableNames = actualTables.map((t: any) => t.name || t.id).join(', ');
    parts.push(`- **Volume de Dados:** O modelo semântico integra ${actualTables.length} tabela(s) (${tableNames}) com um total de ${totalRows.toLocaleString('pt-BR')} registros monitorados.`);
  }

  // Metrics
  const curr = currentMetrics || datasetSummaryOrMetrics?.currentMetrics || {};
  const metricEntries = Object.entries(curr);
  if (metricEntries.length > 0) {
    parts.push('- **Indicadores Principais Analisados:**');
    for (const [k, v] of metricEntries) {
      parts.push(`  • **${k}:** ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    }
  } else if (measures.length > 0) {
    parts.push(`- **Medidas do Modelo:** ${measures.length} medida(s) disponível(is): ${measures.map(m => `[${m.name}]`).join(', ')}.`);
  } else {
    parts.push('- **Operação Estável:** Nenhuma anomalia de cálculo identificada nas métricas correntes do relatório.');
  }

  parts.push('- **Recomendação:** Aprofundar o acompanhamento temporal das dimensões líderes e definir alertas de desvio.');
  parts.push('\n*(Nota: Este resumo foi computado localmente por heurística determinística. Conecte sua chave do Gemini nas Configurações de IA para análise semântica e preditiva avançada).*');

  return {
    source: 'local',
    summary: parts.join('\n'),
  };
}

/**
 * Pure function: generates, explains or optimizes DAX formulas using real model schema.
 */
export function localDax(
  taskOrRequest:
    | string
    | {
        task: string;
        description?: string;
        existingFormula?: string;
        schemaContext?: string;
      },
  descOrTables?: string | Table[] | { tables?: Table[]; measures?: Measure[] },
  schemaOrMeasures?: { tables?: Table[]; measures?: Measure[] } | Table[] | Measure[],
  existingFormulaParam?: string
): LocalDaxResult {
  let task = 'generate';
  let description = '';
  let existingFormula = '';
  let tables: Table[] = [];
  let measures: Measure[] = [];

  if (typeof taskOrRequest === 'object' && taskOrRequest !== null) {
    task = taskOrRequest.task || 'generate';
    description = taskOrRequest.description || '';
    existingFormula = taskOrRequest.existingFormula || '';
    const extracted = extractTablesAndMeasures(
      descOrTables as any,
      schemaOrMeasures as any
    );
    tables = extracted.tables;
    measures = extracted.measures;
  } else {
    task = String(taskOrRequest || 'generate');
    description = typeof descOrTables === 'string' ? descOrTables : '';
    existingFormula = existingFormulaParam || '';
    const extracted = extractTablesAndMeasures(
      schemaOrMeasures as any
    );
    tables = extracted.tables;
    measures = extracted.measures;
  }

  const descNorm = removeAccents(description);
  const cleanD = cleanString(description);
  const defaultTable = tables[0]?.name || 'f_Dados';

  if (task === 'explain' && existingFormula) {
    return {
      source: 'local',
      suggestedMeasureName: 'Explicação DAX',
      targetTable: defaultTable,
      dax: existingFormula,
      explanation: `Análise local da fórmula: "${existingFormula}". A expressão realiza cálculos no contexto de filtro ativo. Para decomposição semântica detalhada de contexto de linha e transição de contexto, utilize o assistente com chave Gemini.`,
      performanceTips: 'Evite iteradores de tabela inteira (FILTER(ALL(...))) quando puder utilizar KEEPFILTERS ou predicados diretos no CALCULATE.',
    };
  }

  // Find real numeric column by checking matching names
  const numCols = tables.flatMap(t =>
    t.columns
      .filter(c => c.dataType === 'number' || c.dataType === 'currency')
      .map(c => ({ table: t.name, column: c.name }))
  );

  const matchedNumCol = numCols.find(nc => {
    const cleanC = cleanString(nc.column);
    return cleanD.includes(cleanC) || cleanC.includes(cleanD);
  });

  if (matchedNumCol) {
    const agg = /media|medio/.test(descNorm) ? 'AVERAGE' : 'SUM';
    return {
      source: 'local',
      suggestedMeasureName: `Total ${matchedNumCol.column}`,
      targetTable: matchedNumCol.table,
      dax: `${agg}('${matchedNumCol.table}'[${matchedNumCol.column}])`,
      explanation: `Cálculo (${agg}) da coluna real [${matchedNumCol.column}] da tabela '${matchedNumCol.table}'.`,
      performanceTips: 'Medidas explícitas são reutilizáveis e respeitam o contexto de avaliação do relatório.',
    };
  }

  // Find real measures that match description
  const foundMeasures = measures.filter(m => cleanD.includes(cleanString(m.name)));
  const m1 = foundMeasures[0]?.name || measures[0]?.name;
  const m2 = foundMeasures[1]?.name || measures[1]?.name;

  // Margin or ratio
  if (/margem|divis|razao|percent|proporcao/.test(descNorm) && m1 && m2) {
    return {
      source: 'local',
      suggestedMeasureName: 'Margem Calculada',
      targetTable: defaultTable,
      dax: `DIVIDE([${m1}] - [${m2}], [${m1}], 0)`,
      explanation: `Fórmula gerada localmente calculando a margem entre as medidas existentes [${m1}] e [${m2}].`,
      performanceTips: 'A função DIVIDE trata automaticamente divisão por zero retornando BLANK ou o valor alternativo 0.',
    };
  }

  if (/margem|divis|razao|percent|proporcao/.test(descNorm) && m1) {
    return {
      source: 'local',
      suggestedMeasureName: 'Percentual do Total',
      targetTable: defaultTable,
      dax: `DIVIDE([${m1}], CALCULATE([${m1}], ALLSELECTED('${defaultTable}')), 0)`,
      explanation: `Fórmula gerada localmente calculando a participação relativa da medida existente [${m1}] sobre o total selecionado.`,
      performanceTips: 'ALLSELECTED preserva filtros externos do relatório enquanto remove agrupadores internos da visualização.',
    };
  }

  // Fallback if no matching measure or column was found
  if (measures.length > 0) {
    const existingM = measures[0].name;
    return {
      source: 'local',
      suggestedMeasureName: `Acumulado ${existingM}`,
      targetTable: defaultTable,
      dax: `CALCULATE([${existingM}], ALLSELECTED('${defaultTable}'))`,
      explanation: `Modelo de cálculo baseado na medida existente [${existingM}]. Especifique o cálculo desejado com termos como 'soma', 'margem' ou 'média'.`,
      performanceTips: 'Defina variáveis (VAR) no início do DAX caso precise reutilizar o mesmo cálculo intermediário.',
    };
  }

  return {
    source: 'local',
    suggestedMeasureName: 'Nova Medida',
    targetTable: defaultTable,
    dax: `COUNTROWS('${defaultTable}')`,
    explanation: `Contagem básica de linhas na tabela real '${defaultTable}'. Não foram encontradas colunas numéricas ou medidas específicas para compor a fórmula solicitada.`,
    performanceTips: 'COUNTROWS é mais performático que COUNT em colunas com valores não nulos.',
  };
}
