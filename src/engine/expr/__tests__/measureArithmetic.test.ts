import { describe, it, expect } from 'vitest';
import { DaxEngine } from '../../daxEngine';
import { createMockDataset } from '../../__tests__/fixtures/mockDataset';
import { Measure } from '../../../types/bi';
import { DaxError } from '../../shared/errors';

describe('V0.2 Measure-to-Measure Arithmetic in DAX Engine', () => {
  const dataset = createMockDataset();

  // Define base measures
  const baseMeasures: Measure[] = [
    {
      id: 'm_vendas',
      name: 'Total Vendas',
      tableName: 'f_Vendas',
      formula: 'SUM(f_Vendas[ValorTotal])',
      format: 'currency',
      formatString: 'Currency',
    },
    {
      id: 'm_custos',
      name: 'Custo Logistica',
      tableName: 'f_Logistica',
      formula: 'SUM(f_Logistica[CustoTotalViagem])',
      format: 'currency',
      formatString: 'Currency',
    },
    {
      id: 'm_qtd',
      name: 'Qtd Total',
      tableName: 'f_Vendas',
      formula: 'SUM(f_Vendas[Quantidade])',
      format: 'integer',
      formatString: '#,##0',
    },
  ];

  // Total Vendas = 17000 + 3200 + 5800 + 2890 = 28890
  // Custo Logistica = 1250 + 1100 + 1680 = 4030
  // Qtd Total = 2 + 1 + 4 + 1 = 8

  it('evaluates sum of two measures: [Total Vendas] + [Custo Logistica]', () => {
    const formula = '[Total Vendas] + [Custo Logistica]';
    const result = DaxEngine.evaluate(formula, dataset.tables, baseMeasures);
    expect(result).toBe(28890 + 4030); // 32920
  });

  it('evaluates subtraction: [Total Vendas] - [Custo Logistica]', () => {
    const formula = '[Total Vendas] - [Custo Logistica]';
    const result = DaxEngine.evaluate(formula, dataset.tables, baseMeasures);
    expect(result).toBe(28890 - 4030); // 24860
  });

  it('evaluates multiplication: [Total Vendas] * 1.1', () => {
    const formula = '[Total Vendas] * 1.1';
    const result = DaxEngine.evaluate(formula, dataset.tables, baseMeasures);
    expect(result).toBeCloseTo(28890 * 1.1, 2);
  });

  it('evaluates division: [Total Vendas] / [Qtd Total]', () => {
    const formula = '[Total Vendas] / [Qtd Total]';
    const result = DaxEngine.evaluate(formula, dataset.tables, baseMeasures);
    expect(result).toBe(28890 / 8); // 3611.25
  });

  it('evaluates DIVIDE between measures: DIVIDE([Total Vendas], [Custo Logistica])', () => {
    const formula = 'DIVIDE([Total Vendas], [Custo Logistica], 0)';
    const result = DaxEngine.evaluate(formula, dataset.tables, baseMeasures);
    expect(result).toBeCloseTo(28890 / 4030, 4);
  });

  it('evaluates complex arithmetic with parentheses: ([Total Vendas] - [Custo Logistica]) / [Qtd Total]', () => {
    const formula = '([Total Vendas] - [Custo Logistica]) / [Qtd Total]';
    const result = DaxEngine.evaluate(formula, dataset.tables, baseMeasures);
    expect(result).toBe((28890 - 4030) / 8); // 3107.5
  });

  it('detects and prevents circular references between measures', () => {
    const circularMeasures: Measure[] = [
      {
        id: 'm_a',
        name: 'Medida A',
        tableName: 'f_Vendas',
        formula: '[Medida B] + 10',
        format: 'number',
      },
      {
        id: 'm_b',
        name: 'Medida B',
        tableName: 'f_Vendas',
        formula: '[Medida A] * 2',
        format: 'number',
      },
    ];

    expect(() => {
      DaxEngine.evaluate('[Medida A]', dataset.tables, circularMeasures);
    }).toThrow(DaxError);
  });
});
