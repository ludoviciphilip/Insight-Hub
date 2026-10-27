import { Table, Measure, Filter, RlsRole, CalculationGroup, UserDefinedFunction, Visual, DaxQueryExecutionResult } from '../types/bi';
import { ModelAccess, InMemoryModelAccess } from './model/modelAccess';
import { FilterContext, filterContextFromUIFilters } from './model/filterContext';
import { parseNumber } from './shared/valueParser';
import { DaxError } from './shared/errors';
import { validateDax } from './expr/validator';
import type { DaxValidationResult } from './expr/validator';
import { generateQuickMeasure } from './expr/quickMeasures';
import type { QuickMeasureType, QuickMeasureResult } from './expr/quickMeasures';
import { evaluateExpression, Evaluator } from './expr/evaluator';
import { isBlank, DAX_BLANK } from './expr/types';
import { DaxQueryExecutor, DaxQueryExecutionOptions } from './query/daxQueryExecutor';
import { UdfManager } from './model/udfManager';
import { renameMeasureReferences } from './model/dependencyGraph';

export type { DaxValidationResult, QuickMeasureType, QuickMeasureResult, DaxQueryExecutionOptions };

export function applyRlsRoleToFilterContext(
  role: RlsRole,
  filterContext: FilterContext,
  model: ModelAccess
): { olsHiddenTables: Set<string>; olsHiddenColumns: Set<string> } {
  const olsHiddenTables = new Set<string>();
  const olsHiddenColumns = new Set<string>();

  // Process OLS rules
  if (Array.isArray(role.olsRules)) {
    for (const rule of role.olsRules) {
      if (rule.access === 'none') {
        const table = model.getTable(rule.tableId);
        const normTableId = (table?.id || rule.tableId).toLowerCase().trim();
        const normTableName = (table?.name || rule.tableId).toLowerCase().trim();

        if (rule.column) {
          const normCol = rule.column.toLowerCase().trim();
          olsHiddenColumns.add(`${normTableId}::${normCol}`);
          olsHiddenColumns.add(`${normTableName}::${normCol}`);
          olsHiddenColumns.add(normCol);
        } else {
          olsHiddenTables.add(normTableId);
          olsHiddenTables.add(normTableName);
        }
      }
    }
  }

  // Process RLS rules
  if (Array.isArray(role.rules)) {
    for (const rule of role.rules) {
      if (!rule.filterExpression || !rule.filterExpression.trim()) continue;
      const table = model.getTable(rule.tableId);
      if (!table) continue;

      const colMatch = rule.filterExpression.match(/\[([a-zA-Z_][a-zA-Z0-9_]*)\]/);
      const filteredColName = colMatch ? colMatch[1] : (table.columns[0]?.name || 'ID');

      const allowedValues = new Set<any>();
      for (let i = 0; i < table.rows.length; i++) {
        const row = table.rows[i];
        try {
          const evaluator = new Evaluator({
            dialect: 'column',
            row,
            rowIndex: i,
            tableId: table.id,
            tableName: table.name,
            model,
            tables: model.getTables(),
            measures: model.getMeasures(),
          });
          const res = evaluator.evaluate(rule.filterExpression);
          if (
            res === true ||
            (typeof res === 'number' && res !== 0) ||
            (typeof res === 'string' && res.toLowerCase() === 'true')
          ) {
            allowedValues.add(row[filteredColName]);
          }
        } catch {
          // If evaluation fails, row is not allowed
        }
      }

      filterContext.setColumnFilter(
        table.id,
        filteredColName,
        {
          tableId: table.id,
          column: filteredColName,
          allowedValues,
          isRls: true,
          isPermanent: true,
        },
        true
      );
    }
  }

  return { olsHiddenTables, olsHiddenColumns };
}

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
    availableTables: Table[] = [],
    availableMeasures: Measure[] = []
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

  private static activeRole: RlsRole | null = null;
  private static activeUser: {
    username?: string;
    userPrincipalName?: string;
    userObjectId?: string;
    userCulture?: string;
    customData?: string;
  } | null = null;
  private static calculationGroups: CalculationGroup[] = [];

  public static setActiveRole(role: RlsRole | null): void {
    DaxEngine.activeRole = role;
  }

  public static getActiveRole(): RlsRole | null {
    return DaxEngine.activeRole;
  }

  public static setActiveUser(user: {
    username?: string;
    userPrincipalName?: string;
    userObjectId?: string;
    userCulture?: string;
    customData?: string;
  } | null): void {
    DaxEngine.activeUser = user;
  }

  public static getActiveUser() {
    return DaxEngine.activeUser;
  }

  public static setCalculationGroups(groups: CalculationGroup[]): void {
    DaxEngine.calculationGroups = groups;
  }

  public static getCalculationGroups(): CalculationGroup[] {
    return DaxEngine.calculationGroups;
  }

  public static setUserDefinedFunctions(udfs: UserDefinedFunction[]): void {
    UdfManager.setFunctions(udfs);
  }

  public static getUserDefinedFunctions(): UserDefinedFunction[] {
    return UdfManager.getFunctions();
  }

  /**
   * Executes a complete DAX query with DEFINE, EVALUATE, ORDER BY, START AT.
   */
  public static executeDaxQuery(
    queryText: string,
    model: ModelAccess,
    options: DaxQueryExecutionOptions = {}
  ): DaxQueryExecutionResult {
    return DaxQueryExecutor.execute(queryText, model, {
      ...options,
      activeUser: options.activeUser || DaxEngine.activeUser || undefined,
      calculationGroups: options.calculationGroups || DaxEngine.calculationGroups,
    });
  }

  /**
   * Renames a measure across the model, updating all dependent measure formulas and visuals.
   */
  public static renameMeasure(
    oldName: string,
    newName: string,
    measures: Measure[],
    visuals: Visual[] = []
  ): {
    updatedMeasures: Measure[];
    updatedVisuals: Visual[];
    affectedCount: number;
  } {
    return renameMeasureReferences(oldName, newName, measures, visuals);
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
    measureCache?: Map<string, any>,
    user?: { username?: string; userPrincipalName?: string; userObjectId?: string; userCulture?: string; customData?: string },
    activeRole?: RlsRole | null,
    calculationGroups?: CalculationGroup[]
  ): any {
    const trimmed = (formula || '').trim();
    if (!trimmed) return DAX_BLANK;

    const cache = measureCache || new Map<string, any>();
    const effectiveFilterContext = (filterContext || new FilterContext()).clone();

    const effRole = activeRole !== undefined ? activeRole : DaxEngine.activeRole;
    let olsHiddenTables: Set<string> | undefined;
    let olsHiddenColumns: Set<string> | undefined;

    if (effRole) {
      const ols = applyRlsRoleToFilterContext(effRole, effectiveFilterContext, model);
      olsHiddenTables = ols.olsHiddenTables;
      olsHiddenColumns = ols.olsHiddenColumns;
    }

    const effUser = user || DaxEngine.activeUser || {
      username: 'Admin',
      userPrincipalName: 'admin@insighthub.local',
      userObjectId: '00000000-0000-0000-0000-000000000001',
      userCulture: 'pt-BR',
      customData: '',
    };

    const effCalcGroups = calculationGroups || DaxEngine.calculationGroups;

    return evaluateExpression(trimmed, {
      dialect: 'dax',
      model,
      tables: model.getTables(),
      measures: model.getMeasures(),
      filterContext: effectiveFilterContext,
      measureCache: cache,
      callStack,
      user: effUser,
      activeRole: effRole,
      calculationGroups: effCalcGroups,
      olsHiddenTables,
      olsHiddenColumns,
      userDefinedFunctions: UdfManager.getFunctions(),
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
          return DaxEngine.evaluateWithContext(
            targetM.formula,
            model,
            effectiveFilterContext,
            nextStack,
            cache,
            effUser,
            effRole,
            effCalcGroups
          );
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
