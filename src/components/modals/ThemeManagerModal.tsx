import React, { useState } from 'react';
import { Palette, Check, Plus, Trash2, X, Sparkles, Sliders } from 'lucide-react';
import { useBiStore, PRESET_THEMES } from '../../store/useBiStore';
import { BiTheme } from '../../types/bi';

export const ThemeManagerModal: React.FC = () => {
  const {
    themeModalOpen,
    setThemeModalOpen,
    activeThemeId,
    setThemeId,
    customThemes,
    addCustomTheme,
    deleteCustomTheme,
  } = useBiStore();

  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [customName, setCustomName] = useState('Novo Tema');
  const [customColors, setCustomColors] = useState<string[]>([
    '#f59e0b',
    '#3b82f6',
    '#10b981',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
  ]);
  const [newColorInput, setNewColorInput] = useState('#64748b');

  if (!themeModalOpen) return null;

  const allThemes = [...PRESET_THEMES, ...customThemes];

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customName.trim();
    if (!trimmed) return;

    const newTheme: BiTheme = {
      id: 'theme_custom_' + Math.random().toString(36).substr(2, 6),
      name: trimmed,
      palette: customColors,
      backgroundColor: '#ffffff',
      cardBackground: '#ffffff',
      borderColor: '#e2e8f0',
      textColor: '#1e293b',
      isCustom: true,
    };

    addCustomTheme(newTheme);
    setCustomName('Novo Tema');
    setActiveTab('presets');
  };

  const handleUpdateColor = (index: number, newColor: string) => {
    setCustomColors(prev => {
      const copy = [...prev];
      copy[index] = newColor;
      return copy;
    });
  };

  const handleRemoveColor = (index: number) => {
    if (customColors.length <= 2) return;
    setCustomColors(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddColor = () => {
    if (customColors.length >= 10) return;
    setCustomColors(prev => [...prev, newColorInput]);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Gerenciador de Temas & Cores</h2>
              <p className="text-xs text-slate-500">
                Alterne entre paletas visuais para gráficos ou construa seus próprios esquemas
              </p>
            </div>
          </div>
          <button
            onClick={() => setThemeModalOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-5 border-b border-slate-200 bg-white text-xs font-semibold">
          <button
            onClick={() => setActiveTab('presets')}
            className={`py-2.5 px-4 border-b-2 transition-all ${
              activeTab === 'presets'
                ? 'border-amber-500 text-amber-900 bg-amber-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Paletas Disponíveis ({allThemes.length})
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`py-2.5 px-4 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'custom'
                ? 'border-amber-500 text-amber-900 bg-amber-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-amber-600" />
            <span>Criar Paleta Personalizada</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'presets' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allThemes.map(t => {
                  const isActive = activeThemeId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setThemeId(t.id)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                        isActive
                          ? 'border-amber-500 bg-amber-50/30 shadow-md ring-2 ring-amber-400/30'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-800">{t.name}</span>
                          {t.isCustom && (
                            <span className="text-[9px] bg-purple-100 text-purple-700 font-semibold px-1.5 py-0.2 rounded">
                              Personalizado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {t.isCustom && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCustomTheme(t.id);
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                              title="Excluir tema personalizado"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isActive && (
                            <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Color Palette Swatches */}
                      <div className="flex items-center gap-1.5 h-6 rounded-lg overflow-hidden bg-slate-100 p-1 border border-slate-200/80">
                        {t.palette.map((color, idx) => (
                          <div
                            key={idx}
                            style={{ backgroundColor: color }}
                            className="flex-1 h-full rounded-sm shadow-2xs hover:scale-105 transition-transform"
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveCustom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Paleta / Tema
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ex: Minha Empresa - Cores Oficiais"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cores da Paleta (utilizadas sequencialmente em gráficos e séries)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {customColors.map((col, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <input
                        type="color"
                        value={col}
                        onChange={(e) => handleUpdateColor(idx, e.target.value)}
                        className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={col}
                        onChange={(e) => handleUpdateColor(idx, e.target.value)}
                        className="w-20 font-mono text-xs uppercase bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700"
                      />
                      {customColors.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveColor(idx)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded"
                          title="Remover cor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {customColors.length < 10 && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                    <input
                      type="color"
                      value={newColorInput}
                      onChange={(e) => setNewColorInput(e.target.value)}
                      className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono text-slate-600">{newColorInput}</span>
                    <button
                      type="button"
                      onClick={handleAddColor}
                      className="flex items-center gap-1 px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Mais Uma Cor</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Preview Bar */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600">Prévia da Sequência Visual:</span>
                <div className="flex h-7 rounded-lg overflow-hidden border border-slate-300">
                  {customColors.map((c, i) => (
                    <div
                      key={i}
                      style={{ backgroundColor: c }}
                      className="flex-1 flex items-center justify-center text-[10px] text-white/90 font-mono font-bold drop-shadow-xs"
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('presets')}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Salvar e Aplicar Paleta</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>O tema selecionado aplica-se a todos os gráficos do relatório atual.</span>
          <button
            onClick={() => setThemeModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
