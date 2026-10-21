import { describe, it, expect } from 'vitest';
import { parseNumber, parseDate } from '../valueParser';

describe('Shared valueParser - parseNumber', () => {
  it('correctly parses pt-BR numbers with thousand points and decimal commas', () => {
    const res1 = parseNumber('1.234,56');
    expect(res1.value).toBe(1234.56);
    expect(res1.error).toBeUndefined();

    const res2 = parseNumber('R$ 1.234,56');
    expect(res2.value).toBe(1234.56);

    const res3 = parseNumber('1.234.567,89');
    expect(res3.value).toBe(1234567.89);
  });

  it('correctly parses percentages', () => {
    const res = parseNumber('12,5%');
    expect(res.value).toBeCloseTo(0.125, 5);
    expect(res.isPercent).toBe(true);

    const res2 = parseNumber('100%');
    expect(res2.value).toBe(1.0);
  });

  it('correctly parses standard en-US float and raw numbers', () => {
    expect(parseNumber('1234.56').value).toBe(1234.56);
    expect(parseNumber(42.5).value).toBe(42.5);
    expect(parseNumber(0).value).toBe(0);
  });

  it('correctly parses accounting negatives in parentheses', () => {
    const res = parseNumber('(1.234,56)');
    expect(res.value).toBe(-1234.56);

    const res2 = parseNumber('(1234.56)');
    expect(res2.value).toBe(-1234.56);
  });

  it('correctly parses scientific notation', () => {
    expect(parseNumber('1.23e4').value).toBe(12300);
    expect(parseNumber('1,23e4').value).toBe(12300);
    expect(parseNumber('-1.5e-3').value).toBeCloseTo(-0.0015, 6);
  });

  it('returns null value for BLANK or empty values without throwing or returning 0', () => {
    expect(parseNumber(null).value).toBeNull();
    expect(parseNumber(undefined).value).toBeNull();
    expect(parseNumber('').value).toBeNull();
    expect(parseNumber('   ').value).toBeNull();
  });

  it('returns descriptive error and null value for invalid inputs (never 0)', () => {
    const res1 = parseNumber('texto_invalido');
    expect(res1.value).toBeNull();
    expect(res1.error).toBeDefined();

    const res2 = parseNumber('12abc34');
    expect(res2.value).toBeNull();
    expect(res2.error).toBeDefined();

    const res3 = parseNumber(NaN);
    expect(res3.value).toBeNull();
    expect(res3.error).toBeDefined();
  });
});

describe('Shared valueParser - parseDate', () => {
  it('correctly parses ISO dates in UTC without timezone shifts', () => {
    const res = parseDate('2025-01-15');
    expect(res.iso).toBe('2025-01-15');
    expect(res.date?.getUTCFullYear()).toBe(2025);
    expect(res.date?.getUTCMonth()).toBe(0);
    expect(res.date?.getUTCDate()).toBe(15);
    expect(res.serial).toBeGreaterThan(45000);
  });

  it('correctly parses Brazilian DD/MM/YYYY dates', () => {
    const res = parseDate('15/01/2025');
    expect(res.iso).toBe('2025-01-15');
    expect(res.date?.getUTCFullYear()).toBe(2025);
    expect(res.date?.getUTCMonth()).toBe(0);
    expect(res.date?.getUTCDate()).toBe(15);
  });

  it('correctly parses Excel serial date numbers', () => {
    // 45672 is roughly Jan 2025
    const res = parseDate(45672);
    expect(res.date).not.toBeNull();
    expect(res.serial).toBe(45672);
    expect(res.iso).toBeDefined();
  });

  it('returns nulls for BLANK or empty inputs', () => {
    expect(parseDate(null).date).toBeNull();
    expect(parseDate(undefined).date).toBeNull();
    expect(parseDate('').date).toBeNull();
  });

  it('returns descriptive error and null for invalid date strings', () => {
    const res = parseDate('nao_e_data');
    expect(res.date).toBeNull();
    expect(res.serial).toBeNull();
    expect(res.iso).toBeNull();
    expect(res.error).toBeDefined();
  });
});
