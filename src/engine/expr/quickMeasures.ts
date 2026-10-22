import { Measure } from '../../types/bi';

export type QuickMeasureType =
  | 'pct_of_total'
  | 'yoy_growth'
  | 'mom_growth'
  | 'rolling_avg'
  | 'ranking';

export interface QuickMeasureResult {
  name: string;
  formula: string;
  format: Measure['format'];
}

/**
 * Generates quick measure formulas according to standard DAX patterns
 */
export function generateQuickMeasure(
  type: QuickMeasureType,
  baseMeasure: string,
  dimensionCol: string,
  table: string
): QuickMeasureResult {
  switch (type) {
    case 'pct_of_total':
      return {
        name: `% ${baseMeasure} do Total`,
        formula: `DIVIDE([${baseMeasure}], CALCULATE([${baseMeasure}], ALL(${table})), 0)`,
        format: 'percentage',
      };
    case 'yoy_growth':
      return {
        name: `Crescimento YoY ${baseMeasure}`,
        formula: `DIVIDE([${baseMeasure}] - CALCULATE([${baseMeasure}], SAMEPERIODLASTYEAR(d_Calendario[Data])), CALCULATE([${baseMeasure}], SAMEPERIODLASTYEAR(d_Calendario[Data])), 0)`,
        format: 'percentage',
      };
    case 'mom_growth':
      return {
        name: `Variação MoM ${baseMeasure}`,
        formula: `DIVIDE([${baseMeasure}] - CALCULATE([${baseMeasure}], DATEADD(d_Calendario[Data], -1, MONTH)), CALCULATE([${baseMeasure}], DATEADD(d_Calendario[Data], -1, MONTH)), 0)`,
        format: 'percentage',
      };
    case 'rolling_avg':
      return {
        name: `Média Móvel 3M ${baseMeasure}`,
        formula: `AVERAGE(${table}[${dimensionCol}])`,
        format: 'number',
      };
    case 'ranking':
      return {
        name: `Ranking por ${baseMeasure}`,
        formula: `RANKX(ALL(${table}), [${baseMeasure}])`,
        format: 'integer',
      };
  }
}
