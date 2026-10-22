export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'IDENTIFIER'        // unbracketed identifier or keyword
  | 'COLUMN_REF'        // [Column Name]
  | 'TABLE_REF'         // 'Table Name'
  | 'OP_ADD'            // +
  | 'OP_SUB'            // -
  | 'OP_MUL'            // *
  | 'OP_DIV'            // /
  | 'OP_MOD'            // %
  | 'OP_POW'            // ^
  | 'OP_CONCAT'         // &
  | 'OP_EQ'             // =
  | 'OP_EXACT_EQ'       // ==
  | 'OP_NEQ'            // <>
  | 'OP_LT'             // <
  | 'OP_LTE'            // <=
  | 'OP_GT'             // >
  | 'OP_GTE'            // >=
  | 'OP_AND'            // &&
  | 'OP_OR'             // ||
  | 'KW_NOT'            // NOT
  | 'KW_IN'             // IN
  | 'KW_VAR'            // VAR
  | 'KW_RETURN'         // RETURN
  | 'KW_TRUE'           // TRUE
  | 'KW_FALSE'          // FALSE
  | 'KW_BLANK'          // BLANK
  | 'LPAREN'            // (
  | 'RPAREN'            // )
  | 'LBRACE'            // {
  | 'RBRACE'            // }
  | 'COMMA'             // ,
  | 'SEMICOLON'         // ;
  | 'EOF';

export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

export interface Token {
  type: TokenType;
  value: string;
  raw: string;
  start: SourcePosition;
  end: SourcePosition;
  isPercent?: boolean;
}
