export type DataType = 'text' | 'number' | 'date' | 'boolean' | 'currency' | 'percentage';

export interface Column {
  id: string;
  name: string;
  originalName: string;
  dataType: DataType;
  dataCategory?: 'city' | 'state' | 'country' | 'url' | 'none';
  format?: string;
  isHidden?: boolean;
  isCalculated?: boolean;
  expression?: string;
  description?: string;
}

export interface ColumnProfile {
  columnName: string;
  totalCount: number;
  distinctCount: number;
  nullCount: number;
  validPercent: number;
  nullPercent: number;
  sampleDistribution: { value: string; count: number }[];
  minValue?: any;
  maxValue?: any;
  errorCount?: number;
}

export interface Table {
  id: string;
  name: string;
  originalName: string;
  columns: Column[];
  rows: Record<string, any>[];
  isCalculated?: boolean;
  expression?: string;
  isCalendar?: boolean;
  calendarDateColumn?: string;
  fiscalYearEndMonth?: number;
  calendarDiagnostics?: {
    isValid: boolean;
    isMarkedAsDateTable: boolean;
    dateColumn?: string;
    minDate?: string;
    maxDate?: string;
    totalDays: number;
    expectedDays: number;
    hasNulls: boolean;
    hasDuplicates: boolean;
    isContinuous: boolean;
    errors: string[];
    warnings: string[];
  };
  autoDateTimeEnabled?: boolean;
  isHidden?: boolean;
  isDim?: boolean;
  x?: number; // for model view coordinates
  y?: number;
}

export interface Relationship {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  cardinality: '1:N' | 'N:1' | '1:1' | 'N:N';
  crossFilterDirection: 'single' | 'both';
  isActive: boolean;
}

export interface Measure {
  id: string;
  name: string;
  tableName: string;
  formula: string;
  format: 'currency' | 'number' | 'percentage' | 'integer';
  formatString?: string;
  description?: string;
  displayFolder?: string;
}

export type VisualType =
  | 'column'
  | 'stacked-column'
  | 'bar'
  | 'stacked-bar'
  | 'line'
  | 'area'
  | 'combo'
  | 'pie'
  | 'donut'
  | 'treemap'
  | 'waterfall'
  | 'funnel'
  | 'scatter'
  | 'gauge'
  | 'card'
  | 'multi-card'
  | 'kpi'
  | 'table'
  | 'matrix'
  | 'slicer';

export interface ConditionalFormatRule {
  operator: '>' | '<' | '>=' | '<=' | '==' | 'between';
  value: number;
  value2?: number;
  color: string;
}

export interface VisualFormatConfig {
  showTitle: boolean;
  title?: string;
  titleColor?: string;
  titleFontSize?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  showDataLabels?: boolean;
  showLegend?: boolean;
  colorPalette?: string[];
  isTransparent?: boolean;
  showBlankAsZero?: boolean;
  conditionalFormatting?: {
    field: string;
    rules: ConditionalFormatRule[];
  };
}

export interface VisualDataConfig {
  tableId: string;
  xAxisField?: string;
  yAxisFields?: string[];
  legendField?: string;
  tooltipFields?: string[];
  aggregation?: 'SUM' | 'AVG' | 'COUNT' | 'DISTINCTCOUNT' | 'MIN' | 'MAX' | 'NONE';
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  drillFields?: string[];
  currentDrillLevel?: number;
  kpiTarget?: number;
  kpiComparisonField?: string;
  slicerConfig?: {
    mode: 'list' | 'dropdown' | 'slider' | 'relative-date';
    selectedValues?: any[];
    dateRange?: {
      start?: string;
      end?: string;
      relativePreset?: 'last7days' | 'last30days' | 'thisMonth' | 'thisYear' | 'all';
    };
  };
}

export interface Visual {
  id: string;
  type: VisualType;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex?: number;
  dataConfig: VisualDataConfig;
  formatConfig: VisualFormatConfig;
}

export interface DrillthroughConfig {
  isDrillthroughPage?: boolean;
  targetFields?: string[];
  keepAllFilters?: boolean;
}

export interface ActiveDrillthrough {
  sourcePageId: string;
  sourcePageName: string;
  sourceVisualTitle: string;
  field: string;
  value: any;
  filterId: string;
}

export interface Page {
  id: string;
  name: string;
  order: number;
  isHidden?: boolean;
  visuals: Visual[];
  backgroundColor?: string;
  layoutMode?: 'desktop' | 'mobile';
  drillthroughConfig?: DrillthroughConfig;
}

export interface Filter {
  id: string;
  level: 'visual' | 'page' | 'report';
  visualId?: string;
  tableId: string;
  column: string;
  operator: 'in' | 'notIn' | 'equals' | 'notEquals' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThan' | 'lessThanOrEqual' | 'between' | 'contains';
  value: any;
}

export interface Bookmark {
  id: string;
  name: string;
  activePageId: string;
  filters: Filter[];
}

export interface BiTheme {
  id: string;
  name: string;
  palette: string[];
  backgroundColor?: string;
  cardBackground?: string;
  borderColor?: string;
  textColor?: string;
  isCustom?: boolean;
}

export interface PowerQueryStep {
  id: string;
  name: string;
  type:
    | 'source'
    | 'rename'
    | 'changeType'
    | 'filter'
    | 'removeColumns'
    | 'removeColumn'
    | 'removeOtherColumns'
    | 'removeTopRows'
    | 'removeBottomRows'
    | 'removeBlankRows'
    | 'keepTopRows'
    | 'keepBottomRows'
    | 'useFirstRowAsHeaders'
    | 'useHeadersAsFirstRow'
    | 'detectDataTypes'
    | 'addCustomColumn'
    | 'conditionalColumn'
    | 'replaceValues'
    | 'splitColumn'
    | 'groupBy'
    | 'pivot'
    | 'unpivot'
    | 'sort'
    | 'deduplicate'
    | 'fillDown'
    | 'fillUp'
    | 'textTransform'
    | 'textExtract'
    | 'dateExtract'
    | 'addIndexColumn'
    | 'duplicateColumn';
  params: Record<string, any>;
  description?: string;
}

export interface TableQueryPipeline {
  tableId: string;
  steps: PowerQueryStep[];
}

export interface DashboardTile {
  id: string;
  visualId: string;
  pageId: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  alertThreshold?: number;
  alertCondition?: 'above' | 'below';
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: 'R$' | '%' | 'unidades' | 'horas' | 'km';
  owner: string;
  deadline: string;
  status: 'on_track' | 'at_risk' | 'delayed';
  history: { date: string; value: number }[];
}

export interface RlsRole {
  id: string;
  name: string;
  rules: {
    tableId: string;
    filterExpression: string; // e.g. "Regiao = 'Sudeste'"
  }[];
}

export interface WhatIfParameter {
  id: string;
  name: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  currentValue: number;
  unit: string;
}

export interface DataSourceConnection {
  id: string;
  name: string;
  type: 'file' | 'rest_api' | 'postgres' | 'mysql' | 'sqlserver' | 'oracle' | 'gateway';
  status: 'connected' | 'disconnected' | 'testing';
  config: {
    host?: string;
    database?: string;
    port?: number;
    username?: string;
    url?: string;
    headers?: Record<string, string>;
    gatewayUrl?: string;
    environment?: 'dev' | 'test' | 'prod';
  };
}

export interface PerformanceMetric {
  visualId: string;
  visualTitle: string;
  queryTimeMs: number;
  renderTimeMs: number;
  rowCount: number;
}

export type ActiveView = 'report' | 'data' | 'model' | 'query' | 'metabase' | 'dashboard' | 'governance';
