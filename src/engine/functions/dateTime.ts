import { FunctionDefinition } from '../expr/registry';
import { daxToNumber, daxToString, isBlank, DAX_BLANK } from '../expr/types';
import { DaxError } from '../shared/errors';
import { parseDate } from '../shared/valueParser';

function parseDateArg(val: any): Date | null {
  if (isBlank(val)) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  const res = parseDate(val);
  return res?.date || null;
}

function formatDateISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Standard ISO 8601 week number (System 2 / return_type 21)
 */
function getIsoWeek(d: Date): number {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
}

/**
 * Excel/DAX System 1 week calculation based on week start day (0=Sun, 1=Mon, ..., 6=Sat)
 */
function getSystem1Week(d: Date, weekStartDay: number): number {
  const year = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();

  // Find the date of the first day of week 1
  let offset = (jan1Day - weekStartDay + 7) % 7;
  const startOfWeek1 = new Date(Date.UTC(year, 0, 1 - offset));

  const diffMs = d.getTime() - startOfWeek1.getTime();
  const weekNum = Math.floor(diffMs / (7 * 86400000)) + 1;
  return Math.max(1, weekNum);
}

/**
 * Computes YEARFRAC according to basis 0-4
 */
function calcYearFrac(d1: Date, d2: Date, basis: number): number {
  let start = d1;
  let end = d2;
  if (start.getTime() > end.getTime()) {
    const temp = start;
    start = end;
    end = temp;
  }

  const y1 = start.getUTCFullYear();
  const m1 = start.getUTCMonth();
  let day1 = start.getUTCDate();

  const y2 = end.getUTCFullYear();
  const m2 = end.getUTCMonth();
  let day2 = end.getUTCDate();

  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);

  switch (basis) {
    case 0: { // US (NASD) 30/360
      if (day1 === 31) day1 = 30;
      if (day2 === 31 && day1 >= 30) day2 = 30;
      const days360 = (y2 - y1) * 360 + (m2 - m1) * 30 + (day2 - day1);
      return days360 / 360;
    }
    case 1: { // Actual/Actual
      let yearLength = 365;
      if (y1 === y2) {
        const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
        yearLength = isLeap(y1) ? 366 : 365;
      } else {
        const totalDays = (new Date(Date.UTC(y2 + 1, 0, 1)).getTime() - new Date(Date.UTC(y1, 0, 1)).getTime()) / 86400000;
        yearLength = totalDays / (y2 - y1 + 1);
      }
      return diffDays / yearLength;
    }
    case 2: // Actual/360
      return diffDays / 360;
    case 3: // Actual/365
      return diffDays / 365;
    case 4: { // European 30/360
      if (day1 === 31) day1 = 30;
      if (day2 === 31) day2 = 30;
      const days360 = (y2 - y1) * 360 + (m2 - m1) * 30 + (day2 - day1);
      return days360 / 360;
    }
    default:
      throw new DaxError('Execution', `YEARFRAC: base inválida (${basis}). Use valores de 0 a 4.`);
  }
}

