import { FunctionDefinition } from '../expr/registry';
import { daxToBoolean, daxToNumber, daxToString, isBlank, DAX_BLANK } from '../expr/types';
import { DaxError } from '../shared/errors';
import { parseDate } from '../shared/valueParser';

export const CONVERSION_FUNCTIONS: Record<string, FunctionDefinition> = {
  CONVERT: {
    name: 'CONVERT',
    category: 'Matemática',
    syntax: 'CONVERT(expression, data_type)',
    description: 'Converte uma expressão para o tipo de dados especificado ("INTEGER", "DOUBLE", "STRING", "BOOLEAN", "DATETIME", "CURRENCY").',
    example: 'CONVERT("123.45", "DOUBLE")',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([val, typeArg]) => {
      if (isBlank(val)) return DAX_BLANK;
      const typeStr = daxToString(typeArg).toUpperCase().trim();

      switch (typeStr) {
        case 'INTEGER':
        case 'INT64':
          return Math.trunc(daxToNumber(val, true));
        case 'DOUBLE':
        case 'DECIMAL':
          return daxToNumber(val, true);
        case 'STRING':
        case 'TEXT':
          return daxToString(val);
        case 'BOOLEAN':
          return daxToBoolean(val);
        case 'DATETIME':
        case 'DATE': {
          const res = parseDate(val);
          if (!res?.date) throw new DaxError('Type', `CONVERT: não foi possível converter "${val}" em DATETIME`);
          return res.date.toISOString();
        }
        case 'CURRENCY':
          return Number(daxToNumber(val, true).toFixed(4));
        default:
          throw new DaxError('Type', `CONVERT: tipo de dados não suportado "${typeStr}"`);
      }
    },
  },

  CURRENCY: {
    name: 'CURRENCY',
    category: 'Matemática',
    syntax: 'CURRENCY(value)',
    description: 'Converte o argumento no tipo Moeda do DAX (ponto fixo com 4 casas decimais).',
    example: 'CURRENCY(123.45678)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const n = daxToNumber(val, true);
      return Number(n.toFixed(4));
    },
  },
};
