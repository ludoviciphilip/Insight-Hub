import { create } from 'zustand';
import {
  ActiveView,
  Table,
  Relationship,
  Measure,
  Page,
  Visual,
  VisualType,
  Filter,
  Bookmark,
  DashboardTile,
  Goal,
  RlsRole,
  WhatIfParameter,
  PowerQueryStep,
  PerformanceMetric,
  BiTheme,
  ActiveDrillthrough,
} from '../types/bi';
import { getSampleDatasets, generateCalendarTable } from '../data/sampleDatasets';
import { globalDataEngine } from '../engine/dataEngine';
import { EtlEngine } from '../engine/etlEngine';
import { saveProjectToStorage, loadProjectFromStorage, ProjectState } from '../engine/storage';
import { migrateProjectState, syncWhatIfWithModel } from '../engine/migrations';
import { globalDuckDb } from '../engine/duckdbEngine';

export const PRESET_THEMES: BiTheme[] = [
  {
    id: 'powerbi-classic',
    name: 'Power BI Clássico (Âmbar/Azul)',
    palette: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'],
    backgroundColor: '#ffffff',
    cardBackground: '#ffffff',
    borderColor: '#e2e8f0',
    textColor: '#1e293b',
  },
  {
    id: 'corporate-blue',
    name: 'Executivo Corporativo (Azul/Ciano)',
    palette: ['#1e3a8a', '#2563eb', '#38bdf8', '#0d9488', '#f59e0b', '#64748b', '#475569'],
    backgroundColor: '#f8fafc',
    cardBackground: '#ffffff',
    borderColor: '#cbd5e1',
    textColor: '#0f172a',
  },
  {
    id: 'emerald-growth',
    name: 'Esmeralda & Sustentabilidade (Verde)',
    palette: ['#065f46', '#059669', '#10b981', '#34d399', '#a7f3d0', '#f59e0b', '#0284c7'],
    backgroundColor: '#f0fdf4',
    cardBackground: '#ffffff',
    borderColor: '#bbf7d0',
    textColor: '#064e3b',
  },
  {
    id: 'purple-fintech',
    name: 'Finanças & Tecnologia (Roxo/Violeta)',
    palette: ['#581c87', '#7c3aed', '#a855f7', '#c084fc', '#f43f5e', '#fbbf24', '#06b6d4'],
    backgroundColor: '#faf5ff',
    cardBackground: '#ffffff',
    borderColor: '#e9d5ff',
    textColor: '#3b0764',
  },
  {
    id: 'dark-contrast',
    name: 'Alto Contraste Escuro (Neon)',
    palette: ['#fbbf24', '#38bdf8', '#4ade80', '#f472b6', '#a78bfa', '#f97316', '#34d399'],
    backgroundColor: '#0f172a',
    cardBackground: '#1e293b',
    borderColor: '#334155',
    textColor: '#f8fafc',
  },
  {
    id: 'warm-sunset',
    name: 'Pôr do Sol & Energia (Laranja/Rubi)',
    palette: ['#e11d48', '#ea580c', '#d97706', '#ca8a04', '#65a30d', '#0284c7', '#9333ea'],
    backgroundColor: '#fffbeb',
    cardBackground: '#ffffff',
    borderColor: '#fed7aa',
    textColor: '#7c2d12',
  },
  {
    id: 'ocean-depths',
    name: 'Oceano Profundo (Teal/Turquesa)',
    palette: ['#0f172a', '#1e293b', '#0369a1', '#0ea5e9', '#38bdf8', '#06b6d4', '#14b8a6'],
    backgroundColor: '#f0f9ff',
    cardBackground: '#ffffff',
    borderColor: '#bae6fd',
    textColor: '#0c4a6e',
  },
];

interface BiState {
  // Navigation & View
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  // Project Info
  projectName: string;
  setProjectName: (name: string) => void;
  lastSavedAt: string | null;

  // Schema
  tables: Table[];
  relationships: Relationship[];
  measures: Measure[];
  setTables: (tables: Table[]) => void;
  addTable: (table: Table) => void;
  addTables: (tables: Table[]) => void;
  updateTable: (id: string, partial: Partial<Table>) => void;
  deleteTable: (id: string) => void;
  duplicateTable: (id: string) => Table | undefined;

  addRelationship: (rel: Relationship) => void;
  deleteRelationship: (id: string) => void;

  addMeasure: (measure: Measure) => void;
  updateMeasure: (id: string, partial: Partial<Measure>) => void;
  deleteMeasure: (id: string) => void;
  editingMeasureId: string | null;
  setEditingMeasureId: (id: string | null) => void;
  openCustomMeasureModal: (measureId?: string) => void;

  // Pages & Visuals
  pages: Page[];
  activePageId: string;
  selectedVisualId: string | null;
  canvasZoom: number;
  isPresentationMode: boolean;
  layoutMode: 'desktop' | 'mobile';

  setActivePageId: (id: string) => void;
  addPage: (name?: string) => void;
  renamePage: (id: string, newName: string) => void;
  duplicatePage: (id: string) => void;
  deletePage: (id: string) => void;
  setSelectedVisualId: (id: string | null) => void;
  setCanvasZoom: (zoom: number) => void;
  setIsPresentationMode: (val: boolean) => void;
  setLayoutMode: (mode: 'desktop' | 'mobile') => void;

  addVisual: (type: VisualType, tableId?: string) => void;
  updateVisual: (id: string, partial: Partial<Visual>) => void;
  deleteVisual: (id: string) => void;

  // Filtering & Cross-filtering
  filters: Filter[];
  addFilter: (filter: Filter) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
  setCrossFilter: (tableId: string, column: string, value: any) => void;

