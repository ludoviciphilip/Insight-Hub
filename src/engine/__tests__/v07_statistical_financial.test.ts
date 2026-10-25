import { describe, it, expect, beforeEach } from 'vitest';
import { DaxEngine } from '../daxEngine';
import { InMemoryModelAccess } from '../model/modelAccess';
import { createMockDataset } from './fixtures/mockDataset';
import { DaxError } from '../shared/errors';
import { generateQuickMeasure } from '../expr/quickMeasures';
import { Table } from '../../types/bi';

describe('V0.7 - Statistical and Financial Functions', () => {
  let model: InMemoryModelAccess;

  beforeEach(() => {
    const data = createMockDataset();

    // Additional table for financial flows & investment testing
    const f_FluxoCaixa: Table = {
      id: 'f_FluxoCaixa',
      name: 'f_FluxoCaixa',
      originalName: 'f_FluxoCaixa',
      columns: [
        { id: 'fc1', name: 'ID_Lancamento', originalName: 'ID_Lancamento', dataType: 'text' },
        { id: 'fc2', name: 'Data', originalName: 'Data', dataType: 'date' },
        { id: 'fc3', name: 'Valor', originalName: 'Valor', dataType: 'currency' },
      ],
      rows: [
        { ID_Lancamento: 'L01', Data: '2008-01-01', Valor: -10000 },
        { ID_Lancamento: 'L02', Data: '2008-03-01', Valor: 2750 },
        { ID_Lancamento: 'L03', Data: '2008-10-30', Valor: 4250 },
        { ID_Lancamento: 'L04', Data: '2009-02-15', Valor: 3250 },
        { ID_Lancamento: 'L05', Data: '2009-04-01', Valor: 2750 },
      ],
    };

    // Table with positive ratios for GEOMEAN
    const f_Rendimento: Table = {
      id: 'f_Rendimento',
      name: 'f_Rendimento',
      originalName: 'f_Rendimento',
      columns: [
        { id: 'r1', name: 'Ano', originalName: 'Ano', dataType: 'number' },
        { id: 'r2', name: 'Fator', originalName: 'Fator', dataType: 'number' },
      ],
      rows: [
        { Ano: 2021, Fator: 1.10 },
        { Ano: 2022, Fator: 1.20 },
        { Ano: 2023, Fator: 1.15 },
        { Ano: 2024, Fator: 1.05 },
      ],
    };

    model = new InMemoryModelAccess(
      [...data.tables, f_FluxoCaixa, f_Rendimento],
      data.relationships,
      data.measures
    );
    DaxEngine.setModelAccess(model);
  });

  // ==========================================
  // Acceptance Criteria
  // ==========================================
  describe('Acceptance Criteria', () => {
    it('PMT(0.01, 12, -1000) ≈ 88.8488', () => {
      const res = DaxEngine.evaluateWithContext('PMT(0.01, 12, -1000)', model);
      expect(res).toBeCloseTo(88.8488, 4);
    });

    it('XIRR matches Excel to 6 decimal places (~0.373363)', () => {
      const res = DaxEngine.evaluateWithContext(
        "XIRR(f_FluxoCaixa, f_FluxoCaixa[Valor], f_FluxoCaixa[Data])",
        model
      );
      expect(res).toBeCloseTo(0.373363, 6);
    });

    it('NORM.S.INV(0.975) ≈ 1.95996', () => {
      const res = DaxEngine.evaluateWithContext('NORM.S.INV(0.975)', model);
      expect(res).toBeCloseTo(1.95996, 5);
    });

    it('STDEV.S ≠ STDEV.P (sample vs population)', () => {
      const sSample = DaxEngine.evaluateWithContext('STDEV.S(f_Vendas[ValorTotal])', model);
      const sPop = DaxEngine.evaluateWithContext('STDEV.P(f_Vendas[ValorTotal])', model);
      // f_Vendas has values [17000, 3200, 5800, 2890]
      expect(sSample).not.toBe(sPop);
      expect(sSample).toBeGreaterThan(sPop);
      expect(sSample).toBeCloseTo(6647.66, 1);
      expect(sPop).toBeCloseTo(5757.04, 1);
    });

    it('LINESTX returns slope and intercept table/values', () => {
      // f_Logistica has:
      // Km: [430, 410, 580]
      // Custo: [1250, 1100, 1680]
      const linestTable = DaxEngine.evaluateWithContext(
        'LINESTX(f_Logistica, f_Logistica[CustoTotalViagem], f_Logistica[KmRodado])',
        model
      );
      expect(linestTable.__isDaxTable).toBe(true);
      expect(linestTable.rows.length).toBe(1);
      expect(linestTable.rows[0].Slope1).toBeGreaterThan(0);
      expect(linestTable.rows[0].Intercept).toBeDefined();

      // Regression slope: (Km: [430, 410, 580], Custo: [1250, 1100, 1680])
      // Slope ≈ 3.2066, Intercept ≈ -174.44
      expect(linestTable.rows[0].Slope1).toBeCloseTo(3.2066, 3);
      expect(linestTable.rows[0].Intercept).toBeCloseTo(-174.44, 1);
    });
  });

  // ==========================================
  // Statistical Functions
  // ==========================================
  describe('Statistical Functions', () => {
    it('GEOMEAN and GEOMEANX compute geometric mean of positive numbers', () => {
      // Factors: [1.10, 1.20, 1.15, 1.05]
      // Product: 1.10 * 1.20 * 1.15 * 1.05 = 1.5939
      // GeoMean = 1.5939^(1/4) ≈ 1.12359
      const gMean = DaxEngine.evaluateWithContext('GEOMEAN(f_Rendimento[Fator])', model);
      expect(gMean).toBeCloseTo(1.12359, 4);

      const gMeanX = DaxEngine.evaluateWithContext('GEOMEANX(f_Rendimento, f_Rendimento[Fator])', model);
      expect(gMeanX).toBeCloseTo(1.12359, 4);
    });

    it('GEOMEAN throws DaxError on non-positive values', () => {
      expect(() => {
        DaxEngine.evaluateWithContext('GEOMEAN(f_FluxoCaixa[Valor])', model);
      }).toThrowError(/positivos/i);
    });

    it('MEDIAN and MEDIANX compute median correctly', () => {
      // f_Vendas[ValorTotal]: [17000, 3200, 5800, 2890] => sorted: [2890, 3200, 5800, 17000]
      // Even count: (3200 + 5800) / 2 = 4500
      const med = DaxEngine.evaluateWithContext('MEDIAN(f_Vendas[ValorTotal])', model);
      expect(med).toBe(4500);

      const medX = DaxEngine.evaluateWithContext('MEDIANX(f_Vendas, f_Vendas[ValorTotal])', model);
      expect(medX).toBe(4500);
    });

    it('VAR.S and VAR.P compute sample and population variances', () => {
      const varS = DaxEngine.evaluateWithContext('VAR.S(f_Vendas[ValorTotal])', model);
      const varP = DaxEngine.evaluateWithContext('VAR.P(f_Vendas[ValorTotal])', model);
      expect(varS).toBeGreaterThan(varP);
      expect(varS).toBeCloseTo(44191358.33, 1);
      expect(varP).toBeCloseTo(33143518.75, 1);
    });

    it('VARX.S and VARX.P evaluate expression on table', () => {
      const varXS = DaxEngine.evaluateWithContext('VARX.S(f_Vendas, f_Vendas[ValorTotal])', model);
      const varXP = DaxEngine.evaluateWithContext('VARX.P(f_Vendas, f_Vendas[ValorTotal])', model);
      expect(varXS).toBeCloseTo(44191358.33, 1);
      expect(varXP).toBeCloseTo(33143518.75, 1);
    });

    it('PERCENTILE.INC and PERCENTILE.EXC calculate interpolated percentiles', () => {
      // f_Vendas[Quantidade]: [2, 1, 4, 1] => sorted: [1, 1, 2, 4]
      // k = 0.5 (median)
      const pInc = DaxEngine.evaluateWithContext('PERCENTILE.INC(f_Vendas[Quantidade], 0.5)', model);
      expect(pInc).toBe(1.5);

      const pXInc = DaxEngine.evaluateWithContext('PERCENTILEX.INC(f_Vendas, f_Vendas[Quantidade], 0.5)', model);
      expect(pXInc).toBe(1.5);

      // PERCENTILE.EXC with k = 0.4
      const pExc = DaxEngine.evaluateWithContext('PERCENTILE.EXC(f_Vendas[Quantidade], 0.4)', model);
      expect(pExc).toBeDefined();
    });

    it('PERCENTILE.EXC throws error if k is out of sample bounds', () => {
      // For n=4, valid range is (1/5, 4/5) = (0.2, 0.8)
      expect(() => {
        DaxEngine.evaluateWithContext('PERCENTILE.EXC(f_Vendas[Quantidade], 0.1)', model);
      }).toThrowError(/intervalo/i);
    });

    it('LINEST column syntax returns regression statistics', () => {
      const linest = DaxEngine.evaluateWithContext('LINEST(f_Logistica[CustoTotalViagem], f_Logistica[KmRodado])', model);
      expect(linest.__isDaxTable).toBe(true);
      expect(linest.rows[0].Slope1).toBeCloseTo(3.2066, 3);
    });
  });

  // ==========================================
  // Probability Distributions
  // ==========================================
  describe('Probability Distributions', () => {
    it('NORM.DIST and NORM.INV', () => {
      const pdf = DaxEngine.evaluateWithContext('NORM.DIST(42, 40, 1.5, FALSE)', model);
      const cdf = DaxEngine.evaluateWithContext('NORM.DIST(42, 40, 1.5, TRUE)', model);
      expect(pdf).toBeCloseTo(0.10934, 4);
      expect(cdf).toBeCloseTo(0.908789, 5);

      const inv = DaxEngine.evaluateWithContext('NORM.INV(0.908789, 40, 1.5)', model);
      expect(inv).toBeCloseTo(42, 3);
    });

    it('NORM.S.DIST and NORM.S.INV', () => {
      const cdf = DaxEngine.evaluateWithContext('NORM.S.DIST(1.96, TRUE)', model);
      expect(cdf).toBeCloseTo(0.975002, 5);

      const z = DaxEngine.evaluateWithContext('NORM.S.INV(0.975)', model);
      expect(z).toBeCloseTo(1.95996, 5);
    });

    it('T.DIST, T.DIST.2T, T.DIST.RT, T.INV, T.INV.2T', () => {
      const cdf = DaxEngine.evaluateWithContext('T.DIST(2.228, 10, TRUE)', model);
      expect(cdf).toBeCloseTo(0.975, 2);

      const t2t = DaxEngine.evaluateWithContext('T.DIST.2T(2.228, 10)', model);
      expect(t2t).toBeCloseTo(0.05, 2);

      const trt = DaxEngine.evaluateWithContext('T.DIST.RT(2.228, 10)', model);
      expect(trt).toBeCloseTo(0.025, 2);

      const inv2t = DaxEngine.evaluateWithContext('T.INV.2T(0.05, 10)', model);
      expect(inv2t).toBeCloseTo(2.228, 2);

      const inv = DaxEngine.evaluateWithContext('T.INV(0.975, 10)', model);
      expect(inv).toBeCloseTo(2.228, 2);
    });

    it('CHISQ.DIST, CHISQ.DIST.RT, CHISQ.INV, CHISQ.INV.RT', () => {
      const cdf = DaxEngine.evaluateWithContext('CHISQ.DIST(18.307, 10, TRUE)', model);
      expect(cdf).toBeCloseTo(0.95, 2);

      const rt = DaxEngine.evaluateWithContext('CHISQ.DIST.RT(18.307, 10)', model);
      expect(rt).toBeCloseTo(0.05, 2);

      const inv = DaxEngine.evaluateWithContext('CHISQ.INV(0.95, 10)', model);
      expect(inv).toBeCloseTo(18.307, 2);

      const invRt = DaxEngine.evaluateWithContext('CHISQ.INV.RT(0.05, 10)', model);
      expect(invRt).toBeCloseTo(18.307, 2);
    });

    it('BETA.DIST and BETA.INV', () => {
      const cdf = DaxEngine.evaluateWithContext('BETA.DIST(2, 8, 10, TRUE, 1, 3)', model);
      expect(cdf).toBeCloseTo(0.68547, 4);

      const inv = DaxEngine.evaluateWithContext('BETA.INV(0.68547, 8, 10, 1, 3)', model);
      expect(inv).toBeCloseTo(2, 2);
    });

    it('EXPON.DIST and POISSON.DIST', () => {
      const expCdf = DaxEngine.evaluateWithContext('EXPON.DIST(0.2, 10, TRUE)', model);
      expect(expCdf).toBeCloseTo(1 - Math.exp(-2), 5);

      const pCdf = DaxEngine.evaluateWithContext('POISSON.DIST(2, 5, TRUE)', model);
      expect(pCdf).toBeCloseTo(0.12465, 4);
    });

    it('CONFIDENCE.NORM and CONFIDENCE.T', () => {
      const cNorm = DaxEngine.evaluateWithContext('CONFIDENCE.NORM(0.05, 2.5, 50)', model);
      expect(cNorm).toBeCloseTo(0.69295, 4);

      const cT = DaxEngine.evaluateWithContext('CONFIDENCE.T(0.05, 2.5, 50)', model);
      expect(cT).toBeCloseTo(0.71049, 4);
    });
  });

  // ==========================================
  // Financial Functions
  // ==========================================
  describe('Financial Functions', () => {
    it('PV, FV, NPER, RATE consistency', () => {
      // 1000 loan, 1% per period, 12 periods => PMT ≈ 88.8488
      const pmt = DaxEngine.evaluateWithContext('PMT(0.01, 12, -1000)', model);
      expect(pmt).toBeCloseTo(88.8488, 4);

      const pv = DaxEngine.evaluateWithContext(`PV(0.01, 12, ${pmt})`, model);
      expect(pv).toBeCloseTo(-1000, 2);

      const fv = DaxEngine.evaluateWithContext('FV(0.05 / 12, 12 * 10, -100)', model);
      expect(fv).toBeCloseTo(15528.23, 2);

      const nper = DaxEngine.evaluateWithContext(`NPER(0.01, ${pmt}, -1000)`, model);
      expect(nper).toBeCloseTo(12, 4);

      const rate = DaxEngine.evaluateWithContext(`RATE(12, ${pmt}, -1000)`, model);
      expect(rate).toBeCloseTo(0.01, 6);
    });

    it('IPMT, PPMT, ISPMT, CUMIPMT, CUMPRINC', () => {
      const ipmt1 = DaxEngine.evaluateWithContext('IPMT(0.1 / 12, 1, 36, 10000)', model);
      const ppmt1 = DaxEngine.evaluateWithContext('PPMT(0.1 / 12, 1, 36, 10000)', model);
      const pmt = DaxEngine.evaluateWithContext('PMT(0.1 / 12, 36, 10000)', model);
      expect(ipmt1 + ppmt1).toBeCloseTo(pmt, 4);

      const ispmt = DaxEngine.evaluateWithContext('ISPMT(0.01, 1, 12, 1000)', model);
      expect(ispmt).toBeCloseTo(-9.1666, 3);

      const cumI = DaxEngine.evaluateWithContext('CUMIPMT(0.09 / 12, 360, 125000, 13, 24, 0)', model);
      expect(cumI).toBeLessThan(0);

      const cumP = DaxEngine.evaluateWithContext('CUMPRINC(0.09 / 12, 360, 125000, 1, 12, 0)', model);
      expect(cumP).toBeLessThan(0);
    });

    it('EFFECT, NOMINAL, RRI, PDURATION', () => {
      const eff = DaxEngine.evaluateWithContext('EFFECT(0.0525, 4)', model);
      expect(eff).toBeCloseTo(0.053543, 5);

      const nom = DaxEngine.evaluateWithContext('NOMINAL(0.053543, 4)', model);
      expect(nom).toBeCloseTo(0.0525, 4);

      const rri = DaxEngine.evaluateWithContext('RRI(96, 10000, 11000)', model);
      expect(rri).toBeCloseTo(0.000993, 5);

      const pdur = DaxEngine.evaluateWithContext('PDURATION(0.025, 1000, 2000)', model);
      expect(pdur).toBeCloseTo(28.07, 2);
    });

    it('Depreciation: SLN, SYD, DB, DDB, VDB, AMORLINC, AMORDEGRC', () => {
      const sln = DaxEngine.evaluateWithContext('SLN(30000, 7500, 10)', model);
      expect(sln).toBe(2250);

      const syd = DaxEngine.evaluateWithContext('SYD(30000, 7500, 10, 1)', model);
      expect(syd).toBeCloseTo(4090.91, 2);

      const db = DaxEngine.evaluateWithContext('DB(10000, 1000, 6, 1, 7)', model);
      expect(db).toBeCloseTo(1860.83, 1);

      const ddb = DaxEngine.evaluateWithContext('DDB(2400, 300, 10, 1, 2)', model);
      expect(ddb).toBe(480);

      const vdb = DaxEngine.evaluateWithContext('VDB(2400, 300, 10, 0, 1)', model);
      expect(vdb).toBe(480);

      const amorlinc = DaxEngine.evaluateWithContext('AMORLINC(2400, "2008-08-19", "2008-12-31", 200, 1, 0.15, 1)', model);
      expect(amorlinc).toBe(360);

      const amordegrc = DaxEngine.evaluateWithContext('AMORDEGRC(2400, "2008-08-19", "2008-12-31", 200, 1, 0.15, 1)', model);
      expect(amordegrc).toBeGreaterThan(0);
    });

    it('XNPV and XIRR table iteration', () => {
      const xnpv = DaxEngine.evaluateWithContext(
        'XNPV(f_FluxoCaixa, f_FluxoCaixa[Valor], f_FluxoCaixa[Data], 0.09)',
        model
      );
      expect(xnpv).toBeGreaterThan(2000);

      const xirr = DaxEngine.evaluateWithContext(
        'XIRR(f_FluxoCaixa, f_FluxoCaixa[Valor], f_FluxoCaixa[Data])',
        model
      );
      expect(xirr).toBeCloseTo(0.373363, 6);
    });

    it('Securities: PRICE, YIELD, COUP*, DURATION, TBILL*', () => {
      const price = DaxEngine.evaluateWithContext(
        'PRICE("2008-02-15", "2017-11-15", 0.0575, 0.065, 100, 2, 0)',
        model
      );
      expect(price).toBeCloseTo(94.634, 2);

      const yld = DaxEngine.evaluateWithContext(
        `YIELD("2008-02-15", "2017-11-15", 0.0575, ${price}, 100, 2, 0)`,
        model
      );
      expect(yld).toBeCloseTo(0.065, 4);

      const coupNum = DaxEngine.evaluateWithContext(
        'COUPNUM("2008-02-15", "2017-11-15", 2, 0)',
        model
      );
      expect(coupNum).toBe(20);

      const coupDays = DaxEngine.evaluateWithContext(
        'COUPDAYS("2008-02-15", "2017-11-15", 2, 0)',
        model
      );
      expect(coupDays).toBe(180);

      const dollarDe = DaxEngine.evaluateWithContext('DOLLARDE(1.02, 16)', model);
      expect(dollarDe).toBe(1.125);

      const dollarFr = DaxEngine.evaluateWithContext('DOLLARFR(1.125, 16)', model);
      expect(dollarFr).toBe(1.02);

      const dur = DaxEngine.evaluateWithContext(
        'DURATION("2008-02-15", "2017-11-15", 0.0575, 0.065, 2, 0)',
        model
      );
      expect(dur).toBeGreaterThan(5);

      const tPrice = DaxEngine.evaluateWithContext('TBILLPRICE("2008-03-31", "2008-06-01", 0.09)', model);
      expect(tPrice).toBeCloseTo(98.45, 1);

      const tYield = DaxEngine.evaluateWithContext('TBILLYIELD("2008-03-31", "2008-06-01", 98.45)', model);
      expect(tYield).toBeCloseTo(0.0914, 3);
    });
  });

  // ==========================================
  // Edge cases, BLANK handling & Error Visibility
  // ==========================================
  describe('Edge cases, BLANK handling & Errors', () => {
    it('NORM.DIST throws DaxError if standard_dev <= 0', () => {
      expect(() => {
        DaxEngine.evaluateWithContext('NORM.DIST(10, 10, 0, TRUE)', model);
      }).toThrowError(DaxError);
    });

    it('NORM.INV throws DaxError if probability is not in (0, 1)', () => {
      expect(() => {
        DaxEngine.evaluateWithContext('NORM.INV(1.5, 10, 2)', model);
      }).toThrowError(DaxError);
    });

    it('XIRR throws DaxError if cash flow has no negative or no positive values', () => {
      expect(() => {
        DaxEngine.evaluateWithContext(
          'XIRR(f_Rendimento, f_Rendimento[Fator], f_Rendimento[Ano])',
          model
        );
      }).toThrowError(/positivo.*negativo/i);
    });

    it('Returns BLANK when evaluating empty/blank inputs', () => {
      const res = DaxEngine.evaluateWithContext('PMT(BLANK(), 12, 1000)', model);
      expect(res === null || res === undefined || (res as any)?.__isDaxBlank).toBe(true);
    });
  });

  // ==========================================
  // Formula Templates
  // ==========================================
  describe('Formula Templates', () => {
    it('Vehicle Financing template generates valid PMT formula', () => {
      const tmpl = generateQuickMeasure('vehicle_financing', 'Valor', '', 'f_Vendas', {
        interestRate: 0.012,
        months: 60,
        loanAmount: 65000,
      });
      expect(tmpl.formula).toBe('PMT(0.012, 60, -65000)');
      expect(tmpl.category).toBe('financial');

      const evaluated = DaxEngine.evaluateWithContext(tmpl.formula, model);
      expect(evaluated).toBeCloseTo(1525.95, 1);
    });

    it('Investment NPV template generates valid XNPV formula', () => {
      const tmpl = generateQuickMeasure('investment_npv', 'Valor', 'Data', 'f_FluxoCaixa', {
        discountRate: 0.08,
      });
      expect(tmpl.formula).toContain('XNPV(');
      expect(tmpl.category).toBe('financial');

      const evaluated = DaxEngine.evaluateWithContext(tmpl.formula, model);
      expect(evaluated).toBeGreaterThan(2000);
    });

    it('Cost per KM template generates valid LINESTX formula', () => {
      const tmpl = generateQuickMeasure('cost_per_km', 'CustoTotalViagem', 'KmRodado', 'f_Logistica');
      expect(tmpl.formula).toContain('LINESTX(');
      expect(tmpl.category).toBe('statistical');

      const evaluated = DaxEngine.evaluateWithContext(tmpl.formula, model);
      expect(evaluated).toBeDefined();
    });
  });
});
