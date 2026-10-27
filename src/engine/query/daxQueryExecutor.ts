import { ModelAccess, InMemoryModelAccess } from '../model/modelAccess';
import { DaxQueryParser, DaxQueryAST, DaxDefinition, DaxOrderByItem } from '../expr/daxStatements';
import { Evaluator, EvaluationContext } from '../expr/evaluator';
import { DaxError } from '../shared/errors';
import { DaxTable, isDaxTable, daxToString, daxCompare, DAX_BLANK } from '../expr/types';
import { Table, Measure, UserDefinedFunction, DaxQueryExecutionResult, DaxQueryResultItem, DaxQueryExecutionStage, CalculationGroup } from '../../types/bi';
import { UdfManager } from '../model/udfManager';

export interface DaxQueryExecutionOptions {
  activeUser?: {
    username?: string;
    userPrincipalName?: string;
    userObjectId?: string;
    userCulture?: string;
    customData?: string;
  };
  calculationGroups?: CalculationGroup[];
  maxRows?: number;
}

/**
 * Executes full DAX Query scripts containing DEFINE (MEASURE, COLUMN, TABLE, VAR, FUNCTION),
 * EVALUATE, ORDER BY, START AT, with detailed execution stage tracking.
 */
export class DaxQueryExecutor {
  public static execute(
    queryText: string,
    model: ModelAccess,
    options: DaxQueryExecutionOptions = {}
  ): DaxQueryExecutionResult {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const executionPlan: DaxQueryExecutionStage[] = [];
    const results: DaxQueryResultItem[] = [];

    const definedObjects = {
      measures: [] as { table: string; name: string; formula: string }[],
      columns: [] as { table: string; name: string; formula: string }[],
      tables: [] as { name: string; formula: string }[],
      functions: [] as { name: string; parameters: string[]; body: string }[],
      variables: [] as { name: string; formula: string }[],
    };

    try {
      // Stage 1: Parsing
      const parseStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const parser = new DaxQueryParser(queryText);
      const queryAst: DaxQueryAST = parser.parse();
      const parseEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
      executionPlan.push({
        name: 'Análise Léxica & Sintática',
        durationMs: Number((parseEnd - parseStart).toFixed(2)),
        details: `${queryAst.definitions.length} definições, ${queryAst.evaluateStatements.length} blocos EVALUATE`,
        status: 'success',
      });

      // Stage 2: Register Definitions (DEFINE)
      const defStart = typeof performance !== 'undefined' ? performance.now() : Date.now();

      // Scoped tables, measures, and UDFs
      const scopedMeasures: Measure[] = typeof model.getMeasures === 'function'
        ? [...model.getMeasures()]
        : ((model as any).measures ? [...(model as any).measures] : []);
      const scopedTables: Table[] = typeof model.getTables === 'function'
        ? [...model.getTables()]
        : ((model as any).tables ? [...(model as any).tables] : []);
      const scopedRelationships = typeof model.getRelationships === 'function'
        ? model.getRelationships()
        : ((model as any).relationships || []);
      const scopedUdfs: Map<string, UserDefinedFunction> = new Map();
      const scopedVariables: Map<string, any> = new Map();

      // Query model access dynamically updated with query-scoped measures and tables
      const queryModel = new InMemoryModelAccess(scopedTables, scopedRelationships, scopedMeasures);

      // Load existing global UDFs first
      for (const fn of UdfManager.getFunctions()) {
        scopedUdfs.set(fn.name.toUpperCase().trim(), fn);
      }

      for (const def of queryAst.definitions) {
        if (def.kind === 'MEASURE') {
          definedObjects.measures.push({
            table: def.table,
            name: def.name,
            formula: def.rawFormula,
          });
          const existingIdx = scopedMeasures.findIndex(
            m => m.name.toLowerCase() === def.name.toLowerCase()
          );
          const newM: Measure = {
            id: `query_msr_${def.name}`,
            name: def.name,
            tableName: def.table,
            formula: def.rawFormula,
            format: 'number',
          };
          if (existingIdx >= 0) {
            scopedMeasures[existingIdx] = newM;
          } else {
            scopedMeasures.push(newM);
          }
          queryModel.setData(scopedTables, scopedRelationships, scopedMeasures);
        } else if (def.kind === 'COLUMN') {
          definedObjects.columns.push({
            table: def.table,
            name: def.name,
            formula: def.rawFormula,
          });
          // Evaluated row-by-row on target table
          const targetTable = scopedTables.find(t => t.name.toLowerCase() === def.table.toLowerCase());
          if (targetTable) {
            const newCols = [...targetTable.columns];
            if (!newCols.some(c => c.name.toLowerCase() === def.name.toLowerCase())) {
              newCols.push({
                id: `c_${def.name}`,
                name: def.name,
                originalName: def.name,
                dataType: 'text',
              });
            }
            const updatedRows = targetTable.rows.map((row, rIdx) => {
              const rowEval = new Evaluator({
                dialect: 'dax',
                model: queryModel,
                tables: scopedTables,
                measures: scopedMeasures,
                tableId: targetTable.id,
                tableName: targetTable.name,
                row,
                rowIndex: rIdx,
                userDefinedFunctions: Array.from(scopedUdfs.values()),
              });
              const val = rowEval.evalNode(def.ast);
              return { ...row, [def.name]: val };
            });
            const updatedTable: Table = {
              ...targetTable,
              columns: newCols,
              rows: updatedRows,
            };
            const tIdx = scopedTables.findIndex(t => t.id === targetTable.id);
            scopedTables[tIdx] = updatedTable;
            queryModel.setData(scopedTables, scopedRelationships, scopedMeasures);
          }
        } else if (def.kind === 'TABLE') {
          definedObjects.tables.push({
            name: def.name,
            formula: def.rawFormula,
          });
          const tableEval = new Evaluator({
            dialect: 'dax',
            model: queryModel,
            tables: scopedTables,
            measures: scopedMeasures,
            userDefinedFunctions: Array.from(scopedUdfs.values()),
          });
          const evalRes = tableEval.evalNode(def.ast);
          if (isDaxTable(evalRes)) {
            scopedTables.push({
              id: `query_tbl_${def.name}`,
              name: def.name,
              originalName: def.name,
              columns: evalRes.columns.map(c => ({ id: `c_${c}`, name: c, originalName: c, dataType: 'text' })),
              rows: evalRes.rows,
            });
            queryModel.setData(scopedTables, scopedRelationships, scopedMeasures);
          }
        } else if (def.kind === 'VAR') {
          definedObjects.variables.push({
            name: def.name,
            formula: def.rawFormula,
          });
          const varEval = new Evaluator({
            dialect: 'dax',
            model: queryModel,
            tables: scopedTables,
            measures: scopedMeasures,
            variables: scopedVariables,
            userDefinedFunctions: Array.from(scopedUdfs.values()),
          });
          const val = varEval.evalNode(def.ast);
          scopedVariables.set(def.name.toLowerCase().trim(), val);
        } else if (def.kind === 'FUNCTION') {
          definedObjects.functions.push({
            name: def.name,
            parameters: def.parameters,
            body: def.rawFormula,
          });
          scopedUdfs.set(def.name.toUpperCase().trim(), {
            id: `query_udf_${def.name}`,
            name: def.name,
            parameters: def.parameters,
            body: def.rawFormula,
          });
        }
      }

      const defEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
      executionPlan.push({
        name: 'Registro de Definições de Escopo (DEFINE)',
        durationMs: Number((defEnd - defStart).toFixed(2)),
        details: `${definedObjects.measures.length} medidas, ${definedObjects.columns.length} colunas, ${definedObjects.tables.length} tabelas, ${definedObjects.functions.length} UDFs registradas`,
        status: 'success',
      });

      // Stage 3: Statement Execution (EVALUATE)
      if (queryAst.evaluateStatements.length === 0) {
        throw new DaxError('Execution', 'A consulta DAX não contém nenhuma instrução EVALUATE para ser executada.');
      }

      for (let sIdx = 0; sIdx < queryAst.evaluateStatements.length; sIdx++) {
        const stmt = queryAst.evaluateStatements[sIdx];
        const evalStart = typeof performance !== 'undefined' ? performance.now() : Date.now();

        // Check unsupported visual statements
        if (stmt.unsupportedVisualClauses && stmt.unsupportedVisualClauses.length > 0) {
          const clause = stmt.unsupportedVisualClauses[0];
          throw new DaxError(
            'Execution',
            `A cláusula "${clause}" é exclusiva para o pipeline de cálculos visuais do Power BI e não é suportada na execução de consultas DAX tabulares.`
          );
        }

        // Build evaluation context with scoped definitions and UDFs
        const evalContext: EvaluationContext = {
          dialect: 'dax',
          model: queryModel,
          tables: scopedTables,
          measures: scopedMeasures,
          variables: scopedVariables,
          calculationGroups: options.calculationGroups,
          user: options.activeUser,
          userDefinedFunctions: Array.from(scopedUdfs.values()),
        };

        const evaluator = new Evaluator(evalContext);
        const evalResult = evaluator.evalNode(stmt.ast);

        // Convert result to tabular form
        let resultTable: DaxTable;
        if (isDaxTable(evalResult)) {
          resultTable = evalResult;
        } else if (evalResult === null || evalResult === undefined || evalResult === DAX_BLANK) {
          resultTable = {
            columns: ['[Valor]'],
            rows: [{ '[Valor]': '(Em branco)' }],
          };
        } else {
          resultTable = {
            columns: ['[Valor]'],
            rows: [{ '[Valor]': evalResult }],
          };
        }

        // Stage 4: Post-processing: ORDER BY
        if (stmt.orderBy && stmt.orderBy.length > 0) {
          resultTable = this.applyOrderBy(resultTable, stmt.orderBy, evalContext);
        }

        // Post-processing: START AT
        if (stmt.startAt && stmt.startAt.length > 0 && stmt.orderBy && stmt.orderBy.length > 0) {
          resultTable = this.applyStartAt(resultTable, stmt.startAt, stmt.orderBy, evalContext);
        }

        const evalEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const duration = Number((evalEnd - evalStart).toFixed(2));

        executionPlan.push({
          name: `Execução EVALUATE #${sIdx + 1}`,
          durationMs: duration,
          details: `${resultTable.rows.length} linhas retornadas, ${resultTable.columns.length} colunas`,
          status: 'success',
        });

        results.push({
          statementIndex: sIdx,
          table: resultTable,
          rowCount: resultTable.rows.length,
          columns: resultTable.columns,
          rows: options.maxRows ? resultTable.rows.slice(0, options.maxRows) : resultTable.rows,
        });
      }

      const totalTime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;

      return {
        success: true,
        results,
        executionPlan,
        totalDurationMs: Number(totalTime.toFixed(2)),
        definedObjects,
      };
    } catch (err: any) {
      const totalTime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
      const errorMsg = err instanceof DaxError ? err.message : (err.message || String(err));

      executionPlan.push({
        name: 'Falha na Execução',
        durationMs: Number(totalTime.toFixed(2)),
        details: errorMsg,
        status: 'error',
      });

      return {
        success: false,
        results,
        executionPlan,
        totalDurationMs: Number(totalTime.toFixed(2)),
        error: errorMsg,
        definedObjects,
      };
    }
  }