  // Drill-through
  activeDrillthrough: ActiveDrillthrough | null;
  executeDrillthrough: (targetPageId: string, field: string, value: any, sourceVisualTitle?: string) => void;
  clearDrillthrough: (returnToSource?: boolean) => void;

  // Bookmarks
  bookmarks: Bookmark[];
  addBookmark: (name: string) => void;
  applyBookmark: (id: string) => void;
  deleteBookmark: (id: string) => void;

  // Dashboards & Goals
  dashboardTiles: DashboardTile[];
  goals: Goal[];
  pinVisualToDashboard: (visualId: string, pageId: string, title?: string) => void;
  removeDashboardTile: (tileId: string) => void;
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, partial: Partial<Goal>) => void;

  // Power Query / ETL
  appliedSteps: Record<string, PowerQueryStep[]>;
  applyQueryStep: (tableId: string, step: PowerQueryStep) => void;
  removeQueryStep: (tableId: string, stepId: string) => void;

  // Governance & RLS
  rlsRoles: RlsRole[];
  activeRole: string | null;
  setActiveRole: (roleId: string | null) => void;
  whatIfParameters: WhatIfParameter[];
  updateWhatIfValue: (id: string, value: number) => void;
  addWhatIfParameter: (param: WhatIfParameter) => void;

  // Performance Analyzer
  performanceMetrics: PerformanceMetric[];
  recordPerformanceMetric: (metric: PerformanceMetric) => void;

  // Theme & Appearance (Gerenciador de Temas)
  theme: string;
  activeThemeId: string;
  customThemes: BiTheme[];
  activePalette: string[];
  themeModalOpen: boolean;
  setThemeModalOpen: (open: boolean) => void;
  setTheme: (theme: string) => void;
  setThemeId: (themeId: string) => void;
  addCustomTheme: (theme: BiTheme) => void;
  deleteCustomTheme: (themeId: string) => void;

  // Grid & Canvas Settings
  gridSize: number;
  setGridSize: (size: number) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  snapToGrid: boolean;
  setSnapToGrid: (snap: boolean) => void;

  // Modals
  dataSourceModalOpen: boolean;
  setDataSourceModalOpen: (open: boolean) => void;
  quickMeasureModalOpen: boolean;
  setQuickMeasureModalOpen: (open: boolean) => void;
  customMeasureModalOpen: boolean;
  setCustomMeasureModalOpen: (open: boolean) => void;
  limitationsModalOpen: boolean;
  setLimitationsModalOpen: (open: boolean) => void;
  aiModalOpen: boolean;
  setAiModalOpen: (open: boolean) => void;

  // State actions
  newProject: (name?: string) => void;
  executeDuckDbQuery: (sql: string) => Promise<any[]>;
  loadInitialSampleData: () => void;
  generateCalendar: (startDate?: string, endDate?: string) => void;
  saveProject: () => Promise<void>;
  loadProject: () => Promise<boolean>;
  getProjectState: () => ProjectState;
  loadStateFromProject: (state: ProjectState) => void;
}

const defaultPageId = 'page_executivo';

const initialVisuals: Visual[] = [
  {
    id: 'vis_kpi_fat',
    type: 'card',
    title: 'Faturamento Total (R$)',
    x: 20,
    y: 20,
    w: 270,
    h: 120,
    dataConfig: {
      tableId: 'f_Vendas',
      yAxisFields: ['ValorTotal'],
      aggregation: 'SUM',
    },
    formatConfig: {
      showTitle: true,
      title: 'Faturamento Total Realizado',
      showDataLabels: true,
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 8,
    },
  },
  {
    id: 'vis_kpi_lucro',
    type: 'card',
    title: 'Lucro Bruto (R$)',
    x: 310,
    y: 20,
    w: 270,
    h: 120,
    dataConfig: {
      tableId: 'f_Vendas',
      yAxisFields: ['MargemLucro'],
      aggregation: 'SUM',
    },
    formatConfig: {
      showTitle: true,
      title: 'Margem Bruta Acumulada',
      showDataLabels: true,
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 8,
    },
  },
  {
    id: 'vis_kpi_margempct',
    type: 'card',
    title: 'Margem Bruta %',
    x: 600,
    y: 20,
    w: 270,
    h: 120,
    dataConfig: {
      tableId: 'f_Vendas',
      yAxisFields: ['MargemPercentual'],
      aggregation: 'AVG',
    },
    formatConfig: {
      showTitle: true,
      title: 'Margem Média Percentual',
      showDataLabels: true,
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 8,
    },
  },
  {
    id: 'vis_slicer_canal',
    type: 'slicer',
    title: 'Segmentação: Canal',
    x: 890,
    y: 20,
    w: 260,
    h: 120,
    dataConfig: {
      tableId: 'f_Vendas',
      xAxisField: 'Canal',
      slicerConfig: {
        mode: 'dropdown',
        selectedValues: [],
      },
    },
    formatConfig: {
      showTitle: true,
      title: 'Filtrar Canal de Venda',
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 8,
    },
  },
  {
    id: 'vis_col_categoria',
    type: 'column',
    title: 'Faturamento por Categoria de Produto',
    x: 20,
    y: 160,
    w: 560,
    h: 300,
    dataConfig: {
      tableId: 'f_Vendas',
      xAxisField: 'Categoria',
      yAxisFields: ['ValorTotal'],
      aggregation: 'SUM',
      sortField: 'ValorTotal',
      sortOrder: 'desc',
    },
    formatConfig: {
      showTitle: true,
      showLegend: false,
      showDataLabels: true,
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 8,
    },
  },
  {
    id: 'vis_line_evolucao',
    type: 'line',
    title: 'Evolução Mensal do Faturamento (2025)',
    x: 600,
    y: 160,
    w: 550,
    h: 300,
    dataConfig: {
      tableId: 'f_Vendas',
      xAxisField: 'Mes',
      yAxisFields: ['ValorTotal'],
      aggregation: 'SUM',
    },
    formatConfig: {
      showTitle: true,
      showDataLabels: false,
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 8,
    },
  },
  {
    id: 'vis_pie_regiao',
    type: 'donut',
    title: 'Distribuição Geográfica por Região',
    x: 20,
    y: 480,
    w: 370,
    h: 270,
    dataConfig: {
      tableId: 'f_Vendas',
      xAxisField: 'Regiao',
      yAxisFields: ['ValorTotal'],
      aggregation: 'SUM',
    },
    formatConfig: {
      showTitle: true,
      showLegend: true,
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 8,
    },
  },
  {
    id: 'vis_bar_vendedores',
    type: 'bar',
    title: 'Top Vendedores por Desempenho',
    x: 410,
    y: 480,
    w: 360,
    h: 270,
    dataConfig: {
      tableId: 'f_Vendas',
      xAxisField: 'Vendedor',
      yAxisFields: ['ValorTotal'],
      aggregation: 'SUM',
      sortOrder: 'desc',
    },
    formatConfig: {
      showTitle: true,
      showLegend: false,
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 8,
    },
  },
  {
    id: 'vis_table_transacoes',
    type: 'table',
    title: 'Detalhamento de Vendas Recentes',
    x: 790,
    y: 480,
    w: 360,
    h: 270,
    dataConfig: {
      tableId: 'f_Vendas',
      limit: 25,
    },
    formatConfig: {
      showTitle: true,
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 8,
    },
  },
];

