import { describe, it, expect } from 'vitest';
import { Evaluator } from '../expr/evaluator';
import { Table, Measure, Relationship } from '../../types/bi';
import { ModelAccess } from '../model/modelAccess';
import { FilterContext } from '../model/filterContext';
import { syncWhatIfWithModel } from '../migrations';
import { isDaxTable } from '../expr/types';

// Mock model for testing V0.4
class MockModel implements ModelAccess {
  private tablesMap: Map<string, Table> = new Map();
  private relationships: Relationship[] = [];
  private measuresMap: Map<string, Measure> = new Map();

  constructor(tables: Table[], relationships: Relationship[], measures: Measure[]) {
    tables.forEach(t => this.tablesMap.set(t.id, t));
    this.relationships = relationships;
    measures.forEach(m => this.measuresMap.set(m.id, m));
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
    for (const m of this.measuresMap.values()) {
      if (m.id === idOrName || m.name.toLowerCase() === clean) {
        return m;
      }
    }
    return undefined;
  }
}

describe('V0.4: Iteradores e Tabelas (dax.guide)', () => {
  // Test dataset: f_Vendas, d_Produto, d_Cliente
  const d_Produto: Table = {
    id: 'd_Produto',
    name: 'd_Produto',
    originalName: 'd_Produto',
    columns: [
      { id: 'c1', name: 'ID_Produto', originalName: 'ID_Produto', dataType: 'number', isCalculated: false },
      { id: 'c2', name: 'Nome', originalName: 'Nome', dataType: 'text', isCalculated: false },
      { id: 'c3', name: 'Categoria', originalName: 'Categoria', dataType: 'text', isCalculated: false },
      { id: 'c4', name: 'Preco', originalName: 'Preco', dataType: 'number', isCalculated: false },
    ],
    rows: [
      { ID_Produto: 1, Nome: 'Notebook Pro', Categoria: 'Eletrônicos', Preco: 5000 },
      { ID_Produto: 2, Nome: 'Mouse Sem Fio', Categoria: 'Acessórios', Preco: 150 },
      { ID_Produto: 3, Nome: 'Teclado Mecânico', Categoria: 'Acessórios', Preco: 350 },
      { ID_Produto: 4, Nome: 'Monitor 4K', Categoria: 'Eletrônicos', Preco: 2500 },
      { ID_Produto: 5, Nome: 'Cadeira Ergonômica', Categoria: 'Móveis', Preco: 1200 },
      { ID_Produto: 6, Nome: 'Headset Gamer', Categoria: 'Acessórios', Preco: 400 },
    ],
  };

  const d_Cliente: Table = {
    id: 'd_Cliente',
    name: 'd_Cliente',
    originalName: 'd_Cliente',
    columns: [
      { id: 'c5', name: 'ID_Cliente', originalName: 'ID_Cliente', dataType: 'number', isCalculated: false },
      { id: 'c6', name: 'Cliente', originalName: 'Cliente', dataType: 'text', isCalculated: false },
      { id: 'c7', name: 'Cidade', originalName: 'Cidade', dataType: 'text', isCalculated: false },
    ],
    rows: [
      { ID_Cliente: 10, Cliente: 'Alpha Corp', Cidade: 'São Paulo' },
      { ID_Cliente: 20, Cliente: 'Beta LLC', Cidade: 'Curitiba' },
      { ID_Cliente: 30, Cliente: 'Gamma SA', Cidade: 'Belo Horizonte' },
    ],
  };

  const f_Vendas: Table = {
    id: 'f_Vendas',
    name: 'f_Vendas',
    originalName: 'f_Vendas',
    columns: [
      { id: 'c8', name: 'ID_Venda', originalName: 'ID_Venda', dataType: 'number', isCalculated: false },
      { id: 'c9', name: 'ID_Produto', originalName: 'ID_Produto', dataType: 'number', isCalculated: false },
      { id: 'c10', name: 'ID_Cliente', originalName: 'ID_Cliente', dataType: 'number', isCalculated: false },
      { id: 'c11', name: 'Qtd', originalName: 'Qtd', dataType: 'number', isCalculated: false },
      { id: 'c12', name: 'Valor', originalName: 'Valor', dataType: 'number', isCalculated: false },
    ],
    rows: [
      // Alpha: Notebook (1x5000) + Mouse (2x150 = 300) = 5300
      { ID_Venda: 101, ID_Produto: 1, ID_Cliente: 10, Qtd: 1, Valor: 5000 },
      { ID_Venda: 102, ID_Produto: 2, ID_Cliente: 10, Qtd: 2, Valor: 300 },
      // Beta: Teclado (1x350) + Monitor (2x2500 = 5000) = 5350
      { ID_Venda: 103, ID_Produto: 3, ID_Cliente: 20, Qtd: 1, Valor: 350 },
      { ID_Venda: 104, ID_Produto: 4, ID_Cliente: 20, Qtd: 2, Valor: 5000 },
      // Gamma: Cadeira (1x1200) + Headset (3x400 = 1200) = 2400
      { ID_Venda: 105, ID_Produto: 5, ID_Cliente: 30, Qtd: 1, Valor: 1200 },
      { ID_Venda: 106, ID_Produto: 6, ID_Cliente: 30, Qtd: 3, Valor: 1200 },
    ],
  };

  const relationships: Relationship[] = [
    {
      id: 'rel_vendas_prod',
      fromTable: 'f_Vendas',
      fromColumn: 'ID_Produto',
      toTable: 'd_Produto',
      toColumn: 'ID_Produto',
      cardinality: '1:N',
      crossFilterDirection: 'single',
      isActive: true,
    },
    {
      id: 'rel_vendas_cli',
      fromTable: 'f_Vendas',
      fromColumn: 'ID_Cliente',
      toTable: 'd_Cliente',
      toColumn: 'ID_Cliente',
      cardinality: '1:N',
      crossFilterDirection: 'single',
      isActive: true,
    },
  ];

  const measures: Measure[] = [
    {
      id: 'm_total',
      name: 'Total',
      tableName: 'f_Vendas',
      formula: 'SUM(f_Vendas[Valor])',
      format: 'currency',
    },
    {
      id: 'm_qtd_total',
      name: 'Qtd Total',
      tableName: 'f_Vendas',
      formula: 'SUM(f_Vendas[Qtd])',
      format: 'number',
    },
  ];

  const model = new MockModel([f_Vendas, d_Produto, d_Cliente], relationships, measures);

  const evalDax = (expr: string, filterCtx?: FilterContext) => {
    const evaluator = new Evaluator({
      dialect: 'dax',
      model,
      tables: [f_Vendas, d_Produto, d_Cliente],
      measures,
      filterContext: filterCtx,
    });
    return evaluator.evaluate(expr);
  };

  describe('Critérios de Aceite Obrigatórios V0.4', () => {
    it('1. SUMX(f_Vendas; f_Vendas[Qtd]*RELATED(d_Produto[Preco])) correto sob filtros', () => {
      // Total sem filtros adicionais:
      // (1*5000) + (2*150) + (1*350) + (2*2500) + (1*1200) + (3*400)
      // = 5000 + 300 + 350 + 5000 + 1200 + 1200 = 13050
      const expr = 'SUMX(f_Vendas, f_Vendas[Qtd] * RELATED(d_Produto[Preco]))';
      expect(evalDax(expr)).toBe(13050);

      // Sob filtro d_Cliente[Cidade] = "São Paulo" (apenas ID_Cliente 10: Vendas 101 e 102 = 5000 + 300 = 5300)
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Cliente', 'Cidade', {
        tableId: 'd_Cliente',
        column: 'Cidade',
        allowedValues: new Set(['São Paulo']),
      });
      const evalFiltered = new Evaluator({
        dialect: 'dax',
        model,
        tables: [f_Vendas, d_Produto, d_Cliente],
        measures,
        filterContext: filterCtx,
      });
      expect(evalFiltered.evaluate(expr)).toBe(5300);
    });

    it('2. SUMX(VALUES(d_Cliente[Cliente]); [Total]) com context transition', () => {
      // Alpha Corp: 5300, Beta LLC: 5350, Gamma SA: 2400. Sum = 13050
      const expr = 'SUMX(VALUES(d_Cliente[Cliente]), [Total])';
      expect(evalDax(expr)).toBe(13050);

      // Sob filtro de categoria "Eletrônicos"
      // Alpha tem Notebook (5000), Beta tem Monitor (5000), Gamma não tem. Total = 10000
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Produto', 'Categoria', {
        tableId: 'd_Produto',
        column: 'Categoria',
        allowedValues: new Set(['Eletrônicos']),
      });
      const evalFiltered = new Evaluator({
        dialect: 'dax',
        model,
        tables: [f_Vendas, d_Produto, d_Cliente],
        measures,
        filterContext: filterCtx,
      });
      expect(evalFiltered.evaluate(expr)).toBe(10000);
    });

    it('3. TOPN(5; VALUES(d_Produto[Nome]); [Total]; DESC) também como filtro dentro de CALCULATE', () => {
      // Produtos por [Total]:
      // 1. Notebook Pro (5000)
      // 2. Monitor 4K (5000)
      // 3. Cadeira Ergonômica (1200)
      // 4. Headset Gamer (1200)
      // 5. Teclado Mecânico (350)
      // 6. Mouse Sem Fio (300)
      // TOP 5 produtos total = 5000 + 5000 + 1200 + 1200 + 350 = 12750 (excluindo Mouse 300)
      const topNExpr = 'CALCULATE([Total], TOPN(5, VALUES(d_Produto[Nome]), [Total], DESC))';
      expect(evalDax(topNExpr)).toBe(12750);

      // TOP 1 produto
      const top1Expr = 'CALCULATE([Total], TOPN(1, VALUES(d_Produto[Nome]), [Total], DESC))';
      expect(evalDax(top1Expr)).toBe(5000);
    });

    it('4. SUMMARIZECOLUMNS iguala o visual equivalente, inclusive totais', () => {
      // Agrupamento por d_Cliente[Cliente] com [Total]
      const expr = 'SUMMARIZECOLUMNS(d_Cliente[Cliente], "Total Vendas", [Total])';
      const res = evalDax(expr);
      expect(isDaxTable(res)).toBe(true);
      expect(res.columns).toContain('Cliente');
      expect(res.columns).toContain('Total Vendas');
      expect(res.rows.length).toBe(3);

      const alphaRow = res.rows.find((r: any) => r.Cliente === 'Alpha Corp');
      expect(alphaRow?.['Total Vendas']).toBe(5300);

      // Com ROLLUPADDISSUBTOTAL
      const rollupExpr = 'SUMMARIZECOLUMNS(ROLLUPADDISSUBTOTAL(d_Cliente[Cliente], "IsSubtotal"), "Total Vendas", [Total])';
      const rollupRes = evalDax(rollupExpr);
      expect(rollupRes.rows.length).toBe(4); // 3 clientes + 1 grand total
      const grandTotalRow = rollupRes.rows.find((r: any) => r.IsSubtotal === true);
      expect(grandTotalRow).toBeDefined();
      expect(grandTotalRow?.['Total Vendas']).toBe(13050);
    });

    it('5. GENERATESERIES(1;10;2) = 1,3,5,7,9', () => {
      const res = evalDax('GENERATESERIES(1, 10, 2)');
      expect(isDaxTable(res)).toBe(true);
      expect(res.columns).toEqual(['Value']);
      const values = res.rows.map((r: any) => r.Value);
      expect(values).toEqual([1, 3, 5, 7, 9]);

      // Decrementing series
      const decRes = evalDax('GENERATESERIES(10, 2, -2)');
      expect(decRes.rows.map((r: any) => r.Value)).toEqual([10, 8, 6, 4, 2]);
    });

    it('6. What-if "Reajuste combustível %" altera a medida de custo sem quebrar projetos antigos', () => {
      const whatIfList = [
        {
          id: 'p_reajuste_combustivel',
          name: 'Reajuste Combustível %',
          min: -20,
          max: 50,
          step: 5,
          defaultValue: 0,
          currentValue: 15,
          unit: '%',
        },
      ];

      const synced = syncWhatIfWithModel(whatIfList, [f_Vendas], measures);
      const whatIfTable = synced.tables.find(t => t.name === 'Reajuste Combustível %');
      expect(whatIfTable).toBeDefined();
      expect(whatIfTable?.isCalculated).toBe(true);
      expect(whatIfTable?.expression).toBe('GENERATESERIES(-20, 50, 5)');

      const whatIfMeasure = synced.measures.find(m => m.name === 'Reajuste Combustível % Valor');
      expect(whatIfMeasure).toBeDefined();
      expect(whatIfMeasure?.formula).toContain('SELECTEDVALUE');

      // Evaluator with synced model
      const evalModel = new MockModel(synced.tables, [], synced.measures);
      const evalWhatIf = new Evaluator({
        dialect: 'dax',
        model: evalModel,
        tables: synced.tables,
        measures: synced.measures,
      });

      // Measure evaluates to currentValue (15)
      expect(evalWhatIf.evaluate('[Reajuste Combustível % Valor]')).toBe(15);
    });
  });

  describe('Funções de Iteração DAX', () => {
    it('AVERAGEX e MEDIANX', () => {
      // F_Vendas Valor: 5000, 300, 350, 5000, 1200, 1200
      // Sum = 13050, count = 6 -> avg = 2175
      expect(evalDax('AVERAGEX(f_Vendas, f_Vendas[Valor])')).toBe(2175);

      // Median of [300, 350, 1200, 1200, 5000, 5000] -> (1200 + 1200)/2 = 1200
      expect(evalDax('MEDIANX(f_Vendas, f_Vendas[Valor])')).toBe(1200);
    });

    it('GEOMEANX', () => {
      // Test geometric mean of { 2, 8 }: sqrt(16) = 4
      expect(evalDax('GEOMEANX({ 2, 8 }, [Value])')).toBeCloseTo(4, 5);
    });

    it('COUNTX e COUNTAX', () => {
      expect(evalDax('COUNTX(f_Vendas, f_Vendas[Valor])')).toBe(6);
      expect(evalDax('COUNTAX(d_Cliente, d_Cliente[Cliente])')).toBe(3);
    });

    it('MINX e MAXX', () => {
      expect(evalDax('MINX(f_Vendas, f_Vendas[Valor])')).toBe(300);
      expect(evalDax('MAXX(f_Vendas, f_Vendas[Valor])')).toBe(5000);
    });

    it('PRODUCTX', () => {
      expect(evalDax('PRODUCTX({ 2, 3, 4 }, [Value])')).toBe(24);
    });

    it('CONCATENATEX com delimitador e ordenação', () => {
      // Alphabetical order: Alpha Corp, Beta LLC, Gamma SA
      const ascExpr = 'CONCATENATEX(d_Cliente, d_Cliente[Cliente], ", ", d_Cliente[Cliente], ASC)';
      expect(evalDax(ascExpr)).toBe('Alpha Corp, Beta LLC, Gamma SA');

      // Descending order: Gamma SA, Beta LLC, Alpha Corp
      const descExpr = 'CONCATENATEX(d_Cliente, d_Cliente[Cliente], ", ", d_Cliente[Cliente], DESC)';
      expect(evalDax(descExpr)).toBe('Gamma SA, Beta LLC, Alpha Corp');
    });

    it('ADDCOLUMNS e SELECTCOLUMNS', () => {
      const addExpr = 'ADDCOLUMNS(d_Cliente, "Total Comprado", [Total])';
      const addRes = evalDax(addExpr);
      expect(isDaxTable(addRes)).toBe(true);
      expect(addRes.columns).toContain('Cliente');
      expect(addRes.columns).toContain('Total Comprado');
      expect(addRes.rows.find((r: any) => r.Cliente === 'Alpha Corp')?.['Total Comprado']).toBe(5300);

      const selExpr = 'SELECTCOLUMNS(d_Cliente, "NomeCliente", d_Cliente[Cliente])';
      const selRes = evalDax(selExpr);
      expect(isDaxTable(selRes)).toBe(true);
      expect(selRes.columns).toEqual(['NomeCliente']);
      expect(selRes.rows.length).toBe(3);
    });

    it('GENERATE e GENERATEALL', () => {
      const genExpr = 'GENERATE(VALUES(d_Cliente[Cidade]), VALUES(d_Produto[Categoria]))';
      const genRes = evalDax(genExpr);
      expect(isDaxTable(genRes)).toBe(true);
      // 3 cidades x 3 categorias = 9 linhas
      expect(genRes.rows.length).toBe(9);
    });
  });

  describe('Funções de Tabela e Construtores', () => {
    it('ROW constructor', () => {
      const res = evalDax('ROW("Total", 1000, "Nome", "Teste")');
      expect(isDaxTable(res)).toBe(true);
      expect(res.columns).toEqual(['Total', 'Nome']);
      expect(res.rows).toEqual([{ Total: 1000, Nome: 'Teste' }]);
    });

    it('UNION, INTERSECT, EXCEPT', () => {
      const uRes = evalDax('UNION({ 1, 2 }, { 2, 3 })');
      expect(isDaxTable(uRes)).toBe(true);
      expect(uRes.rows.map((r: any) => r.Value)).toEqual([1, 2, 2, 3]);

      const iRes = evalDax('INTERSECT({ 1, 2, 3 }, { 2, 3, 4 })');
      expect(iRes.rows.map((r: any) => r.Value)).toEqual([2, 3]);

      const eRes = evalDax('EXCEPT({ 1, 2, 3 }, { 2, 3, 4 })');
      expect(eRes.rows.map((r: any) => r.Value)).toEqual([1]);
    });

    it('CROSSJOIN', () => {
      const cRes = evalDax('CROSSJOIN({ "A", "B" }, { 1, 2 })');
      expect(isDaxTable(cRes)).toBe(true);
      expect(cRes.rows.length).toBe(4);
    });

    it('NATURALINNERJOIN e NATURALLEFTOUTERJOIN', () => {
      const t1 = 'DATATABLE("ID", INTEGER, "Nome", STRING, { {1, "A"}, {2, "B"} })';
      const t2 = 'DATATABLE("ID", INTEGER, "Desc", STRING, { {1, "Info1"}, {3, "Info3"} })';

      const innerRes = evalDax(`NATURALINNERJOIN(${t1}, ${t2})`);
      expect(innerRes.rows.length).toBe(1);
      expect(innerRes.rows[0].Nome).toBe('A');
      expect(innerRes.rows[0].Desc).toBe('Info1');

      const leftRes = evalDax(`NATURALLEFTOUTERJOIN(${t1}, ${t2})`);
      expect(leftRes.rows.length).toBe(2);
    });

    it('GROUPBY e CURRENTGROUP', () => {
      const res = evalDax('GROUPBY(d_Produto, d_Produto[Categoria], "Contagem", COUNTX(CURRENTGROUP(), 1))');
      expect(isDaxTable(res)).toBe(true);
      expect(res.rows.length).toBe(3); // Eletrônicos, Acessórios, Móveis
    });

    it('NAMEOF', () => {
      expect(evalDax('NAMEOF([Total])')).toBe('Total');
      expect(evalDax('NAMEOF(d_Produto[Preco])')).toBe('Preco');
    });

    it('Funções combinatórias: COMBIN, COMBINA, PERMUT', () => {
      expect(evalDax('COMBIN(8, 2)')).toBe(28); // 8! / (2! * 6!) = 28
      expect(evalDax('COMBINA(4, 3)')).toBe(20); // (4+3-1)! / (3! * 3!) = 20
      expect(evalDax('PERMUT(5, 3)')).toBe(60); // 5! / 2! = 60
    });
  });
});
