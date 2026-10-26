import React, { useState, useMemo } from 'react';
import {
  BarChart,
  BarChart2,
  LineChart,
  PieChart,
  Grid,
  Hash,
  Table as TableIcon,
  Sliders,
  Filter,
  Eye,
  Palette,
  Layers,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { VisualType, Visual } from '../../types/bi';
import { useBiStore } from '../../store/useBiStore';
import { useTranslation } from '../../i18n';

const visualTypes: { type: VisualType; label: string; icon: any }[] = [
  { type: 'column', label: 'Colunas', icon: BarChart },
  { type: 'stacked-column', label: 'Colunas Empilhadas', icon: BarChart2 },
  { type: 'bar', label: 'Barras', icon: BarChart },
  { type: 'line', label: 'Linhas', icon: LineChart },
  { type: 'area', label: 'Área', icon: TrendingUp },
  { type: 'pie', label: 'Pizza', icon: PieChart },
  { type: 'donut', label: 'Rosca', icon: PieChart },
  { type: 'treemap', label: 'Treemap', icon: Grid },
  { type: 'waterfall', label: 'Cascata', icon: BarChart2 },
  { type: 'funnel', label: 'Funil', icon: Filter },
  { type: 'card', label: 'Cartão KPI', icon: Hash },
  { type: 'table', label: 'Tabela', icon: TableIcon },
  { type: 'slicer', label: 'Segmentador', icon: Sliders },
];

export const VisualizationsPane: React.FC = () => {
  const { t } = useTranslation();
  const { pages, activePageId, selectedVisualId, updateVisual, tables, measures, relationships } = useBiStore();
  const [activeTab, setActiveTab] = useState<'build' | 'format'>('build');

  const activePage = pages.find(p => p.id === activePageId);
  const selectedVisual = activePage?.visuals.find(v => v.id === selectedVisualId);

  const selectedTable = useMemo(() => {
    if (!selectedVisual) return undefined;
    return tables.find(t => t.id === selectedVisual.dataConfig.tableId);
  }, [tables, selectedVisual]);

  const relatedTables = useMemo(() => {
    if (!selectedTable || !relationships) return [];
    const relTableIds = new Set<string>();
    relationships.forEach(r => {
      if (!r.isActive) return;
      if (r.fromTable === selectedTable.id || r.fromTable === selectedTable.name) {
        relTableIds.add(r.toTable);
      } else if (r.toTable === selectedTable.id || r.toTable === selectedTable.name) {
        relTableIds.add(r.fromTable);
      }
    });
    return tables.filter(t => t.id !== selectedTable.id && (relTableIds.has(t.id) || relTableIds.has(t.name)));
  }, [selectedTable, relationships, tables]);

  const fieldLabels = useMemo(() => {
    if (!selectedVisual) {
      return {
        categoryLabel: 'Eixo X / Categorias',
        categorySubtitle: undefined,
        categoryPlaceholder: '(Selecione a coluna)',
        showCategory: true,
        valueLabel: 'Eixo Y / Valores',
        valueSubtitle: undefined,
        valuePlaceholder: '(Selecione métrica)',
        showSeriesBreakdown: true,
      };
    }
    switch (selectedVisual.type) {
      case 'pie':
      case 'donut':
        return {
          categoryLabel: 'Legenda (Fatias)',
          categorySubtitle: 'Campo para categorizar as fatias da pizza/rosca',
          categoryPlaceholder: '(Selecione a coluna da Legenda)',
          showCategory: true,
          valueLabel: 'Valores',
          valueSubtitle: 'Métrica ou medida para dimensionar as fatias',
          valuePlaceholder: '(Selecione métrica ou medida)',
          showSeriesBreakdown: false,
        };

      case 'treemap':
      case 'funnel':
        return {
          categoryLabel: 'Categoria',
          categorySubtitle: 'Campo para agrupar as seções',
          categoryPlaceholder: '(Selecione a categoria)',
          showCategory: true,
          valueLabel: 'Valores',
          valueSubtitle: 'Métrica ou medida para dimensionar as seções',
          valuePlaceholder: '(Selecione métrica ou medida)',
          showSeriesBreakdown: false,
        };

      case 'card':
      case 'kpi':
      case 'gauge':
        return {
          categoryLabel: '',
          categoryPlaceholder: '',
          showCategory: false,
          valueLabel: 'Campo de Valor',
          valueSubtitle: 'Indicador numérico ou medida DAX principal',
          valuePlaceholder: '(Selecione métrica ou medida)',
          showSeriesBreakdown: false,
        };

      case 'bar':
      case 'stacked-bar':
        return {
          categoryLabel: 'Eixo Y / Categorias',
          categorySubtitle: 'Campo categórico para as barras horizontais',
          categoryPlaceholder: '(Selecione a coluna de categorias)',
          showCategory: true,
          valueLabel: 'Eixo X / Valores',
          valueSubtitle: 'Métrica ou medida para o comprimento das barras',
          valuePlaceholder: '(Selecione métrica ou medida)',
          showSeriesBreakdown: true,
        };

      case 'scatter':
        return {
          categoryLabel: 'Eixo X (Numérico)',
          categorySubtitle: 'Campo numérico para dispersão horizontal',
          categoryPlaceholder: '(Selecione o campo do eixo X)',
          showCategory: true,
          valueLabel: 'Eixo Y (Numérico)',
          valueSubtitle: 'Campo numérico para dispersão vertical',
          valuePlaceholder: '(Selecione o campo do eixo Y)',
          showSeriesBreakdown: false,
        };

      default: // column, stacked-column, line, area, waterfall
        return {
          categoryLabel: 'Eixo X / Categorias',
          categorySubtitle: 'Campo para o eixo horizontal',
          categoryPlaceholder: '(Selecione a coluna do eixo X)',
          showCategory: true,
          valueLabel: 'Eixo Y / Valores',
          valueSubtitle: 'Métrica ou medida para a altura/valores',
          valuePlaceholder: '(Selecione métrica ou medida)',
          showSeriesBreakdown: true,
        };
    }
  }, [selectedVisual?.type]);

  if (!selectedVisual) {
    return (
      <div className="w-64 border-l border-slate-200 bg-white flex flex-col h-full text-xs">
        <div className="p-3 border-b border-slate-200 font-semibold text-slate-700 bg-slate-50 flex items-center justify-between">
          <span>{t.panes.visualizations.title}</span>
        </div>
        <div className="p-3 grid grid-cols-4 gap-1.5 border-b border-slate-200">
          {visualTypes.map(v => {
            const Icon = v.icon;
            return (
              <div
                key={v.type}
                title={v.label}
                className="flex flex-col items-center justify-center p-2 rounded border border-slate-200 bg-slate-50/60 text-slate-400 opacity-60"
              >
                <Icon className="w-4 h-4" />
              </div>
            );
          })}
        </div>
        <div className="p-4 text-center text-slate-400 flex flex-col items-center justify-center flex-1">
          <Layers className="w-8 h-8 mb-2 text-slate-300" />
          <p className="font-medium text-slate-600">Nenhum visual selecionado</p>
          <p className="text-[11px] text-slate-400 mt-1">Clique em um elemento do relatório para configurar eixos e formatação.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-68 border-l border-slate-200 bg-white flex flex-col h-full text-xs select-none shadow-xs">
      {/* Pane Header */}
      <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between font-semibold text-slate-700">
        <span>{t.panes.visualizations.title}</span>
        <div className="flex bg-slate-200/70 p-0.5 rounded text-[11px]">
          <button
            onClick={() => setActiveTab('build')}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              activeTab === 'build' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.panes.visualizations.buildVisual}
          </button>
          <button
            onClick={() => setActiveTab('format')}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              activeTab === 'format' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.panes.visualizations.formatVisual}
          </button>
        </div>
      </div>

      {/* Visual Type Picker Grid */}
      <div className="p-2.5 grid grid-cols-4 gap-1 border-b border-slate-200 bg-slate-50/40">
        {visualTypes.map(v => {
          const Icon = v.icon;
          const isCurrent = selectedVisual.type === v.type;
          return (
            <button
              key={v.type}
              onClick={() => updateVisual(selectedVisual.id, { type: v.type })}
              title={v.label}
              className={`flex flex-col items-center justify-center p-1.5 rounded border transition-all ${
                isCurrent
                  ? 'border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-400'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50/30'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Tab 1: Field Wells (Eixo X, Valores, Legenda, Agregação) */}
      {activeTab === 'build' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Tabela de Origem */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">
              Tabela de Origem
            </label>
            <select
              value={selectedVisual.dataConfig.tableId}
              onChange={(e) =>
                updateVisual(selectedVisual.id, {
                  dataConfig: { ...selectedVisual.dataConfig, tableId: e.target.value },
                })
              }
              className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {tables.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Eixo X / Legenda / Categoria */}
          {fieldLabels.showCategory && (
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
                  {fieldLabels.categoryLabel}
                </label>
                {(selectedVisual.type === 'pie' || selectedVisual.type === 'donut') && (
                  <span className="text-[9px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-semibold">
                    Fatias
                  </span>
                )}
              </div>
              {fieldLabels.categorySubtitle && (
                <p className="text-[10px] text-slate-400 mb-1 leading-tight">
                  {fieldLabels.categorySubtitle}
                </p>
              )}
              <select
                value={selectedVisual.dataConfig.xAxisField || ''}
                onChange={(e) =>
                  updateVisual(selectedVisual.id, {
                    dataConfig: { ...selectedVisual.dataConfig, xAxisField: e.target.value },
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">{fieldLabels.categoryPlaceholder}</option>
                <optgroup label={`Tabela Principal (${selectedTable?.name})`}>
                  {selectedTable?.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.dataType})
                    </option>
                  ))}
                </optgroup>
                {relatedTables.map(relT => (
                  <optgroup key={relT.id} label={`Tabela Relacionada (${relT.name})`}>
                    {relT.columns.map(c => (
                      <option key={`${relT.name}.${c.name}`} value={`${relT.name}.${c.name}`}>
                        {relT.name}.{c.name} ({c.dataType})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {/* Valores / Métrica */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
                {fieldLabels.valueLabel}
              </label>
              {measures.some(m => m.name === selectedVisual.dataConfig.yAxisFields?.[0]) && (
                <span className="text-[9px] text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded font-semibold">
                  Medida DAX
                </span>
              )}
            </div>
            {fieldLabels.valueSubtitle && (
              <p className="text-[10px] text-slate-400 mb-1 leading-tight">
                {fieldLabels.valueSubtitle}
              </p>
            )}
            <select
              value={selectedVisual.dataConfig.yAxisFields?.[0] || ''}
              onChange={(e) => {
                const val = e.target.value;
                const isMeasure = measures.some(m => m.name === val || `Σ ${m.name}` === val);
                updateVisual(selectedVisual.id, {
                  dataConfig: {
                    ...selectedVisual.dataConfig,
                    yAxisFields: [val],
                    aggregation: isMeasure ? 'NONE' : (selectedVisual.dataConfig.aggregation === 'NONE' ? 'SUM' : selectedVisual.dataConfig.aggregation || 'SUM'),
                  },
                });
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">{fieldLabels.valuePlaceholder}</option>
              <optgroup label="Medidas Calculadas (DAX)">
                {measures.map(m => (
                  <option key={m.name} value={m.name}>
                    Σ {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={`Colunas Numéricas (${selectedTable?.name})`}>
                {selectedTable?.columns
                  .filter(c => c.dataType === 'number' || c.dataType === 'currency' || c.dataType === 'percentage')
                  .map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
              {relatedTables.map(relT => (
                <optgroup key={relT.id} label={`Colunas Numéricas (${relT.name})`}>
                  {relT.columns
                    .filter(c => c.dataType === 'number' || c.dataType === 'currency' || c.dataType === 'percentage')
                    .map(c => (
                      <option key={`${relT.name}.${c.name}`} value={`${relT.name}.${c.name}`}>
                        {relT.name}.{c.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Agregação */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                Função de Agregação
              </label>
              {measures.some(m => m.name === selectedVisual.dataConfig.yAxisFields?.[0]) && (
                <span className="text-[9px] text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded font-semibold">
                  Medida DAX (Já agregada)
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(['NONE', 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'DISTINCTCOUNT'] as const).map(agg => {
                const isSelected =
                  (selectedVisual.dataConfig.aggregation ||
                    (measures.some(m => m.name === selectedVisual.dataConfig.yAxisFields?.[0]) ? 'NONE' : 'SUM')) === agg;
                return (
                  <button
                    key={agg}
                    onClick={() =>
                      updateVisual(selectedVisual.id, {
                        dataConfig: { ...selectedVisual.dataConfig, aggregation: agg },
                      })
                    }
                    className={`py-1 px-1 rounded border text-[10px] font-medium text-center truncate ${
                      isSelected
                        ? 'bg-amber-100 border-amber-500 text-amber-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    title={
                      agg === 'NONE'
                        ? 'Nenhuma: não realiza agregações adicionais (ideal para medidas DAX)'
                        : undefined
                    }
                  >
                    {agg === 'NONE'
                      ? 'Nenhuma'
                      : agg === 'SUM'
                      ? 'Soma'
                      : agg === 'AVG'
                      ? 'Média'
                      : agg === 'COUNT'
                      ? 'Contagem'
                      : agg}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legenda / Série (apenas para gráficos com quebra de série dimensional) */}
          {fieldLabels.showSeriesBreakdown && selectedVisual.type !== 'slicer' && (
            <div>
              <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                Legenda de Série (Opcional)
              </label>
              <select
                value={selectedVisual.dataConfig.legendField || ''}
                onChange={(e) =>
                  updateVisual(selectedVisual.id, {
                    dataConfig: { ...selectedVisual.dataConfig, legendField: e.target.value || undefined },
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">(Sem quebra de série)</option>
                {selectedTable?.columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Format Pane (Título, Cores, Rótulos, Fundo) */}
      {activeTab === 'format' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Título */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-700">Título do Visual</label>
              <input
                type="checkbox"
                checked={selectedVisual.formatConfig.showTitle}
                onChange={(e) =>
                  updateVisual(selectedVisual.id, {
                    formatConfig: { ...selectedVisual.formatConfig, showTitle: e.target.checked },
                  })
                }
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
              />
            </div>
            {selectedVisual.formatConfig.showTitle && (
              <input
                type="text"
                value={selectedVisual.title}
                onChange={(e) => updateVisual(selectedVisual.id, { title: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            )}
          </div>

          {/* Rótulos de dados */}
          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-700">Rótulos de Dados</span>
            <input
              type="checkbox"
              checked={selectedVisual.formatConfig.showDataLabels ?? false}
              onChange={(e) =>
                updateVisual(selectedVisual.id, {
                  formatConfig: { ...selectedVisual.formatConfig, showDataLabels: e.target.checked },
                })
              }
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
          </div>

          {/* Legenda */}
          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-700">Exibir Legenda</span>
            <input
              type="checkbox"
              checked={selectedVisual.formatConfig.showLegend ?? true}
              onChange={(e) =>
                updateVisual(selectedVisual.id, {
                  formatConfig: { ...selectedVisual.formatConfig, showLegend: e.target.checked },
                })
              }
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
          </div>

          {/* Mostrar BLANK como 0 */}
          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <div>
              <span className="text-[11px] font-medium text-slate-700 block">Mostrar BLANK como 0</span>
              <span className="text-[9px] text-slate-400 block">Exibe 0 em vez de vazio para valores nulos</span>
            </div>
            <input
              type="checkbox"
              checked={selectedVisual.formatConfig.showBlankAsZero ?? false}
              onChange={(e) =>
                updateVisual(selectedVisual.id, {
                  formatConfig: { ...selectedVisual.formatConfig, showBlankAsZero: e.target.checked },
                })
              }
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
          </div>

          {/* Paleta de Cores */}
          <div className="space-y-1.5 border-t border-slate-100 pt-2">
            <label className="text-[11px] font-semibold text-slate-700 block">Paleta de Cores</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { name: 'Padrão Power BI', colors: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'] },
                { name: 'Azul Corporativo', colors: ['#0284c7', '#0369a1', '#38bdf8', '#7dd3fc'] },
                { name: 'Esmeralda & Ouro', colors: ['#059669', '#d97706', '#10b981', '#f59e0b'] },
                { name: 'Vibrante Moderno', colors: ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981'] },
              ].map(palette => (
                <button
                  key={palette.name}
                  onClick={() =>
                    updateVisual(selectedVisual.id, {
                      formatConfig: { ...selectedVisual.formatConfig, colorPalette: palette.colors },
                    })
                  }
                  className="flex flex-col p-1.5 border border-slate-200 rounded hover:border-amber-400 bg-white"
                >
                  <span className="text-[10px] text-slate-600 mb-1 truncate">{palette.name}</span>
                  <div className="flex gap-0.5 w-full h-2 rounded overflow-hidden">
                    {palette.colors.map((c, i) => (
                      <div key={i} style={{ backgroundColor: c }} className="flex-1 h-full"></div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Fundo e Bordas */}
          <div className="space-y-2 border-t border-slate-100 pt-2">
            <label className="text-[11px] font-semibold text-slate-700 block">Bordas e Cantos</label>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 text-[11px]">Raio do Canto (px)</span>
              <input
                type="number"
                min="0"
                max="24"
                value={selectedVisual.formatConfig.borderRadius ?? 8}
                onChange={(e) =>
                  updateVisual(selectedVisual.id, {
                    formatConfig: { ...selectedVisual.formatConfig, borderRadius: Number(e.target.value) },
                  })
                }
                className="w-16 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-center text-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
