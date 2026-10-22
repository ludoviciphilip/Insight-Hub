import { describe, it, expect } from 'vitest';
import { parseExpression } from '../parser';
import { evaluateExpression } from '../evaluator';
import { DaxError } from '../../shared/errors';

describe('V0.1 DAX Pratt Parser & Operator Precedence', () => {
  it('correctly evaluates power operator (^) with higher precedence than multiplication and right-associativity', () => {
    // 2 * 3 ^ 2 = 2 * 9 = 18 (not (2*3)^2 = 36)
    const res1 = evaluateExpression('2 * 3 ^ 2');
    expect(res1).toBe(18);

    // 2 ^ 3 ^ 2 = 2 ^ (3 ^ 2) = 2 ^ 9 = 512 (right-associative)
    const res2 = evaluateExpression('2 ^ 3 ^ 2');
    expect(res2).toBe(512);
  });

  it('correctly evaluates unary minus with higher precedence than multiplication/division', () => {
    // -3 * 4 = -12
    const res1 = evaluateExpression('-3 * 4');
    expect(res1).toBe(-12);

    // 10 + -3 = 7
    const res2 = evaluateExpression('10 + -3');
    expect(res2).toBe(7);
  });

  it('enforces precedence: * / % before + - before &', () => {
    // 2 + 3 * 4 = 14
    expect(evaluateExpression('2 + 3 * 4')).toBe(14);

    // 10 - 6 / 2 = 7
    expect(evaluateExpression('10 - 6 / 2')).toBe(7);

    // 10 % 3 = 1
    expect(evaluateExpression('10 % 3')).toBe(1);

    // "Total: " & 10 + 5 = "Total: 15"
    expect(evaluateExpression('"Total: " & 10 + 5')).toBe('Total: 15');
  });

  it('enforces comparison before NOT before && before ||', () => {
    // 5 > 3 && 2 < 4 = true
    expect(evaluateExpression('5 > 3 && 2 < 4')).toBe(true);

    // 5 > 3 && NOT(2 < 4) = false
    expect(evaluateExpression('5 > 3 && NOT(2 < 4)')).toBe(false);

    // false && false || true = true
    expect(evaluateExpression('FALSE() && FALSE() || TRUE()')).toBe(true);
  });

  it('parses single and multi-column table constructors', () => {
    // Single column constructor { 10, 20, 30 }
    const res1 = evaluateExpression('{ 10, 20, 30 }');
    expect(res1).toEqual([10, 20, 30]);

    // Multi-column constructor { (1, "A"), (2, "B") }
    const res2 = evaluateExpression('{ (1, "A"), (2, "B") }');
    expect(res2).toEqual([[1, 'A'], [2, 'B']]);
  });

  it('supports IN operator with table constructors', () => {
    expect(evaluateExpression('2 IN { 1, 2, 3 }')).toBe(true);
    expect(evaluateExpression('5 IN { 1, 2, 3 }')).toBe(false);
    expect(evaluateExpression('"SP" IN { "RJ", "SP", "MG" }')).toBe(true);
  });

  it('evaluates VAR / RETURN blocks with variable scoping', () => {
    const dax = `
      VAR A = 10
      VAR B = 20
      VAR C = A + B
      RETURN C * 2
    `;
    expect(evaluateExpression(dax)).toBe(60);
  });

  it('handles omitted optional function arguments', () => {
    // IF(1 > 0, 100, ) -> omitted false branch returns BLANK (null)
    const res = evaluateExpression('IF(1 > 2, 100, )');
    expect(res).toBeNull();
  });
});
