import { describe, it, expect } from 'vitest';
import { Evaluator } from '../expr/evaluator';
import { Table, Measure, Relationship } from '../../types/bi';
import { ModelAccess } from '../model/modelAccess';
import { FilterContext } from '../model/filterContext';
import { isDaxTable, isBlank, DAX_BLANK } from '../expr/types';
import { validateDateTable } from '../model/dateTable';
import { generateQuickMeasure } from '../expr/quickMeasures';
import { DaxEngine } from '../daxEngine';

// ModelAccess test implementation
class MockModel implements ModelAccess {
  private tablesMap: Map<string, Table> = new Map();
  private relationships: Relationship[] = [];
  private measuresMap: Map<string, Measure> = new Map();

  constructor(tables: Table[], relationships: Relationship[], measures: Measure[]) {
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

describe('V0.5: Inteligência Temporal (dax.guide)', () => {
  // 1. Build continuous Calendar table spanning 2022 to 2024 (1096 days)
  const calRows: Record<string, any>[] = [];
  const cur = new Date(Date.UTC(2022, 0, 1));
  const end = new Date(Date.UTC(2024, 11, 31));

  while (cur.getTime() <= end.getTime()) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth() + 1;
    const d = cur.getUTCDate();
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    calRows.push({
      Data: iso,
      Ano: y,
      Mes: m,
      AnoMes: ym,
      Dia: d,
    });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const d_Calendario: Table = {
    id: 'd_Calendario',
    name: 'd_Calendario',
    originalName: 'd_Calendario',
    isCalendar: true,
    calendarDateColumn: 'Data',
    fiscalYearEndMonth: 12,
    autoDateTimeEnabled: false,
    columns: [
      { id: 'c_data', name: 'Data', originalName: 'Data', dataType: 'date' },
      { id: 'c_ano', name: 'Ano', originalName: 'Ano', dataType: 'number' },
      { id: 'c_mes', name: 'Mes', originalName: 'Mes', dataType: 'number' },
      { id: 'c_anomes', name: 'AnoMes', originalName: 'AnoMes', dataType: 'text' },
      { id: 'c_dia', name: 'Dia', originalName: 'Dia', dataType: 'number' },
    ],
    rows: calRows,
  };

  // 2. Sales dataset across 2022, 2023, 2024
  const vendasRows = [
    // 2022 (No sales in Jan 2022 to test YoY blank in Jan 2023)
    { ID: 1, Data: '2022-03-15', Valor: 5000, Qtd: 10 },
    { ID: 2, Data: '2022-07-20', Valor: 8000, Qtd: 15 },
    { ID: 3, Data: '2022-11-10', Valor: 12000, Qtd: 20 },

    // 2023
    { ID: 4, Data: '2023-01-10', Valor: 15000, Qtd: 25 }, // YoY should be BLANK
    { ID: 5, Data: '2023-02-28', Valor: 4000, Qtd: 8 },   // End of Feb 2023
    { ID: 6, Data: '2023-08-15', Valor: 10000, Qtd: 18 },  // FY 2023/2024 test
    { ID: 7, Data: '2023-11-15', Valor: 10000, Qtd: 15 },  // Rolling avg test
    { ID: 8, Data: '2023-12-20', Valor: 20000, Qtd: 30 },  // Rolling avg test

    // 2024
    { ID: 9, Data: '2024-01-15', Valor: 30000, Qtd: 40 },  // Rolling avg test
    { ID: 10, Data: '2024-02-15', Valor: 40000, Qtd: 50 },
    { ID: 11, Data: '2024-02-29', Valor: 5000, Qtd: 5 },   // Leap year day!
    { ID: 12, Data: '2024-03-10', Valor: 50000, Qtd: 60 },
  ];

  const f_Vendas: Table = {
    id: 'f_Vendas',
    name: 'f_Vendas',
    originalName: 'f_Vendas',
    columns: [
      { id: 'v_id', name: 'ID', originalName: 'ID', dataType: 'number' },
      { id: 'v_data', name: 'Data', originalName: 'Data', dataType: 'date' },
      { id: 'v_valor', name: 'Valor', originalName: 'Valor', dataType: 'currency' },
      { id: 'v_qtd', name: 'Qtd', originalName: 'Qtd', dataType: 'number' },
    ],
    rows: vendasRows,
  };

  const relationships: Relationship[] = [
    {
      id: 'rel_vendas_cal',
      fromTable: 'f_Vendas',
      fromColumn: 'Data',
      toTable: 'd_Calendario',
      toColumn: 'Data',
      cardinality: 'N:1',
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
      id: 'm_qtd',
      name: 'QtdTotal',
      tableName: 'f_Vendas',
      formula: 'SUM(f_Vendas[Qtd])',
      format: 'number',
    },
  ];

  const model = new MockModel([f_Vendas, d_Calendario], relationships, measures);

  function evalDax(formula: string, filterCtx?: FilterContext): any {
    const evaluator = new Evaluator({
      dialect: 'dax',
      model,
      tables: model.getTables(),
      measures: model.getMeasures(),
      relationships: model.getRelationships(),
      filterContext: filterCtx,
    });
    return evaluator.evaluate(formula);
  }

  // =========================================================================
  // CRITERION 1: TOTALYTD in Mar/2024 equals Jan-Mar/2024 + Equivalence test
  // =========================================================================
  describe('Criterion 1: TOTALYTD and Equivalence with CALCULATE + DATESYTD', () => {
    it('calculates TOTALYTD([Total], d_Calendario[Data]) in Mar/2024 = Jan-Mar/2024 (125,000)', () => {
      // Filter context on Mar/2024
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2024-03']),
      });

      // In Mar/2024:
      // Jan/2024: 30,000
      // Feb/2024: 40,000 + 5,000 = 45,000
      // Mar/2024: 50,000
      // Jan-Mar Total = 125,000
      const totalYtd = evalDax('TOTALYTD([Total], d_Calendario[Data])', filterCtx);
      expect(totalYtd).toBe(125000);
    });

    it('verifies strict equivalence: TOTALYTD(expr, dates) ≡ CALCULATE(expr, DATESYTD(dates))', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2024-03']),
      });

      const ytdSugar = evalDax('TOTALYTD([Total], d_Calendario[Data])', filterCtx);
      const ytdExpanded = evalDax('CALCULATE([Total], DATESYTD(d_Calendario[Data]))', filterCtx);

      expect(ytdSugar).toBe(ytdExpanded);
      expect(ytdSugar).toBe(125000);
    });

