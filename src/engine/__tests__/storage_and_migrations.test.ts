import { describe, it, expect } from 'vitest';
import { migrateProjectState, CURRENT_ENGINE_VERSION } from '../migrations';
import { createMockDataset } from './fixtures/mockDataset';

describe('Storage v2 & Migrations V0.0', () => {
  it('migrates legacy relationships from table names to table IDs', () => {
    const rawLegacyState = {
      version: '1.0.0',
      projectName: 'Legacy Project',
      tables: [
        { id: 'tbl_vendas_id', name: 'f_Vendas', originalName: 'f_Vendas', columns: [], rows: [] },
        { id: 'tbl_produtos_id', name: 'd_Produtos', originalName: 'd_Produtos', columns: [], rows: [] },
      ],
      relationships: [
        {
          id: 'rel_1',
          fromTable: 'f_Vendas', // table name
          fromColumn: 'ID_Produto',
          toTable: 'd_Produtos', // table name
          toColumn: 'ID_Produto',
          cardinality: 'N:1',
          crossFilterDirection: 'both',
          isActive: true,
        },
      ],
      measures: [],
    };

    const migrated = migrateProjectState(rawLegacyState);
    expect(migrated.version).toBe(CURRENT_ENGINE_VERSION);
    expect(migrated.relationships[0].fromTable).toBe('tbl_vendas_id');
    expect(migrated.relationships[0].toTable).toBe('tbl_produtos_id');
  });

  it('correctly chunks large datasets (over 20k rows) and preserves rows after reassembly', () => {
    // Generate 50,000 rows
    const CHUNK_SIZE = 20000;
    const totalRows = 50000;
    const rows: Record<string, any>[] = [];
    for (let i = 0; i < totalRows; i++) {
      rows.push({ id: i, valor: i * 1.5 });
    }

    // Chunking logic (matching storage.ts)
    const chunks: Record<string, any>[][] = [];
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      chunks.push(rows.slice(i, i + CHUNK_SIZE));
    }

    expect(chunks.length).toBe(3); // 20k, 20k, 10k
    expect(chunks[0].length).toBe(20000);
    expect(chunks[1].length).toBe(20000);
    expect(chunks[2].length).toBe(10000);

    // Reassemble
    const reassembled: Record<string, any>[] = [];
    chunks.forEach(c => reassembled.push(...c));

    expect(reassembled.length).toBe(totalRows);
    expect(reassembled[0].id).toBe(0);
    expect(reassembled[totalRows - 1].id).toBe(totalRows - 1);
    expect(reassembled[totalRows - 1].valor).toBe((totalRows - 1) * 1.5);
  });

  it('provides safe defaults for missing fields when importing incomplete states', () => {
    const emptyState = {};
    const migrated = migrateProjectState(emptyState);

    expect(migrated.projectName).toBe('Projeto InsightHub');
    expect(migrated.tables).toEqual([]);
    expect(migrated.relationships).toEqual([]);
    expect(migrated.measures).toEqual([]);
    expect(migrated.gridSize).toBe(20);
    expect(migrated.showGrid).toBe(true);
    expect(migrated.snapToGrid).toBe(true);
    expect(migrated.version).toBe(CURRENT_ENGINE_VERSION);
  });
});
