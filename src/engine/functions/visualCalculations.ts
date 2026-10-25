import { FunctionDefinition } from '../expr/registry';
import { DaxError } from '../shared/errors';
import {
  DAX_BLANK,
  isBlank,
  daxToNumber,
  daxAdd,
  daxDivide,
} from '../expr/types';

/**
 * Asserts that the current evaluation context is within a Visual Calculation
 */
export function assertVisualCalculation(context: any, fnName: string): void {
  if (!context?.isVisualCalculation) {
    throw new DaxError(
      'Semantic',
      `A função "${fnName}" só pode ser utilizada no escopo de Cálculos Visuais (Visual Calculations). Ela não é permitida em medidas comuns.`
    );
  }
}

/**
 * Extracts target field/column name from arg
 */
function extractColName(arg: any, context?: any): string {
  if (typeof arg === 'string') {
    return arg.replace(/[\[\]]/g, '').trim();
  }
  if (arg && typeof arg === 'object') {
    if (arg.column) return String(arg.column).replace(/[\[\]]/g, '').trim();
    if (arg.measure) return String(arg.measure).replace(/[\[\]]/g, '').trim();
    if (arg.name) return String(arg.name).replace(/[\[\]]/g, '').trim();
  }
  // If undefined, try finding the first numeric or measure column in visualRows
  if (context?.visualRows && context.visualRows.length > 0) {
    const keys = Object.keys(context.visualRows[0]);
    return keys[keys.length - 1] || 'Value';
  }
  return 'Value';
}

/**
 * Visual Calculation Functions conforming to https://dax.guide/
 */
