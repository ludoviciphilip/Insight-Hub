import { describe, it, expect } from 'vitest';
import { evaluateExpression } from '../evaluator';
import { DaxError } from '../../shared/errors';

describe('V0.1 DAX Logical & Information Functions', () => {
  describe('Logical Functions & Short-Circuit Evaluation', () => {
    it('evaluates AND, OR, NOT, TRUE, FALSE, BLANK', () => {
      expect(evaluateExpression('AND(TRUE(), TRUE())')).toBe(true);
      expect(evaluateExpression('AND(TRUE(), FALSE())')).toBe(false);
      expect(evaluateExpression('OR(FALSE(), TRUE())')).toBe(true);
      expect(evaluateExpression('NOT(TRUE())')).toBe(false);
      expect(evaluateExpression('NOT(FALSE())')).toBe(true);
      expect(evaluateExpression('BLANK()')).toBeNull();
    });

    it('lazily evaluates IF so unreached branches do not execute errors', () => {
      // If condition is true, division by zero in false branch is never evaluated
      const res1 = evaluateExpression('IF(TRUE(), 42, 1 / 0)');
      expect(res1).toBe(42);

      // If condition is false, division by zero in true branch is never evaluated
      const res2 = evaluateExpression('IF(FALSE(), 1 / 0, 99)');
      expect(res2).toBe(99);
    });

    it('evaluates IF.EAGER eagerly', () => {
      expect(evaluateExpression('IF.EAGER(TRUE(), 10, 20)')).toBe(10);
      expect(evaluateExpression('IF.EAGER(FALSE(), 10, 20)')).toBe(20);
    });

    it('evaluates IFERROR safely catching runtime errors', () => {
      expect(evaluateExpression('IFERROR(1 / 0, -1)')).toBe(-1);
      expect(evaluateExpression('IFERROR(ERROR("Falha"), 500)')).toBe(500);
      expect(evaluateExpression('IFERROR(10 + 20, 0)')).toBe(30);
    });

    it('evaluates SWITCH and SWITCH(TRUE(), ...) lazily', () => {
      const dax1 = 'SWITCH("B", "A", 1, "B", 2, "C", 3, 0)';
      expect(evaluateExpression(dax1)).toBe(2);

      // SWITCH(TRUE(), ...) pattern
      const dax2 = `
        VAR Val = 85
        RETURN
          SWITCH(
            TRUE(),
            Val >= 90, "A",
            Val >= 80, "B",
            Val >= 70, "C",
            "F"
          )
      `;
      expect(evaluateExpression(dax2)).toBe('B');
    });

    it('evaluates COALESCE returning first non-blank', () => {
      expect(evaluateExpression('COALESCE(BLANK(), BLANK(), 42, 100)')).toBe(42);
    });

    it('throws explicit DaxError when ERROR() is called', () => {
      expect(() => evaluateExpression('ERROR("Erro customizado")')).toThrowError(DaxError);
    });

    it('evaluates bitwise functions correctly', () => {
      expect(evaluateExpression('BITAND(6, 3)')).toBe(2);
      expect(evaluateExpression('BITOR(6, 3)')).toBe(7);
      expect(evaluateExpression('BITXOR(6, 3)')).toBe(5);
      expect(evaluateExpression('BITLSHIFT(4, 2)')).toBe(16);
      expect(evaluateExpression('BITRSHIFT(16, 2)')).toBe(4);
    });
  });

  describe('Strict DAX BLANK Semantics', () => {
    it('implements BLANK arithmetic: BLANK + 5 = 5, BLANK * 5 = BLANK', () => {
      expect(evaluateExpression('BLANK() + 5')).toBe(5);
      expect(evaluateExpression('5 + BLANK()')).toBe(5);
      expect(evaluateExpression('BLANK() - 5')).toBe(-5);
      expect(evaluateExpression('5 - BLANK()')).toBe(5);
      expect(evaluateExpression('BLANK() * 5')).toBeNull();
      expect(evaluateExpression('BLANK() & "Texto"')).toBe('Texto');
    });

    it('distinguishes lenient equality (=) from strict equality (==) with BLANK', () => {
      // In DAX, BLANK = 0 is TRUE
      expect(evaluateExpression('BLANK() = 0')).toBe(true);
      expect(evaluateExpression('BLANK() = ""')).toBe(true);

      // In DAX, BLANK == 0 is FALSE
      expect(evaluateExpression('BLANK() == 0')).toBe(false);
      expect(evaluateExpression('BLANK() == ""')).toBe(false);
      expect(evaluateExpression('BLANK() == BLANK()')).toBe(true);
    });

    it('throws division by zero in dax dialect with / operator but DIVIDE handles it safely', () => {
      expect(() => evaluateExpression('10 / 0')).toThrowError(/Divisão por zero/);
      expect(evaluateExpression('DIVIDE(10, 0, 99)')).toBe(99);
      expect(evaluateExpression('DIVIDE(10, 0)')).toBeNull();
    });
  });

  describe('Information Functions', () => {
    it('evaluates ISBLANK, ISERROR, ISNUMBER, ISTEXT, ISLOGICAL', () => {
      expect(evaluateExpression('ISBLANK(BLANK())')).toBe(true);
      expect(evaluateExpression('ISBLANK(0)')).toBe(false);

      expect(evaluateExpression('ISERROR(1 / 0)')).toBe(true);
      expect(evaluateExpression('ISERROR(10 + 5)')).toBe(false);

      expect(evaluateExpression('ISNUMBER(123.45)')).toBe(true);
      expect(evaluateExpression('ISNUMBER("abc")')).toBe(false);

      expect(evaluateExpression('ISTEXT("abc")')).toBe(true);
      expect(evaluateExpression('ISTEXT(123)')).toBe(false);

      expect(evaluateExpression('ISNONTEXT(123)')).toBe(true);
      expect(evaluateExpression('ISNONTEXT("abc")')).toBe(false);

      expect(evaluateExpression('ISLOGICAL(TRUE())')).toBe(true);
      expect(evaluateExpression('ISLOGICAL(1)')).toBe(false);
    });

    it('evaluates ISEVEN, ISODD, ISINTEGER, ISDECIMAL', () => {
      expect(evaluateExpression('ISEVEN(4)')).toBe(true);
      expect(evaluateExpression('ISEVEN(5)')).toBe(false);
      expect(evaluateExpression('ISODD(5)')).toBe(true);
      expect(evaluateExpression('ISODD(4)')).toBe(false);

      expect(evaluateExpression('ISINTEGER(10)')).toBe(true);
      expect(evaluateExpression('ISINTEGER(10.5)')).toBe(false);

      expect(evaluateExpression('ISDECIMAL(10.5)')).toBe(true);
      expect(evaluateExpression('ISDECIMAL(10)')).toBe(false);
    });
  });
});
