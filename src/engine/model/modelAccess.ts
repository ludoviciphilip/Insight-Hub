import { Table, Relationship, Measure, Filter } from '../../types/bi';
import { filterContextFromUIFilters } from './filterContext';

/**
 * Decoupled data model access interface for DAX and analytical query engines.
 * Eliminates global window references and circular dependencies.
 */
export interface ModelAccess {
  getTable(idOrName: string): Table | undefined;
  getTables(): Table[];
  getRelationships(): Relationship[];
  getMeasures(): Measure[];
  getMeasure?(idOrName: string): Measure | undefined;
  getFilteredRows?(targetTableId: string, activeFilters: Filter[]): Record<string, any>[];
}

/**
 * In-memory implementation of ModelAccess for standalone evaluations, tests, and workers.
 */
export class InMemoryModelAccess implements ModelAccess {
  private tablesById: Map<string, Table> = new Map();
  private tableNamesToId: Map<string, string> = new Map();
  private relationships: Relationship[] = [];
  private measuresById: Map<string, Measure> = new Map();
  private measureNamesToId: Map<string, string> = new Map();

  constructor(tables: Table[] = [], relationships: Relationship[] = [], measures: Measure[] = []) {
    this.setData(tables, relationships, measures);
  }

  public setData(tables: Table[], relationships: Relationship[], measures: Measure[]): void {
    this.tablesById.clear();
    this.tableNamesToId.clear();
    this.measuresById.clear();
    this.measureNamesToId.clear();
    this.relationships = relationships.map(r => ({ ...r }));

    tables.forEach(t => {
      this.tablesById.set(t.id, t);
      this.tableNamesToId.set(t.name.toLowerCase().trim(), t.id);
    });

    measures.forEach(m => {
      this.measuresById.set(m.id, m);
      this.measureNamesToId.set(m.name.toLowerCase().trim(), m.id);
    });
  }

  public getTable(idOrName: string): Table | undefined {
    if (!idOrName) return undefined;
    if (this.tablesById.has(idOrName)) {
      return this.tablesById.get(idOrName);
    }
    const id = this.tableNamesToId.get(idOrName.toLowerCase().trim());
    return id ? this.tablesById.get(id) : undefined;
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
    const id = this.measureNamesToId.get(clean);
    return id ? this.measuresById.get(id) : undefined;
  }

  public getFilteredRows(targetTableId: string, activeFilters: Filter[]): Record<string, any>[] {
    const table = this.getTable(targetTableId);
    if (!table) return [];
    if (!activeFilters || activeFilters.length === 0) return [...table.rows];

    const filterContext = filterContextFromUIFilters(activeFilters, this);
    return filterContext.getFilteredRows(table.id, this);
  }
}
