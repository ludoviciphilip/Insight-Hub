import {
  ASTNode,
  LiteralNode,
  ColumnRefNode,
  MeasureRefNode,
  VariableRefNode,
  UnaryOpNode,
  BinaryOpNode,
  FunctionCallNode,
  TableConstructorNode,
  VarReturnNode,
} from './ast';
import { parseExpression } from './parser';
import { lookupFunction } from './registry';
import {
  DAX_BLANK,
  isBlank,
  isBlankOrEmpty,
  daxToBoolean,
  daxToNumber,
  daxToString,
  daxAdd,
  daxSubtract,
  daxMultiply,
  daxDivide,
  daxPower,
  daxMod,
  daxConcat,
  daxEqual,
  daxStrictEqual,
  daxNotEqual,
  daxCompare,
  daxIn,
} from './types';
import { DaxError } from '../shared/errors';
import { Table, Measure, Filter, Column, Relationship } from '../../types/bi';
import { ModelAccess } from '../model/modelAccess';
import { FilterContext } from '../model/filterContext';
import { RowContextStack } from '../model/rowContext';

export interface EvalContext {
  dialect?: 'dax' | 'column';
  row?: Record<string, any>;
  rowIndex?: number;
  tableId?: string;
  tableName?: string;
  columns?: Column[];
  variables?: Map<string, any>;
  measures?: Measure[];
  tables?: Table[];
  model?: ModelAccess | null;
  activeFilters?: Filter[];
  filterContext?: FilterContext;
  rowContextStack?: RowContextStack;
  measureCache?: Map<string, any>;
  relationships?: Relationship[];
  resolveMeasure?: (name: string) => any;
  callStack?: Set<string>;
}

export class Evaluator {
  private context: EvalContext;

  constructor(context: EvalContext = {}) {
    this.context = {
      ...context,
      dialect: context.dialect || 'dax',
      variables: new Map(context.variables || []),
      callStack: new Set(context.callStack || []),
    };
  }

  public evaluate(nodeOrExpression: ASTNode | string): any {
    const node =
      typeof nodeOrExpression === 'string'
        ? parseExpression(nodeOrExpression, {
            dialect: this.context.dialect,
            knownColumnNames: this.context.columns?.map(c => c.name),
          })
        : nodeOrExpression;

    return this.evalNode(node);
  }

  private evalNode(node: ASTNode): any {
    switch (node.kind) {
      case 'Literal':
        return this.evalLiteral(node);

      case 'ColumnRef':
        return this.evalColumnRef(node);

      case 'MeasureRef':
        return this.evalMeasureRef(node);

      case 'VariableRef':
        return this.evalVariableRef(node);

      case 'UnaryOp':
        return this.evalUnaryOp(node);

      case 'BinaryOp':
        return this.evalBinaryOp(node);

      case 'FunctionCall':
        return this.evalFunctionCall(node);

      case 'TableConstructor':
        return this.evalTableConstructor(node);

      case 'VarReturn':
        return this.evalVarReturn(node);

      default:
        throw new DaxError('Execution', `Tipo de nó desconhecido na AST: ${(node as any)?.kind}`);
    }
  }

  private evalLiteral(node: LiteralNode): any {
    if (node.literalType === 'blank') {
      return DAX_BLANK;
    }
    return node.value;
  }

  private evaluateMeasure(measure: Measure): any {
    const normName = measure.name.toLowerCase();
    const stack = this.context.callStack || new Set<string>();

    if (stack.has(normName)) {
      throw new DaxError('Execution', `Referência circular detectada entre medidas: [${measure.name}]`);
    }

    const nextStack = new Set(stack);
    nextStack.add(normName);

    // Context Transition: When a measure is evaluated inside a row context (e.g. SUMX, calculated column),
    // the row context is converted into filter context.
    const model = this.context.model;
    let activeFilterCtx = this.context.filterContext;

    if (this.context.rowContextStack && !this.context.rowContextStack.isEmpty() && model) {
      activeFilterCtx = this.context.rowContextStack.transitionToFilterContext(
        activeFilterCtx || new FilterContext(),
        model
      );
    } else if (this.context.row && model) {
      const base = activeFilterCtx ? activeFilterCtx.clone() : new FilterContext();
      const tableId = this.context.tableId || '';
      const table = tableId ? model.getTable(tableId) : undefined;
      if (table) {
        table.columns.forEach(col => {
          const val = this.context.row![col.name];
          base.setColumnFilter(
            table.id,
            col.name,
            {
              tableId: table.id,
              column: col.name,
              allowedValues: new Set([val]),
              isKeepFilters: false,
            },
            false
          );
        });
      }
      activeFilterCtx = base;
    }

    // Measure cache lookup
    const cacheKey = activeFilterCtx
      ? `${normName}@${activeFilterCtx.hash()}`
      : `${normName}@global`;

    if (this.context.measureCache && this.context.measureCache.has(cacheKey)) {
      return this.context.measureCache.get(cacheKey);
    }

    const childEval = new Evaluator({
      ...this.context,
      dialect: 'dax',
      filterContext: activeFilterCtx,
      row: undefined,
      rowIndex: undefined,
      rowContextStack: undefined,
      callStack: nextStack,
    });

    const result = childEval.evaluate(measure.formula);

    if (this.context.measureCache) {
      this.context.measureCache.set(cacheKey, result);
    }

    return result;
  }

