import { GoogleGenAI } from '@google/genai';
import { getAiApiKey, getSelectedModel, getPrivacyConsent, DEFAULT_GEMINI_MODEL } from './aiConfig';
import {
  localAsk,
  localSummary,
  localDax,
  extractTablesAndMeasures,
  LocalAskResult,
  LocalDaxResult,
  LocalSummaryResult,
} from './localAssist';
import { Table, Measure } from '../types/bi';
import { buildSafeSchema, truncatePayload } from './aiSchema';

export type AiSource = 'gemini' | 'local';
export type FallbackReason = 'no_key' | 'error' | 'consent_declined';

export interface AiResponseMeta {
  source: AiSource;
  isFallback: boolean;
  fallbackReason?: FallbackReason;
  errorMessage?: string;
  isTruncated?: boolean;
}

export type AskDataResponse = Omit<LocalAskResult, 'source'> & AiResponseMeta;
export type SummaryResponse = Omit<LocalSummaryResult, 'source'> & AiResponseMeta;
export type DaxAssistResponse = Omit<LocalDaxResult, 'source'> & AiResponseMeta;

const TIMEOUT_MS = 30000;

function translateErrorMessage(err: any): string {
  const msg = String(err?.message || err || '');
  const status = err?.status || (err?.response ? err.response.status : undefined);

  if (
    status === 400 ||
    status === 403 ||
    msg.includes('API key') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('403') ||
    msg.includes('400')
  ) {
    return 'Chave de API inválida ou sem permissão para acessar o Gemini.';
  }
  if (
    status === 429 ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.includes('quota')
  ) {
    return 'Cota de requisições esgotada para esta chave. Aguarde alguns instantes.';
  }
  if (
    status === 404 ||
    msg.includes('NOT_FOUND') ||
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('deprecated')
  ) {
    return 'Modelo de IA inexistente ou descontinuado. Abra as Configurações de IA e use "Testar conexão e listar modelos" para selecionar um modelo disponível.';
  }
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('network') ||
    msg.includes('AbortError')
  ) {
    return 'Sem conexão com a internet ou tempo limite excedido (30s) ao contactar a Google.';
  }
  return `Erro ao consultar o Gemini: ${msg}`;
}

/**
 * Runs a Gemini generateContent call with a 30s timeout and up to 1 retry on network error.
 */
async function callGeminiWithTimeout(
  apiKey: string,
  modelName: string,
  contents: string,
  systemInstruction?: string,
  responseMimeType?: string
): Promise<string> {
  let attempt = 0;
  const maxAttempts = 2; // 1 initial + 1 retry on network error

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const ai = new GoogleGenAI({
        apiKey,
      });

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          responseMimeType,
          abortSignal: controller.signal,
        },
      });

      clearTimeout(timeoutId);
      return response.text || '';
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isNetwork =
        err?.name === 'AbortError' ||
        String(err?.message || '').includes('Failed to fetch') ||
        String(err?.message || '').includes('NetworkError');

      if (attempt < maxAttempts && isNetwork) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }

  throw new Error('Tempo limite excedido ao comunicar com os servidores da Google.');
}

/**
 * Natural language question to BI Visual / Query
 */
