import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  isDateColumn,
  isDateValue,
  inferColumnType,
  cleanRowValue,
  formatToDateIso,
  DataImportService,
} from '../dataImportService';

describe('DataImportService - Type Inference & Value Cleaning', () => {
  describe('isDateValue', () => {
    it('recognizes Date instances as dates', () => {
      expect(isDateValue(new Date('2024-03-15T00:00:00Z'))).toBe(true);
    });

    it('recognizes ISO and Brazilian date strings as dates', () => {
      expect(isDateValue('2024-03-15')).toBe(true);
      expect(isDateValue('15/03/2024')).toBe(true);
      expect(isDateValue('2024-03-15 14:30:00')).toBe(true);
      expect(isDateValue('15-03-2024')).toBe(true);
      expect(isDateValue('20240315')).toBe(true);
    });

    it('strictly rejects raw numbers and pure numeric strings as dates', () => {
      expect(isDateValue(1)).toBe(false);
      expect(isDateValue(100)).toBe(false);
      expect(isDateValue(3500.5)).toBe(false);
      expect(isDateValue(45672)).toBe(false);
      expect(isDateValue('100')).toBe(false);
      expect(isDateValue('1500')).toBe(false);
      expect(isDateValue('3500.50')).toBe(false);
    });

    it('rejects general non-date text', () => {
      expect(isDateValue('São Paulo')).toBe(false);
      expect(isDateValue('Notebook Dell')).toBe(false);
      expect(isDateValue('Ativo')).toBe(false);
    });
  });

  describe('isDateColumn', () => {
    it('returns false for numeric, integer and financial columns with numbers', () => {
      expect(isDateColumn('ID', [1, 2, 3, 4, 5])).toBe(false);
      expect(isDateColumn('Qtd', [2, 5, 10, 1])).toBe(false);
      expect(isDateColumn('Quantidade', [10, 20, 30])).toBe(false);
      expect(isDateColumn('PrecoUnitario', [79.9, 149.0, 3500.5])).toBe(false);
      expect(isDateColumn('ValorTotal', [239.7, 745.0, 7001.0])).toBe(false);
      expect(isDateColumn('Custo', [50.0, 100.0, 2500.0])).toBe(false);
      expect(isDateColumn('Saldo', [1000.0, 2500.0, 50000.0])).toBe(false);
      expect(isDateColumn('Score', [85, 90, 72, 95])).toBe(false);
      expect(isDateColumn('Ano', [2022, 2023, 2024])).toBe(false);
    });

    it('does not get confused by substring "dia" in words like "media" or "mandato"', () => {
      expect(isDateColumn('ticket_medio', [150.5, 200.0, 350.2])).toBe(false);
      expect(isDateColumn('media_vendas', [10.5, 20.0, 35.0])).toBe(false);
      expect(isDateColumn('mandato', ['2020-2024', '2024-2028'])).toBe(false);
      expect(isDateColumn('candidato', ['João', 'Maria'])).toBe(false);
    });

    it('returns true for legitimate date columns with dates or Excel date serials', () => {
      expect(isDateColumn('DataVenda', [new Date('2024-03-15'), new Date('2024-03-16')])).toBe(true);
      expect(isDateColumn('dt_emissao', ['2024-01-10', '2024-01-11'])).toBe(true);
      expect(isDateColumn('data_vencimento', ['15/02/2025', '20/02/2025'])).toBe(true);
      expect(isDateColumn('Data', [45292, 45293, 45294])).toBe(true);
    });

    it('returns true for unnamed column if values are actual ISO or BR date strings', () => {
      expect(isDateColumn('ColX', ['2024-01-15', '2024-01-16', '2024-01-17'])).toBe(true);
      expect(isDateColumn('ColY', ['15/01/2024', '16/01/2024', '17/01/2024'])).toBe(true);
    });
  });

  describe('inferColumnType', () => {
    it('correctly classifies integers as number', () => {
      expect(inferColumnType('ID', [1, 2, 3])).toBe('number');
      expect(inferColumnType('Qtd', [5, 10, 15])).toBe('number');
      expect(inferColumnType('Codigo', [1001, 1002, 1003])).toBe('number');
      expect(inferColumnType('Ano', [2023, 2024])).toBe('number');
    });

    it('correctly classifies financial columns as currency', () => {
      expect(inferColumnType('PrecoUnitario', [79.9, 149.0, 3500.5])).toBe('currency');
      expect(inferColumnType('ValorTotal', [239.7, 745.0, 7001.0])).toBe('currency');
      expect(inferColumnType('Custo', [50.0, 100.0])).toBe('currency');
      expect(inferColumnType('Salario', [3500.0, 4800.0])).toBe('currency');
      expect(inferColumnType('Faturamento', [50000.0, 120000.0])).toBe('currency');
      expect(inferColumnType('Receita', [15000.0, 22000.0])).toBe('currency');
      expect(inferColumnType('Desconto', [15.0, 20.0])).toBe('currency');
    });

    it('correctly classifies date columns as date', () => {
      expect(inferColumnType('DataVenda', [new Date('2024-05-10'), new Date('2024-05-11')])).toBe('date');
      expect(inferColumnType('dt_emissao', ['2024-05-10', '2024-05-11'])).toBe('date');
    });

    it('correctly classifies percentages', () => {
      expect(inferColumnType('MargemLucro', [0.15, 0.2, 0.25])).toBe('percentage');
      expect(inferColumnType('TaxaDesconto', ['10%', '15%', '20%'])).toBe('percentage');
    });

    it('correctly classifies booleans', () => {
      expect(inferColumnType('Ativo', [true, false, true])).toBe('boolean');
      expect(inferColumnType('Pago', ['sim', 'nao', 'sim'])).toBe('boolean');
    });
  });

  describe('cleanRowValue', () => {
    it('preserves numbers and currencies as numbers', () => {
      expect(cleanRowValue(1, 'number')).toBe(1);
      expect(cleanRowValue(3500.5, 'currency')).toBe(3500.5);
      expect(cleanRowValue(7001, 'currency')).toBe(7001);
      expect(cleanRowValue(0.15, 'percentage')).toBe(0.15);
    });

    it('parses formatted numeric strings into real numbers', () => {
      expect(cleanRowValue('R$ 3.500,50', 'currency')).toBe(3500.5);
      expect(cleanRowValue('1.250,00', 'currency')).toBe(1250);
      expect(cleanRowValue('100', 'number')).toBe(100);
      expect(cleanRowValue('15%', 'percentage')).toBe(0.15);
    });

    it('formats date values into UTC ISO YYYY-MM-DD', () => {
      const d = new Date('2024-05-10T00:00:00Z');
      expect(cleanRowValue(d, 'date')).toBe('2024-05-10');
      expect(cleanRowValue('10/05/2024', 'date')).toBe('2024-05-10');
    });

    it('handles null and empty values', () => {
      expect(cleanRowValue(null, 'number')).toBeNull();
      expect(cleanRowValue('', 'currency')).toBeNull();
      expect(cleanRowValue(undefined, 'date')).toBeNull();
    });
  });

  describe('End-to-end XLSX import parsing', () => {
    it('accurately imports Excel tables preserving integers and financial values', async () => {
      const XLSX = await import('xlsx');
      const { DataImportService } = await import('../dataImportService');

      const wb = XLSX.utils.book_new();
      const wsData = [
        ['ID', 'Produto', 'Qtd', 'PrecoUnitario', 'ValorTotal', 'DataVenda'],
        [1, 'Notebook', 2, 3500.5, 7001.0, new Date('2024-03-15T00:00:00Z')],
        [2, 'Mouse', 10, 89.9, 899.0, new Date('2024-03-16T00:00:00Z')],
        [3, 'Teclado', 5, 250.0, 1250.0, new Date('2024-03-17T00:00:00Z')],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const file = new File([buf], 'vendas.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const result = await DataImportService.parseExcel(file);
      expect(result.sheets.length).toBe(1);

      const colTypes = Object.fromEntries(result.columns.map(c => [c.name, c.dataType]));
      expect(colTypes['ID']).toBe('number');
      expect(colTypes['Qtd']).toBe('number');
      expect(colTypes['PrecoUnitario']).toBe('currency');
      expect(colTypes['ValorTotal']).toBe('currency');
      expect(colTypes['DataVenda']).toBe('date');
      expect(colTypes['Produto']).toBe('text');

      // Verify row values: numbers are NOT converted into dates!
      expect(result.rows[0]['ID']).toBe(1);
      expect(result.rows[0]['Qtd']).toBe(2);
      expect(result.rows[0]['PrecoUnitario']).toBe(3500.5);
      expect(result.rows[0]['ValorTotal']).toBe(7001.0);
      expect(result.rows[0]['DataVenda']).toBe('2024-03-15');

      expect(result.rows[1]['ID']).toBe(2);
      expect(result.rows[1]['Qtd']).toBe(10);
      expect(result.rows[1]['PrecoUnitario']).toBe(89.9);
      expect(result.rows[1]['ValorTotal']).toBe(899.0);
      expect(result.rows[1]['DataVenda']).toBe('2024-03-16');
    });

    it('rejects files exceeding the 50MB limit', async () => {
      const mockLargeFile = {
        name: 'huge.xlsx',
        size: 51 * 1024 * 1024,
      } as unknown as File;

      await expect(DataImportService.parseExcel(mockLargeFile)).rejects.toThrow(
        /limite máximo permitido de 50MB/
      );

      const mockLargeCsv = {
        name: 'huge.csv',
        size: 51 * 1024 * 1024,
      } as unknown as File;

      await expect(DataImportService.parseCsv(mockLargeCsv)).rejects.toThrow(
        /limite máximo permitido de 50MB/
      );
    });

    it('respects sheetRows configurable limit option', async () => {
      const data = [
        { ID: 1, Nome: 'Alpha' },
        { ID: 2, Nome: 'Beta' },
        { ID: 3, Nome: 'Gamma' },
        { ID: 4, Nome: 'Delta' },
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Dados');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const file = new File([buf], 'limit.xlsx');

      // Header row counts towards sheetRows, so sheetRows: 2 gives header + 1 data row
      const result = await DataImportService.parseExcel(file, { sheetRows: 2 });
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].Nome).toBe('Alpha');
    });

    it('provides clear pt-BR error message for invalid or corrupt excel files', async () => {
      const badBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const file = new File([badBuffer], 'corrompido.xlsx');

      await expect(DataImportService.parseExcel(file)).rejects.toThrow(
        /Falha ao ler o arquivo Excel|Falha ao ler a planilha Excel/i
      );
    });
  });
});