  private evalColumnRef(node: ColumnRefNode): any {
    // 1. In DAX, unqualified [Identifier] without a table prefix can be a Measure
    if (!node.table) {
      if (this.context.measures) {
        const found = this.context.measures.find(
          m => m.name.toLowerCase() === node.column.toLowerCase()
        );
        if (found) {
          return this.evaluateMeasure(found);
        }
      }

      if (this.context.model && typeof (this.context.model as any).getMeasure === 'function') {
        const found = (this.context.model as any).getMeasure(node.column);
        if (found) {
          return this.evaluateMeasure(found);
        }
      }

      if (this.context.resolveMeasure) {
        try {
          const res = this.context.resolveMeasure(node.column);
          if (res !== undefined) return res;
        } catch (e: any) {
          if (
            e instanceof DaxError &&
            (e.kind === 'Execution' || (e as any).type === 'Execution') &&
            e.message.toLowerCase().includes('circular')
          ) {
            throw e;
          }
        }
      }
    }

    // 2. Otherwise evaluate against row context
    let row = this.context.row;
    if (!row && this.context.rowContextStack && !this.context.rowContextStack.isEmpty()) {
      row = this.context.rowContextStack.peek()?.row;
    }

    if (!row) {
      throw new DaxError(
        'Execution',
        `A coluna [${node.column}] não pode ser acessada sem contexto de linha (use uma função de agregação como SUM ou verifique se é uma medida válida)`
      );
    }

    const colName = node.column;
    // Exact match first
    if (colName in row) {
      return row[colName] ?? DAX_BLANK;
    }

    // Case-insensitive match
    const lower = colName.toLowerCase();
    for (const [key, val] of Object.entries(row)) {
      if (key.toLowerCase() === lower) {
        return val ?? DAX_BLANK;
      }
    }

    // Not found in row
    return DAX_BLANK;
  }

  private evalMeasureRef(node: MeasureRefNode): any {
    const mName = node.measure;

    // Check measures list
    if (this.context.measures) {
      const found = this.context.measures.find(
        m => m.name.toLowerCase() === mName.toLowerCase()
      );
      if (found) {
        return this.evaluateMeasure(found);
      }
    }

    // Check model.getMeasure
    if (this.context.model && typeof (this.context.model as any).getMeasure === 'function') {
      const found = (this.context.model as any).getMeasure(mName);
      if (found) {
        return this.evaluateMeasure(found);
      }
    }

    // Check custom resolver if not in measures or model
    if (this.context.resolveMeasure) {
      const res = this.context.resolveMeasure(mName);
      if (res !== undefined) return res;
    }

    // In column dialect, a [Bracket] might be a column if not found as measure
    if (this.context.row || (this.context.rowContextStack && !this.context.rowContextStack.isEmpty())) {
      const colRef: ColumnRefNode = { kind: 'ColumnRef', column: mName };
      return this.evalColumnRef(colRef);
    }

    throw new DaxError('Reference', `A medida [${mName}] não foi encontrada`);
  }

  private evalVariableRef(node: VariableRefNode): any {
    const vName = node.name.toLowerCase();
    if (this.context.variables && this.context.variables.has(vName)) {
      return this.context.variables.get(vName);
    }

    // In column dialect, an unbracketed identifier might be a column
    if (this.context.dialect === 'column' && (this.context.row || (this.context.rowContextStack && !this.context.rowContextStack.isEmpty()))) {
      return this.evalColumnRef({ kind: 'ColumnRef', column: node.name });
    }

    throw new DaxError('Reference', `A variável VAR "${node.name}" não está definida no escopo`);
  }

  private evalUnaryOp(node: UnaryOpNode): any {
    const operand = this.evalNode(node.operand);

    switch (node.operator) {
      case '-': {
        if (isBlank(operand)) return DAX_BLANK;
        const n = daxToNumber(operand, true);
        return -n;
      }
      case '+': {
        if (isBlank(operand)) return DAX_BLANK;
        return daxToNumber(operand, true);
      }
      case 'NOT':
        return !daxToBoolean(operand);
      default:
        throw new DaxError('Execution', `Operador unário não suportado: ${node.operator}`);
    }
  }

