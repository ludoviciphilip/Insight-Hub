import { Token, TokenType } from './tokens';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { ASTNode } from './ast';
import { DaxError } from '../shared/errors';

export type DaxDefinitionKind =
  | 'MEASURE'
  | 'COLUMN'
  | 'TABLE'
  | 'VAR'
  | 'FUNCTION';

export interface DaxMeasureDefinition {
  kind: 'MEASURE';
  table: string;
  name: string;
  rawFormula: string;
  ast: ASTNode;
}

export interface DaxColumnDefinition {
  kind: 'COLUMN';
  table: string;
  name: string;
  rawFormula: string;
  ast: ASTNode;
}

export interface DaxTableDefinition {
  kind: 'TABLE';
  name: string;
  rawFormula: string;
  ast: ASTNode;
}

export interface DaxVarDefinition {
  kind: 'VAR';
  name: string;
  rawFormula: string;
  ast: ASTNode;
}

export interface DaxFunctionDefinition {
  kind: 'FUNCTION';
  name: string;
  parameters: string[];
  rawFormula: string;
  ast: ASTNode;
}

export type DaxDefinition =
  | DaxMeasureDefinition
  | DaxColumnDefinition
  | DaxTableDefinition
  | DaxVarDefinition
  | DaxFunctionDefinition;

export interface DaxOrderByItem {
  ast: ASTNode;
  columnOrExprName?: string;
  direction: 'ASC' | 'DESC';
}

export interface DaxEvaluateStatement {
  ast: ASTNode;
  rawExpr: string;
  orderBy?: DaxOrderByItem[];
  startAt?: ASTNode[];
  unsupportedVisualClauses?: string[];
}

export interface DaxQueryAST {
  definitions: DaxDefinition[];
  evaluateStatements: DaxEvaluateStatement[];
}

/**
 * Parses full DAX Queries with DEFINE, MEASURE, COLUMN, TABLE, VAR, FUNCTION,
 * EVALUATE, ORDER BY, START AT, and detects unsupported visual statements.
 */
export class DaxQueryParser {
  private tokens: Token[];
  private current = 0;
  private input: string;

  constructor(input: string) {
    this.input = input;
    const lexer = new Lexer(input, { dialect: 'dax' });
    this.tokens = lexer.tokenize();
  }

  private peek(): Token {
    return this.tokens[this.current] || this.tokens[this.tokens.length - 1];
  }

