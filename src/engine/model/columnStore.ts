import { Table } from '../../types/bi';
import { parseNumber, parseDate } from '../shared/valueParser';

export type ColumnVectorType = 'string' | 'number' | 'date' | 'boolean';

export interface BaseColumnVector {
  type: ColumnVectorType;
  name: string;
  rowCount: number;
  nullBitmap: Uint8Array; // 1 = null/undefined/blank, 0 = valid value
  getValue(rowIndex: number): any;
  getInvertedIndex(): Map<any, number[]>;
}

export interface StringColumnVector extends BaseColumnVector {
  type: 'string';
  dictionary: string[];
  codes: Int32Array; // index in dictionary, or -1 if null
}

export interface NumberColumnVector extends BaseColumnVector {
  type: 'number';
  values: Float64Array;
}

export interface DateColumnVector extends BaseColumnVector {
  type: 'date';
  serials: Int32Array; // Excel UTC day serials (days since 1899-12-30)
}

export interface BooleanColumnVector extends BaseColumnVector {
  type: 'boolean';
  values: Uint8Array; // 1 = true, 0 = false
}

export type ColumnVector =
  | StringColumnVector
  | NumberColumnVector
  | DateColumnVector
  | BooleanColumnVector;

export class TableColumnStorage {
  public readonly tableId: string;
  public readonly tableName: string;
  public readonly rowCount: number;
  public readonly version: number;
  private columns: Map<string, ColumnVector> = new Map();

  constructor(table: Table, version = 1) {
    this.tableId = table.id;
    this.tableName = table.name;
    this.rowCount = table.rows ? table.rows.length : 0;
    this.version = version;
    this.buildVectors(table);
  }

  private buildVectors(table: Table): void {
    const rows = table.rows || [];
    const count = rows.length;

    table.columns.forEach(col => {
      const colName = col.name;
      const lowerType = (col.dataType || 'text').toLowerCase();

      if (lowerType === 'number' || lowerType === 'currency' || lowerType === 'percentage') {
        this.columns.set(colName, this.buildNumberVector(colName, rows, count));
      } else if (lowerType === 'date') {
        this.columns.set(colName, this.buildDateVector(colName, rows, count));
      } else if (lowerType === 'boolean') {
        this.columns.set(colName, this.buildBooleanVector(colName, rows, count));
      } else {
        this.columns.set(colName, this.buildStringVector(colName, rows, count));
      }
    });
  }

  private buildNumberVector(colName: string, rows: Record<string, any>[], count: number): NumberColumnVector {
    const values = new Float64Array(count);
    const nullBitmap = new Uint8Array(count);
    let invertedIndex: Map<any, number[]> | null = null;

    for (let i = 0; i < count; i++) {
      const raw = rows[i][colName];
      if (raw === null || raw === undefined || raw === '') {
        nullBitmap[i] = 1;
        values[i] = 0;
      } else {
        const parsed = parseNumber(raw);
        if (parsed.value === null) {
          nullBitmap[i] = 1;
          values[i] = 0;
        } else {
          nullBitmap[i] = 0;
          values[i] = parsed.value;
        }
      }
    }

    const vector: NumberColumnVector = {
      type: 'number',
      name: colName,
      rowCount: count,
      nullBitmap,
      values,
      getValue(idx: number) {
        return nullBitmap[idx] === 1 ? null : values[idx];
      },
      getInvertedIndex() {
        if (!invertedIndex) {
          invertedIndex = new Map();
          for (let i = 0; i < count; i++) {
            const v = nullBitmap[i] === 1 ? null : values[i];
            let list = invertedIndex.get(v);
            if (!list) {
              list = [];
              invertedIndex.set(v, list);
            }
            list.push(i);
          }
        }
        return invertedIndex;
      },
    };

    return vector;
  }

  private buildDateVector(colName: string, rows: Record<string, any>[], count: number): DateColumnVector {
    const serials = new Int32Array(count);
    const nullBitmap = new Uint8Array(count);
    let invertedIndex: Map<any, number[]> | null = null;

    for (let i = 0; i < count; i++) {
      const raw = rows[i][colName];
      if (raw === null || raw === undefined || raw === '') {
        nullBitmap[i] = 1;
        serials[i] = 0;
      } else {
        const parsed = parseDate(raw);
        if (parsed.serial === null) {
          nullBitmap[i] = 1;
          serials[i] = 0;
        } else {
          nullBitmap[i] = 0;
          serials[i] = parsed.serial;
        }
      }
    }

    const vector: DateColumnVector = {
      type: 'date',
      name: colName,
      rowCount: count,
      nullBitmap,
      serials,
      getValue(idx: number) {
        if (nullBitmap[idx] === 1) return null;
        const s = serials[idx];
        const dateMs = Date.UTC(1899, 11, 30) + s * 86400000;
        return new Date(dateMs);
      },
      getInvertedIndex() {
        if (!invertedIndex) {
          invertedIndex = new Map();
          for (let i = 0; i < count; i++) {
            const v = nullBitmap[i] === 1 ? null : serials[i];
            let list = invertedIndex.get(v);
            if (!list) {
              list = [];
              invertedIndex.set(v, list);
            }
            list.push(i);
          }
        }
        return invertedIndex;
      },
    };

    return vector;
  }

