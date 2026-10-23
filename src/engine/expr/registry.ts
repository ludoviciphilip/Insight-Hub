import { DaxError } from '../shared/errors';
import {
  daxToBoolean,
  daxToNumber,
  daxToString,
  isBlank,
  isBlankOrEmpty,
  daxEqual,
  DAX_BLANK,
} from './types';
import { parseDate } from '../shared/valueParser';
import { ALL_SCALAR_FUNCTIONS } from '../functions';

function toDate(val: any): Date | null {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  const res = parseDate(val);
  return res?.date || null;
}

export type FunctionCategory =
  | 'Lógica / Condicional'
  | 'Informação'
  | 'Texto'
  | 'Matemática'
  | 'Data'
  | 'Linha'
  | 'Agregação'
  | 'Filtro'
  | 'Tabela';

export interface FunctionDefinition {
  name: string;
  aliases?: string[];
  category: FunctionCategory;
  syntax: string;
  description: string;
  example: string;
  minArgs: number;
  maxArgs: number; // -1 for variadic
  isLazy?: boolean;
  evaluate?: (args: any[], context?: any) => any;
}

export interface FunctionDoc {
  name: string;
  category: 'Texto' | 'Matemática' | 'Data' | 'Lógica / Condicional' | 'Linha' | 'Agregação' | 'Filtro' | 'Tabela';
  syntax: string;
  description: string;
  example: string;
}