  /**
   * Resolves a value from a row for an ORDER BY item, with bracket handling and row context fallback.
   */
  private static resolveRowValue(
    row: Record<string, any>,
    item: DaxOrderByItem,
    evalContext: EvaluationContext
  ): any {
    const rawName = item.columnOrExprName || '';
    if (rawName && rawName in row) {
      return row[rawName];
    }

    // Try extracting bracketed column name e.g. 'd_Cal'[Ano] or d_Cal[Ano] -> Ano
    const matchBracket = rawName.match(/\[([^\]]+)\]/);
    const bareName = matchBracket ? matchBracket[1].trim() : rawName.trim();
    if (bareName in row) {
      return row[bareName];
    }

    // Case-insensitive match on keys of row
    const bareLower = bareName.toLowerCase();
    const rawLower = rawName.toLowerCase();
    for (const [key, val] of Object.entries(row)) {
      const kLower = key.toLowerCase();
      if (kLower === bareLower || kLower === rawLower) {
        return val;
      }
      const kBracket = key.match(/\[([^\]]+)\]/);
      if (kBracket && kBracket[1].toLowerCase().trim() === bareLower) {
        return val;
      }
      const keyClean = key.replace(/^\[|\]$|^'|'$/g, '').trim().toLowerCase();
      if (keyClean === bareLower) {
        return val;
      }
    }

    // If not found in row directly, evaluate item AST in row context
    if (item.ast) {
      try {
        const ev = new Evaluator({ ...evalContext, row });
        return ev.evalNode(item.ast);
      } catch {
        return DAX_BLANK;
      }
    }

    return DAX_BLANK;
  }

  /**
   * Sorts the DaxTable according to ORDER BY clauses.
   */
  private static applyOrderBy(
    table: DaxTable,
    orderBy: DaxOrderByItem[],
    evalContext: EvaluationContext
  ): DaxTable {
    const sortedRows = [...table.rows].sort((rowA, rowB) => {
      for (const item of orderBy) {
        const valA = this.resolveRowValue(rowA, item, evalContext);
        const valB = this.resolveRowValue(rowB, item, evalContext);
        const cmp = daxCompare(valA, valB);
        if (cmp !== 0) {
          return item.direction === 'DESC' ? -cmp : cmp;
        }
      }
      return 0;
    });

    return {
      columns: table.columns,
      rows: sortedRows,
    };
  }

  /**
   * Applies START AT filtering to begin results at specified cursor values.
   */
  private static applyStartAt(
    table: DaxTable,
    startAt: any[],
    orderBy: DaxOrderByItem[],
    evalContext: EvaluationContext
  ): DaxTable {
    const startValues = startAt.map(node => {
      const ev = new Evaluator(evalContext);
      return ev.evalNode(node);
    });

    const filteredRows = table.rows.filter((row: Record<string, any>) => {
      for (let i = 0; i < orderBy.length; i++) {
        if (i >= startValues.length) break;
        const item = orderBy[i];
        const startVal = startValues[i];
        const rowVal = this.resolveRowValue(row, item, evalContext);

        const cmp = daxCompare(rowVal, startVal);
        if (item.direction === 'DESC') {
          if (cmp < 0) return false;
          if (cmp > 0) return true;
        } else {
          if (cmp < 0) return false;
          if (cmp > 0) return true;
        }
      }
      return true;
    });

    return {
      columns: table.columns,
      rows: filteredRows,
    };
  }
}
