import { Filter, Table, Relationship } from '../../types/bi';
import { ModelAccess } from './modelAccess';
import { RelationshipGraph, RelationshipOverride } from './relationships';
import { parseNumber, parseDate } from '../shared/valueParser';
import { DAX_BLANK, isBlank } from '../expr/types';

export interface ColumnFilter {
  tableId: string;
  column: string;
  allowedValues?: Set<any>;
  predicate?: (val: any) => boolean;
  operator?: string;
  rawValues?: any;
  value?: any;
  isKeepFilters?: boolean;
}

export class FilterContext {
  // Key format: `${normalizedTableId}::${normalizedColumnName}`
  private columnFilters: Map<string, ColumnFilter> = new Map();
  private relationshipOverrides: RelationshipOverride[] = [];

  constructor() {}

  private static makeKey(tableId: string, column: string): string {
    return `${tableId.trim().toLowerCase()}::${column.trim().toLowerCase()}`;
  }

  /**
   * Applies or replaces a filter on a specific column.
   * By default in DAX (CALCULATE), filters on the same column REPLACE existing filters,
   * unless isKeepFilters is true (which intersects).
   */
  public setColumnFilter(
    tableId: string,
    column: string,
    filter: ColumnFilter,
    isKeepFilters = false
  ): void {
    const key = FilterContext.makeKey(tableId, column);

    if (isKeepFilters && this.columnFilters.has(key)) {
      const existing = this.columnFilters.get(key)!;

      // 1. Both have allowedValues
      if (existing.allowedValues && filter.allowedValues) {
        const intersected = new Set<any>();
        filter.allowedValues.forEach(val => {
          if (existing.allowedValues!.has(val)) {
            intersected.add(val);
          }
        });
        this.columnFilters.set(key, {
          ...filter,
          allowedValues: intersected,
          predicate: undefined,
          isKeepFilters: true,
        });
        return;
      }

      // 2. Existing has predicate and filter has allowedValues
      if (existing.predicate && filter.allowedValues) {
        const intersected = new Set<any>();
        filter.allowedValues.forEach(val => {
          if (existing.predicate!(val)) {
            intersected.add(val);
          }
        });
        this.columnFilters.set(key, {
          ...filter,
          allowedValues: intersected,
          predicate: undefined,
          isKeepFilters: true,
        });
        return;
      }

      // 3. Existing has allowedValues and filter has predicate
      if (existing.allowedValues && filter.predicate) {
        const intersected = new Set<any>();
        existing.allowedValues.forEach(val => {
          if (filter.predicate!(val)) {
            intersected.add(val);
          }
        });
        this.columnFilters.set(key, {
          ...existing,
          allowedValues: intersected,
          predicate: undefined,
          isKeepFilters: true,
        });
        return;
      }

      // 4. Both have predicates
      if (existing.predicate && filter.predicate) {
        const p1 = existing.predicate;
        const p2 = filter.predicate;
        this.columnFilters.set(key, {
          ...filter,
          predicate: val => p1(val) && p2(val),
          isKeepFilters: true,
        });
        return;
      }
    }

    this.columnFilters.set(key, { ...filter, isKeepFilters });
  }

  /**
   * Intersect a column filter (KEEPFILTERS)
   */
  public intersectColumnFilter(tableId: string, column: string, filter: ColumnFilter): void {
    this.setColumnFilter(tableId, column, filter, true);
  }

  /**
   * Removes a specific column filter (REMOVEFILTERS, ALL(Table[Column]))
   */
  public removeColumnFilter(tableId: string, column: string): void {
    const key = FilterContext.makeKey(tableId, column);
    this.columnFilters.delete(key);
  }