export const FUNCTION_REGISTRY: Record<string, FunctionDefinition> = {
  // ==========================================
  // Logical Functions
  // ==========================================
  AND: {
    name: 'AND',
    category: 'Lógica / Condicional',
    syntax: 'AND(logical1, logical2)',
    description: 'Verifica se ambos os argumentos são verdadeiros. Retorna TRUE se ambos forem verdadeiros, senão FALSE.',
    example: 'AND([Vendas] > 1000, [Margem] > 0.2)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([a, b]) => daxToBoolean(a) && daxToBoolean(b),
  },

  OR: {
    name: 'OR',
    category: 'Lógica / Condicional',
    syntax: 'OR(logical1, logical2)',
    description: 'Verifica se ao menos um argumento é verdadeiro. Retorna TRUE se pelo menos um for verdadeiro.',
    example: 'OR([Regiao] = "Sul", [Regiao] = "Sudeste")',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([a, b]) => daxToBoolean(a) || daxToBoolean(b),
  },

  NOT: {
    name: 'NOT',
    category: 'Lógica / Condicional',
    syntax: 'NOT(logical)',
    description: 'Inverte o valor lógico de FALSE para TRUE ou de TRUE para FALSE.',
    example: 'NOT(ISBLANK([Cliente]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => !daxToBoolean(a),
  },

  TRUE: {
    name: 'TRUE',
    aliases: ['VERDADEIRO'],
    category: 'Lógica / Condicional',
    syntax: 'TRUE()',
    description: 'Retorna a constante booleana TRUE.',
    example: 'TRUE()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: () => true,
  },

  FALSE: {
    name: 'FALSE',
    aliases: ['FALSO'],
    category: 'Lógica / Condicional',
    syntax: 'FALSE()',
    description: 'Retorna a constante booleana FALSE.',
    example: 'FALSE()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: () => false,
  },

  BLANK: {
    name: 'BLANK',
    aliases: ['NULO'],
    category: 'Lógica / Condicional',
    syntax: 'BLANK()',
    description: 'Retorna um valor em branco (BLANK / nulo) equivalente a uma célula não preenchida.',
    example: 'IF([Valor] <= 0, BLANK(), [Valor])',
    minArgs: 0,
    maxArgs: 0,
    evaluate: () => DAX_BLANK,
  },

  ERROR: {
    name: 'ERROR',
    category: 'Lógica / Condicional',
    syntax: 'ERROR(text)',
    description: 'Gera um erro de execução DAX explícito interrompendo a avaliação ou sendo capturado por IFERROR.',
    example: 'ERROR("Valor inesperado")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([msg]) => {
      throw new DaxError('Execution', daxToString(msg) || 'Erro acionado via função ERROR()');
    },
  },

  IF: {
    name: 'IF',
    category: 'Lógica / Condicional',
    syntax: 'IF(logical_test, value_if_true, [value_if_false])',
    description: 'Verifica uma condição e retorna um valor se for TRUE e outro se for FALSE. Possui avaliação preguiçosa (short-circuit).',
    example: 'IF([Valor] >= 1000, "Alto", "Normal")',
    minArgs: 2,
    maxArgs: 3,
    isLazy: true,
  },

  'IF.EAGER': {
    name: 'IF.EAGER',
    category: 'Lógica / Condicional',
    syntax: 'IF.EAGER(logical_test, value_if_true, [value_if_false])',
    description: 'Versão ansiosa de IF que avalia ambas as ramificações de execução.',
    example: 'IF.EAGER([Valor] >= 1000, [DescontoA], [DescontoB])',
    minArgs: 2,
    maxArgs: 3,
    evaluate: ([test, trueVal, falseVal]) => {
      return daxToBoolean(test) ? trueVal : (falseVal !== undefined ? falseVal : DAX_BLANK);
    },
  },

  IFERROR: {
    name: 'IFERROR',
    category: 'Lógica / Condicional',
    syntax: 'IFERROR(value, value_if_error)',
    description: 'Retorna value_if_error se a expressão resultar em erro, senão retorna o próprio valor.',
    example: 'IFERROR([Valor] / [Meta], 0)',
    minArgs: 2,
    maxArgs: 2,
    isLazy: true,
  },

  SWITCH: {
    name: 'SWITCH',
    category: 'Lógica / Condicional',
    syntax: 'SWITCH(expression, val1, result1, [val2, result2, ...], [else])',
    description: 'Avalia uma expressão contra uma lista de valores e retorna o primeiro resultado coincidente (ex: SWITCH(TRUE(), ...)).',
    example: 'SWITCH([Status], "A", "Ativo", "I", "Inativo", "Outro")',
    minArgs: 3,
    maxArgs: -1,
    isLazy: true,
  },

  COALESCE: {
    name: 'COALESCE',
    category: 'Lógica / Condicional',
    syntax: 'COALESCE(expr1, expr2, ...)',
    description: 'Retorna a primeira expressão que não é BLANK (ou vazia em colunas calculadas).',
    example: 'COALESCE([Telefone], [Celular], "Sem contato")',
    minArgs: 1,
    maxArgs: -1,
    isLazy: true,
  },

  IFS: {
    name: 'IFS',
    category: 'Lógica / Condicional',
    syntax: 'IFS(cond1, val1, cond2, val2, [default])',
    description: 'Avalia múltiplas condições em cascata até encontrar a primeira verdadeira.',
    example: 'IFS([Nota] >= 9, "A", [Nota] >= 7, "B", "C")',
    minArgs: 2,
    maxArgs: -1,
    isLazy: true,
  },

  // Bitwise functions
  BITAND: {
    name: 'BITAND',
    category: 'Lógica / Condicional',
    syntax: 'BITAND(number1, number2)',
    description: 'Retorna o resultado bit a bit AND entre dois inteiros.',
    example: 'BITAND(5, 3)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([a, b]) => Math.trunc(daxToNumber(a, true)) & Math.trunc(daxToNumber(b, true)),
  },

  BITOR: {
    name: 'BITOR',
    category: 'Lógica / Condicional',
    syntax: 'BITOR(number1, number2)',
    description: 'Retorna o resultado bit a bit OR entre dois inteiros.',
    example: 'BITOR(5, 3)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([a, b]) => Math.trunc(daxToNumber(a, true)) | Math.trunc(daxToNumber(b, true)),
  },

  BITXOR: {
    name: 'BITXOR',
    category: 'Lógica / Condicional',
    syntax: 'BITXOR(number1, number2)',
    description: 'Retorna o resultado bit a bit XOR (ou exclusivo) entre dois inteiros.',
    example: 'BITXOR(5, 3)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([a, b]) => Math.trunc(daxToNumber(a, true)) ^ Math.trunc(daxToNumber(b, true)),
  },

  BITLSHIFT: {
    name: 'BITLSHIFT',
    category: 'Lógica / Condicional',
    syntax: 'BITLSHIFT(number, shift_amount)',
    description: 'Desloca os bits do número para a esquerda pela quantidade especificada.',
    example: 'BITLSHIFT(4, 2)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([a, b]) => Math.trunc(daxToNumber(a, true)) << Math.trunc(daxToNumber(b, true)),
  },

  BITRSHIFT: {
    name: 'BITRSHIFT',
    category: 'Lógica / Condicional',
    syntax: 'BITRSHIFT(number, shift_amount)',
    description: 'Desloca os bits do número para a direita pela quantidade especificada.',
    example: 'BITRSHIFT(16, 2)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([a, b]) => Math.trunc(daxToNumber(a, true)) >> Math.trunc(daxToNumber(b, true)),
  },

  // ==========================================
  // Information Functions
  // ==========================================
  ISBLANK: {
    name: 'ISBLANK',
    aliases: ['ISNULL', 'ISEMPTY'],
    category: 'Informação',
    syntax: 'ISBLANK(value)',
    description: 'Retorna TRUE se o valor for BLANK (ou nulo/vazio).',
    example: 'ISBLANK([Comissao])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => isBlank(a) || a === '',
  },

  ISERROR: {
    name: 'ISERROR',
    category: 'Informação',
    syntax: 'ISERROR(value)',
    description: 'Retorna TRUE se a expressão resultar em erro.',
    example: 'ISERROR(1/0)',
    minArgs: 1,
    maxArgs: 1,
    isLazy: true,
  },

  ISNUMBER: {
    name: 'ISNUMBER',
    aliases: ['ISNUMERIC'],
    category: 'Informação',
    syntax: 'ISNUMBER(value)',
    description: 'Retorna TRUE se o valor for um número válido, senão FALSE.',
    example: 'ISNUMBER([Codigo])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => typeof a === 'number' && !isNaN(a),
  },

  ISTEXT: {
    name: 'ISTEXT',
    aliases: ['ISSTRING'],
    category: 'Informação',
    syntax: 'ISTEXT(value)',
    description: 'Retorna TRUE se o valor for um texto/string.',
    example: 'ISTEXT([Descricao])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => typeof a === 'string',
  },

  ISNONTEXT: {
    name: 'ISNONTEXT',
    category: 'Informação',
    syntax: 'ISNONTEXT(value)',
    description: 'Retorna TRUE se o valor NÃO for um texto (por exemplo números, datas ou em branco).',
    example: 'ISNONTEXT([Preco])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => typeof a !== 'string',
  },

  ISLOGICAL: {
    name: 'ISLOGICAL',
    aliases: ['ISBOOLEAN'],
    category: 'Informação',
    syntax: 'ISLOGICAL(value)',
    description: 'Retorna TRUE se o valor for um booleano (TRUE/FALSE).',
    example: 'ISLOGICAL([Ativo])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => typeof a === 'boolean',
  },

  ISEVEN: {
    name: 'ISEVEN',
    category: 'Informação',
    syntax: 'ISEVEN(number)',
    description: 'Retorna TRUE se o número inteiro for par.',
    example: 'ISEVEN([Quantidade])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => {
      const n = Math.trunc(daxToNumber(a, true));
      return n % 2 === 0;
    },
  },

  ISODD: {
    name: 'ISODD',
    category: 'Informação',
    syntax: 'ISODD(number)',
    description: 'Retorna TRUE se o número inteiro for ímpar.',
    example: 'ISODD([Quantidade])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => {
      const n = Math.trunc(daxToNumber(a, true));
      return Math.abs(n % 2) === 1;
    },
  },

  ISINTEGER: {
    name: 'ISINTEGER',
    aliases: ['ISINT64'],
    category: 'Informação',
    syntax: 'ISINTEGER(value)',
    description: 'Retorna TRUE se o valor for um número inteiro.',
    example: 'ISINTEGER([Parcelas])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => typeof a === 'number' && Number.isInteger(a),
  },

  ISDECIMAL: {
    name: 'ISDECIMAL',
    aliases: ['ISDOUBLE', 'ISCURRENCY'],
    category: 'Informação',
    syntax: 'ISDECIMAL(value)',
    description: 'Retorna TRUE se o valor for numérico e contiver casas decimais fracionárias.',
    example: 'ISDECIMAL([PrecoUnitario])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => typeof a === 'number' && !Number.isInteger(a),
  },

  ISDATETIME: {
    name: 'ISDATETIME',
    category: 'Informação',
    syntax: 'ISDATETIME(value)',
    description: 'Retorna TRUE se o valor puder ser interpretado como data e hora.',
    example: 'ISDATETIME([DataVenda])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => {
      const d = toDate(a);
      return d !== null && !isNaN(d.getTime());
    },
  },

  // ==========================================
  // Text Functions (Compatibility & DAX)
  // ==========================================
  CONCAT: {
    name: 'CONCAT',
    aliases: ['CONCATENATE'],
    category: 'Texto',
    syntax: 'CONCAT(text1, text2, ...)',
    description: 'Concatena textos ou valores de colunas em uma única sequência de texto.',
    example: 'CONCAT([Cidade], " - ", [Estado])',
    minArgs: 1,
    maxArgs: -1,
    evaluate: (args) => args.map(a => daxToString(a)).join(''),
  },

  UPPER: {
    name: 'UPPER',
    aliases: ['TEXT.UPPER'],
    category: 'Texto',
    syntax: 'UPPER(text)',
    description: 'Converte todo o texto para letras maiúsculas.',
    example: 'UPPER([Cliente])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => daxToString(a).toUpperCase(),
  },

  LOWER: {
    name: 'LOWER',
    aliases: ['TEXT.LOWER'],
    category: 'Texto',
    syntax: 'LOWER(text)',
    description: 'Converte todo o texto para letras minúsculas.',
    example: 'LOWER([Email])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => daxToString(a).toLowerCase(),
  },

  PROPER: {
    name: 'PROPER',
    aliases: ['CAPITALIZE'],
    category: 'Texto',
    syntax: 'PROPER(text)',
    description: 'Converte a primeira letra de cada palavra em maiúscula e o resto em minúscula.',
    example: 'PROPER([NomeCompleto])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => {
      const s = daxToString(a);
      return s.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    },
  },

  TRIM: {
    name: 'TRIM',
    category: 'Texto',
    syntax: 'TRIM(text)',
    description: 'Remove espaços em branco repetidos e nas extremidades do texto.',
    example: 'TRIM([Descricao])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => daxToString(a).trim().replace(/\s+/g, ' '),
  },

  LEN: {
    name: 'LEN',
    aliases: ['TEXT.LENGTH'],
    category: 'Texto',
    syntax: 'LEN(text)',
    description: 'Retorna a quantidade de caracteres de um texto.',
    example: 'LEN([Codigo])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => daxToString(a).length,
  },

  LEFT: {
    name: 'LEFT',
    category: 'Texto',
    syntax: 'LEFT(text, [num_chars])',
    description: 'Retorna a quantidade de caracteres especificada a partir do início (esquerda) do texto.',
    example: 'LEFT([ID_Cliente], 3)',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([text, count]) => {
      const s = daxToString(text);
      const n = count !== undefined ? Math.max(0, Math.trunc(daxToNumber(count))) : 1;
      return s.substring(0, n);
    },
  },

  RIGHT: {
    name: 'RIGHT',
    category: 'Texto',
    syntax: 'RIGHT(text, [num_chars])',
    description: 'Retorna a quantidade de caracteres especificada a partir do fim (direita) do texto.',
    example: 'RIGHT([Telefone], 4)',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([text, count]) => {
      const s = daxToString(text);
      const n = count !== undefined ? Math.max(0, Math.trunc(daxToNumber(count))) : 1;
      return n >= s.length ? s : s.substring(s.length - n);
    },
  },

  MID: {
    name: 'MID',
    category: 'Texto',
    syntax: 'MID(text, start_num, num_chars)',
    description: 'Retorna caracteres a partir de uma posição específica (base 1) e tamanho definido.',
    example: 'MID([NotaFiscal], 3, 5)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([text, start, len]) => {
      const s = daxToString(text);
      const startIdx = Math.max(0, Math.trunc(daxToNumber(start)) - 1);
      const length = Math.max(0, Math.trunc(daxToNumber(len)));
      return s.substring(startIdx, startIdx + length);
    },
  },

  SUBSTITUTE: {
    name: 'SUBSTITUTE',
    category: 'Texto',
    syntax: 'SUBSTITUTE(text, old_text, new_text, [instance_num])',
    description: 'Substitui texto existente por um novo texto em uma cadeia de caracteres.',
    example: 'SUBSTITUTE([Status], "Aguardando", "Pendente")',
    minArgs: 3,
    maxArgs: 4,
    evaluate: ([text, oldText, newText, instance]) => {
      const s = daxToString(text);
      const o = daxToString(oldText);
      const n = daxToString(newText);
      if (!o) return s;
      if (instance !== undefined) {
        const inst = Math.trunc(daxToNumber(instance));
        let count = 0;
        return s.replace(new RegExp(o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), match => {
          count++;
          return count === inst ? n : match;
        });
      }
      return s.split(o).join(n);
    },
  },

  REPLACE: {
    name: 'REPLACE',
    category: 'Texto',
    syntax: 'REPLACE(old_text, start_num, num_chars, new_text) ou REPLACE(text, old_sub, new_sub)',
    description: 'Substitui parte de uma sequência de caracteres por uma nova sequência.',
    example: 'REPLACE([Codigo], 1, 2, "XX")',
    minArgs: 3,
    maxArgs: 4,
    evaluate: (args) => {
      // Compatibility: 3 args (text, old, new) like substitute
      if (args.length === 3 && typeof args[1] === 'string' && isNaN(Number(args[1]))) {
        const s = daxToString(args[0]);
        const o = daxToString(args[1]);
        const n = daxToString(args[2]);
        return s.split(o).join(n);
      }
      // DAX 4 args: (old_text, start_num, num_chars, new_text)
      const s = daxToString(args[0]);
      const start = Math.max(0, Math.trunc(daxToNumber(args[1])) - 1);
      const numChars = Math.max(0, Math.trunc(daxToNumber(args[2])));
      const newText = daxToString(args[3]);
      return s.substring(0, start) + newText + s.substring(start + numChars);
    },
  },

  CONTAINS: {
    name: 'CONTAINS',
    category: 'Texto',
    syntax: 'CONTAINS(text_or_table, search_term)',
    description: 'Verifica se o texto contém o termo especificado (ou tabela contém linha).',
    example: 'CONTAINS([Descricao], "Premium")',
    minArgs: 2,
    maxArgs: -1,
    evaluate: ([target, search]) => {
      const t = daxToString(target).toLowerCase();
      const s = daxToString(search).toLowerCase();
      return t.includes(s);
    },
  },

  // ==========================================
  // Math Functions
  // ==========================================
  DIVIDE: {
    name: 'DIVIDE',
    category: 'Matemática',
    syntax: 'DIVIDE(numerator, denominator, [alternate_result])',
    description: 'Realiza a divisão de forma segura, retornando o valor alternativo ou BLANK quando o denominador for zero.',
    example: 'DIVIDE([Lucro], [Receita], 0)',
    minArgs: 2,
    maxArgs: 3,
    evaluate: ([num, den, alt]) => {
      const n = daxToNumber(num);
      const d = daxToNumber(den);
      if (d === 0 || isNaN(d)) {
        return alt !== undefined ? alt : DAX_BLANK;
      }
      return n / d;
    },
  },

  ROUND: {
    name: 'ROUND',
    category: 'Matemática',
    syntax: 'ROUND(number, num_digits)',
    description: 'Arredonda um número para o número de casas decimais especificado.',
    example: 'ROUND([Total] * 1.15, 2)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([val, digits]) => {
      const n = daxToNumber(val, true);
      const d = Math.trunc(daxToNumber(digits));
      const factor = Math.pow(10, d);
      return Math.round(n * factor) / factor;
    },
  },

  ABS: {
    name: 'ABS',
    category: 'Matemática',
    syntax: 'ABS(number)',
    description: 'Retorna o valor absoluto de um número.',
    example: 'ABS([Desvio])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => Math.abs(daxToNumber(val, true)),
  },

  INT: {
    name: 'INT',
    category: 'Matemática',
    syntax: 'INT(number)',
    description: 'Arredonda um número para baixo até o inteiro mais próximo.',
    example: 'INT([Valor])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => Math.floor(daxToNumber(val, true)),
  },

  FLOOR: {
    name: 'FLOOR',
    category: 'Matemática',
    syntax: 'FLOOR(number, [significance])',
    description: 'Arredonda um número para baixo em direção a zero ou ao múltiplo de significância.',
    example: 'FLOOR([Preco], 0.5)',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([val, sig]) => {
      const n = daxToNumber(val, true);
      if (sig === undefined || sig === null) {
        return Math.floor(n);
      }
      const s = daxToNumber(sig, true);
      if (s === 0) return 0;
      return Math.floor(n / s) * s;
    },
  },

  POWER: {
    name: 'POWER',
    category: 'Matemática',
    syntax: 'POWER(number, power)',
    description: 'Retorna o resultado de um número elevado a uma potência.',
    example: 'POWER([Base], 2)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([base, exp]) => Math.pow(daxToNumber(base, true), daxToNumber(exp, true)),
  },

  SQRT: {
    name: 'SQRT',
    category: 'Matemática',
    syntax: 'SQRT(number)',
    description: 'Retorna a raiz quadrada positiva de um número.',
    example: 'SQRT([Variancia])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      const n = daxToNumber(val, true);
      if (n < 0) throw new DaxError('Execution', 'SQRT não aceita números negativos');
      return Math.sqrt(n);
    },
  },

  MOD: {
    name: 'MOD',
    category: 'Matemática',
    syntax: 'MOD(number, divisor)',
    description: 'Retorna o resto da divisão entre dois números.',
    example: 'MOD([ID], 2)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([val, div]) => {
      const d = daxToNumber(div, true);
      if (d === 0) throw new DaxError('Execution', 'Divisão por zero em MOD()');
      return daxToNumber(val, true) % d;
    },
  },

  // ==========================================
  // Date & Time Functions
  // ==========================================
  YEAR: {
    name: 'YEAR',
    category: 'Data',
    syntax: 'YEAR(date)',
    description: 'Retorna o ano de uma data como um número de 4 dígitos.',
    example: 'YEAR([Data])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([d]) => {
      const date = toDate(d);
      return date ? date.getFullYear() : DAX_BLANK;
    },
  },

  MONTH: {
    name: 'MONTH',
    category: 'Data',
    syntax: 'MONTH(date)',
    description: 'Retorna o mês de uma data como número de 1 a 12.',
    example: 'MONTH([Data])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([d]) => {
      const date = toDate(d);
      return date ? date.getMonth() + 1 : DAX_BLANK;
    },
  },

  DAY: {
    name: 'DAY',
    category: 'Data',
    syntax: 'DAY(date)',
    description: 'Retorna o dia do mês de uma data como número de 1 a 31.',
    example: 'DAY([Data])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([d]) => {
      const date = toDate(d);
      return date ? date.getDate() : DAX_BLANK;
    },
  },

  TODAY: {
    name: 'TODAY',
    aliases: ['HOJE'],
    category: 'Data',
    syntax: 'TODAY()',
    description: 'Retorna a data atual no formato YYYY-MM-DD.',
    example: 'TODAY()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: () => new Date().toISOString().split('T')[0],
  },

  NOW: {
    name: 'NOW',
    aliases: ['AGORA', 'DATETIME.LOCALNOW'],
    category: 'Data',
    syntax: 'NOW()',
    description: 'Retorna a data e hora atuais.',
    example: 'NOW()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: () => new Date().toISOString(),
  },

  DATEDIFF: {
    name: 'DATEDIFF',
    category: 'Data',
    syntax: 'DATEDIFF(date1, date2, interval)',
    description: 'Calcula a diferença entre duas datas no intervalo especificado ("day", "month", "year", "hour", "minute", "second").',
    example: 'DATEDIFF([DataVenda], TODAY(), "day")',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([d1, d2, interval]) => {
      const date1 = toDate(d1);
      const date2 = toDate(d2);
      if (!date1 || !date2) return DAX_BLANK;

      const unit = daxToString(interval).toLowerCase();
      const diffMs = date2.getTime() - date1.getTime();

      if (unit.startsWith('year') || unit.startsWith('ano')) {
        return date2.getFullYear() - date1.getFullYear();
      }
      if (unit.startsWith('month') || unit.startsWith('mes') || unit.startsWith('mês')) {
        return (date2.getFullYear() - date1.getFullYear()) * 12 + (date2.getMonth() - date1.getMonth());
      }
      if (unit.startsWith('hour') || unit.startsWith('hora')) {
        return Math.floor(diffMs / (1000 * 60 * 60));
      }
      if (unit.startsWith('minute') || unit.startsWith('minuto')) {
        return Math.floor(diffMs / (1000 * 60));
      }
      if (unit.startsWith('second') || unit.startsWith('segundo')) {
        return Math.floor(diffMs / 1000);
      }
      // default: day
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    },
  },

  FORMAT: {
    name: 'FORMAT',
    category: 'Data',
    syntax: 'FORMAT(value, format_string)',
    description: 'Formata um valor de acordo com o padrão textual especificado.',
    example: 'FORMAT([Data], "YYYY-MM")',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([val, fmt]) => {
      const formatStr = daxToString(fmt);
      const date = toDate(val);
      if (date && !isNaN(date.getTime())) {
        const yyyy = String(date.getFullYear());
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');

        return formatStr
          .replace(/YYYY/g, yyyy)
          .replace(/MM/g, mm)
          .replace(/DD/g, dd)
          .replace(/HH/g, hh)
          .replace(/mm/g, min)
          .replace(/SS/g, ss);
      }
      return daxToString(val);
    },
  },

  // ==========================================
  // Row Functions
  // ==========================================
  INDEX: {
    name: 'INDEX',
    aliases: ['LINHA', 'ROW_NUMBER'],
    category: 'Linha',
    syntax: 'INDEX() ou LINHA()',
    description: 'Gera o número de linha sequencial iniciando em 1.',
    example: 'INDEX()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: (_args, context) => {
      return (context?.rowIndex ?? 0) + 1;
    },
  },
};

