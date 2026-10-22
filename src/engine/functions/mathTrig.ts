import { FunctionDefinition } from '../expr/registry';
import { daxToNumber, isBlank, DAX_BLANK } from '../expr/types';
import { DaxError } from '../shared/errors';

function gcdTwo(a: number, b: number): number {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function lcmTwo(a: number, b: number): number {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcdTwo(a, b);
}

export const MATH_TRIG_FUNCTIONS: Record<string, FunctionDefinition> = {
  ABS: {
    name: 'ABS',
    category: 'Matemática',
    syntax: 'ABS(number)',
    description: 'Retorna o valor absoluto de um número.',
    example: 'ABS(-5.5)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      return Math.abs(daxToNumber(val, true));
    },
  },

  CEILING: {
    name: 'CEILING',
    category: 'Matemática',
    syntax: 'CEILING(number, significance)',
    description: 'Arredonda um número para cima, afastando-se de zero, até o múltiplo mais próximo da significância.',
    example: 'CEILING(2.5, 1)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([val, sig]) => {
      if (isBlank(val) || isBlank(sig)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      const s = daxToNumber(sig, true);
      if (s === 0) return 0;
      if (n === 0) return 0;
      if ((n > 0 && s < 0) || (n < 0 && s > 0)) {
        throw new DaxError('Execution', 'CEILING: o número e a significância devem ter o mesmo sinal');
      }
      const sign = n >= 0 ? 1 : -1;
      return sign * Math.ceil(Math.abs(n) / Math.abs(s)) * Math.abs(s);
    },
  },

  FLOOR: {
    name: 'FLOOR',
    category: 'Matemática',
    syntax: 'FLOOR(number, significance)',
    description: 'Arredonda um número para baixo, em direção a zero, até o múltiplo mais próximo da significância.',
    example: 'FLOOR(2.5, 1)',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([val, sig]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      if (sig === undefined || isBlank(sig)) {
        return Math.floor(n);
      }
      const s = daxToNumber(sig, true);
      if (s === 0) return 0;
      if (n === 0) return 0;
      if ((n > 0 && s < 0) || (n < 0 && s > 0)) {
        throw new DaxError('Execution', 'FLOOR: o número e a significância devem ter o mesmo sinal');
      }
      const sign = n >= 0 ? 1 : -1;
      return sign * Math.floor(Math.abs(n) / Math.abs(s)) * Math.abs(s);
    },
  },

  'ISO.CEILING': {
    name: 'ISO.CEILING',
    category: 'Matemática',
    syntax: 'ISO.CEILING(number, [significance])',
    description: 'Arredonda um número para cima até o múltiplo mais próximo, independentemente do sinal da significância.',
    example: 'ISO.CEILING(4.3, 2)',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([val, sig]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      const s = sig !== undefined && !isBlank(sig) ? Math.abs(daxToNumber(sig, true)) : 1;
      if (s === 0) return 0;
      return Math.ceil(n / s) * s;
    },
  },

  MROUND: {
    name: 'MROUND',
    category: 'Matemática',
    syntax: 'MROUND(number, multiple)',
    description: 'Retorna um número arredondado para o múltiplo desejado.',
    example: 'MROUND(10, 3)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([val, mult]) => {
      if (isBlank(val) || isBlank(mult)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      const m = daxToNumber(mult, true);
      if (m === 0) return 0;
      if ((n > 0 && m < 0) || (n < 0 && m > 0)) {
        throw new DaxError('Execution', 'MROUND: o número e o múltiplo devem ter o mesmo sinal');
      }
      return Math.round(n / m) * m;
    },
  },

  ROUND: {
    name: 'ROUND',
    category: 'Matemática',
    syntax: 'ROUND(number, num_digits)',
    description: 'Arredonda um número para o número de casas decimais especificado.',
    example: 'ROUND(2.5, 0)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([val, digits]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      const d = Math.trunc(daxToNumber(digits, true));
      const factor = Math.pow(10, d);
      const sign = n >= 0 ? 1 : -1;
      return sign * (Math.round(Math.abs(n) * factor) / factor);
    },
  },

  ROUNDUP: {
    name: 'ROUNDUP',
    category: 'Matemática',
    syntax: 'ROUNDUP(number, num_digits)',
    description: 'Arredonda um número para cima, afastando-se de zero.',
    example: 'ROUNDUP(2.1, 0)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([val, digits]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      const d = Math.trunc(daxToNumber(digits, true));
      const factor = Math.pow(10, d);
      const sign = n >= 0 ? 1 : -1;
      return sign * (Math.ceil(Math.abs(n) * factor) / factor);
    },
  },

  ROUNDDOWN: {
    name: 'ROUNDDOWN',
    category: 'Matemática',
    syntax: 'ROUNDDOWN(number, num_digits)',
    description: 'Arredonda um número para baixo, aproximando-se de zero.',
    example: 'ROUNDDOWN(2.9, 0)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([val, digits]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      const d = Math.trunc(daxToNumber(digits, true));
      const factor = Math.pow(10, d);
      const sign = n >= 0 ? 1 : -1;
      return sign * (Math.floor(Math.abs(n) * factor) / factor);
    },
  },

  TRUNC: {
    name: 'TRUNC',
    category: 'Matemática',
    syntax: 'TRUNC(number, [num_digits])',
    description: 'Trunca um número para um inteiro removendo a parte fracionária, ou para casas especificadas.',
    example: 'TRUNC(-1.5)',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([val, digits]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      const d = digits !== undefined && !isBlank(digits) ? Math.trunc(daxToNumber(digits, true)) : 0;
      const factor = Math.pow(10, d);
      return Math.trunc(n * factor) / factor;
    },
  },

  INT: {
    name: 'INT',
    category: 'Matemática',
    syntax: 'INT(number)',
    description: 'Arredonda um número para baixo até o inteiro mais próximo em direção a infinito negativo.',
    example: 'INT(-1.5)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      return Math.floor(daxToNumber(val, true));
    },
  },

  EVEN: {
    name: 'EVEN',
    category: 'Matemática',
    syntax: 'EVEN(number)',
    description: 'Arredonda um número para cima até o inteiro par mais próximo, afastando-se de zero.',
    example: 'EVEN(1.5)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      if (n === 0) return 0;
      const sign = n >= 0 ? 1 : -1;
      let ceil = Math.ceil(Math.abs(n));
      if (ceil % 2 !== 0) ceil++;
      return sign * ceil;
    },
  },

  ODD: {
    name: 'ODD',
    category: 'Matemática',
    syntax: 'ODD(number)',
    description: 'Arredonda um número para cima até o inteiro ímpar mais próximo, afastando-se de zero.',
    example: 'ODD(1.5)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      const sign = n >= 0 ? 1 : -1;
      let ceil = Math.ceil(Math.abs(n));
      if (ceil % 2 === 0) ceil++;
      return sign * ceil;
    },
  },

  SIGN: {
    name: 'SIGN',
    category: 'Matemática',
    syntax: 'SIGN(number)',
    description: 'Retorna o sinal de um número: 1 se positivo, 0 se zero/BLANK, -1 se negativo.',
    example: 'SIGN(-15)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return 0;
      const n = daxToNumber(val, true);
      if (n > 0) return 1;
      if (n < 0) return -1;
      return 0;
    },
  },

  MOD: {
    name: 'MOD',
    category: 'Matemática',
    syntax: 'MOD(number, divisor)',
    description: 'Retorna o resto da divisão. No DAX: MOD(n, d) = n - d * INT(n / d).',
    example: 'MOD(-3, 2)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([val, div]) => {
      if (isBlank(val) || isBlank(div)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      const d = daxToNumber(div, true);
      if (d === 0) throw new DaxError('Execution', 'Divisão por zero em MOD()');
      return n - d * Math.floor(n / d);
    },
  },

  QUOTIENT: {
    name: 'QUOTIENT',
    category: 'Matemática',
    syntax: 'QUOTIENT(numerator, denominator)',
    description: 'Retorna a parte inteira de uma divisão em direção a zero.',
    example: 'QUOTIENT(5, 2)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([num, den]) => {
      if (isBlank(num) || isBlank(den)) return DAX_BLANK;
      const n = daxToNumber(num, true);
      const d = daxToNumber(den, true);
      if (d === 0) throw new DaxError('Execution', 'Divisão por zero em QUOTIENT()');
      return Math.trunc(n / d);
    },
  },

  DIVIDE: {
    name: 'DIVIDE',
    category: 'Matemática',
    syntax: 'DIVIDE(numerator, denominator, [alternate_result])',
    description: 'Realiza divisão segura retornando resultado alternativo ou BLANK em caso de divisão por zero.',
    example: 'DIVIDE([Vendas], [Meta], 0)',
    minArgs: 2,
    maxArgs: 3,
    evaluate: ([num, den, alt]) => {
      if (isBlank(num)) return DAX_BLANK;
      const n = daxToNumber(num, true);
      const d = isBlank(den) ? 0 : daxToNumber(den, true);
      if (d === 0 || isNaN(d)) {
        return alt !== undefined ? alt : DAX_BLANK;
      }
      return n / d;
    },
  },

  POWER: {
    name: 'POWER',
    category: 'Matemática',
    syntax: 'POWER(number, power)',
    description: 'Retorna o resultado de um número elevado a uma potência.',
    example: 'POWER(2, 3)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([base, exp]) => {
      if (isBlank(base) && isBlank(exp)) return DAX_BLANK;
      const b = isBlank(base) ? 0 : daxToNumber(base, true);
      const e = isBlank(exp) ? 0 : daxToNumber(exp, true);
      return Math.pow(b, e);
    },
  },

  SQRT: {
    name: 'SQRT',
    category: 'Matemática',
    syntax: 'SQRT(number)',
    description: 'Retorna a raiz quadrada positiva de um número.',
    example: 'SQRT(16)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      if (n < 0) throw new DaxError('Execution', 'SQRT: argumento deve ser maior ou igual a zero');
      return Math.sqrt(n);
    },
  },

  SQRTPI: {
    name: 'SQRTPI',
    category: 'Matemática',
    syntax: 'SQRTPI(number)',
    description: 'Retorna a raiz quadrada de (número * Pi).',
    example: 'SQRTPI(2)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      if (n < 0) throw new DaxError('Execution', 'SQRTPI: argumento deve ser maior ou igual a zero');
      return Math.sqrt(n * Math.PI);
    },
  },

  EXP: {
    name: 'EXP',
    category: 'Matemática',
    syntax: 'EXP(number)',
    description: 'Retorna "e" elevado à potência de um número especificado.',
    example: 'EXP(1)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      return Math.exp(daxToNumber(val, true));
    },
  },

  LN: {
    name: 'LN',
    category: 'Matemática',
    syntax: 'LN(number)',
    description: 'Retorna o logaritmo natural de um número.',
    example: 'LN(2.7182818)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      if (n <= 0) throw new DaxError('Execution', 'LN: argumento deve ser maior que zero');
      return Math.log(n);
    },
  },

  LOG: {
    name: 'LOG',
    category: 'Matemática',
    syntax: 'LOG(number, [base])',
    description: 'Retorna o logaritmo de um número na base especificada (padrão 10).',
    example: 'LOG(8, 2)',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([val, base]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      const b = base !== undefined && !isBlank(base) ? daxToNumber(base, true) : 10;
      if (n <= 0) throw new DaxError('Execution', 'LOG: número deve ser maior que zero');
      if (b <= 0 || b === 1) throw new DaxError('Execution', 'LOG: base deve ser maior que zero e diferente de 1');
      return Math.log(n) / Math.log(b);
    },
  },

  LOG10: {
    name: 'LOG10',
    category: 'Matemática',
    syntax: 'LOG10(number)',
    description: 'Retorna o logaritmo de base 10 de um número.',
    example: 'LOG10(100)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      if (n <= 0) throw new DaxError('Execution', 'LOG10: número deve ser maior que zero');
      return Math.log10(n);
    },
  },

  FACT: {
    name: 'FACT',
    category: 'Matemática',
    syntax: 'FACT(number)',
    description: 'Retorna o fatorial de um número inteiro não negativo.',
    example: 'FACT(5)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = Math.trunc(daxToNumber(val, true));
      if (n < 0) throw new DaxError('Execution', 'FACT: o número deve ser não negativo');
      if (n === 0 || n === 1) return 1;
      let res = 1;
      for (let i = 2; i <= n; i++) res *= i;
      return res;
    },
  },

  GCD: {
    name: 'GCD',
    category: 'Matemática',
    syntax: 'GCD(number1, number2, ...)',
    description: 'Retorna o máximo divisor comum (MDC) de dois ou mais inteiros.',
    example: 'GCD(24, 36)',
    minArgs: 2,
    maxArgs: -1,
    evaluate: (args) => {
      let current = Math.trunc(daxToNumber(args[0], true));
      for (let i = 1; i < args.length; i++) {
        current = gcdTwo(current, Math.trunc(daxToNumber(args[i], true)));
      }
      return current;
    },
  },

  LCM: {
    name: 'LCM',
    category: 'Matemática',
    syntax: 'LCM(number1, number2, ...)',
    description: 'Retorna o mínimo múltiplo comum (MMC) de dois ou mais inteiros.',
    example: 'LCM(4, 6)',
    minArgs: 2,
    maxArgs: -1,
    evaluate: (args) => {
      let current = Math.trunc(daxToNumber(args[0], true));
      for (let i = 1; i < args.length; i++) {
        current = lcmTwo(current, Math.trunc(daxToNumber(args[i], true)));
      }
      return current;
    },
  },

  PI: {
    name: 'PI',
    category: 'Matemática',
    syntax: 'PI()',
    description: 'Retorna o valor da constante matemática Pi (3.141592653589793).',
    example: 'PI()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: () => Math.PI,
  },

  DEGREES: {
    name: 'DEGREES',
    category: 'Matemática',
    syntax: 'DEGREES(angle)',
    description: 'Converte radianos em graus.',
    example: 'DEGREES(PI())',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      return daxToNumber(val, true) * (180 / Math.PI);
    },
  },

  RADIANS: {
    name: 'RADIANS',
    category: 'Matemática',
    syntax: 'RADIANS(angle)',
    description: 'Converte graus em radianos.',
    example: 'RADIANS(180)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      return daxToNumber(val, true) * (Math.PI / 180);
    },
  },

  RAND: {
    name: 'RAND',
    category: 'Matemática',
    syntax: 'RAND()',
    description: 'Retorna um número decimal aleatório maior ou igual a 0 e menor que 1 (função volátil).',
    example: 'RAND()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: () => Math.random(),
  },

  RANDBETWEEN: {
    name: 'RANDBETWEEN',
    category: 'Matemática',
    syntax: 'RANDBETWEEN(bottom, top)',
    description: 'Retorna um número inteiro aleatório entre os limites especificados inclusive.',
    example: 'RANDBETWEEN(1, 100)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([b, t]) => {
      const bottom = Math.trunc(daxToNumber(b, true));
      const top = Math.trunc(daxToNumber(t, true));
      if (bottom > top) {
        throw new DaxError('Execution', 'RANDBETWEEN: o valor inferior não pode ser maior que o superior');
      }
      return Math.floor(Math.random() * (top - bottom + 1)) + bottom;
    },
  },

  // Trigonometric & Hyperbolic
  SIN: {
    name: 'SIN',
    category: 'Matemática',
    syntax: 'SIN(number)',
    description: 'Retorna o seno de um ângulo fornecido em radianos.',
    example: 'SIN(PI() / 2)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => isBlank(val) ? DAX_BLANK : Math.sin(daxToNumber(val, true)),
  },

  COS: {
    name: 'COS',
    category: 'Matemática',
    syntax: 'COS(number)',
    description: 'Retorna o cosseno de um ângulo fornecido em radianos.',
    example: 'COS(0)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => isBlank(val) ? DAX_BLANK : Math.cos(daxToNumber(val, true)),
  },

  TAN: {
    name: 'TAN',
    category: 'Matemática',
    syntax: 'TAN(number)',
    description: 'Retorna a tangente de um ângulo fornecido em radianos.',
    example: 'TAN(PI() / 4)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => isBlank(val) ? DAX_BLANK : Math.tan(daxToNumber(val, true)),
  },

  COT: {
    name: 'COT',
    category: 'Matemática',
    syntax: 'COT(number)',
    description: 'Retorna a cotangente de um ângulo fornecido em radianos.',
    example: 'COT(PI() / 4)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const t = Math.tan(daxToNumber(val, true));
      if (t === 0) throw new DaxError('Execution', 'COT: tangente é zero, cotangente indefinida');
      return 1 / t;
    },
  },

  ASIN: {
    name: 'ASIN',
    category: 'Matemática',
    syntax: 'ASIN(number)',
    description: 'Retorna o arco seno de um número em radianos (-pi/2 a pi/2).',
    example: 'ASIN(1)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      if (n < -1 || n > 1) throw new DaxError('Execution', 'ASIN: o argumento deve estar entre -1 e 1');
      return Math.asin(n);
    },
  },

  ACOS: {
    name: 'ACOS',
    category: 'Matemática',
    syntax: 'ACOS(number)',
    description: 'Retorna o arco cosseno de um número em radianos (0 a pi).',
    example: 'ACOS(1)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      if (n < -1 || n > 1) throw new DaxError('Execution', 'ACOS: o argumento deve estar entre -1 e 1');
      return Math.acos(n);
    },
  },

  ATAN: {
    name: 'ATAN',
    category: 'Matemática',
    syntax: 'ATAN(number)',
    description: 'Retorna o arco tangente de um número em radianos (-pi/2 a pi/2).',
    example: 'ATAN(1)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => isBlank(val) ? DAX_BLANK : Math.atan(daxToNumber(val, true)),
  },

  ACOT: {
    name: 'ACOT',
    category: 'Matemática',
    syntax: 'ACOT(number)',
    description: 'Retorna o arco cotangente de um número em radianos (0 a pi).',
    example: 'ACOT(1)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      return Math.PI / 2 - Math.atan(n);
    },
  },

  SINH: {
    name: 'SINH',
    category: 'Matemática',
    syntax: 'SINH(number)',
    description: 'Retorna o seno hiperbólico de um número.',
    example: 'SINH(1)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => isBlank(val) ? DAX_BLANK : Math.sinh(daxToNumber(val, true)),
  },

  COSH: {
    name: 'COSH',
    category: 'Matemática',
    syntax: 'COSH(number)',
    description: 'Retorna o cosseno hiperbólico de um número.',
    example: 'COSH(0)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => isBlank(val) ? DAX_BLANK : Math.cosh(daxToNumber(val, true)),
  },

  TANH: {
    name: 'TANH',
    category: 'Matemática',
    syntax: 'TANH(number)',
    description: 'Retorna a tangente hiperbólica de um número.',
    example: 'TANH(1)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => isBlank(val) ? DAX_BLANK : Math.tanh(daxToNumber(val, true)),
  },

  COTH: {
    name: 'COTH',
    category: 'Matemática',
    syntax: 'COTH(number)',
    description: 'Retorna a cotangente hiperbólica de um número.',
    example: 'COTH(1)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      const th = Math.tanh(n);
      if (th === 0) throw new DaxError('Execution', 'COTH: argumento não pode ser zero');
      return 1 / th;
    },
  },

  ASINH: {
    name: 'ASINH',
    category: 'Matemática',
    syntax: 'ASINH(number)',
    description: 'Retorna o arco seno hiperbólico de um número.',
    example: 'ASINH(1)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => isBlank(val) ? DAX_BLANK : Math.asinh(daxToNumber(val, true)),
  },

  ACOSH: {
    name: 'ACOSH',
    category: 'Matemática',
    syntax: 'ACOSH(number)',
    description: 'Retorna o arco cosseno hiperbólico de um número (maior ou igual a 1).',
    example: 'ACOSH(1)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      if (n < 1) throw new DaxError('Execution', 'ACOSH: argumento deve ser maior ou igual a 1');
      return Math.acosh(n);
    },
  },

  ATANH: {
    name: 'ATANH',
    category: 'Matemática',
    syntax: 'ATANH(number)',
    description: 'Retorna o arco tangente hiperbólico de um número (-1 < x < 1).',
    example: 'ATANH(0.5)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      if (n <= -1 || n >= 1) throw new DaxError('Execution', 'ATANH: argumento deve estar estritamente entre -1 e 1');
      return Math.atanh(n);
    },
  },

  ACOTH: {
    name: 'ACOTH',
    category: 'Matemática',
    syntax: 'ACOTH(number)',
    description: 'Retorna o arco cotangente hiperbólico de um número (|x| > 1).',
    example: 'ACOTH(2)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      if (Math.abs(n) <= 1) throw new DaxError('Execution', 'ACOTH: o valor absoluto do argumento deve ser maior que 1');
      return 0.5 * Math.log((n + 1) / (n - 1));
    },
  },
};