const initialGoals: Goal[] = [
  {
    id: 'goal_fat_trimestral',
    name: 'Meta Faturamento 1º Semestre',
    target: 1500000,
    current: 1280000,
    unit: 'R$',
    owner: 'Camila Santos (Diretora Comercial)',
    deadline: '30/06/2025',
    status: 'on_track',
    history: [
      { date: 'Jan/25', value: 380000 },
      { date: 'Fev/25', value: 410000 },
      { date: 'Mar/25', value: 490000 },
    ],
  },
  {
    id: 'goal_margem_ebitda',
    name: 'EBITDA Acumulado',
    target: 350000,
    current: 295000,
    unit: 'R$',
    owner: 'Rodrigo Pires (CFO)',
    deadline: '30/06/2025',
    status: 'on_track',
    history: [
      { date: 'Jan/25', value: 85000 },
      { date: 'Fev/25', value: 102000 },
      { date: 'Mar/25', value: 108000 },
    ],
  },
  {
    id: 'goal_custo_km',
    name: 'Custo Médio por Km na Logística',
    target: 3.20,
    current: 3.48,
    unit: 'R$',
    owner: 'Carlos Silva (Gerente Logística)',
    deadline: '31/05/2025',
    status: 'at_risk',
    history: [
      { date: 'Jan/25', value: 3.65 },
      { date: 'Fev/25', value: 3.52 },
      { date: 'Mar/25', value: 3.48 },
    ],
  },
];

const initialWhatIf: WhatIfParameter[] = [
  {
    id: 'p_reajuste_preco',
    name: 'Reajuste Médio de Preço (%)',
    min: -20,
    max: 30,
    step: 1,
    defaultValue: 0,
    currentValue: 0,
    unit: '%',
  },
  {
    id: 'p_meta_crescimento',
    name: 'Crescimento de Volume Projetado (%)',
    min: -15,
    max: 50,
    step: 5,
    defaultValue: 10,
    currentValue: 10,
    unit: '%',
  },
];