// Register all modular scalar functions
Object.assign(FUNCTION_REGISTRY, ALL_SCALAR_FUNCTIONS);

// Aliases lookup map (normalized to lowercase)
const ALIAS_MAP = new Map<string, FunctionDefinition>();
for (const [key, fn] of Object.entries(FUNCTION_REGISTRY)) {
  ALIAS_MAP.set(key.toLowerCase(), fn);
  if (fn.aliases) {
    for (const alias of fn.aliases) {
      ALIAS_MAP.set(alias.toLowerCase(), fn);
    }
  }
}

export function lookupFunction(name: string): FunctionDefinition | undefined {
  return ALIAS_MAP.get(name.trim().toLowerCase());
}

export function getAllFunctionNames(): string[] {
  return Array.from(new Set(Object.values(FUNCTION_REGISTRY).map(fn => fn.name.toUpperCase())));
}

/**
 * Single source of truth export for POWER_BI_FUNCTIONS
 */
export const POWER_BI_FUNCTIONS: FunctionDoc[] = Object.values(FUNCTION_REGISTRY).map(fn => {
  let cat: FunctionDoc['category'] = 'Lógica / Condicional';
  if (fn.category === 'Texto') cat = 'Texto';
  else if (fn.category === 'Matemática') cat = 'Matemática';
  else if (fn.category === 'Data') cat = 'Data';
  else if (fn.category === 'Linha') cat = 'Linha';
  else if (fn.category === 'Agregação') cat = 'Agregação';
  else if (fn.category === 'Filtro') cat = 'Filtro';
  else if (fn.category === 'Tabela') cat = 'Tabela';

  return {
    name: fn.name,
    category: cat,
    syntax: fn.syntax,
    description: fn.description,
    example: fn.example,
  };
});
