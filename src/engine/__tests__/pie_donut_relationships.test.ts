import { describe, it, expect } from 'vitest';
import { DataEngine } from '../dataEngine';
import { Table, Relationship, Measure, Visual } from '../../types/bi';

describe('Pie & Donut Visuals with Relationships and DAX Measures', () => {
  const dClientes: Table = {
    id: 'd_Clientes',
    name: 'd_Clientes',
    originalName: 'd_Clientes',
    columns: [
      { id: 'c1', name: 'ID_Cliente', originalName: 'ID_Cliente', dataType: 'number' },
      { id: 'c2', name: 'Nome', originalName: 'Nome', dataType: 'text' },
      { id: 'c3', name: 'Segmento', originalName: 'Segmento', dataType: 'text' },
    ],
    rows: [
      { ID_Cliente: 1, Nome: 'Empresa Alfa', Segmento: 'Enterprise' },
      { ID_Cliente: 2, Nome: 'Empresa Beta', Segmento: 'Enterprise' },
      { ID_Cliente: 3, Nome: 'Comércio Gama', Segmento: 'Varejo' },
      { ID_Cliente: 4, Nome: 'Loja Delta', Segmento: 'Varejo' },
      { ID_Cliente: 5, Nome: 'Startup Epsilon', Segmento: 'PME' },
    ],
  };

  const fVendas: Table = {
    id: 'f_Vendas',
    name: 'f_Vendas',
    originalName: 'f_Vendas',
    columns: [
      { id: 'v1', name: 'ID_Venda', originalName: 'ID_Venda', dataType: 'number' },
      { id: 'v2', name: 'ID_Cliente', originalName: 'ID_Cliente', dataType: 'number' },
      { id: 'v3', name: 'ValorTotal', originalName: 'ValorTotal', dataType: 'currency' },
    ],
    rows: [
      { ID_Venda: 101, ID_Cliente: 1, ValorTotal: 1000 },
      { ID_Venda: 102, ID_Cliente: 1, ValorTotal: 2000 },
      { ID_Venda: 103, ID_Cliente: 2, ValorTotal: 3000 },
      { ID_Venda: 104, ID_Cliente: 3, ValorTotal: 500 },
      { ID_Venda: 105, ID_Cliente: 4, ValorTotal: 700 },
      { ID_Venda: 106, ID_Cliente: 5, ValorTotal: 300 },
    ],
  };

  const rel: Relationship = {
    id: 'rel_vendas_clientes',
    fromTable: 'f_Vendas',
    fromColumn: 'ID_Cliente',
    toTable: 'd_Clientes',
    toColumn: 'ID_Cliente',
    cardinality: 'N:1',
    crossFilterDirection: 'both',
    isActive: true,
  };

  const measures: Measure[] = [
    {
      id: 'm1',
      name: 'Faturamento Total',
      tableName: 'f_Vendas',
      formula: 'SUM(f_Vendas[ValorTotal])',
      format: 'currency',
    },
    {
      id: 'm2',
      name: 'Qtd Vendas',
      tableName: 'f_Vendas',
      formula: 'COUNTROWS(f_Vendas)',
      format: 'integer',
    },
    {
      id: 'm3',
      name: 'Ticket Médio',
      tableName: 'f_Vendas',
      formula: 'DIVIDE([Faturamento Total], COUNTROWS(f_Vendas), 0)',
      format: 'currency',
    },
  ];

  const engine = new DataEngine();
  engine.setSchema([dClientes, fVendas], [rel], measures);

  it('correctly calculates DAX measure per slice on Pie chart when category is from related dimension table', () => {
    const pieVisual: Visual = {
      id: 'pie_test',
      type: 'pie',
      title: 'Faturamento por Segmento',
      x: 0,
      y: 0,
      w: 400,
      h: 300,
      dataConfig: {
        tableId: 'f_Vendas',
        xAxisField: 'Segmento', // belongs to d_Clientes
        yAxisFields: ['Faturamento Total'],
      },
      formatConfig: { showTitle: true },
    };

    const result = engine.queryVisualData(pieVisual, []);

    // Total Alfa (1000+2000) + Beta (3000) = 6000 for Enterprise
    // Gama (500) + Delta (700) = 1200 for Varejo
    // Epsilon (300) = 300 for PME
    expect(result.categories).toContain('Enterprise');
    expect(result.categories).toContain('Varejo');
    expect(result.categories).toContain('PME');

    const enterpriseIdx = result.categories.indexOf('Enterprise');
    const varejoIdx = result.categories.indexOf('Varejo');
    const pmeIdx = result.categories.indexOf('PME');

    expect(result.series[0].data[enterpriseIdx]).toBe(6000);
    expect(result.series[0].data[varejoIdx]).toBe(1200);
    expect(result.series[0].data[pmeIdx]).toBe(300);
  });

  it('correctly calculates COUNTROWS(Table) per slice without returning global unfiltered row count', () => {
    const donutVisual: Visual = {
      id: 'donut_countrows',
      type: 'donut',
      title: 'Contagem de Vendas por Segmento',
      x: 0,
      y: 0,
      w: 400,
      h: 300,
      dataConfig: {
        tableId: 'f_Vendas',
        xAxisField: 'Segmento',
        yAxisFields: ['Qtd Vendas'],
      },
      formatConfig: { showTitle: true },
    };

    const result = engine.queryVisualData(donutVisual, []);
    const enterpriseIdx = result.categories.indexOf('Enterprise');
    const varejoIdx = result.categories.indexOf('Varejo');
    const pmeIdx = result.categories.indexOf('PME');

    // Enterprise has 3 sales (101, 102, 103)
    // Varejo has 2 sales (104, 105)
    // PME has 1 sale (106)
    expect(result.series[0].data[enterpriseIdx]).toBe(3);
    expect(result.series[0].data[varejoIdx]).toBe(2);
    expect(result.series[0].data[pmeIdx]).toBe(1);
  });

  it('evaluates measure arithmetic with COUNTROWS like Ticket Médio correctly per slice', () => {
    const pieVisual: Visual = {
      id: 'pie_ticket_medio',
      type: 'pie',
      title: 'Ticket Médio por Segmento',
      x: 0,
      y: 0,
      w: 400,
      h: 300,
      dataConfig: {
        tableId: 'f_Vendas',
        xAxisField: 'Segmento',
        yAxisFields: ['Ticket Médio'],
      },
      formatConfig: { showTitle: true },
    };

    const result = engine.queryVisualData(pieVisual, []);
    const enterpriseIdx = result.categories.indexOf('Enterprise');
    const varejoIdx = result.categories.indexOf('Varejo');
    const pmeIdx = result.categories.indexOf('PME');

    // Enterprise: 6000 / 3 = 2000
    // Varejo: 1200 / 2 = 600
    // PME: 300 / 1 = 300
    expect(result.series[0].data[enterpriseIdx]).toBe(2000);
    expect(result.series[0].data[varejoIdx]).toBe(600);
    expect(result.series[0].data[pmeIdx]).toBe(300);
  });

  it('supports explicit dot-notation "d_Clientes.Segmento" as category on donut visual', () => {
    const donutVisual: Visual = {
      id: 'donut_dot_notation',
      type: 'donut',
      title: 'Faturamento por Segmento',
      x: 0,
      y: 0,
      w: 400,
      h: 300,
      dataConfig: {
        tableId: 'f_Vendas',
        xAxisField: 'd_Clientes.Segmento',
        yAxisFields: ['Faturamento Total'],
      },
      formatConfig: { showTitle: true },
    };

    const result = engine.queryVisualData(donutVisual, []);
    const enterpriseIdx = result.categories.indexOf('Enterprise');
    expect(result.series[0].data[enterpriseIdx]).toBe(6000);
  });
});