export const useBiStore = create<BiState>((set, get) => {
  const initialData = getSampleDatasets();
  const initialSynced = syncWhatIfWithModel(initialWhatIf, initialData.tables, initialData.measures);
  globalDataEngine.setSchema(initialSynced.tables, initialData.relationships, initialSynced.measures);

  return {
    activeView: 'report',
    setActiveView: (view) => set({ activeView: view }),

    projectName: 'Relatório Executivo Geral - InsightHub',
    setProjectName: (name) => set({ projectName: name }),
    lastSavedAt: null,

    tables: initialSynced.tables,
    relationships: initialData.relationships,
    measures: initialSynced.measures,

    setTables: (tables) => {
      set({ tables });
      globalDataEngine.setSchema(tables, get().relationships, get().measures);
      tables.forEach(t => globalDuckDb.registerTable(t));
    },

    addTable: (table) => {
      const newTables = [...get().tables, table];
      set({ tables: newTables });
      globalDataEngine.setSchema(newTables, get().relationships, get().measures);
      globalDuckDb.registerTable(table);
    },

    addTables: (newTbls) => {
      const newTables = [...get().tables, ...newTbls];
      set({ tables: newTables });
      globalDataEngine.setSchema(newTables, get().relationships, get().measures);
      newTbls.forEach(t => globalDuckDb.registerTable(t));
    },

    updateTable: (id, partial) => {
      const newTables = get().tables.map(t => (t.id === id ? { ...t, ...partial } : t));
      set({ tables: newTables });
      globalDataEngine.setSchema(newTables, get().relationships, get().measures);
      const updated = newTables.find(t => t.id === id);
      if (updated) globalDuckDb.registerTable(updated);
    },

    deleteTable: (id) => {
      const newTables = get().tables.filter(t => t.id !== id);
      const newRels = get().relationships.filter(r => r.fromTable !== id && r.toTable !== id);
      set({ tables: newTables, relationships: newRels });
      globalDataEngine.setSchema(newTables, newRels, get().measures);
    },

    duplicateTable: (id) => {
      const orig = get().tables.find(t => t.id === id || t.name === id);
      if (!orig) return undefined;
      const baseName = orig.name;
      const newName = `${baseName}_Copia`;
      const newId = `${orig.id}_copia_${Math.random().toString(36).substring(2, 6)}`;
      const duplicated: Table = {
        id: newId,
        name: newName,
        originalName: orig.originalName || orig.name,
        columns: orig.columns.map(c => ({
          ...c,
          id: 'c_' + Math.random().toString(36).substring(2, 6),
        })),
        rows: orig.rows.map(r => ({ ...r })),
      };
      get().addTable(duplicated);
      const existingSteps = get().appliedSteps[orig.id] || [];
      if (existingSteps.length > 0) {
        set({
          appliedSteps: {
            ...get().appliedSteps,
            [newId]: [...existingSteps],
          },
        });
      }
      return duplicated;
    },

    addRelationship: (rel) => {
      const newRels = [...get().relationships, rel];
      set({ relationships: newRels });
      globalDataEngine.setSchema(get().tables, newRels, get().measures);
    },

    deleteRelationship: (id) => {
      const newRels = get().relationships.filter(r => r.id !== id);
      set({ relationships: newRels });
      globalDataEngine.setSchema(get().tables, newRels, get().measures);
    },

    addMeasure: (measure) => {
      const newMeasures = [...get().measures, measure];
      set({ measures: newMeasures });
      globalDataEngine.setSchema(get().tables, get().relationships, newMeasures);
    },

    updateMeasure: (id, partial) => {
      const newMeasures = get().measures.map(m => (m.id === id ? { ...m, ...partial } : m));
      set({ measures: newMeasures });
      globalDataEngine.setSchema(get().tables, get().relationships, newMeasures);
    },

    deleteMeasure: (id) => {
      const newMeasures = get().measures.filter(m => m.id !== id);
      set({ measures: newMeasures });
      globalDataEngine.setSchema(get().tables, get().relationships, newMeasures);
    },

    editingMeasureId: null,
    setEditingMeasureId: (id) => set({ editingMeasureId: id }),
    openCustomMeasureModal: (measureId) =>
      set({
        customMeasureModalOpen: true,
        editingMeasureId: measureId || null,
      }),

    // Pages & Visuals
    pages: [
      {
        id: defaultPageId,
        name: 'Visão Geral Executiva',
        order: 1,
        visuals: initialVisuals,
      },
      {
        id: 'page_dre',
        name: 'DRE & Finanças',
        order: 2,
        visuals: [
          {
            id: 'vis_dre_waterfall',
            type: 'waterfall',
            title: 'Demonstrativo do Resultado do Exercício (Cascata)',
            x: 20,
            y: 20,
            w: 720,
            h: 360,
            dataConfig: {
              tableId: 'f_DRE',
              xAxisField: 'ContaDRE',
              yAxisFields: ['ValorRealizado'],
              aggregation: 'SUM',
            },
            formatConfig: {
              showTitle: true,
              backgroundColor: '#ffffff',
              borderRadius: 8,
            },
          },
          {
            id: 'vis_dre_cards',
            type: 'card',
            title: 'Receita Bruta Total',
            x: 760,
            y: 20,
            w: 380,
            h: 160,
            dataConfig: {
              tableId: 'f_DRE',
              yAxisFields: ['ValorRealizado'],
              aggregation: 'SUM',
            },
            formatConfig: {
              showTitle: true,
              backgroundColor: '#ffffff',
              borderRadius: 8,
            },
          },
          {
            id: 'vis_dre_table',
            type: 'table',
            title: 'Detalhamento Contas DRE: Realizado vs Orçado',
            x: 20,
            y: 400,
            w: 1120,
            h: 320,
            dataConfig: {
              tableId: 'f_DRE',
              limit: 50,
            },
            formatConfig: {
              showTitle: true,
              backgroundColor: '#ffffff',
              borderRadius: 8,
            },
          },
        ],
      },
      {
        id: 'page_logistica',
        name: 'Logística & Frotas',
        order: 3,
        visuals: [
          {
            id: 'vis_log_rotas',
            type: 'bar',
            title: 'Receita de Frete por Rota',
            x: 20,
            y: 20,
            w: 560,
            h: 320,
            dataConfig: {
              tableId: 'f_Logistica',
              xAxisField: 'Rota',
              yAxisFields: ['ReceitaFrete'],
              aggregation: 'SUM',
            },
            formatConfig: {
              showTitle: true,
              backgroundColor: '#ffffff',
              borderRadius: 8,
            },
          },
          {
            id: 'vis_log_custo_km',
            type: 'scatter',
            title: 'Km Rodado vs Custo Total Viagem',
            x: 600,
            y: 20,
            w: 540,
            h: 320,
            dataConfig: {
              tableId: 'f_Logistica',
              xAxisField: 'KmRodado',
              yAxisFields: ['CustoTotalViagem'],
              aggregation: 'SUM',
            },
            formatConfig: {
              showTitle: true,
              backgroundColor: '#ffffff',
              borderRadius: 8,
            },
          },
        ],
      },
      {
        id: 'page_detalhes',
        name: 'Detalhamento de Entidade',
        order: 4,
        drillthroughConfig: {
          isDrillthroughPage: true,
          targetFields: ['Categoria', 'Regiao', 'Vendedor', 'Canal'],
        },
        visuals: [
          {
            id: 'vis_det_kpi_fat',
            type: 'card',
            title: 'Faturamento do Item / Entidade',
            x: 20,
            y: 20,
            w: 360,
            h: 120,
            dataConfig: {
              tableId: 'f_Vendas',
              yAxisFields: ['ValorTotal'],
              aggregation: 'SUM',
            },
            formatConfig: {
              showTitle: true,
              backgroundColor: '#ffffff',
              borderRadius: 8,
            },
          },
          {
            id: 'vis_det_kpi_lucro',
            type: 'card',
            title: 'Margem de Lucro Filtrada',
            x: 400,
            y: 20,
            w: 360,
            h: 120,
            dataConfig: {
              tableId: 'f_Vendas',
              yAxisFields: ['MargemLucro'],
              aggregation: 'SUM',
            },
            formatConfig: {
              showTitle: true,
              backgroundColor: '#ffffff',
              borderRadius: 8,
            },
          },
          {
            id: 'vis_det_kpi_qtd',
            type: 'card',
            title: 'Quantidade Total Vendida',
            x: 780,
            y: 20,
            w: 360,
            h: 120,
            dataConfig: {
              tableId: 'f_Vendas',
              yAxisFields: ['Quantidade'],
              aggregation: 'SUM',
            },
            formatConfig: {
              showTitle: true,
              backgroundColor: '#ffffff',
              borderRadius: 8,
            },
          },
          {
            id: 'vis_det_col_mes',
            type: 'column',
            title: 'Evolução Mensal do Item Selecionado',
            x: 20,
            y: 160,
            w: 680,
            h: 300,
            dataConfig: {
              tableId: 'f_Vendas',
              xAxisField: 'Mes',
              yAxisFields: ['ValorTotal'],
              aggregation: 'SUM',
            },
            formatConfig: {
              showTitle: true,
              showDataLabels: true,
              backgroundColor: '#ffffff',
              borderRadius: 8,
            },
          },
          {
            id: 'vis_det_donut_canal',
            type: 'donut',
            title: 'Mix por Canal de Venda',
            x: 720,
            y: 160,
            w: 420,
            h: 300,
            dataConfig: {
              tableId: 'f_Vendas',
              xAxisField: 'Canal',
              yAxisFields: ['ValorTotal'],
              aggregation: 'SUM',
            },
            formatConfig: {
              showTitle: true,
              showLegend: true,
              backgroundColor: '#ffffff',
              borderRadius: 8,
            },
          },
          {
            id: 'vis_det_table_vendas',
            type: 'table',
            title: 'Todas as Transações e Detalhes da Entidade Filtrada',
            x: 20,
            y: 480,
            w: 1120,
            h: 280,
            dataConfig: {
              tableId: 'f_Vendas',
              limit: 50,
            },
            formatConfig: {
              showTitle: true,
              backgroundColor: '#ffffff',
              borderRadius: 8,
            },
          },
        ],
      },
    ],
    activePageId: defaultPageId,
    selectedVisualId: null,
    canvasZoom: 100,
    isPresentationMode: false,
    layoutMode: 'desktop',

    setActivePageId: (id) => set({ activePageId: id, selectedVisualId: null }),

    addPage: (name) => {
      const newPageId = 'page_' + Math.random().toString(36).substr(2, 6);
      const newPage: Page = {
        id: newPageId,
        name: name || `Página ${get().pages.length + 1}`,
        order: get().pages.length + 1,
        visuals: [],
      };
      set({ pages: [...get().pages, newPage], activePageId: newPageId });
    },

    renamePage: (id, newName) => {
      set({
        pages: get().pages.map(p => (p.id === id ? { ...p, name: newName } : p)),
      });
    },

    duplicatePage: (id) => {
      const pageToDup = get().pages.find(p => p.id === id);
      if (!pageToDup) return;
      const newId = 'page_' + Math.random().toString(36).substr(2, 6);
      const duplicated: Page = {
        ...pageToDup,
        id: newId,
        name: `${pageToDup.name} (Cópia)`,
        order: get().pages.length + 1,
        visuals: pageToDup.visuals.map(v => ({
          ...v,
          id: 'vis_' + Math.random().toString(36).substr(2, 6),
        })),
      };
      set({ pages: [...get().pages, duplicated], activePageId: newId });
    },

    deletePage: (id) => {
      if (get().pages.length <= 1) return;
      const remaining = get().pages.filter(p => p.id !== id);
      set({
        pages: remaining,
        activePageId: remaining[0].id,
      });
    },

    setSelectedVisualId: (id) => set({ selectedVisualId: id }),
    setCanvasZoom: (zoom) => set({ canvasZoom: Math.max(50, Math.min(150, zoom)) }),
    setIsPresentationMode: (val) => set({ isPresentationMode: val }),
    setLayoutMode: (mode) => set({ layoutMode: mode }),

    addVisual: (type, tableId) => {
      const activePage = get().pages.find(p => p.id === get().activePageId);
      if (!activePage) return;

      const targetTable = tableId || get().tables[0]?.id || 'f_Vendas';
      const tbl = get().tables.find(t => t.id === targetTable);
      const numCol = tbl?.columns.find(c => c.dataType === 'number' || c.dataType === 'currency')?.name || 'ValorTotal';
      const catCol = tbl?.columns.find(c => c.dataType === 'text')?.name || 'Categoria';

      const newVisual: Visual = {
        id: 'vis_' + Math.random().toString(36).substr(2, 6),
        type,
        title: `Novo Visual (${type})`,
        x: 40 + (activePage.visuals.length % 3) * 40,
        y: 40 + (activePage.visuals.length % 3) * 40,
        w: type === 'card' || type === 'kpi' ? 260 : 480,
        h: type === 'card' || type === 'kpi' ? 120 : 280,
        dataConfig: {
          tableId: targetTable,
          xAxisField: catCol,
          yAxisFields: [numCol],
          aggregation: 'SUM',
        },
        formatConfig: {
          showTitle: true,
          backgroundColor: '#ffffff',
          borderColor: '#e2e8f0',
          borderRadius: 8,
          showDataLabels: true,
        },
      };

      set({
        pages: get().pages.map(p =>
          p.id === get().activePageId ? { ...p, visuals: [...p.visuals, newVisual] } : p
        ),
        selectedVisualId: newVisual.id,
      });
    },

    updateVisual: (id, partial) => {
      set({
        pages: get().pages.map(p => ({
          ...p,
          visuals: p.visuals.map(v => (v.id === id ? { ...v, ...partial } : v)),
        })),
      });
    },

    deleteVisual: (id) => {
      set({
        pages: get().pages.map(p => ({
          ...p,
          visuals: p.visuals.filter(v => v.id !== id),
        })),
        selectedVisualId: get().selectedVisualId === id ? null : get().selectedVisualId,
      });
    },

    // Filtering & Cross-filtering
    filters: [],

    addFilter: (filter) => {
      set({ filters: [...get().filters.filter(f => f.id !== filter.id), filter] });
    },

    removeFilter: (id) => {
      set({ filters: get().filters.filter(f => f.id !== id) });
    },

    clearFilters: () => {
      set({ filters: [] });
    },

    setCrossFilter: (tableId, column, value) => {
      let resolvedTableId = tableId;
      let cleanColumn = column;

      // Handle table prefix if present, e.g. "d_Clientes.Segmento"
      if (column.includes('.')) {
        const [prefixT, col] = column.split('.', 2);
        const matchT = get().tables.find(
          t => t.id === prefixT || t.name === prefixT || t.id.toLowerCase() === prefixT.toLowerCase() || t.name.toLowerCase() === prefixT.toLowerCase()
        );
        if (matchT) {
          resolvedTableId = matchT.id;
          cleanColumn = col;
        }
      } else {
        const targetTable = get().tables.find(t => t.id === tableId || t.name === tableId);
        if (targetTable && !targetTable.columns.some(c => c.name.toLowerCase() === column.toLowerCase())) {
          for (const t of get().tables) {
            if (t.columns.some(c => c.name.toLowerCase() === column.toLowerCase())) {
              resolvedTableId = t.id;
              cleanColumn = t.columns.find(c => c.name.toLowerCase() === column.toLowerCase())!.name;
              break;
            }
          }
        }
      }

      const targetTable = get().tables.find(t => t.id === resolvedTableId || t.name === resolvedTableId);
      const matchedTableId = targetTable ? targetTable.id : resolvedTableId;
      const matchedTableName = targetTable ? targetTable.name : resolvedTableId;

      const existing = get().filters.find(
        f => (f.tableId === matchedTableId || f.tableId === matchedTableName) &&
             f.column === cleanColumn &&
             f.level === 'visual'
      );

      // If value is empty, null, undefined or 'TODOS', or if clicked again on same value -> toggle off
      if (!value || value === 'TODOS' || (existing && existing.value === value)) {
        if (existing) {
          set({ filters: get().filters.filter(f => f.id !== existing.id) });
        }
      } else {
        const newFilter: Filter = {
          id: 'cross_' + matchedTableId + '_' + cleanColumn,
          level: 'visual',
          tableId: matchedTableId,
          column: cleanColumn,
          operator: 'equals',
          value,
        };
        set({
          filters: [
            ...get().filters.filter(
              f => f.id !== newFilter.id &&
                   !( (f.tableId === matchedTableId || f.tableId === matchedTableName) && f.column === cleanColumn && f.level === 'visual' )
            ),
            newFilter,
          ],
        });
      }
    },

    // Drill-through State & Actions
    activeDrillthrough: null,

    executeDrillthrough: (targetPageId, field, value, sourceVisualTitle) => {
      const state = get();
      const sourcePage = state.pages.find(p => p.id === state.activePageId) || state.pages[0];
      const sourceVisual = sourceVisualTitle || 'Visual';
      const filterId = `drill_filter_${Date.now()}`;

      // Identify table for this field (default to f_Vendas or first matching table)
      let tableId = 'f_Vendas';
      for (const t of state.tables) {
        if (t.columns.some(c => c.name.toLowerCase() === field.toLowerCase())) {
          tableId = t.id;
          break;
        }
      }

      const drillFilter: Filter = {
        id: filterId,
        level: 'page',
        tableId,
        column: field,
        operator: 'equals',
        value,
      };

      set({
        activePageId: targetPageId,
        selectedVisualId: null,
        filters: [...state.filters.filter(f => !f.id.startsWith('drill_filter_')), drillFilter],
        activeDrillthrough: {
          sourcePageId: sourcePage.id,
          sourcePageName: sourcePage.name,
          sourceVisualTitle: sourceVisual,
          field,
          value,
          filterId,
        },
      });
    },

    clearDrillthrough: (returnToSource = false) => {
      const state = get();
      const currentDrill = state.activeDrillthrough;
      const newFilters = currentDrill
        ? state.filters.filter(f => f.id !== currentDrill.filterId)
        : state.filters;

      const targetPageId = returnToSource && currentDrill ? currentDrill.sourcePageId : state.activePageId;

      set({
        activePageId: targetPageId,
        filters: newFilters,
        activeDrillthrough: null,
      });
    },

    // Bookmarks
    bookmarks: [
      {
        id: 'bm_padrao',
        name: 'Visão Geral Sem Filtros',
        activePageId: defaultPageId,
        filters: [],
      },
    ],

    addBookmark: (name) => {
      const newBm: Bookmark = {
        id: 'bm_' + Math.random().toString(36).substr(2, 6),
        name,
        activePageId: get().activePageId,
        filters: [...get().filters],
      };
      set({ bookmarks: [...get().bookmarks, newBm] });
    },

    applyBookmark: (id) => {
      const bm = get().bookmarks.find(b => b.id === id);
      if (bm) {
        set({
          activePageId: bm.activePageId,
          filters: [...bm.filters],
        });
      }
    },

    deleteBookmark: (id) => {
      set({ bookmarks: get().bookmarks.filter(b => b.id !== id) });
    },

    // Dashboard & Goals
    dashboardTiles: [
      {
        id: 'tile_1',
        visualId: 'vis_kpi_fat',
        pageId: defaultPageId,
        title: 'Faturamento Total da Empresa',
        x: 0,
        y: 0,
        w: 4,
        h: 2,
        alertThreshold: 500000,
        alertCondition: 'above',
      },
      {
        id: 'tile_2',
        visualId: 'vis_kpi_lucro',
        pageId: defaultPageId,
        title: 'Margem Bruta Geral',
        x: 4,
        y: 0,
        w: 4,
        h: 2,
      },
      {
        id: 'tile_3',
        visualId: 'vis_col_categoria',
        pageId: defaultPageId,
        title: 'Faturamento por Categoria',
        x: 0,
        y: 2,
        w: 8,
        h: 4,
      },
    ],
    goals: initialGoals,

    pinVisualToDashboard: (visualId, pageId, title) => {
      const existing = get().dashboardTiles.find(t => t.visualId === visualId);
      if (existing) return;
      const newTile: DashboardTile = {
        id: 'tile_' + Math.random().toString(36).substr(2, 6),
        visualId,
        pageId,
        title: title || 'Métrica Fixada',
        x: (get().dashboardTiles.length * 4) % 12,
        y: Math.floor(get().dashboardTiles.length / 3) * 3,
        w: 4,
        h: 3,
      };
      set({ dashboardTiles: [...get().dashboardTiles, newTile] });
    },

    removeDashboardTile: (tileId) => {
      set({ dashboardTiles: get().dashboardTiles.filter(t => t.id !== tileId) });
    },

    addGoal: (goal) => {
      set({ goals: [...get().goals, goal] });
    },

    updateGoal: (id, partial) => {
      set({
        goals: get().goals.map(g => (g.id === id ? { ...g, ...partial } : g)),
      });
    },

    // Power Query
    appliedSteps: {},

    applyQueryStep: (tableId, step) => {
      const targetTable = get().tables.find(t => t.id === tableId);
      if (!targetTable) return;

      const currentSteps = get().appliedSteps[tableId] || [];
      const updatedSteps = [...currentSteps, step];

      // Execute on initial raw table
      const res = EtlEngine.executePipeline(targetTable, [step]);
      get().updateTable(tableId, { columns: res.table.columns, rows: res.table.rows });

      set({
        appliedSteps: {
          ...get().appliedSteps,
          [tableId]: updatedSteps,
        },
      });
    },

    removeQueryStep: (tableId, stepId) => {
      const currentSteps = get().appliedSteps[tableId] || [];
      const filtered = currentSteps.filter(s => s.id !== stepId);
      set({
        appliedSteps: {
          ...get().appliedSteps,
          [tableId]: filtered,
        },
      });
    },

    // Governance & RLS
    rlsRoles: [
      {
        id: 'role_vendedor_sp',
        name: 'Vendedor Regional (São Paulo)',
        rules: [{ tableId: 'f_Vendas', filterExpression: "Estado = 'SP'" }],
      },
      {
        id: 'role_gestor_sul',
        name: 'Gerente Comercial (Região Sul)',
        rules: [{ tableId: 'f_Vendas', filterExpression: "Regiao = 'Sul'" }],
      },
    ],
    activeRole: null,
    setActiveRole: (roleId) => set({ activeRole: roleId }),

    whatIfParameters: initialWhatIf,
    updateWhatIfValue: (id, val) => {
      const updatedParams = get().whatIfParameters.map(p => (p.id === id ? { ...p, currentValue: val } : p));
      const synced = syncWhatIfWithModel(updatedParams, get().tables, get().measures);
      set({
        whatIfParameters: updatedParams,
        tables: synced.tables,
        measures: synced.measures,
      });
      globalDataEngine.setSchema(synced.tables, get().relationships, synced.measures);
    },

    addWhatIfParameter: (param) => {
      const updatedParams = [...get().whatIfParameters, param];
      const synced = syncWhatIfWithModel(updatedParams, get().tables, get().measures);
      set({
        whatIfParameters: updatedParams,
        tables: synced.tables,
        measures: synced.measures,
      });
      globalDataEngine.setSchema(synced.tables, get().relationships, synced.measures);
    },

    // Performance Analyzer
    performanceMetrics: [],
    recordPerformanceMetric: (metric) => {
      set({
        performanceMetrics: [metric, ...get().performanceMetrics.slice(0, 19)],
      });
    },

    // Theme & Appearance (Gerenciador de Temas)
    theme: 'powerbi-light',
    activeThemeId: 'powerbi-classic',
    customThemes: [],
    activePalette: PRESET_THEMES[0].palette,
    themeModalOpen: false,
    setThemeModalOpen: (open) => set({ themeModalOpen: open }),
    setTheme: (theme) => set({ theme }),
    setThemeId: (themeId) => {
      const all = [...PRESET_THEMES, ...get().customThemes];
      const found = all.find(t => t.id === themeId);
      if (found) {
        set({ activeThemeId: themeId, activePalette: found.palette });
      } else {
        set({ activeThemeId: themeId });
      }
    },
    addCustomTheme: (theme) => {
      const updated = [...get().customThemes.filter(t => t.id !== theme.id), theme];
      set({
        customThemes: updated,
        activeThemeId: theme.id,
        activePalette: theme.palette,
      });
    },
    deleteCustomTheme: (themeId) => {
      const updated = get().customThemes.filter(t => t.id !== themeId);
      const nextActive = get().activeThemeId === themeId ? 'powerbi-classic' : get().activeThemeId;
      const all = [...PRESET_THEMES, ...updated];
      const activeObj = all.find(t => t.id === nextActive) || PRESET_THEMES[0];
      set({
        customThemes: updated,
        activeThemeId: activeObj.id,
        activePalette: activeObj.palette,
      });
    },

    // Grid & Canvas Settings
    gridSize: 20,
    setGridSize: (gridSize) => set({ gridSize }),
    showGrid: true,
    setShowGrid: (showGrid) => set({ showGrid }),
    snapToGrid: true,
    setSnapToGrid: (snapToGrid) => set({ snapToGrid }),

    // Modals
    dataSourceModalOpen: false,
    setDataSourceModalOpen: (open) => set({ dataSourceModalOpen: open }),
    quickMeasureModalOpen: false,
    setQuickMeasureModalOpen: (open) => set({ quickMeasureModalOpen: open }),
    customMeasureModalOpen: false,
    setCustomMeasureModalOpen: (open) => set({ customMeasureModalOpen: open }),
    limitationsModalOpen: false,
    setLimitationsModalOpen: (open) => set({ limitationsModalOpen: open }),
    aiModalOpen: false,
    setAiModalOpen: (open) => set({ aiModalOpen: open }),

    // State actions
    newProject: (name?: string) => {
      const blankPageId = 'page_' + Math.random().toString(36).substr(2, 6);
      const blankState = {
        projectName: name || 'Novo Projeto em Branco',
        tables: [],
        relationships: [],
        measures: [],
        pages: [
          {
            id: blankPageId,
            name: 'Página 1',
            order: 1,
            visuals: [],
          },
        ],
        activePageId: blankPageId,
        selectedVisualId: null,
        activeView: 'report' as ActiveView,
        filters: [],
        bookmarks: [],
        dashboardTiles: [],
        goals: [],
        appliedSteps: {},
        performanceMetrics: [],
        lastSavedAt: null,
      };
      set(blankState);
      globalDataEngine.setSchema([], [], []);
      try {
        localStorage.removeItem('insighthub_project_backup');
      } catch {}
    },

    executeDuckDbQuery: async (sql: string) => {
      return await globalDuckDb.query(sql);
    },

    // Lifecycle & Persistence
    loadInitialSampleData: () => {
      const sample = getSampleDatasets();
      set({
        tables: sample.tables,
        relationships: sample.relationships,
        measures: sample.measures,
      });
      globalDataEngine.setSchema(sample.tables, sample.relationships, sample.measures);
      sample.tables.forEach(t => globalDuckDb.registerTable(t));
    },

    generateCalendar: (startDate = '2025-01-01', endDate = '2026-12-31') => {
      const cal = generateCalendarTable(startDate, endDate);
      const existingIdx = get().tables.findIndex(t => t.id === 'd_Calendario');
      if (existingIdx >= 0) {
        get().updateTable('d_Calendario', cal);
      } else {
        get().addTable(cal);
      }
      globalDuckDb.registerTable(cal);
    },

    getProjectState: () => {
      return {
        version: '1.0.0',
        projectName: get().projectName,
        tables: get().tables,
        relationships: get().relationships,
        measures: get().measures,
        pages: get().pages,
        activePageId: get().activePageId,
        filters: get().filters,
        bookmarks: get().bookmarks,
        dashboardTiles: get().dashboardTiles,
        goals: get().goals,
        rlsRoles: get().rlsRoles,
        whatIfParameters: get().whatIfParameters,
        theme: get().theme,
        activeThemeId: get().activeThemeId,
        customThemes: get().customThemes,
        gridSize: get().gridSize,
        showGrid: get().showGrid,
        snapToGrid: get().snapToGrid,
        updatedAt: new Date().toISOString(),
      };
    },

    saveProject: async () => {
      const state = get().getProjectState();
      const res = await saveProjectToStorage(state);
      if (res.success) {
        set({ lastSavedAt: `Salvo às ${res.timestamp}` });
      } else {
        console.error('Falha ao salvar projeto:', res.error);
        set({ lastSavedAt: 'Falha ao salvar' });
      }
    },

    loadProject: async () => {
      const state = await loadProjectFromStorage();
      if (!state) return false;
      get().loadStateFromProject(state);
      return true;
    },

    loadStateFromProject: (rawState: ProjectState) => {
      const state = migrateProjectState(rawState);
      const allThemes = [...PRESET_THEMES, ...(state.customThemes || [])];
      const matchedTheme = allThemes.find(t => t.id === state.activeThemeId) || PRESET_THEMES[0];

      set({
        projectName: state.projectName || 'Projeto InsightHub',
        tables: state.tables || [],
        relationships: state.relationships || [],
        measures: state.measures || [],
        pages: state.pages || [],
        activePageId: state.activePageId || state.pages?.[0]?.id || defaultPageId,
        filters: state.filters || [],
        bookmarks: state.bookmarks || [],
        dashboardTiles: state.dashboardTiles || [],
        goals: state.goals || [],
        rlsRoles: state.rlsRoles || [],
        whatIfParameters: state.whatIfParameters || [],
        theme: state.theme || 'powerbi-light',
        activeThemeId: state.activeThemeId || matchedTheme.id,
        customThemes: state.customThemes || [],
        activePalette: matchedTheme.palette,
        gridSize: state.gridSize || 20,
        showGrid: state.showGrid !== undefined ? state.showGrid : true,
        snapToGrid: state.snapToGrid !== undefined ? state.snapToGrid : true,
        lastSavedAt: new Date().toLocaleTimeString('pt-BR'),
      });
      globalDataEngine.setSchema(state.tables || [], state.relationships || [], state.measures || []);
      (state.tables || []).forEach(t => globalDuckDb.registerTable(t));
    },
  };
});
