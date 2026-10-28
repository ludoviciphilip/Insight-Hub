import { FunctionDefinition } from '../expr/registry';
import { DaxError } from '../shared/errors';
import { DAX_BLANK } from '../expr/types';
import { ModelAccess } from '../model/modelAccess';
import { RelationshipGraph } from '../model/relationships';

export const RELATIONSHIP_FUNCTIONS: Record<string, FunctionDefinition> = {
  RELATED: {
    name: 'RELATED',
    category: 'Filtro',
    syntax: 'RELATED(column)',
    description: 'Retorna um valor relacionado de outra tabela navegando por um relacionamento no contexto de linha.',
    example: 'RELATED(d_Clientes[Segmento])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const row = context?.row;
      if (!row) {
        throw new DaxError('Semantic', 'RELATED requer um contexto de linha ativo');
      }

      const model: ModelAccess | undefined = context?.model;
      if (!model) return DAX_BLANK;

      const colArg = args[0];
      let targetTable = '';
      let targetCol = '';

      if (typeof colArg === 'string') {
        const m = colArg.match(/^(?:'?([^'\[]+)'?\[)?([^\]]+)\]?$/);
        if (m) {
          targetTable = m[1] || '';
          targetCol = m[2];
        } else {
          targetCol = colArg;
        }
      } else if (colArg && typeof colArg === 'object') {
        targetTable = colArg.table || '';
        targetCol = colArg.column || '';
      }

      const destTable = model.getTable(targetTable);
      if (!destTable) {
        throw new DaxError('Reference', `Tabela de destino "${targetTable}" não encontrada`);
      }

      // Find relationship from current row's table to targetTable
      const sourceTableId = context?.rowContextStack?.peek()?.tableId || context?.tableId;
      const graph = new RelationshipGraph(model);
      const path = graph.findActivePath(sourceTableId || '', destTable.id);

      if (!path || path.length === 0) {
        // Fallback: check direct relationship
        const rel = model.getRelationships().find(
          r =>
            r.isActive &&
            ((r.fromTable === destTable.id || r.fromTable === destTable.name) ||
             (r.toTable === destTable.id || r.toTable === destTable.name))
        );
        if (!rel) return DAX_BLANK;

        const isRowFrom = rel.fromTable !== destTable.id && rel.fromTable !== destTable.name;
        const rowKeyCol = isRowFrom ? rel.fromColumn : rel.toColumn;
        const destKeyCol = isRowFrom ? rel.toColumn : rel.fromColumn;

        const lookupVal = row[rowKeyCol];
        const matchedRow = destTable.rows.find(
          dr => String(dr[destKeyCol] ?? '').toLowerCase() === String(lookupVal ?? '').toLowerCase()
        );
        return matchedRow ? (matchedRow[targetCol] ?? DAX_BLANK) : DAX_BLANK;
      }

      // Follow path
      let currentVal = row[path[0].fromColumn];
      for (let i = 0; i < path.length; i++) {
        const step = path[i];
        const stepTable = model.getTable(step.toTableId);
        if (!stepTable) return DAX_BLANK;

        const matchedRow = stepTable.rows.find(
          r => String(r[step.toColumn] ?? '').toLowerCase() === String(currentVal ?? '').toLowerCase()
        );
        if (!matchedRow) return DAX_BLANK;

        if (i === path.length - 1) {
          return matchedRow[targetCol] ?? DAX_BLANK;
        } else {
          const nextStep = path[i + 1];
          currentVal = matchedRow[nextStep.fromColumn];
        }
      }

      return DAX_BLANK;
    },
  },

  RELATEDTABLE: {
    name: 'RELATEDTABLE',
    category: 'Filtro',
    syntax: 'RELATEDTABLE(table)',
    description: 'Retorna a tabela de linhas relacionadas à linha atual no contexto de linha.',
    example: 'RELATEDTABLE(f_Vendas)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args, context) => {
      const row = context?.row;
      if (!row) {
        throw new DaxError('Semantic', 'RELATEDTABLE requer um contexto de linha ativo');
      }

      const model: ModelAccess | undefined = context?.model;
      if (!model) return [];

      const targetArg = args[0];
      const tableName = typeof targetArg === 'string' ? targetArg : targetArg?.table || targetArg?.column;
      const targetTable = model.getTable(tableName);
      if (!targetTable) return [];

      const sourceTableId = context?.rowContextStack?.peek()?.tableId || context?.tableId;
      const graph = new RelationshipGraph(model);
      const path = graph.findActivePath(sourceTableId || '', targetTable.id);

      if (!path || path.length === 0) return [];

      const step = path[0];
      const keyVal = row[step.fromColumn];
      return targetTable.rows.filter(
        tr => String(tr[step.toColumn] ?? '').toLowerCase() === String(keyVal ?? '').toLowerCase()
      );
    },
  },

  USERELATIONSHIP: {
    name: 'USERELATIONSHIP',
    category: 'Filtro',
    syntax: 'USERELATIONSHIP(columnName1, columnName2)',
    description: 'Ativa um relacionamento inativo existente entre duas colunas durante o cálculo de CALCULATE.',
    example: 'CALCULATE([Total], USERELATIONSHIP(f_Vendas[DataEnvio], d_Calendario[Data]))',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([col1, col2]) => {
      const parseRef = (c: any) => {
        if (typeof c === 'string') {
          const m = c.match(/^(?:'?([^'\[]+)'?\[)?([^\]]+)\]?$/);
          return { table: m ? m[1] : '', column: m ? m[2] : c };
        }
        return { table: c?.table || '', column: c?.column || '' };
      };
      const r1 = parseRef(col1);
      const r2 = parseRef(col2);

      return {
        __isModifier: true,
        type: 'USERELATIONSHIP',
        fromTable: r1.table,
        fromColumn: r1.column,
        toTable: r2.table,
        toColumn: r2.column,
        isActive: true,
      };
    },
  },

  CROSSFILTER: {
    name: 'CROSSFILTER',
    category: 'Filtro',
    syntax: 'CROSSFILTER(columnName1, columnName2, direction)',
    description: 'Especifica a direção de filtragem cruzada a ser usada durante a avaliação de uma expressão CALCULATE.',
    example: 'CALCULATE([Total], CROSSFILTER(f_Vendas[ID_Cliente], d_Clientes[ID_Cliente], "both"))',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([col1, col2, dir]) => {
      const parseRef = (c: any) => {
        if (typeof c === 'string') {
          const m = c.match(/^(?:'?([^'\[]+)'?\[)?([^\]]+)\]?$/);
          return { table: m ? m[1] : '', column: m ? m[2] : c };
        }
        return { table: c?.table || '', column: c?.column || '' };
      };
      const r1 = parseRef(col1);
      const r2 = parseRef(col2);
      const dirStr = String(dir || 'both').toLowerCase().replace(/['"]/g, '');

      let direction: 'single' | 'both' | 'none' = 'both';
      if (dirStr === 'none' || dirStr === 'nenhum') direction = 'none';
      else if (dirStr === 'single' || dirStr === 'oneway' || dirStr === 'unidirecional') direction = 'single';

      return {
        __isModifier: true,
        type: 'CROSSFILTER',
        fromTable: r1.table,
        fromColumn: r1.column,
        toTable: r2.table,
        toColumn: r2.column,
        crossFilterDirection: direction,
      };
    },
  },
};
