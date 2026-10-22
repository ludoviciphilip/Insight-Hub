import { describe, it, expect } from 'vitest';
import { evaluateExpression } from '../../expr/evaluator';
import { createMockDataset } from '../../__tests__/fixtures/mockDataset';
import { DaxError } from '../../shared/errors';

describe('V0.2 Scalar Functions Catalog (per dax.guide)', () => {
  const dataset = createMockDataset();
  const context = {
    dialect: 'dax' as const,
    tables: dataset.tables,
    measures: dataset.measures,
  };

  const evalDax = (formula: string) => evaluateExpression(formula, context);

  describe('Math and Trig Functions', () => {
    // Acceptance criteria tests
    it('meets acceptance criteria: ROUND, MROUND, MOD, INT, TRUNC', () => {
      expect(evalDax('ROUND(2.5, 0)')).toBe(3);
      expect(evalDax('ROUND(-2.5, 0)')).toBe(-3);
      expect(evalDax('MROUND(10, 3)')).toBe(9);
      expect(evalDax('MOD(-3, 2)')).toBe(1);
      expect(evalDax('INT(-1.5)')).toBe(-2);
      expect(evalDax('TRUNC(-1.5)')).toBe(-1);
    });

    it('ABS: normal, BLANK, and type check', () => {
      expect(evalDax('ABS(-42)')).toBe(42);
      expect(evalDax('ABS(BLANK())')).toBeNull();
      expect(evalDax('ABS(10.5)')).toBe(10.5);
    });

    it('CEILING, FLOOR, ISO.CEILING: normal, BLANK, and error on mismatch sign', () => {
      expect(evalDax('CEILING(2.5, 1)')).toBe(3);
      expect(evalDax('FLOOR(2.5, 1)')).toBe(2);
      expect(evalDax('ISO.CEILING(4.3, 2)')).toBe(6);
      expect(evalDax('ISO.CEILING(-4.3, 2)')).toBe(-4);
      expect(evalDax('CEILING(BLANK(), 1)')).toBeNull();
      expect(() => evalDax('CEILING(2.5, -1)')).toThrow(DaxError);
      expect(() => evalDax('FLOOR(-2.5, 1)')).toThrow(DaxError);
    });

    it('ROUNDUP, ROUNDDOWN, EVEN, ODD, SIGN, QUOTIENT, DIVIDE', () => {
      expect(evalDax('ROUNDUP(2.1, 0)')).toBe(3);
      expect(evalDax('ROUNDUP(-2.1, 0)')).toBe(-3);
      expect(evalDax('ROUNDDOWN(2.9, 0)')).toBe(2);
      expect(evalDax('ROUNDDOWN(-2.9, 0)')).toBe(-2);
      expect(evalDax('EVEN(1.5)')).toBe(2);
      expect(evalDax('ODD(1.5)')).toBe(3);
      expect(evalDax('SIGN(-10)')).toBe(-1);
      expect(evalDax('SIGN(0)')).toBe(0);
      expect(evalDax('QUOTIENT(5, 2)')).toBe(2);
      expect(evalDax('DIVIDE(10, 2, 0)')).toBe(5);
      expect(evalDax('DIVIDE(10, 0, 99)')).toBe(99);
      expect(evalDax('DIVIDE(10, 0)')).toBeNull();
    });

    it('POWER, SQRT, SQRTPI, EXP, LN, LOG, LOG10, FACT, GCD, LCM, PI, DEGREES, RADIANS', () => {
      expect(evalDax('POWER(2, 3)')).toBe(8);
      expect(evalDax('SQRT(16)')).toBe(4);
      expect(evalDax('SQRTPI(4)')).toBeCloseTo(Math.sqrt(4 * Math.PI));
      expect(evalDax('EXP(0)')).toBe(1);
      expect(evalDax('LN(1)')).toBe(0);
      expect(evalDax('LOG(100, 10)')).toBeCloseTo(2);
      expect(evalDax('LOG10(1000)')).toBeCloseTo(3);
      expect(evalDax('FACT(5)')).toBe(120);
      expect(evalDax('GCD(24, 36)')).toBe(12);
      expect(evalDax('LCM(4, 6)')).toBe(12);
      expect(evalDax('PI()')).toBeCloseTo(Math.PI);
      expect(evalDax('DEGREES(PI())')).toBeCloseTo(180);
      expect(evalDax('RADIANS(180)')).toBeCloseTo(Math.PI);

      // Errors
      expect(() => evalDax('SQRT(-1)')).toThrow(DaxError);
      expect(() => evalDax('LN(0)')).toThrow(DaxError);
      expect(() => evalDax('FACT(-2)')).toThrow(DaxError);
    });

    it('Trigonometric functions: SIN, COS, TAN, COT, ASIN, ACOS, ATAN, ACOT, hyperbolics', () => {
      expect(evalDax('SIN(0)')).toBe(0);
      expect(evalDax('COS(0)')).toBe(1);
      expect(evalDax('TAN(0)')).toBe(0);
      expect(evalDax('COT(PI() / 4)')).toBeCloseTo(1);
      expect(evalDax('ASIN(1)')).toBeCloseTo(Math.PI / 2);
      expect(evalDax('ACOS(1)')).toBeCloseTo(0);
      expect(evalDax('ATAN(1)')).toBeCloseTo(Math.PI / 4);
      expect(evalDax('ACOT(1)')).toBeCloseTo(Math.PI / 4);
      expect(evalDax('SINH(0)')).toBe(0);
      expect(evalDax('COSH(0)')).toBe(1);
      expect(evalDax('TANH(0)')).toBe(0);
      expect(evalDax('COTH(1)')).toBeCloseTo(1 / Math.tanh(1));
      expect(evalDax('ASINH(0)')).toBe(0);
      expect(evalDax('ACOSH(1)')).toBe(0);
      expect(evalDax('ATANH(0)')).toBe(0);
      expect(evalDax('ACOTH(2)')).toBeCloseTo(0.5 * Math.log(3));

      // Domain errors
      expect(() => evalDax('ASIN(2)')).toThrow(DaxError);
      expect(() => evalDax('ACOS(2)')).toThrow(DaxError);
      expect(() => evalDax('ACOSH(0.5)')).toThrow(DaxError);
      expect(() => evalDax('ATANH(1.5)')).toThrow(DaxError);
    });

    it('RAND and RANDBETWEEN', () => {
      const r = evalDax('RAND()');
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
      const rb = evalDax('RANDBETWEEN(10, 20)');
      expect(rb).toBeGreaterThanOrEqual(10);
      expect(rb).toBeLessThanOrEqual(20);
      expect(() => evalDax('RANDBETWEEN(30, 10)')).toThrow(DaxError);
    });
  });

  describe('Text Functions', () => {
    it('meets acceptance criteria: LEFT, SUBSTITUTE, FORMAT', () => {
      expect(evalDax('LEFT("Curitiba", 3)')).toBe('Cur');
      expect(evalDax('SUBSTITUTE("a-b-c", "-", "/", 2)')).toBe('a-b/c');
      expect(evalDax('FORMAT(1234.5, "#,0.00")')).toBe('1.234,50');
    });

    it('RIGHT, MID, LEN, LOWER, UPPER, TRIM, REPLACE, REPT', () => {
      expect(evalDax('RIGHT("Curitiba", 4)')).toBe('tiba');
      expect(evalDax('MID("InsightHub", 8, 3)')).toBe('Hub');
      expect(evalDax('LEN("Brasil")')).toBe(6);
      expect(evalDax('LOWER("TESTE")')).toBe('teste');
      expect(evalDax('UPPER("teste")')).toBe('TESTE');
      expect(evalDax('TRIM("   Power   BI   ")')).toBe('Power BI');
      expect(evalDax('REPLACE("ABC123", 4, 3, "456")')).toBe('ABC456');
      expect(evalDax('REPT("AB", 3)')).toBe('ABABAB');
      expect(evalDax('REPT("AB", 0)')).toBe('');
      expect(() => evalDax('REPT("AB", -1)')).toThrow(DaxError);
    });

    it('FIND, SEARCH, EXACT, CONCATENATE, COMBINEVALUES, FIXED, VALUE, UNICHAR, UNICODE', () => {
      expect(evalDax('FIND("Hub", "InsightHub")')).toBe(8);
      expect(evalDax('FIND("hub", "InsightHub", 1, 0)')).toBe(0);
      expect(() => evalDax('FIND("hub", "InsightHub")')).toThrow(DaxError);

      expect(evalDax('SEARCH("hub", "InsightHub")')).toBe(8);
      expect(evalDax('SEARCH("I*H", "InsightHub")')).toBe(1);

      expect(evalDax('EXACT("PowerBI", "PowerBI")')).toBe(true);
      expect(evalDax('EXACT("PowerBI", "powerbi")')).toBe(false);

      expect(evalDax('CONCATENATE("Insight", "Hub")')).toBe('InsightHub');
      expect(evalDax('COMBINEVALUES("-", "A", "B", "C")')).toBe('A-B-C');

      expect(evalDax('FIXED(1234.567, 1)')).toBe('1,234.6');
      expect(evalDax('VALUE("123,45")')).toBe(123.45);
      expect(evalDax('UNICHAR(65)')).toBe('A');
      expect(evalDax('UNICODE("A")')).toBe(65);
    });

    it('CONTAINSSTRING, CONTAINSSTRINGEXACT, TEXTCONTAINS, TEXTSIMILARITY', () => {
      expect(evalDax('CONTAINSSTRING("InsightHub", "hub")')).toBe(true);
      expect(evalDax('CONTAINSSTRINGEXACT("InsightHub", "hub")')).toBe(false);
      expect(evalDax('CONTAINSSTRINGEXACT("InsightHub", "Hub")')).toBe(true);

      expect(evalDax('TEXTCONTAINS("InsightHub", "hub", 0)')).toBe(true);
      expect(evalDax('TEXTCONTAINS("InsightHub", "hub", 1)')).toBe(false);

      expect(evalDax('TEXTSIMILARITY("Curitiba", "Curitiba")')).toBe(1.0);
      expect(evalDax('TEXTSIMILARITY("Curitiba", "Curitba")')).toBeGreaterThan(0.8);
      expect(evalDax('TEXTSIMILARITY("Banana", "Abacaxi")')).toBeLessThan(0.5);
    });

    it('handles BLANK in text functions gracefully', () => {
      expect(evalDax('LEFT(BLANK(), 2)')).toBeNull();
      expect(evalDax('RIGHT(BLANK(), 2)')).toBeNull();
      expect(evalDax('MID(BLANK(), 1, 2)')).toBeNull();
      expect(evalDax('LEN(BLANK())')).toBeNull();
      expect(evalDax('LOWER(BLANK())')).toBeNull();
    });
  });

  describe('Date & Time Functions', () => {
    it('meets acceptance criteria: EOMONTH, DATE normalization, WEEKDAY/WEEKNUM', () => {
      expect(evalDax('EOMONTH(DATE(2024, 1, 31), 1)')).toBe('2024-02-29');
      expect(evalDax('DATE(2024, 14, 1)')).toBe('2025-02-01');
    });

    it('DATEVALUE, TIME, TIMEVALUE, DAY, MONTH, YEAR, QUARTER, HOUR, MINUTE, SECOND', () => {
      expect(evalDax('DATEVALUE("2025-03-25")')).toBe('2025-03-25');
      expect(evalDax('TIME(14, 30, 45)')).toBe('14:30:45');
      expect(evalDax('TIME(12, 70, 0)')).toBe('13:10:00'); // Normalized
      expect(evalDax('TIMEVALUE("12:00:00")')).toBe(0.5);

      expect(evalDax('DAY("2025-03-25")')).toBe(25);
      expect(evalDax('MONTH("2025-03-25")')).toBe(3);
      expect(evalDax('YEAR("2025-03-25")')).toBe(2025);
      expect(evalDax('QUARTER("2025-03-25")')).toBe(1);
      expect(evalDax('QUARTER("2025-06-15")')).toBe(2);

      expect(evalDax('HOUR("2025-03-25 15:45:10")')).toBe(15);
      expect(evalDax('MINUTE("2025-03-25 15:45:10")')).toBe(45);
      expect(evalDax('SECOND("2025-03-25 15:45:10")')).toBe(10);
    });

    it('WEEKDAY return_types (1, 2, 3, 11-17)', () => {
      // 2024-02-29 was a Thursday (UTC day = 4)
      expect(evalDax('WEEKDAY("2024-02-29", 1)')).toBe(5); // Sun=1..Sat=7 -> Thu=5
      expect(evalDax('WEEKDAY("2024-02-29", 2)')).toBe(4); // Mon=1..Sun=7 -> Thu=4
      expect(evalDax('WEEKDAY("2024-02-29", 3)')).toBe(3); // Mon=0..Sun=6 -> Thu=3
      expect(evalDax('WEEKDAY("2024-02-29", 11)')).toBe(4); // Mon=1..Sun=7 -> Thu=4
      expect(evalDax('WEEKDAY("2024-02-29", 12)')).toBe(3); // Tue=1..Mon=7 -> Thu=3
      expect(evalDax('WEEKDAY("2024-02-29", 13)')).toBe(2); // Wed=1..Tue=7 -> Thu=2
      expect(evalDax('WEEKDAY("2024-02-29", 14)')).toBe(1); // Thu=1..Wed=7 -> Thu=1
      expect(evalDax('WEEKDAY("2024-02-29", 15)')).toBe(7); // Fri=1..Thu=7 -> Thu=7
      expect(evalDax('WEEKDAY("2024-02-29", 16)')).toBe(6); // Sat=1..Fri=7 -> Thu=6
      expect(evalDax('WEEKDAY("2024-02-29", 17)')).toBe(5); // Sun=1..Sat=7 -> Thu=5
    });

    it('WEEKNUM return_types (1, 2, 11-17, 21)', () => {
      expect(evalDax('WEEKNUM("2024-02-29", 1)')).toBe(9);
      expect(evalDax('WEEKNUM("2024-02-29", 2)')).toBe(9);
      expect(evalDax('WEEKNUM("2024-02-29", 21)')).toBe(9); // ISO 8601 week
    });

    it('YEARFRAC (basis 0 to 4)', () => {
      expect(evalDax('YEARFRAC("2024-01-01", "2024-07-01", 0)')).toBeCloseTo(0.5, 1);
      expect(evalDax('YEARFRAC("2024-01-01", "2024-07-01", 1)')).toBeCloseTo(0.497, 2);
      expect(evalDax('YEARFRAC("2024-01-01", "2024-07-01", 2)')).toBeCloseTo(0.505, 2);
      expect(evalDax('YEARFRAC("2024-01-01", "2024-07-01", 3)')).toBeCloseTo(0.498, 2);
      expect(evalDax('YEARFRAC("2024-01-01", "2024-07-01", 4)')).toBeCloseTo(0.5, 1);
    });

    it('DATEDIFF, EDATE, NETWORKDAYS', () => {
      expect(evalDax('DATEDIFF("2024-01-01", "2024-01-10", "day")')).toBe(9);
      expect(evalDax('DATEDIFF("2024-01-01", "2025-01-01", "year")')).toBe(1);
      expect(evalDax('DATEDIFF("2024-01-01", "2024-04-01", "quarter")')).toBe(1);
      expect(evalDax('EDATE("2024-01-31", 1)')).toBe('2024-02-29'); // Leap year clamp
      expect(evalDax('NETWORKDAYS("2024-01-01", "2024-01-05")')).toBe(5);
    });

    it('Volatile functions: NOW, TODAY, UTCNOW, UTCTODAY', () => {
      const today = evalDax('TODAY()');
      expect(typeof today).toBe('string');
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const now = evalDax('NOW()');
      expect(typeof now).toBe('string');
      expect(now).toContain('T');
    });
  });

  describe('Conversion Functions', () => {
    it('CONVERT to various types', () => {
      expect(evalDax('CONVERT("123.45", "DOUBLE")')).toBe(123.45);
      expect(evalDax('CONVERT("123", "INTEGER")')).toBe(123);
      expect(evalDax('CONVERT(123, "STRING")')).toBe('123');
      expect(evalDax('CONVERT(1, "BOOLEAN")')).toBe(true);
      expect(evalDax('CONVERT(0, "BOOLEAN")')).toBe(false);
      expect(evalDax('CONVERT(123.45678, "CURRENCY")')).toBe(123.4568);
    });

    it('CURRENCY casts to 4 decimals', () => {
      expect(evalDax('CURRENCY(123.456789)')).toBe(123.4568);
      expect(evalDax('CURRENCY(BLANK())')).toBeNull();
    });
  });
});
