import { Token, SourcePosition } from './tokens';
import { DaxError } from '../shared/errors';

export interface LexerOptions {
  dialect?: 'dax' | 'column';
  locale?: 'pt-BR' | 'en-US' | 'auto';
  knownColumnNames?: string[]; // for column dialect unbracketed resolution
}

export class Lexer {
  private input: string;
  private pos = 0;
  private line = 1;
  private col = 1;
  private dialect: 'dax' | 'column';
  private locale: 'pt-BR' | 'en-US' | 'auto';

  public getLocale(): string {
    return this.locale;
  }

  constructor(input: string, options: LexerOptions = {}) {
    this.input = input;
    this.dialect = options.dialect || 'dax';
    this.locale = options.locale || 'auto';

    // In column dialect, strip leading = or fx=
    if (this.dialect === 'column') {
      const trimmed = this.input.trimStart();
      if (trimmed.startsWith('=')) {
        const offset = this.input.indexOf('=') + 1;
        this.input = ' '.repeat(offset) + this.input.slice(offset);
      } else if (trimmed.toLowerCase().startsWith('fx=')) {
        const offset = this.input.toLowerCase().indexOf('fx=') + 3;
        this.input = ' '.repeat(offset) + this.input.slice(offset);
      }
    }
  }

  private current(): string {
    return this.pos < this.input.length ? this.input[this.pos] : '';
  }

  private peek(offset = 1): string {
    const idx = this.pos + offset;
    return idx < this.input.length ? this.input[idx] : '';
  }

