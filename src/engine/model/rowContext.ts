import { Table, Column } from '../../types/bi';
import { ModelAccess } from './modelAccess';
import { FilterContext } from './filterContext';
import { DaxError } from '../shared/errors';

export interface RowContext {
  tableId: string;
  tableName: string;
  row: Record<string, any>;
  rowIndex: number;
}

export class RowContextStack {
  private stack: RowContext[] = [];

  constructor(initialStack: RowContext[] = []) {
    this.stack = [...initialStack];
  }

  public push(tableId: string, tableName: string, row: Record<string, any>, rowIndex: number): void {
    this.stack.push({ tableId, tableName, row, rowIndex });
  }

  public pop(): RowContext | undefined {
    return this.stack.pop();
  }

  public peek(): RowContext | undefined {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : undefined;
  }

  public size(): number {
    return this.stack.length;
  }

  public isEmpty(): boolean {
    return this.stack.length === 0;
  }

  /**
   * Retrieves an earlier row context from the stack.
   * In DAX: EARLIER(Column, [Number])
   * Number default is 1 (the immediate outer row context).
   */
  public getEarlier(levels = 1): RowContext {
    const targetIdx = this.stack.length - 1 - levels;
    if (targetIdx < 0 || targetIdx >= this.stack.length) {
      throw new DaxError(
        'Semantic',
        `EARLIER falhou: nível ${levels} excede os contextos de linha ativos (profundidade: ${this.stack.length})`
      );
    }
    return this.stack[targetIdx];
  }

  /**
   * Retrieves the earliest (outermost) row context in the stack (EARLIEST)
   */
  public getEarliest(): RowContext {
    if (this.stack.length === 0) {
      throw new DaxError('Semantic', 'EARLIEST falhou: não há contexto de linha ativo na pilha');
    }
    return this.stack[0];
  }

  /**
   * Context Transition: Converts active row contexts into equivalent column filters
   * on the filter context. This is the cornerstone of DAX measure evaluation inside iterators
   * or explicit CALCULATE.
   */
  public transitionToFilterContext(baseContext: FilterContext, model: ModelAccess): FilterContext {
    if (this.stack.length === 0) {
      return baseContext.clone();
    }

    const newCtx = baseContext.clone();

    // Apply row values as filters from innermost to outermost or all
    for (const ctx of this.stack) {
      const table = model.getTable(ctx.tableId) || model.getTable(ctx.tableName);
      if (!table) continue;

      table.columns.forEach(col => {
        const val = ctx.row[col.name];
        newCtx.setColumnFilter(
          table.id,
          col.name,
          {
            tableId: table.id,
            column: col.name,
            allowedValues: new Set([val]),
            isKeepFilters: false,
          },
          false // context transition replaces filter on that column
        );
      });
    }

    return newCtx;
  }

  public clone(): RowContextStack {
    return new RowContextStack(this.stack.map(s => ({ ...s })));
  }
}

/**
 * Resolves calculated columns in topological order of dependency
 */
export function resolveColumnDependencies(table: Table): Column[] {
  const calculated = table.columns.filter(c => c.isCalculated && c.expression);
  const regular = table.columns.filter(c => !c.isCalculated || !c.expression);

  if (calculated.length <= 1) {
    return [...regular, ...calculated];
  }

  // Build dependency graph
  const sorted: Column[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const calcMap = new Map<string, Column>();
  calculated.forEach(c => calcMap.set(c.name.toLowerCase(), c));

  function visit(col: Column) {
    const key = col.name.toLowerCase();
    if (visiting.has(key)) {
      throw new DaxError(
        'Semantic',
        `Referência circular detectada entre colunas calculadas na tabela "${table.name}": [${col.name}]`
      );
    }
    if (visited.has(key)) return;

    visiting.add(key);

    // Parse references to other calculated columns in expression
    const expr = col.expression || '';
    calcMap.forEach((otherCol, otherKey) => {
      if (otherKey !== key) {
        const pattern = new RegExp(`\\[${otherCol.name}\\]|${table.name}\\[${otherCol.name}\\]`, 'i');
        if (pattern.test(expr)) {
          visit(otherCol);
        }
      }
    });

    visiting.delete(key);
    visited.add(key);
    sorted.push(col);
  }

  calculated.forEach(c => visit(c));

  return [...regular, ...sorted];
}
