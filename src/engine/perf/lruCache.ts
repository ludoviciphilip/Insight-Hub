import { FilterContext } from '../model/filterContext';

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRatio: number;
}

/**
 * High-performance context-keyed LRU cache for DAX measure calculations.
 */
export class DaxLruCache<K = string, V = any> {
  private cache: Map<K, V> = new Map();
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(maxSize = 1000) {
    this.maxSize = Math.max(1, maxSize);
  }

  public get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      this.misses++;
      return undefined;
    }

    const value = this.cache.get(key)!;
    // Refresh position to mark as recently used
    this.cache.delete(key);
    this.cache.set(key, value);
    this.hits++;
    return value;
  }

  public set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first inserted in Map iterator)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        this.evictions++;
      }
    }
    this.cache.set(key, value);
  }

  public has(key: K): boolean {
    return this.cache.has(key);
  }

  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  public getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRatio: total === 0 ? 0 : this.hits / total,
    };
  }
}

/**
 * Deterministically hashes a filter context combined with an expression/measure key.
 */
export function hashFilterContext(filterContext?: FilterContext, expression = ''): string {
  if (!filterContext) return `expr:${expression}#empty_context`;
  return `expr:${expression}#ctx:${filterContext.hash()}`;
}

export const globalDaxLruCache = new DaxLruCache<string, any>(2000);
