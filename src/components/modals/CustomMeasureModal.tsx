import React, { useState, useMemo, useEffect } from 'react';
import { Sigma, CheckCircle2, AlertCircle, Sparkles, BookOpen, Trash2 } from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { DaxEngine } from '../../engine/daxEngine';
import { Measure } from '../../types/bi';
import { formatCurrency, formatPercent, formatNumber } from '../../engine/dataEngine';

export const CustomMeasureModal: React.FC = () => {
  const {
    customMeasureModalOpen,
    setCustomMeasureModalOpen,
    tables,
    measures,
    addMeasure,
    updateMeasure,
    deleteMeasure,
    editingMeasureId,
    setEditingMeasureId,
  } = useBiStore();

  const [name, setName] = useState('');
  const [tableName, setTableName] = useState(tables[0]?.name || 'f_Vendas');
  const [formula, setFormula] = useState('SUM(f_Vendas[ValorTotal])');
  const [format, setFormat] = useState<Measure['format']>('currency');
  const [displayFolder, setDisplayFolder] = useState('Métricas Personalizadas');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when editing a measure or opening modal
  useEffect(() => {
    if (customMeasureModalOpen) {
      if (editingMeasureId) {
        const existing = measures.find(m => m.id === editingMeasureId);
        if (existing) {
          setName(existing.name);
          setTableName(existing.tableName);
          setFormula(existing.formula);
          setFormat(existing.format || 'currency');
          setDisplayFolder(existing.displayFolder || 'Métricas Personalizadas');
          setDescription(existing.description || '');
          setErrorMsg(null);
          return;
        }
      }
      // New measure defaults
      setName('');
      setTableName(tables[0]?.name || 'f_Vendas');
      setFormula('SUM(f_Vendas[ValorTotal])');
      setFormat('currency');
      setDisplayFolder('Métricas Personalizadas');
      setDescription('');
      setErrorMsg(null);
    }
  }, [customMeasureModalOpen, editingMeasureId, measures, tables]);

  // Real-time DAX validation
  const validation = useMemo(() => {
    if (!customMeasureModalOpen) return { isValid: true, errorMessage: '' };
    return DaxEngine.validate(formula, tables, measures);
  }, [customMeasureModalOpen, formula, tables, measures]);

  // Real-time evaluation preview
  const previewValue = useMemo(() => {
    if (!customMeasureModalOpen || !validation.isValid) return null;
    try {
      return DaxEngine.evaluate(formula, tables, measures, []);
    } catch {
      return null;
    }
  }, [customMeasureModalOpen, formula, validation, tables, measures]);

  if (!customMeasureModalOpen) return null;

  const handleClose = () => {
    setCustomMeasureModalOpen(false);
    setEditingMeasureId(null);
  };

  const handleDelete = () => {
    if (editingMeasureId) {
      deleteMeasure(editingMeasureId);
      handleClose();
    }
  };

  const handleSave = () => {
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg('Informe um nome para a medida.');
      return;
    }
    if (!validation.isValid) {
      setErrorMsg(`Fórmula DAX inválida: ${validation.errorMessage}`);
      return;
    }

    if (editingMeasureId) {
      updateMeasure(editingMeasureId, {
        name: name.trim(),
        tableName,
        formula: formula.trim(),
        format,
        displayFolder: displayFolder.trim() || undefined,
        description: description.trim() || undefined,
      });
    } else {
      const newMeasure: Measure = {
        id: 'm_' + Math.random().toString(36).substr(2, 6),
        name: name.trim(),
        tableName,
        formula: formula.trim(),
        format,
        displayFolder: displayFolder.trim() || undefined,
        description: description.trim() || undefined,
      };
      addMeasure(newMeasure);
    }

    handleClose();
    setName('');
  };

  const insertSnippet = (snippet: string) => {
    setFormula(prev => prev + snippet);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 text-xs flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold">
              <Sigma className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {editingMeasureId ? 'Editar Medida DAX Personalizada' : 'Criar Nova Medida DAX Personalizada'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {editingMeasureId
                  ? 'Modifique os cálculos, parâmetros de formatação ou fórmula DAX desta medida.'
                  : 'Escreva cálculos avançados com agregadores, filtros e transição de contexto.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nome da Medida</label>
              <input
                type="text"
                placeholder="Ex.: Faturamento Líquido Sudeste"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded-lg p-2 bg-slate-50 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Tabela de Origem</label>
              <select
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="w-full border rounded-lg p-2 bg-slate-50 font-semibold text-slate-800"
              >
                {tables.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Formato do Resultado</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="w-full border rounded-lg p-1.5 bg-slate-50 text-slate-800"
              >
                <option value="currency">Moeda Brasileira (R$ 1.250,00)</option>
                <option value="percentage">Porcentagem (25,0%)</option>
                <option value="number">Número Decimal (1.250,50)</option>
                <option value="integer">Número Inteiro (1.250)</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Pasta de Exibição (Opcional)</label>
              <input
                type="text"
                placeholder="Ex.: Comercial, KPIs, Financeiro"
                value={displayFolder}
                onChange={(e) => setDisplayFolder(e.target.value)}
                className="w-full border rounded-lg p-1.5 bg-slate-50 text-slate-800"
              />
            </div>
          </div>

          {/* Quick Snippets Bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">Fórmula DAX</label>
              <span className="text-[10px] text-slate-400">Atalhos rápidos:</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {[
                'SUM()',
                'AVERAGE()',
                'COUNTROWS()',
                'DIVIDE(, , 0)',
                'CALCULATE()',
                'ALL()',
                'TOTALYTD(, d_Calendario[Data])',
              ].map(snip => (
                <button
                  key={snip}
                  type="button"
                  onClick={() => insertSnippet(snip)}
                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-600 font-mono text-[10px]"
                >
                  {snip.split('(')[0]}
                </button>
              ))}
            </div>

            <textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              rows={4}
              className="w-full font-mono text-xs bg-slate-900 text-amber-300 p-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Ex.: CALCULATE(SUM(f_Vendas[ValorTotal]), f_Vendas[Regiao] = 'Sudeste')"
            />
          </div>

          {/* Real-time Syntax Validation and Preview */}
          <div className="p-3 rounded-xl border bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {validation.isValid ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-800 font-semibold text-[11px]">Sintaxe DAX válida</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-red-700 font-medium text-[11px]">{validation.errorMessage}</span>
                </>
              )}
            </div>

            {previewValue !== null && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Prévia Calculada:</span>
                <span className="font-extrabold text-slate-900 text-xs">
                  {format === 'currency'
                    ? formatCurrency(previewValue)
                    : format === 'percentage'
                    ? formatPercent(previewValue)
                    : formatNumber(previewValue)}
                </span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div>
            {editingMeasureId && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 font-bold text-xs flex items-center gap-1.5 transition-colors"
                title="Excluir esta medida do modelo"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Medida</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!validation.isValid}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold disabled:opacity-50 shadow-xs transition-colors"
            >
              {editingMeasureId ? 'Salvar Alterações' : 'Salvar Medida no Modelo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
