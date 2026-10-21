import React, { useState } from 'react';
import { Zap, Sigma, CheckCircle, Code } from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { DaxEngine } from '../../engine/daxEngine';
import { Measure } from '../../types/bi';

export const QuickMeasureModal: React.FC = () => {
  const { quickMeasureModalOpen, setQuickMeasureModalOpen, tables, measures, addMeasure } = useBiStore();

  const [calculationType, setCalculationType] = useState<
    'pct_of_total' | 'yoy_growth' | 'mom_growth' | 'rolling_avg' | 'ranking'
  >('pct_of_total');

  const [baseTable, setBaseTable] = useState(tables[0]?.name || 'f_Vendas');
  const [baseMeasure, setBaseMeasure] = useState('Faturamento Total');
  const [dimensionCol, setDimensionCol] = useState('ValorTotal');

  if (!quickMeasureModalOpen) return null;

  const currentTableObj = tables.find(t => t.name === baseTable) || tables[0];

  const generated = DaxEngine.generateQuickMeasure(
    calculationType,
    baseMeasure,
    dimensionCol,
    baseTable
  );

  const handleCreateMeasure = () => {
    const newM: Measure = {
      id: 'm_quick_' + Math.random().toString(36).substr(2, 6),
      name: generated.name,
      tableName: baseTable,
      formula: generated.formula,
      format: generated.format,
      description: `Medida rápida calculada: ${calculationType}`,
      displayFolder: 'Medidas Rápidas',
    };

    addMeasure(newM);
    setQuickMeasureModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-xs flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Assistente de Medidas Rápidas</h3>
              <p className="text-[11px] text-slate-500">Crie cálculos DAX avançados sem programar fórmulas.</p>
            </div>
          </div>
          <button onClick={() => setQuickMeasureModalOpen(false)} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        {/* Form Controls */}
        <div className="space-y-3">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Cálculo Selecionado</label>
            <select
              value={calculationType}
              onChange={(e) => setCalculationType(e.target.value as any)}
              className="w-full border rounded-lg p-2 bg-slate-50 font-semibold text-slate-800"
            >
              <option value="pct_of_total">Porcentagem do Total Geral (% do Total)</option>
              <option value="yoy_growth">Crescimento Ano a Ano (YoY %)</option>
              <option value="mom_growth">Variação Mês a Mês (MoM %)</option>
              <option value="ranking">Classificação / Ranking por Valor</option>
              <option value="rolling_avg">Média Móvel do Indicador</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tabela Principal</label>
              <select
                value={baseTable}
                onChange={(e) => setBaseTable(e.target.value)}
                className="w-full border rounded p-1.5 bg-slate-50"
              >
                {tables.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Medida Base</label>
              <select
                value={baseMeasure}
                onChange={(e) => setBaseMeasure(e.target.value)}
                className="w-full border rounded p-1.5 bg-slate-50"
              >
                {measures.map(m => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Generated DAX Formula Preview */}
          <div className="p-3 bg-slate-900 text-amber-300 rounded-xl space-y-1 font-mono">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Fórmula DAX Gerada:</span>
            <div className="text-xs font-semibold">{generated.name} =</div>
            <div className="text-xs text-emerald-400 whitespace-pre-wrap">{generated.formula}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => setQuickMeasureModalOpen(false)}
            className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreateMeasure}
            className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
          >
            Adicionar Medida ao Modelo
          </button>
        </div>
      </div>
    </div>
  );
};