    it('returns BLANK or 0 when no data exists in YTD period', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2021-01']), // Not in dataset
      });

      const res = evalDax('TOTALYTD([Total], d_Calendario[Data])', filterCtx);
      expect(isBlank(res) || res === 0).toBe(true);
    });
  });

  // =========================================================================
  // CRITERION 2: YoY in Jan/2023 returns BLANK without division error
  // =========================================================================
  describe('Criterion 2: YoY Growth when prior year is blank', () => {
    it('returns BLANK (not NaN, not Infinity) when prior year is blank in Jan/2023', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2023-01']),
      });

      // In Jan/2023: Total = 15,000. In Jan/2022: no sales (0 / BLANK).
      // Prior sales:
      const priorSales = evalDax('CALCULATE([Total], SAMEPERIODLASTYEAR(d_Calendario[Data]))', filterCtx);
      expect(isBlank(priorSales) || priorSales === 0).toBe(true);

      // YoY formula with DIVIDE
      const yoyFormula = 'DIVIDE([Total] - CALCULATE([Total], SAMEPERIODLASTYEAR(d_Calendario[Data])), CALCULATE([Total], SAMEPERIODLASTYEAR(d_Calendario[Data])))';
      const yoy = evalDax(yoyFormula, filterCtx);

      expect(isBlank(yoy)).toBe(true);
      expect(yoy).toBe(DAX_BLANK);
    });

    it('computes correct YoY when prior year data is present (Nov/2023 vs Nov/2022)', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2023-11']),
      });

      // Nov/2023 = 10,000; Nov/2022 = 12,000
      // YoY diff = 10,000 - 12,000 = -2000
      const diff = evalDax('[Total] - CALCULATE([Total], SAMEPERIODLASTYEAR(d_Calendario[Data]))', filterCtx);
      expect(diff).toBe(-2000);
    });
  });

  // =========================================================================
  // CRITERION 3: 3-month rolling average in Jan/2024 uses Nov/2023 - Jan/2024
  // =========================================================================
  describe('Criterion 3: 3M Rolling Average with DATESINPERIOD', () => {
    it('covers Nov/2023 - Jan/2024 for Jan/2024', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2024-01']),
      });

      // Nov/2023: 10,000
      // Dec/2023: 20,000
      // Jan/2024: 30,000
      // Sum in 3M window = 60,000. Divided by 3 = 20,000!
      const rollingSum = evalDax('CALCULATE([Total], DATESINPERIOD(d_Calendario[Data], LASTDATE(d_Calendario[Data]), -3, MONTH))', filterCtx);
      expect(rollingSum).toBe(60000);

      const rollingAvg = evalDax('DIVIDE(CALCULATE([Total], DATESINPERIOD(d_Calendario[Data], LASTDATE(d_Calendario[Data]), -3, MONTH)), 3)', filterCtx);
      expect(rollingAvg).toBe(20000);
    });
  });

  // =========================================================================
  // CRITERION 4: Fiscal year ending in June accumulates from 01/07
  // =========================================================================
  describe('Criterion 4: Fiscal Year with June 30 closure', () => {
    it('accumulates sales starting from 01/07/2023 when evaluated in Mar/2024', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2024-03']),
      });

      // Fiscal Year ending "06-30":
      // For Mar/2024, the FY began on 2023-07-01.
      // Sales between 2023-07-01 and 2024-03-31:
      // - 2023-08-15: 10,000
      // - 2023-11-15: 10,000
      // - 2023-12-20: 20,000
      // - 2024-01-15: 30,000
      // - 2024-02-15: 40,000
      // - 2024-02-29: 5,000
      // - 2024-03-10: 50,000
      // Total = 165,000
      const fiscalYtd = evalDax('TOTALYTD([Total], d_Calendario[Data], , "06-30")', filterCtx);
      expect(fiscalYtd).toBe(165000);
    });

    it('verifies DATESYTD with year_end_date parameter', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'Data', {
        tableId: 'd_Calendario',
        column: 'Data',
        allowedValues: new Set(['2024-03-15']),
      });

      const datesTbl = evalDax('DATESYTD(d_Calendario[Data], "06-30")', filterCtx);
      expect(isDaxTable(datesTbl)).toBe(true);
      expect(datesTbl.rows[0].Data).toBe('2023-07-01');
      expect(datesTbl.rows[datesTbl.rows.length - 1].Data).toBe('2024-03-15');
    });
  });

  // =========================================================================
  // CRITERION 5: SAMEPERIODLASTYEAR on 2024-02-29 yields 2023-02-28 (Leap Year)
  // =========================================================================
  describe('Criterion 5: SAMEPERIODLASTYEAR Leap Year End-of-Month Rule', () => {
    it('shifts 2024-02-29 to 2023-02-28', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'Data', {
        tableId: 'd_Calendario',
        column: 'Data',
        allowedValues: new Set(['2024-02-29']),
      });

      const shiftedTbl = evalDax('SAMEPERIODLASTYEAR(d_Calendario[Data])', filterCtx);
      expect(isDaxTable(shiftedTbl)).toBe(true);
      expect(shiftedTbl.rows.length).toBe(1);
      expect(shiftedTbl.rows[0].Data).toBe('2023-02-28');

      // And evaluates [Total] at 2023-02-28 which has Valor 4000
      const priorSales = evalDax('CALCULATE([Total], SAMEPERIODLASTYEAR(d_Calendario[Data]))', filterCtx);
      expect(priorSales).toBe(4000);
    });
  });

  // =========================================================================
  // Period functions: QTD, MTD, WTD, DATEADD, PARALLELPERIOD, PREVIOUS*, NEXT*
  // =========================================================================
  describe('Time Intelligence: Periods and Offsets', () => {
    it('evaluates TOTALQTD and TOTALMTD', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2024-02']),
      });

      // Q1 2024 up to Feb: Jan (30,000) + Feb (45,000) = 75,000
      const qtd = evalDax('TOTALQTD([Total], d_Calendario[Data])', filterCtx);
      expect(qtd).toBe(75000);

      // Feb 2024 MTD: 40,000 + 5,000 = 45,000
      const mtd = evalDax('TOTALMTD([Total], d_Calendario[Data])', filterCtx);
      expect(mtd).toBe(45000);
    });

    it('evaluates DATEADD with -1 MONTH and -1 YEAR', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2024-01']),
      });

      // -1 MONTH from Jan/2024 is Dec/2023 (Valor = 20,000)
      const prevMonthSales = evalDax('CALCULATE([Total], DATEADD(d_Calendario[Data], -1, MONTH))', filterCtx);
      expect(prevMonthSales).toBe(20000);

      // -1 YEAR from Jan/2024 is Jan/2023 (Valor = 15,000)
      const prevYearSales = evalDax('CALCULATE([Total], DATEADD(d_Calendario[Data], -1, YEAR))', filterCtx);
      expect(prevYearSales).toBe(15000);
    });

    it('evaluates PARALLELPERIOD', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'Data', {
        tableId: 'd_Calendario',
        column: 'Data',
        allowedValues: new Set(['2024-01-15']),
      });

      // PARALLELPERIOD -1 MONTH gives full Dec/2023
      const res = evalDax('CALCULATE([Total], PARALLELPERIOD(d_Calendario[Data], -1, MONTH))', filterCtx);
      expect(res).toBe(20000);
    });

    it('evaluates PREVIOUSMONTH and NEXTMONTH', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2024-01']),
      });

      const prevMonth = evalDax('CALCULATE([Total], PREVIOUSMONTH(d_Calendario[Data]))', filterCtx);
      expect(prevMonth).toBe(20000); // Dec/2023

      const nextMonth = evalDax('CALCULATE([Total], NEXTMONTH(d_Calendario[Data]))', filterCtx);
      expect(nextMonth).toBe(45000); // Feb/2024
    });

    it('evaluates DATESBETWEEN and DATESINPERIOD', () => {
      const betweenTbl = evalDax('DATESBETWEEN(d_Calendario[Data], DATE(2024, 1, 1), DATE(2024, 1, 10))');
      expect(isDaxTable(betweenTbl)).toBe(true);
      expect(betweenTbl.rows.length).toBe(10);
      expect(betweenTbl.rows[0].Data).toBe('2024-01-01');
      expect(betweenTbl.rows[9].Data).toBe('2024-01-10');
    });

    it('evaluates FIRSTDATE and LASTDATE', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2024-02']),
      });

      const firstD = evalDax('FIRSTDATE(d_Calendario[Data])', filterCtx);
      expect(isDaxTable(firstD)).toBe(true);
      expect(firstD.rows[0].Data).toBe('2024-02-01');

      const lastD = evalDax('LASTDATE(d_Calendario[Data])', filterCtx);
      expect(isDaxTable(lastD)).toBe(true);
      expect(lastD.rows[0].Data).toBe('2024-02-29');
    });

    it('evaluates STARTOFMONTH and ENDOFMONTH', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'Data', {
        tableId: 'd_Calendario',
        column: 'Data',
        allowedValues: new Set(['2024-02-15']),
      });

      const startM = evalDax('STARTOFMONTH(d_Calendario[Data])', filterCtx);
      expect(startM.rows[0].Data).toBe('2024-02-01');

      const endM = evalDax('ENDOFMONTH(d_Calendario[Data])', filterCtx);
      expect(endM.rows[0].Data).toBe('2024-02-29');
    });
  });

  // =========================================================================
  // Balances and Non-Blank functions
  // =========================================================================
  describe('Balance and Non-Blank Functions', () => {
    it('evaluates CLOSINGBALANCEMONTH', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2024-02']),
      });

      // On 2024-02-29, Valor is 5000
      const closing = evalDax('CLOSINGBALANCEMONTH([Total], d_Calendario[Data])', filterCtx);
      expect(closing).toBe(5000);
    });

    it('evaluates FIRSTNONBLANKVALUE and LASTNONBLANKVALUE', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2024-02']),
      });

      // In Feb 2024:
      // First date with sales is 2024-02-15 (Valor 40000)
      // Last date with sales is 2024-02-29 (Valor 5000)
      const firstVal = evalDax('FIRSTNONBLANKVALUE(d_Calendario[Data], [Total])', filterCtx);
      expect(firstVal).toBe(40000);

      const lastVal = evalDax('LASTNONBLANKVALUE(d_Calendario[Data], [Total])', filterCtx);
      expect(lastVal).toBe(5000);
    });

    it('evaluates ISAFTER and ISONORAFTER tuples', () => {
      const t1 = evalDax('ISAFTER(DATE(2024, 2, 1), DATE(2024, 1, 1), ASC)');
      expect(t1).toBe(true);

      const t2 = evalDax('ISAFTER(DATE(2024, 1, 1), DATE(2024, 1, 1), ASC)');
      expect(t2).toBe(false);

      const t3 = evalDax('ISONORAFTER(DATE(2024, 1, 1), DATE(2024, 1, 1), ASC)');
      expect(t3).toBe(true);
    });
  });

  // =========================================================================
  // Calendar Table Validation & Diagnostics
  // =========================================================================
  describe('Date Model Validation (validateDateTable)', () => {
    it('validates a continuous date table successfully', () => {
      const diag = validateDateTable(d_Calendario, 'Data');
      expect(diag.isValid).toBe(true);
      expect(diag.isContinuous).toBe(true);
      expect(diag.hasNulls).toBe(false);
      expect(diag.hasDuplicates).toBe(false);
      expect(diag.totalDays).toBe(1096);
      expect(diag.expectedDays).toBe(1096);
      expect(diag.errors.length).toBe(0);
    });

    it('detects gaps in a broken date table', () => {
      const brokenTable: Table = {
        id: 'broken_cal',
        name: 'broken_cal',
        originalName: 'broken_cal',
        columns: [{ id: 'd', name: 'Data', originalName: 'Data', dataType: 'date' }],
        rows: [
          { Data: '2024-01-01' },
          { Data: '2024-01-02' },
          // Gap: 01-03 and 01-04 missing!
          { Data: '2024-01-05' },
        ],
      };

      const diag = validateDateTable(brokenTable, 'Data');
      expect(diag.isValid).toBe(false);
      expect(diag.isContinuous).toBe(false);
      expect(diag.totalDays).toBe(3);
      expect(diag.expectedDays).toBe(5);
      expect(diag.errors.some(e => e.includes('não é contínua'))).toBe(true);
    });

    it('detects duplicate dates', () => {
      const dupTable: Table = {
        id: 'dup_cal',
        name: 'dup_cal',
        originalName: 'dup_cal',
        columns: [{ id: 'd', name: 'Data', originalName: 'Data', dataType: 'date' }],
        rows: [
          { Data: '2024-01-01' },
          { Data: '2024-01-01' }, // Duplicate!
          { Data: '2024-01-02' },
        ],
      };

      const diag = validateDateTable(dupTable, 'Data');
      expect(diag.isValid).toBe(false);
      expect(diag.hasDuplicates).toBe(true);
      expect(diag.errors.some(e => e.includes('duplicadas'))).toBe(true);
    });
  });

  // =========================================================================
  // Quick Measures Generator Tests
  // =========================================================================
  describe('Quick Measure Generator (DaxEngine.generateQuickMeasure)', () => {
    it('generates YTD, QTD, and MTD formulas', () => {
      const ytd = DaxEngine.generateQuickMeasure('ytd', 'Total', 'Data', 'f_Vendas');
      expect(ytd.formula).toBe("TOTALYTD([Total], 'f_Vendas'[Data])");

      const qtd = DaxEngine.generateQuickMeasure('qtd', 'Total', 'Data', 'f_Vendas');
      expect(qtd.formula).toBe("TOTALQTD([Total], 'f_Vendas'[Data])");

      const mtd = DaxEngine.generateQuickMeasure('mtd', 'Total', 'Data', 'f_Vendas');
      expect(mtd.formula).toBe("TOTALMTD([Total], 'f_Vendas'[Data])");
    });

    it('generates YoY growth and YoY diff formulas', () => {
      const yoyGrowth = DaxEngine.generateQuickMeasure('yoy_growth', 'Total', 'Data', 'f_Vendas');
      expect(yoyGrowth.formula).toContain('SAMEPERIODLASTYEAR');
      expect(yoyGrowth.formula).toContain('DIVIDE');

      const yoyDiff = DaxEngine.generateQuickMeasure('yoy_diff', 'Total', 'Data', 'f_Vendas');
      expect(yoyDiff.formula).toContain('SAMEPERIODLASTYEAR');
      expect(yoyDiff.formula).toContain('-');
    });

    it('generates rolling average formula with DATESINPERIOD', () => {
      const rolling = generateQuickMeasure('rolling_avg', 'Total', 'Data', 'f_Vendas', { periods: 3 });
      expect(rolling.formula).toContain('DATESINPERIOD');
      expect(rolling.formula).toContain('-3, MONTH');
    });

    it('evaluates generated quick measure on active model without error', () => {
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('d_Calendario', 'AnoMes', {
        tableId: 'd_Calendario',
        column: 'AnoMes',
        allowedValues: new Set(['2024-02']),
      });

      const ytdGen = DaxEngine.generateQuickMeasure('ytd', 'Total', 'd_Calendario[Data]', 'f_Vendas');
      const evaluated = evalDax(ytdGen.formula, filterCtx);
      expect(evaluated).toBe(75000); // Jan (30k) + Feb (45k)
    });
  });
});
