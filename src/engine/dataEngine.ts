import alasql from 'alasql';
import { Table, Column, DataType, Relationship, Filter, Measure, Visual } from '../types/bi';
import { DaxEngine, applyRlsRoleToFilterContext } from './daxEngine';
import { ModelAccess } from './model/modelAccess';
import { globalColumnStore } from './model/columnStore';
import { filterContextFromUIFilters } from './model/filterContext';
import { QueryPlanner } from './query/planner';
import {
  formatValue,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDateBR,
  getGlobalLocale,
  setGlobalLocale,
  getGlobalCurrency,
  setGlobalCurrency,
  getCurrencySymbol,
} from './shared/formatter';

export {
  formatValue,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDateBR,
  getGlobalLocale,
  setGlobalLocale,
  getGlobalCurrency,
  setGlobalCurrency,
  getCurrencySymbol,
};

import { Evaluator } from './expr/evaluator';
import { isDaxTable } from './expr/types';

export class DataEngine implements ModelAccess {
  private tablesById: Map<string, Table> = new Map();
  private tableNamesToId: Map<string, string> = new Map();
  private relationships: Relationship[] = [];
  private measuresById: Map<string, Measure> = new Map();
  private measureNamesToId: Map<string, string> = new Map();
  private registeredAlaSqlTables: Set<string> = new Set();

  constructor() {
    try {
      alasql.options.cache = false;
    } catch (e) {
      console.warn('AlaSQL init note', e);
    }
    // Inject self into DaxEngine to decouple from global window
    DaxEngine.setModelAccess(this);
  }

  public getModelAccess(): ModelAccess {
    return this;
  }

  public recomputeCalculatedTables(tables: Table[], measures: Measure[]): Table[] {
    const calcTables = tables.filter(t => t.isCalculated && t.expression);
    if (calcTables.length === 0) return tables;

    const resultTables = [...tables];
    for (const ct of calcTables) {
      try {
        const evaluator = new Evaluator({
          dialect: 'dax',
          tables: resultTables,
          measures,
          model: this,
        });
        const res = evaluator.evaluate(ct.expression!);
        if (isDaxTable(res)) {
          const idx = resultTables.findIndex(t => t.id === ct.id);
          if (idx !== -1) {
            const cols: Column[] = res.columns.map(c => {
              const sampleVal = res.rows[0]?.[c];
              let dataType: DataType = 'text';
              if (typeof sampleVal === 'number') dataType = 'number';
              else if (typeof sampleVal === 'boolean') dataType = 'boolean';
              else if (sampleVal instanceof Date) dataType = 'date';
              return {
                id: `col_${c}`,
                name: c,
                originalName: c,
                dataType,
                isCalculated: false,
              };
            });
            resultTables[idx] = {
              ...resultTables[idx],
              columns: cols.length > 0 ? cols : resultTables[idx].columns,
              rows: res.rows,
            };
          }
        }
      } catch (e) {
        console.warn(`Error evaluating calculated table ${ct.name}:`, e);
      }
    }
    return resultTables;
  }

  public recomputeCalculatedColumns(table: Table): Table {
    const calcCols = table.columns.filter(c => c.isCalculated && c.expression);
    if (calcCols.length === 0) return table;

    const updatedRows = table.rows.map(r => ({ ...r }));
    for (const col of calcCols) {
      for (let i = 0; i < updatedRows.length; i++) {
        const row = updatedRows[i];
        try {
          const evaluator = new Evaluator({
            dialect: 'column',
            row,
            rowIndex: i,
            tableId: table.id,
            tableName: table.name,
            tables: this.getTables(),
            measures: this.getMeasures(),
            model: this,
          });
          row[col.name] = evaluator.evaluate(col.expression!);
        } catch {
          row[col.name] = null;
        }
      }
    }

    return { ...table, rows: updatedRows };
  }

  public setSchema(tables: Table[], relationships: Relationship[], measures: Measure[]): void {
    this.tablesById.clear();
    this.tableNamesToId.clear();
    this.measuresById.clear();
    this.measureNamesToId.clear();
    this.registeredAlaSqlTables.clear();

    const effectiveTables = this.recomputeCalculatedTables(tables, measures);

    effectiveTables.forEach(t => {
      const computedTable = this.recomputeCalculatedColumns(t);
      this.tablesById.set(computedTable.id, computedTable);
      this.tableNamesToId.set(computedTable.name.toLowerCase().trim(), computedTable.id);
      globalColumnStore.updateTable(computedTable);
    });

    // Normalize relationships: ensure fromTable / toTable use table IDs
    this.relationships = relationships.map(rel => {
      const fromId = this.tableNamesToId.get(rel.fromTable.toLowerCase().trim()) || rel.fromTable;
      const toId = this.tableNamesToId.get(rel.toTable.toLowerCase().trim()) || rel.toTable;
      return {
        ...rel,
        fromTable: fromId,
        toTable: toId,
      };
    });

    measures.forEach(m => {
      this.measuresById.set(m.id, m);
      this.measureNamesToId.set(m.name.toLowerCase().trim(), m.id);
    });

    DaxEngine.setModelAccess(this);
  }

