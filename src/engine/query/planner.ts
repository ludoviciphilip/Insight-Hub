import { Visual, Filter, Table, Measure } from '../../types/bi';
import { ModelAccess } from '../model/modelAccess';
import { FilterContext, filterContextFromUIFilters } from '../model/filterContext';
import { RelationshipGraph } from '../model/relationships';
import { DaxEngine } from '../daxEngine';
import { parseNumber } from '../shared/valueParser';
import { isBlank, DAX_BLANK } from '../expr/types';
import { Evaluator } from '../expr/evaluator';

export interface VisualQueryResult {
  categories: string[];
  series: { name: string; data: number[] }[];
  rawRows: Record<string, any>[];
  summaryValue?: number;
  matrixHierarchy?: any[];
  subtotals?: Record<string, number>;
  grandTotal?: number;
  queryTimeMs?: number;
}

export class QueryPlanner {
  private model: ModelAccess;

  constructor(model: ModelAccess) {
    this.model = model;
  }

  /**
   * Main entry point for visual data queries in InsightHub V0.3
   */
  public query(visual: Visual, activeFilters: Filter[] = []): VisualQueryResult {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const tableId = visual.dataConfig.tableId;
    const table = this.model.getTable(tableId);

    if (!table) {
      return { categories: [], series: [], rawRows: [] };
    }

    // Convert UI filters to structured FilterContext
    const baseFilterContext = filterContextFromUIFilters(activeFilters, this.model, visual.id);
    const visibleRowIndices = baseFilterContext.getVisibleRowIndices(table.id, this.model);
    const filteredRows = visibleRowIndices.map(i => table.rows[i]);

    // 1. Single Card, KPI, or Gauge Visual
    if (visual.type === 'card' || visual.type === 'kpi' || visual.type === 'gauge') {
      const yField = visual.dataConfig.yAxisFields?.[0] || table.columns.find(c => c.dataType === 'number' || c.dataType === 'currency')?.name || '';
      const agg = visual.dataConfig.aggregation || 'SUM';
      const measure = this.model.getMeasure ? this.model.getMeasure(yField) : undefined;

      let summary: number | null = null;

      if (measure) {
        const val = DaxEngine.evaluateWithContext(measure.formula, this.model, baseFilterContext);
        summary = typeof val === 'number' && !isNaN(val) ? val : (isBlank(val) ? 0 : Number(val) || 0);
      } else if (yField) {
        summary = this.calculateImplicitAggregation(filteredRows, yField, agg);
      }

      const totalTime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;

      return {
        categories: [visual.title || yField],
        series: [{ name: yField, data: [summary !== null ? summary : 0] }],
        rawRows: filteredRows,
        summaryValue: summary !== null ? summary : undefined,
        grandTotal: summary !== null ? summary : undefined,
        queryTimeMs: Number(totalTime.toFixed(1)),
      };
    }

    // 2. Slicer Visual (Cross-filtered distinct dimension values)
    if (visual.type === 'slicer') {
      const targetCol = visual.dataConfig.xAxisField || table.columns[0]?.name || '';
      const distinctSet = new Set<string>();

      filteredRows.forEach(r => {
        const val = r[targetCol];
        if (!isBlank(val) && val !== null && val !== undefined && val !== '') {
          distinctSet.add(String(val));
        }
      });

      const categories = Array.from(distinctSet).sort((a, b) => a.localeCompare(b));
      const totalTime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;

      return {
        categories,
        series: [{ name: targetCol, data: categories.map(() => 1) }],
        rawRows: filteredRows,
        queryTimeMs: Number(totalTime.toFixed(1)),
      };
    }

    // 3. Multi-Field / Standard Charts (Column, Bar, Line, Area, Pie, Donut, Treemap, Funnel, Matrix, Table)
    // Multi-campo drill level resolution
    let effectiveXField = visual.dataConfig.xAxisField || table.columns[0]?.name || 'Categoria';
    if (
      visual.dataConfig.drillFields &&
      visual.dataConfig.drillFields.length > 0 &&
      visual.dataConfig.currentDrillLevel !== undefined &&
      visual.dataConfig.currentDrillLevel > 0
    ) {
      const drillIdx = visual.dataConfig.currentDrillLevel - 1;
      if (drillIdx < visual.dataConfig.drillFields.length) {
        effectiveXField = visual.dataConfig.drillFields[drillIdx];
      }
    }

    // Resolve column & table for X axis
    const { categoryTable, cleanColName } = this.resolveColumnLocation(table, effectiveXField);

    // Grouping & Categories extraction in batch
    const categories = this.extractCategories(table, categoryTable, cleanColName, baseFilterContext, filteredRows);

    // Check if legendField is provided for series breakdown
    const legendField = visual.dataConfig.legendField;
    let series: { name: string; data: number[] }[] = [];

    const yFields = visual.dataConfig.yAxisFields && visual.dataConfig.yAxisFields.length > 0
      ? visual.dataConfig.yAxisFields
      : [table.columns.find(c => c.dataType === 'number' || c.dataType === 'currency')?.name || 'ValorTotal'];

    if (legendField) {
      // Legend breakdown: One series per distinct value of legendField
      const { categoryTable: legendTable, cleanColName: legendCol } = this.resolveColumnLocation(table, legendField);
      const legendValues = this.extractCategories(table, legendTable, legendCol, baseFilterContext, filteredRows);
      const targetMetric = yFields[0];
      const measureObj = this.model.getMeasure ? this.model.getMeasure(targetMetric) : undefined;
      const isMeasure = !!measureObj;
      const agg = visual.dataConfig.aggregation || (isMeasure ? 'NONE' : 'SUM');

      series = legendValues.map(legVal => {
        const data = categories.map(cat => {
          const sliceContext = baseFilterContext.clone();
          sliceContext.setColumnFilter(categoryTable.id, cleanColName, {
            tableId: categoryTable.id,
            column: cleanColName,
            allowedValues: new Set([cat]),
          });
          sliceContext.setColumnFilter(legendTable.id, legendCol, {
            tableId: legendTable.id,
            column: legendCol,
            allowedValues: new Set([legVal]),
          });

          if (isMeasure && measureObj) {
            const val = DaxEngine.evaluateWithContext(measureObj.formula, this.model, sliceContext);
            return typeof val === 'number' && !isNaN(val) ? val : (isBlank(val) ? 0 : Number(val) || 0);
          } else {
            const sliceRows = sliceContext.getFilteredRows(table.id, this.model);
            return this.calculateImplicitAggregation(sliceRows, targetMetric, agg);
          }
        });

        return {
          name: legVal,
          data,
        };
      });
    } else {
      // Standard metrics: One series per yAxisField
      series = yFields.map(yField => {
        const measureObj = this.model.getMeasure ? this.model.getMeasure(yField) : undefined;
        const isMeasure = !!measureObj;
        const agg = visual.dataConfig.aggregation || (isMeasure ? 'NONE' : 'SUM');

        const data = categories.map(cat => {
          const sliceContext = baseFilterContext.clone();
          sliceContext.setColumnFilter(categoryTable.id, cleanColName, {
            tableId: categoryTable.id,
            column: cleanColName,
            allowedValues: new Set([cat]),
          });

          if (isMeasure && measureObj) {
            const val = DaxEngine.evaluateWithContext(measureObj.formula, this.model, sliceContext);
            return typeof val === 'number' && !isNaN(val) ? val : (isBlank(val) ? 0 : Number(val) || 0);
          } else {
            const sliceRows = sliceContext.getFilteredRows(table.id, this.model);
            return this.calculateImplicitAggregation(sliceRows, yField, agg);
          }
        });

        return {
          name: isMeasure ? measureObj!.name : yField,
          data,
        };
      });
    }

    // Top N by Value and Sorting
    let finalCategories = [...categories];
    let finalSeries = series.map(s => ({ ...s, data: [...s.data] }));

    // Real sorting by sortField & sortOrder
    const sortOrder = visual.dataConfig.sortOrder === 'desc' ? -1 : 1;
    const sortField = visual.dataConfig.sortField;

    if (sortField) {
      // Check if sortField matches a series or category
      const seriesIndex = finalSeries.findIndex(s => s.name.toLowerCase() === sortField.toLowerCase());
      const indices = finalCategories.map((_, i) => i);

      if (seriesIndex !== -1) {
        indices.sort((a, b) => {
          const valA = finalSeries[seriesIndex].data[a] ?? 0;
          const valB = finalSeries[seriesIndex].data[b] ?? 0;
          return (valA - valB) * sortOrder;
        });
      } else {
        indices.sort((a, b) => finalCategories[a].localeCompare(finalCategories[b]) * sortOrder);
      }

      finalCategories = indices.map(i => finalCategories[i]);
      finalSeries = finalSeries.map(s => ({
        name: s.name,
        data: indices.map(i => s.data[i]),
      }));
    }

    // Limit = Top N by Value (if no explicit sort, sort descending by primary series value)
    if (visual.dataConfig.limit && visual.dataConfig.limit > 0 && finalCategories.length > visual.dataConfig.limit) {
      if (!sortField && finalSeries.length > 0) {
        const indices = finalCategories.map((_, i) => i);
        indices.sort((a, b) => (finalSeries[0].data[b] - finalSeries[0].data[a]));
        finalCategories = indices.map(i => finalCategories[i]);
        finalSeries = finalSeries.map(s => ({
          name: s.name,
          data: indices.map(i => s.data[i]),
        }));
      }

      finalCategories = finalCategories.slice(0, visual.dataConfig.limit);
      finalSeries = finalSeries.map(s => ({
        name: s.name,
        data: s.data.slice(0, visual.dataConfig.limit),
      }));
    }

    // Apply Visual Calculations (V0.6)
    const visualRows = this.applyVisualCalculations(
      visual,
      finalCategories,
      finalSeries,
      effectiveXField,
      baseFilterContext
    );

    // Calculate Grand Total using own context without category filters
    let grandTotal: number | undefined;
    if (yFields.length > 0) {
      const primaryMetric = yFields[0];
      const measureObj = this.model.getMeasure ? this.model.getMeasure(primaryMetric) : undefined;
      if (measureObj) {
        const val = DaxEngine.evaluateWithContext(measureObj.formula, this.model, baseFilterContext);
        grandTotal = typeof val === 'number' && !isNaN(val) ? val : undefined;
      } else {
        grandTotal = this.calculateImplicitAggregation(filteredRows, primaryMetric, visual.dataConfig.aggregation || 'SUM');
      }
    }

    const totalTime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;

    const hasVisualCalcs = (visual.dataConfig?.visualCalculations?.length ?? 0) > 0 || (visual.visualCalculations?.length ?? 0) > 0;

    return {
      categories: finalCategories,
      series: finalSeries,
      rawRows: (hasVisualCalcs && visualRows.length > 0) ? visualRows : filteredRows,
      grandTotal,
      queryTimeMs: Number(totalTime.toFixed(1)),
    };
  }