  private advance(): string {
    const ch = this.current();
    this.pos++;
    if (ch === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  private getPos(): SourcePosition {
    return { line: this.line, column: this.col, offset: this.pos };
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.input.length) {
      const ch = this.current();

      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
        continue;
      }

      // Single line comments: // or --
      if (ch === '/' && this.peek() === '/') {
        this.advance();
        this.advance();
        while (this.pos < this.input.length && this.current() !== '\n') {
          this.advance();
        }
        continue;
      }

      if (ch === '-' && this.peek() === '-') {
        this.advance();
        this.advance();
        while (this.pos < this.input.length && this.current() !== '\n') {
          this.advance();
        }
        continue;
      }

      // Multi-line comment: /* ... */
      if (ch === '/' && this.peek() === '*') {
        const startPos = this.getPos();
        this.advance();
        this.advance();
        let closed = false;
        while (this.pos < this.input.length) {
          if (this.current() === '*' && this.peek() === '/') {
            this.advance();
            this.advance();
            closed = true;
            break;
          }
          this.advance();
        }
        if (!closed) {
          throw new DaxError('Syntax', 'Comentário de bloco /* ... */ não foi fechado', {
            location: { line: startPos.line, column: startPos.column },
            snippet: '/*',
          });
        }
        continue;
      }

      break;
    }
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (true) {
      this.skipWhitespaceAndComments();

      if (this.pos >= this.input.length) {
        tokens.push({
          type: 'EOF',
          value: '',
          raw: '',
          start: this.getPos(),
          end: this.getPos(),
        });
        break;
      }

      const start = this.getPos();
      const ch = this.current();

      // 1. Bracketed identifier [Column or Measure]
      if (ch === '[') {
        tokens.push(this.scanBracketedIdentifier());
        continue;
      }

      // 2. Single-quoted identifier 'Table Name' or string in column dialect
      if (ch === "'") {
        tokens.push(this.scanSingleQuotedToken());
        continue;
      }

      // 3. Double-quoted string "Hello"
      if (ch === '"') {
        tokens.push(this.scanDoubleQuotedString());
        continue;
      }

      // 4. Numbers (with optional decimal, scientific notation, and optional %)
      if (this.isDigit(ch) || (ch === '.' && this.isDigit(this.peek()))) {
        tokens.push(this.scanNumber());
        continue;
      }

      // 5. Two-character operators
      const twoChar = ch + this.peek();
      if (twoChar === '==') {
        this.advance();
        this.advance();
        tokens.push({ type: 'OP_EXACT_EQ', value: '==', raw: '==', start, end: this.getPos() });
        continue;
      }
      if (twoChar === '<>') {
        this.advance();
        this.advance();
        tokens.push({ type: 'OP_NEQ', value: '<>', raw: '<>', start, end: this.getPos() });
        continue;
      }
      if (twoChar === '<=') {
        this.advance();
        this.advance();
        tokens.push({ type: 'OP_LTE', value: '<=', raw: '<=', start, end: this.getPos() });
        continue;
      }
      if (twoChar === '>=') {
        this.advance();
        this.advance();
        tokens.push({ type: 'OP_GTE', value: '>=', raw: '>=', start, end: this.getPos() });
        continue;
      }
      if (twoChar === '&&') {
        this.advance();
        this.advance();
        tokens.push({ type: 'OP_AND', value: '&&', raw: '&&', start, end: this.getPos() });
        continue;
      }
      if (twoChar === '||') {
        this.advance();
        this.advance();
        tokens.push({ type: 'OP_OR', value: '||', raw: '||', start, end: this.getPos() });
        continue;
      }

      // 6. Single-character operators & delimiters
      switch (ch) {
        case '+':
          this.advance();
          tokens.push({ type: 'OP_ADD', value: '+', raw: '+', start, end: this.getPos() });
          continue;
        case '-':
          this.advance();
          tokens.push({ type: 'OP_SUB', value: '-', raw: '-', start, end: this.getPos() });
          continue;
        case '*':
          this.advance();
          tokens.push({ type: 'OP_MUL', value: '*', raw: '*', start, end: this.getPos() });
          continue;
        case '/':
          this.advance();
          tokens.push({ type: 'OP_DIV', value: '/', raw: '/', start, end: this.getPos() });
          continue;
        case '%':
          this.advance();
          tokens.push({ type: 'OP_MOD', value: '%', raw: '%', start, end: this.getPos() });
          continue;
        case '^':
          this.advance();
          tokens.push({ type: 'OP_POW', value: '^', raw: '^', start, end: this.getPos() });
          continue;
        case '&':
          this.advance();
          tokens.push({ type: 'OP_CONCAT', value: '&', raw: '&', start, end: this.getPos() });
          continue;
        case '=':
          this.advance();
          tokens.push({ type: 'OP_EQ', value: '=', raw: '=', start, end: this.getPos() });
          continue;
        case '<':
          this.advance();
          tokens.push({ type: 'OP_LT', value: '<', raw: '<', start, end: this.getPos() });
          continue;
        case '>':
          this.advance();
          tokens.push({ type: 'OP_GT', value: '>', raw: '>', start, end: this.getPos() });
          continue;
        case '(':
          this.advance();
          tokens.push({ type: 'LPAREN', value: '(', raw: '(', start, end: this.getPos() });
          continue;
        case ')':
          this.advance();
          tokens.push({ type: 'RPAREN', value: ')', raw: ')', start, end: this.getPos() });
          continue;
        case '{':
          this.advance();
          tokens.push({ type: 'LBRACE', value: '{', raw: '{', start, end: this.getPos() });
          continue;
        case '}':
          this.advance();
          tokens.push({ type: 'RBRACE', value: '}', raw: '}', start, end: this.getPos() });
          continue;
        case ',':
          this.advance();
          tokens.push({ type: 'COMMA', value: ',', raw: ',', start, end: this.getPos() });
          continue;
        case ';':
          this.advance();
          tokens.push({ type: 'SEMICOLON', value: ';', raw: ';', start, end: this.getPos() });
          continue;
      }

      // 7. Unquoted identifiers and keywords
      if (this.isIdentifierStart(ch)) {
        tokens.push(this.scanIdentifier());
        continue;
      }

      // Unknown character error
      throw new DaxError('Syntax', `Caractere inesperado: "${ch}"`, {
        location: { line: start.line, column: start.column },
        snippet: ch,
      });
    }

    return tokens;
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isIdentifierStart(ch: string): boolean {
    return (
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      ch === '_' ||
      (ch >= '\u00C0' && ch <= '\u024F')
    );
  }

  private isIdentifierPart(ch: string): boolean {
    return (
      this.isIdentifierStart(ch) ||
      this.isDigit(ch) ||
      ch === '.' // allow dotted functions like IF.EAGER, TEXT.UPPER
    );
  }

  private scanBracketedIdentifier(): Token {
    const start = this.getPos();
    this.advance(); // consume [
    let name = '';

    while (this.pos < this.input.length) {
      const ch = this.current();
      if (ch === ']') {
        // Check for escaped ]]
        if (this.peek() === ']') {
          name += ']';
          this.advance();
          this.advance();
          continue;
        }
        this.advance(); // consume closing ]
        return {
          type: 'COLUMN_REF',
          value: name.trim(),
          raw: `[${name}]`,
          start,
          end: this.getPos(),
        };
      }
      name += ch;
      this.advance();
    }

    throw new DaxError('Syntax', 'Referência entre colchetes "[" não foi fechada com "]"', {
      location: { line: start.line, column: start.column },
      snippet: `[${name}`,
    });
  }

  private scanSingleQuotedToken(): Token {
    const start = this.getPos();
    this.advance(); // consume '
    let content = '';

    while (this.pos < this.input.length) {
      const ch = this.current();
      if (ch === "'") {
        // Escaped '' inside
        if (this.peek() === "'") {
          content += "'";
          this.advance();
          this.advance();
          continue;
        }
        this.advance(); // consume closing '
        break;
      }
      content += ch;
      this.advance();
    }

    // Look ahead to check if immediately followed by [Column] (e.g. 'Table'[Column])
    const afterPos = this.pos;
    let lookAhead = afterPos;
    while (lookAhead < this.input.length && (this.input[lookAhead] === ' ' || this.input[lookAhead] === '\t')) {
      lookAhead++;
    }

    const isFollowedByBracket = lookAhead < this.input.length && this.input[lookAhead] === '[';

    // In DAX, 'Table' is always a TABLE_REF.
    // In column dialect, if not followed by [, it can also be treated as a STRING literal if user used single quotes for text
    const isColumnDialectString = this.dialect === 'column' && !isFollowedByBracket;

    return {
      type: isColumnDialectString ? 'STRING' : 'TABLE_REF',
      value: content,
      raw: `'${content}'`,
      start,
      end: this.getPos(),
    };
  }

  private scanDoubleQuotedString(): Token {
    const start = this.getPos();
    this.advance(); // consume "
    let content = '';

    while (this.pos < this.input.length) {
      const ch = this.current();
      if (ch === '"') {
        // Escaped ""
        if (this.peek() === '"') {
          content += '"';
          this.advance();
          this.advance();
          continue;
        }
        this.advance(); // consume closing "
        return {
          type: 'STRING',
          value: content,
          raw: `"${content}"`,
          start,
          end: this.getPos(),
        };
      }
      content += ch;
      this.advance();
    }

    throw new DaxError('Syntax', 'Texto entre aspas duplas """ não foi fechado', {
      location: { line: start.line, column: start.column },
      snippet: `"${content}`,
    });
  }

  private scanNumber(): Token {
    const start = this.getPos();
    let numStr = '';

    while (this.pos < this.input.length && this.isDigit(this.current())) {
      numStr += this.advance();
    }

    // Decimal point
    if (this.current() === '.' && this.isDigit(this.peek())) {
      numStr += this.advance(); // consume .
      while (this.pos < this.input.length && this.isDigit(this.current())) {
        numStr += this.advance();
      }
    }

    // Scientific notation: e+4, e-3, E10
    if ((this.current() === 'e' || this.current() === 'E') &&
        (this.isDigit(this.peek()) || this.peek() === '+' || this.peek() === '-')) {
      numStr += this.advance(); // consume e/E
      if (this.current() === '+' || this.current() === '-') {
        numStr += this.advance();
      }
      while (this.pos < this.input.length && this.isDigit(this.current())) {
        numStr += this.advance();
      }
    }

    // Percentage sign check: e.g. 15%
    let isPercent = false;
    if (this.current() === '%') {
      isPercent = true;
      this.advance(); // consume %
    }

    const numericVal = parseFloat(numStr) * (isPercent ? 0.01 : 1.0);

    return {
      type: 'NUMBER',
      value: String(numericVal),
      raw: numStr + (isPercent ? '%' : ''),
      start,
      end: this.getPos(),
      isPercent,
    };
  }

  private scanIdentifier(): Token {
    const start = this.getPos();
    let id = '';

    while (this.pos < this.input.length && this.isIdentifierPart(this.current())) {
      id += this.advance();
    }

    const upper = id.toUpperCase();

    // Check keywords
    switch (upper) {
      case 'VAR':
        return { type: 'KW_VAR', value: upper, raw: id, start, end: this.getPos() };
      case 'RETURN':
        return { type: 'KW_RETURN', value: upper, raw: id, start, end: this.getPos() };
      case 'NOT':
        return { type: 'KW_NOT', value: upper, raw: id, start, end: this.getPos() };
      case 'IN':
        return { type: 'KW_IN', value: upper, raw: id, start, end: this.getPos() };
      case 'TRUE':
        return { type: 'KW_TRUE', value: 'TRUE', raw: id, start, end: this.getPos() };
      case 'FALSE':
        return { type: 'KW_FALSE', value: 'FALSE', raw: id, start, end: this.getPos() };
      case 'BLANK':
        return { type: 'KW_BLANK', value: 'BLANK', raw: id, start, end: this.getPos() };
    }

    // Column dialect compatibility aliases for literals
    if (this.dialect === 'column') {
      if (upper === 'VERDADEIRO') {
        return { type: 'KW_TRUE', value: 'TRUE', raw: id, start, end: this.getPos() };
      }
      if (upper === 'FALSO') {
        return { type: 'KW_FALSE', value: 'FALSE', raw: id, start, end: this.getPos() };
      }
      if (upper === 'NULO') {
        return { type: 'KW_BLANK', value: 'BLANK', raw: id, start, end: this.getPos() };
      }
    }

    return {
      type: 'IDENTIFIER',
      value: id,
      raw: id,
      start,
      end: this.getPos(),
    };
  }
}

export function tokenize(input: string, options?: LexerOptions): Token[] {
  return new Lexer(input, options).tokenize();
}
