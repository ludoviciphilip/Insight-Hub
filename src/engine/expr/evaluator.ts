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
  DaxTableValue,
  isDaxTable,
} from './types';
import { DaxError } from '../shared/errors';
import { Table, Measure, Filter, Column, Relationship } from '../../types/bi';
import { ModelAccess } from '../model/modelAccess';
import { FilterContext } from '../model/filterContext';
import { RowContextStack } from '../model/rowContext';
import { toDaxTable } from '../functions/table';

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
  currentGroupRows?: Record<string, any>[];
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
      'GEOMEANX',
      'CONCATENATEX',
    ].includes(fnName)) {
      return this.evalIterator(node);
    }

    // 3. Iterative Table Functions & Constructors
    if (fnName === 'FILTER') {
      return this.evalFilter(node);
    }
    if (fnName === 'ADDCOLUMNS') {
      return this.evalAddColumns(node);
    }
    if (fnName === 'SELECTCOLUMNS') {
      return this.evalSelectColumns(node);
    }
    if (fnName === 'GENERATE' || fnName === 'GENERATEALL') {
      return this.evalGenerate(node);
    }
    if (fnName === 'TOPN') {
      return this.evalTopN(node);
    }
    if (fnName === 'SUMMARIZE') {
      return this.evalSummarize(node);
    }
    if (fnName === 'SUMMARIZECOLUMNS') {
      return this.evalSummarizeColumns(node);
    }
    if (fnName === 'GROUPBY') {
      return this.evalGroupBy(node);
    }
    if (fnName === 'DATATABLE') {
      const rawDataNode = node.args[node.args.length - 1];
      const data = rawDataNode ? this.evalNode(rawDataNode) : [];
      const colDefs = node.args.slice(0, node.args.length - 1);
      const evaluatedColDefs = colDefs.map(c => {
        if (!c) return '';
        if (c.kind === 'Literal') return String(c.value);
        if (c.kind === 'VariableRef') return c.name;
        if (c.kind === 'ColumnRef') return c.column;
        return daxToString(this.evalNode(c));
      });
      const dtDef = lookupFunction('DATATABLE');
      if (dtDef && dtDef.evaluate) {
        return dtDef.evaluate([...evaluatedColDefs, data], this.context);
      }
    }
    if (fnName === 'NAMEOF') {
      if (node.args.length !== 1 || !node.args[0]) {
        throw new DaxError('Semantic', 'NAMEOF requer exatamente 1 argumento');
      }
      const arg = node.args[0];
      if (arg.kind === 'ColumnRef') {
        return arg.column;
      }
      if (arg.kind === 'VariableRef') {
        return arg.name;
      }
      return daxToString(this.evalNode(arg));
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
      const tableVal = this.resolveTableValue(arg);
      return tableVal.rows.length;
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

    const isTableFunction = [
      'UNION',
      'INTERSECT',
      'EXCEPT',
      'CROSSJOIN',
      'NATURALINNERJOIN',
      'NATURALLEFTOUTERJOIN',
      'ADDMISSINGITEMS',
      'SAMPLE',
      'SUBSTITUTEWITHINDEX',
    ].includes(fnName);

    const evaluatedArgs = node.args.map((arg, idx) => {
      if (!arg) return DAX_BLANK;
      if (isAgg && idx === 0 && arg.kind === 'ColumnRef') {
        return { table: arg.table, column: arg.column };
      }
      if (isContextOrRel && (arg.kind === 'ColumnRef' || arg.kind === 'VariableRef')) {
        return arg.kind === 'VariableRef' ? { column: arg.name } : { table: arg.table, column: arg.column };
      }
      if (isTableFunction && (arg.kind === 'ColumnRef' || arg.kind === 'VariableRef')) {
        const name = arg.kind === 'VariableRef' ? arg.name : (arg.table || arg.column);
        if (
          this.context.model?.getTable(name) ||
          this.context.tables?.some(t => t.name.toLowerCase() === name.toLowerCase() || t.id === name)
        ) {
          return this.resolveTableValue(arg);
        }
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
        const tableVal = this.evalFilter(filterNode);
        this.applyTableFilterToContext(tableVal, filterCtx, isKeepFilters);
        return;
      }
    }

    // Generic Table filter expression (e.g. TOPN, VALUES, FILTER, table variable, etc.)
    try {
      const val = this.evalNode(filterNode);
      if (isDaxTable(val) || (Array.isArray(val) && val.length > 0)) {
        const tableVal = toDaxTable(val, model ?? undefined, this.context.filterContext);
        this.applyTableFilterToContext(tableVal, filterCtx, isKeepFilters);
      }
    } catch (err) {
      if (err instanceof DaxError) {
        throw err;
      }
      // Ignored if not a valid table expression
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

  private applyTableFilterToContext(
    tableVal: DaxTableValue,
    filterCtx: FilterContext,
    isKeepFilters: boolean
  ): void {
    const model = this.context.model;
    if (tableVal.rows.length === 0) {
      for (const col of tableVal.columns) {
        const lin = tableVal.lineage && tableVal.lineage[col];
        const targetTableId = lin ? lin.tableId : (tableVal.tableId || '');
        const targetCol = lin ? lin.column : col;
        if (targetTableId) {
          filterCtx.setColumnFilter(
            targetTableId,
            targetCol,
            {
              tableId: targetTableId,
              column: targetCol,
              allowedValues: new Set(),
            },
            isKeepFilters
          );
        }
      }
      return;
    }

    for (const col of tableVal.columns) {
      const lin = tableVal.lineage && tableVal.lineage[col];
      let targetTableId = lin ? lin.tableId : (tableVal.tableId || '');
      let targetCol = lin ? lin.column : col;

      if (!targetTableId && model) {
        for (const t of model.getTables()) {
          if (t.columns.some(c => c.name.toLowerCase() === targetCol.toLowerCase())) {
            targetTableId = t.id;
            break;
          }
        }
      }

      if (targetTableId) {
        const distinct = new Set(tableVal.rows.map(r => r[col]));
        filterCtx.setColumnFilter(
          targetTableId,
          targetCol,
          {
            tableId: targetTableId,
            column: targetCol,
            allowedValues: distinct,
          },
          isKeepFilters
        );
      }
    }
  }

  /**
   * Resolves any table ASTNode into a standard DaxTableValue with lineage and filter context applied
   */
  public resolveTableValue(tableNode: ASTNode): DaxTableValue {
    const model = this.context.model;

    // Check variable
    if (tableNode.kind === 'VariableRef' && this.context.variables?.has(tableNode.name.toLowerCase())) {
      const v = this.context.variables.get(tableNode.name.toLowerCase());
      return toDaxTable(v, model ?? undefined, this.context.filterContext);
    }

    // Check direct table reference
    if (tableNode.kind === 'ColumnRef' || tableNode.kind === 'VariableRef' || tableNode.kind === 'Literal') {
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
        const rows = this.context.filterContext && model
          ? this.context.filterContext.getFilteredRows(table.id, model)
          : (table.rows || []);
        const cols = table.columns.map(c => c.name);
        const lineage: Record<string, { tableId: string; tableName: string; column: string }> = {};
        for (const c of cols) {
          lineage[c] = { tableId: table.id, tableName: table.name, column: c };
        }
        return {
          __isDaxTable: true,
          columns: cols,
          rows,
          tableId: table.id,
          tableName: table.name,
          lineage,
        };
      }
    }

    // Expression evaluation (e.g. VALUES, FILTER, TOPN, GENERATESERIES, DATATABLE)
    const res = this.evalNode(tableNode);
    return toDaxTable(res, model ?? undefined, this.context.filterContext);
  }

  /**
   * Iterator functions implementation (SUMX, AVERAGEX, MINX, MAXX, COUNTX, COUNTAX, PRODUCTX, MEDIANX, GEOMEANX, CONCATENATEX)
   */
  private evalIterator(node: FunctionCallNode): any {
    const fnName = node.name.toUpperCase();
    if (node.args.length < 2 || !node.args[0] || !node.args[1]) {
      throw new DaxError('Semantic', `${fnName} requer pelo menos 2 argumentos (tabela, expressão)`);
    }

    const tableNode = node.args[0];
    const exprNode = node.args[1];
    const tableVal = this.resolveTableValue(tableNode);
    const rows = tableVal.rows;
    const tableId = tableVal.tableId || '';
    const tableName = tableVal.tableName || '';
    const lineage = tableVal.lineage;

    if (rows.length === 0) {
      if (fnName === 'CONCATENATEX') return '';
      return DAX_BLANK;
    }

    const stack = this.context.rowContextStack
      ? new RowContextStack((this.context.rowContextStack as any).stack)
      : new RowContextStack();

    const evaluatedValues: any[] = [];
    const orderValues: any[] = [];
    const hasOrderBy = fnName === 'CONCATENATEX' && node.args.length >= 4 && Boolean(node.args[3]);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      stack.push(tableId, tableName, row, i, lineage);

      const rowEvaluator = new Evaluator({
        ...this.context,
        row,
        rowIndex: i,
        tableId,
        rowContextStack: stack,
      });

      const val = rowEvaluator.evalNode(exprNode);
      evaluatedValues.push(val);

      if (hasOrderBy && node.args[3]) {
        const oVal = rowEvaluator.evalNode(node.args[3]!);
        orderValues.push(oVal);
      }

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

      case 'MEDIANX': {
        const nums = evaluatedValues
          .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
          .map(v => daxToNumber(v))
          .filter(n => !isNaN(n));
        if (nums.length === 0) return DAX_BLANK;
        nums.sort((a, b) => a - b);
        const mid = Math.floor(nums.length / 2);
        if (nums.length % 2 === 1) {
          return nums[mid];
        } else {
          return (nums[mid - 1] + nums[mid]) / 2;
        }
      }

      case 'GEOMEANX': {
        const nums = evaluatedValues
          .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
          .map(v => daxToNumber(v))
          .filter(n => !isNaN(n) && n > 0);
        if (nums.length === 0) return DAX_BLANK;
        const sumLog = nums.reduce((acc, x) => acc + Math.log(x), 0);
        return Math.exp(sumLog / nums.length);
      }

      case 'CONCATENATEX': {
        const delimiter = node.args[2] ? daxToString(this.evalNode(node.args[2])) : '';
        let orderDir = 'ASC';
        if (node.args[4]) {
          const orderArg = node.args[4];
          if (orderArg.kind === 'VariableRef') {
            orderDir = orderArg.name.toUpperCase();
          } else if (orderArg.kind === 'Literal') {
            orderDir = String(orderArg.value).toUpperCase();
          } else {
            try {
              orderDir = String(this.evalNode(orderArg)).toUpperCase();
            } catch {
              orderDir = 'ASC';
            }
          }
        }
        const isDesc = orderDir === 'DESC' || orderDir === '0';

        const items = evaluatedValues.map((v, idx) => ({
          val: v,
          orderKey: hasOrderBy ? orderValues[idx] : v,
          idx,
        }));

        if (hasOrderBy) {
          items.sort((a, b) => {
            const cmp = daxCompare(a.orderKey, b.orderKey);
            if (cmp !== 0) return isDesc ? -cmp : cmp;
            return a.idx - b.idx;
          });
        }

        const nonBlanks = items
          .map(it => it.val)
          .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
          .map(v => daxToString(v));
        return nonBlanks.join(delimiter);
      }

      default:
        return DAX_BLANK;
    }
  }

  /**
   * FILTER(Table, Condition)
   */
  public evalFilter(node: FunctionCallNode): DaxTableValue {
    if (node.args.length !== 2 || !node.args[0] || !node.args[1]) {
      throw new DaxError('Semantic', 'FILTER requer exatamente 2 argumentos (tabela, condição)');
    }
    const tableVal = this.resolveTableValue(node.args[0]);
    const condNode = node.args[1];

    const stack = this.context.rowContextStack
      ? new RowContextStack((this.context.rowContextStack as any).stack)
      : new RowContextStack();

    const matchedRows: Record<string, any>[] = [];

    for (let i = 0; i < tableVal.rows.length; i++) {
      const row = tableVal.rows[i];
      stack.push(tableVal.tableId || '', tableVal.tableName || '', row, i, tableVal.lineage);

      const rowEvaluator = new Evaluator({
        ...this.context,
        row,
        rowIndex: i,
        tableId: tableVal.tableId,
        rowContextStack: stack,
      });

      const cond = rowEvaluator.evalNode(condNode);
      if (daxToBoolean(cond)) {
        matchedRows.push(row);
      }

      stack.pop();
    }

    return {
      __isDaxTable: true,
      columns: tableVal.columns,
      rows: matchedRows,
      tableId: tableVal.tableId,
      tableName: tableVal.tableName,
      lineage: tableVal.lineage,
    };
  }

  /**
   * ADDCOLUMNS(Table, Name1, Expr1, [Name2, Expr2, ...])
   */
  private evalAddColumns(node: FunctionCallNode): DaxTableValue {
    if (node.args.length < 3 || (node.args.length - 1) % 2 !== 0) {
      throw new DaxError('Semantic', 'ADDCOLUMNS requer tabela e pares de (nomeDaColuna, expressão)');
    }
    const tableVal = this.resolveTableValue(node.args[0]!);
    const pairs: { name: string; exprNode: ASTNode }[] = [];
    for (let i = 1; i < node.args.length; i += 2) {
      const name = daxToString(this.evalNode(node.args[i]!)).replace(/^\[|\]$/g, '');
      const exprNode = node.args[i + 1]!;
      pairs.push({ name, exprNode });
    }

    const stack = this.context.rowContextStack
      ? new RowContextStack((this.context.rowContextStack as any).stack)
      : new RowContextStack();

    const newRows: Record<string, any>[] = [];
    const addedColNames = pairs.map(p => p.name);

    for (let i = 0; i < tableVal.rows.length; i++) {
      const row = tableVal.rows[i];
      stack.push(tableVal.tableId || '', tableVal.tableName || '', row, i, tableVal.lineage);

      const rowEvaluator = new Evaluator({
        ...this.context,
        row,
        rowIndex: i,
        tableId: tableVal.tableId,
        rowContextStack: stack,
      });

      const newRow: Record<string, any> = { ...row };
      for (const p of pairs) {
        newRow[p.name] = rowEvaluator.evalNode(p.exprNode);
      }
      newRows.push(newRow);

      stack.pop();
    }

    return {
      __isDaxTable: true,
      columns: [...tableVal.columns, ...addedColNames],
      rows: newRows,
      tableId: tableVal.tableId,
      tableName: tableVal.tableName,
      lineage: tableVal.lineage,
    };
  }

  /**
   * SELECTCOLUMNS(Table, Name1, Expr1, [Name2, Expr2, ...])
   */
  private evalSelectColumns(node: FunctionCallNode): DaxTableValue {
    if (node.args.length < 3 || (node.args.length - 1) % 2 !== 0) {
      throw new DaxError('Semantic', 'SELECTCOLUMNS requer tabela e pares de (nomeDaColuna, expressão)');
    }
    const tableVal = this.resolveTableValue(node.args[0]!);
    const pairs: { name: string; exprNode: ASTNode }[] = [];
    for (let i = 1; i < node.args.length; i += 2) {
      const name = daxToString(this.evalNode(node.args[i]!)).replace(/^\[|\]$/g, '');
      const exprNode = node.args[i + 1]!;
      pairs.push({ name, exprNode });
    }

    const stack = this.context.rowContextStack
      ? new RowContextStack((this.context.rowContextStack as any).stack)
      : new RowContextStack();

    const newRows: Record<string, any>[] = [];
    const outputCols = pairs.map(p => p.name);
    const lineage: Record<string, any> = {};

    for (const p of pairs) {
      if (p.exprNode.kind === 'ColumnRef') {
        const colRef = p.exprNode as ColumnRefNode;
        const origCol = colRef.column;
        if (tableVal.lineage && tableVal.lineage[origCol]) {
          lineage[p.name] = tableVal.lineage[origCol];
        } else {
          lineage[p.name] = {
            tableId: colRef.table || tableVal.tableId || '',
            tableName: colRef.table || tableVal.tableName || '',
            column: origCol,
          };
        }
      }
    }

    for (let i = 0; i < tableVal.rows.length; i++) {
      const row = tableVal.rows[i];
      stack.push(tableVal.tableId || '', tableVal.tableName || '', row, i, tableVal.lineage);

      const rowEvaluator = new Evaluator({
        ...this.context,
        row,
        rowIndex: i,
        tableId: tableVal.tableId,
        rowContextStack: stack,
      });

      const newRow: Record<string, any> = {};
      for (const p of pairs) {
        newRow[p.name] = rowEvaluator.evalNode(p.exprNode);
      }
      newRows.push(newRow);

      stack.pop();
    }

    return {
      __isDaxTable: true,
      columns: outputCols,
      rows: newRows,
      lineage,
    };
  }

  /**
   * GENERATE & GENERATEALL
   */
  private evalGenerate(node: FunctionCallNode): DaxTableValue {
    const isAll = node.name.toUpperCase() === 'GENERATEALL';
    if (node.args.length !== 2 || !node.args[0] || !node.args[1]) {
      throw new DaxError('Semantic', `${node.name.toUpperCase()} requer exatamente 2 argumentos (tabela1, tabela2_expr)`);
    }

    const t1 = this.resolveTableValue(node.args[0]);
    const t2Node = node.args[1];

    const stack = this.context.rowContextStack
      ? new RowContextStack((this.context.rowContextStack as any).stack)
      : new RowContextStack();

    const combinedRows: Record<string, any>[] = [];
    let t2Cols: string[] = [];
    const lineage: Record<string, any> = { ...t1.lineage };

    for (let i = 0; i < t1.rows.length; i++) {
      const r1 = t1.rows[i];
      stack.push(t1.tableId || '', t1.tableName || '', r1, i, t1.lineage);

      const rowEvaluator = new Evaluator({
        ...this.context,
        row: r1,
        rowIndex: i,
        tableId: t1.tableId,
        rowContextStack: stack,
      });

      const t2Res = rowEvaluator.evalNode(t2Node);
      const t2 = toDaxTable(t2Res, this.context.model ?? undefined, this.context.filterContext);
      if (t2.columns.length > 0 && t2Cols.length === 0) {
        t2Cols = t2.columns;
        if (t2.lineage) Object.assign(lineage, t2.lineage);
      }

      if (t2.rows.length > 0) {
        for (const r2 of t2.rows) {
          combinedRows.push({ ...r1, ...r2 });
        }
      } else if (isAll) {
        const blankRow: Record<string, any> = { ...r1 };
        for (const c of t2Cols) {
          blankRow[c] = DAX_BLANK;
        }
        combinedRows.push(blankRow);
      }

      stack.pop();
    }

    const allCols = Array.from(new Set([...t1.columns, ...t2Cols]));
    return {
      __isDaxTable: true,
      columns: allCols,
      rows: combinedRows,
      lineage,
    };
  }

  /**
   * TOPN(n_value, table, [orderBy_expression], [order], ...)
   */
  private evalTopN(node: FunctionCallNode): DaxTableValue {
    if (node.args.length < 2 || !node.args[0] || !node.args[1]) {
      throw new DaxError('Semantic', 'TOPN requer no mínimo 2 argumentos (n_value, tabela)');
    }
    const n = Math.max(0, Math.trunc(daxToNumber(this.evalNode(node.args[0]), true)));
    const tableVal = this.resolveTableValue(node.args[1]);

    if (n === 0 || tableVal.rows.length === 0) {
      return {
        __isDaxTable: true,
        columns: tableVal.columns,
        rows: [],
        tableId: tableVal.tableId,
        tableName: tableVal.tableName,
        lineage: tableVal.lineage,
      };
    }

    const criteria: { exprNode: ASTNode; isDesc: boolean }[] = [];
    let i = 2;
    while (i < node.args.length) {
      const exprNode = node.args[i];
      if (!exprNode) break;
      let isDesc = true; // default in TOPN is DESC (0)
      if (i + 1 < node.args.length && node.args[i + 1]) {
        const orderArg = node.args[i + 1]!;
        let orderVal = '';
        if (orderArg.kind === 'VariableRef') {
          orderVal = orderArg.name.toUpperCase();
        } else if (orderArg.kind === 'Literal') {
          orderVal = String(orderArg.value).toUpperCase();
        } else {
          try {
            orderVal = String(this.evalNode(orderArg)).toUpperCase();
          } catch {
            orderVal = '';
          }
        }
        if (orderVal === 'ASC' || orderVal === '1' || orderVal === 'TRUE') {
          isDesc = false;
        }
        i += 2;
      } else {
        i += 1;
      }
      criteria.push({ exprNode, isDesc });
    }

    if (criteria.length === 0) {
      return {
        __isDaxTable: true,
        columns: tableVal.columns,
        rows: tableVal.rows.slice(0, n),
        tableId: tableVal.tableId,
        tableName: tableVal.tableName,
        lineage: tableVal.lineage,
      };
    }

    const stack = this.context.rowContextStack
      ? new RowContextStack((this.context.rowContextStack as any).stack)
      : new RowContextStack();

    const scoredRows: { row: Record<string, any>; keys: any[]; origIdx: number }[] = [];

    for (let rIdx = 0; rIdx < tableVal.rows.length; rIdx++) {
      const row = tableVal.rows[rIdx];
      stack.push(tableVal.tableId || '', tableVal.tableName || '', row, rIdx, tableVal.lineage);

      const rowEvaluator = new Evaluator({
        ...this.context,
        row,
        rowIndex: rIdx,
        tableId: tableVal.tableId,
        rowContextStack: stack,
      });

      const keys = criteria.map(c => rowEvaluator.evalNode(c.exprNode));
      scoredRows.push({ row, keys, origIdx: rIdx });

      stack.pop();
    }

    scoredRows.sort((a, b) => {
      for (let cIdx = 0; cIdx < criteria.length; cIdx++) {
        const isDesc = criteria[cIdx].isDesc;
        const cmp = daxCompare(a.keys[cIdx], b.keys[cIdx]);
        if (cmp !== 0) {
          return isDesc ? -cmp : cmp;
        }
      }
      return a.origIdx - b.origIdx;
    });

    const sliced = scoredRows.slice(0, n).map(s => s.row);

    return {
      __isDaxTable: true,
      columns: tableVal.columns,
      rows: sliced,
      tableId: tableVal.tableId,
      tableName: tableVal.tableName,
      lineage: tableVal.lineage,
    };
  }

  /**
   * SUMMARIZE(table, groupBy1, [groupBy2, ...], [name1, expr1, ...])
   */
  private evalSummarize(node: FunctionCallNode): DaxTableValue {
    if (node.args.length < 2 || !node.args[0]) {
      throw new DaxError('Semantic', 'SUMMARIZE requer pelo menos 2 argumentos (tabela, groupBy_column1, ...)');
    }
    const tableVal = this.resolveTableValue(node.args[0]);

    const groupByCols: { name: string; rawRef?: ColumnRefNode }[] = [];
    const extensions: { name: string; exprNode: ASTNode }[] = [];

    let i = 1;
    while (i < node.args.length) {
      const arg = node.args[i];
      if (!arg) {
        i++;
        continue;
      }

      if (
        arg.kind === 'Literal' &&
        typeof arg.value === 'string' &&
        i + 1 < node.args.length &&
        node.args[i + 1] &&
        !tableVal.columns.includes(arg.value)
      ) {
        extensions.push({ name: arg.value, exprNode: node.args[i + 1]! });
        i += 2;
        continue;
      }

      let colName = '';
      if (arg.kind === 'ColumnRef') {
        colName = arg.column;
      } else if (arg.kind === 'VariableRef') {
        colName = arg.name;
      } else if (arg.kind === 'Literal') {
        colName = String(arg.value);
      } else {
        colName = daxToString(this.evalNode(arg));
      }
      groupByCols.push({ name: colName, rawRef: arg.kind === 'ColumnRef' ? arg : undefined });
      i++;
    }

    const lineage: Record<string, any> = {};
    for (const g of groupByCols) {
      if (tableVal.lineage && tableVal.lineage[g.name]) {
        lineage[g.name] = tableVal.lineage[g.name];
      } else if (g.rawRef && g.rawRef.table) {
        lineage[g.name] = {
          tableId: g.rawRef.table,
          tableName: g.rawRef.table,
          column: g.name,
        };
      } else if (tableVal.tableId) {
        lineage[g.name] = {
          tableId: tableVal.tableId,
          tableName: tableVal.tableName || tableVal.tableId,
          column: g.name,
        };
      }
    }

    const groups = new Map<string, Record<string, any>[]>();
    for (const row of tableVal.rows) {
      const key = groupByCols.map(g => JSON.stringify(row[g.name] ?? null)).join('::');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const resultRows: Record<string, any>[] = [];
    const stack = this.context.rowContextStack
      ? new RowContextStack((this.context.rowContextStack as any).stack)
      : new RowContextStack();

    let groupIdx = 0;
    for (const [, groupRows] of groups) {
      const repRow = groupRows[0];
      const resRow: Record<string, any> = {};
      for (const g of groupByCols) {
        resRow[g.name] = repRow[g.name] !== undefined ? repRow[g.name] : DAX_BLANK;
      }

      if (extensions.length > 0) {
        stack.push(tableVal.tableId || '', tableVal.tableName || '', resRow, groupIdx, lineage);

        const groupEvaluator = new Evaluator({
          ...this.context,
          row: resRow,
          rowIndex: groupIdx,
          tableId: tableVal.tableId,
          rowContextStack: stack,
        });

        for (const ext of extensions) {
          resRow[ext.name] = groupEvaluator.evalNode(ext.exprNode);
        }

        stack.pop();
      }

      resultRows.push(resRow);
      groupIdx++;
    }

    const outputCols = [...groupByCols.map(g => g.name), ...extensions.map(e => e.name)];
    return {
      __isDaxTable: true,
      columns: outputCols,
      rows: resultRows,
      tableId: tableVal.tableId,
      tableName: tableVal.tableName,
      lineage,
    };
  }

  /**
   * SUMMARIZECOLUMNS([groupBy1, ...], [filterTable1, ...], [name1, expr1, ...])
   */
  private evalSummarizeColumns(node: FunctionCallNode): DaxTableValue {
    const model = this.context.model;
    const groupByCols: { tableId: string; tableName: string; column: string; outputName: string; isRollup?: boolean; subtotalName?: string }[] = [];
    const filterNodes: ASTNode[] = [];
    const extensions: { name: string; exprNode: ASTNode }[] = [];

    let i = 0;
    while (i < node.args.length) {
      const arg = node.args[i];
      if (!arg) {
        i++;
        continue;
      }

      if (
        arg.kind === 'Literal' &&
        typeof arg.value === 'string' &&
        i + 1 < node.args.length &&
        node.args[i + 1]
      ) {
        const extName = arg.value;
        const exprNode = node.args[i + 1]!;
        extensions.push({ name: extName, exprNode });
        i += 2;
        continue;
      }

      if (arg.kind === 'FunctionCall' && arg.name.toUpperCase() === 'ROLLUPADDISSUBTOTAL') {
        const subColArg = arg.args[0];
        const subFlagArg = arg.args[1];
        const flagName = subFlagArg && subFlagArg.kind === 'Literal' ? String(subFlagArg.value) : 'IsSubtotal';
        let colName = '';
        let tabName = '';
        if (subColArg && subColArg.kind === 'ColumnRef') {
          colName = subColArg.column;
          tabName = subColArg.table || '';
        }
        let t = tabName && model ? model.getTable(tabName) : undefined;
        if (!t && model) {
          t = model.getTables().find(tb => tb.columns.some(c => c.name.toLowerCase() === colName.toLowerCase()));
        }
        groupByCols.push({
          tableId: t ? t.id : tabName,
          tableName: t ? t.name : tabName,
          column: colName,
          outputName: colName,
          isRollup: true,
          subtotalName: flagName,
        });
        i++;
        continue;
      }

      if (arg.kind === 'ColumnRef') {
        const colName = arg.column;
        const tabName = arg.table || '';
        let t = tabName && model ? model.getTable(tabName) : undefined;
        if (!t && model) {
          t = model.getTables().find(tb => tb.columns.some(c => c.name.toLowerCase() === colName.toLowerCase()));
        }
        groupByCols.push({
          tableId: t ? t.id : tabName,
          tableName: t ? t.name : tabName,
          column: colName,
          outputName: colName,
        });
        i++;
        continue;
      }

      filterNodes.push(arg);
      i++;
    }

    let baseFilterCtx = this.context.filterContext ? this.context.filterContext.clone() : new FilterContext();
    for (const fNode of filterNodes) {
      this.applyFilterArgumentToContext(fNode, baseFilterCtx);
    }

    if (groupByCols.length === 0) {
      const singleRow: Record<string, any> = {};
      const childEval = new Evaluator({
        ...this.context,
        filterContext: baseFilterCtx,
        row: undefined,
        rowIndex: undefined,
        rowContextStack: undefined,
      });
      for (const ext of extensions) {
        singleRow[ext.name] = childEval.evalNode(ext.exprNode);
      }
      return {
        __isDaxTable: true,
        columns: extensions.map(e => e.name),
        rows: [singleRow],
      };
    }

    const lineage: Record<string, any> = {};
    groupByCols.forEach(g => {
      lineage[g.outputName] = { tableId: g.tableId, tableName: g.tableName, column: g.column };
    });

    const firstG = groupByCols[0];
    const firstTable = model?.getTable(firstG.tableId);
    const initialRows = firstTable
      ? baseFilterCtx.getFilteredRows(firstTable.id, model!)
      : [];

    let distinctCombinations: Record<string, any>[] = [];
    if (groupByCols.length === 1) {
      const set = new Set<any>();
      initialRows.forEach(r => {
        const v = r[firstG.column];
        if (v !== undefined) set.add(v);
      });
      distinctCombinations = Array.from(set).map(v => ({ [firstG.outputName]: v }));
    } else {
      let current: Record<string, any>[] = [{}];
      for (const g of groupByCols) {
        const t = model?.getTable(g.tableId);
        const tRows = t ? baseFilterCtx.getFilteredRows(t.id, model!) : [];
        const distinctVals = Array.from(new Set(tRows.map(r => r[g.column])));
        const next: Record<string, any>[] = [];
        for (const c of current) {
          for (const v of distinctVals) {
            next.push({ ...c, [g.outputName]: v });
          }
        }
        current = next;
      }
      distinctCombinations = current;
    }

    const resultRows: Record<string, any>[] = [];
    const hasRollup = groupByCols.some(g => g.isRollup);

    for (const combo of distinctCombinations) {
      const rowFilterCtx = baseFilterCtx.clone();
      for (const g of groupByCols) {
        const val = combo[g.outputName];
        rowFilterCtx.setColumnFilter(
          g.tableId,
          g.column,
          {
            tableId: g.tableId,
            column: g.column,
            allowedValues: new Set([val]),
          },
          false
        );
      }

      const rowEval = new Evaluator({
        ...this.context,
        filterContext: rowFilterCtx,
        row: undefined,
        rowIndex: undefined,
        rowContextStack: undefined,
      });

      const resRow: Record<string, any> = { ...combo };
      let allBlank = true;

      for (const ext of extensions) {
        const val = rowEval.evalNode(ext.exprNode);
        resRow[ext.name] = val;
        if (!isBlank(val) && val !== null && val !== undefined && val !== '') {
          allBlank = false;
        }
      }

      if (hasRollup) {
        for (const g of groupByCols) {
          if (g.isRollup && g.subtotalName) {
            resRow[g.subtotalName] = false;
          }
        }
      }

      if (!allBlank || extensions.length === 0) {
        resultRows.push(resRow);
      }
    }

    if (hasRollup) {
      const grandTotalEval = new Evaluator({
        ...this.context,
        filterContext: baseFilterCtx,
        row: undefined,
        rowIndex: undefined,
        rowContextStack: undefined,
      });

      const grandTotalRow: Record<string, any> = {};
      for (const g of groupByCols) {
        grandTotalRow[g.outputName] = DAX_BLANK;
        if (g.isRollup && g.subtotalName) {
          grandTotalRow[g.subtotalName] = true;
        }
      }
      for (const ext of extensions) {
        grandTotalRow[ext.name] = grandTotalEval.evalNode(ext.exprNode);
      }
      resultRows.push(grandTotalRow);
    }

    const outputCols = [
      ...groupByCols.map(g => g.outputName),
      ...(hasRollup ? groupByCols.filter(g => g.isRollup && g.subtotalName).map(g => g.subtotalName!) : []),
      ...extensions.map(e => e.name),
    ];

    return {
      __isDaxTable: true,
      columns: outputCols,
      rows: resultRows,
      lineage,
    };
  }

  /**
   * GROUPBY(table, groupBy_col1, ..., [name1, expr1, ...])
   */
  private evalGroupBy(node: FunctionCallNode): DaxTableValue {
    if (node.args.length < 2 || !node.args[0]) {
      throw new DaxError('Semantic', 'GROUPBY requer pelo menos 2 argumentos (tabela, groupBy_col1, ...)');
    }
    const tableVal = this.resolveTableValue(node.args[0]);
    const groupByCols: string[] = [];
    const extensions: { name: string; exprNode: ASTNode }[] = [];

    let i = 1;
    while (i < node.args.length) {
      const arg = node.args[i];
      if (!arg) {
        i++;
        continue;
      }

      if (
        arg.kind === 'Literal' &&
        typeof arg.value === 'string' &&
        i + 1 < node.args.length &&
        node.args[i + 1] &&
        !tableVal.columns.includes(arg.value)
      ) {
        extensions.push({ name: arg.value, exprNode: node.args[i + 1]! });
        i += 2;
        continue;
      }

      let colName = '';
      if (arg.kind === 'ColumnRef') {
        colName = arg.column;
      } else if (arg.kind === 'VariableRef') {
        colName = arg.name;
      } else {
        colName = String(this.evalNode(arg));
      }
      groupByCols.push(colName);
      i++;
    }

    const groups = new Map<string, Record<string, any>[]>();
    for (const row of tableVal.rows) {
      const key = groupByCols.map(c => JSON.stringify(row[c] ?? null)).join('::');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const resultRows: Record<string, any>[] = [];
    const lineage: Record<string, any> = {};
    for (const c of groupByCols) {
      if (tableVal.lineage && tableVal.lineage[c]) {
        lineage[c] = tableVal.lineage[c];
      }
    }

    for (const [, groupRows] of groups) {
      const rep = groupRows[0];
      const resRow: Record<string, any> = {};
      for (const c of groupByCols) {
        resRow[c] = rep[c];
      }

      if (extensions.length > 0) {
        const groupEval = new Evaluator({
          ...this.context,
          currentGroupRows: groupRows,
        });
        for (const ext of extensions) {
          resRow[ext.name] = groupEval.evalNode(ext.exprNode);
        }
      }
      resultRows.push(resRow);
    }

    const outputCols = [...groupByCols, ...extensions.map(e => e.name)];
    return {
      __isDaxTable: true,
      columns: outputCols,
      rows: resultRows,
      tableId: tableVal.tableId,
      tableName: tableVal.tableName,
      lineage,
    };
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
