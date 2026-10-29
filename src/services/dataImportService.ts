import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Column, DataType } from '../types/bi';
import { parseDate, parseNumber } from '../engine/shared/valueParser';

/**
 * Converts Excel numeric serial date (e.g., 46113, 46114) or string date to ISO 'YYYY-MM-DD'
 * Excel base date is December 30, 1899 due to the 1900 leap year bug.
 */
export function formatToDateIso(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  const result = parseDate(val);
  return result.iso;
}

/**
 * Determines whether an individual value is genuinely a date (Date object or recognized date string).
 * Plain numbers are NOT considered dates by default unless in a column with an explicit date header.
 */
export function isDateValue(val: any): boolean {
  if (val === null || val === undefined || val === '') return false;

  // Date object (from SheetJS cellDates or JS Date)
  if (val instanceof Date) {
    return !isNaN(val.getTime());
  }

  // Raw numbers are numbers, not dates by default
  if (typeof val === 'number') {
    return false;
  }

  if (typeof val !== 'string') return false;

  const s = val.trim();
  if (!s) return false;

  // Pure numbers as strings (e.g. "10", "1500", "3500.50") are numbers, not dates
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    // Exception: compact 8-digit YYYYMMDD (e.g. "20240315")
    if (/^\d{8}$/.test(s)) {
      const y = parseInt(s.substring(0, 4), 10);
      const m = parseInt(s.substring(4, 6), 10);
      const d = parseInt(s.substring(6, 8), 10);
      return y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
    }
    return false;
  }

  // ISO: YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[\sT]|$)/.test(s)) {
    const parts = s.split(/[-/T\s]/);
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
  }

  // Brazilian / European: DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}(?:[\sT]|$)/.test(s)) {
    const parts = s.split(/[-/T\s]/);
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    return y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
  }

  // 2-digit year: DD/MM/YY or DD-MM-YY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2}(?:[\sT]|$)/.test(s)) {
    const parts = s.split(/[-/T\s]/);
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return m >= 1 && m <= 12 && d >= 1 && d <= 31;
  }

  // Text month format: e.g. "15 Jan 2024", "Jan 15, 2024", "15 de Janeiro de 2024"
  if (/^(?:\d{1,2}\s+(?:de\s+)?[A-Za-zçãõéêíóú]+\s+(?:de\s+)?\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i.test(s)) {
    const p = parseDate(s);
    return p.date !== null;
  }

  return false;
}

/**
 * Checks if a column represents a date column by name or sample values.
 * Strictly prevents numeric columns (quantities, prices, totals, IDs) from being falsely detected as dates.
 */
export function isDateColumn(colName: string, sampleValues: any[]): boolean {
  const nonEmpties = sampleValues.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmpties.length === 0) return false;

  const normalized = colName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Explicit numeric/financial keywords in column name override accidental date substrings
  // (e.g. "ticket_medio" contains "dia", "mandato" contains "data", "candidato" contains "data")
  const numericExclusions = [
    'valor', 'preco', 'custo', 'total', 'qtd', 'quantidade', 'preco_unitario',
    'subtotal', 'desconto', 'lucro', 'receita', 'faturamento', 'salario',
    'saldo', 'remuneracao', 'comissao', 'premio', 'tarifa', 'imposto',
    'id', 'codigo', 'cod', 'score', 'pontos', 'ano', 'meses', 'dias',
    'duracao', 'idade', 'peso', 'altura', 'largura', 'volume', 'temperatura',
    'taxa', 'porcentagem', 'margem', 'percentual', 'pct'
  ];

  const tokens = normalized.split(/[^a-z0-9]+/);

  const hasNumericExclusion = tokens.some(t => numericExclusions.includes(t)) ||
    numericExclusions.some(ne => normalized.startsWith(ne + '_') || normalized.endsWith('_' + ne) || normalized === ne);

  // If column name is explicitly numeric, do not treat as date unless values are actual Date instances
  if (hasNumericExclusion) {
    const hasAnyActualDateValue = nonEmpties.some(v => v instanceof Date || isDateValue(v));
    if (!hasAnyActualDateValue) {
      return false;
    }
  }

  // 2. Date keywords matched as tokens or explicit prefixes/suffixes
  const dateTokens = [
    'data', 'date', 'periodo', 'competencia',
    'emissao', 'vencimento', 'fechamento', 'transacao',
    'criacao', 'atualizacao', 'nascimento', 'admissao', 'demissao'
  ];

  const hasDateHeader = tokens.some(t => dateTokens.includes(t)) ||
    tokens.some(t => t === 'dt') ||
    normalized.startsWith('dt_') ||
    normalized.endsWith('_dt') ||
    normalized.startsWith('data_') ||
    normalized.endsWith('_data') ||
    normalized.startsWith('date_') ||
    normalized.endsWith('_date') ||
    /^(dt|data|date)[A-Z0-9]/.test(colName);

  if (hasDateHeader) {
    // If it has a date header, check that sample values don't contradict it
    // Values can be Date instances, date strings, or Excel serial numbers (20000..85000)
    const validCount = nonEmpties.filter(v => {
      if (v instanceof Date) return !isNaN(v.getTime());
      if (typeof v === 'number') {
        // Excel serial date range for plausible business dates (1954 to 2132)
        return v >= 20000 && v <= 85000;
      }
      return isDateValue(v);
    }).length;

    return validCount / nonEmpties.length >= 0.5;
  }

  // 3. No date header: column can ONLY be a date column if sample values are genuinely dates
  // (Date objects or formatted date strings like "2024-05-15" or "15/05/2024").
  // Plain numbers are NEVER treated as dates when there is no date header!
  const actualDateCount = nonEmpties.filter(v => isDateValue(v)).length;
  return actualDateCount / nonEmpties.length >= 0.6;
}

