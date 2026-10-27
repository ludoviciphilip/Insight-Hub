import { Token, TokenType } from './tokens';
import { Lexer, LexerOptions } from './lexer';
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
  VarDeclaration,
  BinaryOperator,
  NodeLocation,
} from './ast';
import { DaxError } from '../shared/errors';

enum Precedence {
  Lowest = 0,
  LogicalOr = 10,       // ||
  LogicalAnd = 20,      // &&
  LogicalNot = 25,      // NOT
  Comparison = 30,      // = == <> < <= > >= IN
  Concat = 40,          // &
  Sum = 50,             // + -
  Product = 60,         // * / %
  Unary = 70,           // unary - + NOT
  Power = 80,           // ^
  Call = 90,
}

export class Parser {
  private tokens: Token[];
  private current = 0;
  private dialect: 'dax' | 'column';
  private knownColumnNames: Set<string>;

  constructor(tokens: Token[], options: LexerOptions = {}) {
    this.tokens = tokens;
    this.dialect = options.dialect || 'dax';
    this.knownColumnNames = new Set((options.knownColumnNames || []).map(c => c.toLowerCase().trim()));
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

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const t of types) {
      if (this.check(t)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    const tok = this.peek();
    throw new DaxError('Syntax', `${message} (Encontrado: "${tok.raw || tok.type}")`, {
      location: { line: tok.start.line, column: tok.start.column },
      snippet: tok.raw,
    });
  }

  private getPrecedence(token: Token): Precedence {
    switch (token.type) {
      case 'OP_OR':
        return Precedence.LogicalOr;
      case 'OP_AND':
        return Precedence.LogicalAnd;
      case 'KW_NOT':
        return Precedence.LogicalNot;
      case 'OP_EQ':
      case 'OP_EXACT_EQ':
      case 'OP_NEQ':
      case 'OP_LT':
      case 'OP_LTE':
      case 'OP_GT':
      case 'OP_GTE':
      case 'KW_IN':
        return Precedence.Comparison;
      case 'OP_CONCAT':
        return Precedence.Concat;
      case 'OP_ADD':
      case 'OP_SUB':
        return Precedence.Sum;
      case 'OP_MUL':
      case 'OP_DIV':
      case 'OP_MOD':
        return Precedence.Product;
      case 'OP_POW':
        return Precedence.Power;
      default:
        return Precedence.Lowest;
    }
  }

  public parse(): ASTNode {
    if (this.isAtEnd()) {
      return {
        kind: 'Literal',
        literalType: 'blank',
        value: null,
        loc: { line: 1, column: 1 },
      };
    }

    // Check for top-level VAR / RETURN statement
    if (this.check('KW_VAR')) {
      return this.parseVarReturn();
    }

    const expr = this.parseExpression(Precedence.Lowest);

    if (!this.isAtEnd()) {
      const extra = this.peek();
      throw new DaxError('Syntax', `Conteúdo inesperado após expressão: "${extra.raw}"`, {
        location: { line: extra.start.line, column: extra.start.column },
        snippet: extra.raw,
      });
    }

    return expr;
  }

  private parseVarReturn(firstVarConsumed = false): VarReturnNode {
    const startTok = this.peek();
    const variables: VarDeclaration[] = [];

    let hasVar = firstVarConsumed || this.match('KW_VAR');
    while (hasVar) {
      const varNameTok = this.consume('IDENTIFIER', 'Esperado nome da variável após VAR');
      this.consume('OP_EQ', 'Esperado "=" após nome da variável em declaração VAR');
      const expr = this.parseExpression(Precedence.Lowest);
      variables.push({
        name: varNameTok.value,
        expr,
      });
      hasVar = this.match('KW_VAR');
    }

    if (!this.match('KW_RETURN')) {
      const tok = this.peek();
      throw new DaxError('Syntax', 'Esperado bloco RETURN após declaração de variáveis VAR', {
        location: { line: tok.start.line, column: tok.start.column },
        snippet: tok.raw,
      });
    }

    const returnExpr = this.parseExpression(Precedence.Lowest);

    return {
      kind: 'VarReturn',
      variables,
      returnExpr,
      loc: { line: startTok.start.line, column: startTok.start.column },
    };
  }

  public parseExpression(precedence: Precedence): ASTNode {
    let left = this.parsePrefix();

    while (!this.isAtEnd() && precedence < this.getPrecedence(this.peek())) {
      left = this.parseInfix(left);
    }

    return left;
  }

  private parsePrefix(): ASTNode {
    const tok = this.advance();
    const loc: NodeLocation = { line: tok.start.line, column: tok.start.column, length: tok.raw.length };

    switch (tok.type) {
      case 'NUMBER': {
        const numVal = parseFloat(tok.value);
        return {
          kind: 'Literal',
          literalType: 'number',
          value: numVal,
          loc,
        };
      }

      case 'STRING':
        return {
          kind: 'Literal',
          literalType: 'string',
          value: tok.value,
          loc,
        };

      case 'KW_TRUE': {
        if (this.check('LPAREN')) {
          this.advance();
          return this.parseFunctionCall('TRUE', loc);
        }
        return {
          kind: 'Literal',
          literalType: 'boolean',
          value: true,
          loc,
        };
      }

      case 'KW_FALSE': {
        if (this.check('LPAREN')) {
          this.advance();
          return this.parseFunctionCall('FALSE', loc);
        }
        return {
          kind: 'Literal',
          literalType: 'boolean',
          value: false,
          loc,
        };
      }

      case 'KW_BLANK': {
        if (this.check('LPAREN')) {
          this.advance();
          return this.parseFunctionCall('BLANK', loc);
        }
        return {
          kind: 'Literal',
          literalType: 'blank',
          value: null,
          loc,
        };
      }

      case 'OP_SUB': {
        const operand = this.parseExpression(Precedence.Unary);
        return {
          kind: 'UnaryOp',
          operator: '-',
          operand,
          loc,
        };
      }

      case 'OP_ADD': {
        const operand = this.parseExpression(Precedence.Unary);
        return {
          kind: 'UnaryOp',
          operator: '+',
          operand,
          loc,
        };
      }

      case 'KW_NOT': {
        if (this.check('LPAREN')) {
          this.advance();
          return this.parseFunctionCall('NOT', loc);
        }
        const operand = this.parseExpression(Precedence.Unary);
        return {
          kind: 'UnaryOp',
          operator: 'NOT',
          operand,
          loc,
        };
      }

      case 'LPAREN': {
        const expr = this.parseExpression(Precedence.Lowest);
        this.consume('RPAREN', 'Esperado ")" para fechar expressão');
        return expr;
      }

      case 'LBRACE':
        return this.parseTableConstructor(loc);

      case 'COLUMN_REF':
        return {
          kind: 'ColumnRef',
          column: tok.value,
          loc,
        };

      case 'TABLE_REF': {
        // 'Table Name'[Column Name]
        if (this.check('COLUMN_REF')) {
          const colTok = this.advance();
          return {
            kind: 'ColumnRef',
            table: tok.value,
            column: colTok.value,
            loc,
          };
        }
        // In column dialect, standalone single-quoted text is a string literal
        if (this.dialect === 'column') {
          return {
            kind: 'Literal',
            literalType: 'string',
            value: tok.value,
            loc,
          };
        }
        // Otherwise a table reference
        return {
          kind: 'ColumnRef',
          table: tok.value,
          column: '',
          loc,
        };
      }

      case 'KW_VAR':
        return this.parseVarReturn(true);

      case 'IDENTIFIER': {
        const id = tok.value;
        const upper = id.toUpperCase();

        // 1. Function call: ID(...)
        if (this.check('LPAREN')) {
          this.advance(); // consume (
          return this.parseFunctionCall(upper, loc);
        }

        // 2. Table[Column] unquoted table prefix
        if (this.check('COLUMN_REF')) {
          const colTok = this.advance();
          return {
            kind: 'ColumnRef',
            table: id,
            column: colTok.value,
            loc,
          };
        }

        // 3. In column dialect, check if it's an unbracketed column
        if (this.dialect === 'column') {
          if (this.knownColumnNames.has(id.toLowerCase())) {
            return {
              kind: 'ColumnRef',
              column: id,
              loc,
            };
          }
        }

        // 4. Default: Variable or Measure / unbracketed reference
        return {
          kind: 'VariableRef',
          name: id,
          loc,
        };
      }

      default:
        throw new DaxError('Syntax', `Elemento inesperado: "${tok.raw}"`, {
          location: { line: tok.start.line, column: tok.start.column },
          snippet: tok.raw,
        });
    }
  }

  private parseInfix(left: ASTNode): ASTNode {
    const tok = this.advance();
    const precedence = this.getPrecedence(tok);
    const loc: NodeLocation = left.loc || { line: tok.start.line, column: tok.start.column };

    let op: BinaryOperator;
    switch (tok.type) {
      case 'OP_ADD':
        op = '+';
        break;
      case 'OP_SUB':
        op = '-';
        break;
      case 'OP_MUL':
        op = '*';
        break;
      case 'OP_DIV':
        op = '/';
        break;
      case 'OP_MOD':
        op = '%';
        break;
      case 'OP_POW':
        op = '^';
        break;
      case 'OP_CONCAT':
        op = '&';
        break;
      case 'OP_EQ':
        op = '=';
        break;
      case 'OP_EXACT_EQ':
        op = '==';
        break;
      case 'OP_NEQ':
        op = '<>';
        break;
      case 'OP_LT':
        op = '<';
        break;
      case 'OP_LTE':
        op = '<=';
        break;
      case 'OP_GT':
        op = '>';
        break;
      case 'OP_GTE':
        op = '>=';
        break;
      case 'OP_AND':
        op = '&&';
        break;
      case 'OP_OR':
        op = '||';
        break;
      case 'KW_IN':
        op = 'IN';
        break;
      default:
        throw new DaxError('Syntax', `Operador desconhecido: "${tok.raw}"`, {
          location: { line: tok.start.line, column: tok.start.column },
          snippet: tok.raw,
        });
    }

    // Power operator (^) is right-associative in DAX, so parse with precedence - 1
    const rightPrecedence = op === '^' ? precedence - 1 : precedence;
    const right = this.parseExpression(rightPrecedence);

    return {
      kind: 'BinaryOp',
      operator: op,
      left,
      right,
      loc,
    };
  }

  private parseFunctionCall(name: string, loc: NodeLocation): FunctionCallNode {
    const args: (ASTNode | null)[] = [];

    if (!this.check('RPAREN')) {
      while (true) {
        // Support omitted optional arguments: e.g. IF(cond, val, ) or FUNC(a, , c)
        if (this.check('COMMA') || this.check('SEMICOLON')) {
          args.push(null);
          this.advance(); // consume comma/semicolon
          continue;
        }

        if (this.check('RPAREN')) {
          // trailing empty arg e.g. FUNC(a, )
          args.push(null);
          break;
        }

        const arg = this.parseExpression(Precedence.Lowest);
        args.push(arg);

        if (this.match('COMMA', 'SEMICOLON')) {
          if (this.check('RPAREN')) {
            // trailing comma before closing paren e.g. FUNC(a, )
            args.push(null);
            break;
          }
          continue;
        } else {
          break;
        }
      }
    }

    this.consume('RPAREN', `Esperado ")" para fechar chamada da função ${name}`);

    return {
      kind: 'FunctionCall',
      name,
      args,
      loc,
    };
  }

  private parseTableConstructor(loc: NodeLocation): TableConstructorNode {
    const elements: (ASTNode | ASTNode[])[] = [];

    if (!this.check('RBRACE')) {
      while (true) {
        // Check for row tuple constructor: (1, "a") inside table constructor
        if (this.check('LPAREN')) {
          this.advance(); // consume (
          const rowTuple: ASTNode[] = [];
          if (!this.check('RPAREN')) {
            while (true) {
              rowTuple.push(this.parseExpression(Precedence.Lowest));
              if (this.match('COMMA', 'SEMICOLON')) {
                continue;
              } else {
                break;
              }
            }
          }
          this.consume('RPAREN', 'Esperado ")" para fechar tupla da linha de tabela');
          elements.push(rowTuple);
        } else {
          const item = this.parseExpression(Precedence.Lowest);
          elements.push(item);
        }

        if (this.match('COMMA', 'SEMICOLON')) {
          continue;
        } else {
          break;
        }
      }
    }

    this.consume('RBRACE', 'Esperado "}" para fechar construtor de tabela { ... }');

    return {
      kind: 'TableConstructor',
      elements,
      loc,
    };
  }
}

export function parseExpression(input: string, options?: LexerOptions): ASTNode {
  const lexer = new Lexer(input, options);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, options);
  return parser.parse();
}