  private previous(): Token {
    return this.tokens[this.current - 1] || this.tokens[0];
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  private checkKeyword(keyword: string): boolean {
    if (this.isAtEnd()) return false;
    const tok = this.peek();
    return (tok.type === 'IDENTIFIER' || tok.type.startsWith('KW_')) && tok.value.toUpperCase() === keyword.toUpperCase();
  }

  private matchKeyword(keyword: string): boolean {
    if (this.checkKeyword(keyword)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consumeKeyword(keyword: string, errorMsg: string): Token {
    if (this.matchKeyword(keyword)) {
      return this.previous();
    }
    const tok = this.peek();
    throw new DaxError('Syntax', `${errorMsg} (Encontrado: "${tok.raw}")`, {
      location: { line: tok.start.line, column: tok.start.column },
      snippet: tok.raw,
    });
  }

  private parseTokensWithEof(tokens: Token[]): ASTNode {
    const lastTok = tokens[tokens.length - 1];
    const eofPos = lastTok ? lastTok.end : { line: 1, column: 1, offset: 0 };
    const tokensWithEof: Token[] = [
      ...tokens,
      {
        type: 'EOF',
        value: '',
        raw: '',
        start: eofPos,
        end: eofPos,
      },
    ];
    const parser = new Parser(tokensWithEof, { dialect: 'dax' });
    return parser.parse();
  }

  public parse(): DaxQueryAST {
    const definitions: DaxDefinition[] = [];
    const evaluateStatements: DaxEvaluateStatement[] = [];

    // Optional DEFINE block
    if (this.matchKeyword('DEFINE')) {
      while (!this.isAtEnd() && !this.checkKeyword('EVALUATE')) {
        const def = this.parseDefinition();
        definitions.push(def);
      }
    }

    // One or more EVALUATE blocks
    while (!this.isAtEnd() && this.matchKeyword('EVALUATE')) {
      const stmt = this.parseEvaluateStatement();
      evaluateStatements.push(stmt);
    }

    // If query has no DEFINE or EVALUATE keywords, treat entire text as a single EVALUATE table expression
    if (definitions.length === 0 && evaluateStatements.length === 0 && !this.isAtEnd()) {
      const tokensSlice = this.tokens.filter(t => t.type !== 'EOF');
      const ast = this.parseTokensWithEof(tokensSlice);
      evaluateStatements.push({
        ast,
        rawExpr: this.input.trim(),
      });
    }

    return {
      definitions,
      evaluateStatements,
    };
  }

  private parseDefinition(): DaxDefinition {
    if (this.matchKeyword('MEASURE')) {
      return this.parseMeasureDefinition();
    }
    if (this.matchKeyword('COLUMN')) {
      return this.parseColumnDefinition();
    }
    if (this.matchKeyword('TABLE')) {
      return this.parseTableDefinition();
    }
    if (this.matchKeyword('VAR')) {
      return this.parseVarDefinition();
    }
    if (this.matchKeyword('FUNCTION')) {
      return this.parseFunctionDefinition();
    }

    const tok = this.peek();
    throw new DaxError('Syntax', `Esperado MEASURE, COLUMN, TABLE, VAR ou FUNCTION na cláusula DEFINE. Encontrado: "${tok.raw}"`, {
      location: { line: tok.start.line, column: tok.start.column },
      snippet: tok.raw,
    });
  }

  private parseMeasureDefinition(): DaxMeasureDefinition {
    // Syntax: MEASURE Table[Name] = <expr> or MEASURE 'Table'[Name] = <expr>
    let tableName = '';
    const firstTok = this.advance();

    if (firstTok.type === 'TABLE_REF' || firstTok.type === 'IDENTIFIER') {
      tableName = firstTok.value;
    } else {
      throw new DaxError('Syntax', `Nome de tabela inválido na definição de MEASURE: "${firstTok.raw}"`, {
        location: { line: firstTok.start.line, column: firstTok.start.column },
      });
    }

    const colTok = this.advance();
    let measureName = '';
    if (colTok.type === 'COLUMN_REF') {
      measureName = colTok.value;
    } else {
      throw new DaxError('Syntax', `Esperado [NomeDaMedida] após o nome da tabela. Encontrado: "${colTok.raw}"`, {
        location: { line: colTok.start.line, column: colTok.start.column },
      });
    }

    // Consume '='
    if (this.peek().type !== 'OP_EQ') {
      throw new DaxError('Syntax', `Esperado "=" após a definição da medida ${tableName}[${measureName}]`, {
        location: { line: this.peek().start.line, column: this.peek().start.column },
      });
    }
    this.advance();

    // Expression up to next DEFINE keyword, EVALUATE, or EOF
    const { ast, rawFormula } = this.parseExpressionUntilBoundary();

    return {
      kind: 'MEASURE',
      table: tableName,
      name: measureName,
      rawFormula,
      ast,
    };
  }

  private parseColumnDefinition(): DaxColumnDefinition {
    // Syntax: COLUMN Table[Column] = <expr>
    let tableName = '';
    const firstTok = this.advance();

    if (firstTok.type === 'TABLE_REF' || firstTok.type === 'IDENTIFIER') {
      tableName = firstTok.value;
    } else {
      throw new DaxError('Syntax', `Nome de tabela inválido na definição de COLUMN: "${firstTok.raw}"`, {
        location: { line: firstTok.start.line, column: firstTok.start.column },
      });
    }

    const colTok = this.advance();
    let columnName = '';
    if (colTok.type === 'COLUMN_REF') {
      columnName = colTok.value;
    } else {
      throw new DaxError('Syntax', `Esperado [NomeDaColuna] após o nome da tabela. Encontrado: "${colTok.raw}"`, {
        location: { line: colTok.start.line, column: colTok.start.column },
      });
    }

    if (this.peek().type !== 'OP_EQ') {
      throw new DaxError('Syntax', `Esperado "=" após a definição da coluna ${tableName}[${columnName}]`, {
        location: { line: this.peek().start.line, column: this.peek().start.column },
      });
    }
    this.advance();

    const { ast, rawFormula } = this.parseExpressionUntilBoundary();

    return {
      kind: 'COLUMN',
      table: tableName,
      name: columnName,
      rawFormula,
      ast,
    };
  }

  private parseTableDefinition(): DaxTableDefinition {
    // Syntax: TABLE TableName = <expr> or TABLE 'TableName' = <expr>
    const nameTok = this.advance();
    let tableName = '';
    if (nameTok.type === 'IDENTIFIER' || nameTok.type === 'TABLE_REF') {
      tableName = nameTok.value;
    } else {
      throw new DaxError('Syntax', `Nome inválido para TABLE: "${nameTok.raw}"`, {
        location: { line: nameTok.start.line, column: nameTok.start.column },
      });
    }

    if (this.peek().type !== 'OP_EQ') {
      throw new DaxError('Syntax', `Esperado "=" após o nome da tabela "${tableName}"`, {
        location: { line: this.peek().start.line, column: this.peek().start.column },
      });
    }
    this.advance();

    const { ast, rawFormula } = this.parseExpressionUntilBoundary();

    return {
      kind: 'TABLE',
      name: tableName,
      rawFormula,
      ast,
    };
  }

  private parseVarDefinition(): DaxVarDefinition {
    // Syntax: VAR VarName = <expr>
    const nameTok = this.advance();
    let varName = '';
    if (nameTok.type === 'IDENTIFIER') {
      varName = nameTok.value;
    } else {
      throw new DaxError('Syntax', `Nome de variável inválido na definição de VAR: "${nameTok.raw}"`, {
        location: { line: nameTok.start.line, column: nameTok.start.column },
      });
    }

    if (this.peek().type !== 'OP_EQ') {
      throw new DaxError('Syntax', `Esperado "=" após o nome da variável "${varName}"`, {
        location: { line: this.peek().start.line, column: this.peek().start.column },
      });
    }
    this.advance();

    const { ast, rawFormula } = this.parseExpressionUntilBoundary();

    return {
      kind: 'VAR',
      name: varName,
      rawFormula,
      ast,
    };
  }

  private parseFunctionDefinition(): DaxFunctionDefinition {
    // Syntax: FUNCTION FunctionName(param1, param2) = <expr>
    const nameTok = this.advance();
    let fnName = '';
    if (nameTok.type === 'IDENTIFIER') {
      fnName = nameTok.value;
    } else {
      throw new DaxError('Syntax', `Nome de função inválido na definição de FUNCTION: "${nameTok.raw}"`, {
        location: { line: nameTok.start.line, column: nameTok.start.column },
      });
    }

    if (this.peek().type !== 'LPAREN') {
      throw new DaxError('Syntax', `Esperado "(" após o nome da função "${fnName}"`, {
        location: { line: this.peek().start.line, column: this.peek().start.column },
      });
    }
    this.advance();

    const params: string[] = [];
    while (!this.isAtEnd() && this.peek().type !== 'RPAREN') {
      const pTok = this.advance();
      if (pTok.type === 'IDENTIFIER') {
        params.push(pTok.value);
      } else {
        throw new DaxError('Syntax', `Nome de parâmetro inválido em FUNCTION "${fnName}": "${pTok.raw}"`, {
          location: { line: pTok.start.line, column: pTok.start.column },
        });
      }

      if (this.peek().type === 'COMMA' || this.peek().type === 'SEMICOLON') {
        this.advance();
      } else if (this.peek().type !== 'RPAREN') {
        throw new DaxError('Syntax', `Esperado "," ou ")" na lista de parâmetros de FUNCTION`, {
          location: { line: this.peek().start.line, column: this.peek().start.column },
        });
      }
    }

    if (this.peek().type === 'RPAREN') {
      this.advance();
    }

    if (this.peek().type !== 'OP_EQ') {
      throw new DaxError('Syntax', `Esperado "=" após a assinatura da função "${fnName}"`, {
        location: { line: this.peek().start.line, column: this.peek().start.column },
      });
    }
    this.advance();

    const { ast, rawFormula } = this.parseExpressionUntilBoundary();

    return {
      kind: 'FUNCTION',
      name: fnName,
      parameters: params,
      rawFormula,
      ast,
    };
  }

  private parseEvaluateStatement(): DaxEvaluateStatement {
    const exprTokens: Token[] = [];
    const unsupportedVisualClauses: string[] = [];

    let depth = 0;
    while (!this.isAtEnd()) {
      const tok = this.peek();

      if (tok.type === 'LPAREN' || tok.type === 'LBRACE') depth++;
      else if (tok.type === 'RPAREN' || tok.type === 'RBRACE') depth--;

      if (depth === 0) {
        // Check for ORDER BY, START AT, or next EVALUATE
        if (this.checkKeyword('ORDER') || this.checkKeyword('START') || this.checkKeyword('EVALUATE')) {
          break;
        }

        // Check visual-specific statements
        if (
          this.checkKeyword('AXIS') ||
          this.checkKeyword('DENSIFY') ||
          this.checkKeyword('GROUP') ||
          this.checkKeyword('TOTAL') ||
          this.checkKeyword('WITH') ||
          this.checkKeyword('MPARAMETER')
        ) {
          unsupportedVisualClauses.push(tok.value.toUpperCase());
          break;
        }
      }

      exprTokens.push(this.advance());
    }

    if (exprTokens.length === 0) {
      throw new DaxError('Syntax', 'Esperada expressão de tabela após EVALUATE');
    }

    const ast = this.parseTokensWithEof(exprTokens);
    const rawExpr = exprTokens.map(t => t.raw).join(' ');

    let orderBy: DaxOrderByItem[] | undefined;
    let startAt: ASTNode[] | undefined;

    // Optional ORDER BY
    if (this.matchKeyword('ORDER')) {
      this.consumeKeyword('BY', 'Esperado "BY" após "ORDER"');
      orderBy = this.parseOrderBy();
    }

    // Optional START AT
    if (this.matchKeyword('START')) {
      this.consumeKeyword('AT', 'Esperado "AT" após "START"');
      startAt = this.parseStartAt();
    }

    // Check for visual calculation statements at end
    while (!this.isAtEnd() && !this.checkKeyword('EVALUATE')) {
      const tok = this.advance();
      const upper = tok.value.toUpperCase();
      if (['AXIS', 'DENSIFY', 'GROUP', 'TOTAL', 'WITH', 'SHAPE', 'MPARAMETER'].includes(upper)) {
        if (!unsupportedVisualClauses.includes(upper)) {
          unsupportedVisualClauses.push(upper);
        }
      }
    }

    return {
      ast,
      rawExpr,
      orderBy,
      startAt,
      unsupportedVisualClauses: unsupportedVisualClauses.length > 0 ? unsupportedVisualClauses : undefined,
    };
  }

  private parseOrderBy(): DaxOrderByItem[] {
    const items: DaxOrderByItem[] = [];

    while (!this.isAtEnd()) {
      const exprTokens: Token[] = [];
      let depth = 0;

      while (!this.isAtEnd()) {
        const tok = this.peek();
        if (tok.type === 'LPAREN' || tok.type === 'LBRACE') depth++;
        else if (tok.type === 'RPAREN' || tok.type === 'RBRACE') depth--;

        if (depth === 0) {
          if (
            tok.type === 'COMMA' ||
            tok.type === 'SEMICOLON' ||
            this.checkKeyword('ASC') ||
            this.checkKeyword('DESC') ||
            this.checkKeyword('START') ||
            this.checkKeyword('EVALUATE') ||
            this.checkKeyword('AXIS') ||
            this.checkKeyword('WITH')
          ) {
            break;
          }
        }
        exprTokens.push(this.advance());
      }

      if (exprTokens.length === 0) {
        break;
      }

      const ast = this.parseTokensWithEof(exprTokens);

      let direction: 'ASC' | 'DESC' = 'ASC';
      if (this.matchKeyword('DESC')) {
        direction = 'DESC';
      } else if (this.matchKeyword('ASC')) {
        direction = 'ASC';
      }

      let colName = exprTokens.map(t => t.raw).join(' ');
      if (exprTokens.length === 1 && exprTokens[0].type === 'COLUMN_REF') {
        colName = exprTokens[0].value;
      }

      items.push({
        ast,
        columnOrExprName: colName,
        direction,
      });

      if (this.peek().type === 'COMMA' || this.peek().type === 'SEMICOLON') {
        this.advance();
      } else {
        break;
      }
    }

    return items;
  }

  private parseStartAt(): ASTNode[] {
    const items: ASTNode[] = [];

    while (!this.isAtEnd()) {
      const exprTokens: Token[] = [];
      let depth = 0;

      while (!this.isAtEnd()) {
        const tok = this.peek();
        if (tok.type === 'LPAREN' || tok.type === 'LBRACE') depth++;
        else if (tok.type === 'RPAREN' || tok.type === 'RBRACE') depth--;

        if (depth === 0) {
          if (
            tok.type === 'COMMA' ||
            tok.type === 'SEMICOLON' ||
            this.checkKeyword('EVALUATE') ||
            this.checkKeyword('AXIS')
          ) {
            break;
          }
        }
        exprTokens.push(this.advance());
      }

      if (exprTokens.length === 0) break;

      items.push(this.parseTokensWithEof(exprTokens));

      if (this.peek().type === 'COMMA' || this.peek().type === 'SEMICOLON') {
        this.advance();
      } else {
        break;
      }
    }

    return items;
  }

  private parseExpressionUntilBoundary(): { ast: ASTNode; rawFormula: string } {
    const exprTokens: Token[] = [];
    let depth = 0;

    while (!this.isAtEnd()) {
      const tok = this.peek();
      if (tok.type === 'LPAREN' || tok.type === 'LBRACE') depth++;
      else if (tok.type === 'RPAREN' || tok.type === 'RBRACE') depth--;

      if (depth === 0) {
        if (
          this.checkKeyword('MEASURE') ||
          this.checkKeyword('COLUMN') ||
          this.checkKeyword('TABLE') ||
          this.checkKeyword('VAR') ||
          this.checkKeyword('FUNCTION') ||
          this.checkKeyword('EVALUATE')
        ) {
          break;
        }
      }

      exprTokens.push(this.advance());
    }

    if (exprTokens.length === 0) {
      throw new DaxError('Syntax', 'Esperada expressão após "=" na definição');
    }

    const ast = this.parseTokensWithEof(exprTokens);
    const rawFormula = exprTokens.map(t => t.raw).join(' ');

    return { ast, rawFormula };
  }
}
