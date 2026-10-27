import { Table, Measure, Visual, UserDefinedFunction } from '../../types/bi';
import { Lexer } from '../expr/lexer';
import { Token } from '../expr/tokens';

export interface DependencyNode {
  id: string;
  name: string;
  type: 'table' | 'column' | 'measure' | 'udf';
  tableName?: string;
  formula?: string;
  description?: string;
}

export interface DependencyEdge {
  fromId: string;
  toId: string;
  type: 'references' | 'contains';
}

export interface ModelDependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

/**
 * Extracts all table, column, and measure references from a formula string.
 */
export function extractFormulaDependencies(formula: string): {
  measures: string[];
  columns: { table?: string; column: string }[];
} {
  if (!formula || typeof formula !== 'string') {
    return { measures: [], columns: [] };
  }

  const measures: Set<string> = new Set();
  const columns: { table?: string; column: string }[] = [];

  try {
    const lexer = new Lexer(formula, { dialect: 'dax' });
    const tokens = lexer.tokenize();

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.type === 'COLUMN_REF') {
        const prevTok = i > 0 ? tokens[i - 1] : null;
        if (prevTok && (prevTok.type === 'TABLE_REF' || prevTok.type === 'IDENTIFIER')) {
          columns.push({ table: prevTok.value, column: tok.value });
        } else {
          // In DAX, an isolated [Identifier] without table prefix is either a measure or a current row column.
          measures.add(tok.value);
        }
      }
    }
  } catch {
    // If syntax error in formula, fallback to safe regex search
    const bracketMatches = formula.match(/\[([^\]]+)\]/g);
    if (bracketMatches) {
      bracketMatches.forEach(m => measures.add(m.slice(1, -1)));
    }
  }

  return {
    measures: Array.from(measures),
    columns,
  };
}

/**
 * Renames all references of a measure across all measure formulas and visual bindings.
 * Uses token-level replacement to prevent replacing substrings of other measures.
 */
export function renameMeasureReferences(
  oldName: string,
  newName: string,
  measures: Measure[],
  visuals: Visual[] = []
): {
  updatedMeasures: Measure[];
  updatedVisuals: Visual[];
  affectedCount: number;
} {
  const cleanOld = oldName.trim();
  const cleanNew = newName.trim();

  if (cleanOld === cleanNew || !cleanOld || !cleanNew) {
    return { updatedMeasures: measures, updatedVisuals: visuals, affectedCount: 0 };
  }

  let affectedCount = 0;

  // 1. Update measures
  const updatedMeasures = measures.map(m => {
    // If this is the measure being renamed itself:
    if (m.name.trim().toLowerCase() === cleanOld.toLowerCase()) {
      return { ...m, name: cleanNew };
    }

    // Otherwise replace references to cleanOld in formula
    const originalFormula = m.formula;
    try {
      const lexer = new Lexer(originalFormula, { dialect: 'dax' });
      const tokens = lexer.tokenize();
      let formulaModified = false;

      // Reconstruct formula with token replacements
      let newFormula = '';
      let lastIndex = 0;

      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok.type === 'COLUMN_REF' && tok.value.trim().toLowerCase() === cleanOld.toLowerCase()) {
          const prev = i > 0 ? tokens[i - 1] : null;
          // If not preceded by a table reference, or preceded by m.tableName
          if (!prev || prev.type !== 'TABLE_REF' || prev.value === m.tableName) {
            newFormula += originalFormula.substring(lastIndex, tok.start.offset);
            newFormula += `[${cleanNew}]`;
            lastIndex = tok.end.offset;
            formulaModified = true;
          }
        }
      }

      if (formulaModified) {
        newFormula += originalFormula.substring(lastIndex);
        affectedCount++;
        return { ...m, formula: newFormula };
      }
    } catch {
      // Fallback regex with word boundary
      const escaped = cleanOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`\\[${escaped}\\]`, 'gi');
      if (reg.test(originalFormula)) {
        affectedCount++;
        return { ...m, formula: originalFormula.replace(reg, `[${cleanNew}]`) };
      }
    }

    return m;
  });

  // 2. Update visual field bindings
  const updatedVisuals = visuals.map(v => {
    let visualModified = false;
    const newYFields = (v.dataConfig.yAxisFields || []).map(f => {
      if (f.trim().toLowerCase() === cleanOld.toLowerCase()) {
        visualModified = true;
        return cleanNew;
      }
      return f;
    });

    let newXField = v.dataConfig.xAxisField;
    if (newXField && newXField.trim().toLowerCase() === cleanOld.toLowerCase()) {
      visualModified = true;
      newXField = cleanNew;
    }

    if (visualModified) {
      return {
        ...v,
        dataConfig: {
          ...v.dataConfig,
          xAxisField: newXField,
          yAxisFields: newYFields,
        },
      };
    }
    return v;
  });

  return {
    updatedMeasures,
    updatedVisuals,
    affectedCount,
  };
}

