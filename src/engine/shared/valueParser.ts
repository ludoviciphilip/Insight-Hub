/**
 * Universal value parsers for InsightHub DAX and ETL engines.
 * Adheres to strict typing rules: never silently convert invalid entries or BLANK to 0.
 */

export interface NumberParseResult {
  value: number | null;
  error?: string;
  isPercent?: boolean;
}

export interface DateParseResult {
  date: Date | null;
  serial: number | null; // Excel-compatible UTC day serial (days since 1899-12-30)
  iso: string | null;    // YYYY-MM-DD
  error?: string;
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30); // 1899-12-30
const MS_PER_DAY = 86400000;

/**
 * Universal date parser supporting ISO, dd/mm/yyyy, Excel serials, and Date instances.
 * Always resolves to UTC date to prevent timezone shifts.
 */
export function parseDate(val: any): DateParseResult {
  if (val === null || val === undefined || val === '') {
    return { date: null, serial: null, iso: null };
  }

  // Already a Date object
  if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      return { date: null, serial: null, iso: null, error: 'Objeto Date com valor inválido (NaN)' };
    }
    const y = val.getUTCFullYear();
    const m = val.getUTCMonth();
    const d = val.getUTCDate();
    const utcDate = new Date(Date.UTC(y, m, d));
    const serial = Math.floor((utcDate.getTime() - EXCEL_EPOCH_UTC) / MS_PER_DAY);
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { date: utcDate, serial, iso };
  }

  // Excel serial number (numeric, e.g. 44927 for 2023-01-01)
  if (typeof val === 'number') {
    if (isNaN(val)) {
      return { date: null, serial: null, iso: null, error: 'Serial numérico de data é NaN' };
    }
    // Excel date range typical serials: 1 to 2958465 (year 1900 to 9999)
    if (val >= 1 && val <= 2958465) {
      const serialDay = Math.floor(val);
      const dateMs = EXCEL_EPOCH_UTC + serialDay * MS_PER_DAY;
      const dObj = new Date(dateMs);
      const y = dObj.getUTCFullYear();
      const m = dObj.getUTCMonth();
      const d = dObj.getUTCDate();
      const utcDate = new Date(Date.UTC(y, m, d));
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { date: utcDate, serial: serialDay, iso };
    }
  }

  const s = String(val).trim();
  if (!s) {
    return { date: null, serial: null, iso: null };
  }

  // Pure digits: check if compact 8-digit YYYYMMDD (e.g. "20250115")
  if (/^\d{8}$/.test(s)) {
    const y = parseInt(s.substring(0, 4), 10);
    const m = parseInt(s.substring(4, 6), 10);
    const d = parseInt(s.substring(6, 8), 10);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const utcDate = new Date(Date.UTC(y, m - 1, d));
      if (!isNaN(utcDate.getTime())) {
        const serial = Math.floor((utcDate.getTime() - EXCEL_EPOCH_UTC) / MS_PER_DAY);
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return { date: utcDate, serial, iso };
      }
    }
  }

  // Reject any other pure numeric strings (e.g. "100", "1234", "50000", "1500.50")
  // Plain numbers in string form are numbers, IDs, or currency, NOT date strings
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    return { date: null, serial: null, iso: null, error: `Valor numérico em formato de texto não é data: "${s}"` };
  }

  // Brazilian format: DD/MM/YYYY or DD-MM-YYYY (with optional time)
  const brMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10);
    const year = parseInt(brMatch[3], 10);
    const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
    const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
    const sec = brMatch[6] ? parseInt(brMatch[6], 10) : 0;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const utcDate = new Date(Date.UTC(year, month - 1, day, hour, min, sec));
      if (!isNaN(utcDate.getTime())) {
        const serial = Math.floor((utcDate.getTime() - EXCEL_EPOCH_UTC) / MS_PER_DAY);
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { date: utcDate, serial, iso };
      }
    }
  }

  // ISO format: YYYY-MM-DD or YYYY/MM/DD (with optional time)
  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
    const min = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    const sec = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const utcDate = new Date(Date.UTC(year, month - 1, day, hour, min, sec));
      if (!isNaN(utcDate.getTime())) {
        const serial = Math.floor((utcDate.getTime() - EXCEL_EPOCH_UTC) / MS_PER_DAY);
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { date: utcDate, serial, iso };
      }
    }
  }

  // Native Date fallback ONLY if string contains date separators or month names
  if (/[-/,\s]/.test(s) && /[a-zA-Z0-9]/.test(s)) {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getUTCFullYear();
      // Constrain plausible date range to avoid bogus dates like year 0100
      if (y >= 1900 && y <= 2100) {
        const m = parsed.getUTCMonth();
        const d = parsed.getUTCDate();
        const utcDate = new Date(Date.UTC(y, m, d));
        const serial = Math.floor((utcDate.getTime() - EXCEL_EPOCH_UTC) / MS_PER_DAY);
        const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return { date: utcDate, serial, iso };
      }
    }
  }

  return { date: null, serial: null, iso: null, error: `Formato de data inválido ou irreconhecível: "${s}"` };
}