export const VISUAL_CALCULATION_FUNCTIONS: Record<string, FunctionDefinition> = {
  // ==========================================
  // RUNNINGSUM
  // RUNNINGSUM(column, [reset], [axis])
  // ==========================================
  RUNNINGSUM: {
    name: 'RUNNINGSUM',
    category: 'Cálculo Visual',
    syntax: 'RUNNINGSUM(column, [reset], [axis])',
    description: 'Calcula a soma acumulada de uma coluna ao longo das linhas do visual.',
    example: 'RUNNINGSUM([Total Vendas])',
    minArgs: 1,
    maxArgs: 3,
    evaluate: ([colArg], context) => {
      assertVisualCalculation(context, 'RUNNINGSUM');

      const visualRows: Record<string, any>[] = context?.visualRows || [];
      const curIndex: number = context?.visualRowIndex ?? 0;
      const colName = extractColName(colArg, context);

      if (visualRows.length === 0 || curIndex < 0) {
        return DAX_BLANK;
      }

      let sum: any = DAX_BLANK;
      const limit = Math.min(curIndex, visualRows.length - 1);

      for (let i = 0; i <= limit; i++) {
        const val = visualRows[i]?.[colName];
        if (!isBlank(val) && val !== null && val !== undefined) {
          sum = isBlank(sum) ? daxToNumber(val, true) : daxAdd(sum, val);
        }
      }

      return sum;
    },
  },

  // ==========================================
  // MOVINGAVERAGE
  // MOVINGAVERAGE(column, windowSize, [reset], [axis])
  // ==========================================
  MOVINGAVERAGE: {
    name: 'MOVINGAVERAGE',
    category: 'Cálculo Visual',
    syntax: 'MOVINGAVERAGE(column, windowSize, [reset], [axis])',
    description: 'Calcula a média móvel de uma coluna no tamanho de janela especificado.',
    example: 'MOVINGAVERAGE([Total Vendas], 3)',
    minArgs: 2,
    maxArgs: 4,
    evaluate: ([colArg, windowArg], context) => {
      assertVisualCalculation(context, 'MOVINGAVERAGE');

      const visualRows: Record<string, any>[] = context?.visualRows || [];
      const curIndex: number = context?.visualRowIndex ?? 0;
      const windowSize = Math.max(1, Math.trunc(daxToNumber(windowArg, true)));
      const colName = extractColName(colArg, context);

      if (visualRows.length === 0 || curIndex < 0) {
        return DAX_BLANK;
      }

      const start = Math.max(0, curIndex - windowSize + 1);
      const end = curIndex;

      let sum = 0;
      let count = 0;

      for (let i = start; i <= end; i++) {
        const val = visualRows[i]?.[colName];
        if (!isBlank(val) && val !== null && val !== undefined) {
          sum += daxToNumber(val, true);
          count++;
        }
      }

      if (count === 0) return DAX_BLANK;
      return sum / count;
    },
  },

  // ==========================================
  // PREVIOUS
  // PREVIOUS(column, [offset], [reset], [axis])
  // ==========================================
  PREVIOUS: {
    name: 'PREVIOUS',
    category: 'Cálculo Visual',
    syntax: 'PREVIOUS(column, [offset], [reset], [axis])',
    description: 'Retorna o valor da linha anterior dentro do visual. Retorna BLANK na primeira linha.',
    example: '[Total Vendas] - PREVIOUS([Total Vendas])',
    minArgs: 1,
    maxArgs: 4,
    evaluate: ([colArg, offsetArg], context) => {
      assertVisualCalculation(context, 'PREVIOUS');

      const visualRows: Record<string, any>[] = context?.visualRows || [];
      const curIndex: number = context?.visualRowIndex ?? 0;
      const offset = offsetArg !== undefined ? Math.max(1, Math.trunc(daxToNumber(offsetArg, true))) : 1;
      const colName = extractColName(colArg, context);

      const targetIndex = curIndex - offset;
      if (targetIndex < 0 || targetIndex >= visualRows.length) {
        return DAX_BLANK;
      }

      const val = visualRows[targetIndex]?.[colName];
      return val ?? DAX_BLANK;
    },
  },

  // ==========================================
  // NEXT
  // NEXT(column, [offset], [reset], [axis])
  // ==========================================
  NEXT: {
    name: 'NEXT',
    category: 'Cálculo Visual',
    syntax: 'NEXT(column, [offset], [reset], [axis])',
    description: 'Retorna o valor da próxima linha dentro do visual. Retorna BLANK na última linha.',
    example: 'NEXT([Total Vendas])',
    minArgs: 1,
    maxArgs: 4,
    evaluate: ([colArg, offsetArg], context) => {
      assertVisualCalculation(context, 'NEXT');

      const visualRows: Record<string, any>[] = context?.visualRows || [];
      const curIndex: number = context?.visualRowIndex ?? 0;
      const offset = offsetArg !== undefined ? Math.max(1, Math.trunc(daxToNumber(offsetArg, true))) : 1;
      const colName = extractColName(colArg, context);

      const targetIndex = curIndex + offset;
      if (targetIndex >= visualRows.length || targetIndex < 0) {
        return DAX_BLANK;
      }

      const val = visualRows[targetIndex]?.[colName];
      return val ?? DAX_BLANK;
    },
  },

  // ==========================================
  // FIRST
  // FIRST(column, [reset], [axis])
  // ==========================================
  FIRST: {
    name: 'FIRST',
    category: 'Cálculo Visual',
    syntax: 'FIRST(column, [reset], [axis])',
    description: 'Retorna o valor da primeira linha no escopo do visual.',
    example: 'FIRST([Total Vendas])',
    minArgs: 1,
    maxArgs: 3,
    evaluate: ([colArg], context) => {
      assertVisualCalculation(context, 'FIRST');

      const visualRows: Record<string, any>[] = context?.visualRows || [];
      const colName = extractColName(colArg, context);

      if (visualRows.length === 0) return DAX_BLANK;
      return visualRows[0]?.[colName] ?? DAX_BLANK;
    },
  },

  // ==========================================
  // LAST
  // LAST(column, [reset], [axis])
  // ==========================================
  LAST: {
    name: 'LAST',
    category: 'Cálculo Visual',
    syntax: 'LAST(column, [reset], [axis])',
    description: 'Retorna o valor da última linha no escopo do visual.',
    example: 'LAST([Total Vendas])',
    minArgs: 1,
    maxArgs: 3,
    evaluate: ([colArg], context) => {
      assertVisualCalculation(context, 'LAST');

      const visualRows: Record<string, any>[] = context?.visualRows || [];
      const colName = extractColName(colArg, context);

      if (visualRows.length === 0) return DAX_BLANK;
      return visualRows[visualRows.length - 1]?.[colName] ?? DAX_BLANK;
    },
  },

  // ==========================================
  // RANGE
  // RANGE(from, to, [axis])
  // ==========================================
  RANGE: {
    name: 'RANGE',
    category: 'Cálculo Visual',
    syntax: 'RANGE(from, to, [axis])',
    description: 'Retorna o intervalo relativo de linhas no cálculo visual.',
    example: 'RANGE(-2, 0)',
    minArgs: 2,
    maxArgs: 3,
    evaluate: ([fromArg, toArg], context) => {
      assertVisualCalculation(context, 'RANGE');
      return {
        __isVisualRange: true,
        from: Math.trunc(daxToNumber(fromArg, true)),
        to: Math.trunc(daxToNumber(toArg, true)),
      };
    },
  },

  // ==========================================
  // COLLAPSE / COLLAPSEALL
  // COLLAPSE(column, [axis]) / COLLAPSEALL(column, [axis])
  // ==========================================
  COLLAPSE: {
    name: 'COLLAPSE',
    category: 'Cálculo Visual',
    syntax: 'COLLAPSE(column, [axis])',
    description: 'Agrupa no nível pai dentro da hierarquia do visual.',
    example: 'DIVIDE([Total Vendas], COLLAPSE([Total Vendas]))',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([colArg], context) => {
      assertVisualCalculation(context, 'COLLAPSE');

      const visualRows: Record<string, any>[] = context?.visualRows || [];
      const colName = extractColName(colArg, context);

      let sum = 0;
      for (const r of visualRows) {
        const v = r[colName];
        if (!isBlank(v) && v !== null && v !== undefined) {
          sum += daxToNumber(v, true);
        }
      }
      return sum;
    },
  },

  COLLAPSEALL: {
    name: 'COLLAPSEALL',
    category: 'Cálculo Visual',
    syntax: 'COLLAPSEALL(column, [axis])',
    description: 'Agrupa em todos os níveis no escopo do visual (total geral do visual).',
    example: 'DIVIDE([Total Vendas], COLLAPSEALL([Total Vendas]))',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([colArg], context) => {
      assertVisualCalculation(context, 'COLLAPSEALL');

      const visualRows: Record<string, any>[] = context?.visualRows || [];
      const colName = extractColName(colArg, context);

      let sum = 0;
      for (const r of visualRows) {
        const v = r[colName];
        if (!isBlank(v) && v !== null && v !== undefined) {
          sum += daxToNumber(v, true);
        }
      }
      return sum;
    },
  },

  EXPAND: {
    name: 'EXPAND',
    category: 'Cálculo Visual',
    syntax: 'EXPAND(column, [axis])',
    description: 'Expande para o próximo nível dentro da hierarquia do visual.',
    example: 'EXPAND([Total Vendas])',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([colArg], context) => {
      assertVisualCalculation(context, 'EXPAND');
      const curRow = context?.row;
      const colName = extractColName(colArg, context);
      return curRow?.[colName] ?? DAX_BLANK;
    },
  },

  EXPANDALL: {
    name: 'EXPANDALL',
    category: 'Cálculo Visual',
    syntax: 'EXPANDALL(column, [axis])',
    description: 'Expande para todos os níveis detalhados do visual.',
    example: 'EXPANDALL([Total Vendas])',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([colArg], context) => {
      assertVisualCalculation(context, 'EXPANDALL');
      const curRow = context?.row;
      const colName = extractColName(colArg, context);
      return curRow?.[colName] ?? DAX_BLANK;
    },
  },
};
