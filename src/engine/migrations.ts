import { ProjectState } from './storage';
import { Table, Relationship, Measure, WhatIfParameter } from '../types/bi';

export const CURRENT_ENGINE_VERSION = '2.0.0';

/**
 * Synchronizes WhatIfParameters with backing calculated tables (GENERATESERIES)
 * and measures (SELECTEDVALUE), ensuring existing projects don't break.
 */
export function syncWhatIfWithModel(
  params: WhatIfParameter[],
  tables: Table[],
  measures: Measure[]
): { tables: Table[]; measures: Measure[] } {
  let updatedTables = [...tables];
  let updatedMeasures = [...measures];

  for (const p of params) {
    const tableId = `tbl_whatif_${p.id}`;
    const tableName = p.name;
    const measureName = `${p.name} Valor`;

    // 1. Ensure calculated table exists with GENERATESERIES
    const existingTableIdx = updatedTables.findIndex(
      t => t.id === tableId || t.name.toLowerCase() === tableName.toLowerCase()
    );
    const tableExpr = `GENERATESERIES(${p.min}, ${p.max}, ${p.step})`;

    if (existingTableIdx === -1) {
      updatedTables.push({
        id: tableId,
        name: tableName,
        originalName: tableName,
        isCalculated: true,
        expression: tableExpr,
        columns: [
          {
            id: 'col_Value',
            name: 'Value',
            originalName: 'Value',
            dataType: 'number',
            isCalculated: false,
          },
        ],
        rows: [],
      });
    } else {
      updatedTables[existingTableIdx] = {
        ...updatedTables[existingTableIdx],
        isCalculated: true,
        expression: tableExpr,
      };
    }

    // 2. Ensure parameter measure exists with SELECTEDVALUE
    const existingMsrIdx = updatedMeasures.findIndex(
      m => m.id === `msr_whatif_${p.id}` || m.name.toLowerCase() === measureName.toLowerCase()
    );
    const val = p.currentValue !== undefined ? p.currentValue : p.defaultValue;
    const msrFormula = `SELECTEDVALUE('${tableName}'[Value], ${val})`;

    if (existingMsrIdx === -1) {
      updatedMeasures.push({
        id: `msr_whatif_${p.id}`,
        name: measureName,
        formula: msrFormula,
        tableName,
        format: p.unit === '%' ? 'percentage' : 'number',
        description: `Medida gerada automaticamente para o parâmetro What-If ${p.name}`,
      });
    } else {
      updatedMeasures[existingMsrIdx] = {
        ...updatedMeasures[existingMsrIdx],
        formula: msrFormula,
      };
    }
  }

  return { tables: updatedTables, measures: updatedMeasures };
}

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

  const rawWhatIf: WhatIfParameter[] = Array.isArray(rawState.whatIfParameters) ? rawState.whatIfParameters : [];
  const synced = syncWhatIfWithModel(rawWhatIf, tables, normalizedMeasures);

  return {
    version: CURRENT_ENGINE_VERSION,
    projectName: rawState.projectName || 'Projeto InsightHub',
    tables: synced.tables,
    relationships: normalizedRelationships,
    measures: synced.measures,
    pages: Array.isArray(rawState.pages) ? rawState.pages : [],
    activePageId: rawState.activePageId || rawState.pages?.[0]?.id || 'page_executivo',
    filters: Array.isArray(rawState.filters) ? rawState.filters : [],
    bookmarks: Array.isArray(rawState.bookmarks) ? rawState.bookmarks : [],
    dashboardTiles: Array.isArray(rawState.dashboardTiles) ? rawState.dashboardTiles : [],
    goals: Array.isArray(rawState.goals) ? rawState.goals : [],
    rlsRoles: Array.isArray(rawState.rlsRoles) ? rawState.rlsRoles : [],
    whatIfParameters: rawWhatIf,
    theme: rawState.theme || 'powerbi-light',
    activeThemeId: rawState.activeThemeId || 'powerbi-classic',
    customThemes: Array.isArray(rawState.customThemes) ? rawState.customThemes : [],
    gridSize: typeof rawState.gridSize === 'number' ? rawState.gridSize : 20,
    showGrid: rawState.showGrid !== undefined ? Boolean(rawState.showGrid) : true,
    snapToGrid: rawState.snapToGrid !== undefined ? Boolean(rawState.snapToGrid) : true,
    updatedAt: rawState.updatedAt || new Date().toISOString(),
  };
}