  private buildBooleanVector(colName: string, rows: Record<string, any>[], count: number): BooleanColumnVector {
    const values = new Uint8Array(count);
    const nullBitmap = new Uint8Array(count);
    let invertedIndex: Map<any, number[]> | null = null;

    for (let i = 0; i < count; i++) {
      const raw = rows[i][colName];
      if (raw === null || raw === undefined || raw === '') {
        nullBitmap[i] = 1;
        values[i] = 0;
      } else if (typeof raw === 'boolean') {
        nullBitmap[i] = 0;
        values[i] = raw ? 1 : 0;
      } else {
        const s = String(raw).trim().toLowerCase();
        if (['true', '1', 'sim', 's', 'verdadeiro', 'v'].includes(s)) {
          nullBitmap[i] = 0;
          values[i] = 1;
        } else if (['false', '0', 'não', 'nao', 'n', 'falso', 'f'].includes(s)) {
          nullBitmap[i] = 0;
          values[i] = 0;
        } else {
          nullBitmap[i] = 1;
          values[i] = 0;
        }
      }
    }

    const vector: BooleanColumnVector = {
      type: 'boolean',
      name: colName,
      rowCount: count,
      nullBitmap,
      values,
      getValue(idx: number) {
        return nullBitmap[idx] === 1 ? null : values[idx] === 1;
      },
      getInvertedIndex() {
        if (!invertedIndex) {
          invertedIndex = new Map();
          for (let i = 0; i < count; i++) {
            const v = nullBitmap[i] === 1 ? null : (values[i] === 1);
            let list = invertedIndex.get(v);
            if (!list) {
              list = [];
              invertedIndex.set(v, list);
            }
            list.push(i);
          }
        }
        return invertedIndex;
      },
    };

    return vector;
  }

  private buildStringVector(colName: string, rows: Record<string, any>[], count: number): StringColumnVector {
    const dictMap = new Map<string, number>();
    const dictionary: string[] = [];
    const codes = new Int32Array(count);
    const nullBitmap = new Uint8Array(count);
    let invertedIndex: Map<any, number[]> | null = null;

    for (let i = 0; i < count; i++) {
      const raw = rows[i][colName];
      if (raw === null || raw === undefined) {
        nullBitmap[i] = 1;
        codes[i] = -1;
      } else {
        nullBitmap[i] = 0;
        const s = String(raw);
        let code = dictMap.get(s);
        if (code === undefined) {
          code = dictionary.length;
          dictMap.set(s, code);
          dictionary.push(s);
        }
        codes[i] = code;
      }
    }

    const vector: StringColumnVector = {
      type: 'string',
      name: colName,
      rowCount: count,
      nullBitmap,
      dictionary,
      codes,
      getValue(idx: number) {
        if (nullBitmap[idx] === 1 || codes[idx] === -1) return null;
        return dictionary[codes[idx]];
      },
      getInvertedIndex() {
        if (!invertedIndex) {
          invertedIndex = new Map();
          for (let i = 0; i < count; i++) {
            const v = (nullBitmap[i] === 1 || codes[i] === -1) ? null : dictionary[codes[i]];
            let list = invertedIndex.get(v);
            if (!list) {
              list = [];
              invertedIndex.set(v, list);
            }
            list.push(i);
          }
        }
        return invertedIndex;
      },
    };

    return vector;
  }

  public getColumn(colName: string): ColumnVector | undefined {
    return this.columns.get(colName);
  }

  public getColumns(): ColumnVector[] {
    return Array.from(this.columns.values());
  }
}

/**
 * Global Column Store Manager with on-demand generation and table-version caching.
 */
export class ColumnStore {
  private tables: Map<string, TableColumnStorage> = new Map();
  private versions: Map<string, number> = new Map();

  /**
   * Register or update table in column store
   */
  public updateTable(table: Table): TableColumnStorage {
    const curVer = (this.versions.get(table.id) || 0) + 1;
    this.versions.set(table.id, curVer);
    const storage = new TableColumnStorage(table, curVer);
    this.tables.set(table.id, storage);
    this.tables.set(table.name, storage);
    return storage;
  }

  /**
   * Get column vector for table and column name
   */
  public getColumn(tableIdOrName: string, colName: string): ColumnVector | undefined {
    const storage = this.tables.get(tableIdOrName);
    return storage?.getColumn(colName);
  }

  /**
   * Get row count for a table
   */
  public rowCount(tableIdOrName: string): number {
    const storage = this.tables.get(tableIdOrName);
    return storage ? storage.rowCount : 0;
  }

  /**
   * Invalidate table cache when rows change
   */
  public invalidate(tableIdOrName?: string): void {
    if (tableIdOrName) {
      this.tables.delete(tableIdOrName);
      this.versions.delete(tableIdOrName);
    } else {
      this.tables.clear();
      this.versions.clear();
    }
  }

  /**
   * Filter rows using predicate, returning row indices
   */
  public filterRows(tableIdOrName: string, predicate: (rowIndex: number) => boolean): number[] {
    const storage = this.tables.get(tableIdOrName);
    if (!storage) return [];
    const matched: number[] = [];
    const count = storage.rowCount;
    for (let i = 0; i < count; i++) {
      if (predicate(i)) {
        matched.push(i);
      }
    }
    return matched;
  }
}

export const globalColumnStore = new ColumnStore();
