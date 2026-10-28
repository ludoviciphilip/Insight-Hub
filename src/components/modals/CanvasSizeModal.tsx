import React, { useState, useEffect } from 'react';
import {
  X,
  Maximize2,
  Monitor,
  Printer,
  Sparkles,
  Sliders,
  Check,
  RotateCcw,
  LayoutGrid,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import {
  CANVAS_PRESETS,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  getEffectiveCanvasSize,
  CanvasPresetItem,
} from '../../engine/shared/canvasPresets';
import { CanvasSizeConfig, CanvasSizePreset } from '../../types/bi';
import { useTranslation } from '../../i18n';

export const CanvasSizeModal: React.FC = () => {
  const {
    canvasSizeModalOpen,
    setCanvasSizeModalOpen,
    pages,
    activePageId,
    setPageCanvasSize,
  } = useBiStore();

  const { t } = useTranslation();

  const activePage = pages.find(p => p.id === activePageId) || pages[0];
  const currentEffective = getEffectiveCanvasSize(activePage);

  const [selectedPreset, setSelectedPreset] = useState<CanvasSizePreset>(currentEffective.preset);
  const [customWidth, setCustomWidth] = useState<number>(currentEffective.width);
  const [customHeight, setCustomHeight] = useState<number>(currentEffective.height);
  const [applyToAll, setApplyToAll] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync state whenever modal opens or active page changes
  useEffect(() => {
    if (canvasSizeModalOpen) {
      const eff = getEffectiveCanvasSize(activePage);
      setSelectedPreset(eff.preset);
      setCustomWidth(eff.width);
      setCustomHeight(eff.height);
      setApplyToAll(false);
      setValidationError(null);
    }
  }, [canvasSizeModalOpen, activePageId]);

  if (!canvasSizeModalOpen) return null;

  const handleSelectPreset = (preset: CanvasPresetItem) => {
    setSelectedPreset(preset.id);
    if (preset.id !== 'custom') {
      setCustomWidth(preset.width);
      setCustomHeight(preset.height);
      setValidationError(null);
    }
  };

  const handleWidthChange = (val: number) => {
    setCustomWidth(val);
    setSelectedPreset('custom');
    validateDimensions(val, customHeight);
  };

  const handleHeightChange = (val: number) => {
    setCustomHeight(val);
    setSelectedPreset('custom');
    validateDimensions(customWidth, val);
  };

  const validateDimensions = (w: number, h: number): boolean => {
    if (isNaN(w) || w < 200 || w > 4000) {
      setValidationError('A largura deve estar entre 200px e 4.000px.');
      return false;
    }
    if (isNaN(h) || h < 150 || h > 4000) {
      setValidationError('A altura deve estar entre 150px e 4.000px.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleApply = () => {
    const isValid = validateDimensions(customWidth, customHeight);
    if (!isValid) return;

    const newConfig: CanvasSizeConfig = {
      preset: selectedPreset,
      width: Math.round(customWidth),
      height: Math.round(customHeight),
    };

    setPageCanvasSize(activePage.id, newConfig, applyToAll);
    setCanvasSizeModalOpen(false);
  };

  const handleResetDefault = () => {
    setSelectedPreset('default');
    setCustomWidth(DEFAULT_CANVAS_WIDTH);
    setCustomHeight(DEFAULT_CANVAS_HEIGHT);
    setValidationError(null);
  };

  // Compute preview scaling box (max 180x130 box)
  const previewMaxW = 180;
  const previewMaxH = 120;
  const scale = Math.min(previewMaxW / Math.max(1, customWidth), previewMaxH / Math.max(1, customHeight));
  const previewW = Math.max(28, Math.round(customWidth * scale));
  const previewH = Math.max(20, Math.round(customHeight * scale));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                {t.report.canvasSize || 'Tamanho da Grade / Tela do Relatório'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Página atual: <strong className="text-amber-300">{activePage?.name || 'Página'}</strong> • Padrão nativo: {DEFAULT_CANVAS_WIDTH} × {DEFAULT_CANVAS_HEIGHT} px
              </p>
            </div>
          </div>
          <button
            onClick={() => setCanvasSizeModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Presets Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-amber-600" />
                Formatos Pré-definidos
              </label>
              <button
                type="button"
                onClick={handleResetDefault}
                className="text-[11px] text-slate-500 hover:text-amber-700 flex items-center gap-1 font-medium transition-colors"
                title="Restaurar dimensões padrão (1240 × 820 px)"
              >
                <RotateCcw className="w-3 h-3" />
                Restaurar padrão
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CANVAS_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                const isDefault = preset.id === 'default';

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`text-left p-2.5 rounded-lg border text-xs transition-all relative flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/60 shadow-xs ring-1 ring-amber-400'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 w-full">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-[11px]">
                        {preset.category === 'widescreen' && <Monitor className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                        {preset.category === 'classic' && <LayoutGrid className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        {preset.category === 'print' && <Printer className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        {preset.category === 'special' && <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                        {preset.category === 'custom' && <Sliders className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                        <span>{preset.name}</span>
                      </div>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="font-mono font-medium text-slate-700">
                        {preset.id === 'custom' ? `${customWidth} × ${customHeight} px` : `${preset.width} × ${preset.height} px`}
                      </span>
                      <span className="text-slate-400">
                        {preset.aspectRatio}
                        {isDefault && ' • Padrão'}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Dimension Inputs & Live Wireframe Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            {/* Custom Inputs */}
            <div className="sm:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-600" />
                  Dimensões em Pixels
                </span>
                {selectedPreset === 'custom' && (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
                    Modo Personalizado
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Largura (px)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={200}
                      max={4000}
                      step={10}
                      value={customWidth}
                      onChange={(e) => handleWidthChange(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 select-none">
                      px
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Altura (px)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={150}
                      max={4000}
                      step={10}
                      value={customHeight}
                      onChange={(e) => handleHeightChange(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 select-none">
                      px
                    </span>
                  </div>
                </div>
              </div>

              {validationError && (
                <p className="text-[11px] text-red-600 font-medium">
                  {validationError}
                </p>
              )}

              <p className="text-[10px] text-slate-500 leading-relaxed">
                Recomendado: manter largura mínima de 400px e altura de 300px para garantir a integridade dos gráficos e cartões.
              </p>
            </div>

            {/* Wireframe Preview Box */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Proporção da Tela
              </span>

              <div
                className="w-[180px] h-[120px] bg-slate-100 rounded border border-dashed border-slate-300 flex items-center justify-center p-1.5"
              >
                <div
                  style={{
                    width: `${previewW}px`,
                    height: `${previewH}px`,
                  }}
                  className="bg-gradient-to-br from-amber-100 via-amber-50 to-white border-2 border-amber-500 rounded shadow-xs flex flex-col items-center justify-center transition-all duration-150 p-1 text-center"
                >
                  <span className="text-[9px] font-mono font-bold text-amber-900 leading-none truncate max-w-full">
                    {customWidth} × {customHeight}
                  </span>
                  <span className="text-[8px] text-amber-700/80 leading-none mt-0.5">
                    {(customWidth / customHeight).toFixed(2)}:1
                  </span>
                </div>
              </div>

              <span className="text-[10px] text-slate-500 mt-2 font-mono">
                {customWidth > customHeight ? 'Orientação Paisagem' : customWidth < customHeight ? 'Orientação Retrato' : 'Proporção Quadrada'}
              </span>
            </div>
          </div>

          {/* Scope Selection: Current Page vs All Pages */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 hover:text-slate-900">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
              />
              <span className="font-medium">
                Aplicar este tamanho a todas as páginas do relatório ({pages.length} páginas)
              </span>
            </label>
            <p className="text-[10px] text-slate-500 ml-6 mt-0.5">
              Por padrão, apenas a página ativa ({activePage?.name}) terá seu tamanho modificado.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Resolução final: <strong className="text-slate-800 font-mono">{customWidth} × {customHeight} px</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCanvasSizeModalOpen(false)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {t.common.cancel || 'Cancelar'}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={Boolean(validationError)}
              className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Aplicar Dimensões</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
