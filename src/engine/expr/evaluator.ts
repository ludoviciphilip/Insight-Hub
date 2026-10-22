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
import { Table, Measure, Filter, Column } from '../../types/bi';
import { ModelAccess } from '../model/modelAccess';

export interface EvalContext {
  dialect?: 'dax' | 'column';
  row?: Record<string, any>;
  rowIndex?: number;
  columns?: Column[];
  variables?: Map<string, any>;
  measures?: Measure[];
  tables?: Table[];
  model?: ModelAccess | null;
  activeFilters?: Filter[];
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

    if (this.context.resolveMeasure) {
      try {
        const resolved = this.context.resolveMeasure(measure.name);
        if (resolved !== undefined) return resolved;
      } catch (e: any) {
        if (e instanceof DaxError && (e.kind === 'Execution' || (e as any).type === 'Execution') && e.message.toLowerCase().includes('circular')) {
          throw e;
        }
      }
    }

    const childEval = new Evaluator({
      ...this.context,
      dialect: 'dax',
      callStack: nextStack,
    });
    return childEval.evaluate(measure.formula);
  }

  private evalColumnRef(node: ColumnRefNode): any {
    // 1. In DAX, unqualified [Identifier] without a table prefix can be a Measure
    if (!node.table) {
      if (this.context.resolveMeasure) {
        try {
          const res = this.context.resolveMeasure(node.column);
          if (res !== undefined) return res;
        } catch (e: any) {
          if (e instanceof DaxError && (e.kind === 'Execution' || (e as any).type === 'Execution') && e.message.toLowerCase().includes('circular')) {
            throw e;
          }
        }
      }

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
    }

    // 2. Otherwise evaluate against row context
    const row = this.context.row;
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

    // Check custom resolver first
    if (this.context.resolveMeasure) {
      const res = this.context.resolveMeasure(mName);
      if (res !== undefined) return res;
    }

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

    // In column dialect, a [Bracket] might be a column if not found as measure
    if (this.context.row) {
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
    if (this.context.dialect === 'column' && this.context.row) {
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
    const fnDef = lookupFunction(fnName);

    // ==========================================
    // Handle Lazy Evaluation Functions Directly
    // ==========================================

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
      // Case pairs: (val_i, res_i)
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

      // Check if there is an odd trailing argument (the default/else case)
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
      // IFS(cond1, val1, cond2, val2, ..., [default])
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
      } else if (arg.kind === 'Literal') {
        tableName = String(arg.value);
      }
      const model = this.context.model;
      const tables = this.context.tables || [];
      const table =
        (model && typeof model.getTable === 'function' ? model.getTable(tableName) : undefined) ||
        tables.find(t => t.id === tableName || t.name.toLowerCase() === tableName.toLowerCase());

      if (!table) {
        return 0;
      }
      if (model && typeof model.getFilteredRows === 'function') {
        return model.getFilteredRows(table.id, this.context.activeFilters || []).length;
      }
      return table.rows.length;
    }

    // ==========================================
    // Eager Evaluation for Registry Functions
    // ==========================================
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

    // Evaluate all arguments eagerly
    const evaluatedArgs = node.args.map(arg => (arg ? this.evalNode(arg) : DAX_BLANK));

    if (fnDef.evaluate) {
      return fnDef.evaluate(evaluatedArgs, this.context);
    }

    return DAX_BLANK;
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
    // Create new scope for variables
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
