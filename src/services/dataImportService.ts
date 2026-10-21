import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Table, Column, DataType } from '../types/bi';
import { parseDate } from '../engine/shared/valueParser';

/**
 * Converts Excel numeric serial date (e.g., 46113, 46114) or string date to ISO 'YYYY-MM-DD'
 * Excel base date is December 30, 1899 due to the 1900 leap year bug.
 */
export function formatToDateIso(val: any): string | null {
  const result = parseDate(val);
  return result.iso;
}

/**
 * Checks if a column represents a date column by name or sample values
 */
export function isDateColumn(colName: string, sampleValues: any[]): boolean {
  // Normalize colName: remove accents and lowercase
  const normalized = colName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const dateKeywords = [
    'data',
    'date',
    'dt',
    'periodo',
    'dia',
    'competencia',
    'emissao',
    'vencimento',
    'fechamento',
    'transacao',
    'criacao',
    'atualizacao',
    'movimento',
  ];

  if (dateKeywords.some(kw => normalized.includes(kw))) {
    return true;
  }

  // Sample check: if > 40% non-empty values match a date or Excel date serial (25000-85000)
  const nonEmpties = sampleValues.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmpties.length === 0) return false;

  const validDateCount = nonEmpties.filter(v => formatToDateIso(v) !== null).length;
  return validDateCount / nonEmpties.length >= 0.4;
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

export class DataImportService {
  /**
   * Imports and processes CSV/TSV file with PapaParse
   */
  public static async parseCsv(file: File): Promise<{ tableName: string; columns: Column[]; rows: Record<string, any>[] }> {
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

          // Detect columns & dates
          const columns: Column[] = colNames.map(colName => {
            const sampleVals = rawRows.slice(0, 50).map(r => r[colName]);
            const isDate = isDateColumn(colName, sampleVals);

            let dataType: DataType = 'text';
            if (isDate) {
              dataType = 'date';
            } else {
              const firstVal = sampleVals.find(v => v !== null && v !== undefined && v !== '');
              if (typeof firstVal === 'number') {
                const lower = colName.toLowerCase();
                dataType = lower.includes('valor') || lower.includes('preco') || lower.includes('custo') || lower.includes('total')
                  ? 'currency'
                  : 'number';
              } else if (typeof firstVal === 'boolean') {
                dataType = 'boolean';
              }
            }

            return {
              id: 'c_' + Math.random().toString(36).substr(2, 6),
              name: colName,
              originalName: colName,
              dataType,
            };
          });

          // Clean rows, formatting dates
          const processedRows = rawRows.map(row => {
            const newRow: Record<string, any> = {};
            columns.forEach(col => {
              const val = row[col.name];
              if (col.dataType === 'date') {
                newRow[col.name] = formatToDateIso(val) || val;
              } else {
                newRow[col.name] = val;
              }
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
   * Imports ALL worksheets in the workbook and automatically resolves serial dates
   */
  public static async parseExcel(file: File): Promise<ExcelImportResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, {
            type: 'binary',
            cellDates: true,
            cellNF: true,
            cellText: true,
          });

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return reject(new Error('Nenhuma aba encontrada na planilha Excel.'));
          }

          const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
          const sheets: ParsedSheet[] = [];

          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) continue;

            // Use raw: true but handle serial dates conversion reliably
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

            // Detect columns & dates
            const columns: Column[] = colNames.map(colName => {
              const sampleVals = rawRows.slice(0, 100).map(r => r[colName]);
              const isDate = isDateColumn(colName, sampleVals);

              let dataType: DataType = 'text';
              if (isDate) {
                dataType = 'date';
              } else {
                const firstVal = sampleVals.find(v => v !== null && v !== undefined && v !== '');
                if (typeof firstVal === 'number') {
                  const lower = colName.toLowerCase();
                  dataType = lower.includes('valor') || lower.includes('preco') || lower.includes('custo')
                    ? 'currency'
                    : 'number';
                } else if (typeof firstVal === 'boolean') {
                  dataType = 'boolean';
                }
              }

              return {
                id: 'c_' + Math.random().toString(36).substr(2, 6),
                name: colName,
                originalName: colName,
                dataType,
              };
            });

            // Clean rows, convert any numeric serial dates or date objects to YYYY-MM-DD
            const processedRows = rawRows.map(row => {
              const newRow: Record<string, any> = {};
              columns.forEach(col => {
                const val = row[col.name];
                if (col.dataType === 'date') {
                  newRow[col.name] = formatToDateIso(val) || val;
                } else {
                  if (
                    typeof val === 'number' &&
                    val >= 25000 &&
                    val <= 85000 &&
                    (col.name.toLowerCase().includes('data') ||
                      col.name.toLowerCase().includes('date') ||
                      col.name.toLowerCase().includes('dt'))
                  ) {
                    newRow[col.name] = formatToDateIso(val) || val;
                    col.dataType = 'date';
                  } else {
                    newRow[col.name] = val;
                  }
                }
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
            return reject(new Error('Nenhuma aba com dados foi encontrada no arquivo Excel.'));
          }

          resolve({
            tableName: sheets[0].tableName,
            columns: sheets[0].columns,
            rows: sheets[0].rows,
            sheets,
          });
        } catch (err: any) {
          reject(new Error(`Falha ao ler Excel: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo do disco.'));
      reader.readAsBinaryString(file);
    });
  }

  /**
   * Imports and processes JSON files
   */
  public static async parseJson(file: File): Promise<{ tableName: string; columns: Column[]; rows: Record<string, any>[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = JSON.parse(text);
          const rawRows = Array.isArray(parsed) ? parsed : [parsed];
          if (rawRows.length === 0) return reject(new Error('JSON vazio.'));

          const colNames = Object.keys(rawRows[0]);
          const tableName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');

          const columns: Column[] = colNames.map(colName => {
            const sampleVals = rawRows.slice(0, 50).map(r => r[colName]);
            const isDate = isDateColumn(colName, sampleVals);
            return {
              id: 'c_' + Math.random().toString(36).substr(2, 6),
              name: colName,
              originalName: colName,
              dataType: isDate ? 'date' : typeof rawRows[0][colName] === 'number' ? 'number' : 'text',
            };
          });

          const processedRows = rawRows.map(row => {
            const newRow: Record<string, any> = {};
            columns.forEach(col => {
              const val = row[col.name];
              newRow[col.name] = col.dataType === 'date' ? formatToDateIso(val) || val : val;
            });
            return newRow;
          });

          resolve({ tableName, columns, rows: processedRows });
        } catch (err: any) {
          reject(new Error(`JSON inválido: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      reader.readAsText(file);
    });
  }
}
