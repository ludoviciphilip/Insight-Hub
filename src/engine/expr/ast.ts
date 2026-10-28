export interface NodeLocation {
  line: number;
  column: number;
  length?: number;
}

export type ASTNode =
  | LiteralNode
  | ColumnRefNode
  | MeasureRefNode
  | VariableRefNode
  | UnaryOpNode
  | BinaryOpNode
  | FunctionCallNode
  | TableConstructorNode
  | VarReturnNode;

export interface BaseNode {
  loc?: NodeLocation;
}

export interface LiteralNode extends BaseNode {
  kind: 'Literal';
  literalType: 'number' | 'string' | 'boolean' | 'blank';
  value: any;
}

export interface ColumnRefNode extends BaseNode {
  kind: 'ColumnRef';
  table?: string;
  column: string;
}

export interface MeasureRefNode extends BaseNode {
  kind: 'MeasureRef';
  measure: string;
}

export interface VariableRefNode extends BaseNode {
  kind: 'VariableRef';
  name: string;
}

export interface UnaryOpNode extends BaseNode {
  kind: 'UnaryOp';
  operator: '-' | '+' | 'NOT';
  operand: ASTNode;
}

export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '^'
  | '&'
  | '='
  | '=='
  | '<>'
  | '<'
  | '<='
  | '>'
  | '>='
  | '&&'
  | '||'
  | '%'
  | 'IN';

export interface BinaryOpNode extends BaseNode {
  kind: 'BinaryOp';
  operator: BinaryOperator;
  left: ASTNode;
  right: ASTNode;
}

export interface FunctionCallNode extends BaseNode {
  kind: 'FunctionCall';
  name: string;
  args: (ASTNode | null)[];
}

export interface TableConstructorNode extends BaseNode {
  kind: 'TableConstructor';
  elements: (ASTNode | ASTNode[])[];
}

export interface VarDeclaration {
  name: string;
  expr: ASTNode;
}

export interface VarReturnNode extends BaseNode {
  kind: 'VarReturn';
  variables: VarDeclaration[];
  returnExpr: ASTNode;
}
