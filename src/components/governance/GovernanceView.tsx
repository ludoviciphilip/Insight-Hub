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
  User,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { formatCurrency } from '../../engine/dataEngine';
import { CalculationGroup, CalculationItem } from '../../types/bi';

export const GovernanceView: React.FC = () => {
  const {
    rlsRoles,
    activeRole,
    setActiveRole,
    activeUser,
    setActiveUser,
    calculationGroups,
    setCalculationGroups,
    whatIfParameters,
    updateWhatIfValue,
    performanceMetrics,
  } = useBiStore();

  const [activeTab, setActiveTab] = useState<'rls' | 'calcgroups' | 'performance' | 'pipeline' | 'whatif'>('rls');
  const [pipelineStage, setPipelineStage] = useState<'dev' | 'test' | 'prod'>('dev');

  // Calculation Group state
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupPrecedence, setNewGroupPrecedence] = useState('10');

  const handleAddDefaultCalcGroup = () => {
    const timeIntelGroup: CalculationGroup = {
      id: `cg_time_intel_${Date.now()}`,
      name: 'Análise Temporal',
      precedence: 20,
      columnName: 'Cálculo Temporal',
      description: 'Inteligência de tempo dinâmica com SELECTEDMEASURE()',
      calculationItems: [
        {
          id: 'ci_atual',
          name: 'Atual',
          expression: 'SELECTEDMEASURE()',
          ordinal: 0,
        },
        {
          id: 'ci_ytd',
          name: 'YTD',
          expression: 'TOTALYTD(SELECTEDMEASURE(), d_Calendario[Data])',
          ordinal: 1,
        },
        {
          id: 'ci_py',
          name: 'Ano Anterior (PY)',
          expression: 'CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR(d_Calendario[Data]))',
          ordinal: 2,
        },
        {
          id: 'ci_yoy_pct',
          name: 'Crescimento YoY %',
          expression: 'DIVIDE(SELECTEDMEASURE() - CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR(d_Calendario[Data])), CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR(d_Calendario[Data])), 0)',
          formatStringExpression: '"0.0%"',
          ordinal: 3,
        },
      ],
    };
    setCalculationGroups([...calculationGroups, timeIntelGroup]);
  };

  const handleDeleteCalcGroup = (groupId: string) => {
    setCalculationGroups(calculationGroups.filter(g => g.id !== groupId));
  };

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
              <span>Segurança RLS / OLS & Usuário</span>
            </button>
            <button
              onClick={() => setActiveTab('calcgroups')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                activeTab === 'calcgroups' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Calculation Groups</span>
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

      {/* TAB 1: RLS & USER SECURITY */}
      {activeTab === 'rls' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Segurança em Nível de Linha (RLS) & Objeto (OLS)</h2>
              <p className="text-slate-500 text-[11px]">
                Defina permissões por papel. Use o modo "Exibir como Função/Usuário" para simular a visualização de usuários restritos e validar funções DAX de segurança.
              </p>
            </div>

            {/* Test as Role Banner */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
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
                    className={`px-3 py-1 rounded font-bold text-xs transition-all ${
                      activeRole === null ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-white border text-slate-700'
                    }`}
                  >
                    Admin Geral
                  </button>
                  {rlsRoles.map(role => (
                    <button
                      key={role.id}
                      onClick={() => setActiveRole(role.id)}
                      className={`px-3 py-1 rounded font-bold text-xs transition-all ${
                        activeRole === role.id ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-white border text-slate-700'
                      }`}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* User Simulation Tokens */}
              <div className="pt-2 border-t border-amber-200/60 grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">USERNAME()</label>
                  <input
                    type="text"
                    value={activeUser.username}
                    onChange={(e) => setActiveUser({ ...activeUser, username: e.target.value })}
                    className="w-full mt-1 p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                    placeholder="Admin"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">USERPRINCIPALNAME()</label>
                  <input
                    type="text"
                    value={activeUser.userPrincipalName}
                    onChange={(e) => setActiveUser({ ...activeUser, userPrincipalName: e.target.value })}
                    className="w-full mt-1 p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                    placeholder="admin@insighthub.local"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">USERCULTURE()</label>
                  <input
                    type="text"
                    value={activeUser.userCulture}
                    onChange={(e) => setActiveUser({ ...activeUser, userCulture: e.target.value })}
                    className="w-full mt-1 p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                    placeholder="pt-BR"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">CUSTOMDATA()</label>
                  <input
                    type="text"
                    value={activeUser.customData}
                    onChange={(e) => setActiveUser({ ...activeUser, customData: e.target.value })}
                    className="w-full mt-1 p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                    placeholder="Ex: filial=SP"
                  />
                </div>
              </div>
            </div>

            {/* Registered Roles */}
            <div className="space-y-3">
              {rlsRoles.map(role => (
                <div key={role.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm">{role.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded">
                        DAX RLS Permanente
                      </span>
                      {role.olsRules && role.olsRules.length > 0 && (
                        <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <Lock className="w-3 h-3" /> OLS Ativo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {role.rules.map((rule, idx) => (
                      <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700">
                        Tabela: <strong className="text-slate-900">{rule.tableId}</strong> ➔ Filtro DAX Permanente: <span className="text-amber-700 font-bold">{rule.filterExpression}</span>
                      </div>
                    ))}
                    {role.olsRules?.map((ols, idx) => (
                      <div key={`ols_${idx}`} className="p-2 rounded bg-rose-50/50 border border-rose-200 font-mono text-[11px] text-rose-800">
                        OLS: Tabela <strong className="text-slate-900">{ols.tableId}</strong> {ols.column ? `➔ Coluna [${ols.column}]` : ''} ➔ Acesso: <span className="font-bold text-rose-700">{ols.access === 'none' ? 'Bloqueado (Oculto)' : 'Permitido'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CALCULATION GROUPS */}
      {activeTab === 'calcgroups' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">Grupos de Cálculo (Calculation Groups)</h2>
                <p className="text-slate-500 text-[11px]">
                  Crie itens de cálculo que aplicam fórmulas reutilizáveis como SELECTEDMEASURE(), Inteligência de Tempo e formatação dinâmica com controle de precedência.
                </p>
              </div>
              <button
                onClick={handleAddDefaultCalcGroup}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded font-bold shadow-xs hover:bg-purple-700"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Grupo Modelo (Inteligência Temporal)</span>
              </button>
            </div>

            {calculationGroups.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
                <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="font-bold text-slate-700">Nenhum Grupo de Cálculo Criado</div>
                <p className="text-slate-500 text-xs max-w-md mx-auto">
                  Grupos de cálculo reduzem a proliferação de medidas redundantes no modelo permitindo calcular Variação YoY, YTD e MoM dinamicamente em qualquer métrica base.
                </p>
                <button
                  onClick={handleAddDefaultCalcGroup}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold text-xs"
                >
                  Criar Modelo "Análise Temporal" (YTD, PY, YoY %)
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {calculationGroups.map(group => (
                  <div key={group.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-purple-600" />
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{group.name}</div>
                          <div className="text-[11px] text-slate-500">
                            Coluna de Grupo: <span className="font-mono text-purple-700 font-bold">{group.columnName || 'Calculation Item'}</span> | Precedência: <span className="font-bold text-slate-800">{group.precedence}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCalcGroup(group.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                        title="Excluir Grupo de Cálculo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px]">
                          <tr>
                            <th className="p-2.5">Ordinal</th>
                            <th className="p-2.5">Item de Cálculo</th>
                            <th className="p-2.5">Expressão DAX (SELECTEDMEASURE)</th>
                            <th className="p-2.5">Formatação Dinâmica</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {group.calculationItems.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-2.5 text-slate-500 font-sans">{item.ordinal ?? idx}</td>
                              <td className="p-2.5 font-bold text-slate-900 font-sans">{item.name}</td>
                              <td className="p-2.5 text-purple-700 font-semibold">{item.expression}</td>
                              <td className="p-2.5 text-slate-600 font-sans">{item.formatStringExpression || 'Padrão da Medida'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: WHAT-IF PARAMETERS */}
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
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{param.name}</span>
                      <span className="text-[10px] text-slate-400 ml-2">ID: {param.id}</span>
                    </div>
                    <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                      {param.currentValue} {param.unit}
                    </span>
                  </div>

                  <div>
                    <input
                      type="range"
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      value={param.currentValue}
                      onChange={(e) => updateWhatIfValue(param.id, parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>{param.min} {param.unit}</span>
                      <span>Passo: {param.step}</span>
                      <span>{param.max} {param.unit}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PERFORMANCE ANALYZER */}
      {activeTab === 'performance' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Performance Analyzer</h2>
              <p className="text-slate-500 text-[11px]">
                Monitore o tempo de execução de consultas DAX e renderização visual para otimizar modelos complexos.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              {performanceMetrics.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Nenhuma métrica capturada ainda. Interaja com os visuais no Relatório para gerar dados de telemetria.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 font-bold text-slate-500 text-[10px] border-b pb-2">
                    <span>Visual</span>
                    <span>Tempo de Consulta (DAX)</span>
                    <span>Tempo de Render</span>
                    <span>Linhas Retornadas</span>
                  </div>
                  {performanceMetrics.map((metric, idx) => (
                    <div key={idx} className="grid grid-cols-4 items-center text-slate-700 py-1.5 border-b border-slate-100 last:border-none">
                      <span className="font-bold text-slate-900 truncate">{metric.visualTitle}</span>
                      <span className="font-mono text-emerald-600 font-bold">{metric.queryTimeMs} ms</span>
                      <span className="font-mono text-blue-600">{metric.renderTimeMs} ms</span>
                      <span className="text-slate-500">{metric.rowCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PIPELINES ALM */}
      {activeTab === 'pipeline' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Pipelines de Implantação (ALM)</h2>
              <p className="text-slate-500 text-[11px]">
                Gerencie o ciclo de vida do modelo semântico entre Desenvolvimento, Teste e Produção.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {(['dev', 'test', 'prod'] as const).map(stage => (
                <div
                  key={stage}
                  className={`bg-white rounded-xl border p-4 shadow-xs space-y-3 ${
                    pipelineStage === stage ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700">
                      {stage === 'dev' ? 'Desenvolvimento' : stage === 'test' ? 'Homologação' : 'Produção'}
                    </span>
                    {pipelineStage === stage && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-1">
                    <div>Versão: <strong>2.1.0</strong></div>
                    <div>Status: <span className="text-emerald-600 font-bold">Sincronizado</span></div>
                  </div>
                  <button
                    onClick={() => setPipelineStage(stage)}
                    className="w-full py-1.5 rounded font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                  >
                    Promover para esta Fase
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