/**
 * Accurately infers column data type based on name, values, and optional Excel format hints.
 */
export function inferColumnType(
  colName: string,
  sampleVals: any[],
  hasExcelDateHint: boolean = false
): DataType {
  const nonEmpties = sampleVals.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmpties.length === 0) return 'text';

  // 1. Is it a date column?
  if (hasExcelDateHint || isDateColumn(colName, nonEmpties)) {
    return 'date';
  }

  const colLower = colName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const camelSpaced = colName.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tokens = Array.from(new Set([...colLower.split(/[^a-z0-9]+/), ...camelSpaced.split(/[^a-z0-9]+/)]));

  // 2. Is it boolean?
  const boolCount = nonEmpties.filter(v =>
    typeof v === 'boolean' ||
    (typeof v === 'string' && ['true', 'false', 'sim', 'nao', 'não', 's', 'n', 'yes', 'no', 'y'].includes(v.trim().toLowerCase()))
  ).length;
  if (boolCount / nonEmpties.length >= 0.8) {
    return 'boolean';
  }

  // 3. Is it percentage?
  const percentKeywords = ['taxa', 'percent', 'porcentagem', 'porcent', 'aliquota', 'margem', 'pct', '%'];
  const hasPercentHeader = tokens.some(t => percentKeywords.includes(t)) ||
    percentKeywords.some(kw => colLower.includes(kw));
  const percentStringCount = nonEmpties.filter(v =>
    typeof v === 'string' && /^-?\d+([.,]\d+)?\s*%$/.test(v.trim())
  ).length;
  if (percentStringCount / nonEmpties.length >= 0.5) {
    return 'percentage';
  }

  // 4. Is it currency / financial?
  const currencyKeywords = [
    'valor', 'preco', 'custo', 'total', 'salario', 'saldo', 'lucro',
    'receita', 'faturamento', 'desconto', 'despesa', 'pagamento',
    'subtotal', 'orcamento', 'premio', 'tarifa', 'imposto', 'financeiro',
    'provento', 'comissao', 'venda', 'fatura'
  ];
  const hasCurrencyHeader = tokens.some(t => currencyKeywords.includes(t)) ||
    currencyKeywords.some(kw => colLower.includes(kw));

  const hasCurrencySymbols = nonEmpties.some(v =>
    typeof v === 'string' && (/R\$|\$|€|£/i.test(v))
  );

  // 5. Is it numeric?
  const numericCount = nonEmpties.filter(v => {
    if (typeof v === 'number') return !isNaN(v);
    if (typeof v === 'string') {
      const parsed = parseNumber(v);
      return parsed.value !== null && !isNaN(parsed.value);
    }
    return false;
  }).length;

  const isNumeric = numericCount / nonEmpties.length >= 0.6;

  if (isNumeric) {
    if (hasPercentHeader || percentStringCount > 0) {
      return 'percentage';
    }
    if (hasCurrencySymbols || hasCurrencyHeader) {
      return 'currency';
    }
    return 'number';
  }

  return 'text';
}

