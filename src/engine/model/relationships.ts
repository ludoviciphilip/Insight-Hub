import { Table, Relationship } from '../../types/bi';
import { DaxError } from '../shared/errors';
import { ModelAccess } from './modelAccess';

export interface RelationshipOverride {
  relationshipId?: string;
  fromTable?: string;
  fromColumn?: string;
  toTable?: string;
  toColumn?: string;
  crossFilterDirection?: 'single' | 'both' | 'none';
  isActive?: boolean;
}

export interface PathStep {
  relationship: Relationship;
  fromTableId: string;
  fromColumn: string;
  toTableId: string;
  toColumn: string;
}

export class RelationshipGraph {
  private relationships: Relationship[] = [];
  private model: ModelAccess;

  constructor(model: ModelAccess) {
    this.model = model;
    this.relationships = model.getRelationships ? model.getRelationships() : [];
  }

  /**
   * Resolves effective relationships applying any CALCULATE overrides (USERELATIONSHIP, CROSSFILTER)
   */
  public getEffectiveRelationships(overrides: RelationshipOverride[] = []): Relationship[] {
    const rels = this.relationships.map(r => ({ ...r }));

    overrides.forEach(ov => {
      // Find matching relationship by ID or by column pair
      const matched = rels.find(r => {
        if (ov.relationshipId && r.id === ov.relationshipId) return true;
        if (ov.fromTable && ov.toTable && ov.fromColumn && ov.toColumn) {
          const m1 =
            (r.fromTable.toLowerCase() === ov.fromTable.toLowerCase() &&
              r.fromColumn.toLowerCase() === ov.fromColumn.toLowerCase() &&
              r.toTable.toLowerCase() === ov.toTable.toLowerCase() &&
              r.toColumn.toLowerCase() === ov.toColumn.toLowerCase());
          const m2 =
            (r.fromTable.toLowerCase() === ov.toTable.toLowerCase() &&
              r.fromColumn.toLowerCase() === ov.toColumn.toLowerCase() &&
              r.toTable.toLowerCase() === ov.fromTable.toLowerCase() &&
              r.toColumn.toLowerCase() === ov.fromColumn.toLowerCase());
          return m1 || m2;
        }
        return false;
      });

      if (matched) {
        if (ov.isActive !== undefined) {
          // If activating an inactive relationship between two tables, deactivate other relationships between them
          if (ov.isActive) {
            rels.forEach(other => {
              if (
                other !== matched &&
                ((other.fromTable === matched.fromTable && other.toTable === matched.toTable) ||
                  (other.fromTable === matched.toTable && other.toTable === matched.fromTable))
              ) {
                other.isActive = false;
              }
            });
          }
          matched.isActive = ov.isActive;
        }
        if (ov.crossFilterDirection !== undefined) {
          if (ov.crossFilterDirection === 'none') {
            matched.isActive = false;
          } else {
            matched.crossFilterDirection = ov.crossFilterDirection;
          }
        }
      }
    });

    return rels;
  }

  /**
   * Finds the shortest active propagation path from sourceTable to targetTable
   * respecting filter direction and cardinality.
   */
  public findActivePath(
    sourceTableId: string,
    targetTableId: string,
    overrides: RelationshipOverride[] = []
  ): PathStep[] | null {
    const sId = this.normalizeTableId(sourceTableId);
    const tId = this.normalizeTableId(targetTableId);

    if (sId === tId) return [];

    const effectiveRels = this.getEffectiveRelationships(overrides).filter(r => r.isActive);

    // BFS to find shortest path
    const queue: { tableId: string; path: PathStep[] }[] = [{ tableId: sId, path: [] }];
    const visited = new Set<string>([sId]);
    const allPaths: PathStep[][] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.tableId === tId) {
        allPaths.push(current.path);
        // Continue searching at same depth to detect ambiguity
        continue;
      }

      for (const rel of effectiveRels) {
        const fromNorm = this.normalizeTableId(rel.fromTable);
        const toNorm = this.normalizeTableId(rel.toTable);

        // Check if filter can propagate from current.tableId along this relationship
        // Standard Power BI behavior:
        // By default rel.fromTable is N (Fact) and rel.toTable is 1 (Dim)
        // If cardinality is '1:N', toTable is 1 and fromTable is N
        // Dimension filters propagate to Fact table (1 -> N)
        // Bidirectional ('both') propagates in both directions

        let nextTableId: string | null = null;
        let fromCol = '';
        let toCol = '';

        if (current.tableId === toNorm) {
          // Flowing from toTable (1-side) to fromTable (N-side) -> Always allowed
          nextTableId = fromNorm;
          fromCol = rel.toColumn;
          toCol = rel.fromColumn;
        } else if (current.tableId === fromNorm) {
          // Flowing from fromTable (N-side) to toTable (1-side) -> Allowed ONLY if crossFilterDirection === 'both' or 1:1
          if (rel.crossFilterDirection === 'both' || rel.cardinality === '1:1') {
            nextTableId = toNorm;
            fromCol = rel.fromColumn;
            toCol = rel.toColumn;
          }
        }

        if (nextTableId && !visited.has(nextTableId)) {
          visited.add(nextTableId);
          queue.push({
            tableId: nextTableId,
            path: [
              ...current.path,
              {
                relationship: rel,
                fromTableId: current.tableId,
                fromColumn: fromCol,
                toTableId: nextTableId,
                toColumn: toCol,
              },
            ],
          });
        }
      }
    }

    if (allPaths.length === 0) return null;

    if (allPaths.length > 1) {
      // Check if they have same length (ambiguity)
      const minLen = Math.min(...allPaths.map(p => p.length));
      const candidates = allPaths.filter(p => p.length === minLen);
      if (candidates.length > 1) {
        throw new DaxError(
          'Semantic',
          `Caminho de relacionamento ambíguo entre as tabelas "${sourceTableId}" e "${targetTableId}". Especifique USERELATIONSHIP para resolver.`
        );
      }
      return candidates[0];
    }

    return allPaths[0];
  }

  private normalizeTableId(idOrName: string): string {
    const table = this.model.getTable(idOrName);
    return table ? table.id : idOrName;
  }
}
