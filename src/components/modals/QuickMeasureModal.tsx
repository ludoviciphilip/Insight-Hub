import React, { useState, useEffect, useMemo } from 'react';
import { Zap, CheckCircle2, AlertCircle, Code, Calendar, HelpCircle } from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { DaxEngine } from '../../engine/daxEngine';
import { Measure } from '../../types/bi';
import { QuickMeasureType, generateQuickMeasure } from '../../engine/expr/quickMeasures';

export const QuickMeasureModal: React.FC = () => {
  const { quickMeasureModalOpen, setQuickMeasureModalOpen, tables, measures, addMeasure } = useBiStore();

  const [calculationType, setCalculationType] = useState<QuickMeasureType>('ytd');
  const [baseTable, setBaseTable] = useState(tables[0]?.name || 'f_Vendas');
  const [baseMeasure, setBaseMeasure] = useState(measures[0]?.name || 'Faturamento Total');
  const [dateColumn, setDateColumn] = useState('');
  const [rollingMonths, setRollingMonths] = useState(3);
  const [yearEndDate, setYearEndDate] = useState('');

  // Editable fields
  const [customName, setCustomName] = useState('');
  const [customFormula, setCustomFormula] = useState('');

  // Find marked calendar table or tables with date columns
  const calendarTable = useMemo(() => tables.find(t => t.isCalendar), [tables]);
  const currentTableObj = useMemo(() => tables.find(t => t.name === baseTable) || tables[0], [tables, baseTable]);

  // Collect candidate date columns across tables
  const dateColumns = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    tables.forEach(t => {
      t.columns.forEach(c => {
        if (c.dataType === 'date' || c.name.toLowerCase().includes('data') || c.name.toLowerCase().includes('date')) {
          list.push({
            label: `${t.name}[${c.name}]${t.isCalendar ? ' (Calendário Marcado)' : ''}`,
            value: `'${t.name}'[${c.name}]`,
          });
        }
      });
    });
    // Fallback: any column in current table
    if (list.length === 0 && currentTableObj) {
      currentTableObj.columns.forEach(c => {
        list.push({
          label: `${currentTableObj.name}[${c.name}]`,
          value: `'${currentTableObj.name}'[${c.name}]`,
        });
      });
    }
    return list;
  }, [tables, currentTableObj]);

  // Set default date column
  useEffect(() => {
    if (!dateColumn && dateColumns.length > 0) {
      const calCol = dateColumns.find(d => d.label.includes('Calendário')) || dateColumns[0];
      setDateColumn(calCol.value);
    }
  }, [dateColumns, dateColumn]);

  // Generate suggested formula whenever inputs change
  useEffect(() => {
    const targetTable = baseTable || tables[0]?.name || 'f_Vendas';
    const targetMeasure = baseMeasure || measures[0]?.name || 'Valor';
    const effectiveDateCol = dateColumn || (dateColumns[0]?.value) || `'${targetTable}'[Data]`;

    const generated = generateQuickMeasure(
      calculationType,
      targetMeasure,
      effectiveDateCol,
      targetTable,
      {
        periods: rollingMonths,
        dateColumn: effectiveDateCol,
        yearEndDate: yearEndDate.trim() || undefined,
      }
    );

    setCustomName(generated.name);
    setCustomFormula(generated.formula);
  }, [calculationType, baseTable, baseMeasure, dateColumn, rollingMonths, yearEndDate, tables, measures, dateColumns]);

  // Real-time DAX validation
  const validationResult = useMemo(() => {
    if (!customFormula.trim()) {
      return { isValid: false, errorMessage: 'A fórmula não pode ficar vazia' };
    }
    const res = DaxEngine.validate(customFormula, tables, measures);
    return {
      isValid: res.isValid,
      errorMessage: res.errorMessage,
    };
  }, [customFormula, tables, measures]);

  if (!quickMeasureModalOpen) return null;

  const handleCreateMeasure = () => {
    const gen = generateQuickMeasure(calculationType, baseMeasure, dateColumn, baseTable, {
      periods: rollingMonths,
    });

    const newM: Measure = {
      id: 'm_quick_' + Math.random().toString(36).substring(2, 8),
      name: customName.trim() || gen.name,
      tableName: baseTable,
      formula: customFormula.trim(),
      format: gen.format,
      description: `Medida rápida calculada: ${calculationType}`,
      displayFolder: 'Medidas Rápidas',
    };

    addMeasure(newM);
    setQuickMeasureModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 text-xs flex flex-col space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold shadow-sm">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Assistente de Medidas Rápidas</h3>
              <p className="text-[11px] text-slate-500">Padrões DAX corporativos com suporte a inteligência temporal.</p>
            </div>
          </div>
          <button
            onClick={() => setQuickMeasureModalOpen(false)}
            className="text-slate-400 hover:text-slate-700 w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Calculation Type Select */}
        <div className="space-y-3">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Cálculo Selecionado</label>
            <select
              value={calculationType}
              onChange={(e) => setCalculationType(e.target.value as QuickMeasureType)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <optgroup label="Inteligência Temporal (Time Intelligence)">
                <option value="ytd">Acumulado no Ano (YTD - TOTALYTD)</option>
                <option value="qtd">Acumulado no Trimestre (QTD - TOTALQTD)</option>
                <option value="mtd">Acumulado no Mês (MTD - TOTALMTD)</option>
                <option value="yoy_growth">Crescimento Ano a Ano (YoY %)</option>
                <option value="yoy_diff">Variação Absoluta Ano a Ano (YoY Valor)</option>
                <option value="mom_growth">Crescimento Mês a Mês (MoM %)</option>
                <option value="mom_diff">Variação Absoluta Mês a Mês (MoM Valor)</option>
                <option value="qoq_growth">Crescimento Trimestre a Trimestre (QoQ %)</option>
                <option value="qoq_diff">Variação Absoluta Trimestre a Trimestre (QoQ Valor)</option>
                <option value="rolling_avg">Média Móvel de N Meses (DATESINPERIOD)</option>
              </optgroup>
              <optgroup label="Totais e Agregações">
                <option value="running_total">Total Acumulado (Running Total)</option>
                <option value="pct_of_total">Porcentagem do Total Geral (% do Total)</option>
                <option value="ranking">Classificação / Ranking por Valor (RANKX)</option>
              </optgroup>
            </select>
          </div>

          {/* Grid Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Medida Base</label>
              <select
                value={baseMeasure}
                onChange={(e) => setBaseMeasure(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50 text-slate-800"
              >
                {measures.map(m => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Coluna de Data / Dimensão</label>
              <select
                value={dateColumn}
                onChange={(e) => setDateColumn(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50 text-slate-800"
              >
                {dateColumns.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Contextual Options */}
          {calculationType === 'rolling_avg' && (
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Número de Meses (Média Móvel)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={rollingMonths}
                onChange={(e) => setRollingMonths(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-32 border border-slate-300 rounded-lg p-2 bg-slate-50 text-slate-800"
              />
            </div>
          )}

          {calculationType === 'ytd' && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <label className="font-semibold text-slate-700">Fechamento do Ano Fiscal (Opcional)</label>
                <span title="Exemplo: '06-30' para ano fiscal encerrado em 30 de junho." className="text-slate-400 cursor-help">
                  <HelpCircle className="w-3.5 h-3.5" />
                </span>
              </div>
              <input
                type="text"
                placeholder="Ex: 06-30 (padrão: 12-31)"
                value={yearEndDate}
                onChange={(e) => setYearEndDate(e.target.value)}
                className="w-48 border border-slate-300 rounded-lg p-2 bg-slate-50 text-slate-800 font-mono"
              />
            </div>
          )}

          {/* Name Field */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Nome da Nova Medida</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-900 font-semibold"
            />
          </div>

          {/* Formula Preview & Live Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-amber-600" />
                Fórmula DAX (Editável)
              </label>
              {validationResult.isValid ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sintaxe Válida
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-medium text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Erro de Sintaxe
                </span>
              )}
            </div>

            <textarea
              rows={3}
              value={customFormula}
              onChange={(e) => setCustomFormula(e.target.value)}
              className="w-full p-2.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
            />

            {!validationResult.isValid && validationResult.errorMessage && (
              <div className="text-[11px] text-rose-500 bg-rose-50 border border-rose-200 p-2 rounded-lg">
                {validationResult.errorMessage}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={() => setQuickMeasureModalOpen(false)}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreateMeasure}
            disabled={!validationResult.isValid}
            className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold shadow-sm transition"
          >
            Adicionar ao Modelo
          </button>
        </div>
      </div>
    </div>
  );
};
