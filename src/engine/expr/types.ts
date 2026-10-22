import { DaxError } from '../shared/errors';
import { parseNumber, parseDate } from '../shared/valueParser';

export type DaxScalar = number | string | boolean | null;

export type DaxValue =
  | DaxScalar
  | DaxScalar[]
  | Record<string, any>
  | Record<string, any>[];

export type DaxDataType =
  | 'INTEGER'
  | 'DECIMAL'
  | 'CURRENCY'
  | 'BOOLEAN'
  | 'STRING'
  | 'DATETIME'
  | 'BLANK'
  | 'TABLE'
  | 'VARIANT'
  | 'UNKNOWN';

export const DAX_BLANK: null = null;

export function isBlank(val: any): boolean {
  return val === null || val === undefined;
}

export function isBlankOrEmpty(val: any): boolean {
  return val === null || val === undefined || val === '';
}

/**
 * Coerce value to boolean according to DAX rules:
 * - BLANK is false
 * - 0 is false, other numbers are true
 * - "" is false, other strings: "true"/"verdadeiro" -> true, "false"/"falso" -> false, otherwise false
 */
export function daxToBoolean(val: any): boolean {
  if (isBlank(val)) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0 && !isNaN(val);
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'true' || s === 'verdadeiro' || s === '1') return true;
    if (s === 'false' || s === 'falso' || s === '0' || s === '') return false;
    const num = Number(s);
    if (!isNaN(num)) return num !== 0;
    return Boolean(s);
  }
  return Boolean(val);
}

/**
 * Coerce value to number according to DAX rules:
 * - BLANK -> 0 (in numeric contexts)
 * - boolean -> 1 / 0
 * - string -> parsed number or throws DaxError
 */
export function daxToNumber(val: any, throwOnInvalid = false): number {
  if (isBlank(val)) return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) {
      if (throwOnInvalid) throw new DaxError('Execution', 'Valor numérico inválido (NaN)');
      return 0;
    }
    return val;
  }
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val instanceof Date) return val.getTime();

  const parsed = parseNumber(val);
  if (parsed.value !== null && !isNaN(parsed.value)) {
    return parsed.value;
  }

  if (throwOnInvalid) {
    throw new DaxError('Type', `Não foi possível converter o texto "${val}" em número`);
  }
  return 0;
}

/**
 * Coerce value to string according to DAX rules:
 * - BLANK -> ""
 * - boolean -> "TRUE" / "FALSE"
 */
