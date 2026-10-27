/**
 * DaxWorker: runs DAX evaluations in a background Web Worker thread.
 */
import { DaxEngine } from '../daxEngine';
import { Table, Measure, Filter, RlsRole, CalculationGroup, UserDefinedFunction } from '../../types/bi';

export interface WorkerEvalRequest {
  id: string;
  type: 'evaluate' | 'execute_query';
  formula?: string;
  query?: string;
  tables: Table[];
  measures: Measure[];
  filters?: Filter[];
  role?: RlsRole;
  calculationGroups?: CalculationGroup[];
  udfs?: UserDefinedFunction[];
}

export interface WorkerEvalResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  durationMs: number;
}

if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = (e: MessageEvent<WorkerEvalRequest>) => {
    const data = e.data;
    const start = performance.now();

    try {
      if (data.type === 'evaluate' && data.formula) {
        const res = DaxEngine.evaluate(
          data.formula,
          data.tables,
          data.measures,
          data.filters,
          undefined,
          data.role,
          data.calculationGroups,
          data.udfs
        );
        const durationMs = performance.now() - start;
        self.postMessage({
          id: data.id,
          success: true,
          result: res,
          durationMs,
        } as WorkerEvalResponse);
      } else if (data.type === 'execute_query' && data.query) {
        const queryRes = DaxEngine.executeQuery(data.query, {
          tables: data.tables,
          measures: data.measures,
          activeFilters: data.filters,
          activeRole: data.role,
          calculationGroups: data.calculationGroups,
          udfs: data.udfs,
        });
        const durationMs = performance.now() - start;
        self.postMessage({
          id: data.id,
          success: true,
          result: queryRes,
          durationMs,
        } as WorkerEvalResponse);
      } else {
        throw new Error(`Comando de worker desconhecido: ${data.type}`);
      }
    } catch (err: any) {
      const durationMs = performance.now() - start;
      self.postMessage({
        id: data.id,
        success: false,
        error: err?.message || String(err),
        durationMs,
      } as WorkerEvalResponse);
    }
  };
}
