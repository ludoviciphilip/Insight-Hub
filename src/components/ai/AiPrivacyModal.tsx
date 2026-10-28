import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { recordPrivacyConsent } from '../../services/aiConfig';

interface AiPrivacyModalProps {
  isOpen: boolean;
  payloadPreview: any;
  onConfirm: () => void;
  onDecline: () => void;
}

export const AiPrivacyModal: React.FC<AiPrivacyModalProps> = ({
  isOpen,
  payloadPreview,
  onConfirm,
  onDecline,
}) => {
  const [showJson, setShowJson] = useState(false);
  const [neverAskAgain, setNeverAskAgain] = useState(false);

  if (!isOpen) return null;

  const handleAccept = () => {
    recordPrivacyConsent(true, neverAskAgain);
    onConfirm();
  };

  const handleRefuse = () => {
    recordPrivacyConsent(false, neverAskAgain);
    onDecline();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-xs flex flex-col max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2 text-indigo-600">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-bold text-slate-900 text-sm">Confirmação de Privacidade (Gemini BYOK)</h3>
          </div>
          <button
            onClick={handleRefuse}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-slate-700 leading-relaxed text-xs">
            Estes dados serão enviados diretamente à API do Gemini usando a <strong>sua chave de API</strong>:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
            <li>Nomes das tabelas e esquemas</li>
            <li>Nomes e tipos de dados das colunas</li>
            <li>Medidas DAX cadastradas</li>
            <li>O texto da sua pergunta ou instrução</li>
          </ul>
          <p className="text-[11px] text-slate-500 italic">
            Nenhum dado das linhas de dados confidenciais é enviado além do resumo estrutural necessário para o modelo.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowJson(!showJson)}
              className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium text-xs underline"
            >
              {showJson ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showJson ? 'Ocultar dados que serão enviados' : 'Ver o que será enviado (JSON)'}
            </button>

            {showJson && (
              <div className="mt-2 p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-48 border border-slate-800 select-all">
                <pre>{JSON.stringify(payloadPreview, null, 2)}</pre>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={neverAskAgain}
                onChange={(e) => setNeverAskAgain(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-slate-700 text-xs font-medium">
                Lembrar minha decisão e não perguntar novamente
              </span>
            </label>
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleRefuse}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
          >
            Usar resposta local (sem IA)
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-sm inline-flex items-center gap-1.5"
          >
            <span>Prosseguir com Gemini</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
