import { Table, Measure } from '../types/bi';

export const MAX_PAYLOAD_BYTES = 50 * 1024; // 50 KB safety limit

export interface SafeColumnSchema {
  name: string;
  dataType: string;
}

export interface SafeTableSchema {
  name: string;
  rowCount: number;
  columns: SafeColumnSchema[];
}

export interface SafeMeasureSchema {
  name: string;
  formula: string;
}

export interface SafeSchemaModel {
  tables: SafeTableSchema[];
  measures: SafeMeasureSchema[];
  omittedTables?: string[];
  omittedMeasures?: string[];
}

/**
 * Builds a strict, privacy-safe schema representation of the data model.
 * Emits ONLY: table name, row count (total rows), columns (name and dataType),
 * and measures (name and formula).
 * NEVER emits row cell values or raw data contents.
 */
export function buildSafeSchemaModel(
  tables: Table[] = [],
  measures: Measure[] = []
): SafeSchemaModel {
  return {
    tables: (tables || []).map(t => ({
      name: t.name,
      rowCount: Array.isArray(t.rows) ? t.rows.length : 0,
      columns: (t.columns || []).map(c => ({
        name: c.name,
        dataType: c.dataType,
      })),
    })),
    measures: (measures || []).map(m => ({
      name: m.name,
      formula: m.formula,
    })),
  };
}

/**
 * Serializes the safe schema to a formatted JSON string.
 */
export function buildSafeSchema(
  tables: Table[] = [],
  measures: Measure[] = []
): string {
  return JSON.stringify(buildSafeSchemaModel(tables, measures), null, 2);
}

/**
 * Structural truncation of payloads up to maxBytes (default: 50 KB).
 * Discards entire tables (from the end) until the payload fits within maxBytes,
 * keeping the JSON structurally valid at all times and recording omitted tables.
 * Never uses raw string slice that would break JSON syntax.
 */
export function truncatePayload(
  payload: string | SafeSchemaModel | Record<string, any>,
  maxBytes: number = MAX_PAYLOAD_BYTES
): { data: string; isTruncated: boolean; omittedTables: string[] } {
  let parsed: any;
  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload);
    } catch {
      const strBytes = new Blob([payload]).size;
      if (strBytes <= maxBytes) {
        return { data: payload, isTruncated: false, omittedTables: [] };
      }
      return {
        data: JSON.stringify({
          text: payload.substring(0, Math.floor(maxBytes * 0.85)),
          isTruncated: true,
          notice: 'Payload excedeu 50 KB e foi truncado de forma segura.',
        }),
        isTruncated: true,
        omittedTables: [],
      };
    }
  } else {
    parsed = JSON.parse(JSON.stringify(payload));
  }

  const initialJson = JSON.stringify(parsed, null, 2);
  if (new Blob([initialJson]).size <= maxBytes) {
    return { data: initialJson, isTruncated: false, omittedTables: [] };
  }

  const omittedTables: string[] = [];

  // Discard entire tables from the end until it fits within maxBytes
  if (Array.isArray(parsed?.tables) && parsed.tables.length > 0) {
    while (parsed.tables.length > 0) {
      const removed = parsed.tables.pop();
      if (removed?.name) {
        omittedTables.unshift(removed.name);
      }
      parsed.omittedTables = omittedTables;

      const currentJson = JSON.stringify(parsed, null, 2);
      if (new Blob([currentJson]).size <= maxBytes) {
        return { data: currentJson, isTruncated: true, omittedTables };
      }
    }
  }

  // If still too large, discard measures from the end
  if (Array.isArray(parsed?.measures) && parsed.measures.length > 0) {
    const omittedMeasures: string[] = [];
    while (parsed.measures.length > 0) {
      const removed = parsed.measures.pop();
      if (removed?.name) {
        omittedMeasures.unshift(removed.name);
      }
      parsed.omittedMeasures = omittedMeasures;

      const currentJson = JSON.stringify(parsed, null, 2);
      if (new Blob([currentJson]).size <= maxBytes) {
        return { data: currentJson, isTruncated: true, omittedTables };
      }
    }
  }

  // Final structural fallback: always valid JSON
  const fallback = {
    summary: 'Payload estruturalmente reduzido para respeitar o limite de 50 KB.',
    omittedTables,
    isTruncated: true,
  };
  return {
    data: JSON.stringify(fallback, null, 2),
    isTruncated: true,
    omittedTables,
  };
}