  private evalBinaryOp(node: BinaryOpNode): any {
    // Short-circuit operators (&&, ||)
    if (node.operator === '&&') {
      const leftVal = this.evalNode(node.left);
      if (!daxToBoolean(leftVal)) {
        return false;
      }
      const rightVal = this.evalNode(node.right);
      return daxToBoolean(rightVal);
    }

    if (node.operator === '||') {
      const leftVal = this.evalNode(node.left);
      if (daxToBoolean(leftVal)) {
        return true;
      }
      const rightVal = this.evalNode(node.right);
      return daxToBoolean(rightVal);
    }

    const left = this.evalNode(node.left);
    const right = this.evalNode(node.right);
    const isColDialect = this.context.dialect === 'column';

    switch (node.operator) {
      case '+':
        return daxAdd(left, right);
      case '-':
        return daxSubtract(left, right);
      case '*':
        return daxMultiply(left, right);
      case '/':
        return daxDivide(left, right, isColDialect);
      case '^':
        return daxPower(left, right);
      case '%':
        return daxMod(left, right);
      case '&':
        return daxConcat(left, right);
      case '=':
        return daxEqual(left, right);
      case '==':
        return daxStrictEqual(left, right);
      case '<>':
        return daxNotEqual(left, right);
      case '<':
        return daxCompare(left, right) < 0;
      case '<=':
        return daxCompare(left, right) <= 0;
      case '>':
        return daxCompare(left, right) > 0;
      case '>=':
        return daxCompare(left, right) >= 0;
      case 'IN':
        return daxIn(left, right);
      default:
        throw new DaxError('Execution', `Operador binário não suportado: ${node.operator}`);
    }
  }