/**
 * Cleans individual cell values according to the determined column data type.
 * Never converts raw numbers in numeric/currency columns into dates.
 */
export function cleanRowValue(val: any, dataType: DataType): any {
  if (val === null || val === undefined || val === '') {
    return null;
  }

  switch (dataType) {
    case 'date': {
      if (val instanceof Date) {
        if (isNaN(val.getTime())) return null;
        const y = val.getUTCFullYear();
        const m = String(val.getUTCMonth() + 1).padStart(2, '0');
        const d = String(val.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return formatToDateIso(val) || val;
    }

    case 'currency':
    case 'number':
    case 'percentage': {
      if (typeof val === 'number') {
        return isNaN(val) ? null : val;
      }
      if (typeof val === 'string') {
        const parsed = parseNumber(val);
        return parsed.value !== null ? parsed.value : val;
      }
      return val;
    }

    case 'boolean': {
      if (typeof val === 'boolean') return val;
      const s = String(val).trim().toLowerCase();
      if (['true', '1', 'sim', 's', 'yes', 'y'].includes(s)) return true;
      if (['false', '0', 'nao', 'não', 'n', 'no'].includes(s)) return false;
      return Boolean(val);
    }

    case 'text':
    default: {
      if (val instanceof Date) {
        if (isNaN(val.getTime())) return null;
        const y = val.getUTCFullYear();
        const m = String(val.getUTCMonth() + 1).padStart(2, '0');
        const d = String(val.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return val;
    }
  }
}

export interface ParsedSheet {
  sheetName: string;
  tableName: string;
  columns: Column[];
  rows: Record<string, any>[];
}

export interface ExcelImportResult {
  tableName: string;
  columns: Column[];
  rows: Record<string, any>[];
  sheets: ParsedSheet[];
}

export interface ExcelImportOptions {
  /**
   * Limite máximo de linhas processadas por aba da planilha.
   * Padrão: 1.000.000 linhas.
   */
  sheetRows?: number;
}

export const MAX_IMPORT_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export class DataImportService {
  /**
   * Imports and processes CSV/TSV file with PapaParse
   */
  public static async parseCsv(file: File): Promise<{ tableName: string; columns: Column[]; rows: Record<string, any>[] }> {
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      throw new Error(`O arquivo excede o limite máximo permitido de 50MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
    }

    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            return reject(new Error(`Erro ao ler CSV: ${results.errors[0]?.message}`));
          }

          const rawRows = results.data as Record<string, any>[];
          if (!rawRows || rawRows.length === 0) {
            return reject(new Error('O arquivo CSV não contém registros.'));
          }

          const colNames = Object.keys(rawRows[0]);
          const tableName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');

          // Detect columns & types accurately
          const columns: Column[] = colNames.map(colName => {
            const sampleVals = rawRows.slice(0, 50).map(r => r[colName]);
            const dataType = inferColumnType(colName, sampleVals);

            return {
              id: 'c_' + Math.random().toString(36).substr(2, 6),
              name: colName,
              originalName: colName,
              dataType,
            };
          });

          // Clean rows according to inferred data types
          const processedRows = rawRows.map(row => {
            const newRow: Record<string, any> = {};
            columns.forEach(col => {
              newRow[col.name] = cleanRowValue(row[col.name], col.dataType);
            });
            return newRow;
          });

          resolve({ tableName, columns, rows: processedRows });
        },
        error: (err) => reject(new Error(err.message)),
      });
    });
  }

  /**
   * Imports and processes Excel file (.xlsx, .xls) with SheetJS
   * Imports ALL worksheets in the workbook, accurately distinguishing numbers, currencies, and dates.
   * Hardened against malicious spreadsheets (disabled formula execution, disabled HTML evaluation, 50MB cap).
   */
  public static async parseExcel(
    file: File,
    options?: ExcelImportOptions
  ): Promise<ExcelImportResult> {
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      throw new Error(`O arquivo excede o limite máximo permitido de 50MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
    }

    try {
      let buffer: ArrayBuffer;
      if (typeof file.arrayBuffer === 'function') {
        buffer = await file.arrayBuffer();
      } else {
        buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(new Error('Erro ao ler arquivo do disco.'));
          reader.readAsArrayBuffer(file);
        });
      }

      const sheetRowsLimit = options?.sheetRows ?? 1_000_000;

      const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
        cellStyles: false, // Security: ignora formatação e estilos para mitigar riscos de ReDoS
        sheetRows: sheetRowsLimit, // Limite configurável de linhas por aba (padrão: 1.000.000)
        cellNF: false,
        cellFormula: false, // Security: não avalia fórmulas arbitrárias
        cellHTML: false, // Security: não processa HTML embutido
        cellText: true,
      });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Nenhuma aba encontrada na planilha Excel.');
      }

      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
      const sheets: ParsedSheet[] = [];

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        const rawRows = XLSX.utils.sheet_to_json(worksheet, {
          raw: true,
          defval: null,
        }) as Record<string, any>[];

        if (!rawRows || rawRows.length === 0) continue;

        const colNames = Object.keys(rawRows[0]);
        if (colNames.length === 0) continue;

        const cleanSheetName = sheetName.replace(/[^a-zA-Z0-9_]/g, '_');
        const tableName =
          workbook.SheetNames.length === 1 && (sheetName === 'Sheet1' || sheetName === 'Planilha1')
            ? baseName
            : cleanSheetName || `${baseName}_${cleanSheetName}`;

        // Check if worksheet has explicit date cells for each column
        const columns: Column[] = colNames.map(colName => {
          const sampleVals = rawRows.slice(0, 100).map(r => r[colName]);

          // Check if any sample values are Date instances (from SheetJS cellDates)
          const hasDateInstances = sampleVals.some(v => v instanceof Date && !isNaN(v.getTime()));

          const dataType = inferColumnType(colName, sampleVals, hasDateInstances);

          return {
            id: 'c_' + Math.random().toString(36).substr(2, 6),
            name: colName,
            originalName: colName,
            dataType,
          };
        });

        // Clean rows according to inferred data types
        const processedRows = rawRows.map(row => {
          const newRow: Record<string, any> = {};
          columns.forEach(col => {
            newRow[col.name] = cleanRowValue(row[col.name], col.dataType);
          });
          return newRow;
        });

        sheets.push({
          sheetName,
          tableName,
          columns,
          rows: processedRows,
        });
      }

      if (sheets.length === 0) {
        throw new Error('Nenhuma aba com dados foi encontrada no arquivo Excel.');
      }

      return {
        tableName: sheets[0].tableName,
        columns: sheets[0].columns,
        rows: sheets[0].rows,
        sheets,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('limite máximo permitido de 50MB')) {
        throw err;
      }
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (/password|encrypt/i.test(rawMsg)) {
        throw new Error('Falha ao ler o arquivo Excel: a planilha está protegida por senha ou criptografia não suportada.');
      }
      if (/corrupt|zip|signature|unsupported/i.test(rawMsg)) {
        throw new Error(`Falha ao ler o arquivo Excel: o arquivo parece estar corrompido ou em formato incompatível (${rawMsg}).`);
      }
      throw new Error(`Falha ao ler a planilha Excel: ${rawMsg || 'verifique se o arquivo é válido e tente novamente'}.`);
    }
  }

  /**
   * Imports and processes JSON files
   */
  public static async parseJson(file: File): Promise<{ tableName: string; columns: Column[]; rows: Record<string, any>[] }> {
    try {
      const text = typeof file.text === 'function'
        ? await file.text()
        : await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
            reader.readAsText(file);
          });

      const parsed = JSON.parse(text);
      const rawRows = Array.isArray(parsed) ? parsed : [parsed];
      if (rawRows.length === 0) throw new Error('JSON vazio.');

      const colNames = Object.keys(rawRows[0]);
      const tableName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');

      const columns: Column[] = colNames.map(colName => {
        const sampleVals = rawRows.slice(0, 50).map(r => r[colName]);
        const dataType = inferColumnType(colName, sampleVals);
        return {
          id: 'c_' + Math.random().toString(36).substr(2, 6),
          name: colName,
          originalName: colName,
          dataType,
        };
      });

      const processedRows = rawRows.map(row => {
        const newRow: Record<string, any> = {};
        columns.forEach(col => {
          newRow[col.name] = cleanRowValue(row[col.name], col.dataType);
        });
        return newRow;
      });

      return { tableName, columns, rows: processedRows };
    } catch (err: any) {
      throw new Error(`JSON inválido: ${err.message}`);
    }
  }
}
