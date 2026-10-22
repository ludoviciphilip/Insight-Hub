import { Table, Column, PowerQueryStep } from '../types/bi';
import { formatToDateIso } from '../services/dataImportService';
import { PowerBiColumnEngine } from './powerBiColumnEngine';
import { parseNumber, parseDate } from './shared/valueParser';

export interface ColumnProfile {
  columnName: string;
  totalCount: number;
  distinctCount: number;
  nullCount: number;
  validPercent: number;
  nullPercent: number;
  sampleDistribution: { value: string; count: number }[];
  minValue?: any;
  maxValue?: any;
  errorCount?: number;
}

export class EtlEngine {
  /**
   * Applies all Power Query steps sequentially on an initial table
   */
  public static executePipeline(
    initialTable: Table,
    steps: PowerQueryStep[]
  ): { table: Table; generatedSql: string } {
    let currentColumns: Column[] = initialTable.columns.map(c => ({ ...c }));
    let currentRows: Record<string, any>[] = initialTable.rows.map(r => ({ ...r }));
    const sqlStatements: string[] = [`-- Consulta inicial: ${initialTable.name}`, `SELECT * FROM ${initialTable.originalName || initialTable.name};`];

    for (const step of steps) {
      const result = this.applyStep(currentColumns, currentRows, step);
      currentColumns = result.columns;
      currentRows = result.rows;
      if (result.sql) {
        sqlStatements.push(`-- Etapa: ${step.name}`);
        sqlStatements.push(result.sql);
      }
    }

    return {
      table: {
        ...initialTable,
        columns: currentColumns,
        rows: currentRows,
      },
      generatedSql: sqlStatements.join('\n\n'),
    };
  }

