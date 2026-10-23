import { Table, Column } from '../../types/bi';
import { parseDate } from '../shared/valueParser';

export interface CalendarDiagnostics {
  isValid: boolean;
  isMarkedAsDateTable: boolean;
  dateColumn?: string;
  minDate?: string;
  maxDate?: string;
  totalDays: number;
  expectedDays: number;
  hasNulls: boolean;
  hasDuplicates: boolean;
  isContinuous: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates whether a table qualifies as a valid marked Date/Calendar table according to Power BI rules:
 * 1. Must contain at least one column of DataType 'date' or containing valid dates.
 * 2. Must contain unique values for every day (no duplicate dates).
 * 3. Must contain no null, blank, or invalid date values.
 * 4. Must span a continuous date range without gaps between minDate and maxDate.
 */
export function validateDateTable(table: Table, preferredDateCol?: string): CalendarDiagnostics {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Locate primary date column
  let dateCol: Column | undefined;
  if (preferredDateCol) {
    dateCol = table.columns.find(c => c.name.toLowerCase() === preferredDateCol.toLowerCase());
  }

  if (!dateCol) {
    // Try matching common names or data types
    dateCol =
      table.columns.find(c => c.dataType === 'date') ||
      table.columns.find(c => ['data', 'date', 'datas', 'dia'].includes(c.name.toLowerCase())) ||
      table.columns[0];
  }

  if (!dateCol) {
    return {
      isValid: false,
      isMarkedAsDateTable: false,
      totalDays: 0,
      expectedDays: 0,
      hasNulls: true,
      hasDuplicates: false,
      isContinuous: false,
      errors: ['A tabela não possui nenhuma coluna de datas identificável.'],
      warnings: [],
    };
  }

  const colName = dateCol.name;
  const rows = table.rows || [];

  if (rows.length === 0) {
    return {
      isValid: false,
      isMarkedAsDateTable: false,
      dateColumn: colName,
      totalDays: 0,
      expectedDays: 0,
      hasNulls: true,
      hasDuplicates: false,
      isContinuous: false,
      errors: ['A tabela de calendário está vazia (0 linhas).'],
      warnings: [],
    };
  }

  let hasNulls = false;
  let hasDuplicates = false;
  const seenDates = new Set<string>();
  const dateSerials: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rawVal = rows[i][colName];
    const parsed = parseDate(rawVal);

    if (!parsed.date || !parsed.iso || parsed.serial === null) {
      hasNulls = true;
      continue;
    }

    if (seenDates.has(parsed.iso)) {
      hasDuplicates = true;
    } else {
      seenDates.add(parsed.iso);
      dateSerials.push(parsed.serial);
    }
  }

  if (hasNulls) {
    errors.push(`A coluna "${colName}" contém valores nulos, vazios ou inválidos.`);
  }

  if (hasDuplicates) {
    errors.push(`A coluna "${colName}" contém datas duplicadas. Cada dia deve ser único.`);
  }

  if (dateSerials.length === 0) {
    errors.push(`Nenhuma data válida encontrada na coluna "${colName}".`);
    return {
      isValid: false,
      isMarkedAsDateTable: false,
      dateColumn: colName,
      totalDays: 0,
      expectedDays: 0,
      hasNulls: true,
      hasDuplicates,
      isContinuous: false,
      errors,
      warnings,
    };
  }

  dateSerials.sort((a, b) => a - b);
  const minSerial = dateSerials[0];
  const maxSerial = dateSerials[dateSerials.length - 1];
  const expectedDays = maxSerial - minSerial + 1;
  const totalDays = dateSerials.length;

  let isContinuous = true;
  if (totalDays !== expectedDays) {
    isContinuous = false;
    const diff = expectedDays - totalDays;
    errors.push(
      `A sequência de datas não é contínua. Faltam ${diff} dia(s) entre o início e o fim da série.`
    );
  }

  // Min and max ISO string
  const minDateParsed = parseDate(minSerial);
  const maxDateParsed = parseDate(maxSerial);
  const minDate = minDateParsed.iso || undefined;
  const maxDate = maxDateParsed.iso || undefined;

  // Check if year boundaries are full years (warning, not strict blocker)
  if (minDate && maxDate) {
    if (!minDate.endsWith('-01-01')) {
      warnings.push(`A tabela de calendário inicia em ${minDate} em vez do primeiro dia do ano (01/01).`);
    }
    if (!maxDate.endsWith('-12-31')) {
      warnings.push(`A tabela de calendário termina em ${maxDate} em vez do último dia do ano (31/12).`);
    }
  }

  const isValid = !hasNulls && !hasDuplicates && isContinuous && errors.length === 0;

  return {
    isValid,
    isMarkedAsDateTable: Boolean(table.isCalendar),
    dateColumn: colName,
    minDate,
    maxDate,
    totalDays,
    expectedDays,
    hasNulls,
    hasDuplicates,
    isContinuous,
    errors,
    warnings,
  };
}