  /**
   * Applies Visual Calculations (Cálculos Visuais) over visual rows
   */
  private applyVisualCalculations(
    visual: Visual,
    categories: string[],
    series: { name: string; data: number[] }[],
    effectiveXField: string,
    filterContext: FilterContext
  ): Record<string, any>[] {
    const calcs = visual.dataConfig?.visualCalculations || visual.visualCalculations;
    if (!calcs || calcs.length === 0 || categories.length === 0) return [];

    // Synthesize visual rows representing the visual's current layout
    const visualRows: Record<string, any>[] = categories.map((cat, idx) => {
      const row: Record<string, any> = {
        [effectiveXField]: cat,
        Category: cat,
      };
      for (const s of series) {
        row[s.name] = s.data[idx];
      }
      return row;
    });

    for (const vc of calcs) {
      if (!vc.name || !vc.formula) continue;
      const calcData: number[] = [];

      for (let rIdx = 0; rIdx < visualRows.length; rIdx++) {
        try {
          const evalContext = {
            model: this.model,
            filterContext,
            isVisualCalculation: true,
            visualRows,
            visualRowIndex: rIdx,
            row: visualRows[rIdx],
            rowIndex: rIdx,
            tables: this.model.getTables(),
            measures: this.model.getMeasures ? this.model.getMeasures() : [],
          };
          const evaluator = new Evaluator(evalContext);
          const rawResult = evaluator.evaluate(vc.formula);
          const num = typeof rawResult === 'number' && !isNaN(rawResult)
            ? rawResult
            : (isBlank(rawResult) ? 0 : Number(rawResult) || 0);

          calcData.push(num);
          visualRows[rIdx][vc.name] = rawResult;
        } catch (err) {
          console.warn(`[VisualCalculation] Erro ao calcular "${vc.name}":`, err);
          calcData.push(0);
          visualRows[rIdx][vc.name] = 0;
        }
      }

      series.push({
        name: vc.name,
        data: calcData,
      });
    }

    return visualRows;
  }

