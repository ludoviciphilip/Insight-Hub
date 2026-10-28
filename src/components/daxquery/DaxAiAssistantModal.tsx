import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Check,
  AlertCircle,
  Play,
  BookOpen,
  Zap,
  Lightbulb,
  Settings,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { DaxEngine } from '../../engine/daxEngine';
import { globalDataEngine } from '../../engine/dataEngine';
import { formatNumber } from '../../engine/shared/formatter';
import { daxAssist } from '../../services/aiClient';
import { hasConfiguredApiKey, shouldPromptPrivacyConsent } from '../../services/aiConfig';
import { AiPrivacyModal } from '../ai/AiPrivacyModal';

interface DaxAiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormula?: string;
  onApplyFormula?: (formula: string, measureName?: string) => void;
}

export const DaxAiAssistantModal: React.FC<DaxAiAssistantModalProps> = ({
  isOpen,
  onClose,
  initialFormula = '',
  onApplyFormula,
}) => {
  const { tables, measures, addMeasure, setAiSettingsModalOpen } = useBiStore();

  const [task, setTask] = useState<'generate' | 'explain' | 'optimize'>('generate');
  const [description, setDescription] = useState('');
  const [formula, setFormula] = useState(initialFormula);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // AI Response state
  const [aiResponse, setAiResponse] = useState<{
    suggestedMeasureName?: string;
    targetTable?: string;
    dax?: string;
    explanation?: string;
    performanceTips?: string;
    source?: 'gemini' | 'local';
    fallbackReason?: string;
  } | null>(null);

  // Test validation state
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error?: string;
    testEvaluated?: any;
    tested: boolean;
  }>({ valid: false, tested: false });

  // Privacy modal state
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [pendingRun, setPendingRun] = useState<(() => Promise<void>) | null>(null);
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  if (!isOpen) return null;

  const doRunAi = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setAiResponse(null);
    setValidationResult({ valid: false, tested: false });
    setLoading(true);

    try {
      const schemaSummary = tables
        .map(t => `${t.name} (${t.columns.map(c => c.name).join(', ')})`)
        .join('; ');

      const data = await daxAssist(
        {
          task,
          description: task === 'generate' ? description : undefined,
          existingFormula: formula,
          schemaContext: schemaSummary,
        },
        tables,
        measures
      );

      setAiResponse(data);

      // Validate formula with DAX Engine Parser and execute test run
      const returnedDax = data.dax || '';
      if (returnedDax) {
        const val = DaxEngine.validate(returnedDax, tables, measures);
        if (!val.isValid) {
          setValidationResult({
            valid: false,
            error: val.errorMessage,
            tested: true,
          });
        } else {
          // Test calculation on current model
          try {
            const testVal = DaxEngine.evaluateWithContext(returnedDax, globalDataEngine);
            setValidationResult({
              valid: true,
              testEvaluated: testVal,
              tested: true,
            });
          } catch (evalErr: any) {
            setValidationResult({
              valid: false,
              error: `Erro ao calcular teste: ${evalErr.message}`,
              tested: true,
            });
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar consulta DAX.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAi = async () => {
    const payload = {
      tipo: 'Assistente DAX',
      tarefa: task,
      descricao: description,
      formulaExistente: formula,
      schema: tables.map(t => t.name),
    };

    if (hasConfiguredApiKey() && shouldPromptPrivacyConsent()) {
      setPendingPayload(payload);
      setPendingRun(() => doRunAi);
      setPrivacyModalOpen(true);
      return;
    }

    await doRunAi();
  };

  const handleApplyToModel = () => {
    if (!aiResponse?.dax) return;

    const measureName = aiResponse.suggestedMeasureName || 'Nova Medida IA';
    const targetTable = aiResponse.targetTable || tables[0]?.name || 'f_Vendas';

    addMeasure({
      id: `msr_ai_${Date.now()}`,
      name: measureName,
      tableName: targetTable,
      formula: aiResponse.dax,
      format: 'number',
      description: aiResponse.explanation || 'Medida gerada com Assistente DAX',
    });

    setSuccessMsg(`Medida "[${measureName}]" adicionada com sucesso ao modelo!`);

    if (onApplyFormula) {
      onApplyFormula(aiResponse.dax, measureName);
    }
  };

  const handleInsertInEditor = () => {
    if (aiResponse?.dax && onApplyFormula) {
      onApplyFormula(aiResponse.dax, aiResponse.suggestedMeasureName);
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-indigo-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Assistente DAX</h2>
                <p className="text-xs text-slate-500">
                  Gere, explique e otimize fórmulas DAX com validação sintática e teste prévio.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAiSettingsModalOpen(true)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-white font-medium inline-flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>Chave Gemini</span>
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Task Tabs */}
          <div className="px-6 py-2.5 border-b border-slate-200 bg-white flex items-center gap-2">
            <button
              onClick={() => setTask('generate')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                task === 'generate'
                  ? 'bg-amber-400 text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Gerar Medida
            </button>
            <button
              onClick={() => setTask('explain')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                task === 'explain'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Explicar Fórmula
            </button>
            <button
              onClick={() => setTask('optimize')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                task === 'optimize'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Otimizar DAX
            </button>
          </div>

          {/* Body Form */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {task === 'generate' ? (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  O que você deseja calcular em linguagem natural?
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Exemplo: Calcule a margem percentual dividindo o lucro pelo faturamento com tratamento de divisão por zero."
                  rows={3}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-amber-400 focus:bg-white"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Fórmula DAX a ser {task === 'explain' ? 'explicada' : 'otimizada'}:
                </label>
                <textarea
                  value={formula}
                  onChange={e => setFormula(e.target.value)}
                  placeholder="Exemplo: CALCULATE(SUM(f_Vendas[ValorTotal]), FILTER(ALL(f_Vendas), f_Vendas[Quantidade] > 10))"
                  rows={4}
                  className="w-full p-3 bg-slate-900 text-amber-300 font-mono text-xs rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleRunAi}
                disabled={loading || (task === 'generate' ? !description.trim() : !formula.trim())}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-md transition-colors"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {task === 'generate' ? 'Gerar e Validar Fórmula' : task === 'explain' ? 'Explicar' : 'Otimizar'}
                  </>
                )}
              </button>
            </div>

            {/* AI Output & Test Results Card */}
            {aiResponse && (
              <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
                {/* Source badge */}
                {aiResponse.source === 'local' ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] bg-amber-200 text-amber-900 border border-amber-400">
                        Resposta local (sem IA)
                      </span>
                      <span className="text-amber-800">
                        {aiResponse.fallbackReason === 'no_key'
                          ? 'Nenhuma chave Gemini configurada'
                          : `Fallback local: ${aiResponse.fallbackReason || 'heurística'}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAiSettingsModalOpen(true)}
                      className="text-indigo-700 font-semibold hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <Settings className="w-3 h-3" />
                      Configurar Chave
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] bg-indigo-200 text-indigo-900 border border-indigo-300">
                        Gemini AI
                      </span>
                      <span className="text-indigo-800">Gerado com o modelo Gemini via chave própria</span>
                    </div>
                  </div>
                )}

                {/* Header with Title and Verification Badge */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">
                      {aiResponse.suggestedMeasureName ? `[${aiResponse.suggestedMeasureName}]` : 'Fórmula Gerada'}
                    </h3>
                    {aiResponse.targetTable && (
                      <span className="text-xs text-slate-500">Tabela de destino sugerida: '{aiResponse.targetTable}'</span>
                    )}
                  </div>

                  {validationResult.tested && (
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 ${
                        validationResult.valid
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {validationResult.valid ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Sintaxe Válida
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5" /> Sintaxe Inválida
                        </>
                      )}
                    </span>
                  )}
                </div>

                {/* Code Box */}
                {aiResponse.dax && (
                  <div className="relative">
                    <pre className="p-3 bg-slate-900 text-amber-300 font-mono text-xs rounded-lg overflow-x-auto whitespace-pre-wrap">
                      {aiResponse.dax}
                    </pre>
                  </div>
                )}

                {/* Test Calculation Result */}
                {validationResult.tested && validationResult.valid && (
                  <div className="bg-white p-3.5 rounded-lg border border-emerald-200 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
                        Resultado do Teste no Modelo Atual
                      </span>
                      <span className="font-mono text-base font-bold text-slate-800">
                        {typeof validationResult.testEvaluated === 'number'
                          ? formatNumber(validationResult.testEvaluated)
                          : String(validationResult.testEvaluated ?? '(Em branco)')}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">Calculado com dados reais em memória</span>
                  </div>
                )}

                {/* Explanation & Performance Tips */}
                {aiResponse.explanation && (
                  <div className="text-xs text-slate-700 bg-white p-3.5 rounded-lg border border-slate-200">
                    <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> Explicação do Cálculo:
                    </h4>
                    <p className="leading-relaxed">{aiResponse.explanation}</p>
                  </div>
                )}

                {aiResponse.performanceTips && (
                  <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <span className="font-bold">Dica de Performance: </span>
                      {aiResponse.performanceTips}
                    </div>
                  </div>
                )}

                {/* Actions to apply */}
                {validationResult.valid && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={handleInsertInEditor}
                      className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg"
                    >
                      Inserir no Editor DAX
                    </button>
                    <button
                      onClick={handleApplyToModel}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Adicionar Medida ao Modelo
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>Validação de sintaxe e execução executadas diretamente no navegador.</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Privacy Consent Modal */}
      <AiPrivacyModal
        isOpen={privacyModalOpen}
        payloadPreview={pendingPayload}
        onConfirm={async () => {
          setPrivacyModalOpen(false);
          if (pendingRun) {
            await pendingRun();
            setPendingRun(null);
          }
        }}
        onDecline={async () => {
          setPrivacyModalOpen(false);
          if (pendingRun) {
            await pendingRun();
            setPendingRun(null);
          }
        }}
      />
    </>
  );
};
