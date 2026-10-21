import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Initialize GoogleGenAI SDK safely
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Natural Language to BI Visual / Query
app.post('/api/ai/ask', async (req: Request, res: Response) => {
  try {
    const { question, schemaContext } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Pergunta obrigatória' });
    }

    if (!ai) {
      // Local fallback parser when API key is not configured
      return res.json({
        success: true,
        isFallback: true,
        interpretation: `Análise local da pergunta: "${question}"`,
        suggestedVisual: {
          type: question.toLowerCase().includes('mês') || question.toLowerCase().includes('tempo') ? 'line' : 'column',
          title: question,
          recommendedTable: 'f_Vendas',
          xAxisField: question.toLowerCase().includes('mês') ? 'Mes' : 'Categoria',
          valueField: question.toLowerCase().includes('quantidade') ? 'Quantidade' : 'ValorTotal',
          aggregation: 'SUM',
        },
        sqlQuery: `SELECT ${question.toLowerCase().includes('mês') ? 'Mes' : 'Categoria'} AS Dimensao, SUM(${question.toLowerCase().includes('quantidade') ? 'Quantidade' : 'ValorTotal'}) AS Valor FROM f_Vendas GROUP BY 1 ORDER BY 2 DESC`,
        explanation: 'Consulta interpretada localmente. Conecte sua chave Gemini no painel de configurações para interpretação semântica profunda.'
      });
    }

    const systemInstruction = `Você é o Copilot de Business Intelligence do InsightHub (pt-BR).
O usuário fará uma pergunta em linguagem natural sobre seus dados.
Com base no esquema das tabelas fornecido:
${schemaContext || 'Tabelas padrão: f_Vendas (Data, Categoria, Produto, Cliente, Regiao, Quantidade, ValorTotal, MargemLucro), d_Calendario (Data, Ano, Mes, NomeMes), d_Clientes (ID, Nome, Cidade, Estado), d_Produtos (ID, Nome, Categoria, CustoUnitario)'}

Responda ESTRITAMENTE em formato JSON com o seguinte formato:
{
  "interpretation": "Explicação resumida do que foi entendido",
  "suggestedVisual": {
    "type": "column" | "bar" | "line" | "pie" | "donut" | "card" | "table" | "treemap",
    "title": "Título sugerido para o gráfico",
    "recommendedTable": "Nome da tabela",
    "xAxisField": "Coluna para eixo X ou categoria",
    "valueField": "Coluna ou métrica numérica",
    "aggregation": "SUM" | "AVG" | "COUNT" | "MIN" | "MAX"
  },
  "sqlQuery": "Query SQL válida em formato AlaSQL / ANSI SQL",
  "daxFormula": "Fórmula DAX equivalente caso aplicável",
  "insights": ["Ponto chave 1", "Ponto chave 2"]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Pergunta do usuário: "${question}"`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const outputText = response.text || '{}';
    let parsed = {};
    try {
      parsed = JSON.parse(outputText);
    } catch {
      parsed = { interpretation: outputText };
    }

    return res.json({ success: true, ...parsed });
  } catch (error: any) {
    console.error('Erro na API AI Ask:', error);
    return res.status(500).json({ error: error.message || 'Erro ao processar consulta de IA' });
  }
});

// Smart Narrative / Executive Summary
app.post('/api/ai/summary', async (req: Request, res: Response) => {
  try {
    const { datasetSummary, currentMetrics } = req.body;

    if (!ai) {
      return res.json({
        success: true,
        isFallback: true,
        summary: `Resumo Executivo Gerado Localmente:
- O volume total de transações analisadas reflete estabilidade operacional.
- Principais categorias de produtos lideram a geração de margem bruta.
- Recomendação: Aprofundar a análise de clientes corporativos com maior ticket médio.
(Nota: Ative o Gemini para narrativas executivas aprofundadas com detecção avançada de causas).`
      });
    }

    const prompt = `Analise os seguintes dados e métricas de negócios do InsightHub:
${JSON.stringify({ datasetSummary, currentMetrics }, null, 2)}

Gere um Resumo Executivo Narrativo profissional em português do Brasil com:
1. Destaques principais (Faturamento, Margem, Tendência)
2. Maiores direcionadores de crescimento ou queda
3. Alertas e pontos de atenção prioritários
4. Conclusão e recomendação acionável.
Mantenha o tom profissional e direto, estilo relatório de diretoria. Finalize com aviso legal: "Aviso: Números gerados com assistência de IA requerem validação contábil formal."`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({ success: true, summary: response.text });
  } catch (error: any) {
    console.error('Erro na API AI Summary:', error);
    return res.status(500).json({ error: error.message || 'Erro ao gerar narrativa' });
  }
});

// DAX Assistant (Generate, Explain, Optimize)
app.post('/api/ai/dax', async (req: Request, res: Response) => {
  try {
    const { task, description, existingFormula } = req.body;

    if (!ai) {
      return res.json({
        success: true,
        isFallback: true,
        dax: task === 'explain' ? 'Fórmula padrão de agregação' : 'CALCULATE(SUM(f_Vendas[ValorTotal]), ALL(d_Calendario))',
        explanation: 'Exemplo de DAX calculado localmente com context transition.'
      });
    }

    const systemInstruction = `Você é um especialista em DAX (Data Analysis Expressions) do Power BI e InsightHub.
Seu objetivo é gerar fórmulas DAX válidas, precisas e otimizadas com explicações pedagógicas em português do Brasil.`;

    const prompt = `Tarefa: ${task}
Descrição do cálculo desejado: "${description}"
${existingFormula ? `Fórmula atual: ${existingFormula}` : ''}

Retorne estritamente um JSON:
{
  "dax": "Fórmula DAX formatada",
  "explanation": "Explicação passo a passo do cálculo e dos contextos de linha/filtro",
  "performanceTips": "Dica de performance"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, ...parsed });
  } catch (error: any) {
    console.error('Erro na API AI DAX:', error);
    return res.status(500).json({ error: error.message || 'Erro no assistente DAX' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`InsightHub BI Server running on http://localhost:${PORT}`);
  });
}

startServer();
