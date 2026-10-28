import React, { useState, useEffect } from 'react';
import {
  Key,
  Shield,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
  Cpu,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import {
  getAiSettings,
  saveAiSettings,
  clearAiSettings,
  StorageType,
  DEFAULT_GEMINI_MODEL,
} from '../../services/aiConfig';
import { testConnectionAndListModels } from '../../services/aiClient';

export const AiSettingsModal: React.FC = () => {
  const { aiSettingsModalOpen, setAiSettingsModalOpen } = useBiStore();

  const [apiKey, setApiKey] = useState('');
  const [storageType, setStorageType] = useState<StorageType>('local');
  const [model, setModel] = useState<string>(DEFAULT_GEMINI_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Testing connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    models?: string[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (aiSettingsModalOpen) {
      const cfg = getAiSettings();
      setApiKey(cfg.apiKey);
      setStorageType(cfg.storageType);
      setModel(cfg.model || DEFAULT_GEMINI_MODEL);
      setSavedSuccess(false);
      setTestResult(null);
    }
  }, [aiSettingsModalOpen]);

  if (!aiSettingsModalOpen) return null;

  const currentSettings = getAiSettings();
  const hasKeyConfigured = Boolean(currentSettings.apiKey && currentSettings.apiKey.trim().length > 0);

  const getStatusBadge = () => {
    if (!hasKeyConfigured) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          Sem chave configurada (usando respostas locais)
        </span>
      );
    }
    if (currentSettings.storageType === 'session') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Chave configurada (armazenada em sessão)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Chave configurada (armazenada localmente)
      </span>
    );
  };

  const handleSave = () => {
    saveAiSettings({
      apiKey: apiKey.trim(),
      storageType,
      model: model.trim() || DEFAULT_GEMINI_MODEL,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleRemoveKey = () => {
    clearAiSettings();
    setApiKey('');
    setTestResult(null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleTestConnection = async () => {
    const keyToTest = apiKey.trim() || currentSettings.apiKey;
    if (!keyToTest) {
      setTestResult({
        success: false,
        error: 'Informe uma chave de API para testar a conexão.',
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConnectionAndListModels(keyToTest, model);
      setTestResult(res);
      if (res.success && apiKey.trim()) {
        // Automatically save working key
        saveAiSettings({
          apiKey: apiKey.trim(),
          storageType,
          model: model.trim() || DEFAULT_GEMINI_MODEL,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Falha ao conectar à API.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 text-xs flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Configuração de IA (Gemini BYOK)</h2>
              <p className="text-[11px] text-slate-500">
                Traga sua própria chave de API (Bring Your Own Key) para consultas e DAX inteligente.
              </p>
            </div>
          </div>
          <button
            onClick={() => setAiSettingsModalOpen(false)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status banner */}
        <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[11px] font-medium text-slate-600">Status atual:</span>
          {getStatusBadge()}
        </div>

        {/* Security / Privacy Warning */}
        <div className="mt-4 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950 mb-1">Privacidade & Arquitetura Descentralizada:</p>
              <p>
                Sua chave de API fica armazenada localmente em texto no navegador (no armazenamento escolhido por você)
                e nunca passa por um servidor central do InsightHub. Recomendamos gerar uma chave dedicada com restrições
                e cota reduzida no Google AI Studio. As requisições são enviadas diretamente do seu navegador aos servidores
                da Google, sem intermediários.
              </p>
            </div>
          </div>
        </div>

        {/* API Key Form */}
        <div className="mt-5 space-y-4">
          <div>
            <label className="block font-semibold text-slate-800 text-[11px] mb-1.5">
              Chave de API do Google Gemini
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Ex.: AIzaSy..."
                className="w-full pl-3 pr-20 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
                  title={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
              <span>Não possui uma chave? Obtenha gratuitamente no Google AI Studio.</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline inline-flex items-center gap-0.5"
              >
                Gerar chave no AI Studio <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* Storage selector */}
          <div>
            <label className="block font-semibold text-slate-800 text-[11px] mb-1.5">
              Onde armazenar a chave
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  storageType === 'local'
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="storageType"
                  value="local"
                  checked={storageType === 'local'}
                  onChange={() => setStorageType('local')}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <div className="font-semibold text-[11px]">Lembrar neste navegador</div>
                  <div className="text-[10px] text-slate-500">
                    Salva no localStorage. Persiste mesmo após fechar o navegador.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  storageType === 'session'
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="storageType"
                  value="session"
                  checked={storageType === 'session'}
                  onChange={() => setStorageType('session')}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <div className="font-semibold text-[11px]">Apenas nesta sessão</div>
                  <div className="text-[10px] text-slate-500">
                    Salva no sessionStorage. Limpa automaticamente ao fechar a aba.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block font-semibold text-slate-800 text-[11px] mb-1.5">
              Modelo Gemini
            </label>
            <div className="flex gap-2">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="gemini-3.8-flash">gemini-3.8-flash (Recomendado - Ultra rápido)</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash (Versátil)</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro (Raciocínio complexo)</option>
              </select>
            </div>
          </div>

          {/* Test connection result */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-[11px] ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Conexão bem-sucedida! Latência: {testResult.latencyMs}ms</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Falha na verificação da chave</span>
                  </>
                )}
              </div>
              {testResult.error && <p className="mt-1 text-[10px]">{testResult.error}</p>}
              {testResult.models && testResult.models.length > 0 && (
                <div className="mt-2 text-[10px]">
                  <span className="font-semibold">Modelos disponíveis:</span>{' '}
                  {testResult.models.slice(0, 5).join(', ')}
                  {testResult.models.length > 5 ? ` (+${testResult.models.length - 5})` : ''}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {hasKeyConfigured && (
              <button
                type="button"
                onClick={handleRemoveKey}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-medium text-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover chave
              </button>
            )}
            <button
              type="button"
              disabled={testing || (!apiKey.trim() && !hasKeyConfigured)}
              onClick={handleTestConnection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testando...' : 'Testar conexão'}
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {savedSuccess && (
              <span className="text-emerald-700 text-xs font-medium inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Salvo com sucesso!
              </span>
            )}
            <button
              type="button"
              onClick={() => setAiSettingsModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium text-xs transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-medium text-xs hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Salvar alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