  private evalFunctionCall(node: FunctionCallNode): any {
    const fnName = node.name.toUpperCase();

    // 1. CALCULATE & CALCULATETABLE
    if (fnName === 'CALCULATE' || fnName === 'CALCULATETABLE') {
      return this.evalCalculate(node);
    }

    // 2. Iterators
    if ([
      'SUMX',
      'AVERAGEX',
      'MINX',
      'MAXX',
      'COUNTX',
      'COUNTAX',
      'PRODUCTX',
      'MEDIANX',
      'CONCATENATEX',
    ].includes(fnName)) {
      return this.evalIterator(node);
    }

    // 3. FILTER
    if (fnName === 'FILTER') {
      return this.evalFilter(node);
    }

    // 4. Lazy Evaluation Functions
    if (fnName === 'IF') {
      if (node.args.length < 2 || node.args.length > 3) {
        throw new DaxError('Semantic', `IF requer 2 ou 3 argumentos, fornecidos: ${node.args.length}`);
      }
      const testNode = node.args[0];
      const condition = testNode ? this.evalNode(testNode) : false;

      if (daxToBoolean(condition)) {
        const trueNode = node.args[1];
        return trueNode ? this.evalNode(trueNode) : DAX_BLANK;
      } else {
        const falseNode = node.args[2];
        return falseNode ? this.evalNode(falseNode) : DAX_BLANK;
      }
    }

    if (fnName === 'IFERROR') {
      if (node.args.length !== 2) {
        throw new DaxError('Semantic', `IFERROR requer 2 argumentos, fornecidos: ${node.args.length}`);
      }
      try {
        const primary = node.args[0] ? this.evalNode(node.args[0]) : DAX_BLANK;
        return primary;
      } catch {
        return node.args[1] ? this.evalNode(node.args[1]) : DAX_BLANK;
      }
    }

    if (fnName === 'SWITCH') {
      if (node.args.length < 3) {
        throw new DaxError('Semantic', `SWITCH requer no mínimo 3 argumentos (expressão, valor1, resultado1, ...)`);
      }
      const exprNode = node.args[0];
      const targetVal = exprNode ? this.evalNode(exprNode) : DAX_BLANK;

      const remainingArgs = node.args.slice(1);
      let i = 0;
      while (i < remainingArgs.length - 1) {
        const valNode = remainingArgs[i];
        const resNode = remainingArgs[i + 1];

        const val = valNode ? this.evalNode(valNode) : DAX_BLANK;
        if (daxEqual(targetVal, val)) {
          return resNode ? this.evalNode(resNode) : DAX_BLANK;
        }
        i += 2;
      }

      if (i < remainingArgs.length) {
        const elseNode = remainingArgs[i];
        return elseNode ? this.evalNode(elseNode) : DAX_BLANK;
      }

      return DAX_BLANK;
    }

    if (fnName === 'COALESCE') {
      if (node.args.length < 1) {
        throw new DaxError('Semantic', 'COALESCE requer pelo menos 1 argumento');
      }
      for (const argNode of node.args) {
        if (!argNode) continue;
        const val = this.evalNode(argNode);
        if (this.context.dialect === 'column') {
          if (!isBlankOrEmpty(val)) return val;
        } else {
          if (!isBlank(val)) return val;
        }
      }
      return DAX_BLANK;
    }

    if (fnName === 'IFS') {
      const args = node.args;
      let i = 0;
      while (i < args.length - 1) {
        const condNode = args[i];
        const valNode = args[i + 1];
        const cond = condNode ? this.evalNode(condNode) : false;
        if (daxToBoolean(cond)) {
          return valNode ? this.evalNode(valNode) : DAX_BLANK;
        }
        i += 2;
      }
      if (i < args.length && args[i]) {
        return this.evalNode(args[i]!);
      }
      return DAX_BLANK;
    }

    if (fnName === 'ISERROR') {
      if (node.args.length !== 1) {
        throw new DaxError('Semantic', 'ISERROR requer exatamente 1 argumento');
      }
      try {
        if (node.args[0]) {
          this.evalNode(node.args[0]);
        }
        return false;
      } catch {
        return true;
      }
    }

    if (fnName === 'COUNTROWS') {
      if (node.args.length !== 1 || !node.args[0]) {
        throw new DaxError('Semantic', 'COUNTROWS requer exatamente 1 argumento (tabela)');
      }
      const arg = node.args[0];
      let tableName = '';
      if (arg.kind === 'ColumnRef') {
        tableName = arg.table || arg.column;
      } else if (arg.kind === 'VariableRef') {
        tableName = arg.name;
      } else if (arg.kind === 'Literal') {
        tableName = String(arg.value);
      }
      const model = this.context.model;
      const tables = this.context.tables || [];
      const table =
        (model && typeof model.getTable === 'function' ? model.getTable(tableName) : undefined) ||
        tables.find(t => t.id === tableName || t.name.toLowerCase() === tableName.toLowerCase());

      if (!table) {
        return DAX_BLANK;
      }

      if (this.context.filterContext && model) {
        const count = this.context.filterContext.getVisibleRowIndices(table.id, model).length;
        return count;
      }

      if (model && typeof (model as any).getFilteredRows === 'function') {
        return (model as any).getFilteredRows(table.id, this.context.activeFilters || []).length;
      }
      return table.rows.length;
    }

    // 5. Functions in Registry (Aggregation, Filter, Relationship, Math, Text, Date)
    const fnDef = lookupFunction(fnName);
    if (!fnDef) {
      throw new DaxError('Semantic', `Função "${node.name}" não foi reconhecida no catálogo DAX`);
    }

    if (node.args.length < fnDef.minArgs) {
      throw new DaxError(
        'Semantic',
        `Função ${fnDef.name} requer no mínimo ${fnDef.minArgs} argumento(s), fornecidos: ${node.args.length}`
      );
    }
    if (fnDef.maxArgs !== -1 && node.args.length > fnDef.maxArgs) {
      throw new DaxError(
        'Semantic',
        `Função ${fnDef.name} aceita no máximo ${fnDef.maxArgs} argumento(s), fornecidos: ${node.args.length}`
      );
    }

    const isAgg =
      fnDef.category === 'Agregação' ||
      [
        'SUM',
        'AVERAGE',
        'AVERAGEA',
        'MIN',
        'MAX',
        'MINA',
        'MAXA',
        'COUNT',
        'COUNTA',
        'COUNTBLANK',
        'DISTINCTCOUNT',
        'DISTINCTCOUNTNOBLANK',
        'APPROXIMATEDISTINCTCOUNT',
        'PRODUCT',
        'MEDIAN',
      ].includes(fnName);

    const isContextOrRel = [
      'RELATED',
      'RELATEDTABLE',
      'USERELATIONSHIP',
      'CROSSFILTER',
      'VALUES',
      'DISTINCT',
      'SELECTEDVALUE',
      'HASONEVALUE',
      'HASONEFILTER',
      'ISFILTERED',
      'ISCROSSFILTERED',
      'ISEMPTY',
      'FILTERS',
      'ALL',
      'ALLEXCEPT',
      'ALLNOBLANKROW',
      'ALLSELECTED',
      'ALLCROSSFILTERED',
      'REMOVEFILTERS',
      'KEEPFILTERS',
      'LOOKUPVALUE',
      'EARLIER',
      'EARLIEST',
    ].includes(fnName);

    const evaluatedArgs = node.args.map((arg, idx) => {
      if (!arg) return DAX_BLANK;
      if (isAgg && idx === 0 && arg.kind === 'ColumnRef') {
        return { table: arg.table, column: arg.column };
      }
      if (isContextOrRel && (arg.kind === 'ColumnRef' || arg.kind === 'VariableRef')) {
        return arg.kind === 'VariableRef' ? { column: arg.name } : { table: arg.table, column: arg.column };
      }
      return this.evalNode(arg);
    });

    if (fnDef.evaluate) {
      return fnDef.evaluate(evaluatedArgs, this.context);
    }

    return DAX_BLANK;
  }