  /**
   * Removes all filters on a specific table (ALL(Table), REMOVEFILTERS(Table))
   */
  public removeTableFilters(tableId: string): void {
    const prefix = `${tableId.trim().toLowerCase()}::`;
    const toDelete: string[] = [];
    this.columnFilters.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        toDelete.push(key);
      }
    });
    toDelete.forEach(k => this.columnFilters.delete(k));
  }

  /**
   * Clears all filters across the entire model (ALL())
   */
  public clearAll(): void {
    this.columnFilters.clear();
    this.relationshipOverrides = [];
  }

  /**
   * Checks if a column currently has any active filter
   */
  public hasColumnFilter(tableId: string, column: string): boolean {
    return this.columnFilters.has(FilterContext.makeKey(tableId, column));
  }

  /**
   * Checks if a table currently has any direct column filter
   */
  public hasTableFilters(tableId: string): boolean {
    const prefix = `${tableId.trim().toLowerCase()}::`;
    for (const key of this.columnFilters.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  public getColumnFilter(tableId: string, column: string): ColumnFilter | undefined {
    return this.columnFilters.get(FilterContext.makeKey(tableId, column));
  }

  public getAllColumnFilters(): ColumnFilter[] {
    return Array.from(this.columnFilters.values());
  }

  public addRelationshipOverride(override: RelationshipOverride): void {
    this.relationshipOverrides.push(override);
  }

  public getRelationshipOverrides(): RelationshipOverride[] {
    return this.relationshipOverrides;
  }

  /**
   * Clones this FilterContext efficiently
   */
  public clone(): FilterContext {
    const copy = new FilterContext();
    this.columnFilters.forEach((filter, key) => {
      copy.columnFilters.set(key, {
        ...filter,
        allowedValues: filter.allowedValues ? new Set(filter.allowedValues) : undefined,
      });
    });
    copy.relationshipOverrides = this.relationshipOverrides.map(o => ({ ...o }));
    return copy;
  }

  /**
   * Computes a canonical hash string for caching measures and evaluation plans
   */
  public hash(): string {
    const parts: string[] = [];
    const sortedKeys = Array.from(this.columnFilters.keys()).sort();

    for (const key of sortedKeys) {
      const f = this.columnFilters.get(key)!;
      let valStr = '';
      if (f.allowedValues) {
        valStr = Array.from(f.allowedValues)
          .map(v => String(v ?? 'BLANK'))
          .sort()
          .join(',');
      } else if (f.rawValues !== undefined) {
        valStr = JSON.stringify(f.rawValues);
      } else {
        valStr = f.operator || 'pred';
      }
      parts.push(`${key}=${f.operator || 'eq'}:${valStr}`);
    }

    if (this.relationshipOverrides.length > 0) {
      const relStr = this.relationshipOverrides
        .map(o => `${o.fromTable}.${o.fromColumn}->${o.toTable}.${o.toColumn}:${o.isActive}:${o.crossFilterDirection}`)
        .sort()
        .join(';');
      parts.push(`RELS=${relStr}`);
    }

    return parts.join('|') || '__EMPTY_CONTEXT__';
  }

  /**
   * Evaluates visible row indices for a target table considering all direct
   * column filters and cross-table active relationship propagation.
   */
  public getVisibleRowIndices(targetTableId: string, model?: ModelAccess | null): number[] {
    if (!model) return [];
    const table = model.getTable(targetTableId);
    if (!table || !table.rows || table.rows.length === 0) return [];

    const rowCount = table.rows.length;
    let visibleIndices: number[] = [];
    for (let i = 0; i < rowCount; i++) visibleIndices.push(i);

    // 1. Direct Column Filters on targetTable
    const targetTablePrefix = `${table.id.toLowerCase()}::`;
    const targetNamePrefix = `${table.name.toLowerCase()}::`;

    for (const [key, filter] of this.columnFilters.entries()) {
      if (key.startsWith(targetTablePrefix) || key.startsWith(targetNamePrefix)) {
        visibleIndices = visibleIndices.filter(idx => {
          const row = table.rows[idx];
          const val = row[filter.column];
          return this.matchesColumnFilter(val, filter);
        });
        if (visibleIndices.length === 0) return [];
      }
    }

    // 2. Cross-Table Relationship Filters
    const graph = new RelationshipGraph(model);
    const sourceTableIds = new Set<string>();

    for (const filter of this.columnFilters.values()) {
      const normSource = model.getTable(filter.tableId)?.id || filter.tableId;
      if (normSource !== table.id) {
        sourceTableIds.add(normSource);
      }
    }

    for (const sourceId of sourceTableIds) {
      const sourceTable = model.getTable(sourceId);
      if (!sourceTable) continue;

      // Find path from sourceTable to targetTable
      const path = graph.findActivePath(sourceId, table.id, this.relationshipOverrides);
      if (!path || path.length === 0) continue;

      // Get visible rows of source table according to its direct filters
      const sourceFilters = Array.from(this.columnFilters.values()).filter(
        f => (model.getTable(f.tableId)?.id || f.tableId) === sourceId
      );

      let currentKeys = new Set<string>();
      sourceTable.rows.forEach(r => {
        const matchesAll = sourceFilters.every(f => this.matchesColumnFilter(r[f.column], f));
        if (matchesAll) {
          const k = String(r[path[0].fromColumn] ?? '').trim();
          if (k) currentKeys.add(k);
        }
      });

      // Propagate keys through the path steps
      for (let stepIdx = 0; stepIdx < path.length; stepIdx++) {
        const step = path[stepIdx];
        const stepTargetTable = model.getTable(step.toTableId);
        if (!stepTargetTable) break;

        if (stepIdx === path.length - 1) {
          // Final destination table (targetTable)
          visibleIndices = visibleIndices.filter(idx => {
            const joinVal = String(table.rows[idx][step.toColumn] ?? '').trim();
            return currentKeys.has(joinVal);
          });
        } else {
          // Intermediate table: map from step.toColumn to next step.fromColumn
          const nextStep = path[stepIdx + 1];
          const nextKeys = new Set<string>();
          stepTargetTable.rows.forEach(r => {
            const incomingKey = String(r[step.toColumn] ?? '').trim();
            if (currentKeys.has(incomingKey)) {
              const outgoingKey = String(r[nextStep.fromColumn] ?? '').trim();
              if (outgoingKey) nextKeys.add(outgoingKey);
            }
          });
          currentKeys = nextKeys;
        }

        if (visibleIndices.length === 0) return [];
      }
    }

    return visibleIndices;
  }

  /**
   * Helper that returns the visible row objects for target table
   */
  public getFilteredRows(targetTableId: string, model?: ModelAccess | null): Record<string, any>[] {
    if (!model) return [];
    const table = model.getTable(targetTableId);
    if (!table) return [];
    const indices = this.getVisibleRowIndices(targetTableId, model);
    return indices.map(i => table.rows[i]);
  }

  private matchesColumnFilter(val: any, filter: ColumnFilter): boolean {
    if (filter.predicate) {
      return filter.predicate(val);
    }

    if (filter.allowedValues) {
      if (val === null || val === undefined || val === '') {
        return filter.allowedValues.has(DAX_BLANK) || filter.allowedValues.has(null) || filter.allowedValues.has('');
      }
      return filter.allowedValues.has(val) || filter.allowedValues.has(String(val));
    }

    return true;
  }
}

/**
 * Adapter converting UI Filter[] (visual, page, report) to structured FilterContext
 * supporting all 10 operators and typed comparisons.
 */
export function filterContextFromUIFilters(
  uiFilters: Filter[],
  model: ModelAccess,
  currentVisualId?: string
): FilterContext {
  const ctx = new FilterContext();
  if (!uiFilters || uiFilters.length === 0) return ctx;

  for (const f of uiFilters) {
    if (f.value === undefined || f.value === null || f.value === '' || f.value === 'TODOS') {
      continue;
    }

    // Check visualId scope
    if (f.level === 'visual' && f.visualId && currentVisualId && f.visualId !== currentVisualId) {
      continue;
    }

    const table = model.getTable(f.tableId);
    const tableId = table ? table.id : f.tableId;

    const predicate = buildFilterPredicate(f.operator, f.value);
    let allowedValues: Set<any> | undefined = undefined;
    if (f.operator === 'equals') {
      allowedValues = new Set([f.value]);
    } else if (f.operator === 'in') {
      allowedValues = new Set(Array.isArray(f.value) ? f.value : [f.value]);
    }

    ctx.setColumnFilter(
      tableId,
      f.column,
      {
        tableId,
        column: f.column,
        predicate,
        allowedValues,
        operator: f.operator,
        rawValues: f.value,
      },
      true // multiple UI filters on the same column intersect
    );
  }

  return ctx;
}

/**
 * Builds typed filter predicate respecting DAX BLANK semantics for notEquals and notIn.
 */
export function buildFilterPredicate(
  operator: Filter['operator'],
  filterValue: any
): (val: any) => boolean {
  switch (operator) {
    case 'in': {
      const allowedArr = Array.isArray(filterValue) ? filterValue : [filterValue];
      const stringSet = new Set(allowedArr.map(v => String(v).toLowerCase()));
      const allowsBlank = allowedArr.some(v => v === null || v === '' || isBlank(v));

      return (val: any) => {
        if (isBlank(val) || val === null || val === undefined || val === '') {
          return allowsBlank;
        }
        return stringSet.has(String(val).toLowerCase());
      };
    }

    case 'notIn': {
      const disallowedArr = Array.isArray(filterValue) ? filterValue : [filterValue];
      const stringSet = new Set(disallowedArr.map(v => String(v).toLowerCase()));
      const disallowsBlank = disallowedArr.some(v => v === null || v === '' || isBlank(v));

      // In DAX, notIn DOES NOT discard blanks unless blank was explicitly filtered out
      return (val: any) => {
        if (isBlank(val) || val === null || val === undefined || val === '') {
          return !disallowsBlank;
        }
        return !stringSet.has(String(val).toLowerCase());
      };
    }

    case 'equals': {
      const filterStr = String(filterValue).toLowerCase();
      const filterNum = parseNumber(filterValue);
      const filterDt = parseDate(filterValue);

      return (val: any) => {
        if (isBlank(val) || val === null || val === undefined || val === '') {
          return filterValue === '' || filterValue === null || isBlank(filterValue);
        }
        // Numeric typed comparison
        if (filterNum.value !== null) {
          const valNum = parseNumber(val);
          if (valNum.value !== null) {
            return valNum.value === filterNum.value;
          }
        }
        // Date typed comparison
        if (filterDt && filterDt.date) {
          const valDt = parseDate(val);
          if (valDt && valDt.date) {
            return valDt.date.getTime() === filterDt.date.getTime();
          }
        }
        return String(val).toLowerCase() === filterStr;
      };
    }

    case 'notEquals': {
      const filterStr = String(filterValue).toLowerCase();
      const filterNum = parseNumber(filterValue);

      // In DAX, notEquals keeps BLANK/null values!
      return (val: any) => {
        if (isBlank(val) || val === null || val === undefined || val === '') {
          return filterValue !== '' && filterValue !== null && !isBlank(filterValue);
        }
        if (filterNum.value !== null) {
          const valNum = parseNumber(val);
          if (valNum.value !== null) {
            return valNum.value !== filterNum.value;
          }
        }
        return String(val).toLowerCase() !== filterStr;
      };
    }

    case 'contains': {
      const search = String(filterValue).toLowerCase();
      return (val: any) => {
        if (val === null || val === undefined || isBlank(val)) return false;
        return String(val).toLowerCase().includes(search);
      };
    }

    case 'greaterThan':
    case 'greaterThanOrEqual':
    case 'lessThan':
    case 'lessThanOrEqual': {
      const numFilter = Number(filterValue);
      const isNum = !isNaN(numFilter);
      const dtFilter = parseDate(filterValue);

      return (val: any) => {
        if (val === null || val === undefined || isBlank(val)) return false;

        if (isNum) {
          const n = Number(val);
          if (!isNaN(n)) {
            if (operator === 'greaterThan') return n > numFilter;
            if (operator === 'greaterThanOrEqual') return n >= numFilter;
            if (operator === 'lessThan') return n < numFilter;
            if (operator === 'lessThanOrEqual') return n <= numFilter;
          }
        }

        if (dtFilter && dtFilter.date) {
          const dtVal = parseDate(val);
          if (dtVal && dtVal.date) {
            const t1 = dtVal.date.getTime();
            const t2 = dtFilter.date.getTime();
            if (operator === 'greaterThan') return t1 > t2;
            if (operator === 'greaterThanOrEqual') return t1 >= t2;
            if (operator === 'lessThan') return t1 < t2;
            if (operator === 'lessThanOrEqual') return t1 <= t2;
          }
        }

        const s1 = String(val);
        const s2 = String(filterValue);
        if (operator === 'greaterThan') return s1 > s2;
        if (operator === 'greaterThanOrEqual') return s1 >= s2;
        if (operator === 'lessThan') return s1 < s2;
        if (operator === 'lessThanOrEqual') return s1 <= s2;
        return true;
      };
    }

    case 'between': {
      if (!Array.isArray(filterValue) || filterValue.length < 2) return () => true;
      const [minV, maxV] = filterValue;
      const numMin = Number(minV);
      const numMax = Number(maxV);
      const isNum = !isNaN(numMin) && !isNaN(numMax);

      return (val: any) => {
        if (val === null || val === undefined || isBlank(val)) return false;
        if (isNum) {
          const n = Number(val);
          if (!isNaN(n)) return n >= numMin && n <= numMax;
        }
        return String(val) >= String(minV) && String(val) <= String(maxV);
      };
    }

    default:
      return () => true;
  }
}
