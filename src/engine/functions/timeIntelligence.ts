import { FunctionDefinition } from '../expr/registry';
import { DaxError } from '../shared/errors';
import {
  DAX_BLANK,
  isBlank,
  daxToNumber,
  daxToString,
  daxCompare,
  DaxTableValue,
  isDaxTable,
} from '../expr/types';
import { parseDate } from '../shared/valueParser';
import { ModelAccess } from '../model/modelAccess';
import { FilterContext } from '../model/filterContext';

/**
 * Universal Year-End Date Parser
 * Supports: "06-30", "6/30", "30/06", "30-06", "12-31", etc.
 */
export function parseYearEndDate(str?: any): { month: number; day: number } {
  if (!str || isBlank(str)) {
    return { month: 12, day: 31 };
  }
  const s = String(str).trim();
  const parts = s.split(/[\/\-\.]/);
  if (parts.length >= 2) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    if (!isNaN(p1) && !isNaN(p2)) {
      if (p1 > 12) {
        // DD-MM
        return { month: p2, day: p1 };
      } else if (p2 > 12) {
        // MM-DD
        return { month: p1, day: p2 };
      } else {
        // Both <= 12, default to MM-DD (Power BI standard)
        return { month: p1, day: p2 };
      }
    }
  }
  return { month: 12, day: 31 };
}

/**
 * ISO Date String Formatter (YYYY-MM-DD)
 */
export function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parses any date input into a pure UTC Date
 */
export function parseUtcDate(val: any): Date | null {
  if (val === null || val === undefined || isBlank(val)) return null;
  if (isDaxTable(val) && val.rows.length > 0) {
    const col = val.columns[0];
    return parseUtcDate(val.rows[0][col]);
  }
  if (Array.isArray(val) && val.length > 0) {
    return parseUtcDate(val[0]);
  }
  const res = parseDate(val);
  return res.date || null;
}

/**
 * Days in a specific month
 */
export function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
}

/**
 * Shifts a UTC date by N intervals respecting end-of-month leap year rules:
 * E.g.: Feb 29 2024 shifted by -1 YEAR gives Feb 28 2023.
 */
export function shiftDate(
  d: Date,
  n: number,
  interval: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR' | 'WEEK'
): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();

  switch (interval) {
    case 'DAY':
      return new Date(Date.UTC(y, m, day + n));

    case 'WEEK':
      return new Date(Date.UTC(y, m, day + n * 7));

    case 'MONTH':
    case 'QUARTER':
    case 'YEAR': {
      const monthMultiplier = interval === 'YEAR' ? 12 : interval === 'QUARTER' ? 3 : 1;
      const totalMonthShift = n * monthMultiplier;
      const targetMonth = m + totalMonthShift;
      const targetYear = y + Math.floor(targetMonth / 12);
      const normMonth = ((targetMonth % 12) + 12) % 12;

      const daysInOldMonth = getDaysInMonth(y, m);
      const daysInNewMonth = getDaysInMonth(targetYear, normMonth);
      const isEndOfMonth = day === daysInOldMonth;

      const newDay = isEndOfMonth ? daysInNewMonth : Math.min(day, daysInNewMonth);
      return new Date(Date.UTC(targetYear, normMonth, newDay));
    }
  }
}

/**
 * Resolves date column metadata and retrieves both context-filtered and all dates from the table
 */