  public getTable(idOrName: string): Table | undefined {
    if (!idOrName) return undefined;
    if (this.tablesById.has(idOrName)) {
      return this.tablesById.get(idOrName);
    }
    const resolvedId = this.tableNamesToId.get(idOrName.toLowerCase().trim());
    return resolvedId ? this.tablesById.get(resolvedId) : undefined;
  }

  public getTables(): Table[] {
    return Array.from(this.tablesById.values());
  }

  public getRelationships(): Relationship[] {
    return this.relationships;
  }

  public getMeasures(): Measure[] {
    return Array.from(this.measuresById.values());
  }

  public getMeasure(idOrName: string): Measure | undefined {
    if (!idOrName) return undefined;
    if (this.measuresById.has(idOrName)) {
      return this.measuresById.get(idOrName);
    }
    const clean = idOrName.replace(/^[Σ\s]+/, '').trim().toLowerCase();
    const resolvedId = this.measureNamesToId.get(clean);
    return resolvedId ? this.measuresById.get(resolvedId) : undefined;
  }

  /**
   * Lazy registration for AlaSQL: only registers table when SQL execution is requested
   */
  private ensureTableInAlaSql(table: Table): void {
    if (this.registeredAlaSqlTables.has(table.name)) return;
    try {
      alasql(`DROP TABLE IF EXISTS [${table.name}]`);
      alasql(`CREATE TABLE [${table.name}]`);
      if (alasql.tables[table.name]) {
        alasql.tables[table.name].data = [...table.rows];
      }
      this.registeredAlaSqlTables.add(table.name);
    } catch (err) {
      console.error(`Erro ao registrar tabela ${table.name} no AlaSQL:`, err);
    }
  }

  public executeSql(sql: string): any[] {
    try {
      // Lazy register all active tables if not already registered
      this.tablesById.forEach(t => this.ensureTableInAlaSql(t));
      return alasql(sql);
    } catch (err: any) {
      console.error('Erro ao executar SQL no AlaSQL:', err);
      throw new Error(`Falha na execução SQL: ${err.message}`);
    }
  }

  /**
   * Applies active filters and cross-table relationship propagation via FilterContext
   */
  public getFilteredRows(targetTableId: string, activeFilters: Filter[]): Record<string, any>[] {
    const targetTable = this.getTable(targetTableId);
    if (!targetTable) return [];

    const filterContext = filterContextFromUIFilters(activeFilters || [], this);
    const activeRole = DaxEngine.getActiveRole();
    if (activeRole) {
      applyRlsRoleToFilterContext(activeRole, filterContext, this);
    } else if (!activeFilters || activeFilters.length === 0) {
      return [...targetTable.rows];
    }

    return filterContext.getFilteredRows(targetTable.id, this);
  }

  public matchesFilter(val: any, operator: Filter['operator'], filterValue: any): boolean {
    if (operator === 'in') {
      const allowed = Array.isArray(filterValue) ? filterValue : [filterValue];
      return allowed.map(String).includes(String(val));
    }
    if (operator === 'notIn') {
      const disallowed = Array.isArray(filterValue) ? filterValue : [filterValue];
      return !disallowed.map(String).includes(String(val));
    }
    if (operator === 'equals') {
      return String(val).toLowerCase() === String(filterValue).toLowerCase();
    }
    if (operator === 'notEquals') {
      return String(val).toLowerCase() !== String(filterValue).toLowerCase();
    }
    if (operator === 'contains') {
      return String(val).toLowerCase().includes(String(filterValue).toLowerCase());
    }
    const numVal = Number(val);
    const numFilter = Number(filterValue);
    if (operator === 'greaterThan') return numVal > numFilter;
    if (operator === 'greaterThanOrEqual') return numVal >= numFilter;
    if (operator === 'lessThan') return numVal < numFilter;
    if (operator === 'lessThanOrEqual') return numVal <= numFilter;
    if (operator === 'between' && Array.isArray(filterValue)) {
      return numVal >= Number(filterValue[0]) && numVal <= Number(filterValue[1]);
    }
    return true;
  }

  /**
   * Queries aggregated visual data based on visual config and active filters via QueryPlanner
   */
  public queryVisualData(
    visual: Visual,
    activeFilters: Filter[] = []
  ): {
    categories: string[];
    series: { name: string; data: number[] }[];
    rawRows: Record<string, any>[];
    summaryValue?: number;
    matrixHierarchy?: any[];
    subtotals?: Record<string, number>;
    grandTotal?: number;
    queryTimeMs?: number;
  } {
    const planner = new QueryPlanner(this);
    return planner.query(visual, activeFilters);
  }

  /**
   * Batch evaluates multiple visuals with shared schema and planner
   */
  public batchEvaluateVisuals(
    visuals: Visual[],
    activeFilters: Filter[] = []
  ): Map<string, ReturnType<DataEngine['queryVisualData']>> {
    const results = new Map<string, ReturnType<DataEngine['queryVisualData']>>();
    const planner = new QueryPlanner(this);
    for (const visual of visuals) {
      results.set(visual.id, planner.query(visual, activeFilters));
    }
    return results;
  }
}

export const globalDataEngine = new DataEngine();