  private resolveColumnLocation(
    baseTable: Table,
    rawColName: string
  ): { categoryTable: Table; cleanColName: string } {
    let categoryTable = baseTable;
    let cleanColName = rawColName;

    if (rawColName.includes('.')) {
      const [tPrefix, cName] = rawColName.split('.', 2);
      const foundTable = this.model.getTable(tPrefix);
      if (foundTable) {
        categoryTable = foundTable;
        cleanColName = cName;
      }
    } else if (!baseTable.columns.some(c => c.name.toLowerCase() === rawColName.toLowerCase())) {
      // Find in related tables
      for (const t of this.model.getTables()) {
        if (t.id !== baseTable.id && t.columns.some(c => c.name.toLowerCase() === rawColName.toLowerCase())) {
          categoryTable = t;
          cleanColName = t.columns.find(c => c.name.toLowerCase() === rawColName.toLowerCase())!.name;
          break;
        }
      }
    }

    return { categoryTable, cleanColName };
  }

  private extractCategories(
    baseTable: Table,
    categoryTable: Table,
    colName: string,
    filterContext: FilterContext,
    baseFilteredRows: Record<string, any>[]
  ): string[] {
    const categoriesSet = new Set<string>();

    if (categoryTable.id === baseTable.id) {
      baseFilteredRows.forEach(r => {
        const val = r[colName];
        if (!isBlank(val) && val !== null && val !== undefined && val !== '') {
          categoriesSet.add(String(val));
        }
      });
    } else {
      // Related table: resolve active relationship from baseTable to categoryTable
      const graph = new RelationshipGraph(this.model);
      const path = graph.findActivePath(baseTable.id, categoryTable.id);
      if (path && path.length > 0 && baseFilteredRows.length > 0) {
        const activeKeys = new Set<string>();
        baseFilteredRows.forEach(r => {
          const k = String(r[path[0].fromColumn] ?? '').trim();
          if (k) activeKeys.add(k);
        });

        const catRows = filterContext.getFilteredRows(categoryTable.id, this.model);
        const toCol = path[path.length - 1].toColumn;
        catRows.forEach(cr => {
          const joinVal = String(cr[toCol] ?? '').trim();
          if (activeKeys.has(joinVal)) {
            const val = cr[colName];
            if (!isBlank(val) && val !== null && val !== undefined && val !== '') {
              categoriesSet.add(String(val));
            }
          }
        });
      } else {
        const catRows = filterContext.getFilteredRows(categoryTable.id, this.model);
        catRows.forEach(cr => {
          const val = cr[colName];
          if (!isBlank(val) && val !== null && val !== undefined && val !== '') {
            categoriesSet.add(String(val));
          }
        });
      }
    }

    return Array.from(categoriesSet);
  }

  private calculateImplicitAggregation(
    rows: Record<string, any>[],
    columnName: string,
    agg: Visual['dataConfig']['aggregation']
  ): number {
    if (rows.length === 0) return 0;

    const values = rows.map(r => r[columnName]);
    const numValues = values.map(v => parseNumber(v).value ?? 0);

    switch (agg) {
      case 'AVG':
        return numValues.length ? numValues.reduce((a, b) => a + b, 0) / numValues.length : 0;
      case 'COUNT':
        return values.filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '').length;
      case 'DISTINCTCOUNT':
        return new Set(values.filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')).size;
      case 'MIN':
        return numValues.length ? Math.min(...numValues) : 0;
      case 'MAX':
        return numValues.length ? Math.max(...numValues) : 0;
      case 'NONE':
        return numValues[0] ?? 0;
      case 'SUM':
      default:
        return numValues.reduce((a, b) => a + b, 0);
    }
  }
}