export function resolveDateColumn(
  dateArg: any,
  context: any
): {
  table: any;
  columnName: string;
  visibleDates: string[];
  allDates: string[];
  minVisibleDate: Date | null;
  maxVisibleDate: Date | null;
} {
  const model: ModelAccess | undefined = context?.model;
  let tableName = '';
  let columnName = '';

  if (typeof dateArg === 'string') {
    const match = dateArg.match(/^(?:'?([^'\[]+)'?\[)?([^\]]+)\]?$/);
    if (match) {
      tableName = match[1] || '';
      columnName = match[2];
    } else {
      columnName = dateArg;
    }
  } else if (dateArg && typeof dateArg === 'object') {
    if (dateArg.table || dateArg.column) {
      tableName = dateArg.table || '';
      columnName = dateArg.column || '';
    } else if (isDaxTable(dateArg)) {
      columnName = dateArg.columns[0] || 'Date';
      tableName = dateArg.tableName || dateArg.tableId || '';
    }
  }

  let table = tableName && model ? model.getTable(tableName) : undefined;
  if (!table && model) {
    // 1. Look for marked calendar table
    const calTable = model.getTables().find(t => t.isCalendar);
    if (calTable) {
      table = calTable;
      if (!columnName) {
        columnName = calTable.calendarDateColumn || calTable.columns.find(c => c.dataType === 'date')?.name || calTable.columns[0].name;
      }
    } else {
      // 2. Search tables for matching column
      for (const t of model.getTables()) {
        if (t.columns.some(c => c.name.toLowerCase() === columnName.toLowerCase())) {
          table = t;
          break;
        }
      }
    }
  }

  if (!table) {
    throw new DaxError(
      'Semantic',
      `Tabela ou coluna de datas "${columnName || dateArg}" não foi encontrada no modelo.`
    );
  }

  if (!columnName) {
    columnName = table.calendarDateColumn || table.columns.find(c => c.dataType === 'date')?.name || table.columns[0].name;
  }

  // Get all dates in table
  const allDateSet = new Set<string>();
  (table.rows || []).forEach(r => {
    const p = parseDate(r[columnName]);
    if (p.iso) allDateSet.add(p.iso);
  });
  const allDates = Array.from(allDateSet).sort();

  // Get visible dates under current FilterContext
  const filterContext: FilterContext | undefined = context?.filterContext;
  let visibleRows = table.rows || [];
  if (filterContext) {
    visibleRows = filterContext.getFilteredRows(table.id, model || undefined);
  }

  const visibleDateSet = new Set<string>();
  visibleRows.forEach(r => {
    const p = parseDate(r[columnName]);
    if (p.iso) visibleDateSet.add(p.iso);
  });

  let visibleDates = Array.from(visibleDateSet).sort();
  const hasTableFilters = filterContext ? filterContext.hasTableFilters(table.id) : false;
  if (visibleDates.length === 0 && !hasTableFilters) {
    // If no specific filters exist on the table in context, use full range
    visibleDates = [...allDates];
  }

  const minVisibleDate = visibleDates.length > 0 ? parseUtcDate(visibleDates[0]) : null;
  const maxVisibleDate = visibleDates.length > 0 ? parseUtcDate(visibleDates[visibleDates.length - 1]) : null;

  return {
    table,
    columnName,
    visibleDates,
    allDates,
    minVisibleDate,
    maxVisibleDate,
  };
}

/**
 * Creates a standard DaxTableValue for a list of ISO date strings with column lineage
 */
export function createDateTableValue(
  dates: string[],
  table: any,
  columnName: string
): DaxTableValue {
  const rows = dates.map(d => ({ [columnName]: d }));
  return {
    __isDaxTable: true,
    columns: [columnName],
    rows,
    tableId: table.id,
    tableName: table.name,
    lineage: {
      [columnName]: {
        tableId: table.id,
        tableName: table.name,
        column: columnName,
      },
    },
  };
}

/**
 * Calculates start of fiscal year given a reference date and year_end_date
 */
export function getStartOfFiscalYear(
  refDate: Date,
  yearEnd: { month: number; day: number }
): Date {
  const y = refDate.getUTCFullYear();
  const m = refDate.getUTCMonth() + 1;
  const d = refDate.getUTCDate();

  if (yearEnd.month === 12 && yearEnd.day === 31) {
    return new Date(Date.UTC(y, 0, 1));
  }

  // Compare refDate with yearEnd in same calendar year
  const isBeforeOrOnYearEnd =
    m < yearEnd.month || (m === yearEnd.month && d <= yearEnd.day);

  if (isBeforeOrOnYearEnd) {
    // Fiscal year started day after yearEnd in PREVIOUS calendar year
    const prevYear = y - 1;
    const startMonth = yearEnd.month - 1;
    const startDay = yearEnd.day + 1;
    // Normalize if yearEnd was last day of month
    const startD = new Date(Date.UTC(prevYear, startMonth, startDay));
    return startD;
  } else {
    // Fiscal year started day after yearEnd in CURRENT calendar year
    const startMonth = yearEnd.month - 1;
    const startDay = yearEnd.day + 1;
    const startD = new Date(Date.UTC(y, startMonth, startDay));
    return startD;
  }
}

export const TIME_INTELLIGENCE_FUNCTIONS: Record<string, FunctionDefinition> = {
  // ==========================================
  // CALENDAR & CALENDARAUTO
  // ==========================================
  CALENDAR: {
    name: 'CALENDAR',
    category: 'Inteligência de Tempo',
    syntax: 'CALENDAR(start_date, end_date)',
    description: 'Retorna uma tabela com uma única coluna denominada "Date" que contém um conjunto contínuo de datas.',
    example: 'CALENDAR(DATE(2023, 1, 1), DATE(2024, 12, 31))',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([startVal, endVal]) => {
      const sDate = parseUtcDate(startVal);
      const eDate = parseUtcDate(endVal);
      if (!sDate || !eDate) {
        throw new DaxError('Execution', 'Argumentos de data inválidos fornecidos para CALENDAR.');
      }
      if (sDate.getTime() > eDate.getTime()) {
        throw new DaxError('Execution', 'A data inicial não pode ser maior que a data final em CALENDAR.');
      }

      const rows: Record<string, any>[] = [];
      const cur = new Date(sDate.getTime());
      while (cur.getTime() <= eDate.getTime()) {
        rows.push({ Date: toIsoDate(cur) });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      return {
        __isDaxTable: true,
        columns: ['Date'],
        rows,
      };
    },
  },

  CALENDARAUTO: {
    name: 'CALENDARAUTO',
    category: 'Inteligência de Tempo',
    syntax: 'CALENDARAUTO([fiscal_year_end_month])',
    description: 'Retorna uma tabela com uma coluna "Date" cobrindo o intervalo completo de anos presentes nas datas do modelo.',
    example: 'CALENDARAUTO(12)',
    minArgs: 0,
    maxArgs: 1,
    evaluate: ([fiscalEndVal], context) => {
      const model: ModelAccess | undefined = context?.model;
      const fiscalEndMonth = fiscalEndVal !== undefined ? Math.max(1, Math.min(12, Math.trunc(daxToNumber(fiscalEndVal)))) : 12;

      let minYear = 9999;
      let maxYear = 1900;
      let foundDate = false;

      if (model) {
        for (const t of model.getTables()) {
          if (t.isCalendar) continue; // skip date table itself
          for (const c of t.columns) {
            if (c.dataType === 'date' || ['data', 'date'].includes(c.name.toLowerCase())) {
              for (const r of t.rows || []) {
                const parsed = parseDate(r[c.name]);
                if (parsed.date) {
                  const y = parsed.date.getUTCFullYear();
                  if (y >= 1900 && y <= 2100) {
                    minYear = Math.min(minYear, y);
                    maxYear = Math.max(maxYear, y);
                    foundDate = true;
                  }
                }
              }
            }
          }
        }
      }

      if (!foundDate) {
        minYear = new Date().getUTCFullYear();
        maxYear = minYear;
      }

      const startD = new Date(Date.UTC(minYear, fiscalEndMonth % 12, 1));
      const endD = new Date(Date.UTC(maxYear, fiscalEndMonth, 0));

      const rows: Record<string, any>[] = [];
      const cur = new Date(startD.getTime());
      while (cur.getTime() <= endD.getTime()) {
        rows.push({ Date: toIsoDate(cur) });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      return {
        __isDaxTable: true,
        columns: ['Date'],
        rows,
      };
    },
  },

  // ==========================================
  // Period-to-Date Table Functions
  // ==========================================
  DATESYTD: {
    name: 'DATESYTD',
    category: 'Inteligência de Tempo',
    syntax: 'DATESYTD(dates, [year_end_date])',
    description: 'Retorna uma tabela que contém uma coluna de todas as datas no acumulado do ano (Year-To-Date) no contexto atual.',
    example: 'CALCULATE([Total], DATESYTD(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([dateArg, yearEndArg], context) => {
      const { table, columnName, allDates, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);

      const yearEnd = parseYearEndDate(yearEndArg);
      const startOfFY = getStartOfFiscalYear(maxVisibleDate, yearEnd);
      const startIso = toIsoDate(startOfFY);
      const maxIso = toIsoDate(maxVisibleDate);

      const resultDates = allDates.filter(d => d >= startIso && d <= maxIso);
      return createDateTableValue(resultDates, table, columnName);
    },
  },

  DATESQTD: {
    name: 'DATESQTD',
    category: 'Inteligência de Tempo',
    syntax: 'DATESQTD(dates)',
    description: 'Retorna uma tabela que contém uma coluna de todas as datas no acumulado do trimestre (Quarter-To-Date).',
    example: 'CALCULATE([Total], DATESQTD(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, allDates, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);

      const y = maxVisibleDate.getUTCFullYear();
      const m = maxVisibleDate.getUTCMonth();
      const qStartMonth = Math.floor(m / 3) * 3;
      const startQ = new Date(Date.UTC(y, qStartMonth, 1));
      const startIso = toIsoDate(startQ);
      const maxIso = toIsoDate(maxVisibleDate);

      const resultDates = allDates.filter(d => d >= startIso && d <= maxIso);
      return createDateTableValue(resultDates, table, columnName);
    },
  },

  DATESMTD: {
    name: 'DATESMTD',
    category: 'Inteligência de Tempo',
    syntax: 'DATESMTD(dates)',
    description: 'Retorna uma tabela que contém uma coluna de todas as datas no acumulado do mês (Month-To-Date).',
    example: 'CALCULATE([Total], DATESMTD(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, allDates, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);

      const y = maxVisibleDate.getUTCFullYear();
      const m = maxVisibleDate.getUTCMonth();
      const startM = new Date(Date.UTC(y, m, 1));
      const startIso = toIsoDate(startM);
      const maxIso = toIsoDate(maxVisibleDate);

      const resultDates = allDates.filter(d => d >= startIso && d <= maxIso);
      return createDateTableValue(resultDates, table, columnName);
    },
  },

  DATESWTD: {
    name: 'DATESWTD',
    category: 'Inteligência de Tempo',
    syntax: 'DATESWTD(dates)',
    description: 'Retorna uma tabela que contém uma coluna de todas as datas no acumulado da semana (Week-To-Date).',
    example: 'CALCULATE([Total], DATESWTD(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, allDates, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);

      const dayOfWeek = maxVisibleDate.getUTCDay(); // 0 is Sunday
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startW = new Date(Date.UTC(maxVisibleDate.getUTCFullYear(), maxVisibleDate.getUTCMonth(), maxVisibleDate.getUTCDate() - diffToMonday));
      const startIso = toIsoDate(startW);
      const maxIso = toIsoDate(maxVisibleDate);

      const resultDates = allDates.filter(d => d >= startIso && d <= maxIso);
      return createDateTableValue(resultDates, table, columnName);
    },
  },

  // ==========================================
  // Shifting & Comparison Functions
  // ==========================================
  DATEADD: {
    name: 'DATEADD',
    category: 'Inteligência de Tempo',
    syntax: 'DATEADD(dates, number_of_intervals, interval)',
    description: 'Desloca o conjunto de datas no contexto atual pelo número de intervalos especificado (YEAR, QUARTER, MONTH, DAY).',
    example: 'CALCULATE([Total], DATEADD(d_Calendario[Data], -1, YEAR))',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([dateArg, numArg, intervalArg], context) => {
      const { table, columnName, visibleDates, allDates } = resolveDateColumn(dateArg, context);
      const n = Math.trunc(daxToNumber(numArg, true));
      const intervalStr = String(intervalArg).trim().toUpperCase();
      let interval: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR' = 'MONTH';
      if (intervalStr === 'YEAR' || intervalStr === 'ANO') interval = 'YEAR';
      else if (intervalStr === 'QUARTER' || intervalStr === 'TRIMESTRE') interval = 'QUARTER';
      else if (intervalStr === 'DAY' || intervalStr === 'DIA') interval = 'DAY';

      const allDateSet = new Set(allDates);
      const shiftedSet = new Set<string>();

      for (const iso of visibleDates) {
        const d = parseUtcDate(iso);
        if (d) {
          const shifted = shiftDate(d, n, interval);
          const sIso = toIsoDate(shifted);
          if (allDateSet.has(sIso)) {
            shiftedSet.add(sIso);
          }
        }
      }

      const res = Array.from(shiftedSet).sort();
      return createDateTableValue(res, table, columnName);
    },
  },

  SAMEPERIODLASTYEAR: {
    name: 'SAMEPERIODLASTYEAR',
    category: 'Inteligência de Tempo',
    syntax: 'SAMEPERIODLASTYEAR(dates)',
    description: 'Retorna um conjunto de datas no mesmo período do ano anterior (deslocamento exato de -1 ano com respeito a fim de mês).',
    example: 'CALCULATE([Total], SAMEPERIODLASTYEAR(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      return TIME_INTELLIGENCE_FUNCTIONS.DATEADD.evaluate!([dateArg, -1, 'YEAR'], context);
    },
  },

  PARALLELPERIOD: {
    name: 'PARALLELPERIOD',
    category: 'Inteligência de Tempo',
    syntax: 'PARALLELPERIOD(dates, number_of_intervals, interval)',
    description: 'Retorna uma tabela que representa um período paralelo às datas da coluna no contexto atual (YEAR, QUARTER, MONTH).',
    example: 'CALCULATE([Total], PARALLELPERIOD(d_Calendario[Data], -1, MONTH))',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([dateArg, numArg, intervalArg], context) => {
      const { table, columnName, allDates, minVisibleDate, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!minVisibleDate || !maxVisibleDate) return createDateTableValue([], table, columnName);

      const n = Math.trunc(daxToNumber(numArg, true));
      const intervalStr = String(intervalArg).trim().toUpperCase();
      let interval: 'MONTH' | 'QUARTER' | 'YEAR' = 'MONTH';
      if (intervalStr === 'YEAR' || intervalStr === 'ANO') interval = 'YEAR';
      else if (intervalStr === 'QUARTER' || intervalStr === 'TRIMESTRE') interval = 'QUARTER';

      const shiftedMin = shiftDate(minVisibleDate, n, interval);
      const shiftedMax = shiftDate(maxVisibleDate, n, interval);

      let startD: Date;
      let endD: Date;

      if (interval === 'YEAR') {
        startD = new Date(Date.UTC(shiftedMin.getUTCFullYear(), 0, 1));
        endD = new Date(Date.UTC(shiftedMax.getUTCFullYear(), 11, 31));
      } else if (interval === 'QUARTER') {
        const qStartM = Math.floor(shiftedMin.getUTCMonth() / 3) * 3;
        startD = new Date(Date.UTC(shiftedMin.getUTCFullYear(), qStartM, 1));
        const qEndM = Math.floor(shiftedMax.getUTCMonth() / 3) * 3 + 2;
        endD = new Date(Date.UTC(shiftedMax.getUTCFullYear(), qEndM + 1, 0));
      } else {
        startD = new Date(Date.UTC(shiftedMin.getUTCFullYear(), shiftedMin.getUTCMonth(), 1));
        endD = new Date(Date.UTC(shiftedMax.getUTCFullYear(), shiftedMax.getUTCMonth() + 1, 0));
      }

      const startIso = toIsoDate(startD);
      const endIso = toIsoDate(endD);
      const res = allDates.filter(d => d >= startIso && d <= endIso);
      return createDateTableValue(res, table, columnName);
    },
  },

  // ==========================================
  // Periods: PREVIOUS & NEXT
  // ==========================================
  PREVIOUSDAY: {
    name: 'PREVIOUSDAY',
    category: 'Inteligência de Tempo',
    syntax: 'PREVIOUSDAY(dates)',
    description: 'Retorna uma tabela com o dia anterior ao primeiro dia presente no contexto atual.',
    example: 'CALCULATE([Total], PREVIOUSDAY(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, allDates, minVisibleDate } = resolveDateColumn(dateArg, context);
      if (!minVisibleDate) return createDateTableValue([], table, columnName);
      const prevD = shiftDate(minVisibleDate, -1, 'DAY');
      const iso = toIsoDate(prevD);
      const res = allDates.includes(iso) ? [iso] : [];
      return createDateTableValue(res, table, columnName);
    },
  },

  PREVIOUSWEEK: {
    name: 'PREVIOUSWEEK',
    category: 'Inteligência de Tempo',
    syntax: 'PREVIOUSWEEK(dates)',
    description: 'Retorna todas as datas da semana anterior à primeira data do contexto.',
    example: 'CALCULATE([Total], PREVIOUSWEEK(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, allDates, minVisibleDate } = resolveDateColumn(dateArg, context);
      if (!minVisibleDate) return createDateTableValue([], table, columnName);
      const prevWeekDate = shiftDate(minVisibleDate, -1, 'WEEK');
      const dayOfWeek = prevWeekDate.getUTCDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startW = new Date(Date.UTC(prevWeekDate.getUTCFullYear(), prevWeekDate.getUTCMonth(), prevWeekDate.getUTCDate() - diffToMonday));
      const endW = new Date(Date.UTC(startW.getUTCFullYear(), startW.getUTCMonth(), startW.getUTCDate() + 6));
      const sIso = toIsoDate(startW);
      const eIso = toIsoDate(endW);
      const res = allDates.filter(d => d >= sIso && d <= eIso);
      return createDateTableValue(res, table, columnName);
    },
  },

  PREVIOUSMONTH: {
    name: 'PREVIOUSMONTH',
    category: 'Inteligência de Tempo',
    syntax: 'PREVIOUSMONTH(dates)',
    description: 'Retorna todas as datas do mês anterior ao primeiro dia do contexto atual.',
    example: 'CALCULATE([Total], PREVIOUSMONTH(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, allDates, minVisibleDate } = resolveDateColumn(dateArg, context);
      if (!minVisibleDate) return createDateTableValue([], table, columnName);
      const prevMonthD = shiftDate(minVisibleDate, -1, 'MONTH');
      const y = prevMonthD.getUTCFullYear();
      const m = prevMonthD.getUTCMonth();
      const startM = new Date(Date.UTC(y, m, 1));
      const endM = new Date(Date.UTC(y, m + 1, 0));
      const sIso = toIsoDate(startM);
      const eIso = toIsoDate(endM);
      const res = allDates.filter(d => d >= sIso && d <= eIso);
      return createDateTableValue(res, table, columnName);
    },
  },

  PREVIOUSQUARTER: {
    name: 'PREVIOUSQUARTER',
    category: 'Inteligência de Tempo',
    syntax: 'PREVIOUSQUARTER(dates)',
    description: 'Retorna todas as datas do trimestre anterior ao primeiro dia do contexto atual.',
    example: 'CALCULATE([Total], PREVIOUSQUARTER(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, allDates, minVisibleDate } = resolveDateColumn(dateArg, context);
      if (!minVisibleDate) return createDateTableValue([], table, columnName);
      const prevQDate = shiftDate(minVisibleDate, -1, 'QUARTER');
      const y = prevQDate.getUTCFullYear();
      const qStartM = Math.floor(prevQDate.getUTCMonth() / 3) * 3;
      const startQ = new Date(Date.UTC(y, qStartM, 1));
      const endQ = new Date(Date.UTC(y, qStartM + 3, 0));
      const sIso = toIsoDate(startQ);
      const eIso = toIsoDate(endQ);
      const res = allDates.filter(d => d >= sIso && d <= eIso);
      return createDateTableValue(res, table, columnName);
    },
  },

  PREVIOUSYEAR: {
    name: 'PREVIOUSYEAR',
    category: 'Inteligência de Tempo',
    syntax: 'PREVIOUSYEAR(dates, [year_end_date])',
    description: 'Retorna todas as datas do ano anterior ao primeiro dia do contexto atual.',
    example: 'CALCULATE([Total], PREVIOUSYEAR(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([dateArg, yearEndArg], context) => {
      const { table, columnName, allDates, minVisibleDate } = resolveDateColumn(dateArg, context);
      if (!minVisibleDate) return createDateTableValue([], table, columnName);
      const yearEnd = parseYearEndDate(yearEndArg);
      const prevYDate = shiftDate(minVisibleDate, -1, 'YEAR');
      const startFY = getStartOfFiscalYear(prevYDate, yearEnd);
      // End of fiscal year is 1 year after start minus 1 day
      const endFY = new Date(Date.UTC(startFY.getUTCFullYear() + 1, startFY.getUTCMonth(), startFY.getUTCDate() - 1));
      const sIso = toIsoDate(startFY);
      const eIso = toIsoDate(endFY);
      const res = allDates.filter(d => d >= sIso && d <= eIso);
      return createDateTableValue(res, table, columnName);
    },
  },

  NEXTDAY: {
    name: 'NEXTDAY',
    category: 'Inteligência de Tempo',
    syntax: 'NEXTDAY(dates)',
    description: 'Retorna uma tabela com o próximo dia após a última data do contexto atual.',
    example: 'CALCULATE([Total], NEXTDAY(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, allDates, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);
      const nextD = shiftDate(maxVisibleDate, 1, 'DAY');
      const iso = toIsoDate(nextD);
      const res = allDates.includes(iso) ? [iso] : [];
      return createDateTableValue(res, table, columnName);
    },
  },

  NEXTWEEK: {
    name: 'NEXTWEEK',
    category: 'Inteligência de Tempo',
    syntax: 'NEXTWEEK(dates)',
    description: 'Retorna todas as datas da próxima semana após a última data do contexto atual.',
    example: 'CALCULATE([Total], NEXTWEEK(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, allDates, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);
      const nextWeekDate = shiftDate(maxVisibleDate, 1, 'WEEK');
      const dayOfWeek = nextWeekDate.getUTCDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startW = new Date(Date.UTC(nextWeekDate.getUTCFullYear(), nextWeekDate.getUTCMonth(), nextWeekDate.getUTCDate() - diffToMonday));
      const endW = new Date(Date.UTC(startW.getUTCFullYear(), startW.getUTCMonth(), startW.getUTCDate() + 6));
      const sIso = toIsoDate(startW);
      const eIso = toIsoDate(endW);
      const res = allDates.filter(d => d >= sIso && d <= eIso);
      return createDateTableValue(res, table, columnName);
    },
  },

  NEXTMONTH: {
    name: 'NEXTMONTH',
    category: 'Inteligência de Tempo',
    syntax: 'NEXTMONTH(dates)',
    description: 'Retorna todas as datas do próximo mês após a última data do contexto atual.',
    example: 'CALCULATE([Total], NEXTMONTH(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, allDates, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);
      const nextMD = shiftDate(maxVisibleDate, 1, 'MONTH');
      const y = nextMD.getUTCFullYear();
      const m = nextMD.getUTCMonth();
      const startM = new Date(Date.UTC(y, m, 1));
      const endM = new Date(Date.UTC(y, m + 1, 0));
      const sIso = toIsoDate(startM);
      const eIso = toIsoDate(endM);
      const res = allDates.filter(d => d >= sIso && d <= eIso);
      return createDateTableValue(res, table, columnName);
    },
  },

  NEXTQUARTER: {
    name: 'NEXTQUARTER',
    category: 'Inteligência de Tempo',
    syntax: 'NEXTQUARTER(dates)',
    description: 'Retorna todas as datas do próximo trimestre após a última data do contexto atual.',
    example: 'CALCULATE([Total], NEXTQUARTER(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, allDates, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);
      const nextQD = shiftDate(maxVisibleDate, 1, 'QUARTER');
      const y = nextQD.getUTCFullYear();
      const qStartM = Math.floor(nextQD.getUTCMonth() / 3) * 3;
      const startQ = new Date(Date.UTC(y, qStartM, 1));
      const endQ = new Date(Date.UTC(y, qStartM + 3, 0));
      const sIso = toIsoDate(startQ);
      const eIso = toIsoDate(endQ);
      const res = allDates.filter(d => d >= sIso && d <= eIso);
      return createDateTableValue(res, table, columnName);
    },
  },

  NEXTYEAR: {
    name: 'NEXTYEAR',
    category: 'Inteligência de Tempo',
    syntax: 'NEXTYEAR(dates, [year_end_date])',
    description: 'Retorna todas as datas do próximo ano após a última data do contexto atual.',
    example: 'CALCULATE([Total], NEXTYEAR(d_Calendario[Data]))',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([dateArg, yearEndArg], context) => {
      const { table, columnName, allDates, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);
      const yearEnd = parseYearEndDate(yearEndArg);
      const nextYDate = shiftDate(maxVisibleDate, 1, 'YEAR');
      const startFY = getStartOfFiscalYear(nextYDate, yearEnd);
      const endFY = new Date(Date.UTC(startFY.getUTCFullYear() + 1, startFY.getUTCMonth(), startFY.getUTCDate() - 1));
      const sIso = toIsoDate(startFY);
      const eIso = toIsoDate(endFY);
      const res = allDates.filter(d => d >= sIso && d <= eIso);
      return createDateTableValue(res, table, columnName);
    },
  },

  // ==========================================
  // DATESBETWEEN & DATESINPERIOD
  // ==========================================
  DATESBETWEEN: {
    name: 'DATESBETWEEN',
    category: 'Inteligência de Tempo',
    syntax: 'DATESBETWEEN(dates, start_date, end_date)',
    description: 'Retorna uma tabela contendo uma coluna de datas que começa na start_date e continua até end_date.',
    example: 'CALCULATE([Total], DATESBETWEEN(d_Calendario[Data], DATE(2024, 1, 1), DATE(2024, 3, 31)))',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([dateArg, startVal, endVal], context) => {
      const { table, columnName, allDates } = resolveDateColumn(dateArg, context);
      const sDate = parseUtcDate(startVal);
      const eDate = parseUtcDate(endVal);

      const startIso = sDate ? toIsoDate(sDate) : (allDates[0] || '1900-01-01');
      const endIso = eDate ? toIsoDate(eDate) : (allDates[allDates.length - 1] || '2999-12-31');

      const res = allDates.filter(d => d >= startIso && d <= endIso);
      return createDateTableValue(res, table, columnName);
    },
  },

  DATESINPERIOD: {
    name: 'DATESINPERIOD',
    category: 'Inteligência de Tempo',
    syntax: 'DATESINPERIOD(dates, start_date, number_of_intervals, interval)',
    description: 'Retorna uma tabela contendo datas começando em start_date e avançando ou retrocedendo o número de intervalos especificado.',
    example: 'CALCULATE([Total], DATESINPERIOD(d_Calendario[Data], LASTDATE(d_Calendario[Data]), -3, MONTH))',
    minArgs: 4,
    maxArgs: 4,
    evaluate: ([dateArg, startVal, numArg, intervalArg], context) => {
      const { table, columnName, allDates, maxVisibleDate } = resolveDateColumn(dateArg, context);
      const sDate = parseUtcDate(startVal) || maxVisibleDate;
      if (!sDate) return createDateTableValue([], table, columnName);

      const n = Math.trunc(daxToNumber(numArg, true));
      const intervalStr = String(intervalArg).trim().toUpperCase();
      let interval: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR' = 'MONTH';
      if (intervalStr === 'YEAR' || intervalStr === 'ANO') interval = 'YEAR';
      else if (intervalStr === 'QUARTER' || intervalStr === 'TRIMESTRE') interval = 'QUARTER';
      else if (intervalStr === 'DAY' || intervalStr === 'DIA') interval = 'DAY';

      let startIso: string;
      let endIso: string;

      if (n >= 0) {
        startIso = toIsoDate(sDate);
        const shifted = shiftDate(sDate, n, interval);
        const endDayBefore = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - 1));
        endIso = toIsoDate(endDayBefore);
      } else {
        endIso = toIsoDate(sDate);
        const shifted = shiftDate(sDate, n, interval);
        const startDayAfter = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1));
        startIso = toIsoDate(startDayAfter);
      }

      const res = allDates.filter(d => d >= startIso && d <= endIso);
      return createDateTableValue(res, table, columnName);
    },
  },

  // ==========================================
  // Boundary Date Functions
  // ==========================================
  FIRSTDATE: {
    name: 'FIRSTDATE',
    category: 'Inteligência de Tempo',
    syntax: 'FIRSTDATE(dates)',
    description: 'Retorna a primeira data visível no contexto atual em uma tabela de uma única coluna.',
    example: 'FIRSTDATE(d_Calendario[Data])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, minVisibleDate } = resolveDateColumn(dateArg, context);
      if (!minVisibleDate) return createDateTableValue([], table, columnName);
      return createDateTableValue([toIsoDate(minVisibleDate)], table, columnName);
    },
  },

  LASTDATE: {
    name: 'LASTDATE',
    category: 'Inteligência de Tempo',
    syntax: 'LASTDATE(dates)',
    description: 'Retorna a última data visível no contexto atual em uma tabela de uma única coluna.',
    example: 'LASTDATE(d_Calendario[Data])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);
      return createDateTableValue([toIsoDate(maxVisibleDate)], table, columnName);
    },
  },

  STARTOFWEEK: {
    name: 'STARTOFWEEK',
    category: 'Inteligência de Tempo',
    syntax: 'STARTOFWEEK(dates)',
    description: 'Retorna uma tabela com a data inicial da semana correspondente ao contexto.',
    example: 'STARTOFWEEK(d_Calendario[Data])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, minVisibleDate } = resolveDateColumn(dateArg, context);
      if (!minVisibleDate) return createDateTableValue([], table, columnName);
      const dayOfWeek = minVisibleDate.getUTCDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startW = new Date(Date.UTC(minVisibleDate.getUTCFullYear(), minVisibleDate.getUTCMonth(), minVisibleDate.getUTCDate() - diffToMonday));
      return createDateTableValue([toIsoDate(startW)], table, columnName);
    },
  },

  STARTOFMONTH: {
    name: 'STARTOFMONTH',
    category: 'Inteligência de Tempo',
    syntax: 'STARTOFMONTH(dates)',
    description: 'Retorna uma tabela com o primeiro dia do mês correspondente ao contexto.',
    example: 'STARTOFMONTH(d_Calendario[Data])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, minVisibleDate } = resolveDateColumn(dateArg, context);
      if (!minVisibleDate) return createDateTableValue([], table, columnName);
      const startM = new Date(Date.UTC(minVisibleDate.getUTCFullYear(), minVisibleDate.getUTCMonth(), 1));
      return createDateTableValue([toIsoDate(startM)], table, columnName);
    },
  },

  STARTOFQUARTER: {
    name: 'STARTOFQUARTER',
    category: 'Inteligência de Tempo',
    syntax: 'STARTOFQUARTER(dates)',
    description: 'Retorna o primeiro dia do trimestre correspondente ao contexto.',
    example: 'STARTOFQUARTER(d_Calendario[Data])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, minVisibleDate } = resolveDateColumn(dateArg, context);
      if (!minVisibleDate) return createDateTableValue([], table, columnName);
      const qStartM = Math.floor(minVisibleDate.getUTCMonth() / 3) * 3;
      const startQ = new Date(Date.UTC(minVisibleDate.getUTCFullYear(), qStartM, 1));
      return createDateTableValue([toIsoDate(startQ)], table, columnName);
    },
  },

  STARTOFYEAR: {
    name: 'STARTOFYEAR',
    category: 'Inteligência de Tempo',
    syntax: 'STARTOFYEAR(dates, [year_end_date])',
    description: 'Retorna o primeiro dia do ano fiscal ou civil correspondente ao contexto.',
    example: 'STARTOFYEAR(d_Calendario[Data])',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([dateArg, yearEndArg], context) => {
      const { table, columnName, minVisibleDate } = resolveDateColumn(dateArg, context);
      if (!minVisibleDate) return createDateTableValue([], table, columnName);
      const yearEnd = parseYearEndDate(yearEndArg);
      const startFY = getStartOfFiscalYear(minVisibleDate, yearEnd);
      return createDateTableValue([toIsoDate(startFY)], table, columnName);
    },
  },

  ENDOFWEEK: {
    name: 'ENDOFWEEK',
    category: 'Inteligência de Tempo',
    syntax: 'ENDOFWEEK(dates)',
    description: 'Retorna o último dia da semana correspondente ao contexto.',
    example: 'ENDOFWEEK(d_Calendario[Data])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);
      const dayOfWeek = maxVisibleDate.getUTCDay();
      const diffToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const endW = new Date(Date.UTC(maxVisibleDate.getUTCFullYear(), maxVisibleDate.getUTCMonth(), maxVisibleDate.getUTCDate() + diffToSunday));
      return createDateTableValue([toIsoDate(endW)], table, columnName);
    },
  },

  ENDOFMONTH: {
    name: 'ENDOFMONTH',
    category: 'Inteligência de Tempo',
    syntax: 'ENDOFMONTH(dates)',
    description: 'Retorna uma tabela com o último dia do mês correspondente ao contexto.',
    example: 'ENDOFMONTH(d_Calendario[Data])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);
      const endM = new Date(Date.UTC(maxVisibleDate.getUTCFullYear(), maxVisibleDate.getUTCMonth() + 1, 0));
      return createDateTableValue([toIsoDate(endM)], table, columnName);
    },
  },

  ENDOFQUARTER: {
    name: 'ENDOFQUARTER',
    category: 'Inteligência de Tempo',
    syntax: 'ENDOFQUARTER(dates)',
    description: 'Retorna o último dia do trimestre correspondente ao contexto.',
    example: 'ENDOFQUARTER(d_Calendario[Data])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([dateArg], context) => {
      const { table, columnName, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);
      const qStartM = Math.floor(maxVisibleDate.getUTCMonth() / 3) * 3;
      const endQ = new Date(Date.UTC(maxVisibleDate.getUTCFullYear(), qStartM + 3, 0));
      return createDateTableValue([toIsoDate(endQ)], table, columnName);
    },
  },

  ENDOFYEAR: {
    name: 'ENDOFYEAR',
    category: 'Inteligência de Tempo',
    syntax: 'ENDOFYEAR(dates, [year_end_date])',
    description: 'Retorna o último dia do ano fiscal ou civil correspondente ao contexto.',
    example: 'ENDOFYEAR(d_Calendario[Data])',
    minArgs: 1,
    maxArgs: 2,
    evaluate: ([dateArg, yearEndArg], context) => {
      const { table, columnName, maxVisibleDate } = resolveDateColumn(dateArg, context);
      if (!maxVisibleDate) return createDateTableValue([], table, columnName);
      const yearEnd = parseYearEndDate(yearEndArg);
      const startFY = getStartOfFiscalYear(maxVisibleDate, yearEnd);
      const endFY = new Date(Date.UTC(startFY.getUTCFullYear() + 1, startFY.getUTCMonth(), startFY.getUTCDate() - 1));
      return createDateTableValue([toIsoDate(endFY)], table, columnName);
    },
  },

  // ==========================================
  // Non-blank boundary functions
  // ==========================================
  FIRSTNONBLANK: {
    name: 'FIRSTNONBLANK',
    category: 'Inteligência de Tempo',
    syntax: 'FIRSTNONBLANK(column, expression)',
    description: 'Retorna o primeiro valor da coluna para o qual a expressão não avalia como BLANK.',
    example: 'FIRSTNONBLANK(d_Calendario[Data], [Total Vendas])',
    minArgs: 2,
    maxArgs: 2,
  },

  LASTNONBLANK: {
    name: 'LASTNONBLANK',
    category: 'Inteligência de Tempo',
    syntax: 'LASTNONBLANK(column, expression)',
    description: 'Retorna o último valor da coluna para o qual a expressão não avalia como BLANK.',
    example: 'LASTNONBLANK(d_Calendario[Data], [Total Vendas])',
    minArgs: 2,
    maxArgs: 2,
  },

  FIRSTNONBLANKVALUE: {
    name: 'FIRSTNONBLANKVALUE',
    category: 'Inteligência de Tempo',
    syntax: 'FIRSTNONBLANKVALUE(column, expression)',
    description: 'Retorna o valor da expressão avaliada no primeiro valor não em branco da coluna.',
    example: 'FIRSTNONBLANKVALUE(d_Calendario[Data], [Total Vendas])',
    minArgs: 2,
    maxArgs: 2,
  },

  LASTNONBLANKVALUE: {
    name: 'LASTNONBLANKVALUE',
    category: 'Inteligência de Tempo',
    syntax: 'LASTNONBLANKVALUE(column, expression)',
    description: 'Retorna o valor da expressão avaliada no último valor não em branco da coluna.',
    example: 'LASTNONBLANKVALUE(d_Calendario[Data], [Total Vendas])',
    minArgs: 2,
    maxArgs: 2,
  },

  // ==========================================
  // TOTAL Syntactic Sugars
  // TOTALYTD(expr, dates, [filter], [year_end_date])
  // ==========================================
  TOTALYTD: {
    name: 'TOTALYTD',
    category: 'Inteligência de Tempo',
    syntax: 'TOTALYTD(expression, dates, [filter], [year_end_date])',
    description: 'Avalia a expressão no acumulado do ano (Year-To-Date), equivalente a CALCULATE(expr, DATESYTD(dates, year_end_date), filter).',
    example: 'TOTALYTD([Total], d_Calendario[Data])',
    minArgs: 2,
    maxArgs: 4,
  },

  TOTALQTD: {
    name: 'TOTALQTD',
    category: 'Inteligência de Tempo',
    syntax: 'TOTALQTD(expression, dates, [filter])',
    description: 'Avalia a expressão no acumulado do trimestre (Quarter-To-Date).',
    example: 'TOTALQTD([Total], d_Calendario[Data])',
    minArgs: 2,
    maxArgs: 3,
  },

  TOTALMTD: {
    name: 'TOTALMTD',
    category: 'Inteligência de Tempo',
    syntax: 'TOTALMTD(expression, dates, [filter])',
    description: 'Avalia a expressão no acumulado do mês (Month-To-Date).',
    example: 'TOTALMTD([Total], d_Calendario[Data])',
    minArgs: 2,
    maxArgs: 3,
  },

  TOTALWTD: {
    name: 'TOTALWTD',
    category: 'Inteligência de Tempo',
    syntax: 'TOTALWTD(expression, dates, [filter])',
    description: 'Avalia a expressão no acumulado da semana (Week-To-Date).',
    example: 'TOTALWTD([Total], d_Calendario[Data])',
    minArgs: 2,
    maxArgs: 3,
  },

  // ==========================================
  // Opening & Closing Balance Sugars
  // ==========================================
  CLOSINGBALANCEMONTH: {
    name: 'CLOSINGBALANCEMONTH',
    category: 'Inteligência de Tempo',
    syntax: 'CLOSINGBALANCEMONTH(expression, dates, [filter])',
    description: 'Avalia a expressão na última data do mês no contexto atual.',
    example: 'CLOSINGBALANCEMONTH([Saldo], d_Calendario[Data])',
    minArgs: 2,
    maxArgs: 3,
  },

  CLOSINGBALANCEQUARTER: {
    name: 'CLOSINGBALANCEQUARTER',
    category: 'Inteligência de Tempo',
    syntax: 'CLOSINGBALANCEQUARTER(expression, dates, [filter])',
    description: 'Avalia a expressão na última data do trimestre no contexto atual.',
    example: 'CLOSINGBALANCEQUARTER([Saldo], d_Calendario[Data])',
    minArgs: 2,
    maxArgs: 3,
  },

  CLOSINGBALANCEYEAR: {
    name: 'CLOSINGBALANCEYEAR',
    category: 'Inteligência de Tempo',
    syntax: 'CLOSINGBALANCEYEAR(expression, dates, [filter], [year_end_date])',
    description: 'Avalia a expressão no último dia do ano fiscal ou civil no contexto.',
    example: 'CLOSINGBALANCEYEAR([Saldo], d_Calendario[Data])',
    minArgs: 2,
    maxArgs: 4,
  },

  CLOSINGBALANCEWEEK: {
    name: 'CLOSINGBALANCEWEEK',
    category: 'Inteligência de Tempo',
    syntax: 'CLOSINGBALANCEWEEK(expression, dates, [filter])',
    description: 'Avalia a expressão na última data da semana no contexto.',
    example: 'CLOSINGBALANCEWEEK([Saldo], d_Calendario[Data])',
    minArgs: 2,
    maxArgs: 3,
  },

  OPENINGBALANCEMONTH: {
    name: 'OPENINGBALANCEMONTH',
    category: 'Inteligência de Tempo',
    syntax: 'OPENINGBALANCEMONTH(expression, dates, [filter])',
    description: 'Avalia a expressão na última data do mês anterior (saldo de abertura do mês corrente).',
    example: 'OPENINGBALANCEMONTH([Saldo], d_Calendario[Data])',
    minArgs: 2,
    maxArgs: 3,
  },

  OPENINGBALANCEQUARTER: {
    name: 'OPENINGBALANCEQUARTER',
    category: 'Inteligência de Tempo',
    syntax: 'OPENINGBALANCEQUARTER(expression, dates, [filter])',
    description: 'Avalia a expressão no saldo de abertura do trimestre corrente.',
    example: 'OPENINGBALANCEQUARTER([Saldo], d_Calendario[Data])',
    minArgs: 2,
    maxArgs: 3,
  },

  OPENINGBALANCEYEAR: {
    name: 'OPENINGBALANCEYEAR',
    category: 'Inteligência de Tempo',
    syntax: 'OPENINGBALANCEYEAR(expression, dates, [filter], [year_end_date])',
    description: 'Avalia a expressão no saldo de abertura do ano fiscal ou civil corrente.',
    example: 'OPENINGBALANCEYEAR([Saldo], d_Calendario[Data])',
    minArgs: 2,
    maxArgs: 4,
  },

  OPENINGBALANCEWEEK: {
    name: 'OPENINGBALANCEWEEK',
    category: 'Inteligência de Tempo',
    syntax: 'OPENINGBALANCEWEEK(expression, dates, [filter])',
    description: 'Avalia a expressão no saldo de abertura da semana corrente.',
    example: 'OPENINGBALANCEWEEK([Saldo], d_Calendario[Data])',
    minArgs: 2,
    maxArgs: 3,
  },

  // ==========================================
  // Comparison Tuple Predicates: ISAFTER / ISONORAFTER
  // ==========================================
  ISAFTER: {
    name: 'ISAFTER',
    category: 'Lógica / Condicional',
    syntax: 'ISAFTER(val1, val2, [order], [val3, val4, [order]], ...)',
    description: 'Compara pares de valores para determinar se a primeira tupla é estritamente posterior à segunda na ordenação especificada.',
    example: 'ISAFTER(Tabela[Data], DATE(2024, 1, 1), DESC)',
    minArgs: 2,
    maxArgs: -1,
    evaluate: (args) => {
      let i = 0;
      while (i < args.length) {
        const val1 = args[i];
        const val2 = args[i + 1];
        let isDesc = false;
        if (i + 2 < args.length && typeof args[i + 2] === 'string' && ['DESC', 'ASC', '0', '1'].includes(String(args[i + 2]).toUpperCase())) {
          const ord = String(args[i + 2]).toUpperCase();
          isDesc = ord === 'DESC' || ord === '0';
          i += 3;
        } else {
          i += 2;
        }

        const cmp = daxCompare(val1, val2);
        if (cmp !== 0) {
          return isDesc ? cmp < 0 : cmp > 0;
        }
      }
      return false; // Exactly equal is not strictly AFTER
    },
  },

  ISONORAFTER: {
    name: 'ISONORAFTER',
    category: 'Lógica / Condicional',
    syntax: 'ISONORAFTER(val1, val2, [order], [val3, val4, [order]], ...)',
    description: 'Compara tuplas determinando se a primeira tupla é igual ou posterior à segunda na ordem especificada.',
    example: 'ISONORAFTER(Tabela[Data], DATE(2024, 1, 1), ASC)',
    minArgs: 2,
    maxArgs: -1,
    evaluate: (args) => {
      let i = 0;
      while (i < args.length) {
        const val1 = args[i];
        const val2 = args[i + 1];
        let isDesc = false;
        if (i + 2 < args.length && typeof args[i + 2] === 'string' && ['DESC', 'ASC', '0', '1'].includes(String(args[i + 2]).toUpperCase())) {
          const ord = String(args[i + 2]).toUpperCase();
          isDesc = ord === 'DESC' || ord === '0';
          i += 3;
        } else {
          i += 2;
        }

        const cmp = daxCompare(val1, val2);
        if (cmp !== 0) {
          return isDesc ? cmp < 0 : cmp > 0;
        }
      }
      return true; // Equal is allowed in ON OR AFTER
    },
  },
};