export function daxToString(val: any): string {
  if (isBlank(val)) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

// ==========================================
// Arithmetic Operators with DAX BLANK Rules
// ==========================================

export function daxAdd(left: any, right: any): any {
  if (isBlank(left) && isBlank(right)) return DAX_BLANK;
  const numL = isBlank(left) ? 0 : daxToNumber(left, true);
  const numR = isBlank(right) ? 0 : daxToNumber(right, true);
  return numL + numR;
}

export function daxSubtract(left: any, right: any): any {
  if (isBlank(left) && isBlank(right)) return DAX_BLANK;
  const numL = isBlank(left) ? 0 : daxToNumber(left, true);
  const numR = isBlank(right) ? 0 : daxToNumber(right, true);
  return numL - numR;
}

export function daxMultiply(left: any, right: any): any {
  // In DAX: BLANK * anything = BLANK, anything * BLANK = BLANK
  if (isBlank(left) || isBlank(right)) return DAX_BLANK;
  const numL = daxToNumber(left, true);
  const numR = daxToNumber(right, true);
  return numL * numR;
}

export function daxDivide(left: any, right: any, isColumnDialect = false): any {
  // In DAX: BLANK / X = BLANK; X / BLANK = Divisão por zero
  if (isBlank(left)) return DAX_BLANK;
  const numL = daxToNumber(left, true);
  const numR = isBlank(right) ? 0 : daxToNumber(right, true);

  if (numR === 0) {
    if (isColumnDialect) {
      return null;
    }
    throw new DaxError('Execution', 'Divisão por zero não é permitida no operador "/" (use DIVIDE para alternativa)');
  }
  return numL / numR;
}

export function daxPower(left: any, right: any): any {
  if (isBlank(left) && isBlank(right)) return DAX_BLANK;
  if (isBlank(left)) return DAX_BLANK;
  const numL = daxToNumber(left, true);
  const numR = isBlank(right) ? 0 : daxToNumber(right, true);
  return Math.pow(numL, numR);
}

export function daxMod(left: any, right: any): any {
  if (isBlank(left) || isBlank(right)) return DAX_BLANK;
  const numL = daxToNumber(left, true);
  const numR = daxToNumber(right, true);
  if (numR === 0) {
    throw new DaxError('Execution', 'Divisão por zero no operador de módulo (%)');
  }
  return numL % numR;
}

export function daxConcat(left: any, right: any): string {
  const strL = daxToString(left);
  const strR = daxToString(right);
  return strL + strR;
}

// ==========================================
// Comparison Operators
// ==========================================

/**
 * DAX Lenient Equality (=):
 * - BLANK = 0 is TRUE
 * - BLANK = "" is TRUE
 * - Case-insensitive string comparison
 */
export function daxEqual(left: any, right: any): boolean {
  if (isBlank(left) && isBlank(right)) return true;

  // BLANK with number or string
  if (isBlank(left)) {
    if (typeof right === 'number') return right === 0;
    if (typeof right === 'string') return right === '';
    if (typeof right === 'boolean') return !right;
    return false;
  }
  if (isBlank(right)) {
    if (typeof left === 'number') return left === 0;
    if (typeof left === 'string') return left === '';
    if (typeof left === 'boolean') return !left;
    return false;
  }

  // Type coercion
  if (typeof left === 'number' || typeof right === 'number') {
    const numL = daxToNumber(left, false);
    const numR = daxToNumber(right, false);
    return numL === numR;
  }

  if (typeof left === 'boolean' || typeof right === 'boolean') {
    return daxToBoolean(left) === daxToBoolean(right);
  }

  // String comparison: DAX is case-insensitive
  const strL = String(left).toLowerCase();
  const strR = String(right).toLowerCase();
  return strL === strR;
}

/**
 * DAX Strict Equality (==):
 * - BLANK == 0 is FALSE
 * - BLANK == "" is FALSE
 * - BLANK == BLANK is TRUE
 * - Case-insensitive string comparison
 */
export function daxStrictEqual(left: any, right: any): boolean {
  if (isBlank(left) && isBlank(right)) return true;
  if (isBlank(left) || isBlank(right)) return false;

  if (typeof left === 'number' && typeof right === 'number') {
    return left === right;
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return left === right;
  }

  const strL = String(left).toLowerCase();
  const strR = String(right).toLowerCase();
  return strL === strR;
}

export function daxNotEqual(left: any, right: any): boolean {
  return !daxEqual(left, right);
}

export function daxCompare(left: any, right: any): number {
  if (isBlank(left) && isBlank(right)) return 0;

  if (typeof left === 'number' || typeof right === 'number') {
    const numL = isBlank(left) ? 0 : daxToNumber(left, false);
    const numR = isBlank(right) ? 0 : daxToNumber(right, false);
    if (numL < numR) return -1;
    if (numL > numR) return 1;
    return 0;
  }

  const strL = isBlank(left) ? '' : String(left).toLowerCase();
  const strR = isBlank(right) ? '' : String(right).toLowerCase();
  if (strL < strR) return -1;
  if (strL > strR) return 1;
  return 0;
}

export function daxIn(left: any, tableOrList: any): boolean {
  if (!tableOrList) return false;
  const list = Array.isArray(tableOrList) ? tableOrList : [tableOrList];
  return list.some(item => {
    // If item is a row tuple [a, b], or single value
    if (Array.isArray(item) && !Array.isArray(left)) {
      return daxEqual(left, item[0]);
    }
    return daxEqual(left, item);
  });
}
