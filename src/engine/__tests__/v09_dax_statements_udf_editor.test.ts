import { describe, it, expect, beforeEach } from 'vitest';
import { DaxEngine } from '../daxEngine';
import { InMemoryModelAccess } from '../model/modelAccess';
import { Table, Measure, UserDefinedFunction, Visual } from '../../types/bi';
import { DaxQueryParser } from '../expr/daxStatements';
import { DaxQueryExecutor } from '../query/daxQueryExecutor';
import { UdfManager } from '../model/udfManager';
import {
  extractFormulaDependencies,
  renameMeasureReferences,
  buildModelDependencyGraph,
  findDefinition,
} from '../model/dependencyGraph';
import { DaxError } from '../shared/errors';
import { getSignatureHelpAtOffset, getDaxGuideUrl } from '../shared/intellisense';

describe('V0.9 - DAX Statements, User Defined Functions (UDF), and Refactoring', () => {
  // Test Model
  let f_Vendas: Table;
  let d_Cal: Table;
  let d_Produtos: Table;
  let measures: Measure[];
  let model: InMemoryModelAccess;

  beforeEach(() => {
    f_Vendas = {
      id: 'f_Vendas',
      name: 'f_Vendas',
      originalName: 'f_Vendas',
      columns: [
        { id: 'c1', name: 'ID', originalName: 'ID', dataType: 'number' },
        { id: 'c2', name: 'Ano', originalName: 'Ano', dataType: 'number' },
        { id: 'c3', name: 'Receita', originalName: 'Receita', dataType: 'currency' },
        { id: 'c4', name: 'Custo', originalName: 'Custo', dataType: 'currency' },
        { id: 'c5', name: 'Qtd', originalName: 'Qtd', dataType: 'number' },
      ],
      rows: [
        { ID: 1, Ano: 2022, Receita: 10000, Custo: 6000, Qtd: 10 },
        { ID: 2, Ano: 2022, Receita: 15000, Custo: 9000, Qtd: 15 },
        { ID: 3, Ano: 2023, Receita: 20000, Custo: 12000, Qtd: 20 },
        { ID: 4, Ano: 2023, Receita: 30000, Custo: 17000, Qtd: 25 },
        { ID: 5, Ano: 2024, Receita: 40000, Custo: 22000, Qtd: 30 },
      ],
    };

    d_Cal = {
      id: 'd_Cal',
      name: 'd_Cal',
      originalName: 'd_Cal',
      columns: [
        { id: 'cal1', name: 'Ano', originalName: 'Ano', dataType: 'number' },
        { id: 'cal2', name: 'Semestre', originalName: 'Semestre', dataType: 'text' },
      ],
      rows: [
        { Ano: 2022, Semestre: 'S1' },
        { Ano: 2023, Semestre: 'S1' },
        { Ano: 2024, Semestre: 'S1' },
      ],
    };

    d_Produtos = {
      id: 'd_Produtos',
      name: 'd_Produtos',
      originalName: 'd_Produtos',
      columns: [
        { id: 'p1', name: 'Produto', originalName: 'Produto', dataType: 'text' },
        { id: 'p2', name: 'Categoria', originalName: 'Categoria', dataType: 'text' },
      ],
      rows: [
        { Produto: 'Notebook', Categoria: 'Eletrônicos' },
        { Produto: 'Cadeira', Categoria: 'Móveis' },
      ],
    };

    measures = [
      {
        id: 'm_receita',
        name: 'Receita',
        tableName: 'f_Vendas',
        formula: 'SUM(f_Vendas[Receita])',
        format: 'currency',
      },
      {
        id: 'm_custo',
        name: 'Custo',
        tableName: 'f_Vendas',
        formula: 'SUM(f_Vendas[Custo])',
        format: 'currency',
      },
      {
        id: 'm_lucro',
        name: 'Lucro Total',
        tableName: 'f_Vendas',
        formula: '[Receita] - [Custo]',
        format: 'currency',
      },
      {
        id: 'm_margem_pct',
        name: 'Margem %',
        tableName: 'f_Vendas',
        formula: 'DIVIDE([Lucro Total], [Receita], 0)',
        format: 'percentage',
      },
    ];

    model = new InMemoryModelAccess(
      [f_Vendas, d_Cal, d_Produtos],
      [
        {
          id: 'rel_vendas_cal',
          fromTable: 'f_Vendas',
          fromColumn: 'Ano',
          toTable: 'd_Cal',
          toColumn: 'Ano',
          cardinality: 'N:1',
          isActive: true,
          crossFilterDirection: 'both',
        },
      ],
      measures
    );

    UdfManager.setFunctions([]);
  });

  // ==========================================
  // 1. DAX Query Statements (DEFINE, EVALUATE, ORDER BY, START AT)
  // ==========================================
  describe('DAX Query Statements (dax.guide/statements)', () => {
    it('1. Acceptance Criterion: DEFINE MEASURE and EVALUATE with SUMMARIZECOLUMNS and ORDER BY', () => {
      // Prompt Acceptance criterion:
      // DEFINE MEASURE f_Vendas[Margem] = [Receita]-[Custo] EVALUATE SUMMARIZECOLUMNS(d_Cal[Ano]; "Margem"; [Margem]) ORDER BY d_Cal[Ano]
      const query = `
        DEFINE
          MEASURE f_Vendas[Margem] = [Receita] - [Custo]
        EVALUATE
          SUMMARIZECOLUMNS(
            d_Cal[Ano],
            "Margem", [Margem]
          )
        ORDER BY
          d_Cal[Ano] ASC
      `;

      const result = DaxEngine.executeDaxQuery(query, model);

      expect(result.success).toBe(true);
      expect(result.results.length).toBe(1);
      const resTable = result.results[0].table;
      expect(resTable).toBeDefined();
      expect(resTable.columns).toContain('Ano');
      expect(resTable.columns).toContain('Margem');
      expect(resTable.rows.length).toBe(3);

      // 2022: Receita = 25000, Custo = 15000 => Margem = 10000
      // 2023: Receita = 50000, Custo = 29000 => Margem = 21000
      // 2024: Receita = 40000, Custo = 22000 => Margem = 18000
      expect(resTable.rows[0].Ano).toBe(2022);
      expect(resTable.rows[0].Margem).toBe(10000);
      expect(resTable.rows[1].Ano).toBe(2023);
      expect(resTable.rows[1].Margem).toBe(21000);
      expect(resTable.rows[2].Ano).toBe(2024);
      expect(resTable.rows[2].Margem).toBe(18000);

      // Defined objects check
      expect(result.definedObjects?.measures.length).toBe(1);
      expect(result.definedObjects?.measures[0].name).toBe('Margem');
      expect(result.definedObjects?.measures[0].table).toBe('f_Vendas');
    });

    it('2. ORDER BY DESC sorts properly', () => {
      const query = `
        EVALUATE
          SUMMARIZECOLUMNS(
            d_Cal[Ano],
            "ReceitaTotal", [Receita]
          )
        ORDER BY
          [ReceitaTotal] DESC
      `;

      const result = DaxEngine.executeDaxQuery(query, model);
      expect(result.success).toBe(true);
      const rows = result.results[0].table.rows;
      // 2023 (50000), 2024 (40000), 2022 (25000)
      expect(rows[0].ReceitaTotal).toBe(50000);
      expect(rows[1].ReceitaTotal).toBe(40000);
      expect(rows[2].ReceitaTotal).toBe(25000);
    });

    it('3. START AT filters rows after the sort key cursor', () => {
      const query = `
        EVALUATE
          SUMMARIZECOLUMNS(
            d_Cal[Ano],
            "ReceitaTotal", [Receita]
          )
        ORDER BY
          d_Cal[Ano] ASC
        START AT
          2023
      `;

      const result = DaxEngine.executeDaxQuery(query, model);
      expect(result.success).toBe(true);
      const rows = result.results[0].table.rows;
      // Should filter out 2022 and keep 2023, 2024
      expect(rows.length).toBe(2);
      expect(rows[0].Ano).toBe(2023);
      expect(rows[1].Ano).toBe(2024);
    });

    it('4. DEFINE VAR and DEFINE TABLE scoped definitions', () => {
      const query = `
        DEFINE
          VAR Limite = 20000
          TABLE AnosRecentes = FILTER(d_Cal, d_Cal[Ano] >= 2023)
        EVALUATE
          AnosRecentes
      `;

      const result = DaxEngine.executeDaxQuery(query, model);
      expect(result.success).toBe(true);
      const rows = result.results[0].table.rows;
      expect(rows.length).toBe(2);
      expect(rows.map((r: any) => r.Ano)).toEqual([2023, 2024]);
    });

    it('5. Unsupported visual calculation statements raise clear DaxError', () => {
      // AXIS ROWS / AXIS COLUMNS / WITH VISUAL SHAPE / DENSIFY / MPARAMETER
      const visualQuery = `
        EVALUATE
          SUMMARIZECOLUMNS(d_Cal[Ano])
        AXIS ROWS
      `;

      const result = DaxEngine.executeDaxQuery(visualQuery, model);
      expect(result.success).toBe(false);
      expect(result.error).toContain('AXIS');
      expect(result.error).toContain('exclusiva para o pipeline de cálculos visuais');
    });

    it('6. Execution plan generates stages with timing metrics', () => {
      const query = `
        DEFINE
          MEASURE f_Vendas[Teste] = 42
        EVALUATE
          ROW("Valor", [Teste])
      `;

      const result = DaxEngine.executeDaxQuery(query, model);
      expect(result.success).toBe(true);
      expect(result.executionPlan.length).toBeGreaterThanOrEqual(3);
      expect(result.executionPlan.some(p => p.name.includes('Léxica'))).toBe(true);
      expect(result.executionPlan.some(p => p.name.includes('EVALUATE'))).toBe(true);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // 2. User Defined Functions (UDF)
  // ==========================================
  describe('User Defined Functions (UDF)', () => {
    it('1. Inline DEFINE FUNCTION evaluates correctly in DAX query', () => {
      const query = `
        DEFINE
          FUNCTION CustomCalc(a, b) = (a * 2) + b
        EVALUATE
          ROW("Resultado", CustomCalc(10, 5))
      `;

      const result = DaxEngine.executeDaxQuery(query, model);
      expect(result.success).toBe(true);
      expect(result.results[0].table.rows[0].Resultado).toBe(25);
    });

    it('2. Acceptance Criterion: Global UDF library can be used inside measures', () => {
      const marginUdf: UserDefinedFunction = {
        id: 'udf_margin',
        name: 'MargemCustom',
        parameters: ['rec', 'cust'],
        body: 'DIVIDE(rec - cust, rec, 0)',
        category: 'Financeiro',
      };

      DaxEngine.setUserDefinedFunctions([marginUdf]);

      // Use inside a standard DAX measure evaluation
      const evaluated = DaxEngine.evaluateWithContext('MargemCustom(100, 60)', model);
      expect(evaluated).toBe(0.4);

      // Use inside another measure formula
      const testMeasure: Measure = {
        id: 'm_test_udf',
        name: 'Margem Com UDF',
        tableName: 'f_Vendas',
        formula: 'MargemCustom([Receita], [Custo])',
        format: 'percentage',
      };
      model.addMeasure(testMeasure);

      const res = DaxEngine.evaluateWithContext('[Margem Com UDF]', model);
      // Total Receita = 115000, Total Custo = 66000 => (115000 - 66000) / 115000 = 49000 / 115000 ≈ 0.4260869
      expect(Number(res.toFixed(4))).toBe(0.4261);
    });

    it('3. UDF raises Semantic DaxError when argument count does not match', () => {
      const addUdf: UserDefinedFunction = {
        id: 'udf_add',
        name: 'SomaDois',
        parameters: ['x', 'y'],
        body: 'x + y',
      };
      DaxEngine.setUserDefinedFunctions([addUdf]);

      expect(() => {
        DaxEngine.evaluateWithContext('SomaDois(10)', model);
      }).toThrowError(/espera 2 argumento\(s\)/i);
    });

    it('4. UDF recursion detection prevents infinite stack overflow', () => {
      const recursiveUdf: UserDefinedFunction = {
        id: 'udf_rec',
        name: 'LoopInfinito',
        parameters: ['val'],
        body: 'LoopInfinito(val + 1)',
      };
      DaxEngine.setUserDefinedFunctions([recursiveUdf]);

      expect(() => {
        DaxEngine.evaluateWithContext('LoopInfinito(1)', model);
      }).toThrowError(/Referência circular detectada/i);
    });

    it('5. UDF JSON import and export', () => {
      const udfsToExport: UserDefinedFunction[] = [
        {
          id: 'u1',
          name: 'CalcTaxa',
          parameters: ['valor', 'taxa'],
          body: 'valor * taxa',
          category: 'Fiscal',
        },
      ];
      UdfManager.setFunctions(udfsToExport);

      const exportedJson = UdfManager.exportToJson();
      expect(exportedJson).toContain('CalcTaxa');

      // Clear and re-import
      UdfManager.setFunctions([]);
      const imported = UdfManager.importFromJson(exportedJson);
      expect(imported.imported).toBe(1);
      expect(UdfManager.getFunction('CalcTaxa')).toBeDefined();
    });
  });

  // ==========================================
  // 3. Measure Renaming and Dependency Refactoring
  // ==========================================
  describe('Measure Renaming & Dependency Graph', () => {
    it('1. Acceptance Criterion: Renaming a measure updates all dependent formulas', () => {
      // Existing measures:
      // [Receita] = SUM(f_Vendas[Receita])
      // [Custo] = SUM(f_Vendas[Custo])
      // [Lucro Total] = [Receita] - [Custo]
      // [Margem %] = DIVIDE([Lucro Total], [Receita], 0)

      const testVisuals: Visual[] = [
        {
          id: 'vis_1',
          type: 'card',
          title: 'Total Receita',
          x: 0,
          y: 0,
          w: 200,
          h: 100,
          formatConfig: {} as any,
          dataConfig: {
            tableId: 'f_Vendas',
            yAxisFields: ['Receita'],
          },
        },
      ];

      // Rename [Receita] to [Receita Bruta]
      const { updatedMeasures, updatedVisuals, affectedCount } = renameMeasureReferences(
        'Receita',
        'Receita Bruta',
        measures,
        testVisuals
      );

      expect(affectedCount).toBe(2); // [Lucro Total] and [Margem %]

      const renamedLucro = updatedMeasures.find(m => m.name === 'Lucro Total');
      expect(renamedLucro?.formula).toBe('[Receita Bruta] - [Custo]');

      const renamedMargem = updatedMeasures.find(m => m.name === 'Margem %');
      expect(renamedMargem?.formula).toBe('DIVIDE([Lucro Total], [Receita Bruta], 0)');

      // Visual was also updated
      expect(updatedVisuals[0].dataConfig.yAxisFields?.[0]).toBe('Receita Bruta');
    });

    it('2. Renaming does NOT corrupt substring collisions', () => {
      const customMeasures: Measure[] = [
        {
          id: 'm1',
          name: 'Total',
          tableName: 'f_Vendas',
          formula: '10',
          format: 'number',
        },
        {
          id: 'm2',
          name: 'Total Geral',
          tableName: 'f_Vendas',
          formula: '20',
          format: 'number',
        },
        {
          id: 'm3',
          name: 'Razao',
          tableName: 'f_Vendas',
          formula: '[Total] / [Total Geral]',
          format: 'number',
        },
      ];

      // Renaming [Total] to [Soma] must not affect [Total Geral] in formula!
      const { updatedMeasures } = renameMeasureReferences('Total', 'Soma', customMeasures);

      const mRazao = updatedMeasures.find(m => m.id === 'm3');
      expect(mRazao?.formula).toBe('[Soma] / [Total Geral]');
    });

    it('3. buildModelDependencyGraph maps nodes and reference edges', () => {
      const graph = buildModelDependencyGraph([f_Vendas, d_Cal], measures, []);

      // Expect nodes for tables, columns, and measures
      const measureNodes = graph.nodes.filter(n => n.type === 'measure');
      expect(measureNodes.length).toBe(4);

      // [Lucro Total] references [Receita] and [Custo]
      const lucroEdges = graph.edges.filter(
        e => e.fromId === 'msr_Lucro Total' && e.type === 'references'
      );
      expect(lucroEdges.some(e => e.toId === 'msr_Receita')).toBe(true);
      expect(lucroEdges.some(e => e.toId === 'msr_Custo')).toBe(true);
    });

    it('4. findDefinition locates measure or table accurately', () => {
      const defMeasure = findDefinition('[Lucro Total]', [f_Vendas], measures);
      expect(defMeasure.found).toBe(true);
      expect(defMeasure.node?.type).toBe('measure');
      expect(defMeasure.details?.formula).toBe('[Receita] - [Custo]');

      const defTable = findDefinition('f_Vendas', [f_Vendas], measures);
      expect(defTable.found).toBe(true);
      expect(defTable.node?.type).toBe('table');
    });
  });

  // ==========================================
  // 4. Intellisense & Helper Functions
  // ==========================================
  describe('DAX Intellisense & Helper Utilities', () => {
    it('1. getSignatureHelpAtOffset highlights active parameter index', () => {
      const text = 'CALCULATE([Total], FILTER(ALL(f_Vendas), f_Vendas[Qtd] > 0))';
      // Cursor inside FILTER(...)
      const offsetInsideFilter = text.indexOf('ALL(f_Vendas)') + 2;
      const sig = getSignatureHelpAtOffset(text, offsetInsideFilter);

      expect(sig).toBeDefined();
      expect(sig?.functionName).toBe('FILTER');
      expect(sig?.activeParameterIndex).toBe(0); // first parameter of FILTER (table)
    });

    it('2. getDaxGuideUrl produces valid dax.guide links', () => {
      expect(getDaxGuideUrl('CALCULATE')).toBe('https://dax.guide/calculate/');
      expect(getDaxGuideUrl('SUMMARIZECOLUMNS')).toBe('https://dax.guide/summarizecolumns/');
      expect(getDaxGuideUrl('STDEVX.P')).toBe('https://dax.guide/stdevx-p/');
    });
  });
});
