import { FunctionDefinition } from '../expr/registry';
import { daxToNumber, daxToString, isBlank, DAX_BLANK } from '../expr/types';
import { DaxError } from '../shared/errors';
import { formatValue } from '../shared/formatter';

function wildcardToRegExp(pattern: string): RegExp {
  let regexStr = '^';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '~') {
      if (i + 1 < pattern.length) {
        const next = pattern[i + 1];
        regexStr += '\\' + next;
        i += 2;
        continue;
      }
    }
    if (ch === '?') {
      regexStr += '.';
    } else if (ch === '*') {
      regexStr += '.*';
    } else if (['\\', '^', '$', '.', '|', '+', '(', ')', '[', ']', '{', '}'].includes(ch)) {
      regexStr += '\\' + ch;
    } else {
      regexStr += ch;
    }
    i++;
  }
  return new RegExp(regexStr, 'i');
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export const TEXT_FUNCTIONS: Record<string, FunctionDefinition> = {
  LEFT: {
    name: 'LEFT',
    category: 'Texto',
    syntax: 'LEFT(text, [num_chars])',
    description: 'Retorna a quantidade de caracteres especificada a partir do início (esquerda) do texto.',
    example: 'LEFT("Curitiba", 3)',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([text, count]) => {
      if (isBlank(text)) return DAX_BLANK;
      const s = daxToString(text);
      const n = count !== undefined && !isBlank(count) ? Math.max(0, Math.trunc(daxToNumber(count, true))) : 1;
      return s.substring(0, n);
    },
  },

  RIGHT: {
    name: 'RIGHT',
    category: 'Texto',
    syntax: 'RIGHT(text, [num_chars])',
    description: 'Retorna a quantidade de caracteres especificada a partir do fim (direita) do texto.',
    example: 'RIGHT("Curitiba", 4)',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([text, count]) => {
      if (isBlank(text)) return DAX_BLANK;
      const s = daxToString(text);
      const n = count !== undefined && !isBlank(count) ? Math.max(0, Math.trunc(daxToNumber(count, true))) : 1;
      return n >= s.length ? s : s.substring(s.length - n);
    },
  },

  MID: {
    name: 'MID',
    category: 'Texto',
    syntax: 'MID(text, start_num, num_chars)',
    description: 'Retorna uma cadeia de caracteres de um texto a partir da posição inicial (base 1).',
    example: 'MID("InsightHub", 8, 3)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([text, start, len]) => {
      if (isBlank(text)) return DAX_BLANK;
      const s = daxToString(text);
      const startIdx = Math.max(0, Math.trunc(daxToNumber(start, true)) - 1);
      const length = Math.max(0, Math.trunc(daxToNumber(len, true)));
      return s.substring(startIdx, startIdx + length);
    },
  },

  LEN: {
    name: 'LEN',
    category: 'Texto',
    syntax: 'LEN(text)',
    description: 'Retorna a quantidade de caracteres em uma cadeia de texto.',
    example: 'LEN("Insight")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([text]) => {
      if (isBlank(text)) return DAX_BLANK;
      return daxToString(text).length;
    },
  },

  LOWER: {
    name: 'LOWER',
    aliases: ['TEXT.LOWER'],
    category: 'Texto',
    syntax: 'LOWER(text)',
    description: 'Converte todas as letras de um texto em minúsculas.',
    example: 'LOWER("DADO")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([text]) => {
      if (isBlank(text)) return DAX_BLANK;
      return daxToString(text).toLowerCase();
    },
  },

  UPPER: {
    name: 'UPPER',
    aliases: ['TEXT.UPPER'],
    category: 'Texto',
    syntax: 'UPPER(text)',
    description: 'Converte todas as letras de um texto em maiúsculas.',
    example: 'UPPER("dado")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([text]) => {
      if (isBlank(text)) return DAX_BLANK;
      return daxToString(text).toUpperCase();
    },
  },

  TRIM: {
    name: 'TRIM',
    category: 'Texto',
    syntax: 'TRIM(text)',
    description: 'Remove todos os espaços em branco de um texto, exceto espaços únicos entre palavras.',
    example: 'TRIM("   Power   BI   ")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([text]) => {
      if (isBlank(text)) return DAX_BLANK;
      return daxToString(text).trim().replace(/\s+/g, ' ');
    },
  },

  REPLACE: {
    name: 'REPLACE',
    category: 'Texto',
    syntax: 'REPLACE(old_text, start_num, num_chars, new_text)',
    description: 'Substitui parte de uma cadeia de texto por um texto diferente com base na posição inicial e no comprimento.',
    example: 'REPLACE("ABC123", 4, 3, "456")',
    minArgs: 3,
    maxArgs: 4,
    evaluate: (args) => {
      if (args.length === 3 && typeof args[1] === 'string' && isNaN(Number(args[1]))) {
        // Compatibility mode (text, oldSub, newSub)
        const s = daxToString(args[0]);
        const o = daxToString(args[1]);
        const n = daxToString(args[2]);
        return s.split(o).join(n);
      }
      const s = daxToString(args[0]);
      const start = Math.max(0, Math.trunc(daxToNumber(args[1], true)) - 1);
      const numChars = Math.max(0, Math.trunc(daxToNumber(args[2], true)));
      const newText = daxToString(args[3]);
      return s.substring(0, start) + newText + s.substring(start + numChars);
    },
  },

  SUBSTITUTE: {
    name: 'SUBSTITUTE',
    category: 'Texto',
    syntax: 'SUBSTITUTE(text, old_text, new_text, [instance_num])',
    description: 'Substitui texto existente por novo texto em uma cadeia de caracteres.',
    example: 'SUBSTITUTE("a-b-c", "-", "/", 2)',
    minArgs: 3,
    maxArgs: 4,
    evaluate: ([text, oldText, newText, instance]) => {
      if (isBlank(text)) return DAX_BLANK;
      const s = daxToString(text);
      const o = daxToString(oldText);
      const n = daxToString(newText);
      if (!o) return s;

      if (instance !== undefined && !isBlank(instance)) {
        const inst = Math.trunc(daxToNumber(instance, true));
        let count = 0;
        let pos = 0;
        let result = '';
        while (pos < s.length) {
          const found = s.indexOf(o, pos);
          if (found === -1) {
            result += s.substring(pos);
            break;
          }
          count++;
          result += s.substring(pos, found);
          if (count === inst) {
            result += n;
          } else {
            result += o;
          }
          pos = found + o.length;
        }
        return result;
      }

      return s.split(o).join(n);
    },
  },

  REPT: {
    name: 'REPT',
    category: 'Texto',
    syntax: 'REPT(text, number_times)',
    description: 'Repete o texto um determinado número de vezes.',
    example: 'REPT("*-", 3)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([text, times]) => {
      if (isBlank(text) || isBlank(times)) return DAX_BLANK;
      const s = daxToString(text);
      const n = Math.trunc(daxToNumber(times, true));
      if (n < 0) throw new DaxError('Execution', 'REPT: number_times não pode ser negativo');
      return s.repeat(n);
    },
  },

  FIND: {
    name: 'FIND',
    category: 'Texto',
    syntax: 'FIND(find_text, within_text, [start_num], [not_found_value])',
    description: 'Retorna a posição inicial da primeira cadeia de texto dentro de outra cadeia (diferencia maiúsculas de minúsculas).',
    example: 'FIND("Hub", "InsightHub")',
    minArgs: 2,
    maxArgs: 4,
    evaluate: ([findText, withinText, startNum, notFoundVal]) => {
      if (isBlank(findText) || isBlank(withinText)) {
        if (notFoundVal !== undefined) return notFoundVal;
        throw new DaxError('Execution', 'FIND: valor em branco não encontrado');
      }
      const find = daxToString(findText);
      const within = daxToString(withinText);
      const start = startNum !== undefined && !isBlank(startNum) ? Math.max(0, Math.trunc(daxToNumber(startNum, true)) - 1) : 0;
      const pos = within.indexOf(find, start);
      if (pos === -1) {
        if (notFoundVal !== undefined) return notFoundVal;
        throw new DaxError('Execution', `FIND: texto "${find}" não foi encontrado em "${within}"`);
      }
      return pos + 1;
    },
  },

  SEARCH: {
    name: 'SEARCH',
    category: 'Texto',
    syntax: 'SEARCH(find_text, within_text, [start_num], [not_found_value])',
    description: 'Retorna o número da posição inicial de um texto dentro de outro, não diferenciando maiúsculas de minúsculas e aceitando curingas (? e *).',
    example: 'SEARCH("hub", "InsightHub")',
    minArgs: 2,
    maxArgs: 4,
    evaluate: ([findText, withinText, startNum, notFoundVal]) => {
      if (isBlank(findText) || isBlank(withinText)) {
        if (notFoundVal !== undefined) return notFoundVal;
        throw new DaxError('Execution', 'SEARCH: valor em branco não encontrado');
      }
      const find = daxToString(findText);
      const within = daxToString(withinText);
      const start = startNum !== undefined && !isBlank(startNum) ? Math.max(0, Math.trunc(daxToNumber(startNum, true)) - 1) : 0;

      // Check if find contains wildcards (* or ?)
      const hasWildcard = find.includes('*') || find.includes('?');
      if (!hasWildcard) {
        const pos = within.toLowerCase().indexOf(find.toLowerCase(), start);
        if (pos === -1) {
          if (notFoundVal !== undefined) return notFoundVal;
          throw new DaxError('Execution', `SEARCH: texto "${find}" não foi encontrado em "${within}"`);
        }
        return pos + 1;
      }

      // Regex matching with wildcards
      const sub = within.substring(start);
      const reg = wildcardToRegExp(find);
      // Scan for match starting from start
      for (let i = start; i <= within.length; i++) {
        for (let j = i + 1; j <= within.length; j++) {
          if (reg.test(within.substring(i, j))) {
            return i + 1;
          }
        }
      }

      if (notFoundVal !== undefined) return notFoundVal;
      throw new DaxError('Execution', `SEARCH: padrão "${find}" não encontrado em "${within}"`);
    },
  },

  EXACT: {
    name: 'EXACT',
    category: 'Texto',
    syntax: 'EXACT(text1, text2)',
    description: 'Compara duas cadeias de texto e retorna TRUE se forem exatamente idênticas (diferencia maiúsculas de minúsculas), senão FALSE.',
    example: 'EXACT("Insight", "insight")',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([t1, t2]) => {
      return daxToString(t1) === daxToString(t2);
    },
  },

  CONCATENATE: {
    name: 'CONCATENATE',
    category: 'Texto',
    syntax: 'CONCATENATE(text1, text2)',
    description: 'Concatena duas cadeias de texto em uma só cadeia.',
    example: 'CONCATENATE("Insight", "Hub")',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([t1, t2]) => {
      return daxToString(t1) + daxToString(t2);
    },
  },

  COMBINEVALUES: {
    name: 'COMBINEVALUES',
    category: 'Texto',
    syntax: 'COMBINEVALUES(delimiter, expression1, expression2, ...)',
    description: 'Concatena dois ou mais valores de texto em uma única cadeia usando o delimitador especificado.',
    example: 'COMBINEVALUES("-", "A", "B", "C")',
    minArgs: 2,
    maxArgs: -1,
    evaluate: (args) => {
      const delim = daxToString(args[0]);
      const items = args.slice(1).map(x => daxToString(x));
      return items.join(delim);
    },
  },

  FIXED: {
    name: 'FIXED',
    category: 'Texto',
    syntax: 'FIXED(number, [decimals], [no_commas])',
    description: 'Arredonda um número para o número de casas decimais especificado e retorna o resultado como texto formatado.',
    example: 'FIXED(1234.567, 1)',
    minArgs: 1,
    maxArgs: 3,
    evaluate: ([num, decimals, noCommas]) => {
      if (isBlank(num)) return DAX_BLANK;
      const n = daxToNumber(num, true);
      const dec = decimals !== undefined && !isBlank(decimals) ? Math.trunc(daxToNumber(decimals, true)) : 2;
      const suppressCommas = noCommas !== undefined ? Boolean(noCommas) : false;

      const pattern = suppressCommas
        ? `0${dec > 0 ? '.' + '0'.repeat(dec) : ''}`
        : `#,##0${dec > 0 ? '.' + '0'.repeat(dec) : ''}`;

      return formatValue(n, pattern, 'en-US');
    },
  },

  FORMAT: {
    name: 'FORMAT',
    category: 'Texto',
    syntax: 'FORMAT(value, format_string)',
    description: 'Converte um valor em texto de acordo com a cadeia de caracteres de formato especificada.',
    example: 'FORMAT(1234.5, "#,0.00")',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([val, fmt]) => {
      return formatValue(val, daxToString(fmt), 'pt-BR');
    },
  },

  VALUE: {
    name: 'VALUE',
    category: 'Texto',
    syntax: 'VALUE(text)',
    description: 'Converte uma cadeia de caracteres de texto que representa um número em um número.',
    example: 'VALUE("1.234,50")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      return daxToNumber(val, true);
    },
  },

  UNICHAR: {
    name: 'UNICHAR',
    category: 'Texto',
    syntax: 'UNICHAR(number)',
    description: 'Retorna o caractere Unicode referenciado pelo valor numérico fornecido.',
    example: 'UNICHAR(65)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const code = Math.trunc(daxToNumber(val, true));
      try {
        return String.fromCodePoint(code);
      } catch {
        throw new DaxError('Execution', `UNICHAR: ponto de código Unicode inválido ${code}`);
      }
    },
  },

  UNICODE: {
    name: 'UNICODE',
    category: 'Texto',
    syntax: 'UNICODE(text)',
    description: 'Retorna o número (ponto de código) correspondente ao primeiro caractere do texto.',
    example: 'UNICODE("A")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const s = daxToString(val);
      if (!s) return DAX_BLANK;
      const cp = s.codePointAt(0);
      return cp !== undefined ? cp : DAX_BLANK;
    },
  },

  CONTAINSSTRING: {
    name: 'CONTAINSSTRING',
    category: 'Texto',
    syntax: 'CONTAINSSTRING(within_text, find_text)',
    description: 'Retorna TRUE se within_text contiver find_text (não diferencia maiúsculas de minúsculas).',
    example: 'CONTAINSSTRING("InsightHub", "hub")',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([within, find]) => {
      if (isBlank(within) || isBlank(find)) return false;
      return daxToString(within).toLowerCase().includes(daxToString(find).toLowerCase());
    },
  },

  CONTAINSSTRINGEXACT: {
    name: 'CONTAINSSTRINGEXACT',
    category: 'Texto',
    syntax: 'CONTAINSSTRINGEXACT(within_text, find_text)',
    description: 'Retorna TRUE se within_text contiver find_text (diferencia maiúsculas de minúsculas).',
    example: 'CONTAINSSTRINGEXACT("InsightHub", "Hub")',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([within, find]) => {
      if (isBlank(within) || isBlank(find)) return false;
      return daxToString(within).includes(daxToString(find));
    },
  },

  TEXTCONTAINS: {
    name: 'TEXTCONTAINS',
    category: 'Texto',
    syntax: 'TEXTCONTAINS(within_text, find_text, [comparison_type])',
    description: 'Verifica se uma cadeia contém outra. comparison_type 0 = linguístico (ignora maiúsculas), 1 = ordinal (exato).',
    example: 'TEXTCONTAINS("InsightHub", "hub", 0)',
    minArgs: 2,
    maxArgs: 3,
    evaluate: ([within, find, compType]) => {
      if (isBlank(within) || isBlank(find)) return false;
      const exact = compType !== undefined && Math.trunc(daxToNumber(compType, true)) === 1;
      const w = daxToString(within);
      const f = daxToString(find);
      return exact ? w.includes(f) : w.toLowerCase().includes(f.toLowerCase());
    },
  },

  TEXTSIMILARITY: {
    name: 'TEXTSIMILARITY',
    category: 'Texto',
    syntax: 'TEXTSIMILARITY(text1, text2)',
    description: 'Calcula o índice de similaridade entre dois textos (0.0 a 1.0). Implementado via razão de distância Levenshtein normalizada.',
    example: 'TEXTSIMILARITY("Curitiba", "Curitiba")',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([t1, t2]) => {
      if (isBlank(t1) && isBlank(t2)) return 1.0;
      if (isBlank(t1) || isBlank(t2)) return 0.0;
      const s1 = daxToString(t1).toLowerCase();
      const s2 = daxToString(t2).toLowerCase();
      if (s1 === s2) return 1.0;
      const maxLen = Math.max(s1.length, s2.length);
      if (maxLen === 0) return 1.0;
      const dist = levenshteinDistance(s1, s2);
      const score = Math.max(0, 1 - dist / maxLen);
      return Number(score.toFixed(4));
    },
  },

  // Legacy Aliases
  PROPER: {
    name: 'PROPER',
    aliases: ['CAPITALIZE'],
    category: 'Texto',
    syntax: 'PROPER(text)',
    description: 'Converte a primeira letra de cada palavra em maiúscula e o restante em minúscula.',
    example: 'PROPER("insight hub")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([text]) => {
      if (isBlank(text)) return DAX_BLANK;
      const s = daxToString(text);
      return s.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    },
  },

  CONCAT: {
    name: 'CONCAT',
    category: 'Texto',
    syntax: 'CONCAT(text1, text2, ...)',
    description: 'Concatena argumentos de texto em uma única sequência.',
    example: 'CONCAT("A", "B", "C")',
    minArgs: 1,
    maxArgs: -1,
    evaluate: (args) => {
      return args.map(a => daxToString(a)).join('');
    },
  },
};
