import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  PlusCircle,
  FileText,
  AlertCircle,
  CheckCircle2,
  Settings,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { askData, summarize, daxAssist } from '../../services/aiClient';
import { shouldPromptPrivacyConsent, hasConfiguredApiKey } from '../../services/aiConfig';
import { buildSafeSchema } from '../../services/aiSchema';
import { AiPrivacyModal } from './AiPrivacyModal';
import { globalDataEngine } from '../../engine/dataEngine';
import { DaxEngine } from '../../engine/daxEngine';

export const AiAssistantModal: React.FC = () => {
  const {
    aiModalOpen,
    setAiModalOpen,
    tables,
    measures,
    addVisual,
    setActiveView,
    addMeasure,
    setAiSettingsModalOpen,
  } = useBiStore();

  const [activeTab, setActiveTab] = useState<'nlq' | 'narrative' | 'dax'>('nlq');

  // NLQ state
  const [nlqQuestion, setNlqQuestion] = useState('Qual o faturamento total por categoria de produto?');
  const [nlqLoading, setNlqLoading] = useState(false);
  const [nlqResult, setNlqResult] = useState<any>(null);

  // Executive narrative state
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeResult, setNarrativeResult] = useState<any>(null);

  // DAX Copilot state
  const [daxPrompt, setDaxPrompt] = useState('Calcule a margem percentual de lucro dividindo o lucro bruto pelo faturamento');
  const [daxLoading, setDaxLoading] = useState(false);
  const [daxResult, setDaxResult] = useState<any>(null);
  const [measureSavedMsg, setMeasureSavedMsg] = useState('');

  // Privacy modal state
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  if (!aiModalOpen) return null;

  const executeWithPrivacyCheck = async (
    payload: any,
    action: () => Promise<void>
  ) => {
    if (hasConfiguredApiKey() && shouldPromptPrivacyConsent()) {
      setPendingPayload(payload);
      setPendingAction(() => action);
      setPrivacyModalOpen(true);
      return;
    }
    await action();
  };

  // Ask AI endpoint
  const doAskNlq = async () => {
    if (!nlqQuestion.trim()) return;
    setNlqLoading(true);
    setNlqResult(null);
    try {
      const res = await askData(nlqQuestion, buildSafeSchema(tables, measures), tables, measures);
      setNlqResult(res);
    } finally {
      setNlqLoading(false);
    }
  };

  const handleAskNlq = async () => {
    const payload = {
      tipo: 'Pergunta em Linguagem Natural',
      pergunta: nlqQuestion,
      schema: buildSafeSchema(tables, measures),
    };
    await executeWithPrivacyCheck(payload, doAskNlq);
  };

  // Generate Executive Summary from REAL dataset
  const doGenerateSummary = async () => {
    setNarrativeLoading(true);
    try {
      const datasetSummary = {
        totalTabelas: tables.length,
        tabelas: tables.map(t => ({
          name: t.name,
          rows: t.rows.length,
          columns: t.columns.map(c => c.name),
        })),
      };

      // Compute real metrics from existing measures or row counts
      const currentMetrics: Record<string, any> = {};
      measures.slice(0, 10).forEach(m => {
        try {
          const val = DaxEngine.evaluateWithContext(m.formula, globalDataEngine);
          currentMetrics[m.name] = val;
        } catch {
          currentMetrics[m.name] = 'Não avaliado';
        }
      });

      const res = await summarize(datasetSummary, currentMetrics, tables, measures);
      setNarrativeResult(res);
    } finally {
      setNarrativeLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    const payload = {
      tipo: 'Resumo Executivo do Dataset',
      tabelas: tables.map(t => ({ nome: t.name, totalLinhas: t.rows.length })),
      medidas: measures.map(m => m.name),
    };
    await executeWithPrivacyCheck(payload, doGenerateSummary);
  };

  // Generate DAX
  const doGenerateDax = async () => {
    if (!daxPrompt.trim()) return;
    setDaxLoading(true);
    setDaxResult(null);
    setMeasureSavedMsg('');
    try {
      const res = await daxAssist(
        {
          task: 'generate',
          description: daxPrompt,
          schemaContext: buildSafeSchema(tables, measures),
        },
        tables,
        measures
      );
      setDaxResult(res);
    } finally {
      setDaxLoading(false);
    }
  };

  const handleGenerateDax = async () => {
    const payload = {
      tipo: 'Assistente DAX',
      descricao: daxPrompt,
      schema: buildSafeSchema(tables, measures),
    };
    await executeWithPrivacyCheck(payload, doGenerateDax);
  };

  const handleApplySuggestedVisual = () => {
    if (!nlqResult?.suggestedVisual) return;
    const sv = nlqResult.suggestedVisual;
    addVisual(sv.type || 'column', sv.recommendedTable || tables[0]?.id || 'f_Vendas');
    setAiModalOpen(false);
    setActiveView('report');
  };

  const renderSourceBadge = (source?: 'gemini' | 'local', reason?: string) => {
    if (source === 'local') {
      const reasonLabel =
        reason === 'no_key'
          ? 'Nenhuma chave Gemini configurada'
          : reason?.startsWith('consent_declined')
          ? 'Envio à API recusado na confirmação'
          : `Executado localmente (${reason || 'fallback'})`;

      return (
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] mb-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] bg-amber-200 text-amber-900 border border-amber-400">
              Resposta local (sem IA)
            </span>
            <span className="text-amber-800">{reasonLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setAiSettingsModalOpen(true)}
            className="text-indigo-700 font-semibold hover:underline inline-flex items-center gap-1 shrink-0"
          >
            <Settings className="w-3.5 h-3.5" />
            Configurar Chave
          </button>
        </div>
      );
    }

    if (source === 'gemini') {
      return (
        <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] mb-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] bg-indigo-200 text-indigo-900 border border-indigo-300">
              Gemini AI
            </span>
            <span className="text-indigo-800">Processado via API Google Gemini com sua chave BYOK</span>
          </div>
          <button
            type="button"
            onClick={() => setAiSettingsModalOpen(true)}
            className="text-indigo-700 font-semibold hover:underline inline-flex items-center gap-1 shrink-0"
          >
            <Settings className="w-3 h-3" />
            Ajustar
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-xs flex flex-col max-h-[85vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Copilot de Análise & IA</h3>
                <p className="text-[11px] text-slate-500">
                  Assistente para consultas, resumos executivos e fórmulas DAX (chave BYOK ou heurística local).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAiSettingsModalOpen(true)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium inline-flex items-center gap-1.5 transition-colors"
                title="Configurar Chave Gemini"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>Chave Gemini</span>
              </button>
              <button
                onClick={() => setAiModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
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
                if (!narrativeResult) handleGenerateSummary();
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
                      placeholder="Ex.: Faturamento por mês no ano atual, Vendas por Categoria..."
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
                      'Distribuição por região geográfica',
                      'Total de quantidade vendida',
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
                  <div className="space-y-3">
                    {renderSourceBadge(nlqResult.source, nlqResult.fallbackReason)}

                    <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/50 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] text-amber-700 font-bold uppercase">Interpretação</span>
                          <h4 className="font-bold text-slate-900 text-sm mt-0.5">{nlqResult.interpretation}</h4>
                        </div>
                        {nlqResult.suggestedVisual && (
                          <button
                            onClick={handleApplySuggestedVisual}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-xs"
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
                    <p>Processando modelo semântico real e formulando síntese executiva...</p>
                  </div>
                ) : narrativeResult ? (
                  <div className="space-y-3">
                    {renderSourceBadge(narrativeResult.source, narrativeResult.fallbackReason)}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 whitespace-pre-wrap leading-relaxed text-xs">
                      {narrativeResult.summary}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    Clique em "Regerar Narrativa" para sintetizar o modelo atual.
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
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg disabled:opacity-50"
                    >
                      {daxLoading ? 'Gerando...' : 'Gerar DAX'}
                    </button>
                  </div>
                </div>

                {daxResult && (
                  <div className="space-y-3">
                    {renderSourceBadge(daxResult.source, daxResult.fallbackReason)}

                    <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-3">
                      <div>
                        <span className="text-[10px] text-purple-700 font-bold uppercase">Fórmula DAX Sugerida</span>
                        <pre className="p-3 bg-slate-900 text-purple-300 rounded-lg font-mono text-xs mt-1">
                          {daxResult.dax}
                        </pre>
                      </div>

                      <p className="text-slate-600 text-xs">{daxResult.explanation}</p>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={() => {
                            const measureName = daxResult.suggestedMeasureName || 'Nova Medida DAX';
                            const targetTbl = daxResult.targetTable || tables[0]?.name || 'f_Vendas';
                            addMeasure({
                              id: 'm_' + Math.random().toString(36).substr(2, 6),
                              name: measureName,
                              tableName: targetTbl,
                              formula: daxResult.dax,
                              format: 'currency',
                              description: daxPrompt,
                            });
                            setMeasureSavedMsg(`Medida "${measureName}" salva no modelo com sucesso!`);
                            setTimeout(() => setMeasureSavedMsg(''), 3000);
                          }}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded text-xs transition-colors"
                        >
                          Salvar no Modelo de Dados
                        </button>
                        {measureSavedMsg && (
                          <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {measureSavedMsg}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Privacy Confirmation Modal */}
      <AiPrivacyModal
        isOpen={privacyModalOpen}
        payloadPreview={pendingPayload}
        onConfirm={async () => {
          setPrivacyModalOpen(false);
          if (pendingAction) {
            await pendingAction();
            setPendingAction(null);
          }
        }}
        onDecline={async () => {
          setPrivacyModalOpen(false);
          // execute with refusal recorded
          if (pendingAction) {
            await pendingAction();
            setPendingAction(null);
          }
        }}
      />
    </>
  );
};
