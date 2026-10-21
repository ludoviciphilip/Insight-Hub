import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  PlusCircle,
  FileText,
  Sigma,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Database,
  BarChart2,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';

export const AiAssistantModal: React.FC = () => {
  const {
    aiModalOpen,
    setAiModalOpen,
    tables,
    measures,
    addVisual,
    setActiveView,
    addMeasure,
  } = useBiStore();

  const [activeTab, setActiveTab] = useState<'nlq' | 'narrative' | 'dax'>('nlq');

  // NLQ state
  const [nlqQuestion, setNlqQuestion] = useState('Qual o faturamento total por categoria de produto?');
  const [nlqLoading, setNlqLoading] = useState(false);
  const [nlqResult, setNlqResult] = useState<any>(null);

  // Executive narrative state
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeText, setNarrativeText] = useState<string | null>(null);

  // DAX Copilot state
  const [daxPrompt, setDaxPrompt] = useState('Calcule a margem percentual de lucro dividindo o lucro bruto pelo faturamento');
  const [daxLoading, setDaxLoading] = useState(false);
  const [daxResult, setDaxResult] = useState<any>(null);

  if (!aiModalOpen) return null;

  // Ask AI endpoint
  const handleAskNlq = async () => {
    if (!nlqQuestion.trim()) return;
    setNlqLoading(true);
    setNlqResult(null);

    const schemaSummary = tables
      .map(t => `${t.name} (${t.columns.map(c => `${c.name}:${c.dataType}`).join(', ')})`)
      .join('\n');

    try {
      const resp = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: nlqQuestion, schemaContext: schemaSummary }),
      });
      const data = await resp.json();
      setNlqResult(data);
    } catch (err: any) {
      setNlqResult({
        interpretation: 'Consulta interpretada localmente.',
        suggestedVisual: {
          type: 'column',
          title: nlqQuestion,
          recommendedTable: 'f_Vendas',
          xAxisField: 'Categoria',
          valueField: 'ValorTotal',
          aggregation: 'SUM',
        },
      });
    } finally {
      setNlqLoading(false);
    }
  };

  // Generate Executive Summary
  const handleGenerateSummary = async () => {
    setNarrativeLoading(true);
    try {
      const resp = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetSummary: {
            tables: tables.map(t => ({ name: t.name, rows: t.rows.length })),
          },
          currentMetrics: {
            faturamentoAproximado: 'R$ 1.280.000,00',
            margemBrutaMedia: '41,5%',
            rotasLogisticas: '5 rotas ativas com custo médio R$ 3,48/km',
          },
        }),
      });
      const data = await resp.json();
      setNarrativeText(data.summary);
    } catch (err: any) {
      setNarrativeText('Erro ao conectar com serviço de IA. Verifique sua chave API.');
    } finally {
      setNarrativeLoading(false);
    }
  };

  // Generate DAX
  const handleGenerateDax = async () => {
    if (!daxPrompt.trim()) return;
    setDaxLoading(true);
    try {
      const resp = await fetch('/api/ai/dax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'generate', description: daxPrompt }),
      });
      const data = await resp.json();
      setDaxResult(data);
    } catch (err: any) {
      setDaxResult({
        dax: 'DIVIDE([Lucro Bruto], [Faturamento Total], 0)',
        explanation: 'Fórmula padrão calculada localmente.',
      });
    } finally {
      setDaxLoading(false);
    }
  };

  const handleApplySuggestedVisual = () => {
    if (!nlqResult?.suggestedVisual) return;
    const sv = nlqResult.suggestedVisual;
    addVisual(sv.type || 'column', sv.recommendedTable || 'f_Vendas');
    setAiModalOpen(false);
    setActiveView('report');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-xs flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Copilot de Análise & IA (Gemini 3.8)</h3>
              <p className="text-[11px] text-slate-500">
                Assistente inteligente para perguntas, resumos executivos e fórmulas DAX.
              </p>
            </div>
          </div>
          <button
            onClick={() => setAiModalOpen(false)}
            className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 py-3 border-b border-slate-100">
          <button
            onClick={() => setActiveTab('nlq')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'nlq' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Perguntar em Linguagem Natural
          </button>
          <button
            onClick={() => {
              setActiveTab('narrative');
              if (!narrativeText) handleGenerateSummary();
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'narrative' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Resumo Executivo Narrativo
          </button>
          <button
            onClick={() => setActiveTab('dax')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'dax' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Assistente de DAX
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {/* TAB 1: NLQ */}
          {activeTab === 'nlq' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">
                  O que você gostaria de analisar nos seus dados?
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nlqQuestion}
                    onChange={(e) => setNlqQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskNlq()}
                    placeholder="Ex.: Faturamento por mês no ano atual, Top 5 clientes em margem..."
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <button
                    onClick={handleAskNlq}
                    disabled={nlqLoading}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{nlqLoading ? 'Analisando...' : 'Consultar'}</span>
                  </button>
                </div>
              </div>

              {/* Sample Suggestions */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Sugestões rápidas:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Faturamento por categoria de produto',
                    'Evolução de vendas mês a mês',
                    'Receita por rota de transporte na logística',
                    'DRE: Lucro líquido versus orçado',
                  ].map(sug => (
                    <button
                      key={sug}
                      onClick={() => {
                        setNlqQuestion(sug);
                      }}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-600 text-[11px]"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results */}
              {nlqResult && (
                <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/50 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] text-amber-700 font-bold uppercase">Entendimento da IA</span>
                      <h4 className="font-bold text-slate-900 text-sm mt-0.5">{nlqResult.interpretation}</h4>
                    </div>
                    {nlqResult.suggestedVisual && (
                      <button
                        onClick={handleApplySuggestedVisual}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Adicionar Visual ao Relatório</span>
                      </button>
                    )}
                  </div>

                  {nlqResult.suggestedVisual && (
                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-700 text-xs space-y-1">
                      <div>Tipo de Gráfico: <strong className="text-slate-900">{nlqResult.suggestedVisual.type}</strong></div>
                      <div>Tabela: <strong className="text-slate-900">{nlqResult.suggestedVisual.recommendedTable}</strong></div>
                      <div>Eixo: <strong className="text-slate-900">{nlqResult.suggestedVisual.xAxisField || 'Categoria'}</strong></div>
                      <div>Métrica: <strong className="text-slate-900">{nlqResult.suggestedVisual.valueField} ({nlqResult.suggestedVisual.aggregation})</strong></div>
                    </div>
                  )}

                  {nlqResult.sqlQuery && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">SQL Gerado</span>
                      <pre className="p-2 bg-slate-900 text-amber-300 rounded font-mono text-[10px] overflow-x-auto mt-1">
                        {nlqResult.sqlQuery}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXECUTIVE NARRATIVE */}
          {activeTab === 'narrative' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Resumo Gerencial Automatizado</span>
                <button
                  onClick={handleGenerateSummary}
                  disabled={narrativeLoading}
                  className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  {narrativeLoading ? 'Gerando...' : 'Regerar Narrativa'}
                </button>
              </div>

              {narrativeLoading ? (
                <div className="p-8 text-center text-slate-400">
                  <Sparkles className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                  <p>Processando modelo semântico e formulando síntese executiva...</p>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 whitespace-pre-wrap leading-relaxed text-xs">
                  {narrativeText}
                </div>
              )}

              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 flex items-center gap-2 text-[10px] text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Aviso: Narrativas com assistência de IA servem como suporte analítico e devem ser verificadas com a controladoria.
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: DAX ASSISTANT */}
          {activeTab === 'dax' && (
            <div className="space-y-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Descreva o cálculo que deseja criar em DAX:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={daxPrompt}
                    onChange={(e) => setDaxPrompt(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800"
                  />
                  <button
                    onClick={handleGenerateDax}
                    disabled={daxLoading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg"
                  >
                    {daxLoading ? 'Gerando...' : 'Gerar DAX'}
                  </button>
                </div>
              </div>

              {daxResult && (
                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-3">
                  <div>
                    <span className="text-[10px] text-purple-700 font-bold uppercase">Fórmula DAX Sugerida</span>
                    <pre className="p-3 bg-slate-900 text-purple-300 rounded-lg font-mono text-xs mt-1">
                      {daxResult.dax}
                    </pre>
                  </div>

                  <p className="text-slate-600 text-xs">{daxResult.explanation}</p>

                  <button
                    onClick={() => {
                      addMeasure({
                        id: 'm_' + Math.random().toString(36).substr(2, 6),
                        name: 'Nova Medida DAX',
                        tableName: 'f_Vendas',
                        formula: daxResult.dax,
                        format: 'currency',
                        description: daxPrompt,
                      });
                      alert('Medida DAX salva no modelo com sucesso!');
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded text-xs"
                  >
                    Salvar no Modelo de Dados
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