export async function askData(
  question: string,
  schemaContext: string = '',
  schemaOrTables?: { tables?: Table[]; measures?: Measure[] } | Table[],
  fallbackMeasures?: Measure[]
): Promise<AskDataResponse> {
  const apiKey = getAiApiKey();
  const modelName = getSelectedModel();
  const { tables, measures } = extractTablesAndMeasures(schemaOrTables, fallbackMeasures);

  const consent = getPrivacyConsent();
  if (apiKey && !consent.accepted) {
    const local = localAsk(question, tables, measures);
    return {
      ...local,
      source: 'local',
      isFallback: true,
      fallbackReason: 'consent_declined',
      errorMessage: 'Envio à API recusado na confirmação de privacidade. Resposta gerada localmente.',
    };
  }

  if (!apiKey) {
    const local = localAsk(question, tables, measures);
    return {
      ...local,
      source: 'local',
      isFallback: true,
      fallbackReason: 'no_key',
      errorMessage: 'Chave Gemini não configurada. Resposta gerada localmente.',
    };
  }

  const { data: safeSchema, isTruncated } = truncatePayload(schemaContext || buildSafeSchema(tables, measures));

  const systemInstruction = `Você é o Copilot de Business Intelligence do InsightHub (pt-BR).
O usuário fará uma pergunta em linguagem natural sobre seus dados.
Com base no esquema das tabelas fornecido:
${safeSchema}

Responda ESTRITAMENTE em formato JSON com o seguinte formato:
{
  "interpretation": "Explicação resumida do que foi entendido",
  "suggestedVisual": {
    "type": "column" | "bar" | "line" | "pie" | "donut" | "card" | "table" | "treemap",
    "title": "Título sugerido para o gráfico",
    "recommendedTable": "Nome da tabela",
    "xAxisField": "Coluna para eixo X ou categoria",
    "valueField": "Coluna ou métrica numérica",
    "aggregation": "SUM" | "AVG" | "COUNT" | "DISTINCTCOUNT" | "MIN" | "MAX"
  },
  "sqlQuery": "Query SQL válida em formato AlaSQL / ANSI SQL",
  "daxFormula": "Fórmula DAX equivalente caso aplicável",
  "insights": ["Ponto chave 1", "Ponto chave 2"]
}`;

  try {
    const outputText = await callGeminiWithTimeout(
      apiKey,
      modelName,
      `Pergunta do usuário: "${question}"`,
      systemInstruction,
      'application/json'
    );

    let parsed: any = {};
    try {
      parsed = JSON.parse(outputText);
    } catch {
      parsed = { interpretation: outputText };
    }

    return {
      interpretation: parsed.interpretation || `Pergunta: "${question}"`,
      suggestedVisual: parsed.suggestedVisual || {
        type: 'column',
        title: question,
        recommendedTable: tables[0]?.name || '',
        aggregation: 'SUM',
      },
      sqlQuery: parsed.sqlQuery || '',
      daxFormula: parsed.daxFormula,
      explanation: parsed.explanation || 'Visual sugerido pelo modelo Gemini com base no seu esquema.',
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      source: 'gemini',
      isFallback: false,
      isTruncated,
    };
  } catch (err: any) {
    const errorMsg = translateErrorMessage(err);
    const local = localAsk(question, tables, measures);
    return {
      ...local,
      source: 'local',
      isFallback: true,
      fallbackReason: 'error',
      errorMessage: errorMsg,
      isTruncated,
    };
  }
}

/**
 * Executive Narrative / Summary
 */
export async function summarize(
  datasetSummary: any,
  currentMetrics: any,
  schemaOrTables?: { tables?: Table[]; measures?: Measure[] } | Table[],
  fallbackMeasures?: Measure[]
): Promise<SummaryResponse> {
  const apiKey = getAiApiKey();
  const modelName = getSelectedModel();
  const { tables, measures } = extractTablesAndMeasures(schemaOrTables, fallbackMeasures);

  const consent = getPrivacyConsent();
  if (apiKey && !consent.accepted) {
    const local = localSummary(datasetSummary, currentMetrics, tables, measures);
    return {
      ...local,
      source: 'local',
      isFallback: true,
      fallbackReason: 'consent_declined',
      errorMessage: 'Envio à API recusado na confirmação de privacidade. Resumo gerado localmente.',
    };
  }

  if (!apiKey) {
    const local = localSummary(datasetSummary, currentMetrics, tables, measures);
    return {
      ...local,
      source: 'local',
      isFallback: true,
      fallbackReason: 'no_key',
      errorMessage: 'Chave Gemini não configurada. Resumo gerado localmente por regras heurísticas.',
    };
  }

  const rawPayload = JSON.stringify({ datasetSummary, currentMetrics }, null, 2);
  const { data: safePayload, isTruncated } = truncatePayload(rawPayload);

  const prompt = `Analise os seguintes dados agregados e métricas de negócios do InsightHub:
${safePayload}

Gere um Resumo Executivo Narrativo profissional em português do Brasil com:
1. Destaques principais (Faturamento, Margem, Tendência)
2. Maiores direcionadores de crescimento ou queda
3. Alertas e pontos de atenção prioritários
4. Conclusão e recomendação acionável.
Mantenha o tom profissional e direto, estilo relatório de diretoria. Finalize com aviso legal: "Aviso: Números gerados com assistência de IA requerem validação contábil formal."`;

  try {
    const text = await callGeminiWithTimeout(apiKey, modelName, prompt);
    return {
      summary: text,
      source: 'gemini',
      isFallback: false,
      isTruncated,
    };
  } catch (err: any) {
    const errorMsg = translateErrorMessage(err);
    const local = localSummary(datasetSummary, currentMetrics, tables, measures);
    return {
      ...local,
      source: 'local',
      isFallback: true,
      fallbackReason: 'error',
      errorMessage: errorMsg,
      isTruncated,
    };
  }
}

/**
 * DAX Formula Copilot: Generate, Explain, Optimize
 */
