import { DaxEngine } from '../daxEngine';
import { Table, Measure, Filter, RlsRole, CalculationGroup, UserDefinedFunction } from '../../types/bi';
import { WorkerEvalRequest, WorkerEvalResponse } from './daxWorker';

export interface WorkerClientOptions {
  timeoutMs?: number;
  useWorkerIfAvailable?: boolean;
}

export class DaxWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (res: any) => void;
      reject: (err: any) => void;
      timer: any;
    }
  >();
  private isWorkerSupported: boolean;

  constructor() {
    this.isWorkerSupported = typeof window !== 'undefined' && typeof Worker !== 'undefined';
  }

  private initWorker(): boolean {
    if (this.worker) return true;
    if (!this.isWorkerSupported) return false;

    try {
      // In Vite / Webpack standard module worker format
      this.worker = new Worker(new URL('./daxWorker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent<WorkerEvalResponse>) => {
        const { id, success, result, error } = e.data;
        const pending = this.pendingRequests.get(id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(id);
          if (success) {
            pending.resolve(result);
          } else {
            pending.reject(new Error(error || 'Worker evaluation failed'));
          }
        }
      };

      this.worker.onerror = () => {
        // Fallback gracefully if worker errors
        this.terminate();
        this.isWorkerSupported = false;
      };

      return true;
    } catch {
      this.isWorkerSupported = false;
      return false;
    }
  }

  public async evaluateAsync(
    formula: string,
    tables: Table[],
    measures: Measure[],
    filters?: Filter[],
    role?: RlsRole,
    calculationGroups?: CalculationGroup[],
    udfs?: UserDefinedFunction[],
    options: WorkerClientOptions = {}
  ): Promise<any> {
    const timeoutMs = options.timeoutMs ?? 15000;
    const canUseWorker = options.useWorkerIfAvailable !== false && this.initWorker();

    if (canUseWorker && this.worker) {
      const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const request: WorkerEvalRequest = {
        id,
        type: 'evaluate',
        formula,
        tables,
        measures,
        filters,
        role,
        calculationGroups,
        udfs,
      };

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingRequests.delete(id);
          reject(new Error(`Timeout na avaliação DAX excedido (${timeoutMs}ms)`));
        }, timeoutMs);

        this.pendingRequests.set(id, { resolve, reject, timer });
        this.worker!.postMessage(request);
      });
    }

    // Transparent inline fallback (e.g. running in sandbox or Node.js test environment)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout na avaliação DAX excedido (${timeoutMs}ms)`));
      }, timeoutMs);

      try {
        const result = DaxEngine.evaluate(
          formula,
          tables,
          measures,
          filters,
          undefined,
          role,
          calculationGroups,
          udfs
        );
        clearTimeout(timer);
        resolve(result);
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  public async executeQueryAsync(
    query: string,
    options: {
      tables: Table[];
      measures: Measure[];
      filters?: Filter[];
      role?: RlsRole;
      calculationGroups?: CalculationGroup[];
      udfs?: UserDefinedFunction[];
      timeoutMs?: number;
    }
  ): Promise<any> {
    const timeoutMs = options.timeoutMs ?? 15000;
    const canUseWorker = this.initWorker();

    if (canUseWorker && this.worker) {
      const id = `qry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const request: WorkerEvalRequest = {
        id,
        type: 'execute_query',
        query,
        tables: options.tables,
        measures: options.measures,
        filters: options.filters,
        role: options.role,
        calculationGroups: options.calculationGroups,
        udfs: options.udfs,
      };

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingRequests.delete(id);
          reject(new Error(`Timeout na execução da consulta DAX excedido (${timeoutMs}ms)`));
        }, timeoutMs);

        this.pendingRequests.set(id, { resolve, reject, timer });
        this.worker!.postMessage(request);
      });
    }

    // Inline fallback
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout na execução da consulta DAX excedido (${timeoutMs}ms)`));
      }, timeoutMs);

      try {
        const result = DaxEngine.executeQuery(query, {
          tables: options.tables,
          measures: options.measures,
          activeFilters: options.filters,
          activeRole: options.role,
          calculationGroups: options.calculationGroups,
          udfs: options.udfs,
        });
        clearTimeout(timer);
        resolve(result);
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, req] of this.pendingRequests) {
      clearTimeout(req.timer);
      req.reject(new Error('Worker foi finalizado'));
    }
    this.pendingRequests.clear();
  }
}

export const globalDaxWorkerClient = new DaxWorkerClient();
