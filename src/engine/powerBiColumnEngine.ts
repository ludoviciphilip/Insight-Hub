import { Column } from '../types/bi';
import { parseDate as parseDateShared } from './shared/valueParser';

export interface FunctionDoc {
  name: string;
  category: 'Texto' | 'Matemática' | 'Data' | 'Lógica / Condicional' | 'Linha';
  syntax: string;
  description: string;
  example: string;
}

export const POWER_BI_FUNCTIONS: FunctionDoc[] = [
  // Texto
  {
    name: 'CONCAT',
    category: 'Texto',
    syntax: 'CONCAT([Coluna1], " - ", [Coluna2]) ou [Coluna1] & " " & [Coluna2]',
    description: 'Concatena dois ou mais textos ou valores de colunas.',
    example: 'CONCAT([Cidade], " - ", [Estado])',
  },
  {
    name: 'UPPER',
    category: 'Texto',
    syntax: 'UPPER([Coluna]) ou TEXT.UPPER([Coluna])',
    description: 'Converte todo o texto para letras maiúsculas.',
    example: 'UPPER([Cliente])',
  },
  {
    name: 'LOWER',
    category: 'Texto',
    syntax: 'LOWER([Coluna]) ou TEXT.LOWER([Coluna])',
    description: 'Converte todo o texto para letras minúsculas.',
    example: 'LOWER([Email])',
  },
  {
    name: 'PROPER',
    category: 'Texto',
    syntax: 'PROPER([Coluna]) ou CAPITALIZE([Coluna])',
    description: 'Converte a primeira letra de cada palavra em maiúscula.',
    example: 'PROPER([NomeCompleto])',
  },
  {
    name: 'TRIM',
    category: 'Texto',
    syntax: 'TRIM([Coluna])',
    description: 'Remove espaços em branco no início e no fim do texto.',
    example: 'TRIM([Descricao])',
  },
  {
    name: 'LEN',
    category: 'Texto',
    syntax: 'LEN([Coluna]) ou TEXT.LENGTH([Coluna])',
    description: 'Retorna a quantidade de caracteres do texto.',
    example: 'LEN([Codigo])',
  },
  {
    name: 'LEFT',
    category: 'Texto',
    syntax: 'LEFT([Coluna], quantidade)',
    description: 'Retorna os primeiros N caracteres à esquerda.',
    example: 'LEFT([ID_Cliente], 3)',
  },
  {
    name: 'RIGHT',
    category: 'Texto',
    syntax: 'RIGHT([Coluna], quantidade)',
    description: 'Retorna os últimos N caracteres à direita.',
    example: 'RIGHT([Telefone], 4)',
  },
  {
    name: 'MID',
    category: 'Texto',
    syntax: 'MID([Coluna], inicio, tamanho)',
    description: 'Retorna um trecho do texto a partir da posição inicial (base 1).',
    example: 'MID([NotaFiscal], 3, 5)',
  },
  {
    name: 'SUBSTITUTE',
    category: 'Texto',
    syntax: 'SUBSTITUTE([Coluna], "antigo", "novo") ou REPLACE(...)',
    description: 'Substitui ocorrências de um termo por outro.',
    example: 'SUBSTITUTE([Status], "Aguardando", "Pendente")',
  },
  {
    name: 'CONTAINS',
    category: 'Texto',
    syntax: 'CONTAINS([Coluna], "termo")',
    description: 'Verifica se o texto contém o termo especificado (retorna VERDADEIRO/FALSO).',
    example: 'CONTAINS([Descricao], "Premium")',
  },

  // Matemática
  {
    name: 'DIVIDE',
    category: 'Matemática',
    syntax: 'DIVIDE([Numerador], [Denominador], [Alternativa])',
    description: 'Divisão segura com tratamento automático de divisão por zero.',
    example: 'DIVIDE([Lucro], [ValorTotal], 0)',
  },
  {
    name: 'ROUND',
    category: 'Matemática',
    syntax: 'ROUND([Coluna], casas_decimais)',
    description: 'Arredonda um número para o número de casas decimais especificado.',
    example: 'ROUND([ValorTotal] * 1.15, 2)',
  },
  {
    name: 'ABS',
    category: 'Matemática',
    syntax: 'ABS([Coluna])',
    description: 'Retorna o valor absoluto (sem sinal negativo).',
    example: 'ABS([Desvio])',
  },
  {
    name: 'INT',
    category: 'Matemática',
    syntax: 'INT([Coluna]) ou FLOOR([Coluna])',
    description: 'Retorna a parte inteira do número.',
    example: 'INT([Quantidade])',
  },
  {
    name: 'POWER',
    category: 'Matemática',
    syntax: 'POWER([Coluna], expoente)',
    description: 'Eleva a base à potência do expoente.',
    example: 'POWER([Fator], 2)',
  },
  {
    name: 'SQRT',
    category: 'Matemática',
    syntax: 'SQRT([Coluna])',
    description: 'Calcula a raiz quadrada de um número.',
    example: 'SQRT([Variancia])',
  },
  {
    name: 'MOD',
    category: 'Matemática',
    syntax: 'MOD([Coluna], divisor)',
    description: 'Retorna o resto da divisão inteira.',
    example: 'MOD([ID], 2)',
  },

  // Data
  {
    name: 'YEAR',
    category: 'Data',
    syntax: 'YEAR([Data])',
    description: 'Extrai o ano da data (ex.: 2025).',
    example: 'YEAR([Data])',
  },
  {
    name: 'MONTH',
    category: 'Data',
    syntax: 'MONTH([Data])',
    description: 'Extrai o mês da data como número (1 a 12).',
    example: 'MONTH([Data])',
  },
  {
    name: 'DAY',
    category: 'Data',
    syntax: 'DAY([Data])',
    description: 'Extrai o dia do mês (1 a 31).',
    example: 'DAY([Data])',
  },
  {
    name: 'TODAY',
    category: 'Data',
    syntax: 'TODAY() ou HOJE()',
    description: 'Retorna a data atual no formato YYYY-MM-DD.',
    example: 'TODAY()',
  },
  {
    name: 'DATEDIFF',
    category: 'Data',
    syntax: 'DATEDIFF([DataInicial], [DataFinal], "day" | "month" | "year")',
    description: 'Calcula a diferença entre duas datas na unidade escolhida.',
    example: 'DATEDIFF([DataVenda], TODAY(), "day")',
  },
  {
    name: 'FORMAT',
    category: 'Data',
    syntax: 'FORMAT([Data], "YYYY-MM" | "DD/MM/YYYY")',
    description: 'Formata a data no padrão textual especificado.',
    example: 'FORMAT([Data], "YYYY-MM")',
  },

  // Lógica e Condicional
  {
    name: 'IF',
    category: 'Lógica / Condicional',
    syntax: 'IF(condição, valor_se_verdadeiro, valor_se_falso)',
    description: 'Estrutura condicional idêntica ao IF do DAX e do Power Query.',
    example: 'IF([ValorTotal] >= 1000, "Venda Alta", "Venda Regular")',
  },
  {
    name: 'IFS',
    category: 'Lógica / Condicional',
    syntax: 'IFS(cond1, val1, cond2, val2, valor_padrao)',
    description: 'Avalia múltiplas condições em cascata até encontrar uma verdadeira.',
    example: 'IFS([MargemPercentual] >= 30, "Excelente", [MargemPercentual] >= 15, "Boa", "Baixa")',
  },
  {
    name: 'SWITCH',
    category: 'Lógica / Condicional',
    syntax: 'SWITCH([Coluna], val1, res1, val2, res2, default)',
    description: 'Substitui valores específicos de acordo com correspondência exata.',
    example: 'SWITCH([Canal], "Online", "Digital", "Loja", "Presencial", "Outro")',
  },
  {
    name: 'COALESCE',
    category: 'Lógica / Condicional',
    syntax: 'COALESCE([Coluna1], [Coluna2], "Padrão")',
    description: 'Retorna o primeiro valor não nulo ou não vazio.',
    example: 'COALESCE([Cidade], [Estado], "Não Informado")',
  },
  {
    name: 'ISBLANK',
    category: 'Lógica / Condicional',
    syntax: 'ISBLANK([Coluna]) ou ISNULL([Coluna])',
    description: 'Retorna VERDADEIRO se o campo estiver vazio ou nulo.',
    example: 'IF(ISBLANK([Desconto]), 0, [Desconto])',
  },

  // Linha
  {
    name: 'INDEX',
    category: 'Linha',
    syntax: 'INDEX() ou LINHA()',
    description: 'Gera um número de linha sequencial iniciando em 1.',
    example: 'INDEX()',
  },
];