  private static applyStep(
    columns: Column[],
    rows: Record<string, any>[],
    step: PowerQueryStep
  ): { columns: Column[]; rows: Record<string, any>[]; sql?: string } {
    let newCols = [...columns];
    let newRows = [...rows];
    let sql = '';

    switch (step.type) {
      case 'rename': {
        const { oldName, newName } = step.params;
        newCols = newCols.map(c => (c.name === oldName ? { ...c, name: newName } : c));
        newRows = newRows.map(r => {
          const row = { ...r };
          if (oldName in row) {
            row[newName] = row[oldName];
            delete row[oldName];
          }
          return row;
        });
        sql = `ALTER TABLE CurrentTable RENAME COLUMN "${oldName}" TO "${newName}";`;
        break;
      }

      case 'changeType': {
        const { columnName, newType } = step.params;
        newCols = newCols.map(c => (c.name === columnName ? { ...c, dataType: newType } : c));
        let errorCount = 0;

        newRows = newRows.map(r => {
          const row = { ...r };
          const val = row[columnName];
          if (val === null || val === undefined || val === '') {
            row[columnName] = null;
            return row;
          }

          if (newType === 'number' || newType === 'currency' || newType === 'percentage') {
            const parsed = parseNumber(val);
            if (parsed.value === null) {
              errorCount++;
              row[columnName] = null;
            } else {
              row[columnName] = parsed.value;
            }
          } else if (newType === 'text') {
            row[columnName] = String(val ?? '');
          } else if (newType === 'date') {
            const parsed = parseDate(val);
            if (!parsed.iso) {
              errorCount++;
              row[columnName] = null;
            } else {
              row[columnName] = parsed.iso;
            }
          } else if (newType === 'boolean') {
            if (typeof val === 'boolean') {
              row[columnName] = val;
            } else {
              const str = String(val).trim().toLowerCase();
              if (['true', '1', 'sim', 's', 'verdadeiro', 'v'].includes(str)) {
                row[columnName] = true;
              } else if (['false', '0', 'não', 'nao', 'n', 'falso', 'f'].includes(str)) {
                row[columnName] = false;
              } else {
                errorCount++;
                row[columnName] = null;
              }
            }
          }
          return row;
        });

        if (errorCount > 0) {
          step.params = { ...step.params, errorCount };
          step.description = `${step.description || `Converteu a coluna "${columnName}" para ${newType.toUpperCase()}`} (${errorCount} erro${errorCount > 1 ? 's' : ''} de conversão)`;
        }
        sql = `ALTER TABLE CurrentTable MODIFY "${columnName}" AS ${newType.toUpperCase()};`;
        break;
      }

      case 'filter': {
        const { column, operator, value } = step.params;
        newRows = newRows.filter(r => {
          const cellVal = r[column];
          if (operator === 'equals') return cellVal == value;
          if (operator === 'notEquals') return cellVal != value;
          if (operator === 'greaterThan') return Number(cellVal) > Number(value);
          if (operator === 'lessThan') return Number(cellVal) < Number(value);
          if (operator === 'contains') return String(cellVal).toLowerCase().includes(String(value).toLowerCase());
          return true;
        });
        sql = `DELETE FROM CurrentTable WHERE "${column}" ${operator === 'equals' ? '=' : '!='} '${value}';`;
        break;
      }

      case 'removeColumn':
      case 'removeColumns': {
        const colNames: string[] =
          step.params.columnNames ||
          (step.params.columnName ? [step.params.columnName] : [step.params.column]);
        newCols = newCols.filter(c => !colNames.includes(c.name));
        newRows = newRows.map(r => {
          const row = { ...r };
          colNames.forEach(cn => {
            if (cn in row) delete row[cn];
          });
          return row;
        });
        sql = `ALTER TABLE CurrentTable DROP COLUMN ${colNames.map(c => `"${c}"`).join(', ')};`;
        break;
      }

      case 'addCustomColumn': {
        const { newColumnName, expression, expressionType } = step.params;
        newCols.push({
          id: 'c_' + Math.random().toString(36).substr(2, 6),
          name: newColumnName,
          originalName: newColumnName,
          dataType: expressionType || 'text',
          isCalculated: true,
        });

        let errorCount = 0;
        let firstError: string | undefined;

        newRows = newRows.map((r, idx) => {
          const row = { ...r };
          const result = PowerBiColumnEngine.evaluateRowDetailed(expression, row, idx, newCols);
          if (result.error) {
            errorCount++;
            if (!firstError) firstError = result.error;
            row[newColumnName] = null;
          } else {
            row[newColumnName] = result.value;
          }
          return row;
        });

        if (errorCount > 0) {
          step.params = { ...step.params, errorCount, firstError };
          step.description = `${step.description || `Adicionou coluna personalizada "${newColumnName}"`} (${errorCount} erro${errorCount > 1 ? 's' : ''}: ${firstError})`;
        }
        sql = `ALTER TABLE CurrentTable ADD COLUMN "${newColumnName}" COMPUTED (${expression});`;
        break;
      }

      case 'replaceValues': {
        const { column, oldValue, newValue, matchExact = true } = step.params;
        newRows = newRows.map(r => {
          const row = { ...r };
          const cell = String(row[column] ?? '');
          if (matchExact) {
            if (cell.toLowerCase().trim() === String(oldValue).toLowerCase().trim() || cell === String(oldValue)) {
              row[column] = !isNaN(Number(newValue)) && newValue.trim() !== '' ? Number(newValue) : newValue;
            }
          } else {
            if (cell.includes(String(oldValue))) {
              row[column] = cell.split(String(oldValue)).join(String(newValue));
            }
          }
          return row;
        });
        sql = `UPDATE CurrentTable SET "${column}" = '${newValue}' WHERE "${column}" = '${oldValue}';`;
        break;
      }

      case 'splitColumn': {
        const { column, delimiter } = step.params;
        const part1Name = `${column}.1`;
        const part2Name = `${column}.2`;
        newCols.push(
          { id: 'c_' + Math.random(), name: part1Name, originalName: part1Name, dataType: 'text' },
          { id: 'c_' + Math.random(), name: part2Name, originalName: part2Name, dataType: 'text' }
        );
        newRows = newRows.map(r => {
          const row = { ...r };
          const parts = String(row[column] ?? '').split(delimiter);
          row[part1Name] = parts[0]?.trim() || '';
          row[part2Name] = parts.slice(1).join(delimiter).trim() || '';
          return row;
        });
        sql = `-- Dividir coluna "${column}" pelo delimitador '${delimiter}'`;
        break;
      }

      case 'deduplicate': {
        const seen = new Set<string>();
        newRows = newRows.filter(r => {
          const key = JSON.stringify(r);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        sql = `SELECT DISTINCT * FROM CurrentTable;`;
        break;
      }

      case 'sort': {
        const { column, order } = step.params;
        const dir = order === 'desc' ? -1 : 1;
        newRows.sort((a, b) => {
          const va = a[column];
          const vb = b[column];
          if (va < vb) return -1 * dir;
          if (va > vb) return 1 * dir;
          return 0;
        });
        sql = `SELECT * FROM CurrentTable ORDER BY "${column}" ${order.toUpperCase()};`;
        break;
      }

      case 'fillDown': {
        const { column } = step.params;
        let lastVal: any = null;
        newRows = newRows.map(r => {
          const row = { ...r };
          if (row[column] !== null && row[column] !== undefined && row[column] !== '') {
            lastVal = row[column];
          } else {
            row[column] = lastVal;
          }
          return row;
        });
        sql = `-- Preenchimento abaixo para a coluna "${column}"`;
        break;
      }

      case 'fillUp': {
        const { column } = step.params;
        let nextVal: any = null;
        for (let i = newRows.length - 1; i >= 0; i--) {
          const row = { ...newRows[i] };
          if (row[column] !== null && row[column] !== undefined && row[column] !== '') {
            nextVal = row[column];
          } else {
            row[column] = nextVal;
          }
          newRows[i] = row;
        }
        sql = `-- Preenchimento acima para a coluna "${column}"`;
        break;
      }

      case 'removeOtherColumns': {
        const keepCols: string[] = step.params.keepColumns || (step.params.column ? [step.params.column] : []);
        if (keepCols.length > 0) {
          newCols = newCols.filter(c => keepCols.includes(c.name));
          newRows = newRows.map(r => {
            const filtered: Record<string, any> = {};
            keepCols.forEach(k => {
              if (k in r) filtered[k] = r[k];
            });
            return filtered;
          });
          sql = `-- Remover outras colunas, mantendo: ${keepCols.join(', ')}`;
        }
        break;
      }

      case 'removeTopRows': {
        const count = Math.max(1, Number(step.params.count) || 1);
        newRows = newRows.slice(count);
        sql = `-- Remover primeiras ${count} linhas`;
        break;
      }

      case 'removeBottomRows': {
        const count = Math.max(1, Number(step.params.count) || 1);
        newRows = newRows.slice(0, Math.max(0, newRows.length - count));
        sql = `-- Remover últimas ${count} linhas`;
        break;
      }

      case 'removeBlankRows': {
        const targetCol = step.params.column;
        if (targetCol) {
          newRows = newRows.filter(r => r[targetCol] !== null && r[targetCol] !== undefined && String(r[targetCol]).trim() !== '');
        } else {
          newRows = newRows.filter(r =>
            Object.values(r).some(v => v !== null && v !== undefined && String(v).trim() !== '')
          );
        }
        sql = `-- Remover linhas em branco`;
        break;
      }

      case 'keepTopRows': {
        const count = Math.max(1, Number(step.params.count) || 10);
        newRows = newRows.slice(0, count);
        sql = `-- Manter primeiras ${count} linhas`;
        break;
      }

      case 'keepBottomRows': {
        const count = Math.max(1, Number(step.params.count) || 10);
        newRows = newRows.slice(Math.max(0, newRows.length - count));
        sql = `-- Manter últimas ${count} linhas`;
        break;
      }

      case 'useFirstRowAsHeaders': {
        if (newRows.length > 0) {
          const headerRow = newRows[0];
          const oldToNew: Record<string, string> = {};
          newCols = newCols.map((col, idx) => {
            const candidateName = String(headerRow[col.name] ?? '').trim() || `Coluna_${idx + 1}`;
            oldToNew[col.name] = candidateName;
            return {
              ...col,
              name: candidateName,
            };
          });
          newRows = newRows.slice(1).map(r => {
            const row: Record<string, any> = {};
            newCols.forEach((col, idx) => {
              const oldKey = Object.keys(oldToNew)[idx];
              row[col.name] = r[oldKey];
            });
            return row;
          });
          sql = `-- Usar primeira linha como cabeçalho`;
        }
        break;
      }

      case 'useHeadersAsFirstRow': {
        const newFirstRow: Record<string, any> = {};
        newCols.forEach(c => {
          newFirstRow[c.name] = c.name;
        });
        newRows = [newFirstRow, ...newRows];
        newCols = newCols.map((c, idx) => ({
          ...c,
          name: `Coluna_${idx + 1}`,
        }));
        sql = `-- Usar cabeçalho como primeira linha`;
        break;
      }

      case 'detectDataTypes': {
        newCols = newCols.map(col => {
          let hasNumber = false;
          let hasCurrency = false;
          let hasDate = false;
          let hasInvalidNumber = false;

          const sampleRows = newRows.slice(0, 100);
          for (const row of sampleRows) {
            const val = row[col.name];
            if (val === null || val === undefined || val === '') continue;
            const strVal = String(val).trim();

            if (/^R\$\s?[\d.,]+$/i.test(strVal)) {
              hasCurrency = true;
            } else if (!isNaN(Number(strVal.replace(/,/g, '.')))) {
              hasNumber = true;
            } else if (!isNaN(Date.parse(strVal)) && (strVal.includes('-') || strVal.includes('/'))) {
              hasDate = true;
            } else {
              hasInvalidNumber = true;
            }
          }

          let detectedType: Column['dataType'] = col.dataType;
          if (hasCurrency && !hasInvalidNumber) detectedType = 'currency';
          else if (hasNumber && !hasInvalidNumber) detectedType = 'number';
          else if (hasDate && !hasInvalidNumber) detectedType = 'date';

          return { ...col, dataType: detectedType };
        });
        sql = `-- Detectar tipos de dados automaticamente`;
        break;
      }

      case 'duplicateColumn': {
        const { column, newColumnName } = step.params;
        const targetCol = newCols.find(c => c.name === column);
        const copyName = newColumnName || `${column} - Cópia`;
        newCols.push({
          id: 'c_' + Math.random().toString(36).substr(2, 6),
          name: copyName,
          originalName: copyName,
          dataType: targetCol?.dataType || 'text',
        });
        newRows = newRows.map(r => ({
          ...r,
          [copyName]: r[column],
        }));
        sql = `-- Duplicar coluna "${column}" como "${copyName}"`;
        break;
      }

      case 'addIndexColumn': {
        const { newColumnName = 'Índice', startIndex = 0 } = step.params;
        newCols.push({
          id: 'c_' + Math.random().toString(36).substr(2, 6),
          name: newColumnName,
          originalName: newColumnName,
          dataType: 'number',
        });
        newRows = newRows.map((r, idx) => ({
          ...r,
          [newColumnName]: startIndex + idx,
        }));
        sql = `-- Adicionar coluna de índice a partir de ${startIndex}`;
        break;
      }

      case 'textTransform': {
        const { column, mode, createNewColumn, newColumnName } = step.params;
        const targetColName = createNewColumn ? (newColumnName || `${column} (${mode})`) : column;

        if (createNewColumn) {
          const origCol = newCols.find(c => c.name === column);
          newCols.push({
            id: 'c_' + Math.random().toString(36).substr(2, 6),
            name: targetColName,
            originalName: targetColName,
            dataType: origCol?.dataType || 'text',
          });
        }

        newRows = newRows.map(r => {
          const row = { ...r };
          const raw = String(row[column] ?? '');
          let transformed = raw;

          if (mode === 'uppercase') {
            transformed = raw.toUpperCase();
          } else if (mode === 'lowercase') {
            transformed = raw.toLowerCase();
          } else if (mode === 'capitalize') {
            transformed = raw.replace(/\b\w/g, char => char.toUpperCase());
          } else if (mode === 'trim') {
            transformed = raw.trim();
          }

          row[targetColName] = transformed;
          return row;
        });
        sql = `-- Formatar texto (${mode}) em "${column}"`;
        break;
      }

      case 'textExtract': {
        const { column, mode, count = 5, delimiter = ',', start = 0, length = 5, createNewColumn, newColumnName } = step.params;
        const targetColName = createNewColumn ? (newColumnName || `${column} (Extraído)`) : column;

        if (createNewColumn) {
          newCols.push({
            id: 'c_' + Math.random().toString(36).substr(2, 6),
            name: targetColName,
            originalName: targetColName,
            dataType: 'text',
          });
        }

        newRows = newRows.map(r => {
          const row = { ...r };
          const raw = String(row[column] ?? '');
          let extracted = '';

          if (mode === 'firstChars') {
            extracted = raw.slice(0, Number(count) || 5);
          } else if (mode === 'lastChars') {
            const num = Number(count) || 5;
            extracted = raw.slice(Math.max(0, raw.length - num));
          } else if (mode === 'range') {
            extracted = raw.substring(Number(start) || 0, (Number(start) || 0) + (Number(length) || 5));
          } else if (mode === 'beforeDelimiter') {
            const idx = raw.indexOf(delimiter);
            extracted = idx >= 0 ? raw.substring(0, idx) : raw;
          } else if (mode === 'afterDelimiter') {
            const idx = raw.indexOf(delimiter);
            extracted = idx >= 0 ? raw.substring(idx + delimiter.length) : '';
          } else if (mode === 'betweenDelimiters') {
            const d1 = step.params.delimiter1 || delimiter;
            const d2 = step.params.delimiter2 || delimiter;
            const idx1 = raw.indexOf(d1);
            if (idx1 >= 0) {
              const sub = raw.substring(idx1 + d1.length);
              const idx2 = sub.indexOf(d2);
              extracted = idx2 >= 0 ? sub.substring(0, idx2) : sub;
            } else {
              extracted = '';
            }
          }

          row[targetColName] = extracted.trim();
          return row;
        });
        sql = `-- Extrair caracteres (${mode}) de "${column}"`;
        break;
      }

      case 'dateExtract': {
        const { column, part, createNewColumn, newColumnName } = step.params;
        const targetColName = createNewColumn ? (newColumnName || `${column} (${part})`) : column;

        const isNumericPart = ['year', 'month', 'day', 'hour', 'minute'].includes(part);
        if (createNewColumn) {
          newCols.push({
            id: 'c_' + Math.random().toString(36).substr(2, 6),
            name: targetColName,
            originalName: targetColName,
            dataType: isNumericPart ? 'number' : 'text',
          });
        }

        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        newRows = newRows.map(r => {
          const row = { ...r };
          const cell = row[column];
          let res: any = '';

          try {
            const d = new Date(cell);
            if (!isNaN(d.getTime())) {
              if (part === 'year') res = d.getUTCFullYear();
              else if (part === 'month') res = d.getUTCMonth() + 1;
              else if (part === 'monthName') res = monthNames[d.getUTCMonth()];
              else if (part === 'day') res = d.getUTCDate();
              else if (part === 'dayOfWeek') res = dayNames[d.getUTCDay()];
              else if (part === 'hour') res = d.getUTCHours();
              else if (part === 'minute') res = d.getUTCMinutes();
            } else {
              res = cell;
            }
          } catch {
            res = cell;
          }

          row[targetColName] = res;
          return row;
        });
        sql = `-- Extrair parte da data (${part}) de "${column}"`;
        break;
      }

      default:
        break;
    }

    return { columns: newCols, rows: newRows, sql };
  }

  /**
   * Generates column profile metrics: quality, distinct count, nulls, distribution
   */
  public static computeColumnProfiles(table: Table): ColumnProfile[] {
    const totalCount = table.rows.length;

    return table.columns.map(col => {
      const counts: Record<string, number> = {};
      let nullCount = 0;
      let errorCount = 0;
      let minVal: any = undefined;
      let maxVal: any = undefined;

      const lowerType = (col.dataType || 'text').toLowerCase();

      table.rows.forEach(r => {
        const val = r[col.name];
        if (val === null || val === undefined || val === '') {
          nullCount++;
        } else {
          // Check for conversion errors against column type
          if (lowerType === 'number' || lowerType === 'currency' || lowerType === 'percentage') {
            if (parseNumber(val).value === null) {
              errorCount++;
            }
          } else if (lowerType === 'date') {
            if (!parseDate(val).iso) {
              errorCount++;
            }
          }

          const key = String(val);
          counts[key] = (counts[key] || 0) + 1;

          if (minVal === undefined || val < minVal) minVal = val;
          if (maxVal === undefined || val > maxVal) maxVal = val;
        }
      });

      const distinctCount = Object.keys(counts).length;
      const validCount = totalCount - nullCount;
      const validPercent = totalCount > 0 ? Number(((validCount / totalCount) * 100).toFixed(1)) : 100;
      const nullPercent = totalCount > 0 ? Number(((nullCount / totalCount) * 100).toFixed(1)) : 0;

      const sampleDistribution = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }));

      return {
        columnName: col.name,
        totalCount,
        distinctCount,
        nullCount,
        errorCount: errorCount > 0 ? errorCount : undefined,
        validPercent,
        nullPercent,
        sampleDistribution,
        minValue: minVal,
        maxValue: maxVal,
      };
    });
  }
}
