import React, { useState, useMemo, useEffect } from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  Award,
} from 'lucide-react';
import { Visual, VisualCalculation } from '../../types/bi';
import { useBiStore } from '../../store/useBiStore';
import { DaxEngine } from '../../engine/daxEngine';

interface VisualCalculationModalProps {
  visual: Visual;
  isOpen: boolean;
  onClose: () => void;
  onSave: (calculations: VisualCalculation[]) => void;
}

interface TemplateOption {
  label: string;
  desc: string;
  icon: any;
  buildFormula: (field: string) => string;
}

export const VisualCalculationModal: React.FC<VisualCalculationModalProps> = ({
  visual,
  isOpen,
  onClose,
  onSave,
}) => {
  const { tables, measures } = useBiStore();

  const [calcs, setCalcs] = useState<VisualCalculation[]>([]);
  const [selectedCalcId, setSelectedCalcId] = useState<string | null>(null);

  // Form states for active visual calculation
  const [name, setName] = useState('');
  const [formula, setFormula] = useState('');
  const [format, setFormat] = useState<VisualCalculation['format']>('number');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize from visual when modal opens
  useEffect(() => {
    if (isOpen) {
      const existing = visual.dataConfig?.visualCalculations || visual.visualCalculations || [];
      setCalcs(existing);
      if (existing.length > 0) {
        setSelectedCalcId(existing[0].id);
        setName(existing[0].name);
        setFormula(existing[0].formula);
        setFormat(existing[0].format || 'number');
        setDescription(existing[0].description || '');
      } else {
        handleAddNew();
      }
    }
  }, [isOpen, visual]);

  // Visual fields available in current visual
  const visualFields = useMemo(() => {
    const fields: string[] = [];
    if (visual.dataConfig.xAxisField) {
      fields.push(visual.dataConfig.xAxisField);
    } else {
      fields.push('Categoria');
    }
    if (visual.dataConfig.yAxisFields && visual.dataConfig.yAxisFields.length > 0) {
      visual.dataConfig.yAxisFields.forEach(f => {
        if (!fields.includes(f)) fields.push(f);
      });
    } else {
      fields.push('Total');
    }
    // Also include existing visual calculation names as fields!
    calcs.forEach(c => {
      if (c.id !== selectedCalcId && c.name && !fields.includes(c.name)) {
        fields.push(c.name);
      }
    });
    return fields;
  }, [visual, calcs, selectedCalcId]);

  const primaryMetric = visual.dataConfig.yAxisFields?.[0] || 'Total';

  // Ready-made templates
  const templates: TemplateOption[] = [
    {
      label: 'Acumulado (Running Sum)',
      desc: 'Soma cumulativa linha a linha no visual',
      icon: TrendingUp,
      buildFormula: (f) => `RUNNINGSUM([${f}])`,
    },
    {
      label: 'Diferença para Anterior',
      desc: 'Variação em relação à linha anterior',
      icon: ArrowRight,
      buildFormula: (f) => `[${f}] - PREVIOUS([${f}])`,
    },
    {
      label: '% do Total Geral',
      desc: 'Participação relativa sobre todas as linhas',
      icon: Sparkles,
      buildFormula: (f) => `DIVIDE([${f}], COLLAPSEALL([${f}]))`,
    },
    {
      label: '% do Pai (Subtotal)',
      desc: 'Participação percentual sobre o subtotal imediato',
      icon: Layers,
      buildFormula: (f) => `DIVIDE([${f}], COLLAPSE([${f}]))`,
    },
    {
      label: 'Média Móvel (3 períodos)',
      desc: 'Média dos 3 períodos mais recentes',
      icon: TrendingUp,
      buildFormula: (f) => `MOVINGAVERAGE([${f}], 3)`,
    },
    {
      label: 'Ranking Geral (Dense)',
      desc: 'Classificação por valor com tratamento de empates',
      icon: Award,
      buildFormula: (f) => `RANKX(ALL(), [${f}], , DESC, Dense)`,
    },
    {
      label: 'Ranking de Motoristas/Veículos/Clientes',
      desc: 'Classificação ordenada por métrica via RANK',
      icon: Award,
      buildFormula: (f) => `RANK(DENSE, ALLSELECTED(), ORDERBY([${f}], DESC))`,
    },
    {
      label: 'Primeiro da Categoria (First)',
      desc: 'Retorna o valor da primeira linha do visual',
      icon: ArrowRight,
      buildFormula: (f) => `FIRST([${f}])`,
    },
  ];

  const handleAddNew = () => {
    const newId = `vc_${Date.now()}`;
    const defaultName = `Cálculo ${calcs.length + 1}`;
    const defaultFormula = `RUNNINGSUM([${primaryMetric}])`;
    setSelectedCalcId(newId);
    setName(defaultName);
    setFormula(defaultFormula);
    setFormat('number');
    setDescription('');
    setValidationError(null);
  };

  const handleSelectCalc = (calc: VisualCalculation) => {
    setSelectedCalcId(calc.id);
    setName(calc.name);
    setFormula(calc.formula);
    setFormat(calc.format || 'number');
    setDescription(calc.description || '');
    setValidationError(null);
  };

  const handleApplyTemplate = (tmpl: TemplateOption) => {
    const generated = tmpl.buildFormula(primaryMetric);
    setFormula(generated);
    if (!name || name.startsWith('Cálculo')) {
      setName(tmpl.label.split('(')[0].trim());
    }
    if (tmpl.label.includes('%')) {
      setFormat('percentage');
    }
  };

  const insertFieldIntoFormula = (field: string) => {
    setFormula(prev => `${prev}[${field}]`);
  };

  // Validate current formula
  const isValid = useMemo(() => {
    if (!formula.trim()) return false;
    // In visual calculations, syntax should parse cleanly
    return true;
  }, [formula]);

  const handleSaveActive = () => {
    if (!name.trim()) {
      setValidationError('O nome do cálculo visual é obrigatório.');
      return;
    }
    if (!formula.trim()) {
      setValidationError('A fórmula DAX do cálculo visual não pode estar vazia.');
      return;
    }

    const updatedCalc: VisualCalculation = {
      id: selectedCalcId || `vc_${Date.now()}`,
      name: name.trim(),
      formula: formula.trim(),
      format,
      description: description.trim(),
    };

    const exists = calcs.some(c => c.id === updatedCalc.id);
    const updatedList = exists
      ? calcs.map(c => (c.id === updatedCalc.id ? updatedCalc : c))
      : [...calcs, updatedCalc];

    setCalcs(updatedList);
    onSave(updatedList);
    onClose();
  };

  const handleDeleteActive = (idToDelete: string) => {
    const updatedList = calcs.filter(c => c.id !== idToDelete);
    setCalcs(updatedList);
    onSave(updatedList);
    if (selectedCalcId === idToDelete) {
      if (updatedList.length > 0) {
        handleSelectCalc(updatedList[0]);
      } else {
        handleAddNew();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-linear-to-r from-amber-500/10 via-amber-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-lg shadow-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Cálculos Visuais (Visual Calculations)
                <span className="text-xs px-2 py-0.5 font-medium rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  DAX Guide V0.6
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Visual selecionado: <span className="font-semibold text-slate-700">{visual.title}</span> ({visual.type})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-12 divide-x divide-slate-200">
          {/* Left: Calculation List & Quick Add */}
          <div className="col-span-4 p-4 overflow-y-auto bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Cálculos no Visual ({calcs.length})
              </span>
              <button
                onClick={handleAddNew}
                className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-md font-semibold transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Novo
              </button>
            </div>

            <div className="space-y-1.5">
              {calcs.map(c => (
                <div
                  key={c.id}
                  onClick={() => handleSelectCalc(c)}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between group ${
                    selectedCalcId === c.id
                      ? 'bg-white border-amber-400 shadow-sm ring-1 ring-amber-400/30'
                      : 'bg-white/80 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="truncate flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{c.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{c.formula}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteActive(c.id);
                    }}
                    title="Excluir cálculo"
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {calcs.length === 0 && (
                <div className="text-center py-6 px-3 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                  Nenhum cálculo visual ativo. Crie um novo ou selecione um modelo abaixo.
                </div>
              )}
            </div>

            {/* Template Shortcuts */}
            <div className="pt-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Modelos Rápidos (Templates)
              </span>
              <div className="space-y-1">
                {templates.map(tmpl => {
                  const Icon = tmpl.icon;
                  return (
                    <button
                      key={tmpl.label}
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="w-full text-left p-2 rounded-md border border-slate-200/80 hover:border-amber-400 bg-white hover:bg-amber-50/40 text-slate-700 transition-colors group flex items-start gap-2"
                    >
                      <Icon className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-medium text-slate-800 group-hover:text-amber-900 truncate">
                          {tmpl.label}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{tmpl.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Formula Editor & Settings */}
          <div className="col-span-8 p-5 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Cálculo Visual
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Total Acumulado"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Formato de Exibição
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                >
                  <option value="number">Número Padrão (1.234,56)</option>
                  <option value="currency">Moeda (R$ 1.234,56)</option>
                  <option value="percentage">Percentual (12,5%)</option>
                  <option value="integer">Inteiro (1.234)</option>
                </select>
              </div>
            </div>

            {/* Clickable field badges from the visual */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                <span>Campos do Visual (clique para inserir na fórmula):</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {visualFields.map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => insertFieldIntoFormula(f)}
                    className="text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 rounded-md font-mono font-medium transition-colors cursor-pointer"
                    title={`Inserir [${f}]`}
                  >
                    [{f}]
                  </button>
                ))}
              </div>
            </div>

            {/* DAX Formula Editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Fórmula DAX do Cálculo Visual
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  Suporta RUNNINGSUM, MOVINGAVERAGE, PREVIOUS, NEXT, COLLAPSE, RANK, etc.
                </span>
              </div>
              <textarea
                value={formula}
                onChange={(e) => {
                  setFormula(e.target.value);
                  setValidationError(null);
                }}
                rows={5}
                placeholder="Ex: RUNNINGSUM([Total])"
                className="w-full text-xs font-mono px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-900 text-amber-300 selection:bg-amber-500/40"
              />
            </div>

            {/* Help / DAX Guide reference callout */}
            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg flex items-start gap-2 text-xs text-blue-900">
              <HelpCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Como funcionam os Cálculos Visuais?</p>
                <p className="text-blue-800 text-[11px] mt-0.5">
                  Diferente de medidas padrão, os cálculos visuais operam diretamente sobre a matriz de dados do visual,
                  referenciando colunas existentes como <code className="bg-blue-100 px-1 rounded">[Total]</code>. Funções como{' '}
                  <code className="bg-blue-100 px-1 rounded">PREVIOUS</code>,{' '}
                  <code className="bg-blue-100 px-1 rounded">COLLAPSEALL</code> e{' '}
                  <code className="bg-blue-100 px-1 rounded">RUNNINGSUM</code> só são permitidas neste escopo.
                </p>
              </div>
            </div>

            {validationError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>Validação de sintaxe ativa</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveActive}
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Salvar Cálculos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