  /**
   * CALCULATE & CALCULATETABLE implementation
   */
  private evalCalculate(node: FunctionCallNode): any {
    if (node.args.length < 1 || !node.args[0]) {
      throw new DaxError('Semantic', 'CALCULATE requer pelo menos 1 argumento (expressão)');
    }
    const exprNode = node.args[0];
    const filterArgNodes = node.args.slice(1);

    const model = this.context.model;
    let baseFilterCtx = this.context.filterContext
      ? this.context.filterContext.clone()
      : new FilterContext();

    // Context Transition: If row context exists, convert it to column filters on filter context
    if (this.context.rowContextStack && !this.context.rowContextStack.isEmpty() && model) {
      baseFilterCtx = this.context.rowContextStack.transitionToFilterContext(baseFilterCtx, model);
    } else if (this.context.row && model) {
      const tableId = this.context.tableId || '';
      const table = tableId ? model.getTable(tableId) : undefined;
      if (table) {
        table.columns.forEach(col => {
          const val = this.context.row![col.name];
          baseFilterCtx.setColumnFilter(
            table.id,
            col.name,
            {
              tableId: table.id,
              column: col.name,
              allowedValues: new Set([val]),
              isKeepFilters: false,
            },
            false
          );
        });
      }
    }

    // Apply each filter argument
    for (const filterArg of filterArgNodes) {
      if (!filterArg) continue;
      this.applyFilterArgumentToContext(filterArg, baseFilterCtx);
    }

    // In DAX, CALCULATE clears active row contexts for evaluating the inner expression
    const childEvaluator = new Evaluator({
      ...this.context,
      filterContext: baseFilterCtx,
      row: undefined,
      rowIndex: undefined,
      rowContextStack: undefined,
    });

    return childEvaluator.evalNode(exprNode);
  }

