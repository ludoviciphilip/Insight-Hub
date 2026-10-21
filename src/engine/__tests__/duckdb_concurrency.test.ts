import { describe, it, expect } from 'vitest';
import { DuckDbEngine } from '../duckdbEngine';
import { Table } from '../../types/bi';

describe('DuckDbEngine V0.0 - Concurrency & Schema', () => {
  it('shares a single initialization promise across concurrent calls', async () => {
    const engine = new DuckDbEngine();

    // Fire 3 simultaneous initialize calls
    const p1 = engine.initialize();
    const p2 = engine.initialize();
    const p3 = engine.initialize();

    // In Node test environment, Workers might be absent, so it gracefully resolves to fallback (false)
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    // Crucially: all 3 calls MUST return the exact same boolean result (not false for 2nd/3rd due to isInitializing check!)
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    expect(engine.getStatus()).not.toBe('initializing');
  });

  it('correctly tracks isSynced status and provides fallback SQL execution', async () => {
    const engine = new DuckDbEngine();
    await engine.initialize();

    const sampleTable: Table = {
      id: 'f_Teste',
      name: 'f_Teste',
      originalName: 'f_Teste',
      columns: [
        { id: 'c1', name: 'ID', originalName: 'ID', dataType: 'text' },
        { id: 'c2', name: 'Total', originalName: 'Total', dataType: 'currency' },
      ],
      rows: [
        { ID: 'A1', Total: 150.0 },
        { ID: 'A2', Total: 250.0 },
      ],
    };

    expect(engine.isSynced('f_Teste')).toBe(false);

    engine.registerTable(sampleTable);
    expect(engine.isSynced('f_Teste')).toBe(false);

    // Running a query forces sync
    const res = await engine.query('SELECT SUM([Total]) AS Soma FROM [f_Teste]');
    expect(res).toBeDefined();
    expect(res.length).toBe(1);
    expect(res[0].Soma).toBe(400.0);
    expect(engine.isSynced('f_Teste')).toBe(true);
  });

  it('propagates SQL syntax errors without silent swallowing', async () => {
    const engine = new DuckDbEngine();
    await engine.initialize();

    await expect(engine.query('SELECT * FROM tabela_que_nao_existe_xyz')).rejects.toThrow();
  });
});
