import { Table, Measure, Filter } from '../types/bi';
import { ModelAccess, InMemoryModelAccess } from './model/modelAccess';
import { FilterContext, filterContextFromUIFilters } from './model/filterContext';
import { parseNumber } from './shared/valueParser';
import { DaxError } from './shared/errors';
import { validateDax } from './expr/validator';
import type { DaxValidationResult } from './expr/validator';
import { generateQuickMeasure } from './expr/quickMeasures';
import type { QuickMeasureType, QuickMeasureResult } from './expr/quickMeasures';
import { evaluateExpression } from './expr/evaluator';
import { isBlank, DAX_BLANK } from './expr/types';

export type { DaxValidationResult, QuickMeasureType, QuickMeasureResult };

export class DaxEngine {
  private static activeModelAccess: ModelAccess | null = null;

  /**
   * Injects an active ModelAccess instance into DaxEngine
   */
  public static setModelAccess(model: ModelAccess | null): void {
    DaxEngine.activeModelAccess = model;
  }

  /**
   * Retrieves current active ModelAccess instance
   */
  public static getModelAccess(): ModelAccess | null {
    return DaxEngine.activeModelAccess;
  }

  /**
   * Validate a DAX expression syntax and references using unified AST validator
   */
  public static validate(
    formula: string,
    availableTables: Table[],
    availableMeasures: Measure[]
  ): DaxValidationResult {
    return validateDax(formula, availableTables, availableMeasures);
  }

  /**
   * Split top-level arguments respecting quotes and parentheses (compatibility helper)
   */
  public static splitArgs(str: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString: false | "'" | '"' = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
        if (!inString) inString = char;
        else if (inString === char) inString = false;
      }

      if (!inString) {
        if (char === '(' || char === '[' || char === '{') depth++;
        else if (char === ')' || char === ']' || char === '}') depth--;
        else if (char === ',' && depth === 0) {
          args.push(current.trim());
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim().length > 0) {
      args.push(current.trim());
    }

    return args;
  }

  /**
   * Parse numeric values supporting currency formatting, decimals with comma, and string numbers
   * Delegates to unified valueParser.parseNumber
   */
  public static parseNumeric(val: any): number {
    const res = parseNumber(val);
    return res.value ?? 0;
  }

  /**
   * Evaluates a DAX expression with explicit FilterContext and ModelAccess.
   * Preserves BLANK and typed return values without truncation.
   */
  public static evaluateWithContext(
    formula: string,
    model: ModelAccess,
    filterContext?: FilterContext,
    callStack?: Set<string>,
    measureCache?: Map<string, any>
  ): any {
    const trimmed = (formula || '').trim();
    if (!trimmed) return DAX_BLANK;

    const cache = measureCache || new Map<string, any>();
    const effectiveFilterContext = filterContext || new FilterContext();

    return evaluateExpression(trimmed, {
      dialect: 'dax',
      model,
      tables: model.getTables(),
      measures: model.getMeasures(),
      filterContext: effectiveFilterContext,
      measureCache: cache,
      callStack,
      resolveMeasure: (name: string) => {
        const rawName = name.trim();
        const targetM =
          (model.getMeasures ? model.getMeasures() : []).find(
            m => m.name.toLowerCase() === rawName.toLowerCase()
          ) || (typeof model.getMeasure === 'function' ? model.getMeasure(rawName) : undefined);

        if (targetM) {
          const stack = callStack || new Set<string>();
          const normKey = targetM.name.toLowerCase();
          if (stack.has(normKey)) {
            throw new DaxError('Execution', `Referência circular detectada entre medidas: [${targetM.name}]`);
          }
          const nextStack = new Set(stack);
          nextStack.add(normKey);
          return DaxEngine.evaluateWithContext(targetM.formula, model, effectiveFilterContext, nextStack, cache);
        }
        return undefined;
      },
    });
  }

  /**
   * Evaluate a DAX formula against active rows and context.
   * Public facade maintaining backward compatibility with (tables, measures, activeFilters) signature.
   */
  public static evaluate(
    formula: string,
    tablesOrModel: Table[] | ModelAccess,
    measures?: Measure[],
    activeFilters: Filter[] = [],
    callStack?: Set<string>
  ): number {
    let model: ModelAccess;
    let tables: Table[];
    let measuresList: Measure[];

    if ('getTables' in tablesOrModel && typeof (tablesOrModel as ModelAccess).getTables === 'function') {
      model = tablesOrModel as ModelAccess;
      tables = model.getTables();
      measuresList = measures || model.getMeasures();
    } else {
      tables = tablesOrModel as Table[];
      measuresList = measures || [];
      model = DaxEngine.activeModelAccess || new InMemoryModelAccess(tables, [], measuresList);
    }

    const trimmed = (formula || '').trim();
    if (!trimmed) return 0;

    const filterContext = filterContextFromUIFilters(activeFilters, model);

    try {
      const evaluated = DaxEngine.evaluateWithContext(trimmed, model, filterContext, callStack);
      if (typeof evaluated === 'number') return isNaN(evaluated) ? 0 : evaluated;
      if (typeof evaluated === 'boolean') return evaluated ? 1 : 0;
      if (isBlank(evaluated) || evaluated === null || evaluated === undefined) return 0;
      const num = Number(evaluated);
      return isNaN(num) ? 0 : num;
    } catch (err: any) {
      if (err instanceof DaxError) {
        throw err;
      }
      console.error('DAX Evaluation Error in DaxEngine.evaluate:', err);
      const constantVal = Number(trimmed);
      return isNaN(constantVal) ? 0 : constantVal;
    }
  }

  /**
   * Helper: Generate Quick Measure formulas
   * Delegates to dedicated module
   */
  public static generateQuickMeasure(
    type: QuickMeasureType,
    baseMeasure: string,
    dimensionCol: string,
    table: string
  ): QuickMeasureResult {
    return generateQuickMeasure(type, baseMeasure, dimensionCol, table);
  }
}
