import { describe, it, expect, beforeEach } from 'vitest';
import { DAX_CATALOG, getDaxCatalogStats } from '../compliance/daxCatalog';
import { BitSet } from '../perf/experimental/bitSet';
import { NumericColumnBuffer } from '../perf/experimental/typedColumnBuffers';
import { DaxLruCache, hashFilterContext, globalDaxLruCache } from '../perf/lruCache';
import { DaxWorkerClient } from '../perf/experimental/daxWorkerClient';
import { PerformanceAnalyzer } from '../perf/experimental/perfAnalyzer';
import { DaxEngine } from '../daxEngine';
import { Evaluator } from '../expr/evaluator';
import { FilterContext } from '../model/filterContext';
import { InMemoryModelAccess } from '../model/modelAccess';
import { DAX_BLANK } from '../expr/types';
import { DaxError } from '../shared/errors';
import { Table, Measure } from '../../types/bi';

describe('V1.0 - DAX Compliance, High Performance & Fuzzing Suite', () => {
  let sampleTables: Table[];
  let sampleMeasures: Measure[];
  let model: InMemoryModelAccess;

  beforeEach(() => {
    sampleTables = [
      {
        id: 'tbl_vendas',
        name: 'f_Vendas',
        originalName: 'f_Vendas',
        columns: [
          { id: 'c1', name: 'ID', originalName: 'ID', dataType: 'number' },
          { id: 'c2', name: 'ValorTotal', originalName: 'ValorTotal', dataType: 'number' },
          { id: 'c3', name: 'Quantidade', originalName: 'Quantidade', dataType: 'number' },
          { id: 'c4', name: 'Canal', originalName: 'Canal', dataType: 'text' },
          { id: 'c5', name: 'Data', originalName: 'Data', dataType: 'date' },
        ],
        rows: [
          { ID: 1, ValorTotal: 100, Quantidade: 2, Canal: 'Online', Data: '2023-01-10' },
          { ID: 2, ValorTotal: 250, Quantidade: 5, Canal: 'Loja', Data: '2023-02-15' },
          { ID: 3, ValorTotal: null, Quantidade: 0, Canal: 'Online', Data: '2023-03-20' },
          { ID: 4, ValorTotal: 400, Quantidade: 4, Canal: 'Direto', Data: '2023-04-25' },
          { ID: 5, ValorTotal: 50, Quantidade: 1, Canal: 'Loja', Data: '2023-05-30' },
        ],
      },
      {
        id: 'tbl_clientes',
        name: 'd_Clientes',
        originalName: 'd_Clientes',
        columns: [
          { id: 'cc1', name: 'ID', originalName: 'ID', dataType: 'number' },
          { id: 'cc2', name: 'Nome', originalName: 'Nome', dataType: 'text' },
          { id: 'cc3', name: 'Regiao', originalName: 'Regiao', dataType: 'text' },
        ],
        rows: [
          { ID: 1, Nome: 'Ana', Regiao: 'Sudeste' },
          { ID: 2, Nome: 'Bruno', Regiao: 'Sul' },
          { ID: 3, Nome: 'Carla', Regiao: 'Sudeste' },
        ],
      },
    ];

    sampleMeasures = [
      {
        id: 'm1',
        name: 'Total Vendas',
        tableName: 'f_Vendas',
        tableId: 'tbl_vendas',
        formula: 'SUM(f_Vendas[ValorTotal])',
        format: 'number',
      },
      {
        id: 'm2',
        name: 'Qtd Total',
        tableName: 'f_Vendas',
        tableId: 'tbl_vendas',
        formula: 'SUM(f_Vendas[Quantidade])',
        format: 'number',
      },
    ];

    model = new InMemoryModelAccess(sampleTables, [], sampleMeasures);
    DaxEngine.setModelAccess(model);
    globalDaxLruCache.clear();
  });

  // ==========================================
  // 1. DAX COMPLIANCE CATALOG TESTS
  // ==========================================
  describe('1. Compliance Catalog & dax.guide Index', () => {
    it('should have complete catalog entries across all DAX categories', () => {
      expect(DAX_CATALOG.length).toBeGreaterThanOrEqual(40);
      const stats = getDaxCatalogStats();
      expect(stats.total).toBe(DAX_CATALOG.length);
      expect(stats.complete).toBeGreaterThan(30);
      expect(stats.compliancePercentage).toBeGreaterThanOrEqual(80);
    });

    it('should have valid dax.guide URLs and non-empty syntax for all catalog items', () => {
      for (const item of DAX_CATALOG) {
        expect(item.daxGuideUrl).toMatch(/^https:\/\/dax\.guide\//);
        expect(item.syntax.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
        expect(item.category.length).toBeGreaterThan(0);
      }
    });

    it('should correctly flag recent changelog & preview functions as pending or complete', () => {
      const changelogItems = DAX_CATALOG.filter(c => c.isRecentChangelog);
      expect(changelogItems.length).toBeGreaterThan(0);
      const tobit = DAX_CATALOG.find(c => c.name === 'TOBIT');
      expect(tobit).toBeDefined();
      expect(tobit?.status).toBe('pending_changelog');
    });
  });

  // ==========================================
  // 2. HIGH PERFORMANCE BITSET TESTS (EXPERIMENTAL)
  // ==========================================
  describe('experimental: 2. BitSet Vector Filtering', () => {
    it('should correctly set, clear, and get individual bit states', () => {
      const bs = new BitSet(100);
      expect(bs.get(5)).toBe(false);
      bs.set(5);
      expect(bs.get(5)).toBe(true);
      bs.set(99);
      expect(bs.get(99)).toBe(true);
      bs.clear(5);
      expect(bs.get(5)).toBe(false);
      expect(bs.get(99)).toBe(true);
    });

    it('should perform fast bitwise AND intersection', () => {
      const bs1 = new BitSet(50);
      const bs2 = new BitSet(50);
      bs1.set(10).set(20).set(30);
      bs2.set(20).set(30).set(40);

      const intersection = bs1.and(bs2);
      expect(intersection.get(10)).toBe(false);
      expect(intersection.get(20)).toBe(true);
      expect(intersection.get(30)).toBe(true);
      expect(intersection.get(40)).toBe(false);
      expect(intersection.cardinality()).toBe(2);
      expect(intersection.toArray()).toEqual([20, 30]);
    });

    it('should perform fast bitwise OR union', () => {
      const bs1 = new BitSet(20);
      const bs2 = new BitSet(20);
      bs1.set(2).set(4);
      bs2.set(4).set(6);

      const union = bs1.or(bs2);
      expect(union.cardinality()).toBe(3);
      expect(union.toArray()).toEqual([2, 4, 6]);
    });

    it('should correctly invert bits using NOT', () => {
      const bs = new BitSet(5);
      bs.set(0).set(2);
      const inverted = bs.not();
      expect(inverted.get(0)).toBe(false);
      expect(inverted.get(1)).toBe(true);
      expect(inverted.get(2)).toBe(false);
      expect(inverted.get(3)).toBe(true);
      expect(inverted.get(4)).toBe(true);
      expect(inverted.cardinality()).toBe(3);
    });
  });

  // ==========================================
  // 3. VECTORIZED TYPED COLUMN BUFFERS (EXPERIMENTAL)
  // ==========================================
  describe('experimental: 3. Vectorized Column Buffers (TypedArrays)', () => {
    it('should construct buffer with Float64Array and validity mask for nulls and blanks', () => {
      const raw = [10, null, 25, undefined, '50', ''];
      const buffer = NumericColumnBuffer.fromArray(raw);

      expect(buffer.length).toBe(6);
      expect(buffer.validMask.get(0)).toBe(true);
      expect(buffer.validMask.get(1)).toBe(false); // null
      expect(buffer.validMask.get(2)).toBe(true);
      expect(buffer.validMask.get(3)).toBe(false); // undefined
      expect(buffer.validMask.get(4)).toBe(true); // '50' -> 50
      expect(buffer.validMask.get(5)).toBe(false); // empty string
    });

    it('should compute vectorized SUM, AVERAGE, MIN, MAX with zero box/unbox overhead', () => {
      const raw = [100, 200, null, 300, 400];
      const buffer = NumericColumnBuffer.fromArray(raw);

      expect(buffer.sum()).toBe(1000);
      expect(buffer.average()).toBe(250);
      expect(buffer.min()).toBe(100);
      expect(buffer.max()).toBe(400);
      expect(buffer.count()).toBe(4);
    });

    it('should compute aggregations over an active BitSet row mask', () => {
      const raw = [10, 20, 30, 40, 50];
      const buffer = NumericColumnBuffer.fromArray(raw);
      const mask = new BitSet(5);
      mask.set(1).set(3); // indices 1 (20) and 3 (40)

      expect(buffer.sum(mask)).toBe(60);
      expect(buffer.average(mask)).toBe(30);
      expect(buffer.min(mask)).toBe(20);
      expect(buffer.max(mask)).toBe(40);
      expect(buffer.count(mask)).toBe(2);
    });

    it('should return DAX_BLANK when all rows are blank/null', () => {
      const raw = [null, null, undefined];
      const buffer = NumericColumnBuffer.fromArray(raw);

      expect(buffer.sum()).toBe(DAX_BLANK);
      expect(buffer.average()).toBe(DAX_BLANK);
      expect(buffer.min()).toBe(DAX_BLANK);
      expect(buffer.max()).toBe(DAX_BLANK);
      expect(buffer.count()).toBe(0);
    });
  });

  // ==========================================
  // 4. LRU CACHE & FILTER CONTEXT HASHING
  // ==========================================
  describe('4. LRU Cache & Context Hashing', () => {
    it('should cache results and track hit/miss/eviction metrics', () => {
      const cache = new DaxLruCache<string, number>(3);
      cache.set('k1', 10);
      cache.set('k2', 20);
      cache.set('k3', 30);

      expect(cache.get('k1')).toBe(10); // hit
      expect(cache.get('k99')).toBeUndefined(); // miss

      // Add 4th item, should evict k2 (oldest unaccessed since k1 was accessed)
      cache.set('k4', 40);
      expect(cache.has('k2')).toBe(false);
      expect(cache.has('k1')).toBe(true);

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.evictions).toBe(1);
      expect(stats.hitRatio).toBe(0.5);
    });

    it('should generate deterministic hashes for filter context', () => {
      const ctx1 = new FilterContext();
      ctx1.setColumnFilter('f_Vendas', 'Canal', {
        tableId: 'tbl_vendas',
        column: 'Canal',
        allowedValues: new Set(['Online', 'Loja']),
      });

      const ctx2 = new FilterContext();
      ctx2.setColumnFilter('f_Vendas', 'Canal', {
        tableId: 'tbl_vendas',
        column: 'Canal',
        allowedValues: new Set(['Loja', 'Online']), // reversed insertion order
      });

      const hash1 = hashFilterContext(ctx1, 'SUM(f_Vendas[ValorTotal])');
      const hash2 = hashFilterContext(ctx2, 'SUM(f_Vendas[ValorTotal])');
      expect(hash1).toBe(hash2);
    });
  });

  // ==========================================
  // 5. ASYNC CLIENT & TRANSPARENT FALLBACK (EXPERIMENTAL)
  // ==========================================
  describe('experimental: 5. DaxWorkerClient & Async Fallback', () => {
    it('should evaluate expression via async client with transparent fallback', async () => {
      const client = new DaxWorkerClient();
      const res = await client.evaluateAsync(
        'SUM(f_Vendas[ValorTotal])',
        sampleTables,
        sampleMeasures
      );
      // 100 + 250 + 400 + 50 = 800
      expect(res).toBe(800);
    });

    it('should execute DAX query statement via async client', async () => {
      const client = new DaxWorkerClient();
      const res = await client.executeQueryAsync(
        'EVALUATE ROW("Total", SUM(f_Vendas[ValorTotal]))',
        { tables: sampleTables, measures: sampleMeasures }
      );
      expect(res.success).toBe(true);
      expect(res.results.length).toBe(1);
    });
  });

  // ==========================================
  // 6. ENGINE GUARDRAILS (LIMITS & TIMEOUTS)
  // ==========================================
  describe('6. Engine Guardrails & Limits', () => {
    it('should enforce maxRecursionDepth to prevent stack overflows', () => {
      const recursiveMeasures: Measure[] = [
        {
          id: 'rm1',
          name: 'RecA',
          tableName: 'f_Vendas',
          tableId: 'tbl_vendas',
          formula: '[RecB] + 1',
          format: 'number',
        },
        {
          id: 'rm2',
          name: 'RecB',
          tableName: 'f_Vendas',
          tableId: 'tbl_vendas',
          formula: '[RecA] + 1',
          format: 'number',
        },
      ];

      expect(() => {
        DaxEngine.evaluate('[RecA]', sampleTables, recursiveMeasures);
      }).toThrow();
    });

    it('should enforce recursion limit with custom maxRecursionDepth', () => {
      const deepMeasures: Measure[] = [];
      for (let i = 0; i < 15; i++) {
        deepMeasures.push({
          id: `m_${i}`,
          name: `Measure_${i}`,
          tableName: 'f_Vendas',
          tableId: 'tbl_vendas',
          formula: i === 0 ? '10' : `[Measure_${i - 1}] + 1`,
          format: 'number',
        });
      }

      const evaluator = new Evaluator({
        measures: deepMeasures,
        tables: sampleTables,
        maxRecursionDepth: 5,
      });

      expect(() => {
        evaluator.evaluate('[Measure_10]');
      }).toThrow(/Profundidade máxima de recursão excedida/);
    });

    it('should guard against explosive Cartesian products in CROSSJOIN', () => {
      const t1 = {
        id: 't1',
        name: 'T1',
        originalName: 'T1',
        columns: [{ id: 'c1', name: 'A', originalName: 'A', dataType: 'number' as const }],
        rows: Array.from({ length: 100 }, (_, i) => ({ A: i })),
      };
      const t2 = {
        id: 't2',
        name: 'T2',
        originalName: 'T2',
        columns: [{ id: 'c2', name: 'B', originalName: 'B', dataType: 'number' as const }],
        rows: Array.from({ length: 100 }, (_, i) => ({ B: i })),
      };

      const customModel = new InMemoryModelAccess([t1, t2], [], []);
      const evaluator = new Evaluator({
        tables: [t1, t2],
        model: customModel,
        maxCartesianProductRows: 500, // 100 * 100 = 10,000 > 500
      });

      expect(() => {
        evaluator.evaluate('CROSSJOIN(T1, T2)');
      }).toThrow(/Limite de produto cartesiano excedido/);
    });

    it('should enforce query timeout deadline', () => {
      const evaluator = new Evaluator({
        tables: sampleTables,
        measures: sampleMeasures,
        deadline: Date.now() - 100, // already expired
        timeoutMs: 100,
      });

      expect(() => {
        evaluator.evaluate('SUM(f_Vendas[ValorTotal])');
      }).toThrow(/Tempo limite da avaliação DAX excedido/);
    });
  });

  // ==========================================
  // 7. PERFORMANCE ANALYZER & ANTI-PATTERNS (EXPERIMENTAL)
  // ==========================================
  describe('experimental: 7. Performance Analyzer & Anti-Pattern Diagnostic', () => {
    it('should detect FILTER(ALL(...)) anti-pattern', () => {
      const report = PerformanceAnalyzer.analyzeQuery(
        'CALCULATE([Total], FILTER(ALL(f_Vendas), f_Vendas[Valor] > 100))',
        { formulaEngineMs: 30, storageEngineMs: 5 }
      );
      expect(report.antiPatternsDetected.some(p => p.pattern.includes('FILTER(ALL'))).toBe(true);
      expect(report.suggestions.length).toBeGreaterThan(0);
    });

    it('should detect repeated measure recalculation without VAR', () => {
      const report = PerformanceAnalyzer.analyzeQuery(
        'IF([Total Vendas] > 100, [Total Vendas] * 1.1, [Total Vendas] * 0.9)',
        { formulaEngineMs: 40, storageEngineMs: 10 }
      );
      expect(report.antiPatternsDetected.some(p => p.pattern.includes('sem VAR'))).toBe(true);
    });
  });

  // ==========================================
  // 8. FUZZING & EDGE CASES
  // ==========================================
  describe('8. Parser Fuzzing & Malformed Expressions', () => {
    it('should handle unclosed brackets and parentheses with clean DaxError', () => {
      const malformed = [
        'SUM(f_Vendas[ValorTotal]',
        'CALCULATE([Total Vendas',
        'IF(1 > 0, "A",',
        '1 + + * 4',
        'FILTER(f_Vendas,',
      ];

      for (const formula of malformed) {
        expect(() => {
          DaxEngine.evaluate(formula, sampleTables, sampleMeasures);
        }).toThrow();
      }
    });

    it('should correctly evaluate nested VAR / RETURN blocks', () => {
      const dax = `
        VAR A = 10
        VAR B = 20
        VAR C =
          VAR D = 5
          RETURN D * 2
        RETURN (A + B) * C
      `;
      // (10 + 20) * 10 = 300
      const res = DaxEngine.evaluate(dax, sampleTables, sampleMeasures);
      expect(res).toBe(300);
    });
  });

  // ==========================================
  // 9. CROSS-VERSION REGRESSION VERIFICATION
  // ==========================================
  describe('9. Full Engine Compatibility & Regression', () => {
    it('should compute standard SUM, CALCULATE, and SUMX with exact expected values', () => {
      // SUM
      const sumVal = DaxEngine.evaluate('SUM(f_Vendas[ValorTotal])', sampleTables, sampleMeasures);
      expect(sumVal).toBe(800);

      // CALCULATE with filter
      const calcVal = DaxEngine.evaluate(
        'CALCULATE(SUM(f_Vendas[ValorTotal]), f_Vendas[Canal] = "Online")',
        sampleTables,
        sampleMeasures
      );
      // Online rows: ID 1 (100) + ID 3 (null) = 100
      expect(calcVal).toBe(100);

      // SUMX iterator
      const sumxVal = DaxEngine.evaluate(
        'SUMX(f_Vendas, f_Vendas[ValorTotal] * 2)',
        sampleTables,
        sampleMeasures
      );
      // 100*2 + 250*2 + 400*2 + 50*2 = 1600
      expect(sumxVal).toBe(1600);
    });
  });
});
