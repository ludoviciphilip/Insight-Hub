import React from 'react';
import { Info, AlertTriangle, ShieldAlert, CheckCircle2, Server, BrainCircuit } from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';

export const LimitationsModal: React.FC = () => {
  const { limitationsModalOpen, setLimitationsModalOpen } = useBiStore();

  if (!limitationsModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 text-xs flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Transparência & Limitações do Sistema</h3>
              <p className="text-[11px] text-slate-500">
                Orientações essenciais para governança e uso responsável da plataforma.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLimitationsModalOpen(false)}
            className="text-slate-400 hover:text-slate-700 font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Content Items */}
        <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-900 text-xs">Não é um ERP nem Sistema Fiscal/Contábil</h4>
              <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                O InsightHub é uma ferramenta analítica de suporte à decisão (Business Intelligence). Os números gerados não substituem demonstrações contábeis oficiais registradas nem livros fiscais regulatórios.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex gap-3">
            <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-900 text-xs">Qualidade de Dados de Origem ("Garbage in, Garbage out")</h4>
              <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                A aplicação processa estritamente os dados importados. Inconsistências, valores nulos ou cadastros duplicados nas fontes originais impactarão os relatórios até que sejam saneados via Power Query.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex gap-3">
            <Server className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-900 text-xs">Conexões a Bancos On-Premises & Gateway</h4>
              <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                Por rodar no navegador do cliente (sandbox web), a conexão com bancos SQL Server, Oracle ou redes corporativas privadas requer um serviço de Gateway de dados proxy configurado.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex gap-3">
            <BrainCircuit className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-900 text-xs">Validação de Resultados de Inteligência Artificial</h4>
              <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                Fórmulas DAX, narrativas executivas e interpretações geradas por IA devem ser sempre revisadas e auditadas por analistas e controladores antes de deliberações de investimento.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={() => setLimitationsModalOpen(false)}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
