import { describe, it, expect } from 'vitest';
import { EtlEngine } from '../etlEngine';
import { DaxEngine } from '../daxEngine';
import { InMemoryModelAccess } from '../model/modelAccess';
import { Table, PowerQueryStep } from '../../types/bi';
import { createMockDataset } from './fixtures/mockDataset';

describe('ETL Engine & DaxEngine V0.0', () => {
  it('correctly converts "1.234,56" to 1234.56 in changeType (bugfix)', () => {
    const rawTable: Table = {
      id: 'test_table',
      name: 'test_table',
      originalName: 'test_table',
      columns: [{ id: 'col1', name: 'Preco', originalName: 'Preco', dataType: 'text' }],
      rows: [
        { Preco: '1.234,56' },
        { Preco: 'R$ 500,25' },
        { Preco: '12,50' },
      ],
    };

    const step: PowerQueryStep = {
      id: 'step_1',
      name: 'Alterar Tipo',
      type: 'changeType',
      params: { columnName: 'Preco', newType: 'number' },
    };

    const result = EtlEngine.executePipeline(rawTable, [step]);
    expect(result.table.rows[0].Preco).toBe(1234.56);
    expect(result.table.rows[1].Preco).toBe(500.25);
    expect(result.table.rows[2].Preco).toBe(12.5);
  });

  it('tracks conversion errors in errorCount and sets invalid entries to null', () => {
    const rawTable: Table = {
      id: 'test_errors',
      name: 'test_errors',
      originalName: 'test_errors',
      columns: [{ id: 'c1', name: 'Valor', originalName: 'Valor', dataType: 'text' }],
      rows: [
        { Valor: '100,50' },
        { Valor: 'invalido_texto' },
        { Valor: '200,00' },
        { Valor: 'outro_erro' },
      ],
    };

    const step: PowerQueryStep = {
      id: 'step_err',
      name: 'Alterar Tipo com Erros',
      type: 'changeType',
      params: { columnName: 'Valor', newType: 'number' },
    };

    const result = EtlEngine.executePipeline(rawTable, [step]);
    expect(result.table.rows[0].Valor).toBe(100.5);
    expect(result.table.rows[1].Valor).toBeNull();
    expect(result.table.rows[2].Valor).toBe(200);
    expect(result.table.rows[3].Valor).toBeNull();

    // Check step description updated with error count
    expect(step.description).toContain('2 erros de conversão');
    expect(step.params.errorCount).toBe(2);

    // Check computeColumnProfiles computes errorCount
    const profiles = EtlEngine.computeColumnProfiles(result.table);
    const valProfile = profiles.find(p => p.columnName === 'Valor');
    expect(valProfile).toBeDefined();
    expect(valProfile?.nullCount).toBe(2);
  });

  it('evaluates DAX measures using ModelAccess without global window dependency', () => {
    const { tables, relationships, measures } = createMockDataset();
    const modelAccess = new InMemoryModelAccess(tables, relationships, measures);

    // Sum of ValorTotal from f_Vendas: 17000 + 3200 + 5800 + 2890 = 28890
    const totalFat = DaxEngine.evaluate('SUM(f_Vendas[ValorTotal])', modelAccess);
    expect(totalFat).toBe(28890);

    // Sum of Quantidade from f_Vendas: 2 + 1 + 4 + 1 = 8
    const totalQtd = DaxEngine.evaluate('SUM(f_Vendas[Quantidade])', modelAccess);
    expect(totalQtd).toBe(8);

    // Ticket Médio = 28890 / 8 = 3611.25
    const ticketMedio = DaxEngine.evaluate('DIVIDE([Faturamento Total], [Quantidade Total], 0)', modelAccess);
    expect(ticketMedio).toBeCloseTo(3611.25, 2);
  });
});
