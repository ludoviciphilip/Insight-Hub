import { FunctionDefinition } from '../expr/registry';
import { DaxError } from '../shared/errors';
import { DAX_BLANK, isBlank, daxToString, daxToNumber } from '../expr/types';

export function computePathForRow(
  idVal: any,
  parentIdVal: any,
  rows?: Record<string, any>[],
  idColName?: string,
  parentColName?: string
): string {
  if (isBlank(idVal)) return '';
  const currentId = String(idVal).trim();
  if (!currentId) return '';

  if (isBlank(parentIdVal) || String(parentIdVal).trim() === '' || String(parentIdVal).trim() === currentId) {
    return currentId;
  }

  // If table rows and column names are available, traverse up to root
  if (rows && idColName && parentColName) {
    const parentMap = new Map<string, string>();
    for (const r of rows) {
      const rowId = String(r[idColName] ?? '').trim();
      const rowParentId = String(r[parentColName] ?? '').trim();
      if (rowId) {
        parentMap.set(rowId, rowParentId);
      }
    }

    const pathArray: string[] = [currentId];
    const visited = new Set<string>([currentId]);
    let curr = currentId;

    while (true) {
      if (pathArray.length > 50) {
        throw new DaxError(
          'Execution',
          `Profundidade máxima de 50 níveis excedida na hierarquia pai-filho para o item "${currentId}"`
        );
      }

      const p = parentMap.get(curr);
      if (!p || p === curr) {
        break;
      }

      if (visited.has(p)) {
        throw new DaxError(
          'Execution',
          `Loop ou dependência circular detectada na hierarquia pai-filho entre "${curr}" e "${p}"`
        );
      }

      visited.add(p);
      pathArray.unshift(p);
      curr = p;
    }

    return pathArray.join('|');
  }

  // Simple two-level fallback if rows not provided
  return `${String(parentIdVal).trim()}|${currentId}`;
}

export const PARENT_CHILD_FUNCTIONS: Record<string, FunctionDefinition> = {
  PATH: {
    name: 'PATH',
    category: 'Linha',
    syntax: 'PATH(<ID_columnName>, <parent_columnName>)',
    description: 'Retorna uma cadeia de caracteres delimitada por pipes com os identificadores de todos os pais do item atual, até o nível raiz.',
    example: 'PATH(d_Funcionarios[ID], d_Funcionarios[ID_Gerente])',
    minArgs: 2,
    maxArgs: 2,
    evaluate: (args, context) => {
      const idVal = args[0];
      const parentIdVal = args[1];

      if (isBlank(idVal)) return DAX_BLANK;

      // Look up current table rows from context if available
      const rows = context?.currentGroupRows || (context?.tableId && context?.model?.getTable?.(context.tableId)?.rows) || context?.rows;
      return computePathForRow(idVal, parentIdVal, rows);
    },
  },

  PATHITEM: {
    name: 'PATHITEM',
    category: 'Texto',
    syntax: 'PATHITEM(<Path>, <Position> [, <Type>])',
    description: 'Retorna o item na posição especificada (base 1, da raiz para as folhas) de uma cadeia resultante de PATH.',
    example: 'PATHITEM(d_Funcionarios[Hierarquia], 1, 1)',
    minArgs: 2,
    maxArgs: 3,
    evaluate: (args) => {
      const pathVal = args[0];
      const posVal = args[1];
      const typeVal = args[2] !== undefined ? daxToNumber(args[2], false) : 0;

      if (isBlank(pathVal)) return DAX_BLANK;
      const pathStr = daxToString(pathVal).trim();
      if (!pathStr) return DAX_BLANK;

      const pos = daxToNumber(posVal, false);
      if (isNaN(pos) || pos <= 0 || !Number.isInteger(pos)) {
        throw new DaxError('Execution', 'A posição de PATHITEM deve ser um número inteiro positivo maior ou igual a 1');
      }

      const items = pathStr.split('|').map(s => s.trim()).filter(Boolean);
      if (pos > items.length) {
        return DAX_BLANK;
      }

      const item = items[pos - 1];
      if (typeVal === 1) {
        const num = parseInt(item, 10);
        if (isNaN(num)) {
          throw new DaxError('Type', `Não foi possível converter o item "${item}" em número inteiro em PATHITEM`);
        }
        return num;
      }

      return item;
    },
  },

  PATHITEMREVERSE: {
    name: 'PATHITEMREVERSE',
    category: 'Texto',
    syntax: 'PATHITEMREVERSE(<Path>, <Position> [, <Type>])',
    description: 'Retorna o item na posição especificada contando de trás para frente (base 1, das folhas para a raiz).',
    example: 'PATHITEMREVERSE(d_Funcionarios[Hierarquia], 1)',
    minArgs: 2,
    maxArgs: 3,
    evaluate: (args) => {
      const pathVal = args[0];
      const posVal = args[1];
      const typeVal = args[2] !== undefined ? daxToNumber(args[2], false) : 0;

      if (isBlank(pathVal)) return DAX_BLANK;
      const pathStr = daxToString(pathVal).trim();
      if (!pathStr) return DAX_BLANK;

      const pos = daxToNumber(posVal, false);
      if (isNaN(pos) || pos <= 0 || !Number.isInteger(pos)) {
        throw new DaxError('Execution', 'A posição de PATHITEMREVERSE deve ser um número inteiro positivo maior ou igual a 1');
      }

      const items = pathStr.split('|').map(s => s.trim()).filter(Boolean);
      if (pos > items.length) {
        return DAX_BLANK;
      }

      const item = items[items.length - pos];
      if (typeVal === 1) {
        const num = parseInt(item, 10);
        if (isNaN(num)) {
          throw new DaxError('Type', `Não foi possível converter o item "${item}" em número inteiro em PATHITEMREVERSE`);
        }
        return num;
      }

      return item;
    },
  },

  PATHLENGTH: {
    name: 'PATHLENGTH',
    category: 'Informação',
    syntax: 'PATHLENGTH(<Path>)',
    description: 'Retorna o número de itens ou níveis na cadeia de delimitadores de PATH especificada.',
    example: 'PATHLENGTH(d_Funcionarios[Hierarquia])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: (args) => {
      const pathVal = args[0];
      if (isBlank(pathVal)) return DAX_BLANK;
      const pathStr = daxToString(pathVal).trim();
      if (!pathStr) return 0;

      const items = pathStr.split('|').map(s => s.trim()).filter(Boolean);
      return items.length;
    },
  },

  PATHCONTAINS: {
    name: 'PATHCONTAINS',
    category: 'Lógica / Condicional',
    syntax: 'PATHCONTAINS(<Path>, <Item>)',
    description: 'Retorna TRUE se o item especificado existir na cadeia de caminho delimitada por pipes.',
    example: 'PATHCONTAINS(d_Funcionarios[Hierarquia], "GerenteGeral")',
    minArgs: 2,
    maxArgs: 2,
    evaluate: (args) => {
      const pathVal = args[0];
      const itemVal = args[1];

      if (isBlank(pathVal) || isBlank(itemVal)) return false;
      const pathStr = daxToString(pathVal).trim();
      const target = daxToString(itemVal).trim().toLowerCase();
      if (!pathStr || !target) return false;

      const items = pathStr.split('|').map(s => s.trim().toLowerCase());
      return items.includes(target);
    },
  },
};
