import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Database,
  RefreshCw,
  PlusCircle,
  HelpCircle,
  Share2,
  FileDown,
  Sparkles,
  Sliders,
  Calendar,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize,
  Smartphone,
  Monitor,
  Sigma,
  Zap,
  ShieldCheck,
  Search,
  Code,
  Info,
  FilePlus,
  Palette,
  FolderOpen,
  Grid,
  Globe,
  Coins,
  Key,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { exportProjectToFile } from '../../engine/storage';
import { useTranslation } from '../../i18n';
import { getEffectiveCanvasSize } from '../../engine/shared/canvasPresets';

export const Ribbon: React.FC<{
  showFiltersPane: boolean;
  setShowFiltersPane: (v: boolean) => void;
  showVisualsPane: boolean;
  setShowVisualsPane: (v: boolean) => void;
  showFieldsPane: boolean;
  setShowFieldsPane: (v: boolean) => void;
}> = ({
  showFiltersPane,
  setShowFiltersPane,
  showVisualsPane,
  setShowVisualsPane,
  showFieldsPane,
  setShowFieldsPane,
}) => {
  const [activeRibbonTab, setActiveRibbonTab] = useState<'inicio' | 'inserir' | 'modelagem' | 'exibir' | 'ajuda'>('inicio');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { t, language, currency, setLanguage, setCurrency } = useTranslation();

  const {
    setActiveView,
    addVisual,
    canvasZoom,
    setCanvasZoom,
    layoutMode,
    setLayoutMode,
    isPresentationMode,
    setIsPresentationMode,
    setDataSourceModalOpen,
    setQuickMeasureModalOpen,
    setCustomMeasureModalOpen,
    setLimitationsModalOpen,
    setAiModalOpen,
    setAiSettingsModalOpen,
    setCanvasSizeModalOpen,
    pages,
    activePageId,
    newProject,
    loadInitialSampleData,
    generateCalendar,
    saveProject,
    getProjectState,
    theme,
    setTheme,
    setThemeModalOpen,
    gridSize,
    setGridSize,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    loadStateFromProject,
    lastSavedAt,
    projectName,
    setProjectName,
  } = useBiStore();

  const activeRibbonPage = pages.find(p => p.id === activePageId) || pages[0];
  const { width: ribbonCanvasWidth, height: ribbonCanvasHeight } = getEffectiveCanvasSize(activeRibbonPage);

  const handleExportProject = () => {
    const state = getProjectState();
    exportProjectToFile(state, `${projectName.replace(/\s+/g, '_')}.insight`);
  };

  const handleImportInsight = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && (parsed.tables || parsed.pages)) {
          loadStateFromProject(parsed);
        } else {
          alert('O arquivo selecionado não contém uma estrutura de projeto .insight válida.');
        }
      } catch (err) {
        console.error('Erro ao ler arquivo .insight:', err);
        alert('Erro ao carregar o arquivo .insight. Certifique-se de que é um JSON válido.');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  return (
    <div className="w-full bg-[#f8fafc] border-b border-slate-200 select-none shadow-xs">
      {/* Hidden file input for .insight project import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".insight,.json"
        onChange={handleImportInsight}
        className="hidden"
      />

      {/* Top Application Bar: Title, Project Name, Status */}
      <div className="flex items-center justify-between px-3 py-1 bg-slate-900 text-white text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold tracking-wide text-amber-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400"></span>
            <span>InsightHub</span>
          </div>
          <span className="text-slate-500">|</span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent text-slate-200 font-medium hover:bg-slate-800 px-1.5 py-0.5 rounded focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-400 max-w-[200px] truncate"
          />
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition-colors text-[10px]"
            title={t.topBar.newProjectTooltip}
          >
            {t.topBar.newProject}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition-colors text-[10px] flex items-center gap-1"
            title={t.topBar.openInsightTooltip}
          >
            <FolderOpen className="w-3 h-3 text-amber-400" />
            <span>{t.topBar.openInsight}</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 text-[11px] text-slate-300">
          {/* Language Selector */}
          <div className="flex items-center gap-1 bg-slate-800 rounded px-1.5 py-0.5 border border-slate-700/70" title={t.common.language}>
            <Globe className="w-3 h-3 text-amber-400 shrink-0" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-transparent text-slate-200 text-[10px] font-medium focus:outline-none cursor-pointer pr-0.5"
              aria-label={t.common.language}
            >
              <option value="pt-BR" className="bg-slate-900 text-white">🇧🇷 PT</option>
              <option value="en-US" className="bg-slate-900 text-white">🇺🇸 EN</option>
              <option value="es-ES" className="bg-slate-900 text-white">🇪🇸 ES</option>
            </select>
          </div>

          {/* Currency Selector */}
          <div className="flex items-center gap-1 bg-slate-800 rounded px-1.5 py-0.5 border border-slate-700/70" title={t.common.currency}>
            <Coins className="w-3 h-3 text-amber-400 shrink-0" />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as any)}
              className="bg-transparent text-slate-200 text-[10px] font-medium focus:outline-none cursor-pointer pr-0.5"
              aria-label={t.common.currency}
            >
              <option value="BRL" className="bg-slate-900 text-white">R$ BRL</option>
              <option value="USD" className="bg-slate-900 text-white">$ USD</option>
              <option value="EUR" className="bg-slate-900 text-white">€ EUR</option>
            </select>
          </div>

          <span className="text-slate-700">|</span>

          {lastSavedAt && (
            <span className={lastSavedAt === t.common.saveFailed ? 'text-red-400 font-bold text-[10px]' : 'text-slate-400 text-[10px]'}>
              {lastSavedAt.startsWith(t.common.savedAt) || lastSavedAt === t.common.saveFailed ? lastSavedAt : `${t.common.savedAt} ${lastSavedAt}`}
            </span>
          )}
          <button
            onClick={() => handleExportProject()}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition-colors flex items-center gap-1 text-[10px]"
            title={t.topBar.exportInsightTooltip}
          >
            <FileDown className="w-3 h-3 text-amber-400" />
            <span>{t.topBar.exportInsight}</span>
          </button>
          <button
            onClick={() => saveProject()}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-medium transition-colors"
          >
            {t.common.save}
          </button>
          <button
            onClick={() => setAiSettingsModalOpen(true)}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-0.5 rounded font-medium transition-colors text-[10px]"
            title="Configurar Chave Gemini (BYOK)"
          >
            <Key className="w-3 h-3 text-amber-400" />
            <span>Configurar IA</span>
          </button>
          <button
            onClick={() => setAiModalOpen(true)}
            className="flex items-center gap-1 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 px-2 py-0.5 rounded font-bold transition-all shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.topBar.copilotAi}</span>
          </button>
        </div>
      </div>

      {/* Ribbon Navigation Tabs */}
      <div className="flex items-center px-2 bg-slate-100 border-b border-slate-200 text-xs">
        {[
          { id: 'inicio', label: t.ribbonTabs.home },
          { id: 'inserir', label: t.ribbonTabs.insert },
          { id: 'modelagem', label: t.ribbonTabs.modeling },
          { id: 'exibir', label: t.ribbonTabs.view },
          { id: 'ajuda', label: t.ribbonTabs.help },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveRibbonTab(tab.id as any)}
            className={`px-3 py-1 font-medium border-b-2 transition-all ${
              activeRibbonTab === tab.id
                ? 'border-amber-500 text-slate-900 bg-white font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ribbon Action Bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto min-h-[64px] bg-white">
        {/* TAB 1: INÍCIO */}
        {activeRibbonTab === 'inicio' && (
          <>
            {/* Novo Projeto */}
            <div className="flex flex-col items-center px-2 border-r border-slate-200">
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700 group transition-all"
                title={t.topBar.newProjectTooltip}
              >
                <div className="p-1 rounded bg-slate-100 group-hover:bg-slate-200 text-slate-800">
                  <FilePlus className="w-5 h-5 text-amber-500" />
                </div>
                <span className="text-[10px] font-semibold mt-0.5">{t.topBar.newProject}</span>
              </button>
            </div>

            {/* Obter Dados */}
            <div className="flex flex-col items-center px-2 border-r border-slate-200">
              <button
                onClick={() => setDataSourceModalOpen(true)}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700 group transition-all"
              >
                <div className="p-1 rounded bg-amber-50 group-hover:bg-amber-100 text-amber-600">
                  <Database className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold mt-0.5">{t.ribbonActions.getData}</span>
              </button>
            </div>

            {/* Transformar Dados */}
            <div className="flex flex-col items-center px-2 border-r border-slate-200">
              <button
                onClick={() => setActiveView('query')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700 group transition-all"
              >
                <div className="p-1 rounded bg-blue-50 group-hover:bg-blue-100 text-blue-600">
                  <Sliders className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold mt-0.5">{t.ribbonActions.transformData}</span>
              </button>
              <button
                onClick={() => setActiveView('daxquery')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700 group transition-all"
                title="Abrir editor de consultas DAX (EVALUATE, DEFINE)"
              >
                <div className="p-1 rounded bg-amber-50 group-hover:bg-amber-100 text-amber-600">
                  <Code className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold mt-0.5">DAX Query</span>
              </button>
            </div>

            {/* Novo Visual e Medidas */}
            <div className="flex items-center gap-1 px-2 border-r border-slate-200">
              <button
                onClick={() => addVisual('column')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.ribbonActions.newVisual}</span>
              </button>
              <button
                onClick={() => setCustomMeasureModalOpen(true)}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
                title={t.panes.fields.newMeasure}
              >
                <Sigma className="w-5 h-5 text-purple-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.ribbonActions.newMeasure}</span>
              </button>
              <button
                onClick={() => setQuickMeasureModalOpen(true)}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <Zap className="w-5 h-5 text-amber-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.ribbonActions.quickMeasure}</span>
              </button>
            </div>

            {/* Atualizar Dados e Amostra */}
            <div className="flex items-center gap-1 px-2 border-r border-slate-200">
              <button
                onClick={() => loadInitialSampleData()}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <RefreshCw className="w-5 h-5 text-slate-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.ribbonActions.refresh}</span>
              </button>
            </div>

            {/* Metabase & AI Mode */}
            <div className="flex items-center gap-1 px-2 border-r border-slate-200">
              <button
                onClick={() => setActiveView('metabase')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <Search className="w-5 h-5 text-blue-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.nav.metabase}</span>
              </button>
              <button
                onClick={() => setAiModalOpen(true)}
                className="flex flex-col items-center p-1 rounded hover:bg-amber-50 text-amber-800"
              >
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span className="text-[10px] font-semibold mt-0.5">{t.topBar.copilotAi}</span>
              </button>
            </div>

            {/* Temas do Relatório */}
            <div className="flex items-center gap-1 px-2 border-r border-slate-200">
              <button
                onClick={() => setThemeModalOpen(true)}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <Palette className="w-5 h-5 text-indigo-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.ribbonActions.themeManager}</span>
              </button>
            </div>

            {/* Exportar e Compartilhar */}
            <div className="flex items-center gap-1 px-2">
              <button
                onClick={handleExportProject}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
                title={t.topBar.exportInsightTooltip}
              >
                <FileDown className="w-5 h-5 text-slate-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.topBar.exportInsight}</span>
              </button>
              <button
                onClick={() => window.print()}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
                title="PDF / Print"
              >
                <Share2 className="w-5 h-5 text-slate-600" />
                <span className="text-[10px] font-semibold mt-0.5">PDF</span>
              </button>
            </div>
          </>
        )}

        {/* TAB 2: INSERIR */}
        {activeRibbonTab === 'inserir' && (
          <>
            <div className="flex items-center gap-1.5 px-2 border-r border-slate-200">
              <button
                onClick={() => addVisual('column')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <span className="text-base font-bold text-amber-600">📊</span>
                <span className="text-[10px] font-medium">Colunas</span>
              </button>
              <button
                onClick={() => addVisual('line')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <span className="text-base font-bold text-blue-600">📈</span>
                <span className="text-[10px] font-medium">Linhas</span>
              </button>
              <button
                onClick={() => addVisual('donut')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <span className="text-base font-bold text-emerald-600">🍩</span>
                <span className="text-[10px] font-medium">Rosca</span>
              </button>
              <button
                onClick={() => addVisual('waterfall')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <span className="text-base font-bold text-purple-600">📉</span>
                <span className="text-[10px] font-medium">Cascata</span>
              </button>
              <button
                onClick={() => addVisual('card')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <span className="text-base font-bold text-amber-700">🔲</span>
                <span className="text-[10px] font-medium">Cartão KPI</span>
              </button>
              <button
                onClick={() => addVisual('table')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <span className="text-base font-bold text-slate-700">📋</span>
                <span className="text-[10px] font-medium">Tabela</span>
              </button>
              <button
                onClick={() => addVisual('slicer')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <span className="text-base font-bold text-blue-700">🎛️</span>
                <span className="text-[10px] font-medium">Segmentação</span>
              </button>
            </div>
          </>
        )}

        {/* TAB 3: MODELAGEM */}
        {activeRibbonTab === 'modelagem' && (
          <>
            <div className="flex items-center gap-2 px-2 border-r border-slate-200">
              <button
                onClick={() => setCustomMeasureModalOpen(true)}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <Sigma className="w-5 h-5 text-purple-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.ribbonActions.newMeasure}</span>
              </button>
              <button
                onClick={() => setQuickMeasureModalOpen(true)}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <Zap className="w-5 h-5 text-amber-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.ribbonActions.quickMeasure}</span>
              </button>
              <button
                onClick={() => generateCalendar('2025-01-01', '2026-12-31')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <Calendar className="w-5 h-5 text-emerald-600" />
                <span className="text-[10px] font-semibold mt-0.5">Calendário</span>
              </button>
              <button
                onClick={() => setActiveView('model')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <Layers className="w-5 h-5 text-blue-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.nav.model}</span>
              </button>
              <button
                onClick={() => setActiveView('governance')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.nav.governance}</span>
              </button>
            </div>
          </>
        )}

        {/* TAB 4: EXIBIR */}
        {activeRibbonTab === 'exibir' && (
          <>
            {/* Painéis */}
            <div className="flex items-center gap-1.5 px-2 border-r border-slate-200">
              <button
                onClick={() => setShowFiltersPane(!showFiltersPane)}
                className={`flex flex-col items-center p-1 rounded text-slate-700 ${
                  showFiltersPane ? 'bg-amber-100 font-bold' : 'hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px]">{t.panes.filters.title}</span>
              </button>
              <button
                onClick={() => setShowVisualsPane(!showVisualsPane)}
                className={`flex flex-col items-center p-1 rounded text-slate-700 ${
                  showVisualsPane ? 'bg-amber-100 font-bold' : 'hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px]">{t.panes.visualizations.title}</span>
              </button>
              <button
                onClick={() => setShowFieldsPane(!showFieldsPane)}
                className={`flex flex-col items-center p-1 rounded text-slate-700 ${
                  showFieldsPane ? 'bg-amber-100 font-bold' : 'hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px]">{t.panes.fields.title}</span>
              </button>
            </div>

            {/* Layout Celular / Desktop */}
            <div className="flex items-center gap-1 px-2 border-r border-slate-200">
              <button
                onClick={() => setLayoutMode(layoutMode === 'desktop' ? 'mobile' : 'desktop')}
                className={`flex flex-col items-center p-1 rounded text-slate-700 ${
                  layoutMode === 'mobile' ? 'bg-amber-100 font-bold' : 'hover:bg-slate-100'
                }`}
              >
                {layoutMode === 'desktop' ? <Smartphone className="w-5 h-5 text-slate-600" /> : <Monitor className="w-5 h-5 text-amber-600" />}
                <span className="text-[10px] font-semibold mt-0.5">
                  {layoutMode === 'desktop' ? t.ribbonActions.mobileLayout : t.ribbonActions.desktopLayout}
                </span>
              </button>
              <button
                onClick={() => setIsPresentationMode(!isPresentationMode)}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <Maximize className="w-5 h-5 text-slate-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.ribbonActions.presentationMode}</span>
              </button>
            </div>

            {/* Temas */}
            <div className="flex items-center gap-1 px-2 border-r border-slate-200">
              <button
                onClick={() => setThemeModalOpen(true)}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <Palette className="w-5 h-5 text-indigo-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.ribbonActions.themeManager}</span>
              </button>
            </div>

            {/* Tamanho da Grade / Tela */}
            <div className="flex items-center gap-2 px-2 border-r border-slate-200">
              <button
                onClick={() => setCanvasSizeModalOpen(true)}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                title="Ajustar tamanho e proporção da tela/grade do relatório"
              >
                <Grid className="w-5 h-5 text-amber-600" />
                <span className="text-[10px] font-semibold mt-0.5">
                  {t.ribbonActions.pageSize || 'Tamanho da Grade'}
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  {ribbonCanvasWidth} × {ribbonCanvasHeight} px
                </span>
              </button>
            </div>

            {/* Grade do Relatório */}
            <div className="flex items-center gap-2 px-2 border-r border-slate-200">
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-1.5 mb-1">
                  <Grid className="w-4 h-4 text-slate-600" />
                  <span className="text-[10px] font-bold text-slate-700">Grade:</span>
                  <select
                    value={gridSize}
                    onChange={(e) => setGridSize(Number(e.target.value))}
                    className="border border-slate-300 rounded px-1.5 py-0.5 text-[10px] bg-slate-50 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {[8, 10, 16, 20, 24, 32].map(size => (
                      <option key={size} value={size}>
                        {size}px
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-600">
                  <label className="flex items-center gap-1 cursor-pointer hover:text-slate-900 select-none">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-400 w-3 h-3"
                    />
                    <span>Linhas</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer hover:text-slate-900 select-none">
                    <input
                      type="checkbox"
                      checked={snapToGrid}
                      onChange={(e) => setSnapToGrid(e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-400 w-3 h-3"
                    />
                    <span>{t.ribbonActions.snapToGrid}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-1.5 px-2">
              <button
                onClick={() => setCanvasZoom(canvasZoom - 10)}
                className="p-1 rounded hover:bg-slate-100 text-slate-600"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-semibold text-slate-700 w-10 text-center">
                {canvasZoom}%
              </span>
              <button
                onClick={() => setCanvasZoom(canvasZoom + 10)}
                className="p-1 rounded hover:bg-slate-100 text-slate-600"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* TAB 5: AJUDA */}
        {activeRibbonTab === 'ajuda' && (
          <>
            <div className="flex items-center gap-2 px-2 border-r border-slate-200">
              <button
                onClick={() => setLimitationsModalOpen(true)}
                className="flex flex-col items-center p-1 rounded hover:bg-amber-50 text-amber-800"
              >
                <Info className="w-5 h-5 text-amber-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.nav.limitations}</span>
              </button>
              <button
                onClick={() => setActiveView('governance')}
                className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
              >
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span className="text-[10px] font-semibold mt-0.5">{t.nav.governance}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal de Confirmação Novo Projeto */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
                <FilePlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{t.topBar.confirmNewProjectTitle}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.topBar.confirmNewProjectMessage}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNewProjectModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  newProject();
                  setShowNewProjectModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-colors"
              >
                {t.common.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
