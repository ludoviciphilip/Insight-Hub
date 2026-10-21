import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  GitBranch,
  Sliders,
  Users,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { formatCurrency } from '../../engine/dataEngine';

export const GovernanceView: React.FC = () => {
  const {
    rlsRoles,
    activeRole,
    setActiveRole,
    whatIfParameters,
    updateWhatIfValue,
    performanceMetrics,
  } = useBiStore();

  const [activeTab, setActiveTab] = useState<'rls' | 'performance' | 'pipeline' | 'whatif'>('rls');
  const [pipelineStage, setPipelineStage] = useState<'dev' | 'test' | 'prod'>('dev');

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden text-xs select-none">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 p-3 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-200/70 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('rls')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                activeTab === 'rls' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Segurança RLS (Row Level Security)</span>
            </button>
            <button
              onClick={() => setActiveTab('whatif')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                activeTab === 'whatif' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-4 h-4 text-amber-500" />
              <span>Parâmetros What-If (Hipotético)</span>
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                activeTab === 'performance' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>Performance Analyzer</span>
            </button>
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                activeTab === 'pipeline' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitBranch className="w-4 h-4 text-blue-600" />
              <span>Pipelines de Implantação (ALM)</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: RLS */}
      {activeTab === 'rls' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Segurança em Nível de Linha (RLS)</h2>
              <p className="text-slate-500 text-[11px]">
                Defina permissões por papel. Use o modo "Exibir como Função" para simular a visualização de usuários restritos.
              </p>
            </div>

            {/* Test as Role Banner */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                <div>
                  <div className="font-bold text-slate-800 text-xs">Simulação: Exibir como Função</div>
                  <div className="text-[11px] text-slate-600">
                    {activeRole ? `Papel ativo: ${activeRole}` : 'Modo Administrador (Acesso Irrestrito aos Dados)'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveRole(null)}
                  className={`px-3 py-1 rounded font-bold text-xs ${
                    activeRole === null ? 'bg-amber-500 text-slate-950' : 'bg-white border text-slate-700'
                  }`}
                >
                  Admin Geral
                </button>
                {rlsRoles.map(role => (
                  <button
                    key={role.id}
                    onClick={() => setActiveRole(role.id)}
                    className={`px-3 py-1 rounded font-bold text-xs ${
                      activeRole === role.id ? 'bg-amber-500 text-slate-950' : 'bg-white border text-slate-700'
                    }`}
                  >
                    {role.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Registered Roles */}
            <div className="space-y-3">
              {rlsRoles.map(role => (
                <div key={role.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm">{role.name}</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded">
                      RLS Estático
                    </span>
                  </div>
                  <div className="space-y-1">
                    {role.rules.map((rule, idx) => (
                      <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700">
                        Tabela: <strong className="text-slate-900">{rule.tableId}</strong> ➔ Filtro: <span className="text-amber-700 font-bold">{rule.filterExpression}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WHAT-IF PARAMETERS */}
      {activeTab === 'whatif' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Parâmetros Hipotéticos (What-If)</h2>
              <p className="text-slate-500 text-[11px]">
                Ajuste variáveis macroeconômicas ou metas operacionais com impacto dinâmico imediato nas projeções financeiras.
              </p>
            </div>

            <div className="space-y-4">
              {whatIfParameters.map(param => (
                <div key={param.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm">{param.name}</span>
                    <span className="text-base font-extrabold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      {param.currentValue > 0 ? `+${param.currentValue}` : param.currentValue} {param.unit}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={param.currentValue}
                    onChange={(e) => updateWhatIfValue(param.id, Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />

                  <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                    <span>Mín: {param.min}{param.unit}</span>
                    <span>Padrão: {param.defaultValue}{param.unit}</span>
                    <span>Máx: {param.max}{param.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PERFORMANCE ANALYZER */}
      {activeTab === 'performance' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Performance Analyzer</h2>
              <p className="text-slate-500 text-[11px]">
                Métricas de telemetria em tempo real para otimização de consultas SQL, fórmulas DAX e renderização visual.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 font-bold text-slate-700">Elemento / Visual</th>
                    <th className="px-4 py-2 font-bold text-slate-700 text-right">Tempo Consulta (DAX/SQL)</th>
                    <th className="px-4 py-2 font-bold text-slate-700 text-right">Renderização</th>
                    <th className="px-4 py-2 font-bold text-slate-700 text-right">Linhas Analisadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {performanceMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        Nenhuma consulta registrada nesta sessão.
                      </td>
                    </tr>
                  ) : (
                    performanceMetrics.map((metric, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-semibold text-slate-800">{metric.visualTitle}</td>
                        <td className="px-4 py-2 text-right font-mono text-emerald-600 font-bold">
                          {metric.queryTimeMs} ms
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-slate-600">{metric.renderTimeMs} ms</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-600">{metric.rowCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DEPLOYMENT PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-800">Pipelines de Implantação (ALM)</h2>
              <p className="text-slate-500 text-[11px]">
                Ciclo de vida de desenvolvimento: Desenvolvimento ➔ Homologação / Teste ➔ Produção.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { stage: 'dev', name: 'Desenvolvimento', desc: 'Workspace de criação e testes técnicos', status: 'Ativo (Atual)' },
                { stage: 'test', name: 'Homologação (Teste)', desc: 'Validação com usuários de negócio e analistas', status: 'Sincronizado' },
                { stage: 'prod', name: 'Produção Oficial', desc: 'Ambiente final certificado para diretoria', status: 'Publicado' },
              ].map(st => (
                <div
                  key={st.stage}
                  className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col justify-between ${
                    pipelineStage === st.stage ? 'border-amber-500 ring-2 ring-amber-400/30' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{st.name}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">
                        {st.status}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px]">{st.desc}</p>
                  </div>

                  <button
                    onClick={() => {
                      setPipelineStage(st.stage as any);
                      alert(`Ambiente alternado para: ${st.name}`);
                    }}
                    className="mt-4 w-full py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                  >
                    Promover para {st.name}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
