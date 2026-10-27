export type SupportedLanguage = 'pt-BR' | 'en-US' | 'es-ES';
export type SupportedCurrency = 'BRL' | 'USD' | 'EUR';

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  label: string;
}

export interface LanguageConfig {
  code: SupportedLanguage;
  label: string;
  shortLabel: string;
  flag: string;
}

export interface Translations {
  common: {
    save: string;
    saving: string;
    savedAt: string;
    saveFailed: string;
    open: string;
    cancel: string;
    confirm: string;
    delete: string;
    clear: string;
    all: string;
    search: string;
    export: string;
    import: string;
    new: string;
    close: string;
    loading: string;
    noData: string;
    value: string;
    total: string;
    uncategorized: string;
    actions: string;
    language: string;
    currency: string;
  };
  topBar: {
    newProject: string;
    newProjectTooltip: string;
    openInsight: string;
    openInsightTooltip: string;
    exportInsight: string;
    exportInsightTooltip: string;
    copilotAi: string;
    confirmNewProjectTitle: string;
    confirmNewProjectMessage: string;
  };
  ribbonTabs: {
    home: string;
    insert: string;
    modeling: string;
    view: string;
    help: string;
  };
  ribbonActions: {
    getData: string;
    transformData: string;
    refresh: string;
    newMeasure: string;
    quickMeasure: string;
    newParameter: string;
    newVisual: string;
    textBox: string;
    themeManager: string;
    snapToGrid: string;
    filtersPane: string;
    visualsPane: string;
    fieldsPane: string;
    presentationMode: string;
    mobileLayout: string;
    desktopLayout: string;
    daxDocs: string;
    about: string;
  };
  nav: {
    report: string;
    data: string;
    model: string;
    query: string;
    daxquery: string;
    metabase: string;
    dashboard: string;
    governance: string;
    daxcompliance?: string;
    limitations: string;
  };
  panes: {
    filters: {
      title: string;
      onThisPage: string;
      onAllPages: string;
      clearAll: string;
      noFilters: string;
      searchFields: string;
    };
    visualizations: {
      title: string;
      buildVisual: string;
      formatVisual: string;
      types: string;
      xAxis: string;
      yAxis: string;
      legend: string;
      tooltip: string;
    };
    fields: {
      title: string;
      search: string;
      tables: string;
      newMeasure: string;
    };
  };
  visualCard: {
    focusMode: string;
    restoreSize: string;
    deleteVisual: string;
    exportCsv: string;
    viewTable: string;
    viewChart: string;
    moveTooltip: string;
    noDataToDisplay: string;
    allRecords: string;
    selectField: string;
    drillthrough: string;
    openCalcModal: string;
  };
  report: {
    addPage: string;
    duplicatePage: string;
    renamePage: string;
    deletePage: string;
    fitToPage: string;
    emptyPageTitle: string;
    emptyPageSubtitle: string;
  };
}
