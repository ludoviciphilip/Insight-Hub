import alasql from 'alasql';
import { Table, Relationship, Filter, Measure, Visual } from '../types/bi';
import { DaxEngine } from './daxEngine';
import { ModelAccess } from './model/modelAccess';
import { globalColumnStore } from './model/columnStore';
import {
  formatValue,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDateBR,
} from './shared/formatter';

export { formatValue, formatCurrency, formatNumber, formatPercent, formatDateBR };

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

  public setSchema(tables: Table[], relationships: Relationship[], measures: Measure[]): void {
    this.tablesById.clear();
    this.tableNamesToId.clear();
    this.measuresById.clear();
    this.measureNamesToId.clear();
    this.registeredAlaSqlTables.clear();

    tables.forEach(t => {
      this.tablesById.set(t.id, t);
      this.tableNamesToId.set(t.name.toLowerCase().trim(), t.id);
      globalColumnStore.updateTable(t);
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
   * Applies active filters and cross-table relationship propagation
   */
  public getFilteredRows(targetTableId: string, activeFilters: Filter[]): Record<string, any>[] {
    const targetTable = this.getTable(targetTableId);
    if (!targetTable) return [];

    let rows = [...targetTable.rows];
    if (!activeFilters || activeFilters.length === 0) return rows;

    for (const filter of activeFilters) {
      if (filter.value === undefined || filter.value === null || filter.value === '' || filter.value === 'TODOS') continue;

      const isDirect =
        filter.tableId === targetTable.id ||
        filter.tableId === targetTable.name ||
        filter.tableId?.toLowerCase() === targetTable.id.toLowerCase() ||
        filter.tableId?.toLowerCase() === targetTable.name.toLowerCase();

      if (isDirect) {
        rows = rows.filter(row => {
          const val = row[filter.column];
          return this.matchesFilter(val, filter.operator, filter.value);
        });
      } else {
        const sourceTable = this.getTable(filter.tableId);
        let propagated = false;

        if (sourceTable) {
          const rel = this.relationships.find(
            r =>
              r.isActive &&
              (((r.fromTable === targetTable.id || r.fromTable === targetTable.name || r.fromTable?.toLowerCase() === targetTable.id?.toLowerCase() || r.fromTable?.toLowerCase() === targetTable.name?.toLowerCase()) &&
                (r.toTable === sourceTable.id || r.toTable === sourceTable.name || r.toTable?.toLowerCase() === sourceTable.id?.toLowerCase() || r.toTable?.toLowerCase() === sourceTable.name?.toLowerCase())) ||
                ((r.toTable === targetTable.id || r.toTable === targetTable.name || r.toTable?.toLowerCase() === targetTable.id?.toLowerCase() || r.toTable?.toLowerCase() === targetTable.name?.toLowerCase()) &&
                  (r.fromTable === sourceTable.id || r.fromTable === sourceTable.name || r.fromTable?.toLowerCase() === sourceTable.id?.toLowerCase() || r.fromTable?.toLowerCase() === sourceTable.name?.toLowerCase())))
          );

          if (rel) {
            const isTargetFrom =
              rel.fromTable === targetTable.id ||
              rel.fromTable === targetTable.name ||
              rel.fromTable?.toLowerCase() === targetTable.id?.toLowerCase() ||
              rel.fromTable?.toLowerCase() === targetTable.name?.toLowerCase();

            const targetJoinCol = isTargetFrom ? rel.fromColumn : rel.toColumn;
            const sourceJoinCol = isTargetFrom ? rel.toColumn : rel.fromColumn;

            // Get valid keys from source table matching filter
            const validKeys = new Set(
              sourceTable.rows
                .filter(sr => this.matchesFilter(sr[filter.column], filter.operator, filter.value))
                .map(sr => String(sr[sourceJoinCol] ?? '').trim())
            );

            rows = rows.filter(tr => validKeys.has(String(tr[targetJoinCol] ?? '').trim()));
            propagated = true;
          }
        }

        if (!propagated) {
          // If column exists directly on target table despite differing tableId, apply directly
          if (targetTable.columns.some(c => c.name === filter.column)) {
            rows = rows.filter(row => {
              const val = row[filter.column];
              return this.matchesFilter(val, filter.operator, filter.value);
            });
          }
        }
      }
    }

    return rows;
  }

  private matchesFilter(val: any, operator: Filter['operator'], filterValue: any): boolean {
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
   * Queries aggregated visual data based on visual config and active filters
   */
  public queryVisualData(
    visual: Visual,
    activeFilters: Filter[]
  ): {
    categories: string[];
    series: { name: string; data: number[] }[];
    rawRows: Record<string, any>[];
    summaryValue?: number;
  } {
    const tableId = visual.dataConfig.tableId;
    const table = this.getTable(tableId);

    if (!table) {
      return { categories: [], series: [], rawRows: [] };
    }

    // Combine visual-level filters with active report/page filters
    const allFilters = [...activeFilters];
    const filteredRows = this.getFilteredRows(tableId, allFilters);

    // Single KPI or Card Visual
    if (visual.type === 'card' || visual.type === 'kpi' || visual.type === 'gauge') {
      const yField = visual.dataConfig.yAxisFields?.[0] || table.columns.find(c => c.dataType === 'number' || c.dataType === 'currency')?.name || '';
      const agg = visual.dataConfig.aggregation || 'SUM';

      // Check if yField is a DAX Measure
      const measure = this.getMeasure(yField);
      let summary = 0;

      if (measure) {
        summary = DaxEngine.evaluate(measure.formula, this, undefined, activeFilters);
      } else if (yField) {
        const values = filteredRows.map(r => Number(r[yField]) || 0);
        if (agg === 'SUM') summary = values.reduce((a, b) => a + b, 0);
        else if (agg === 'AVG') summary = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        else if (agg === 'COUNT') summary = values.length;
        else if (agg === 'DISTINCTCOUNT') summary = new Set(values).size;
        else if (agg === 'MIN') summary = values.length ? Math.min(...values) : 0;
        else if (agg === 'MAX') summary = values.length ? Math.max(...values) : 0;
      }

      return {
        categories: [visual.title || yField],
        series: [{ name: yField, data: [Number(summary.toFixed(2))] }],
        rawRows: filteredRows,
        summaryValue: Number(summary.toFixed(2)),
      };
    }

    // Standard Charts (Column, Bar, Line, Area, Pie, Donut, Treemap, Waterfall, Funnel)
    let categoryTable = table;
    let cleanXField = visual.dataConfig.xAxisField || table.columns[0]?.name || 'Categoria';

    // Support dot-notation or related table column references: e.g. "d_Clientes.Segmento" or "Segmento"
    if (cleanXField.includes('.')) {
      const [tPrefix, cName] = cleanXField.split('.', 2);
      const foundTable = this.getTable(tPrefix);
      if (foundTable) {
        categoryTable = foundTable;
        cleanXField = cName;
      }
    } else if (!categoryTable.columns.some(c => c.name.toLowerCase() === cleanXField.toLowerCase())) {
      // If not directly on categoryTable, check if it exists in an active related table
      for (const rel of this.relationships.filter(r => r.isActive)) {
        let candId: string | null = null;
        if (
          rel.fromTable === table.id ||
          rel.fromTable === table.name ||
          rel.fromTable?.toLowerCase() === table.id.toLowerCase() ||
          rel.fromTable?.toLowerCase() === table.name.toLowerCase()
        ) {
          candId = rel.toTable;
        } else if (
          rel.toTable === table.id ||
          rel.toTable === table.name ||
          rel.toTable?.toLowerCase() === table.id.toLowerCase() ||
          rel.toTable?.toLowerCase() === table.name.toLowerCase()
        ) {
          candId = rel.fromTable;
        }

        if (candId) {
          const candTable = this.getTable(candId);
          if (candTable && candTable.columns.some(c => c.name.toLowerCase() === cleanXField.toLowerCase())) {
            categoryTable = candTable;
            cleanXField = candTable.columns.find(c => c.name.toLowerCase() === cleanXField.toLowerCase())!.name;
            break;
          }
        }
      }
    }

    const yFields = visual.dataConfig.yAxisFields && visual.dataConfig.yAxisFields.length > 0
      ? visual.dataConfig.yAxisFields
      : [table.columns.find(c => c.dataType === 'number' || c.dataType === 'currency')?.name || 'ValorTotal'];
    const agg = visual.dataConfig.aggregation;

    // Resolve cross-table relationship if category comes from a related dimension
    const isCrossTable = categoryTable.id !== table.id;
    let catMap: Map<string, string> | null = null;
    let targetJoinCol = '';
    let sourceJoinCol = '';

    const categoriesSet = new Set<string>();

    if (isCrossTable) {
      const rel = this.relationships.find(
        r =>
          r.isActive &&
          (((r.fromTable === table.id || r.fromTable === table.name || r.fromTable?.toLowerCase() === table.id.toLowerCase() || r.fromTable?.toLowerCase() === table.name.toLowerCase()) &&
            (r.toTable === categoryTable.id || r.toTable === categoryTable.name || r.toTable?.toLowerCase() === categoryTable.id.toLowerCase() || r.toTable?.toLowerCase() === categoryTable.name.toLowerCase())) ||
           ((r.toTable === table.id || r.toTable === table.name || r.toTable?.toLowerCase() === table.id.toLowerCase() || r.toTable?.toLowerCase() === table.name.toLowerCase()) &&
            (r.fromTable === categoryTable.id || r.fromTable === categoryTable.name || r.fromTable?.toLowerCase() === categoryTable.id.toLowerCase() || r.fromTable?.toLowerCase() === categoryTable.name.toLowerCase())))
      );

      if (rel) {
        const isTargetFrom =
          rel.fromTable === table.id ||
          rel.fromTable === table.name ||
          rel.fromTable?.toLowerCase() === table.id.toLowerCase() ||
          rel.fromTable?.toLowerCase() === table.name.toLowerCase();

        targetJoinCol = isTargetFrom ? rel.fromColumn : rel.toColumn;
        sourceJoinCol = isTargetFrom ? rel.toColumn : rel.fromColumn;

        const catTableRows = this.getFilteredRows(categoryTable.id, allFilters);
        catMap = new Map<string, string>();
        catTableRows.forEach(cr => {
          const key = String(cr[sourceJoinCol] ?? '').trim();
          if (key) {
            catMap!.set(key, String(cr[cleanXField] ?? 'N/D'));
          }
        });

        // Map and extract distinct categories from filteredRows
        filteredRows.forEach(row => {
          const joinKey = String(row[targetJoinCol] ?? '').trim();
          const catVal = catMap!.get(joinKey) ?? 'N/D';
          row[cleanXField] = catVal;
          categoriesSet.add(catVal);
        });

        // If categoriesSet has no entries from fact rows, populate from related dimension table
        if (categoriesSet.size === 0) {
          catTableRows.forEach(cr => {
            categoriesSet.add(String(cr[cleanXField] ?? 'N/D'));
          });
        }
      }
    } else {
      // Direct category from table
      filteredRows.forEach(row => {
        const catKey = String(row[cleanXField] ?? 'N/D');
        categoriesSet.add(catKey);
      });
    }

    let categories = Array.from(categoriesSet);

    // Sorting
    if (visual.dataConfig.sortField) {
      const order = visual.dataConfig.sortOrder === 'desc' ? -1 : 1;
      categories.sort((a, b) => a.localeCompare(b) * order);
    }

    if (visual.dataConfig.limit && visual.dataConfig.limit > 0) {
      categories = categories.slice(0, visual.dataConfig.limit);
    }

    const series = yFields.map(yField => {
      const measureObj = this.getMeasure(yField);
      const isMeasure = !!measureObj;
      const effectiveAgg = agg || (isMeasure ? 'NONE' : 'SUM');

      const data = categories.map(cat => {
        if (isMeasure && measureObj) {
          // DAX Measure: calculate value in context of category filter
          const catFilter: Filter = {
            id: 'dax_ctx_' + Math.random(),
            level: 'visual',
            tableId: categoryTable.id,
            column: cleanXField,
            operator: 'equals',
            value: cat,
          };
          const val = DaxEngine.evaluate(measureObj.formula, this, undefined, [...activeFilters, catFilter]);
          const numVal = typeof val === 'number' && !isNaN(val) ? val : (val === null || val === undefined ? 0 : Number(val) || 0);
          return Number(numVal.toFixed(2));
        }

        const catRows = filteredRows.filter(r => {
          if (isCrossTable && catMap && targetJoinCol) {
            const joinKey = String(r[targetJoinCol] ?? '').trim();
            const resolved = catMap.get(joinKey) ?? String(r[cleanXField] ?? 'N/D');
            return resolved === cat;
          }
          return String(r[cleanXField] ?? 'N/D') === cat;
        });

        if (catRows.length === 0) return 0;

        if (effectiveAgg === 'NONE') {
          // Nenhuma: direct value from row, no aggregation
          return Number(catRows[0][yField]) || 0;
        }

        let sum = 0;
        let count = 0;
        let min = Infinity;
        let max = -Infinity;

        catRows.forEach(r => {
          const num = Number(r[yField]) || 0;
          sum += num;
          count++;
          if (num < min) min = num;
          if (num > max) max = num;
        });

        if (effectiveAgg === 'AVG') return count > 0 ? Number((sum / count).toFixed(2)) : 0;
        if (effectiveAgg === 'COUNT') return count;
        if (effectiveAgg === 'MIN') return min === Infinity ? 0 : min;
        if (effectiveAgg === 'MAX') return max === -Infinity ? 0 : max;
        return Number(sum.toFixed(2));
      });

      return {
        name: isMeasure ? measureObj!.name : yField,
        data,
      };
    });

    return {
      categories,
      series,
      rawRows: filteredRows,
    };
  }
}

export const globalDataEngine = new DataEngine();
