import React, { useState, useMemo, useEffect } from 'react';
import { Sigma, CheckCircle2, AlertCircle, Sparkles, BookOpen, Trash2 } from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { DaxEngine } from '../../engine/daxEngine';
import { Measure } from '../../types/bi';
import { formatValue, formatCurrency, formatPercent, formatNumber } from '../../engine/dataEngine';
import { FormulaEditor } from '../shared/FormulaEditor';

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
  const [formatString, setFormatString] = useState('Currency');
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
          setFormatString(existing.formatString || (existing.format === 'currency' ? 'Currency' : existing.format === 'percentage' ? '0.0%' : existing.format === 'integer' ? '#,##0' : '#,##0.00'));
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
      setFormatString('Currency');
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

  // Real-time evaluation preview & error tracking
  const previewState = useMemo(() => {
    if (!customMeasureModalOpen || !validation.isValid) return { value: null, error: null };
    try {
      const val = DaxEngine.evaluate(formula, tables, measures, []);
      return { value: val, error: null };
    } catch (err: any) {
      return { value: null, error: err.message || 'Erro na avaliação da fórmula' };
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
    if (!validation.isValid || previewState.error) {
      setErrorMsg(`Fórmula DAX inválida: ${validation.errorMessage || previewState.error}`);
      return;
    }

    if (editingMeasureId) {
      updateMeasure(editingMeasureId, {
        name: name.trim(),
        tableName,
        formula: formula.trim(),
        format,
        formatString: formatString.trim() || undefined,
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
        formatString: formatString.trim() || undefined,
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
                  : 'Escreva cálculos avançados, agregações e operações matemáticas entre medidas ([A] + [B]).'}
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Formato do Resultado</label>
              <select
                value={format}
                onChange={(e) => {
                  const f = e.target.value as Measure['format'];
                  setFormat(f);
                  if (f === 'currency') setFormatString('Currency');
                  else if (f === 'percentage') setFormatString('0.0%');
                  else if (f === 'integer') setFormatString('#,##0');
                  else setFormatString('#,##0.00');
                }}
                className="w-full border rounded-lg p-1.5 bg-slate-50 text-slate-800"
              >
                <option value="currency">Moeda (R$ 1.250,00)</option>
                <option value="percentage">Porcentagem (25,0%)</option>
                <option value="number">Número Decimal (1.250,50)</option>
                <option value="integer">Número Inteiro (1.250)</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Máscara DAX (formatString)</label>
              <input
                type="text"
                placeholder='Ex.: "#,0.00", "0.0%"'
                value={formatString}
                onChange={(e) => setFormatString(e.target.value)}
                className="w-full border rounded-lg p-1.5 bg-slate-50 text-slate-800 font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Pasta de Exibição</label>
              <input
                type="text"
                placeholder="Ex.: Comercial, KPIs"
                value={displayFolder}
                onChange={(e) => setDisplayFolder(e.target.value)}
                className="w-full border rounded-lg p-1.5 bg-slate-50 text-slate-800"
              />
            </div>
          </div>

          {/* Measure-to-Measure Arithmetic helper bar */}
          {measures.length > 0 && (
            <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/70 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-900 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" /> Inserir Medida na Operação ([A] + [B]):
                </span>
                <div className="flex items-center gap-1">
                  {['+', '-', '*', '/'].map(op => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => insertSnippet(` ${op} `)}
                      className="w-5 h-5 flex items-center justify-center rounded bg-white hover:bg-amber-100 text-slate-800 border border-slate-300 font-mono font-bold text-[10px]"
                      title={`Inserir operador ${op}`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                {measures.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => insertSnippet(`[${m.name}]`)}
                    className="px-1.5 py-0.5 rounded bg-white hover:bg-amber-200 text-amber-950 border border-amber-300 font-mono text-[10px] font-medium"
                    title={`Inserir [${m.name}]`}
                  >
                    [{m.name}]
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Snippets Bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">Fórmula DAX</label>
              <span className="text-[10px] text-slate-400">Atalhos rápidos (incluindo iteradores):</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {[
                { label: 'SUM', snip: 'SUM()' },
                { label: 'SUMX (Iterador)', snip: 'SUMX(, )', highlight: true },
                { label: 'AVERAGEX', snip: 'AVERAGEX(, )', highlight: true },
                { label: 'CALCULATE', snip: 'CALCULATE()' },
                { label: 'FILTER', snip: 'FILTER(, )', highlight: true },
                { label: 'COUNTROWS', snip: 'COUNTROWS()' },
                { label: 'DIVIDE', snip: 'DIVIDE(, , 0)' },
                { label: 'TOPN', snip: 'TOPN(5, , , DESC)' },
                { label: 'VALUES', snip: 'VALUES()' },
                { label: 'ALL', snip: 'ALL()' },
                { label: 'CONCATENATEX', snip: 'CONCATENATEX(, , ", ")', highlight: true },
              ].map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => insertSnippet(item.snip)}
                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] transition-colors ${
                    item.highlight
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                  title={`Inserir ${item.snip}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <FormulaEditor
              value={formula}
              onChange={setFormula}
              dialect="dax"
              tables={tables}
              measures={measures}
              placeholder="Ex.: [Total Vendas] - [Custo Total] ou DIVIDE([Vendas], [Meta])"
              rows={4}
            />
          </div>

          {/* Real-time Syntax Validation and Preview */}
          <div className="p-3 rounded-xl border bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!validation.isValid ? (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-red-700 font-medium text-[11px]">{validation.errorMessage}</span>
                </>
              ) : previewState.error ? (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-red-700 font-medium text-[11px]">{previewState.error}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-800 font-semibold text-[11px]">Sintaxe DAX válida</span>
                </>
              )}
            </div>

            {previewState.value !== null && !previewState.error && validation.isValid && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Prévia Calculada:</span>
                <span className="font-extrabold text-slate-900 text-xs">
                  {formatValue(previewState.value, formatString || (format === 'currency' ? 'Currency' : format === 'percentage' ? '0.0%' : format === 'integer' ? '#,##0' : '#,##0.00'))}
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
              disabled={!validation.isValid || !!previewState.error}
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