export async function daxAssist(
  params: {
    task: string;
    description?: string;
    existingFormula?: string;
    schemaContext?: string;
  },
  schemaOrTables?: { tables?: Table[]; measures?: Measure[] } | Table[],
  fallbackMeasures?: Measure[]
): Promise<DaxAssistResponse> {
  const apiKey = getAiApiKey();
  const modelName = getSelectedModel();
  const { tables, measures } = extractTablesAndMeasures(schemaOrTables, fallbackMeasures);

  const consent = getPrivacyConsent();
  if (apiKey && !consent.accepted) {
    const local = localDax(params, tables, measures);
    return {
      ...local,
      source: 'local',
      isFallback: true,
      fallbackReason: 'consent_declined',
      errorMessage: 'Envio à API recusado na confirmação de privacidade. Fórmula DAX gerada localmente.',
    };
  }

  if (!apiKey) {
    const local = localDax(params, tables, measures);
    return {
      ...local,
      source: 'local',
      isFallback: true,
      fallbackReason: 'no_key',
      errorMessage: 'Chave Gemini não configurada. Fórmula DAX gerada localmente.',
    };
  }

  const { data: safeSchema, isTruncated } = truncatePayload(params.schemaContext || buildSafeSchema(tables, measures));

  let taskInstruction = '';
  if (params.task === 'explain') {
    taskInstruction = `Explique a seguinte fórmula DAX passo a passo: "${params.existingFormula}". Destaque o contexto de avaliação, se há transição de contexto e boas práticas.`;
  } else if (params.task === 'optimize') {
    taskInstruction = `Otimize a seguinte fórmula DAX para melhor desempenho e legibilidade: "${params.existingFormula}". Sugira alternativas mais eficientes.`;
  } else {
    taskInstruction = `Crie uma fórmula DAX com base nesta solicitação: "${params.description}".`;
  }

  const systemInstruction = `Você é um especialista sênior em Microsoft Power BI e linguagem DAX (pt-BR).
Com base nas tabelas do modelo semântico:
${safeSchema}

Responda ESTRITAMENTE em formato JSON com o seguinte formato:
{
  "suggestedMeasureName": "Nome descritivo da medida (ex: Margem Bruta %)",
  "targetTable": "Nome da tabela onde a medida deve ser alocada",
  "dax": "Fórmula DAX válida e formatada",
  "explanation": "Explicação detalhada e didática do cálculo",
  "performanceTips": "Dicas de otimização de performance relacionadas a este cálculo"
}`;

  try {
    const outputText = await callGeminiWithTimeout(
      apiKey,
      modelName,
      taskInstruction,
      systemInstruction,
      'application/json'
    );

    let parsed: any = {};
    try {
      parsed = JSON.parse(outputText);
    } catch {
      parsed = { dax: outputText, explanation: 'Fórmula gerada com Gemini.' };
    }

    return {
      suggestedMeasureName: parsed.suggestedMeasureName || 'Nova Medida DAX',
      targetTable: parsed.targetTable || tables[0]?.name || 'f_Vendas',
      dax: parsed.dax || params.existingFormula || '',
      explanation: parsed.explanation || 'Fórmula DAX gerada pelo modelo Gemini.',
      performanceTips: parsed.performanceTips || 'Use variáveis (VAR) para evitar recalcular a mesma expressão.',
      source: 'gemini',
      isFallback: false,
      isTruncated,
    };
  } catch (err: any) {
    const errorMsg = translateErrorMessage(err);
    const local = localDax(params, tables, measures);
    return {
      ...local,
      source: 'local',
      isFallback: true,
      fallbackReason: 'error',
      errorMessage: errorMsg,
      isTruncated,
    };
  }
}

/**
 * Tests connection with the provided key and retrieves available models supporting generateContent.
 */
export async function testConnectionAndListModels(
  customApiKey?: string,
  modelToTest?: string
): Promise<{ success: boolean; latencyMs?: number; models: string[]; error?: string }> {
  const key = customApiKey || getAiApiKey();
  if (!key) {
    return { success: false, models: [], error: 'Nenhuma chave fornecida para teste.' };
  }

  const startTime = Date.now();
  try {
    const ai = new GoogleGenAI({
      apiKey: key,
    });

    const response = await ai.models.list();
    const modelList: string[] = [];

    // Filter models supporting generateContent
    for await (const m of response) {
      const name = m.name?.replace(/^models\//, '') || '';
      const methods = (m as any).supportedGenerationMethods || (m as any).supportedActions || [];
      if (
        methods.includes('generateContent') ||
        name.includes('gemini') ||
        name.includes('flash') ||
        name.includes('pro')
      ) {
        modelList.push(name);
      }
    }

    // Sort models cleanly, ensuring DEFAULT_GEMINI_MODEL is first if present
    modelList.sort((a, b) => {
      if (a === DEFAULT_GEMINI_MODEL) return -1;
      if (b === DEFAULT_GEMINI_MODEL) return 1;
      return a.localeCompare(b);
    });

    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      latencyMs,
      models: modelList.length > 0 ? modelList : [modelToTest || DEFAULT_GEMINI_MODEL],
    };
  } catch (err: any) {
    return {
      success: false,
      models: [],
      error: translateErrorMessage(err),
    };
  }
}
