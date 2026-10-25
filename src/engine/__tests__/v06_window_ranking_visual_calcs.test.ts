import { describe, it, expect } from 'vitest';
import { Evaluator } from '../expr/evaluator';
import { Table, Measure, Relationship, Visual } from '../../types/bi';
import { ModelAccess } from '../model/modelAccess';
import { FilterContext } from '../model/filterContext';
import { isBlank, DAX_BLANK, isDaxTable } from '../expr/types';
import { DaxError } from '../shared/errors';
import { QueryPlanner } from '../query/planner';

// Mock ModelAccess for testing
class MockModel implements ModelAccess {
  private tablesMap: Map<string, Table> = new Map();
  private relationships: Relationship[] = [];
  private measuresMap: Map<string, Measure> = new Map();

  constructor(tables: Table[], relationships: Relationship[] = [], measures: Measure[] = []) {
    tables.forEach(t => this.tablesMap.set(t.id, t));
    this.relationships = relationships;
    measures.forEach(m => this.measuresMap.set(m.name.toLowerCase(), m));
  }

  getTable(idOrName: string): Table | undefined {
    for (const t of this.tablesMap.values()) {
      if (t.id === idOrName || t.name.toLowerCase() === idOrName.toLowerCase()) {
        return t;
      }
    }
    return undefined;
  }

  getTables(): Table[] {
    return Array.from(this.tablesMap.values());
  }

  getRelationships(): Relationship[] {
    return this.relationships;
  }

  getMeasures(): Measure[] {
    return Array.from(this.measuresMap.values());
  }

  getMeasure(idOrName: string): Measure | undefined {
    const clean = idOrName.replace(/^[\[]|\]$/g, '').toLowerCase().trim();
    return this.measuresMap.get(clean);
  }
}

