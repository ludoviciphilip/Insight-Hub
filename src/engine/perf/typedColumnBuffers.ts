import { BitSet } from './bitSet';
import { DAX_BLANK, isBlank } from '../expr/types';

/**
 * High-performance Column Buffer holding typed arrays for numeric columns.
 * Keeps an explicit validity BitSet where 1 = Valid Numeric Value, 0 = BLANK / Null.
 */
export class NumericColumnBuffer {
  public readonly values: Float64Array;
  public readonly validMask: BitSet;
  public readonly length: number;

  constructor(values: Float64Array, validMask: BitSet) {
    this.values = values;
    this.validMask = validMask;
    this.length = values.length;
  }

  public static fromArray(rawValues: any[]): NumericColumnBuffer {
    const len = rawValues.length;
    const values = new Float64Array(len);
    const validMask = new BitSet(len, false);

    for (let i = 0; i < len; i++) {
      const v = rawValues[i];
      if (v === null || v === undefined || isBlank(v) || v === '') {
        values[i] = 0;
      } else {
        const num = typeof v === 'number' ? v : Number(v);
        if (!isNaN(num)) {
          values[i] = num;
          validMask.set(i);
        } else {
          values[i] = 0;
        }
      }
    }

    return new NumericColumnBuffer(values, validMask);
  }

  /**
   * Vectorized SUM over a row mask (or all rows if no mask provided).
   * Follows DAX rules: if all rows are BLANK, returns DAX_BLANK.
   */
  public sum(rowMask?: BitSet): number | typeof DAX_BLANK {
    let acc = 0;
    let validCount = 0;

    if (!rowMask) {
      for (let i = 0; i < this.length; i++) {
        if (this.validMask.get(i)) {
          acc += this.values[i];
          validCount++;
        }
      }
    } else {
      const activeRows = rowMask.and(this.validMask);
      for (let i = 0; i < this.length; i++) {
        if (activeRows.get(i)) {
          acc += this.values[i];
          validCount++;
        }
      }
    }

    return validCount === 0 ? DAX_BLANK : acc;
  }

  /**
   * Vectorized AVERAGE over a row mask.
   * Only non-blank valid numeric rows count towards denominator.
   */
  public average(rowMask?: BitSet): number | typeof DAX_BLANK {
    let acc = 0;
    let count = 0;

    if (!rowMask) {
      for (let i = 0; i < this.length; i++) {
        if (this.validMask.get(i)) {
          acc += this.values[i];
          count++;
        }
      }
    } else {
      const activeRows = rowMask.and(this.validMask);
      for (let i = 0; i < this.length; i++) {
        if (activeRows.get(i)) {
          acc += this.values[i];
          count++;
        }
      }
    }

    return count === 0 ? DAX_BLANK : acc / count;
  }

  /**
   * Vectorized MIN over a row mask.
   */
  public min(rowMask?: BitSet): number | typeof DAX_BLANK {
    let minVal = Infinity;
    let hasValue = false;

    if (!rowMask) {
      for (let i = 0; i < this.length; i++) {
        if (this.validMask.get(i)) {
          const val = this.values[i];
          if (val < minVal) minVal = val;
          hasValue = true;
        }
      }
    } else {
      const activeRows = rowMask.and(this.validMask);
      for (let i = 0; i < this.length; i++) {
        if (activeRows.get(i)) {
          const val = this.values[i];
          if (val < minVal) minVal = val;
          hasValue = true;
        }
      }
    }

    return hasValue ? minVal : DAX_BLANK;
  }

  /**
   * Vectorized MAX over a row mask.
   */
  public max(rowMask?: BitSet): number | typeof DAX_BLANK {
    let maxVal = -Infinity;
    let hasValue = false;

    if (!rowMask) {
      for (let i = 0; i < this.length; i++) {
        if (this.validMask.get(i)) {
          const val = this.values[i];
          if (val > maxVal) maxVal = val;
          hasValue = true;
        }
      }
    } else {
      const activeRows = rowMask.and(this.validMask);
      for (let i = 0; i < this.length; i++) {
        if (activeRows.get(i)) {
          const val = this.values[i];
          if (val > maxVal) maxVal = val;
          hasValue = true;
        }
      }
    }

    return hasValue ? maxVal : DAX_BLANK;
  }

  /**
   * Vectorized COUNT of non-blank numeric values.
   */
  public count(rowMask?: BitSet): number {
    if (!rowMask) {
      return this.validMask.cardinality();
    }
    return rowMask.and(this.validMask).cardinality();
  }
}
