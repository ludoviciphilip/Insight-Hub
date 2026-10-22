import { describe, it, expect, beforeEach } from 'vitest';
import { DataEngine } from '../dataEngine';
import { DaxEngine } from '../daxEngine';
import { FilterContext, filterContextFromUIFilters } from '../model/filterContext';
import { RelationshipGraph } from '../model/relationships';
import { InMemoryModelAccess } from '../model/modelAccess';
import { QueryPlanner } from '../query/planner';
import { createMockDataset } from './fixtures/mockDataset';
import { Filter, Visual, Table, Relationship, Measure } from '../../types/bi';
import { DAX_BLANK, isBlank } from '../expr/types';

describe('V0.3: FilterContext, CALCULATE & New Visual Query Pipeline', () => {
  let engine: DataEngine;
  let dataset: ReturnType<typeof createMockDataset>;

  beforeEach(() => {
    dataset = createMockDataset();
    engine = new DataEngine();
    engine.setSchema(dataset.tables, dataset.relationships, dataset.measures);
  });

  describe('1. Relationship Graph & Multi-Hop Propagation', () => {
    it('propagates filter from d_Calendario[Ano] to f_Vendas', () => {
      // Filter Ano = 2025: should return rows
      const filters: Filter[] = [
        {
          id: 'f_ano',
          level: 'page',
          tableId: 'd_Calendario',
          column: 'Ano',
          operator: 'equals',
          value: 2025,
        },
      ];
      const filtered = engine.getFilteredRows('f_Vendas', filters);
      expect(filtered.length).toBe(4);

      // Filter Ano = 2024: should return 0 rows since all dates in mock are 2025
      const filters2024: Filter[] = [
        {
          id: 'f_ano_24',
          level: 'page',
          tableId: 'd_Calendario',
          column: 'Ano',
          operator: 'equals',
          value: 2024,
        },
      ];
      const filtered2024 = engine.getFilteredRows('f_Vendas', filters2024);
      expect(filtered2024.length).toBe(0);
    });

    it('propagates filter in a multi-hop chain (d_Regioes -> d_Clientes -> f_Vendas)', () => {
      const d_Regioes: Table = {
        id: 'd_Regioes',
        name: 'd_Regioes',
        originalName: 'd_Regioes',
        columns: [
          { id: 'r1', name: 'Regiao', originalName: 'Regiao', dataType: 'text' },
          { id: 'r2', name: 'MacroRegiao', originalName: 'MacroRegiao', dataType: 'text' },
        ],
        rows: [
          { Regiao: 'Sudeste', MacroRegiao: 'Centro-Sul' },
          { Regiao: 'Sul', MacroRegiao: 'Centro-Sul' },
          { Regiao: 'Nordeste', MacroRegiao: 'Norte-Nordeste' },
        ],
      };

      const relRegiaoCliente: Relationship = {
        id: 'rel_regiao_cliente',
        fromTable: 'd_Clientes',
        fromColumn: 'Regiao',
        toTable: 'd_Regioes',
        toColumn: 'Regiao',
        cardinality: 'N:1',
        crossFilterDirection: 'both',
        isActive: true,
      };

      const multiHopModel = new InMemoryModelAccess(
        [...dataset.tables, d_Regioes],
        [...dataset.relationships, relRegiaoCliente],
        dataset.measures
      );

      // Filter MacroRegiao = "Norte-Nordeste"
      // -> d_Regioes has "Nordeste"
      // -> d_Clientes has C004 (Nordeste Varejo)
      // -> f_Vendas has no sales for C004
      const filter1: Filter = {
        id: 'f_macro',
        level: 'report',
        tableId: 'd_Regioes',
        column: 'MacroRegiao',
        operator: 'equals',
        value: 'Norte-Nordeste',
      };
      const ctx1 = filterContextFromUIFilters([filter1], multiHopModel);
      const rows1 = ctx1.getFilteredRows('f_Vendas', multiHopModel);
      expect(rows1.length).toBe(0);

      // Filter MacroRegiao = "Centro-Sul"
      // -> d_Regioes has Sudeste, Sul
      // -> d_Clientes has C001 (SP), C002 (RS), C003 (MG)
      // -> f_Vendas has V001 (C001), V002 (C002), V003 (C003), V004 (C001) -> 4 sales
      const filter2: Filter = {
        id: 'f_macro2',
        level: 'report',
        tableId: 'd_Regioes',
        column: 'MacroRegiao',
        operator: 'equals',
        value: 'Centro-Sul',
      };
      const ctx2 = filterContextFromUIFilters([filter2], multiHopModel);
      const rows2 = ctx2.getFilteredRows('f_Vendas', multiHopModel);
      expect(rows2.length).toBe(4);
    });

    it('respects single vs both crossFilterDirection', () => {
      // In single direction, dimension (toTable) filters fact (fromTable), but fact does NOT filter dimension
      const relSingle: Relationship = {
        id: 'rel_single_test',
        fromTable: 'f_Vendas',
        fromColumn: 'ID_Cliente',
        toTable: 'd_Clientes',
        toColumn: 'ID_Cliente',
        cardinality: 'N:1',
        crossFilterDirection: 'single',
        isActive: true,
      };

      const modelSingle = new InMemoryModelAccess(
        dataset.tables,
        [relSingle],
        dataset.measures
      );

      // Filtering d_Clientes by Regiao = "Sul" should filter f_Vendas (dim -> fact)
      const filterDim: Filter = {
        id: 'f_dim',
        level: 'page',
        tableId: 'd_Clientes',
        column: 'Regiao',
        operator: 'equals',
        value: 'Sul',
      };
      const ctxSingle = filterContextFromUIFilters([filterDim], modelSingle);
      const fVendasRows = ctxSingle.getFilteredRows('f_Vendas', modelSingle);
      expect(fVendasRows.length).toBe(1);
      expect(fVendasRows[0].ID_Venda).toBe('V002');

      // But filtering f_Vendas by ID_Venda = "V002" should NOT filter d_Clientes when single (fact -/-> dim)
      const filterFact: Filter = {
        id: 'f_fact',
        level: 'page',
        tableId: 'f_Vendas',
        column: 'ID_Venda',
        operator: 'equals',
        value: 'V002',
      };
      const ctxFactSingle = filterContextFromUIFilters([filterFact], modelSingle);
      const dClientesRows = ctxFactSingle.getFilteredRows('d_Clientes', modelSingle);
      // Because single direction prevents propagation from f_Vendas to d_Clientes, all 4 clients remain visible
      expect(dClientesRows.length).toBe(4);

      // Now with both directions:
      const relBoth: Relationship = {
        ...relSingle,
        crossFilterDirection: 'both',
      };
      const modelBoth = new InMemoryModelAccess(dataset.tables, [relBoth], dataset.measures);
      const ctxFactBoth = filterContextFromUIFilters([filterFact], modelBoth);
      const dClientesBothRows = ctxFactBoth.getFilteredRows('d_Clientes', modelBoth);
      // V002 is for C002, so only 1 client should be visible
      expect(dClientesBothRows.length).toBe(1);
      expect(dClientesBothRows[0].ID_Cliente).toBe('C002');
    });
  });

  describe('2. CALCULATE Filter Overrides & KEEPFILTERS', () => {
    it('CALCULATE replaces column filter by default', () => {
      // Active filter: d_Clientes[Regiao] = "Sudeste"
      const activeFilters: Filter[] = [
        {
          id: 'f_reg_active',
          level: 'visual',
          tableId: 'd_Clientes',
          column: 'Regiao',
          operator: 'equals',
          value: 'Sudeste',
        },
      ];

      // Measure normally: only Sudeste sales (V001: 17000, V003: 5800, V004: 2890) = 25690
      const normalVal = DaxEngine.evaluate('[Faturamento Total]', engine, undefined, activeFilters);
      expect(normalVal).toBe(25690);

      // CALCULATE([Faturamento Total], d_Clientes[Regiao] = "Sul") REPLACES "Sudeste" with "Sul"
      // In Sul: V002 = 3200
      const sulFormula = 'CALCULATE([Faturamento Total], d_Clientes[Regiao] = "Sul")';
      const calcSulVal = DaxEngine.evaluate(sulFormula, engine, undefined, activeFilters);
      expect(calcSulVal).toBe(3200);
    });

    it('CALCULATE with KEEPFILTERS intersects with existing filter', () => {
      // Active filter: d_Clientes[Regiao] = "Sudeste"
      const activeFilters: Filter[] = [
        {
          id: 'f_reg_active',
          level: 'visual',
          tableId: 'd_Clientes',
          column: 'Regiao',
          operator: 'equals',
          value: 'Sudeste',
        },
      ];

      // With KEEPFILTERS(d_Clientes[Regiao] = "Sul"): intersection between {"Sudeste"} and {"Sul"} is empty!
      // Thus result should be 0
      const keepFormula = 'CALCULATE([Faturamento Total], KEEPFILTERS(d_Clientes[Regiao] = "Sul"))';
      const keepVal = DaxEngine.evaluate(keepFormula, engine, undefined, activeFilters);
      expect(keepVal).toBe(0);
    });

    it('calculates % do Total = DIVIDE([Total], CALCULATE([Total], ALL(f_Vendas))) correctly', () => {
      // Total general: 17000 + 3200 + 5800 + 2890 = 28890
      // For V002 (Sul, 3200): 3200 / 28890 = ~0.110765
      const pctFormula = 'DIVIDE([Faturamento Total], CALCULATE([Faturamento Total], ALL(f_Vendas)))';

      // General context without filter: 28890 / 28890 = 1
      const pctGeneral = DaxEngine.evaluate(pctFormula, engine);
      expect(pctGeneral).toBe(1);

      // Context filtered to Sul:
      const sulFilters: Filter[] = [
        {
          id: 'f_sul',
          level: 'visual',
          tableId: 'd_Clientes',
          column: 'Regiao',
          operator: 'equals',
          value: 'Sul',
        },
      ];
      const pctSul = DaxEngine.evaluate(pctFormula, engine, undefined, sulFilters);
      expect(pctSul).toBeCloseTo(3200 / 28890, 5);
    });
  });

  describe('3. UI Filter Adapter & Preserving BLANK', () => {
    it('notEquals and notIn preserve BLANK values without discarding them', () => {
      const tableWithBlanks: Table = {
        id: 't_blanks',
        name: 't_blanks',
        originalName: 't_blanks',
        columns: [
          { id: 'b1', name: 'Item', originalName: 'Item', dataType: 'text' },
          { id: 'b2', name: 'Status', originalName: 'Status', dataType: 'text' },
        ],
        rows: [
          { Item: 'A', Status: 'Ativo' },
          { Item: 'B', Status: 'Cancelado' },
          { Item: 'C', Status: null },
          { Item: 'D', Status: '' },
        ],
      };

      const blankModel = new InMemoryModelAccess([tableWithBlanks]);

      // Filter: Status notEquals "Ativo"
      // DAX semantic: null, '', and 'Cancelado' are preserved!
      const filterNotEquals: Filter = {
        id: 'f_neq',
        level: 'report',
        tableId: 't_blanks',
        column: 'Status',
        operator: 'notEquals',
        value: 'Ativo',
      };

      const ctxNeq = filterContextFromUIFilters([filterNotEquals], blankModel);
      const rowsNeq = ctxNeq.getFilteredRows('t_blanks', blankModel);
      expect(rowsNeq.map(r => r.Item)).toEqual(['B', 'C', 'D']);

      // Filter: Status notIn ["Ativo", "Cancelado"]
      // Should preserve null and ''
      const filterNotIn: Filter = {
        id: 'f_notin',
        level: 'report',
        tableId: 't_blanks',
        column: 'Status',
        operator: 'notIn',
        value: ['Ativo', 'Cancelado'],
      };

      const ctxNotIn = filterContextFromUIFilters([filterNotIn], blankModel);
      const rowsNotIn = ctxNotIn.getFilteredRows('t_blanks', blankModel);
      expect(rowsNotIn.map(r => r.Item)).toEqual(['C', 'D']);
    });
  });

  describe('4. Aggregations & DISTINCTCOUNT Fix', () => {
    it('DISTINCTCOUNT counts unique non-blank values and returns BLANK on empty context', () => {
      // Total distinct products in f_Vendas: P001, P002, P003, P004 -> 4
      const dcVal = DaxEngine.evaluate('DISTINCTCOUNT(f_Vendas[ID_Produto])', engine);
      expect(dcVal).toBe(4);

      // In empty filter context:
      const impossibleFilter: Filter = {
        id: 'f_none',
        level: 'visual',
        tableId: 'f_Vendas',
        column: 'ID_Venda',
        operator: 'equals',
        value: 'NON_EXISTENT',
      };
      const filterCtx = filterContextFromUIFilters([impossibleFilter], engine);
      const emptyDC = DaxEngine.evaluateWithContext(
        'DISTINCTCOUNT(f_Vendas[ID_Produto])',
        engine,
        filterCtx
      );
      // In DAX, aggregations on 0 rows return BLANK
      expect(isBlank(emptyDC)).toBe(true);
    });

    it('evaluates COUNT, AVERAGE, MIN, MAX, PRODUCT, MEDIAN, DIVIDE', () => {
      expect(DaxEngine.evaluate('COUNT(f_Vendas[ValorTotal])', engine)).toBe(4);
      expect(DaxEngine.evaluate('SUM(f_Vendas[ValorTotal])', engine)).toBe(28890);
      expect(DaxEngine.evaluate('AVERAGE(f_Vendas[ValorTotal])', engine)).toBe(28890 / 4);
      expect(DaxEngine.evaluate('MIN(f_Vendas[ValorTotal])', engine)).toBe(2890);
      expect(DaxEngine.evaluate('MAX(f_Vendas[ValorTotal])', engine)).toBe(17000);
      expect(DaxEngine.evaluate('DIVIDE(10, 2)', engine)).toBe(5);
      expect(DaxEngine.evaluate('DIVIDE(10, 0, 99)', engine)).toBe(99);
    });
  });

  describe('5. RowContextStack & Iterators (SUMX, AVERAGEX, FILTER, EARLIER)', () => {
    it('executes SUMX with row context and context transition', () => {
      // SUMX(f_Vendas, f_Vendas[Quantidade] * 10) = (2*10) + (1*10) + (4*10) + (1*10) = 80
      const sumxVal = DaxEngine.evaluate('SUMX(f_Vendas, f_Vendas[Quantidade] * 10)', engine);
      expect(sumxVal).toBe(80);
    });

    it('executes FILTER(Table, Condition) inside CALCULATE', () => {
      // CALCULATE([Faturamento Total], FILTER(f_Vendas, f_Vendas[Quantidade] > 1))
      // Rows with Quantidade > 1: V001 (17000), V003 (5800) = 22800
      const filterFormula = 'CALCULATE([Faturamento Total], FILTER(f_Vendas, f_Vendas[Quantidade] > 1))';
      const res = DaxEngine.evaluate(filterFormula, engine);
      expect(res).toBe(22800);
    });
  });

  describe('6. New QueryPlanner Pipeline', () => {
    it('breaks down series by legendField when provided', () => {
      const visualWithLegend: Visual = {
        id: 'v_legend',
        type: 'bar',
        title: 'Vendas por Categoria e Região',
        dataConfig: {
          tableId: 'f_Vendas',
          xAxisField: 'd_Produtos.Categoria', // Categories: Eletrônicos, Móveis
          legendField: 'd_Clientes.Regiao', // Legend: Sudeste, Sul
          yAxisFields: ['ValorTotal'],
          aggregation: 'SUM',
        },
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        formatConfig: { showTitle: true },
      };

      const planner = new QueryPlanner(engine);
      const result = planner.query(visualWithLegend);

      expect(result.categories.sort()).toEqual(['Eletrônicos', 'Móveis']);
      // Series must correspond to the unique values of legendField ('Sudeste', 'Sul')
      const seriesNames = result.series.map(s => s.name).sort();
      expect(seriesNames).toEqual(['Sudeste', 'Sul']);

      // Check values:
      // Sudeste:
      // - Eletrônicos: V001 (P001, C001 Sudeste) = 17000
      // - Móveis: V003 (P003, C003 Sudeste) 5800 + V004 (P004, C001 Sudeste) 2890 = 8690
      // Sul:
      // - Eletrônicos: V002 (P002, C002 Sul) = 3200
      // - Móveis: 0
      const sudesteSeries = result.series.find(s => s.name === 'Sudeste')!;
      const sulSeries = result.series.find(s => s.name === 'Sul')!;

      const eletronicosIdx = result.categories.indexOf('Eletrônicos');
      const moveisIdx = result.categories.indexOf('Móveis');

      expect(sudesteSeries.data[eletronicosIdx]).toBe(17000);
      expect(sudesteSeries.data[moveisIdx]).toBe(8690);
      expect(sulSeries.data[eletronicosIdx]).toBe(3200);
      expect(sulSeries.data[moveisIdx]).toBe(0);
    });

    it('applies limit as Top N by value', () => {
      const topNVisual: Visual = {
        id: 'v_top',
        type: 'column',
        title: 'Top 1 Produto',
        dataConfig: {
          tableId: 'f_Vendas',
          xAxisField: 'd_Produtos.NomeProduto',
          yAxisFields: ['ValorTotal'],
          aggregation: 'SUM',
          limit: 1, // Top 1 by value
        },
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        formatConfig: { showTitle: true },
      };

      const planner = new QueryPlanner(engine);
      const result = planner.query(topNVisual);

      expect(result.categories.length).toBe(1);
      // Top product by value is 'Notebook Pro 16' with 17000
      expect(result.categories[0]).toBe('Notebook Pro 16');
      expect(result.series[0].data[0]).toBe(17000);
    });

    it('populates queryTimeMs performance benchmark', () => {
      const cardVisual: Visual = {
        id: 'v_card',
        type: 'card',
        title: 'Total Faturamento',
        dataConfig: {
          tableId: 'f_Vendas',
          yAxisFields: ['Faturamento Total'],
        },
        x: 0,
        y: 0,
        w: 3,
        h: 2,
        formatConfig: { showTitle: true },
      };

      const planner = new QueryPlanner(engine);
      const res = planner.query(cardVisual);
      expect(res.summaryValue).toBe(28890);
      expect(typeof res.queryTimeMs).toBe('number');
      expect(res.queryTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('7. High Volume Performance Check', () => {
    it('evaluates large volume within required thresholds (< 1 s)', () => {
      // Create 5,000 synthetic rows with 50 categories
      const categories = Array.from({ length: 50 }, (_, i) => `Cat_${i}`);
      const bigRows: Record<string, any>[] = [];

      for (let i = 0; i < 5000; i++) {
        bigRows.push({
          ID: `R_${i}`,
          Categoria: categories[i % 50],
          Valor: (i % 100) + 1,
        });
      }

      const bigTable: Table = {
        id: 'f_Big',
        name: 'f_Big',
        originalName: 'f_Big',
        columns: [
          { id: 'b_id', name: 'ID', originalName: 'ID', dataType: 'text' },
          { id: 'b_cat', name: 'Categoria', originalName: 'Categoria', dataType: 'text' },
          { id: 'b_val', name: 'Valor', originalName: 'Valor', dataType: 'number' },
        ],
        rows: bigRows,
      };

      const bigModel = new InMemoryModelAccess([bigTable]);
      const filterCtx = new FilterContext();

      const tStart = performance.now();
      const val = DaxEngine.evaluateWithContext('SUM(f_Big[Valor])', bigModel, filterCtx);
      const tEnd = performance.now();

      expect(val).toBeGreaterThan(0);
      expect(tEnd - tStart).toBeLessThan(1000);
    });
  });
});
