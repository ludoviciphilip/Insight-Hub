import { describe, it, expect } from 'vitest';
import { validateDax, findClosestMatch, levenshteinDistance } from '../validator';
import { Table, Measure } from '../../../types/bi';

describe('V0.1 Semantic Validator, Levenshtein Distance & Circular Reference Detection', () => {
  const sampleTables: Table[] = [
    {
      id: 'f_vendas',
      name: 'f_Vendas',
      originalName: 'f_Vendas',
      columns: [
        { id: 'c1', name: 'ValorTotal', originalName: 'ValorTotal', dataType: 'currency' },
        { id: 'c2', name: 'Quantidade', originalName: 'Quantidade', dataType: 'number' },
        { id: 'c3', name: 'Regiao', originalName: 'Regiao', dataType: 'text' },
      ],
      rows: [],
    },
    {
      id: 'd_clientes',
      name: 'd_Clientes',
      originalName: 'd_Clientes',
      columns: [
        { id: 'c4', name: 'NomeCliente', originalName: 'NomeCliente', dataType: 'text' },
      ],
      rows: [],
    },
  ];

  const sampleMeasures: Measure[] = [
    {
      id: 'm1',
      name: 'Faturamento Total',
      tableName: 'f_Vendas',
      formula: 'SUM(f_Vendas[ValorTotal])',
      format: 'currency',
    },
    {
      id: 'm2',
      name: 'Ticket Medio',
      tableName: 'f_Vendas',
      formula: 'DIVIDE([Faturamento Total], [Total Pedidos], 0)',
      format: 'currency',
    },
  ];

  it('computes Levenshtein distance correctly', () => {
    expect(levenshteinDistance('venda', 'vendas')).toBe(1);
    expect(levenshteinDistance('valortotal', 'valortota')).toBe(1);
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  it('suggests closest match for typos in table names', () => {
    // "f_venda" -> "f_Vendas"
    const match = findClosestMatch('f_venda', ['f_Vendas', 'd_Clientes']);
    expect(match).toBe('f_Vendas');

    const res = validateDax('SUM(f_venda[ValorTotal])', sampleTables, sampleMeasures);
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toContain('Você quis dizer "f_Vendas"?');
  });

  it('suggests closest match for typos in column names', () => {
    const res = validateDax('SUM(f_Vendas[ValorTotl])', sampleTables, sampleMeasures);
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toContain('Você quis dizer "ValorTotal"?');
  });

  it('suggests closest match for typos in function names', () => {
    const res = validateDax('CALCULAT(10)', sampleTables, sampleMeasures);
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toContain('Você quis dizer "CALCULATE"?');
  });

  it('detects circular references between measures', () => {
    const circularMeasures: Measure[] = [
      {
        id: 'm_a',
        name: 'MedidaA',
        tableName: 'f_Vendas',
        formula: '[MedidaB] + 10',
        format: 'number',
      },
      {
        id: 'm_b',
        name: 'MedidaB',
        tableName: 'f_Vendas',
        formula: '[MedidaA] * 2',
        format: 'number',
      },
    ];

    // Validating MedidaA which references MedidaB which references MedidaA
    const res = validateDax('[MedidaB] + 10', sampleTables, circularMeasures, 'MedidaA');
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toContain('Referência circular detectada');
    expect(res.errorMessage).toContain('MedidaA');
    expect(res.errorMessage).toContain('MedidaB');
  });

  it('extracts dependencies correctly on valid formula', () => {
    const res = validateDax(
      'DIVIDE([Faturamento Total], SUM(f_Vendas[Quantidade]), 0)',
      sampleTables,
      sampleMeasures
    );
    expect(res.isValid).toBe(true);
    expect(res.referencedTables).toContain('f_Vendas');
    expect(res.referencedColumns).toContain('Quantidade');
    expect(res.referencedMeasures).toContain('Faturamento Total');
  });

  it('rejects bare column reference in CALCULATE first argument without aggregation', () => {
    // CALCULATE([ValorTotal], ...) where ValorTotal is a column and not a measure
    const resNaked = validateDax(
      'CALCULATE([ValorTotal], f_Vendas[Regiao] = "Sul")',
      sampleTables,
      sampleMeasures
    );
    expect(resNaked.isValid).toBe(false);
    expect(resNaked.errorMessage).toContain('A coluna [ValorTotal] não pode ser acessada sem contexto de linha');

    // With explicit table prefix: CALCULATE(f_Vendas[ValorTotal], ...)
    const resPrefix = validateDax(
      'CALCULATE(f_Vendas[ValorTotal], f_Vendas[Regiao] = "Sul")',
      sampleTables,
      sampleMeasures
    );
    expect(resPrefix.isValid).toBe(false);
    expect(resPrefix.errorMessage).toContain('A coluna f_Vendas[ValorTotal] não pode ser acessada sem contexto de linha');

    // Arithmetic with naked column: [ValorTotal] * 1.1
    const resArith = validateDax('[ValorTotal] * 1.1', sampleTables, sampleMeasures);
    expect(resArith.isValid).toBe(false);
    expect(resArith.errorMessage).toContain('não pode ser acessada sem contexto de linha');
  });

  it('accepts aggregated columns and valid measures in CALCULATE', () => {
    // With aggregation: CALCULATE(SUM(f_Vendas[ValorTotal]), ...)
    const resSum = validateDax(
      'CALCULATE(SUM(f_Vendas[ValorTotal]), f_Vendas[Regiao] = "Sul")',
      sampleTables,
      sampleMeasures
    );
    expect(resSum.isValid).toBe(true);

    // With existing measure: CALCULATE([Faturamento Total], ...)
    const resMeasure = validateDax(
      'CALCULATE([Faturamento Total], f_Vendas[Regiao] = "Sul")',
      sampleTables,
      sampleMeasures
    );
    expect(resMeasure.isValid).toBe(true);

    // In row context iterator: SUMX(f_Vendas, f_Vendas[ValorTotal] * 1.1)
    const resSumx = validateDax(
      'SUMX(f_Vendas, f_Vendas[ValorTotal] * 1.1)',
      sampleTables,
      sampleMeasures
    );
    expect(resSumx.isValid).toBe(true);
  });
});

