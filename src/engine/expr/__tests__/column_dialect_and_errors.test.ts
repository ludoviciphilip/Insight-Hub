import { describe, it, expect } from 'vitest';
import { PowerBiColumnEngine } from '../../powerBiColumnEngine';
import { EtlEngine } from '../../etlEngine';
import { Column, Table, PowerQueryStep } from '../../../types/bi';

describe('V0.1 Column Dialect & Error Visibility in Custom Columns', () => {
  const testColumns: Column[] = [
    { id: 'c1', name: 'ValorTotal', originalName: 'ValorTotal', dataType: 'currency' },
    { id: 'c2', name: 'Desconto', originalName: 'Desconto', dataType: 'currency' },
    { id: 'c3', name: 'Cliente', originalName: 'Cliente', dataType: 'text' },
    { id: 'c4', name: 'Data', originalName: 'Data', dataType: 'date' },
  ];

  it('supports unbracketed column names and single-quoted strings in column dialect', () => {
    const row = { ValorTotal: 100, Desconto: 10, Cliente: 'Acme Corp' };

    // Unbracketed column reference
    const res1 = PowerBiColumnEngine.evaluateRow('ValorTotal - Desconto', row, 0, testColumns);
    expect(res1).toBe(90);

    // Single-quoted text
    const res2 = PowerBiColumnEngine.evaluateRow("Cliente & ' - VIP'", row, 0, testColumns);
    expect(res2).toBe('Acme Corp - VIP');
  });

  it('supports Portuguese boolean/null keywords VERDADEIRO, FALSO, NULO', () => {
    const row = { ValorTotal: 150 };
    expect(PowerBiColumnEngine.evaluateRow('IF([ValorTotal] > 100, VERDADEIRO, FALSO)', row, 0, testColumns)).toBe(true);
    expect(PowerBiColumnEngine.evaluateRow('IF([ValorTotal] < 100, VERDADEIRO, NULO)', row, 0, testColumns)).toBeNull();
  });

  it('supports aliases and compatibility functions: CONCAT, TEXT.UPPER, TEXT.LOWER, PROPER, HOJE, LINHA', () => {
    const row = { Cliente: 'joao silva' };
    expect(PowerBiColumnEngine.evaluateRow('TEXT.UPPER([Cliente])', row, 0, testColumns)).toBe('JOAO SILVA');
    expect(PowerBiColumnEngine.evaluateRow('PROPER([Cliente])', row, 0, testColumns)).toBe('Joao Silva');
    expect(PowerBiColumnEngine.evaluateRow('INDEX()', row, 4, testColumns)).toBe(5);
    expect(PowerBiColumnEngine.evaluateRow('LINHA()', row, 2, testColumns)).toBe(3);
  });

  it('supports legacy overloads: REPLACE with 3 args, FLOOR with 1 arg, CONTAINS scalar', () => {
    const row = { Cliente: 'Cliente Premium ABC', ValorTotal: 99.8 };
    expect(PowerBiColumnEngine.evaluateRow('REPLACE([Cliente], "Premium", "VIP")', row, 0, testColumns)).toBe('Cliente VIP ABC');
    expect(PowerBiColumnEngine.evaluateRow('FLOOR([ValorTotal])', row, 0, testColumns)).toBe(99);
    expect(PowerBiColumnEngine.evaluateRow('CONTAINS([Cliente], "VIP")', row, 0, testColumns)).toBe(false);
    expect(PowerBiColumnEngine.evaluateRow('CONTAINS([Cliente], "Premium")', row, 0, testColumns)).toBe(true);
  });

  it('returns detailed errors via evaluateRowDetailed without throwing', () => {
    const row = { ValorTotal: 100 };
    const res = PowerBiColumnEngine.evaluateRowDetailed('UNKNOWN_FUNC([ValorTotal])', row, 0, testColumns);
    expect(res.value).toBeNull();
    expect(res.error).toBeDefined();
    expect(res.error).toMatch(/não foi reconhecida/);
  });

  it('records errorCount and firstError in ETL pipeline when addCustomColumn encounters errors', () => {
    const table: Table = {
      id: 't_test',
      name: 'Vendas',
      originalName: 'Vendas',
      columns: testColumns,
      rows: [
        { ValorTotal: 100, Desconto: 10, Cliente: 'Cliente 1' },
        { ValorTotal: 200, Desconto: 20, Cliente: 'Cliente 2' },
      ],
    };

    const step: PowerQueryStep = {
      id: 'step_1',
      name: 'Adicionar Coluna com Erro',
      type: 'addCustomColumn',
      params: {
        newColumnName: 'ResultadoComErro',
        expression: 'FUNCAO_INEXISTENTE([ValorTotal])',
        expressionType: 'number',
      },
    };

    const { table: resultTable } = EtlEngine.executePipeline(table, [step]);
    expect(resultTable.columns.some(c => c.name === 'ResultadoComErro')).toBe(true);
    expect(resultTable.rows[0].ResultadoComErro).toBeNull();

    // Check step error reporting
    expect((step.params as any).errorCount).toBe(2);
    expect((step.params as any).firstError).toBeDefined();
    expect(step.description).toContain('2 erros');
  });
});
