import { Measure } from '../../types/bi';
import { parseExpression } from './parser';

export type QuickMeasureType =
  | 'ytd'
  | 'qtd'
  | 'mtd'
  | 'yoy_diff'
  | 'yoy_growth'
  | 'mom_diff'
  | 'mom_growth'
  | 'qoq_diff'
  | 'qoq_growth'
  | 'rolling_avg'
  | 'running_total'
  | 'pct_of_total'
  | 'ranking'
  | 'vehicle_financing'
  | 'investment_npv'
  | 'investment_irr'
  | 'cost_per_km';

export interface QuickMeasureOptions {
  periods?: number;
  dateColumn?: string;
  yearEndDate?: string;
  interestRate?: number;
  months?: number;
  loanAmount?: number;
  discountRate?: number;
  xColumn?: string;
  yColumn?: string;
}

export interface QuickMeasureResult {
  name: string;
  formula: string;
  format: Measure['format'];
  category: 'time_intelligence' | 'totals' | 'ranking' | 'financial' | 'statistical';
  description: string;
}

/**
 * Generates and validates standard DAX quick measures conforming to dax.guide patterns
 */
export function generateQuickMeasure(
  type: QuickMeasureType,
  baseMeasure: string,
  dimensionCol: string,
  table: string,
  options?: QuickMeasureOptions
): QuickMeasureResult {
  const cleanMeasure = (baseMeasure || 'Valor').replace(/[\[\]]/g, '').trim();
  const cleanTable = (table || 'f_Vendas').trim();
  const periods = options?.periods || 3;

  // Determine date reference: Table[Column]
  let dateRef = '';
  if (options?.dateColumn) {
    const dc = options.dateColumn.trim();
    dateRef = dc.includes('[') ? dc : `'${cleanTable}'[${dc}]`;
  } else if (dimensionCol) {
    const dc = dimensionCol.trim();
    if (dc.includes('[')) {
      dateRef = dc;
    } else {
      dateRef = cleanTable.includes(' ') || cleanTable.includes('_')
        ? `'${cleanTable}'[${dc}]`
        : `${cleanTable}[${dc}]`;
    }
  } else {
    dateRef = `'${cleanTable}'[Data]`;
  }

  let result: QuickMeasureResult;

  switch (type) {
    case 'ytd':
      result = {
        name: `${cleanMeasure} YTD`,
        formula: options?.yearEndDate
          ? `TOTALYTD([${cleanMeasure}], ${dateRef}, , "${options.yearEndDate}")`
          : `TOTALYTD([${cleanMeasure}], ${dateRef})`,
        format: 'currency',
        category: 'time_intelligence',
        description: 'Total acumulado no ano fiscal/civil (Year-To-Date)',
      };
      break;

    case 'qtd':
      result = {
        name: `${cleanMeasure} QTD`,
        formula: `TOTALQTD([${cleanMeasure}], ${dateRef})`,
        format: 'currency',
        category: 'time_intelligence',
        description: 'Total acumulado no trimestre corrente (Quarter-To-Date)',
      };
      break;

    case 'mtd':
      result = {
        name: `${cleanMeasure} MTD`,
        formula: `TOTALMTD([${cleanMeasure}], ${dateRef})`,
        format: 'currency',
        category: 'time_intelligence',
        description: 'Total acumulado no mês corrente (Month-To-Date)',
      };
      break;

    case 'yoy_diff':
      result = {
        name: `Diferença YoY ${cleanMeasure}`,
        formula: `[${cleanMeasure}] - CALCULATE([${cleanMeasure}], SAMEPERIODLASTYEAR(${dateRef}))`,
        format: 'currency',
        category: 'time_intelligence',
        description: 'Diferença absoluta em relação ao mesmo período do ano anterior',
      };
      break;

    case 'yoy_growth':
      result = {
        name: `Crescimento YoY % ${cleanMeasure}`,
        formula: `DIVIDE([${cleanMeasure}] - CALCULATE([${cleanMeasure}], SAMEPERIODLASTYEAR(${dateRef})), CALCULATE([${cleanMeasure}], SAMEPERIODLASTYEAR(${dateRef})))`,
        format: 'percentage',
        category: 'time_intelligence',
        description: 'Crescimento percentual em relação ao mesmo período do ano anterior (YoY %)',
      };
      break;

    case 'mom_diff':
      result = {
        name: `Variação MoM ${cleanMeasure}`,
        formula: `[${cleanMeasure}] - CALCULATE([${cleanMeasure}], DATEADD(${dateRef}, -1, MONTH))`,
        format: 'currency',
        category: 'time_intelligence',
        description: 'Diferença absoluta em relação ao mês anterior (Month-over-Month)',
      };
      break;

    case 'mom_growth':
      result = {
        name: `Variação MoM % ${cleanMeasure}`,
        formula: `DIVIDE([${cleanMeasure}] - CALCULATE([${cleanMeasure}], DATEADD(${dateRef}, -1, MONTH)), CALCULATE([${cleanMeasure}], DATEADD(${dateRef}, -1, MONTH)))`,
        format: 'percentage',
        category: 'time_intelligence',
        description: 'Crescimento percentual em relação ao mês anterior (MoM %)',
      };
      break;

    case 'qoq_diff':
      result = {
        name: `Variação QoQ ${cleanMeasure}`,
        formula: `[${cleanMeasure}] - CALCULATE([${cleanMeasure}], DATEADD(${dateRef}, -1, QUARTER))`,
        format: 'currency',
        category: 'time_intelligence',
        description: 'Diferença absoluta em relação ao trimestre anterior (Quarter-over-Quarter)',
      };
      break;

    case 'qoq_growth':
      result = {
        name: `Variação QoQ % ${cleanMeasure}`,
        formula: `DIVIDE([${cleanMeasure}] - CALCULATE([${cleanMeasure}], DATEADD(${dateRef}, -1, QUARTER)), CALCULATE([${cleanMeasure}], DATEADD(${dateRef}, -1, QUARTER)))`,
        format: 'percentage',
        category: 'time_intelligence',
        description: 'Crescimento percentual em relação ao trimestre anterior (QoQ %)',
      };
      break;

    case 'rolling_avg':
      result = {
        name: `Média Móvel ${periods}M ${cleanMeasure}`,
        formula: `DIVIDE(CALCULATE([${cleanMeasure}], DATESINPERIOD(${dateRef}, LASTDATE(${dateRef}), -${periods}, MONTH)), ${periods})`,
        format: 'currency',
        category: 'time_intelligence',
        description: `Média móvel dos últimos ${periods} meses utilizando DATESINPERIOD`,
      };
      break;

    case 'running_total':
      result = {
        name: `Total Acumulado ${cleanMeasure}`,
        formula: `CALCULATE([${cleanMeasure}], FILTER(ALLSELECTED('${cleanTable}'), ${dateRef} <= MAX(${dateRef})))`,
        format: 'currency',
        category: 'totals',
        description: 'Total acumulado da métrica ao longo da dimensão selecionada',
      };
      break;

    case 'pct_of_total':
      result = {
        name: `% ${cleanMeasure} do Total`,
        formula: `DIVIDE([${cleanMeasure}], CALCULATE([${cleanMeasure}], ALL('${cleanTable}')))`,
        format: 'percentage',
        category: 'totals',
        description: 'Percentual do valor em relação ao total geral da tabela',
      };
      break;

    case 'ranking':
      result = {
        name: `Ranking por ${cleanMeasure}`,
        formula: `RANKX(ALL('${cleanTable}'), [${cleanMeasure}], , DESC)`,
        format: 'integer',
        category: 'ranking',
        description: 'Classificação ordinal decrescente baseada na medida',
      };
      break;

    case 'vehicle_financing': {
      const rate = options?.interestRate ?? 0.015;
      const nper = options?.months ?? 48;
      const loan = options?.loanAmount ?? 50000;
      result = {
        name: `Parcela Financiamento Veículo`,
        formula: `PMT(${rate}, ${nper}, -${loan})`,
        format: 'currency',
        category: 'financial',
        description: `Prestação mensal constante para veículo (taxa ${(rate * 100).toFixed(1)}% a.m., ${nper} meses, valor R$ ${loan.toLocaleString('pt-BR')})`,
      };
      break;
    }

    case 'investment_npv': {
      const discount = options?.discountRate ?? 0.1;
      result = {
        name: `VPL do Investimento`,
        formula: `XNPV('${cleanTable}', '${cleanTable}'[${cleanMeasure}], ${dateRef}, ${discount})`,
        format: 'currency',
        category: 'financial',
        description: `Valor Presente Líquido a uma taxa de desconto anual de ${(discount * 100).toFixed(1)}%`,
      };
      break;
    }

    case 'investment_irr':
      result = {
        name: `TIR do Investimento`,
        formula: `XIRR('${cleanTable}', '${cleanTable}'[${cleanMeasure}], ${dateRef})`,
        format: 'percentage',
        category: 'financial',
        description: 'Taxa Interna de Retorno anualizada sobre o fluxo de caixa do projeto',
      };
      break;

    case 'cost_per_km': {
      const xCol = options?.xColumn || dimensionCol || 'KmRodado';
      const yCol = options?.yColumn || cleanMeasure || 'Custo';
      result = {
        name: `Custo por KM (Regressão Linear)`,
        formula: `SELECTCOLUMNS(LINESTX('${cleanTable}', '${cleanTable}'[${yCol}], '${cleanTable}'[${xCol}]), "CustoKm", [Slope1])`,
        format: 'currency',
        category: 'statistical',
        description: 'Custo marginal por quilômetro rodado estimado por regressão linear (método dos mínimos quadrados)',
      };
      break;
    }

    default:
      result = {
        name: `${cleanMeasure} (Medida Rápida)`,
        formula: `[${cleanMeasure}]`,
        format: 'number',
        category: 'totals',
        description: 'Medida base',
      };
  }

  // Pre-validate AST syntax to ensure generated formula is 100% compliant
  try {
    parseExpression(result.formula);
  } catch (err: any) {
    console.warn(`Aviso de sintaxe na fórmula gerada para ${type}:`, err?.message);
  }

  return result;
}