  /**
   * Translates CALCULATE filter arguments into FilterContext alterations
   */
  private applyFilterArgumentToContext(
    filterNode: ASTNode,
    filterCtx: FilterContext,
    isKeepFilters = false
  ): void {
    const model = this.context.model;

    if (filterNode.kind === 'BinaryOp') {
      const left = filterNode.left;
      if (left.kind === 'ColumnRef') {
        const colName = left.column;
        let tableId = left.table || '';

        let table = tableId && model ? model.getTable(tableId) : undefined;
        if (!table && model) {
          for (const t of model.getTables()) {
            if (t.columns.some(c => c.name.toLowerCase() === colName.toLowerCase())) {
              table = t;
              break;
            }
          }
        }

        const effectiveTableId = table ? table.id : (tableId || 'default_table');
        const rightVal = this.evalNode(filterNode.right);
        const op = filterNode.operator;

        if (op === '=' || op === '==') {
          filterCtx.setColumnFilter(
            effectiveTableId,
            colName,
            {
              tableId: effectiveTableId,
              column: colName,
              allowedValues: new Set([rightVal]),
              operator: 'equals',
              value: rightVal,
            },
            isKeepFilters
          );
        } else if (op === '<>') {
          filterCtx.setColumnFilter(
            effectiveTableId,
            colName,
            {
              tableId: effectiveTableId,
              column: colName,
              predicate: (val: any) => !daxEqual(val, rightVal),
              operator: 'notEquals',
              value: rightVal,
            },
            isKeepFilters
          );
        } else if (op === 'IN') {
          const allowed = new Set(Array.isArray(rightVal) ? rightVal : [rightVal]);
          filterCtx.setColumnFilter(
            effectiveTableId,
            colName,
            {
              tableId: effectiveTableId,
              column: colName,
              allowedValues: allowed,
              operator: 'in',
              rawValues: Array.from(allowed),
            },
            isKeepFilters
          );
        } else if (['>', '>=', '<', '<='].includes(op)) {
          filterCtx.setColumnFilter(
            effectiveTableId,
            colName,
            {
              tableId: effectiveTableId,
              column: colName,
              predicate: (val: any) => {
                switch (op) {
                  case '>': return daxCompare(val, rightVal) > 0;
                  case '>=': return daxCompare(val, rightVal) >= 0;
                  case '<': return daxCompare(val, rightVal) < 0;
                  case '<=': return daxCompare(val, rightVal) <= 0;
                  default: return true;
                }
              },
              operator: op,
              value: rightVal,
            },
            isKeepFilters
          );
        }
        return;
      }
    }

    if (filterNode.kind === 'FunctionCall') {
      const fnName = filterNode.name.toUpperCase();

      if (fnName === 'KEEPFILTERS') {
        if (filterNode.args[0]) {
          this.applyFilterArgumentToContext(filterNode.args[0], filterCtx, true);
        }
        return;
      }

      if (fnName === 'ALL' || fnName === 'REMOVEFILTERS' || fnName === 'ALLNOBLANKROW') {
        if (filterNode.args.length === 0) {
          filterCtx.clearAll();
          return;
        }

        for (const arg of filterNode.args) {
          if (!arg) continue;
          if (arg.kind === 'ColumnRef') {
            const table = arg.table && model ? model.getTable(arg.table) : undefined;
            if (arg.table && !arg.column) {
              this.removeTableAndExpandedFilters(table ? table.id : arg.table, filterCtx);
            } else if (arg.column) {
              const t =
                table ||
                (model?.getTables() || []).find(tb =>
                  tb.columns.some(c => c.name.toLowerCase() === arg.column.toLowerCase())
                );
              if (t) {
                filterCtx.removeColumnFilter(t.id, arg.column);
              } else if (arg.table) {
                filterCtx.removeColumnFilter(arg.table, arg.column);
              } else {
                const isTable = model?.getTable(arg.column);
                if (isTable) {
                  this.removeTableAndExpandedFilters(isTable.id, filterCtx);
                }
              }
            }
          } else if (arg.kind === 'VariableRef') {
            const table = model?.getTable(arg.name);
            if (table) {
              this.removeTableAndExpandedFilters(table.id, filterCtx);
            }
          } else if (arg.kind === 'Literal') {
            const str = String(arg.value);
            const table = model?.getTable(str);
            if (table) {
              this.removeTableAndExpandedFilters(table.id, filterCtx);
            }
          }
        }
        return;
      }

      if (fnName === 'ALLEXCEPT') {
        if (filterNode.args.length >= 1 && filterNode.args[0]) {
          const first = filterNode.args[0];
          const tableName =
            first.kind === 'ColumnRef'
              ? first.table || first.column
              : first.kind === 'VariableRef'
              ? first.name
              : String((first as any).value || '');
          const table = model?.getTable(tableName);
          if (table) {
            const keepCols = new Set<string>();
            for (let i = 1; i < filterNode.args.length; i++) {
              const arg = filterNode.args[i];
              if (arg?.kind === 'ColumnRef') keepCols.add(arg.column.toLowerCase());
              else if (arg?.kind === 'VariableRef') keepCols.add(arg.name.toLowerCase());
            }

            for (const colFilter of filterCtx.getAllColumnFilters()) {
              if (
                colFilter.tableId.toLowerCase() === table.id.toLowerCase() &&
                !keepCols.has(colFilter.column.toLowerCase())
              ) {
                filterCtx.removeColumnFilter(table.id, colFilter.column);
              }
            }
          }
        }
        return;
      }

      if (fnName === 'USERELATIONSHIP') {
        if (filterNode.args.length >= 2 && filterNode.args[0] && filterNode.args[1]) {
          const c1 = filterNode.args[0] as ColumnRefNode;
          const c2 = filterNode.args[1] as ColumnRefNode;
          filterCtx.addRelationshipOverride({
            fromTable: c1.table || '',
            fromColumn: c1.column || '',
            toTable: c2.table || '',
            toColumn: c2.column || '',
            isActive: true,
          });
        }
        return;
      }

      if (fnName === 'CROSSFILTER') {
        if (filterNode.args.length >= 3 && filterNode.args[0] && filterNode.args[1] && filterNode.args[2]) {
          const c1 = filterNode.args[0] as ColumnRefNode;
          const c2 = filterNode.args[1] as ColumnRefNode;
          const dirVal = String((filterNode.args[2] as any).value || 'both').toLowerCase();
          let dir: 'single' | 'both' | 'none' = 'both';
          if (dirVal === 'single') dir = 'single';
          else if (dirVal === 'none') dir = 'none';

          filterCtx.addRelationshipOverride({
            fromTable: c1.table || '',
            fromColumn: c1.column || '',
            toTable: c2.table || '',
            toColumn: c2.column || '',
            crossFilterDirection: dir,
          });
        }
        return;
      }

      if (fnName === 'FILTER') {
        const rows = this.evalFilter(filterNode);
        if (rows.length > 0) {
          const first = filterNode.args[0];
          const tName =
            first?.kind === 'ColumnRef'
              ? first.table || first.column
              : first?.kind === 'VariableRef'
              ? first.name
              : '';
          const table = model?.getTable(tName);
          if (table) {
            table.columns.forEach(col => {
              const distinct = new Set(rows.map(r => r[col.name]));
              filterCtx.setColumnFilter(
                table.id,
                col.name,
                {
                  tableId: table.id,
                  column: col.name,
                  allowedValues: distinct,
                },
                isKeepFilters
              );
            });
          }
        }
        return;
      }
    }
  }