/**
 * Builds the complete dependency graph of the BI model.
 */
export function buildModelDependencyGraph(
  tables: Table[],
  measures: Measure[],
  udfs: UserDefinedFunction[] = []
): ModelDependencyGraph {
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];
  const nodeSet = new Set<string>();

  const addNode = (node: DependencyNode) => {
    if (!nodeSet.has(node.id)) {
      nodeSet.add(node.id);
      nodes.push(node);
    }
  };

  // 1. Add Tables and Columns
  for (const t of tables) {
    const tableNodeId = `tbl_${t.id}`;
    addNode({
      id: tableNodeId,
      name: t.name,
      type: 'table',
      description: `${t.columns.length} colunas, ${t.rows.length} linhas`,
    });

    for (const c of t.columns) {
      const colNodeId = `col_${t.name}_${c.name}`;
      addNode({
        id: colNodeId,
        name: `${t.name}[${c.name}]`,
        type: 'column',
        tableName: t.name,
        description: `Tipo: ${c.dataType}`,
      });
      edges.push({
        fromId: colNodeId,
        toId: tableNodeId,
        type: 'contains',
      });
    }
  }

  // 2. Add UDFs
  for (const fn of udfs) {
    const fnNodeId = `udf_${fn.name}`;
    addNode({
      id: fnNodeId,
      name: fn.name,
      type: 'udf',
      formula: fn.body,
      description: `Parâmetros: (${fn.parameters.join(', ')})`,
    });
  }

  // 3. Add Measures and extract dependencies
  for (const m of measures) {
    const mNodeId = `msr_${m.name}`;
    addNode({
      id: mNodeId,
      name: `[${m.name}]`,
      type: 'measure',
      tableName: m.tableName,
      formula: m.formula,
      description: m.description || `Medida na tabela ${m.tableName}`,
    });

    // Reference table container
    const tbl = tables.find(t => t.name.toLowerCase() === m.tableName.toLowerCase());
    if (tbl) {
      edges.push({
        fromId: mNodeId,
        toId: `tbl_${tbl.id}`,
        type: 'contains',
      });
    }

    // Extract dependencies from formula
    const deps = extractFormulaDependencies(m.formula);

    for (const depMeasure of deps.measures) {
      const targetMeasure = measures.find(other => other.name.toLowerCase() === depMeasure.toLowerCase());
      if (targetMeasure && targetMeasure.name !== m.name) {
        edges.push({
          fromId: mNodeId,
          toId: `msr_${targetMeasure.name}`,
          type: 'references',
        });
      }
    }

    for (const depCol of deps.columns) {
      const colNodeId = depCol.table
        ? `col_${depCol.table}_${depCol.column}`
        : nodes.find(n => n.type === 'column' && n.name.endsWith(`[${depCol.column}]`))?.id;

      if (colNodeId && nodeSet.has(colNodeId)) {
        edges.push({
          fromId: mNodeId,
          toId: colNodeId,
          type: 'references',
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Finds the definition and details of a given identifier (measure, column, table, UDF).
 */
export function findDefinition(
  identifier: string,
  tables: Table[],
  measures: Measure[],
  udfs: UserDefinedFunction[] = []
): { found: boolean; node?: DependencyNode; details?: any } {
  const clean = identifier.replace(/^\[|\]$|^'|'$/g, '').trim().toLowerCase();

  // 1. Check measures
  const m = measures.find(item => item.name.toLowerCase() === clean);
  if (m) {
    return {
      found: true,
      node: {
        id: `msr_${m.name}`,
        name: `[${m.name}]`,
        type: 'measure',
        tableName: m.tableName,
        formula: m.formula,
        description: m.description,
      },
      details: m,
    };
  }

  // 2. Check UDFs
  const fn = udfs.find(item => item.name.toLowerCase() === clean);
  if (fn) {
    return {
      found: true,
      node: {
        id: `udf_${fn.name}`,
        name: fn.name,
        type: 'udf',
        formula: fn.body,
        description: fn.description,
      },
      details: fn,
    };
  }

  // 3. Check Tables
  const t = tables.find(item => item.name.toLowerCase() === clean);
  if (t) {
    return {
      found: true,
      node: {
        id: `tbl_${t.id}`,
        name: t.name,
        type: 'table',
        description: `${t.columns.length} colunas`,
      },
      details: t,
    };
  }

  // 4. Check Columns
  for (const table of tables) {
    const col = table.columns.find(c => c.name.toLowerCase() === clean);
    if (col) {
      return {
        found: true,
        node: {
          id: `col_${table.name}_${col.name}`,
          name: `${table.name}[${col.name}]`,
          type: 'column',
          tableName: table.name,
          description: `Coluna do tipo ${col.dataType}`,
        },
        details: { ...col, tableName: table.name },
      };
    }
  }

  return { found: false };
}