/**
 * Parses arguments inside a function call like `arg1, arg2, func(a, b), "arg, with comma"`
 */
function splitTopLevelArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inString: false | "'" | '"' = false;
  let current = '';

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];

    if ((char === '"' || char === "'") && (i === 0 || argsStr[i - 1] !== '\\')) {
      if (!inString) {
        inString = char;
      } else if (inString === char) {
        inString = false;
      }
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

  if (current.trim().length > 0 || args.length > 0) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Power BI & Power Query Custom Column Expression Evaluator
 */
export class PowerBiColumnEngine {
  /**
   * Evaluates an expression on a specific row
   */
  public static evaluateRow(
    expression: string,
    row: Record<string, any>,
    rowIndex: number,
    columns: Column[]
  ): any {
    let trimmed = (expression || '').trim();
    if (!trimmed) return null;

    // Strip leading = or fx = if present (e.g. "=[Valor] * 2" or "= [Valor] * -1")
    if (trimmed.startsWith('=')) {
      trimmed = trimmed.slice(1).trim();
    } else if (trimmed.toLowerCase().startsWith('fx=')) {
      trimmed = trimmed.slice(3).trim();
    }
    if (!trimmed) return null;

    try {
      return this.evalSubExpr(trimmed, row, rowIndex, columns);
    } catch {
      return null;
    }
  }

  /**
   * Internal recursive evaluator
   */
  private static evalSubExpr(
    expr: string,
    row: Record<string, any>,
    rowIndex: number,
    columns: Column[]
  ): any {
    let s = expr.trim();
    if (!s) return null;

    // Strip leading = if present in sub-expression
    if (s.startsWith('=')) {
      s = s.slice(1).trim();
    }
    if (!s) return null;

    // Remove enclosing parentheses if they enclose the whole expression
    if (s.startsWith('(') && s.endsWith(')')) {
      let depth = 0;
      let matched = true;
      for (let i = 0; i < s.length - 1; i++) {
        if (s[i] === '(') depth++;
        else if (s[i] === ')') depth--;
        if (depth === 0) {
          matched = false;
          break;
        }
      }
      if (matched) {
        return this.evalSubExpr(s.slice(1, -1), row, rowIndex, columns);
      }
    }

    // 1. String literal: "texto" or 'texto'
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }

    // 2. Boolean & Null literals
    if (s.toUpperCase() === 'TRUE' || s.toUpperCase() === 'VERDADEIRO') return true;
    if (s.toUpperCase() === 'FALSE' || s.toUpperCase() === 'FALSO') return false;
    if (s.toUpperCase() === 'NULL' || s.toUpperCase() === 'NULO') return null;

    // 3. INDEX() or LINHA()
    if (/^(INDEX|INDICE|ROW_NUMBER|LINHA)\s*\(\s*\)$/i.test(s)) {
      return rowIndex + 1;
    }

    // 4. TODAY() / NOW()
    if (/^(TODAY|HOJE|DATETIME\.LOCALNOW)\s*\(\s*\)$/i.test(s)) {
      return new Date().toISOString().slice(0, 10);
    }
    if (/^(NOW|AGORA)\s*\(\s*\)$/i.test(s)) {
      return new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    // 5. IF(cond, trueVal, falseVal)
    const ifMatch = s.match(/^IF\s*\((.*)\)$/is);
    if (ifMatch) {
      const args = splitTopLevelArgs(ifMatch[1]);
      if (args.length >= 2) {
        const cond = this.evalSubExpr(args[0], row, rowIndex, columns);
        if (cond) {
          return this.evalSubExpr(args[1], row, rowIndex, columns);
        } else {
          return args[2] !== undefined ? this.evalSubExpr(args[2], row, rowIndex, columns) : null;
        }
      }
    }

    // 6. IFS(cond1, val1, cond2, val2, [defaultVal])
    const ifsMatch = s.match(/^IFS\s*\((.*)\)$/is);
    if (ifsMatch) {
      const args = splitTopLevelArgs(ifsMatch[1]);
      for (let i = 0; i < args.length; i += 2) {
        if (i === args.length - 1) {
          // default fallback value
          return this.evalSubExpr(args[i], row, rowIndex, columns);
        }
        const cond = this.evalSubExpr(args[i], row, rowIndex, columns);
        if (cond) {
          return this.evalSubExpr(args[i + 1], row, rowIndex, columns);
        }
      }
      return null;
    }

    // 7. SWITCH(expr, val1, res1, val2, res2, ..., default)
    const switchMatch = s.match(/^SWITCH\s*\((.*)\)$/is);
    if (switchMatch) {
      const args = splitTopLevelArgs(switchMatch[1]);
      if (args.length >= 3) {
        const targetVal = this.evalSubExpr(args[0], row, rowIndex, columns);
        for (let i = 1; i < args.length; i += 2) {
          if (i === args.length - 1) {
            // default
            return this.evalSubExpr(args[i], row, rowIndex, columns);
          }
          const caseVal = this.evalSubExpr(args[i], row, rowIndex, columns);
          if (String(caseVal).toLowerCase() === String(targetVal).toLowerCase()) {
            return this.evalSubExpr(args[i + 1], row, rowIndex, columns);
          }
        }
      }
      return null;
    }

    // 8. Functions with arguments: FUNC(arg1, arg2...)
    const funcMatch = s.match(/^([a-zA-Z0-9_\.]+)\s*\((.*)\)$/is);
    if (funcMatch) {
      const funcName = funcMatch[1].toUpperCase();
      const rawArgs = splitTopLevelArgs(funcMatch[2]);
      const res = this.evalFunction(funcName, rawArgs, row, rowIndex, columns);
      if (res !== undefined) return res;
    }

    // 9. Concatenation using '&' operator: [Col1] & " - " & [Col2]
    const concatParts = this.splitByOperator(s, '&');
    if (concatParts.length > 1) {
      return concatParts
        .map(part => {
          const v = this.evalSubExpr(part, row, rowIndex, columns);
          return v === null || v === undefined ? '' : String(v);
        })
        .join('');
    }

    // 10. Logical Comparison operators: >=, <=, !=, <>, ==, =, >, <
    const compMatch = this.findComparison(s);
    if (compMatch) {
      const left = this.evalSubExpr(compMatch.left, row, rowIndex, columns);
      const right = this.evalSubExpr(compMatch.right, row, rowIndex, columns);
      const op = compMatch.op;

      const numLeft = Number(left);
      const numRight = Number(right);
      const bothNumbers = !isNaN(numLeft) && !isNaN(numRight) && left !== '' && right !== '' && left !== null && right !== null;

      if (op === '=' || op === '==') {
        if (bothNumbers) return numLeft === numRight;
        return String(left ?? '').toLowerCase() === String(right ?? '').toLowerCase();
      }
      if (op === '!=' || op === '<>') {
        if (bothNumbers) return numLeft !== numRight;
        return String(left ?? '').toLowerCase() !== String(right ?? '').toLowerCase();
      }
      if (op === '>=') return bothNumbers ? numLeft >= numRight : String(left) >= String(right);
      if (op === '<=') return bothNumbers ? numLeft <= numRight : String(left) <= String(right);
      if (op === '>') return bothNumbers ? numLeft > numRight : String(left) > String(right);
      if (op === '<') return bothNumbers ? numLeft < numRight : String(left) < String(right);
    }

    // 11. Additive operators: +, -
    const addSubParts = this.splitArithmetic(s, ['+', '-']);
    if (addSubParts && addSubParts.length > 1) {
      let acc = Number(this.evalSubExpr(addSubParts[0].expr, row, rowIndex, columns)) || 0;
      for (let i = 1; i < addSubParts.length; i++) {
        const val = Number(this.evalSubExpr(addSubParts[i].expr, row, rowIndex, columns)) || 0;
        if (addSubParts[i].op === '+') acc += val;
        else if (addSubParts[i].op === '-') acc -= val;
      }
      return Number(acc.toFixed(4));
    }

    // 12. Multiplicative operators: *, /, %
    const mulDivParts = this.splitArithmetic(s, ['*', '/', '%']);
    if (mulDivParts && mulDivParts.length > 1) {
      let acc = Number(this.evalSubExpr(mulDivParts[0].expr, row, rowIndex, columns)) || 0;
      for (let i = 1; i < mulDivParts.length; i++) {
        const val = Number(this.evalSubExpr(mulDivParts[i].expr, row, rowIndex, columns)) || 0;
        const op = mulDivParts[i].op;
        if (op === '*') acc *= val;
        else if (op === '/') acc = val !== 0 ? acc / val : 0;
        else if (op === '%') acc = val !== 0 ? acc % val : 0;
      }
      return Number(acc.toFixed(4));
    }

    // 12.5 Unary negation or positive: -[Coluna], -(...), -5, +[Coluna]
    if (s.startsWith('-')) {
      const rest = s.slice(1).trim();
      const val = this.evalSubExpr(rest, row, rowIndex, columns);
      const num = Number(val);
      return !isNaN(num) ? -num : null;
    }
    if (s.startsWith('+')) {
      const rest = s.slice(1).trim();
      return this.evalSubExpr(rest, row, rowIndex, columns);
    }

    // 13. Column reference: [Nome_Coluna] or [Coluna com espacos]
    if (s.startsWith('[') && s.endsWith(']')) {
      const colName = s.slice(1, -1);
      return this.lookupColumnValue(colName, row);
    }

    // 14. Bare column name lookup
    const directColVal = this.lookupColumnValue(s, row);
    if (directColVal !== undefined) return directColVal;

    // 15. Pure number literal
    if (!isNaN(Number(s))) {
      return Number(s);
    }

    return s;
  }

  /**
   * Evaluate built-in functions
   */
  private static evalFunction(
    name: string,
    rawArgs: string[],
    row: Record<string, any>,
    rowIndex: number,
    columns: Column[]
  ): any {
    const evalArg = (idx: number) =>
      rawArgs[idx] !== undefined ? this.evalSubExpr(rawArgs[idx], row, rowIndex, columns) : undefined;

    switch (name) {
      // TEXT FUNCTIONS
      case 'UPPER':
      case 'TEXT.UPPER':
        return String(evalArg(0) ?? '').toUpperCase();

      case 'LOWER':
      case 'TEXT.LOWER':
        return String(evalArg(0) ?? '').toLowerCase();

      case 'PROPER':
      case 'CAPITALIZE':
        return String(evalArg(0) ?? '').replace(
          /\b\w+/g,
          txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
        );

      case 'TRIM':
      case 'TEXT.TRIM':
        return String(evalArg(0) ?? '').trim();

      case 'LEN':
      case 'LENGTH':
      case 'TEXT.LENGTH':
        return String(evalArg(0) ?? '').length;

      case 'LEFT':
      case 'TEXT.START': {
        const str = String(evalArg(0) ?? '');
        const count = Number(evalArg(1)) || 1;
        return str.slice(0, count);
      }

      case 'RIGHT':
      case 'TEXT.END': {
        const str = String(evalArg(0) ?? '');
        const count = Number(evalArg(1)) || 1;
        return str.slice(Math.max(0, str.length - count));
      }

      case 'MID':
      case 'SUBSTRING':
      case 'TEXT.MIDDLE': {
        const str = String(evalArg(0) ?? '');
        const start = Math.max(0, (Number(evalArg(1)) || 1) - 1);
        const len = Number(evalArg(2));
        return len !== undefined && !isNaN(len) ? str.substring(start, start + len) : str.substring(start);
      }

      case 'CONCAT':
      case 'CONCATENATE':
      case 'TEXT.COMBINE':
        return rawArgs.map((_, i) => String(evalArg(i) ?? '')).join('');

      case 'SUBSTITUTE':
      case 'REPLACE':
      case 'TEXT.REPLACE': {
        const str = String(evalArg(0) ?? '');
        const oldVal = String(evalArg(1) ?? '');
        const newVal = String(evalArg(2) ?? '');
        if (!oldVal) return str;
        return str.split(oldVal).join(newVal);
      }

      case 'CONTAINS':
      case 'TEXT.CONTAINS': {
        const str = String(evalArg(0) ?? '').toLowerCase();
        const sub = String(evalArg(1) ?? '').toLowerCase();
        return str.includes(sub);
      }

      case 'STARTSWITH':
      case 'TEXT.STARTSWITH': {
        const str = String(evalArg(0) ?? '').toLowerCase();
        const prefix = String(evalArg(1) ?? '').toLowerCase();
        return str.startsWith(prefix);
      }

      case 'ENDSWITH':
      case 'TEXT.ENDSWITH': {
        const str = String(evalArg(0) ?? '').toLowerCase();
        const suffix = String(evalArg(1) ?? '').toLowerCase();
        return str.endsWith(suffix);
      }

      // MATH FUNCTIONS
      case 'ROUND':
      case 'NUMBER.ROUND': {
        const num = Number(evalArg(0)) || 0;
        const dec = Number(evalArg(1)) || 0;
        const factor = Math.pow(10, dec);
        return Math.round(num * factor) / factor;
      }

      case 'ABS':
      case 'NUMBER.ABS':
        return Math.abs(Number(evalArg(0)) || 0);

      case 'INT':
      case 'FLOOR':
        return Math.floor(Number(evalArg(0)) || 0);

      case 'CEILING':
      case 'CEIL':
        return Math.ceil(Number(evalArg(0)) || 0);

      case 'DIVIDE': {
        const num = Number(evalArg(0)) || 0;
        const den = Number(evalArg(1)) || 0;
        const alt = evalArg(2) !== undefined ? Number(evalArg(2)) : 0;
        return den !== 0 ? num / den : alt;
      }

      case 'MOD':
      case 'NUMBER.MOD': {
        const n = Number(evalArg(0)) || 0;
        const d = Number(evalArg(1)) || 1;
        return d !== 0 ? n % d : 0;
      }

      case 'POWER':
      case 'NUMBER.POWER': {
        const base = Number(evalArg(0)) || 0;
        const exp = Number(evalArg(1)) || 1;
        return Math.pow(base, exp);
      }

      case 'SQRT':
      case 'NUMBER.SQRT': {
        const n = Number(evalArg(0)) || 0;
        return n >= 0 ? Math.sqrt(n) : 0;
      }

      case 'MAX':
        return Math.max(...rawArgs.map((_, i) => Number(evalArg(i)) || 0));

      case 'MIN':
        return Math.min(...rawArgs.map((_, i) => Number(evalArg(i)) || 0));

      // DATE FUNCTIONS
      case 'YEAR':
      case 'DATE.YEAR': {
        const d = this.parseDate(evalArg(0));
        return d ? d.getUTCFullYear() : null;
      }

      case 'MONTH':
      case 'DATE.MONTH': {
        const d = this.parseDate(evalArg(0));
        return d ? d.getUTCMonth() + 1 : null;
      }

      case 'DAY':
      case 'DATE.DAY': {
        const d = this.parseDate(evalArg(0));
        return d ? d.getUTCDate() : null;
      }

      case 'DATEDIFF': {
        const d1 = this.parseDate(evalArg(0));
        const d2 = this.parseDate(evalArg(1));
        const unit = String(evalArg(2) ?? 'day').toLowerCase();
        if (!d1 || !d2) return 0;
        const diffMs = d2.getTime() - d1.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (unit === 'year' || unit === 'ano') return d2.getUTCFullYear() - d1.getUTCFullYear();
        if (unit === 'month' || unit === 'mes') {
          return (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + (d2.getUTCMonth() - d1.getUTCMonth());
        }
        return diffDays;
      }

      case 'DATE': {
        const y = Number(evalArg(0)) || 2025;
        const m = Number(evalArg(1)) || 1;
        const day = Number(evalArg(2)) || 1;
        const mm = String(m).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${y}-${mm}-${dd}`;
      }

      case 'FORMAT': {
        const val = evalArg(0);
        const fmt = String(evalArg(1) ?? 'YYYY-MM');
        const d = this.parseDate(val);
        if (d) {
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, '0');
          const day = String(d.getUTCDate()).padStart(2, '0');
          if (fmt.toUpperCase().includes('DD/MM/YYYY')) return `${day}/${m}/${y}`;
          if (fmt.toUpperCase().includes('YYYY-MM')) return `${y}-${m}`;
          return `${y}-${m}-${day}`;
        }
        return String(val ?? '');
      }

      // LOGICAL & CONDITIONAL
      case 'COALESCE': {
        for (let i = 0; i < rawArgs.length; i++) {
          const v = evalArg(i);
          if (v !== null && v !== undefined && v !== '') return v;
        }
        return null;
      }

      case 'ISBLANK':
      case 'ISNULL':
      case 'ISEMPTY': {
        const v = evalArg(0);
        return v === null || v === undefined || v === '';
      }

      case 'AND': {
        return rawArgs.every((_, i) => Boolean(evalArg(i)));
      }

      case 'OR': {
        return rawArgs.some((_, i) => Boolean(evalArg(i)));
      }

      case 'NOT':
        return !Boolean(evalArg(0));

      default:
        return undefined;
    }
  }

  /**
   * Robust Date parser supporting Excel serials, ISO, BR formats
   */
  private static parseDate(val: any): Date | null {
    return parseDateShared(val).date;
  }

  /**
   * Look up a column value from row safely
   */
  private static lookupColumnValue(colName: string, row: Record<string, any>): any {
    if (!row) return undefined;
    if (colName in row) return row[colName];

    // Case-insensitive fallback
    const lower = colName.toLowerCase().trim();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().trim() === lower) {
        return row[key];
      }
    }
    return undefined;
  }

  /**
   * Split expression by top-level operator (ignoring strings and parentheses)
   */
  private static splitByOperator(str: string, targetOp: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let inString: false | "'" | '"' = false;
    let current = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
        if (!inString) inString = char;
        else if (inString === char) inString = false;
      }

      if (!inString) {
        if (char === '(' || char === '[' || char === '{') depth++;
        else if (char === ')' || char === ']' || char === '}') depth--;
        else if (char === targetOp && depth === 0) {
          parts.push(current.trim());
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim().length > 0) parts.push(current.trim());
    return parts;
  }

  /**
   * Find top-level comparison operator: >=, <=, !=, <>, ==, =, >, <
   */
  private static findComparison(
    str: string
  ): { left: string; op: string; right: string } | null {
    let depth = 0;
    let inString: false | "'" | '"' = false;

    // Check two-char operators first, then one-char
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
        if (!inString) inString = char;
        else if (inString === char) inString = false;
      }

      if (!inString) {
        if (char === '(' || char === '[' || char === '{') depth++;
        else if (char === ')' || char === ']' || char === '}') depth--;
        else if (depth === 0) {
          const twoChar = str.slice(i, i + 2);
          if (['>=', '<=', '!=', '<>', '=='].includes(twoChar)) {
            const leftStr = str.slice(0, i).trim();
            if (leftStr.length > 0) {
              return {
                left: leftStr,
                op: twoChar,
                right: str.slice(i + 2).trim(),
              };
            }
          }
          if (['>', '<', '='].includes(char)) {
            const leftStr = str.slice(0, i).trim();
            if (leftStr.length > 0) {
              return {
                left: leftStr,
                op: char,
                right: str.slice(i + 1).trim(),
              };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Split arithmetic expression respecting operator precedence
   */
  private static splitArithmetic(
    str: string,
    ops: string[]
  ): { op: string; expr: string }[] | null {
    let depth = 0;
    let inString: false | "'" | '"' = false;
    const tokens: { op: string; expr: string }[] = [];
    let lastIndex = 0;
    let currentOp = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
        if (!inString) inString = char;
        else if (inString === char) inString = false;
      }

      if (!inString) {
        if (char === '(' || char === '[' || char === '{') depth++;
        else if (char === ')' || char === ']' || char === '}') depth--;
        else if (depth === 0 && ops.includes(char)) {
          // Check if char is unary sign (+ or -) or binary operator.
          // It is unary if it is '+' or '-' AND either:
          // 1. It is at the beginning (i === 0 or only whitespace before it)
          // 2. The previous non-whitespace character is an operator or punctuation:
          //    +, -, *, /, %, ^, &, =, !, <, >, (, [, {, ,, :, ?
          let isUnary = false;
          if (char === '+' || char === '-') {
            let prevNonSpace = '';
            for (let j = i - 1; j >= 0; j--) {
              if (str[j] !== ' ' && str[j] !== '\t') {
                prevNonSpace = str[j];
                break;
              }
            }
            if (
              !prevNonSpace ||
              ['+', '-', '*', '/', '%', '^', '&', '=', '!', '<', '>', '(', '[', '{', ',', ':', '?'].includes(prevNonSpace)
            ) {
              isUnary = true;
            }
          }

          if (!isUnary) {
            tokens.push({
              op: currentOp,
              expr: str.slice(lastIndex, i).trim(),
            });
            currentOp = char;
            lastIndex = i + 1;
          }
        }
      }
    }

    if (tokens.length > 0) {
      tokens.push({
        op: currentOp,
        expr: str.slice(lastIndex).trim(),
      });
      return tokens;
    }

    return null;
  }
}