  /**
   * DAX Expanded Table Semantics:
   * ALL(Table) removes filters on Table and all tables that filter Table along active N:1 relationships.
   */
  private removeTableAndExpandedFilters(tableId: string, filterCtx: FilterContext): void {
    const model = this.context.model;
    const resolvedTable = model?.getTable(tableId);
    const targetId = resolvedTable ? resolvedTable.id : tableId;
    filterCtx.removeTableFilters(targetId);
    if (!model) return;

    const queue = [targetId.toLowerCase()];
    const visited = new Set<string>([targetId.toLowerCase()]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const rel of model.getRelationships()) {
        if (rel.isActive === false) continue;

        // In N:1 (rel.fromTable -> rel.toTable), toTable filters fromTable.
        if (rel.fromTable.toLowerCase() === current) {
          const target = rel.toTable.toLowerCase();
          if (!visited.has(target)) {
            visited.add(target);
            const t = model.getTable(target);
            filterCtx.removeTableFilters(t ? t.id : target);
            queue.push(target);
          }
        }

        // If crossFilterDirection is 'both', fromTable filters toTable as well
        if (rel.crossFilterDirection === 'both' && rel.toTable.toLowerCase() === current) {
          const target = rel.fromTable.toLowerCase();
          if (!visited.has(target)) {
            visited.add(target);
            const t = model.getTable(target);
            filterCtx.removeTableFilters(t ? t.id : target);
            queue.push(target);
          }
        }
      }
    }
  }

  /**
   * Iterator functions implementation (SUMX, AVERAGEX, MINX, MAXX, COUNTX, etc.)
   */
  private evalIterator(node: FunctionCallNode): any {
    const fnName = node.name.toUpperCase();
    if (node.args.length < 2 || !node.args[0] || !node.args[1]) {
      throw new DaxError('Semantic', `${fnName} requer pelo menos 2 argumentos (tabela, expressão)`);
    }

    const tableNode = node.args[0];
    const exprNode = node.args[1];
    const model = this.context.model;

    // Resolve rows to iterate
    let rows: Record<string, any>[] = [];
    let tableId = '';
    let tableName = '';

    if (
      tableNode.kind === 'ColumnRef' ||
      tableNode.kind === 'VariableRef' ||
      tableNode.kind === 'Literal'
    ) {
      const name =
        tableNode.kind === 'VariableRef'
          ? tableNode.name
          : tableNode.kind === 'ColumnRef'
          ? tableNode.table || tableNode.column
          : String(tableNode.value);
      const table =
        model?.getTable(name) ||
        (this.context.tables || []).find(
          t => t.id === name || t.name.toLowerCase() === name.toLowerCase()
        );
      if (table) {
        tableId = table.id;
        tableName = table.name;
        if (this.context.filterContext && model) {
          rows = this.context.filterContext.getFilteredRows(table.id, model);
        } else {
          rows = table.rows || [];
        }
      }
    } else if (tableNode.kind === 'FunctionCall') {
      const result = this.evalNode(tableNode);
      if (Array.isArray(result)) {
        rows = result;
      } else if (result && Array.isArray(result.rows)) {
        rows = result.rows;
        tableId = result.tableId || '';
        tableName = result.tableName || '';
      }
    }

    if (rows.length === 0) {
      if (fnName === 'CONCATENATEX') return '';
      return DAX_BLANK;
    }

    const stack = this.context.rowContextStack
      ? new RowContextStack((this.context.rowContextStack as any).stack)
      : new RowContextStack();

    const evaluatedValues: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      stack.push(tableId, tableName, row, i);

      const rowEvaluator = new Evaluator({
        ...this.context,
        row,
        rowIndex: i,
        tableId,
        rowContextStack: stack,
      });

      const val = rowEvaluator.evalNode(exprNode);
      evaluatedValues.push(val);

      stack.pop();
    }

    switch (fnName) {
      case 'SUMX': {
        let sum = 0;
        let hasValid = false;
        for (const v of evaluatedValues) {
          if (!isBlank(v) && v !== null && v !== undefined && v !== '') {
            sum += daxToNumber(v);
            hasValid = true;
          }
        }
        return hasValid ? sum : DAX_BLANK;
      }

      case 'AVERAGEX': {
        let sum = 0;
        let count = 0;
        for (const v of evaluatedValues) {
          if (!isBlank(v) && v !== null && v !== undefined && v !== '') {
            sum += daxToNumber(v);
            count++;
          }
        }
        return count > 0 ? sum / count : DAX_BLANK;
      }

      case 'MINX': {
        const nums = evaluatedValues
          .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
          .map(v => daxToNumber(v));
        return nums.length > 0 ? Math.min(...nums) : DAX_BLANK;
      }

      case 'MAXX': {
        const nums = evaluatedValues
          .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
          .map(v => daxToNumber(v));
        return nums.length > 0 ? Math.max(...nums) : DAX_BLANK;
      }

      case 'COUNTX': {
        let count = 0;
        for (const v of evaluatedValues) {
          if (!isBlank(v) && v !== null && v !== undefined && v !== '' && typeof v === 'number' && !isNaN(v)) {
            count++;
          }
        }
        return count > 0 ? count : DAX_BLANK;
      }

      case 'COUNTAX': {
        let count = 0;
        for (const v of evaluatedValues) {
          if (!isBlank(v) && v !== null && v !== undefined && v !== '') {
            count++;
          }
        }
        return count > 0 ? count : DAX_BLANK;
      }

      case 'PRODUCTX': {
        let prod = 1;
        let hasValid = false;
        for (const v of evaluatedValues) {
          if (!isBlank(v) && v !== null && v !== undefined && v !== '') {
            prod *= daxToNumber(v);
            hasValid = true;
          }
        }
        return hasValid ? prod : DAX_BLANK;
      }

      case 'CONCATENATEX': {
        const delimiter = node.args[2] ? String(this.evalNode(node.args[2])) : '';
        const nonBlanks = evaluatedValues
          .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
          .map(v => daxToString(v));
        return nonBlanks.join(delimiter);
      }

      default:
        return DAX_BLANK;
    }
  }

  /**
   * FILTER(Table, Condition) implementation
   */
  private evalFilter(node: FunctionCallNode): any[] {
    if (node.args.length !== 2 || !node.args[0] || !node.args[1]) {
      throw new DaxError('Semantic', 'FILTER requer exatamente 2 argumentos (tabela, condição)');
    }
    const tableNode = node.args[0];
    const condNode = node.args[1];
    const model = this.context.model;

    let rows: Record<string, any>[] = [];
    let tableId = '';
    let tableName = '';

    if (
      tableNode.kind === 'ColumnRef' ||
      tableNode.kind === 'VariableRef' ||
      tableNode.kind === 'Literal'
    ) {
      const name =
        tableNode.kind === 'VariableRef'
          ? tableNode.name
          : tableNode.kind === 'ColumnRef'
          ? tableNode.table || tableNode.column
          : String(tableNode.value);
      const table =
        model?.getTable(name) ||
        (this.context.tables || []).find(
          t => t.id === name || t.name.toLowerCase() === name.toLowerCase()
        );
      if (table) {
        tableId = table.id;
        tableName = table.name;
        if (this.context.filterContext && model) {
          rows = this.context.filterContext.getFilteredRows(table.id, model);
        } else {
          rows = table.rows || [];
        }
      }
    } else if (tableNode.kind === 'FunctionCall') {
      const res = this.evalNode(tableNode);
      if (Array.isArray(res)) rows = res;
      else if (res && Array.isArray(res.rows)) rows = res.rows;
    }

    const stack = this.context.rowContextStack
      ? new RowContextStack((this.context.rowContextStack as any).stack)
      : new RowContextStack();

    const matchedRows: Record<string, any>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      stack.push(tableId, tableName, row, i);

      const rowEvaluator = new Evaluator({
        ...this.context,
        row,
        rowIndex: i,
        tableId,
        rowContextStack: stack,
      });

      const cond = rowEvaluator.evalNode(condNode);
      if (daxToBoolean(cond)) {
        matchedRows.push(row);
      }

      stack.pop();
    }

    return matchedRows;
  }

  private evalTableConstructor(node: TableConstructorNode): any[] {
    return node.elements.map(el => {
      if (Array.isArray(el)) {
        return el.map(sub => this.evalNode(sub));
      }
      return this.evalNode(el);
    });
  }

  private evalVarReturn(node: VarReturnNode): any {
    const childScope = new Map(this.context.variables);

    for (const v of node.variables) {
      const childEvaluator = new Evaluator({
        ...this.context,
        variables: childScope,
      });
      const val = childEvaluator.evalNode(v.expr);
      childScope.set(v.name.toLowerCase(), val);
    }

    const returnEvaluator = new Evaluator({
      ...this.context,
      variables: childScope,
    });
    return returnEvaluator.evalNode(node.returnExpr);
  }
}

/**
 * Public evaluation helper function
 */
export function evaluateExpression(
  expression: string | ASTNode,
  context: EvalContext = {}
): any {
  const evaluator = new Evaluator(context);
  return evaluator.evaluate(expression);
}