export const DATE_TIME_FUNCTIONS: Record<string, FunctionDefinition> = {
  DATE: {
    name: 'DATE',
    category: 'Data',
    syntax: 'DATE(year, month, day)',
    description: 'Cria uma data a partir do ano, mês e dia especificados, normalizando automaticamente estouros.',
    example: 'DATE(2024, 14, 1)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([y, m, d]) => {
      if (isBlank(y) || isBlank(m) || isBlank(d)) return DAX_BLANK;
      let year = Math.trunc(daxToNumber(y, true));
      const month = Math.trunc(daxToNumber(m, true));
      const day = Math.trunc(daxToNumber(d, true));

      if (year >= 0 && year < 100) {
        year += 1900;
      }

      // Normalization via Date.UTC
      const date = new Date(Date.UTC(year, month - 1, day));
      if (isNaN(date.getTime())) {
        throw new DaxError('Execution', 'DATE: combinação de data inválida');
      }
      return formatDateISO(date);
    },
  },

  DATEVALUE: {
    name: 'DATEVALUE',
    category: 'Data',
    syntax: 'DATEVALUE(date_text)',
    description: 'Converte uma data em formato de texto para um valor de data.',
    example: 'DATEVALUE("2024-02-15")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const d = parseDateArg(val);
      if (!d) throw new DaxError('Type', `DATEVALUE: não foi possível converter "${val}" em data`);
      return formatDateISO(d);
    },
  },

  TIME: {
    name: 'TIME',
    category: 'Data',
    syntax: 'TIME(hour, minute, second)',
    description: 'Converte horas, minutos e segundos em um horário formatado como HH:MM:SS.',
    example: 'TIME(14, 30, 0)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([h, m, s]) => {
      if (isBlank(h) || isBlank(m) || isBlank(s)) return DAX_BLANK;
      const hour = Math.trunc(daxToNumber(h, true));
      const min = Math.trunc(daxToNumber(m, true));
      const sec = Math.trunc(daxToNumber(s, true));

      const totalSec = hour * 3600 + min * 60 + sec;
      const normalizedSec = ((totalSec % 86400) + 86400) % 86400;

      const finalH = Math.floor(normalizedSec / 3600);
      const finalM = Math.floor((normalizedSec % 3600) / 60);
      const finalS = normalizedSec % 60;

      return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}:${String(finalS).padStart(2, '0')}`;
    },
  },

  TIMEVALUE: {
    name: 'TIMEVALUE',
    category: 'Data',
    syntax: 'TIMEVALUE(time_text)',
    description: 'Converte um horário em formato de texto para a fração decimal do dia correspondente.',
    example: 'TIMEVALUE("12:00:00")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      if (isBlank(val)) return DAX_BLANK;
      const str = daxToString(val).trim();
      const match = str.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
      if (!match) throw new DaxError('Type', `TIMEVALUE: formato de hora inválido "${str}"`);
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const s = match[3] ? parseInt(match[3], 10) : 0;
      const totalSec = h * 3600 + m * 60 + s;
      return totalSec / 86400;
    },
  },

  DAY: {
    name: 'DAY',
    category: 'Data',
    syntax: 'DAY(date)',
    description: 'Retorna o dia do mês (um número de 1 a 31).',
    example: 'DAY("2024-02-29")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      const d = parseDateArg(val);
      return d ? d.getUTCDate() : DAX_BLANK;
    },
  },

  MONTH: {
    name: 'MONTH',
    category: 'Data',
    syntax: 'MONTH(date)',
    description: 'Retorna o mês como um número de 1 (janeiro) a 12 (dezembro).',
    example: 'MONTH("2024-02-29")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      const d = parseDateArg(val);
      return d ? d.getUTCMonth() + 1 : DAX_BLANK;
    },
  },

  YEAR: {
    name: 'YEAR',
    category: 'Data',
    syntax: 'YEAR(date)',
    description: 'Retorna o ano de uma data como um inteiro de 4 dígitos.',
    example: 'YEAR("2024-02-29")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      const d = parseDateArg(val);
      return d ? d.getUTCFullYear() : DAX_BLANK;
    },
  },

  QUARTER: {
    name: 'QUARTER',
    category: 'Data',
    syntax: 'QUARTER(date)',
    description: 'Retorna o trimestre da data como um número de 1 a 4.',
    example: 'QUARTER("2024-02-29")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      const d = parseDateArg(val);
      return d ? Math.floor(d.getUTCMonth() / 3) + 1 : DAX_BLANK;
    },
  },

  HOUR: {
    name: 'HOUR',
    category: 'Data',
    syntax: 'HOUR(datetime)',
    description: 'Retorna a hora como um número de 0 (meia-noite) a 23.',
    example: 'HOUR("2024-01-01 14:30:00")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      const d = parseDateArg(val);
      return d ? d.getUTCHours() : DAX_BLANK;
    },
  },

  MINUTE: {
    name: 'MINUTE',
    category: 'Data',
    syntax: 'MINUTE(datetime)',
    description: 'Retorna o minuto como um número de 0 a 59.',
    example: 'MINUTE("2024-01-01 14:30:00")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      const d = parseDateArg(val);
      return d ? d.getUTCMinutes() : DAX_BLANK;
    },
  },

  SECOND: {
    name: 'SECOND',
    category: 'Data',
    syntax: 'SECOND(datetime)',
    description: 'Retorna o segundo como um número de 0 a 59.',
    example: 'SECOND("2024-01-01 14:30:45")',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([val]) => {
      const d = parseDateArg(val);
      return d ? d.getUTCSeconds() : DAX_BLANK;
    },
  },

  WEEKDAY: {
    name: 'WEEKDAY',
    category: 'Data',
    syntax: 'WEEKDAY(date, [return_type])',
    description: 'Retorna o dia da semana como número de acordo com return_type (1, 2, 3, 11-17).',
    example: 'WEEKDAY("2024-02-29", 1)',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([val, returnType]) => {
      const d = parseDateArg(val);
      if (!d) return DAX_BLANK;
      const type = returnType !== undefined && !isBlank(returnType) ? Math.trunc(daxToNumber(returnType, true)) : 1;
      const w = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

      switch (type) {
        case 1:
        case 17:
          return w + 1; // 1 = Sun .. 7 = Sat
        case 2:
        case 11:
          return w === 0 ? 7 : w; // 1 = Mon .. 7 = Sun
        case 3:
          return w === 0 ? 6 : w - 1; // 0 = Mon .. 6 = Sun
        case 12:
          return ((w + 5) % 7) + 1; // 1 = Tue .. 7 = Mon
        case 13:
          return ((w + 4) % 7) + 1; // 1 = Wed .. 7 = Tue
        case 14:
          return ((w + 3) % 7) + 1; // 1 = Thu .. 7 = Wed
        case 15:
          return ((w + 2) % 7) + 1; // 1 = Fri .. 7 = Thu
        case 16:
          return ((w + 1) % 7) + 1; // 1 = Sat .. 7 = Fri
        default:
          throw new DaxError('Execution', `WEEKDAY: tipo de retorno inválido (${type}). Use 1, 2, 3 ou 11-17.`);
      }
    },
  },

  WEEKNUM: {
    name: 'WEEKNUM',
    category: 'Data',
    syntax: 'WEEKNUM(date, [return_type])',
    description: 'Retorna o número da semana no ano de acordo com return_type (1, 2, 11-17, 21).',
    example: 'WEEKNUM("2024-02-29", 2)',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([val, returnType]) => {
      const d = parseDateArg(val);
      if (!d) return DAX_BLANK;
      const type = returnType !== undefined && !isBlank(returnType) ? Math.trunc(daxToNumber(returnType, true)) : 1;

      if (type === 21) {
        return getIsoWeek(d);
      }

      const weekStartMap: Record<number, number> = {
        1: 0, // Sunday
        2: 1, // Monday
        11: 1, // Monday
        12: 2, // Tuesday
        13: 3, // Wednesday
        14: 4, // Thursday
        15: 5, // Friday
        16: 6, // Saturday
        17: 0, // Sunday
      };

      if (!(type in weekStartMap)) {
        throw new DaxError('Execution', `WEEKNUM: tipo de retorno inválido (${type}). Use 1, 2, 11-17 ou 21.`);
      }

      return getSystem1Week(d, weekStartMap[type]);
    },
  },

  YEARFRAC: {
    name: 'YEARFRAC',
    category: 'Data',
    syntax: 'YEARFRAC(start_date, end_date, [basis])',
    description: 'Calcula a fração do ano representada pelo número de dias entre duas datas (bases 0 a 4).',
    example: 'YEARFRAC("2024-01-01", "2024-07-01", 1)',
    minArgs: 2,
    maxArgs: 3,
    evaluate: ([d1, d2, basis]) => {
      const date1 = parseDateArg(d1);
      const date2 = parseDateArg(d2);
      if (!date1 || !date2) return DAX_BLANK;
      const b = basis !== undefined && !isBlank(basis) ? Math.trunc(daxToNumber(basis, true)) : 0;
      return calcYearFrac(date1, date2, b);
    },
  },

  DATEDIFF: {
    name: 'DATEDIFF',
    category: 'Data',
    syntax: 'DATEDIFF(date1, date2, interval)',
    description: 'Retorna a contagem de limites de intervalo ultrapassados entre duas datas.',
    example: 'DATEDIFF("2024-01-01", "2024-03-01", "month")',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([d1, d2, interval]) => {
      const date1 = parseDateArg(d1);
      const date2 = parseDateArg(d2);
      if (!date1 || !date2) return DAX_BLANK;

      const unit = daxToString(interval).toLowerCase().trim();
      const diffMs = date2.getTime() - date1.getTime();

      if (unit.startsWith('year') || unit.startsWith('ano')) {
        return date2.getUTCFullYear() - date1.getUTCFullYear();
      }
      if (unit.startsWith('quarter') || unit.startsWith('trimestre')) {
        const q1 = date1.getUTCFullYear() * 4 + Math.floor(date1.getUTCMonth() / 3);
        const q2 = date2.getUTCFullYear() * 4 + Math.floor(date2.getUTCMonth() / 3);
        return q2 - q1;
      }
      if (unit.startsWith('month') || unit.startsWith('mes') || unit.startsWith('mês')) {
        return (date2.getUTCFullYear() - date1.getUTCFullYear()) * 12 + (date2.getUTCMonth() - date1.getUTCMonth());
      }
      if (unit.startsWith('week') || unit.startsWith('semana')) {
        return Math.trunc(diffMs / (7 * 86400000));
      }
      if (unit.startsWith('day') || unit.startsWith('dia')) {
        return Math.trunc(diffMs / 86400000);
      }
      if (unit.startsWith('hour') || unit.startsWith('hora')) {
        return Math.trunc(diffMs / 3600000);
      }
      if (unit.startsWith('minute') || unit.startsWith('minuto')) {
        return Math.trunc(diffMs / 60000);
      }
      if (unit.startsWith('second') || unit.startsWith('segundo')) {
        return Math.trunc(diffMs / 1000);
      }

      throw new DaxError('Execution', `DATEDIFF: intervalo desconhecido "${interval}"`);
    },
  },

  EDATE: {
    name: 'EDATE',
    category: 'Data',
    syntax: 'EDATE(start_date, months)',
    description: 'Retorna a data que corresponde ao número de meses antes ou depois da data inicial.',
    example: 'EDATE("2024-01-31", 1)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([startVal, monthsVal]) => {
      const d = parseDateArg(startVal);
      if (!d) return DAX_BLANK;
      const months = Math.trunc(daxToNumber(monthsVal, true));

      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const day = d.getUTCDate();

      const targetDate = new Date(Date.UTC(y, m + months, 1));
      const targetYear = targetDate.getUTCFullYear();
      const targetMonth = targetDate.getUTCMonth();
      const maxDays = daysInMonth(targetYear, targetMonth);

      const finalDay = Math.min(day, maxDays);
      const res = new Date(Date.UTC(targetYear, targetMonth, finalDay));
      return formatDateISO(res);
    },
  },

  EOMONTH: {
    name: 'EOMONTH',
    category: 'Data',
    syntax: 'EOMONTH(start_date, months)',
    description: 'Retorna a data do último dia do mês antes ou depois de um número especificado de meses.',
    example: 'EOMONTH("2024-01-31", 1)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([startVal, monthsVal]) => {
      const d = parseDateArg(startVal);
      if (!d) return DAX_BLANK;
      const months = Math.trunc(daxToNumber(monthsVal, true));

      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();

      // Last day of month is 0th day of next month
      const res = new Date(Date.UTC(y, m + months + 1, 0));
      return formatDateISO(res);
    },
  },

  NETWORKDAYS: {
    name: 'NETWORKDAYS',
    category: 'Data',
    syntax: 'NETWORKDAYS(start_date, end_date, [weekend], [holidays])',
    description: 'Retorna o número de dias úteis inteiros entre start_date e end_date.',
    example: 'NETWORKDAYS("2024-01-01", "2024-01-10")',
    minArgs: 2,
    maxArgs: 4,
    evaluate: ([startVal, endVal, weekendArg, holidaysArg]) => {
      const start = parseDateArg(startVal);
      const end = parseDateArg(endVal);
      if (!start || !end) return DAX_BLANK;

      const isReversed = start.getTime() > end.getTime();
      let d1 = isReversed ? end : start;
      const d2 = isReversed ? start : end;

      // Weekend mask: array of 7 booleans (0=Sun, 1=Mon, ..., 6=Sat)
      const isWeekendDay = [true, false, false, false, false, false, true]; // Default: Sat & Sun
      if (weekendArg !== undefined && !isBlank(weekendArg)) {
        if (typeof weekendArg === 'string' && weekendArg.length === 7) {
          // 7-char mask starting Monday: "0000011"
          for (let i = 0; i < 7; i++) {
            const dayOfWeek = (i + 1) % 7; // Mon=1 .. Sun=0
            isWeekendDay[dayOfWeek] = weekendArg[i] === '1';
          }
        } else {
          const wNum = Math.trunc(daxToNumber(weekendArg, true));
          if (wNum === 1) {
            isWeekendDay[0] = true; isWeekendDay[6] = true;
          } else if (wNum === 2) {
            isWeekendDay[0] = true; isWeekendDay[1] = true; // Sun, Mon
          } else if (wNum === 11) {
            isWeekendDay[0] = true; // Sun only
          }
        }
      }

      // Holidays set
      const holidayTimestamps = new Set<string>();
      if (holidaysArg) {
        const list = Array.isArray(holidaysArg) ? holidaysArg : [holidaysArg];
        list.forEach(h => {
          const hd = parseDateArg(h);
          if (hd) holidayTimestamps.add(formatDateISO(hd));
        });
      }

      let count = 0;
      const cur = new Date(Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate()));
      const endMs = Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate());

      while (cur.getTime() <= endMs) {
        const dayOfWeek = cur.getUTCDay();
        const iso = formatDateISO(cur);
        if (!isWeekendDay[dayOfWeek] && !holidayTimestamps.has(iso)) {
          count++;
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      return isReversed ? -count : count;
    },
  },

  // Volatiles
  NOW: {
    name: 'NOW',
    aliases: ['AGORA'],
    category: 'Data',
    syntax: 'NOW()',
    description: 'Retorna a data e hora atuais (função volátil).',
    example: 'NOW()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: () => new Date().toISOString(),
  },

  TODAY: {
    name: 'TODAY',
    aliases: ['HOJE'],
    category: 'Data',
    syntax: 'TODAY()',
    description: 'Retorna a data atual no formato YYYY-MM-DD (função volátil).',
    example: 'TODAY()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: () => formatDateISO(new Date()),
  },

  UTCNOW: {
    name: 'UTCNOW',
    category: 'Data',
    syntax: 'UTCNOW()',
    description: 'Retorna a data e hora atuais em fuso horário UTC (função volátil).',
    example: 'UTCNOW()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: () => new Date().toISOString(),
  },

  UTCTODAY: {
    name: 'UTCTODAY',
    category: 'Data',
    syntax: 'UTCTODAY()',
    description: 'Retorna a data atual em UTC no formato YYYY-MM-DD (função volátil).',
    example: 'UTCTODAY()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: () => formatDateISO(new Date()),
  },
};