describe('V0.6: Funções de Janela, Ranking e Visual Calculations', () => {
  // Test Dataset
  const clientesTable: Table = {
    id: 'd_Cliente',
    name: 'd_Cliente',
    originalName: 'd_Cliente',
    columns: [
      { id: 'c1', name: 'Nome', originalName: 'Nome', dataType: 'text' },
      { id: 'c2', name: 'Cidade', originalName: 'Cidade', dataType: 'text' },
      { id: 'c3', name: 'Pontos', originalName: 'Pontos', dataType: 'number' },
    ],
    rows: [
      { Nome: 'Alice', Cidade: 'SP', Pontos: 100 },
      { Nome: 'Bob', Cidade: 'SP', Pontos: 100 },
      { Nome: 'Carlos', Cidade: 'RJ', Pontos: 80 },
      { Nome: 'Daniel', Cidade: 'RJ', Pontos: 60 },
    ],
  };

  const vendasTable: Table = {
    id: 'f_Vendas',
    name: 'f_Vendas',
    originalName: 'f_Vendas',
    columns: [
      { id: 'v1', name: 'Id', originalName: 'Id', dataType: 'number' },
      { id: 'v2', name: 'Cliente', originalName: 'Cliente', dataType: 'text' },
      { id: 'v3', name: 'Valor', originalName: 'Valor', dataType: 'number' },
    ],
    rows: [
      { Id: 1, Cliente: 'Alice', Valor: 100 },
      { Id: 2, Cliente: 'Bob', Valor: 100 },
      { Id: 3, Cliente: 'Carlos', Valor: 80 },
      { Id: 4, Cliente: 'Daniel', Valor: 60 },
    ],
  };

  const measures: Measure[] = [
    {
      id: 'm1',
      name: 'TotalVendas',
      formula: 'SUM(f_Vendas[Valor])',
      tableName: 'f_Vendas',
      format: 'number',
    },
    {
      id: 'm2',
      name: 'TotalPontos',
      formula: 'SUM(d_Cliente[Pontos])',
      tableName: 'd_Cliente',
      format: 'number',
    },
  ];

  const model = new MockModel([clientesTable, vendasTable], [], measures);

  describe('1. RANKX (Skip vs Dense, ASC vs DESC)', () => {
    it('calculates Dense ranking with ties correctly', () => {
      // Alice and Bob both have 100 -> rank 1
      // Carlos has 80 -> rank 2 in Dense
      // Daniel has 60 -> rank 3 in Dense
      const evalCarlos = new Evaluator({
        model,
        row: { Nome: 'Carlos', Pontos: 80 },
        rowIndex: 2,
        tableId: 'd_Cliente',
        tableName: 'd_Cliente',
        tables: [clientesTable],
        measures,
      });

      const resDense = evalCarlos.evaluate('RANKX(ALL(d_Cliente), d_Cliente[Pontos], , DESC, Dense)');
      expect(resDense).toBe(2);

      const evalAlice = new Evaluator({
        model,
        row: { Nome: 'Alice', Pontos: 100 },
        rowIndex: 0,
        tableId: 'd_Cliente',
        tableName: 'd_Cliente',
        tables: [clientesTable],
        measures,
      });
      expect(evalAlice.evaluate('RANKX(ALL(d_Cliente), d_Cliente[Pontos], , DESC, Dense)')).toBe(1);

      const evalDaniel = new Evaluator({
        model,
        row: { Nome: 'Daniel', Pontos: 60 },
        rowIndex: 3,
        tableId: 'd_Cliente',
        tableName: 'd_Cliente',
        tables: [clientesTable],
        measures,
      });
      expect(evalDaniel.evaluate('RANKX(ALL(d_Cliente), d_Cliente[Pontos], , DESC, Dense)')).toBe(3);
    });

    it('calculates Skip ranking with ties correctly', () => {
      // Alice and Bob both have 100 -> rank 1
      // Carlos has 80 -> rank 3 in Skip (since 2 rows are tied ahead of him)
      // Daniel has 60 -> rank 4 in Skip
      const evalCarlos = new Evaluator({
        model,
        row: { Nome: 'Carlos', Pontos: 80 },
        rowIndex: 2,
        tableId: 'd_Cliente',
        tableName: 'd_Cliente',
        tables: [clientesTable],
        measures,
      });

      const resSkip = evalCarlos.evaluate('RANKX(ALL(d_Cliente), d_Cliente[Pontos], , DESC, Skip)');
      expect(resSkip).toBe(3);

      const evalDaniel = new Evaluator({
        model,
        row: { Nome: 'Daniel', Pontos: 60 },
        rowIndex: 3,
        tableId: 'd_Cliente',
        tableName: 'd_Cliente',
        tables: [clientesTable],
        measures,
      });
      expect(evalDaniel.evaluate('RANKX(ALL(d_Cliente), d_Cliente[Pontos], , DESC, Skip)')).toBe(4);
    });

    it('supports ASC ordering in RANKX', () => {
      // Daniel has 60 -> rank 1 in ASC
      const evalDaniel = new Evaluator({
        model,
        row: { Nome: 'Daniel', Pontos: 60 },
        rowIndex: 3,
        tableId: 'd_Cliente',
        tableName: 'd_Cliente',
        tables: [clientesTable],
        measures,
      });
      expect(evalDaniel.evaluate('RANKX(ALL(d_Cliente), d_Cliente[Pontos], , ASC, Dense)')).toBe(1);
    });
  });

  describe('2. RANK.EQ and ROWNUMBER', () => {
    it('evaluates RANK.EQ correctly', () => {
      const evaluator = new Evaluator({
        model,
        tables: [clientesTable],
        measures,
      });

      // Rank of 80 in Pontos descending: 100, 100, 80, 60 -> rank 3
      const rank80Desc = evaluator.evaluate('RANK.EQ(80, d_Cliente[Pontos], 0)');
      expect(rank80Desc).toBe(3);

      // Rank of 80 in Pontos ascending: 60, 80, 100, 100 -> rank 2
      const rank80Asc = evaluator.evaluate('RANK.EQ(80, d_Cliente[Pontos], 1)');
      expect(rank80Asc).toBe(2);
    });

    it('evaluates ROWNUMBER sequentially within relations', () => {
      const evaluator = new Evaluator({
        model,
        tables: [clientesTable],
        measures,
      });

      const res = evaluator.evaluate('ROWNUMBER(d_Cliente, ORDERBY(d_Cliente[Pontos], DESC))');
      expect(isDaxTable(res)).toBe(true);
      expect(res.rows.length).toBe(4);
      expect(res.rows[0].RowNumber).toBe(1);
      expect(res.rows[3].RowNumber).toBe(4);
    });
  });

  describe('3. Dialect-specific INDEX()', () => {
    it('INDEX() with 0 arguments in column dialect returns 1-based row index', () => {
      const evaluator = new Evaluator({
        dialect: 'column',
        rowIndex: 4,
        row: { Val: 42 },
      });

      const res = evaluator.evaluate('INDEX()');
      expect(res).toBe(5);
    });
  });

  describe('4. Visual Calculations Safeguard (Anti-Measure Protection)', () => {
    it('throws clear DaxError if visual calculation function is called outside visual calculation context', () => {
      const standardEvaluator = new Evaluator({
        model,
        tables: [clientesTable],
        measures,
        isVisualCalculation: false,
      });

      expect(() => standardEvaluator.evaluate('RUNNINGSUM([TotalVendas])')).toThrowError(DaxError);
      expect(() => standardEvaluator.evaluate('PREVIOUS([TotalVendas])')).toThrowError(DaxError);
      expect(() => standardEvaluator.evaluate('COLLAPSE([TotalVendas])')).toThrowError(DaxError);
      expect(() => standardEvaluator.evaluate('COLLAPSEALL([TotalVendas])')).toThrowError(DaxError);
      expect(() => standardEvaluator.evaluate('MOVINGAVERAGE([TotalVendas], 3)')).toThrowError(DaxError);

      try {
        standardEvaluator.evaluate('RUNNINGSUM([TotalVendas])');
      } catch (err: any) {
        expect(err.message).toContain('Cálculos Visuais (Visual Calculations)');
        expect(err.kind).toBe('Semantic');
      }
    });
  });

  describe('5. Visual Calculations Execution (RUNNINGSUM, PREVIOUS, MOVINGAVERAGE, FIRST, LAST, COLLAPSEALL)', () => {
    const visualRows = [
      { Categoria: 'Eletrônicos', Total: 100 },
      { Categoria: 'Roupas', Total: 200 },
      { Categoria: 'Alimentos', Total: 300 },
      { Categoria: 'Livros', Total: 400 },
    ];

    it('evaluates RUNNINGSUM cumulatively across visual rows', () => {
      const results: number[] = [];
      for (let i = 0; i < visualRows.length; i++) {
        const evalContext = new Evaluator({
          model,
          isVisualCalculation: true,
          visualRows,
          visualRowIndex: i,
          row: visualRows[i],
          rowIndex: i,
        });
        results.push(evalContext.evaluate('RUNNINGSUM([Total])'));
      }

      expect(results).toEqual([100, 300, 600, 1000]);
    });

    it('evaluates PREVIOUS correctly returning BLANK on first row', () => {
      const prevVals: any[] = [];
      const diffVals: any[] = [];

      for (let i = 0; i < visualRows.length; i++) {
        const evalContext = new Evaluator({
          model,
          isVisualCalculation: true,
          visualRows,
          visualRowIndex: i,
          row: visualRows[i],
          rowIndex: i,
        });
        prevVals.push(evalContext.evaluate('PREVIOUS([Total])'));
        diffVals.push(evalContext.evaluate('[Total] - PREVIOUS([Total])'));
      }

      // First row has no previous -> BLANK
      expect(isBlank(prevVals[0])).toBe(true);
      expect(prevVals[1]).toBe(100);
      expect(prevVals[2]).toBe(200);
      expect(prevVals[3]).toBe(300);

      // Diff for row 0 is BLANK (or 100 - BLANK -> 100, depending on DAX arithmetic)
      expect(diffVals[1]).toBe(100); // 200 - 100
      expect(diffVals[2]).toBe(100); // 300 - 200
      expect(diffVals[3]).toBe(100); // 400 - 300
    });

    it('evaluates MOVINGAVERAGE correctly', () => {
      const maVals: number[] = [];
      for (let i = 0; i < visualRows.length; i++) {
        const evalContext = new Evaluator({
          model,
          isVisualCalculation: true,
          visualRows,
          visualRowIndex: i,
          row: visualRows[i],
          rowIndex: i,
        });
        maVals.push(evalContext.evaluate('MOVINGAVERAGE([Total], 2)'));
      }

      // window 2:
      // row 0: [100] -> 100
      // row 1: [100, 200] -> 150
      // row 2: [200, 300] -> 250
      // row 3: [300, 400] -> 350
      expect(maVals).toEqual([100, 150, 250, 350]);
    });

    it('evaluates FIRST, LAST, and COLLAPSEALL', () => {
      const evalMiddle = new Evaluator({
        model,
        isVisualCalculation: true,
        visualRows,
        visualRowIndex: 1, // 'Roupas'
        row: visualRows[1],
        rowIndex: 1,
      });

      expect(evalMiddle.evaluate('FIRST([Total])')).toBe(100);
      expect(evalMiddle.evaluate('LAST([Total])')).toBe(400);
      expect(evalMiddle.evaluate('COLLAPSEALL([Total])')).toBe(1000);
      expect(evalMiddle.evaluate('DIVIDE([Total], COLLAPSEALL([Total]))')).toBe(0.2); // 200 / 1000 = 0.2 (20%)
    });
  });

  describe('6. QueryPlanner Visual Calculation Integration', () => {
    it('executes visual calculations inside QueryPlanner and appends series and rawRows', () => {
      const planner = new QueryPlanner(model);

      const visual: Visual = {
        id: 'vis_test',
        type: 'bar',
        title: 'Vendas por Cliente',
        x: 0,
        y: 0,
        w: 400,
        h: 300,
        dataConfig: {
          tableId: 'd_Cliente',
          xAxisField: 'Nome',
          yAxisFields: ['Pontos'],
          aggregation: 'SUM',
          visualCalculations: [
            {
              id: 'vc_acc',
              name: 'PontosAcumulados',
              formula: 'RUNNINGSUM([Pontos])',
            },
            {
              id: 'vc_prev',
              name: 'DifAnterior',
              formula: '[Pontos] - PREVIOUS([Pontos])',
            },
          ],
        },
        formatConfig: {
          showTitle: true,
        },
      };

      const result = planner.query(visual, []);
      expect(result.categories.length).toBeGreaterThan(0);
      expect(result.series.length).toBe(3); // 'Pontos', 'PontosAcumulados', 'DifAnterior'

      const accSeries = result.series.find(s => s.name === 'PontosAcumulados');
      expect(accSeries).toBeDefined();
      expect(accSeries!.data.length).toBe(result.categories.length);

      // Verify that values are strictly increasing / cumulative
      let prev = 0;
      for (const val of accSeries!.data) {
        expect(val).toBeGreaterThanOrEqual(prev);
        prev = val;
      }
    });
  });
});