/**
 * Universal number parser supporting pt-BR ("1.234,56", "R$ 1.234,56", "12,5%"),
 * accounting negatives "(1.234,56)", scientific notation ("1.23e4", "1,23e-3"),
 * and standard en-US numbers.
 */
export function parseNumber(
  val: any,
  locale: 'pt-BR' | 'en-US' | 'auto' = 'auto'
): NumberParseResult {
  if (val === null || val === undefined || val === '') {
    return { value: null };
  }

  if (typeof val === 'number') {
    if (isNaN(val)) {
      return { value: null, error: 'Valor numérico é NaN' };
    }
    return { value: val };
  }

  if (typeof val === 'boolean') {
    return { value: val ? 1 : 0 };
  }

  let s = String(val).trim();
  if (!s) {
    return { value: null };
  }

  // Accounting negative notation: e.g. (1.234,56) or (1234.56) or ($ 1,234.56)
  let isNegative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    isNegative = true;
    s = s.slice(1, -1).trim();
  } else if (s.startsWith('-')) {
    isNegative = true;
    s = s.slice(1).trim();
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim();
  }

  // Percentage check: e.g. "12,5%" or "12.5%"
  let isPercent = false;
  if (s.endsWith('%')) {
    isPercent = true;
    s = s.slice(0, -1).trim();
  }

  // Remove currency symbols & words: R$, $, €, £, BRL, USD, etc.
  s = s.replace(/^(?:R\$|\$|€|£|BRL|USD|EUR)\s*/i, '');
  s = s.replace(/\s*(?:R\$|\$|€|£|BRL|USD|EUR)$/i, '');
  // Remove non-breaking spaces and regular spaces inside number
  s = s.replace(/\s+/g, '');

  if (!s) {
    return { value: null, error: 'Valor numérico vazio após remoção de formatação monetária' };
  }

  // Scientific notation handling: e.g. "1.23e4", "1,23e4", "1.5e-3", "1,5e-3"
  const sciMatch = s.match(/^([0-9.,]+)[eE]([+-]?[0-9]+)$/);
  if (sciMatch) {
    const basePart = sciMatch[1];
    const expPart = parseInt(sciMatch[2], 10);
    const baseRes = parseNumber(basePart, locale);
    if (baseRes.value === null) {
      return { value: null, error: `Base de notação científica inválida: "${basePart}"` };
    }
    let result = baseRes.value * Math.pow(10, expPart);
    if (isNegative) result = -result;
    if (isPercent) result = result / 100;
    return { value: result, isPercent };
  }

  let normalized: string;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const firstComma = s.indexOf(',');
    const firstDot = s.indexOf('.');
    if (firstDot < firstComma) {
      // pt-BR: thousand separator is dot, decimal separator is comma: "1.234,56" or "1.234.567,89"
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else {
      // en-US: thousand separator is comma, decimal separator is dot: "1,234.56"
      normalized = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Only comma present:
    // If pt-BR or auto, comma is decimal: "1234,56" -> "1234.56"
    // Multiple commas might be thousands: "1,234,567"
    const commaCount = (s.match(/,/g) || []).length;
    if (commaCount > 1) {
      normalized = s.replace(/,/g, '');
    } else {
      normalized = s.replace(',', '.');
    }
  } else if (hasDot) {
    // Only dot present:
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Multiple dots: "1.234.567" -> thousands separators in pt-BR
      normalized = s.replace(/\./g, '');
    } else if (locale === 'pt-BR') {
      // In explicit pt-BR, if it has 3 digits after single dot (e.g. "1.234"), it could be thousand
      // But standard float "1234.56" has 2 digits.
      if (/^\d{1,3}\.\d{3}$/.test(s)) {
        normalized = s.replace('.', '');
      } else {
        normalized = s;
      }
    } else {
      // Standard dot decimal "1234.56"
      normalized = s;
    }
  } else {
    // Pure integer digits
    normalized = s;
  }

  // Validate that normalized contains only digits and optional single dot
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(normalized)) {
    return { value: null, error: `Formato numérico inválido: "${val}"` };
  }

  let num = parseFloat(normalized);
  if (isNaN(num)) {
    return { value: null, error: `Falha ao converter para número: "${val}"` };
  }

  if (isNegative) {
    num = -num;
  }

  if (isPercent) {
    num = num / 100;
  }

  return { value: num, isPercent };
}
