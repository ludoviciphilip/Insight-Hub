import { describe, it, expect } from 'vitest';
import { ColumnStore, TableColumnStorage } from '../columnStore';
import { createMockDataset } from '../../__tests__/fixtures/mockDataset';

describe('Derived Columnar Storage (ColumnStore)', () => {
  const { tables } = createMockDataset();
  const fVendas = tables.find(t => t.id === 'f_Vendas')!;

  it('builds dictionary-encoded vector for text columns', () => {
    const store = new TableColumnStorage(fVendas);
    const colVector = store.getColumn('ID_Produto');

    expect(colVector).toBeDefined();
    expect(colVector?.type).toBe('string');
    if (colVector?.type === 'string') {
      expect(colVector.dictionary).toContain('P001');
      expect(colVector.dictionary).toContain('P002');
      expect(colVector.codes.length).toBe(fVendas.rows.length);
      expect(colVector.getValue(0)).toBe('P001');
    }
  });

  it('builds Float64Array and nullBitmap for number/currency columns', () => {
    const store = new TableColumnStorage(fVendas);
    const colVector = store.getColumn('ValorTotal');

    expect(colVector).toBeDefined();
    expect(colVector?.type).toBe('number');
    if (colVector?.type === 'number') {
      expect(colVector.values[0]).toBe(17000.0);
      expect(colVector.values[1]).toBe(3200.0);
      expect(colVector.nullBitmap[0]).toBe(0);
      expect(colVector.getValue(0)).toBe(17000.0);
    }
  });

  it('builds on-demand inverted index mapping values to row indices', () => {
    const store = new TableColumnStorage(fVendas);
    const colVector = store.getColumn('ID_Cliente')!;

    const invertedIndex = colVector.getInvertedIndex();
    expect(invertedIndex).toBeDefined();
    const rowsForC001 = invertedIndex.get('C001');
    // V001 and V004 both have ID_Cliente: C001
    expect(rowsForC001).toContain(0);
    expect(rowsForC001).toContain(3);
  });

  it('filters rows efficiently using predicates', () => {
    const columnStore = new ColumnStore();
    columnStore.updateTable(fVendas);

    const highValueRows = columnStore.filterRows('f_Vendas', idx => {
      const col = columnStore.getColumn('f_Vendas', 'ValorTotal');
      const val = col?.getValue(idx);
      return typeof val === 'number' && val > 5000;
    });

    // Row 0 (17000) and Row 2 (5800)
    expect(highValueRows).toContain(0);
    expect(highValueRows).toContain(2);
    expect(highValueRows).not.toContain(1); // 3200
  });

  it('handles updates and invalidation with table versioning', () => {
    const columnStore = new ColumnStore();
    const storage1 = columnStore.updateTable(fVendas);
    expect(storage1.version).toBe(1);

    const storage2 = columnStore.updateTable({
      ...fVendas,
      rows: [...fVendas.rows, { ID_Venda: 'V999', ID_Produto: 'P001', ID_Cliente: 'C001', Data: '2025-04-01', Quantidade: 1, ValorTotal: 999.0 }],
    });
    expect(storage2.version).toBe(2);
    expect(columnStore.rowCount('f_Vendas')).toBe(fVendas.rows.length + 1);

    columnStore.invalidate('f_Vendas');
    expect(columnStore.rowCount('f_Vendas')).toBe(0);
  });
});
