import { isBlank } from '../expr/types';

export type SupportedLocale = 'pt-BR' | 'en-US';

export interface FormatValueOptions {
  locale?: SupportedLocale;
  showBlankAsZero?: boolean;
  isLegacyColumn?: boolean;
}

/**
 * Normalizes any date value to a Date object in UTC
 */
function toDateObj(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    // Excel date serial number or unix timestamp
    if (val > 10000000000) {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    // Excel serial date (days since 1899-12-30)
    const excelEpoch = Date.UTC(1899, 11, 30);
    const msPerDay = 86400000;
    const d = new Date(excelEpoch + val * msPerDay);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(val).trim();
  // Check ISO / standard date strings
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  // Check BR format DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1;
    let year = parseInt(brMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
    const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
    const sec = brMatch[6] ? parseInt(brMatch[6], 10) : 0;
    const d = new Date(Date.UTC(year, month, day, hour, min, sec));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Formats a Date object using DAX date format pattern strings
 */
function formatDatePattern(date: Date, pattern: string, locale: SupportedLocale): string {
  const utcYear = date.getUTCFullYear();
  const utcMonth = date.getUTCMonth(); // 0-11
  const utcDate = date.getUTCDate();
  const utcDay = date.getUTCDay(); // 0-6
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  const utcSeconds = date.getUTCSeconds();

  const monthNamesPt = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const monthShortPt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dayNamesPt = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const dayShortPt = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthShortEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayShortEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const isPt = locale === 'pt-BR';
  const monthNames = isPt ? monthNamesPt : monthNamesEn;
  const monthShort = isPt ? monthShortPt : monthShortEn;
  const dayNames = isPt ? dayNamesPt : dayNamesEn;
  const dayShort = isPt ? dayShortPt : dayShortEn;

  // Check common presets
  const lower = pattern.toLowerCase().trim();
  if (lower === 'short date') {
    return isPt
      ? `${String(utcDate).padStart(2, '0')}/${String(utcMonth + 1).padStart(2, '0')}/${utcYear}`
      : `${utcMonth + 1}/${utcDate}/${utcYear}`;
  }
  if (lower === 'long date') {
    return isPt
      ? `${dayNames[utcDay]}, ${utcDate} de ${monthNames[utcMonth]} de ${utcYear}`
      : `${dayNames[utcDay]}, ${monthNames[utcMonth]} ${utcDate}, ${utcYear}`;
  }
  if (lower === 'short time') {
    return `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;
  }
  if (lower === 'long time') {
    return `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}:${String(utcSeconds).padStart(2, '0')}`;
  }

  // Token replacement
  // Replace tokens with placeholders to avoid double-replacement
  let res = pattern;

  // Years
  res = res.replace(/yyyy/gi, String(utcYear));
  res = res.replace(/yy/gi, String(utcYear).slice(-2));

  // Months / Days text
  res = res.replace(/mmmm/gi, '___MMMM___');
  res = res.replace(/mmm/gi, '___MMM___');
  res = res.replace(/dddd/gi, '___DDDD___');
  res = res.replace(/ddd/gi, '___DDD___');

  // Days
  res = res.replace(/dd/gi, String(utcDate).padStart(2, '0'));
  res = res.replace(/\bd\b/gi, String(utcDate));

  // Months
  res = res.replace(/mm/gi, String(utcMonth + 1).padStart(2, '0'));
  res = res.replace(/\bm\b/gi, String(utcMonth + 1));

  // Hours
  res = res.replace(/hh/gi, String(utcHours).padStart(2, '0'));
  res = res.replace(/\bh\b/gi, String(utcHours));

  // Minutes (nn or ss check)
  res = res.replace(/nn/gi, String(utcMinutes).padStart(2, '0'));
  res = res.replace(/ss/gi, String(utcSeconds).padStart(2, '0'));

  // Put back month and day names
  res = res.replace(/___MMMM___/g, monthNames[utcMonth]);
  res = res.replace(/___MMM___/g, monthShort[utcMonth]);
  res = res.replace(/___DDDD___/g, dayNames[utcDay]);
  res = res.replace(/___DDD___/g, dayShort[utcDay]);

  return res;
}

/**
 * Formats a number according to a DAX number pattern
 */
function formatNumberPattern(val: number, pattern: string, locale: SupportedLocale): string {
  const isPt = locale === 'pt-BR';
  const thousandsSep = isPt ? '.' : ',';
  const decimalSep = isPt ? ',' : '.';

  // Check if pattern is a percentage
  const isPercent = pattern.includes('%');
  let effectiveVal = isPercent ? val * 100 : val;

  // Handle scientific notation or NaN/Infinity
  if (!isFinite(effectiveVal)) return String(val);

  // Check decimal digits in pattern
  // Matches e.g. "0.00", "#,##0.00", "#,0.00", "0.0%"
  // In DAX format patterns, "." is the decimal placeholder and "," is the thousands grouping placeholder
  let decimals = 0;
  const decMatch = pattern.match(/\.([0#]+)/);
  if (decMatch) {
    decimals = decMatch[1].length;
  }

  const useThousands = pattern.includes(',') || pattern.toLowerCase().includes('currency') || pattern.includes('#,##0') || pattern.includes('#,0');

  const absVal = Math.abs(effectiveVal);
  const fixed = absVal.toFixed(decimals);
  const parts = fixed.split('.');
  let intPart = parts[0];
  const decPart = parts[1] || '';

  if (useThousands) {
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
  }

  let formattedNumber = decPart ? `${intPart}${decimalSep}${decPart}` : intPart;
  if (effectiveVal < 0) {
    formattedNumber = `-${formattedNumber}`;
  }

  if (isPercent) {
    return `${formattedNumber}%`;
  }

  // Handle prefix / suffix like "R$ #,##0.00" or "$#,##0.00"
  // If the pattern has prefix or suffix around the number template
  if (pattern.includes('R$') || pattern.startsWith('$')) {
    const prefix = pattern.includes('R$') ? 'R$ ' : '$';
    return `${prefix}${formattedNumber}`;
  }

  return formattedNumber;
}

/**
 * Main DAX-compliant formatValue implementation
 */
export function formatValue(
  value: any,
  formatString?: string,
  optionsOrLocale: SupportedLocale | FormatValueOptions = 'pt-BR'
): string {
  const options: FormatValueOptions =
    typeof optionsOrLocale === 'string'
      ? { locale: optionsOrLocale }
      : optionsOrLocale || {};

  const locale = options.locale || 'pt-BR';
  const showBlankAsZero = options.showBlankAsZero ?? false;
  const isLegacyColumn = options.isLegacyColumn ?? false;

  // 1. BLANK handling: strictly distinct from 0 and empty string
  if (isBlank(value)) {
    if (showBlankAsZero) {
      return formatValue(0, formatString, { ...options, showBlankAsZero: false });
    }
    return '';
  }

  if (typeof value === 'boolean') {
    const fmtLower = (formatString || '').toLowerCase().trim();
    if (fmtLower === 'yes/no' || fmtLower === 'sim/não' || fmtLower === 'sim/nao') {
      return value ? (locale === 'pt-BR' ? 'Sim' : 'Yes') : (locale === 'pt-BR' ? 'Não' : 'No');
    }
    if (fmtLower === 'on/off') {
      return value ? 'On' : 'Off';
    }
    return value ? 'TRUE' : 'FALSE';
  }

  const fmt = (formatString || '').trim();
  const fmtLower = fmt.toLowerCase();

  // If no format specified, use natural representation
  if (!fmt) {
    if (typeof value === 'number') {
      if (Number.isInteger(value)) return String(value);
      return locale === 'pt-BR'
        ? String(value).replace('.', ',')
        : String(value);
    }
    if (value instanceof Date) {
      return formatDatePattern(value, 'short date', locale);
    }
    return String(value);
  }

  // 2. Named Formats
  switch (fmtLower) {
    case 'currency':
    case 'moeda':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: locale === 'pt-BR' ? 'BRL' : 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value) || 0);

    case 'percent':
    case 'percentage':
    case 'percentual': {
      let num = Number(value);
      if (isNaN(num)) return '0,0%';
      if (isLegacyColumn && Math.abs(num) > 1) {
        num = num / 100;
      }
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(num);
    }

    case 'standard':
    case 'general number':
      return new Intl.NumberFormat(locale, {
        useGrouping: true,
        maximumFractionDigits: 4,
      }).format(Number(value) || 0);

    case 'fixed':
      return new Intl.NumberFormat(locale, {
        useGrouping: false,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value) || 0);

    case 'short date':
    case 'data curta':
    case 'long date':
    case 'data longa':
    case 'short time':
    case 'long time': {
      const d = toDateObj(value);
      if (!d) return String(value);
      return formatDatePattern(d, fmtLower, locale);
    }
  }

  // 3. Multi-section format: "positive;negative;zero;blank"
  if (fmt.includes(';')) {
    const sections = fmt.split(';');
    const num = Number(value);
    if (!isNaN(num)) {
      if (num > 0 && sections[0]) {
        return formatValue(num, sections[0], options);
      } else if (num < 0 && sections[1]) {
        return formatValue(Math.abs(num), sections[1], options);
      } else if (num === 0 && sections[2]) {
        return formatValue(0, sections[2], options);
      }
    }
  }

  // 4. Date formatting patterns (dd/mm/yyyy, yyyy-mm-dd, etc.)
  const isDatePattern = /[yYdDhHnNsS]/.test(fmt) && !/[#0]/.test(fmt);
  if (isDatePattern || value instanceof Date) {
    const d = toDateObj(value);
    if (d) {
      return formatDatePattern(d, fmt, locale);
    }
  }

  // 5. Numeric patterns (#,##0.00, 0.0%, etc.)
  const numVal = Number(value);
  if (!isNaN(numVal)) {
    return formatNumberPattern(numVal, fmt, locale);
  }

  return String(value);
}

// ==========================================
// Backwards-Compatible Wrappers
// ==========================================

export function formatCurrency(value: number | null | undefined): string {
  if (isBlank(value) || isNaN(value as number)) return 'R$ 0,00';
  return formatValue(value, 'Currency', 'pt-BR');
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (isBlank(value) || isNaN(value as number)) return '0';
  return formatValue(value, `#,##0${decimals > 0 ? '.' + '0'.repeat(decimals) : ''}`, 'pt-BR');
}

export function formatPercent(value: number | null | undefined, isLegacyColumn = true): string {
  if (isBlank(value) || isNaN(value as number)) return '0,0%';
  return formatValue(value, 'Percent', { locale: 'pt-BR', isLegacyColumn });
}

export function formatDateBR(dateVal: any): string {
  if (isBlank(dateVal)) return '';
  return formatValue(dateVal, 'Short Date', 'pt-BR');
}
