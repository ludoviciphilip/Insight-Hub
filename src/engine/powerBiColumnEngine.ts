import { Column } from '../types/bi';
import { evaluateExpression } from './expr/evaluator';
import { DaxError } from './shared/errors';
export type { FunctionDoc } from './expr/registry';
export {
  POWER_BI_FUNCTIONS,
  FUNCTION_REGISTRY,
  lookupFunction,
} from './expr/registry';

export interface RowEvaluationResult {
  value: any;
  error?: string;
}

/**
 * Power BI & Power Query Custom Column Expression Engine
 * Single facade delegating to the unified AST parser and typed evaluator.
 */
export class PowerBiColumnEngine {
  /**
   * Detailed evaluation for a single row returning computed value and error detail if any.
   */
  public static evaluateRowDetailed(
    expression: string,
    row: Record<string, any>,
    rowIndex: number,
    columns: Column[] = []
  ): RowEvaluationResult {
    let trimmed = (expression || '').trim();
    if (!trimmed) {
      return { value: null };
    }

    // Strip leading = or fx = if present (e.g. "=[Valor] * 2" or "= [Valor] * -1")
    if (trimmed.startsWith('=')) {
      trimmed = trimmed.slice(1).trim();
    } else if (trimmed.toLowerCase().startsWith('fx=')) {
      trimmed = trimmed.slice(3).trim();
    }

    if (!trimmed) {
      return { value: null };
    }

    try {
      const value = evaluateExpression(trimmed, {
        dialect: 'column',
        row,
        rowIndex,
        columns,
      });
      return { value };
    } catch (err: any) {
      const errorMsg =
        err instanceof DaxError
          ? err.message
          : err?.message || 'Erro na avaliação da fórmula';
      return {
        value: null,
        error: errorMsg,
      };
    }
  }

  /**
   * Evaluates an expression on a specific row
   */
  public static evaluateRow(
    expression: string,
    row: Record<string, any>,
    rowIndex: number,
    columns: Column[] = []
  ): any {
    const result = this.evaluateRowDetailed(expression, row, rowIndex, columns);
    return result.value;
  }
}
