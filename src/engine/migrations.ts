import { ProjectState } from './storage';
import { Table, Relationship } from '../types/bi';

export const CURRENT_ENGINE_VERSION = '2.0.0';

/**
 * Normalizes and migrates any older project state (v1 or legacy) to the v2 schema.
 * Ensures:
 * 1. Relationships fromTable/toTable always point to table IDs instead of names.
 * 2. All required fields are present with correct defaults.
 * 3. Preserves backwards compatibility without dropping user data.
 */
export function migrateProjectState(rawState: any): ProjectState {
  if (!rawState || typeof rawState !== 'object') {
    throw new Error('Estado do projeto inválido para migração');
  }

  const tables: Table[] = Array.isArray(rawState.tables) ? rawState.tables : [];

  // Build name-to-id lookup for table normalization
  const nameToIdMap = new Map<string, string>();
  tables.forEach(t => {
    if (t.name && t.id) {
      nameToIdMap.set(t.name.toLowerCase().trim(), t.id);
    }
  });

  // Migrate relationships: normalize fromTable/toTable to IDs
  const rawRels: any[] = Array.isArray(rawState.relationships) ? rawState.relationships : [];
  const normalizedRelationships: Relationship[] = rawRels.map(r => {
    const fromId = nameToIdMap.get(String(r.fromTable || '').toLowerCase().trim()) || r.fromTable;
    const toId = nameToIdMap.get(String(r.toTable || '').toLowerCase().trim()) || r.toTable;
    return {
      ...r,
      fromTable: fromId,
      toTable: toId,
    };
  });

    // Migrate measures: map legacy format enum to formatString if missing
    const rawMeasures: any[] = Array.isArray(rawState.measures) ? rawState.measures : [];
    const normalizedMeasures = rawMeasures.map(m => {
      let formatString = m.formatString;
      if (!formatString && m.format) {
        switch (m.format) {
          case 'currency':
            formatString = 'Currency';
            break;
          case 'percentage':
            formatString = '0.0%';
            break;
          case 'integer':
            formatString = '#,##0';
            break;
          case 'number':
          default:
            formatString = '#,##0.00';
            break;
        }
      }
      return {
        ...m,
        formatString: formatString || '#,##0.00',
      };
    });

    return {
      version: CURRENT_ENGINE_VERSION,
      projectName: rawState.projectName || 'Projeto InsightHub',
      tables,
      relationships: normalizedRelationships,
      measures: normalizedMeasures,
      pages: Array.isArray(rawState.pages) ? rawState.pages : [],
    activePageId: rawState.activePageId || rawState.pages?.[0]?.id || 'page_executivo',
    filters: Array.isArray(rawState.filters) ? rawState.filters : [],
    bookmarks: Array.isArray(rawState.bookmarks) ? rawState.bookmarks : [],
    dashboardTiles: Array.isArray(rawState.dashboardTiles) ? rawState.dashboardTiles : [],
    goals: Array.isArray(rawState.goals) ? rawState.goals : [],
    rlsRoles: Array.isArray(rawState.rlsRoles) ? rawState.rlsRoles : [],
    whatIfParameters: Array.isArray(rawState.whatIfParameters) ? rawState.whatIfParameters : [],
    theme: rawState.theme || 'powerbi-light',
    activeThemeId: rawState.activeThemeId || 'powerbi-classic',
    customThemes: Array.isArray(rawState.customThemes) ? rawState.customThemes : [],
    gridSize: typeof rawState.gridSize === 'number' ? rawState.gridSize : 20,
    showGrid: rawState.showGrid !== undefined ? Boolean(rawState.showGrid) : true,
    snapToGrid: rawState.snapToGrid !== undefined ? Boolean(rawState.snapToGrid) : true,
    updatedAt: rawState.updatedAt || new Date().toISOString(),
  };
}
