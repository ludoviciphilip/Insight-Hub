/**
 * High-performance BitSet backed by Uint32Array for bitmap filtering and row-selection.
 * Provides order-of-magnitude faster intersection, union, and cardinality checks
 * compared to JS Array.filter / Set operations on large tabular datasets.
 */
export class BitSet {
  public readonly words: Uint32Array;
  public readonly size: number;

  constructor(size: number, initialAllTrue = false) {
    this.size = Math.max(0, size);
    const wordCount = Math.ceil(this.size / 32) || 1;
    this.words = new Uint32Array(wordCount);

    if (initialAllTrue && this.size > 0) {
      this.words.fill(0xffffffff);
      this.cleanTrailingBits();
    }
  }

  public static fromIndices(size: number, indices: number[] | Iterable<number>): BitSet {
    const bs = new BitSet(size, false);
    for (const idx of indices) {
      bs.set(idx);
    }
    return bs;
  }

  public set(index: number): this {
    if (index >= 0 && index < this.size) {
      const wordIdx = index >>> 5;
      this.words[wordIdx] |= 1 << (index & 31);
    }
    return this;
  }

  public clear(index: number): this {
    if (index >= 0 && index < this.size) {
      const wordIdx = index >>> 5;
      this.words[wordIdx] &= ~(1 << (index & 31));
    }
    return this;
  }

  public get(index: number): boolean {
    if (index < 0 || index >= this.size) return false;
    const wordIdx = index >>> 5;
    return (this.words[wordIdx] & (1 << (index & 31))) !== 0;
  }

  public and(other: BitSet): BitSet {
    const minWords = Math.min(this.words.length, other.words.length);
    const result = new BitSet(Math.min(this.size, other.size), false);
    for (let i = 0; i < minWords; i++) {
      result.words[i] = this.words[i] & other.words[i];
    }
    result.cleanTrailingBits();
    return result;
  }

  public or(other: BitSet): BitSet {
    const maxWords = Math.max(this.words.length, other.words.length);
    const result = new BitSet(Math.max(this.size, other.size), false);
    for (let i = 0; i < maxWords; i++) {
      const w1 = i < this.words.length ? this.words[i] : 0;
      const w2 = i < other.words.length ? other.words[i] : 0;
      result.words[i] = w1 | w2;
    }
    result.cleanTrailingBits();
    return result;
  }

  public not(): BitSet {
    const result = new BitSet(this.size, false);
    for (let i = 0; i < this.words.length; i++) {
      result.words[i] = ~this.words[i];
    }
    result.cleanTrailingBits();
    return result;
  }

  public cardinality(): number {
    let count = 0;
    for (let i = 0; i < this.words.length; i++) {
      let v = this.words[i];
      // Brian Kernighan's bit-counting algorithm
      while (v !== 0) {
        v &= v - 1;
        count++;
      }
    }
    return count;
  }

  public isEmpty(): boolean {
    for (let i = 0; i < this.words.length; i++) {
      if (this.words[i] !== 0) return false;
    }
    return true;
  }

  public toArray(): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.size; i++) {
      if (this.get(i)) {
        result.push(i);
      }
    }
    return result;
  }

  public clone(): BitSet {
    const copy = new BitSet(this.size, false);
    copy.words.set(this.words);
    return copy;
  }

  private cleanTrailingBits(): void {
    const rem = this.size % 32;
    if (rem > 0) {
      const lastWord = this.words.length - 1;
      const mask = (1 << rem) - 1;
      this.words[lastWord] &= mask;
    }
  }
}
