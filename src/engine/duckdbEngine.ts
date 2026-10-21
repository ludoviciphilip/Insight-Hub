import * as duckdb from '@duckdb/duckdb-wasm';
import { Table } from '../types/bi';
import alasql from 'alasql';

export type EngineType = 'duckdb' | 'alasql';

export interface DuckDbStatus {
  engineType: EngineType;
  isReady: boolean;
  isInitializing: boolean;
  isOffline: boolean;
  fallbackReason: string | null;
  syncedTableCount: number;
}

export class DuckDbEngine {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private isReady = false;
  private isInitializing = false;
  private useFallback = false;
  private fallbackReason: string | null = null;
  private initPromise: Promise<boolean> | null = null;

  // Track table sync state by ID and Name with version counter
  private pendingTables: Map<string, Table> = new Map();
  private syncedTables: Set<string> = new Set();
  private tableVersions: Map<string, number> = new Map();

  /**
   * Initializes DuckDB-WASM with a single shared promise to ensure concurrent callers wait on the same execution.
   */
  public async initialize(): Promise<boolean> {
    if (this.isReady) {
      return !this.useFallback;
    }

    if (this.initPromise) {
      return await this.initPromise;
    }

    this.initPromise = (async () => {
      this.isInitializing = true;
      try {
        if (typeof window === 'undefined' || typeof Worker === 'undefined') {
          throw new Error('Ambiente de execução sem suporte a Web Workers.');
        }

        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
        if (!bundle || !bundle.mainWorker) {
          throw new Error('CDN indisponível ou bundle WebWorker não localizado.');
        }

        const workerBlob = new Blob([`importScripts("${bundle.mainWorker}");`], {
          type: 'text/javascript',
        });
        const workerUrl = URL.createObjectURL(workerBlob);
        const worker = new Worker(workerUrl);
        const logger = new duckdb.ConsoleLogger();

        const dbInstance = new duckdb.AsyncDuckDB(logger, worker);
        await dbInstance.instantiate(bundle.mainModule, bundle.pthreadWorker);
        this.db = dbInstance;
        this.conn = await dbInstance.connect();

        this.isReady = true;
        this.useFallback = false;
        this.fallbackReason = null;
        console.log('InsightHub: Motor DuckDB-WASM (Colunar Nativo) inicializado com sucesso.');
        return true;
      } catch (err: any) {
        console.warn(
          'InsightHub: DuckDB-WASM offline/indisponível. Ativando motor SQL compatível (AlaSQL):',
          err?.message || err
        );
        this.useFallback = true;
        this.isReady = true;
        this.fallbackReason = err?.message || 'Falha de conectividade CDN ou workers offline';
        return false;
      } finally {
        this.isInitializing = false;
      }
    })();

    return await this.initPromise;
  }

  public getStatus(): 'ready_duckdb' | 'ready_fallback' | 'initializing' | 'uninitialized' {
    if (this.isInitializing) return 'initializing';
    if (this.isReady) return this.useFallback ? 'ready_fallback' : 'ready_duckdb';
    return 'uninitialized';
  }

  public getEngineType(): EngineType {
    return this.useFallback ? 'alasql' : 'duckdb';
  }

  public isOffline(): boolean {
    return this.useFallback;
  }

  public getFallbackReason(): string | null {
    return this.fallbackReason;
  }

  public getDiagnosticInfo(): DuckDbStatus {
    return {
      engineType: this.getEngineType(),
      isReady: this.isReady,
      isInitializing: this.isInitializing,
      isOffline: this.useFallback,
      fallbackReason: this.fallbackReason,
      syncedTableCount: this.syncedTables.size,
    };
  }

  /**
   * Checks whether a table is currently synced in the active SQL engine
   */
  public isSynced(tableIdOrName: string): boolean {
    return this.syncedTables.has(tableIdOrName);
  }

  /**
   * Queues or registers table for lazy sync when queries are performed
   */
  public registerTable(table: Table): void {
    const prevVer = this.tableVersions.get(table.id) || 0;
    this.tableVersions.set(table.id, prevVer + 1);
    this.tableVersions.set(table.name, prevVer + 1);

    this.pendingTables.set(table.id, table);
    this.pendingTables.set(table.name, table);
    this.syncedTables.delete(table.id);
    this.syncedTables.delete(table.name);
  }

  /**
   * Explicit type mapping from BI DataType to DuckDB SQL Types
   */
  private mapColumnTypeToDuckDb(dataType?: string): string {
    const t = (dataType || 'text').toLowerCase();
    switch (t) {
      case 'number':
      case 'currency':
      case 'percentage':
        return 'DOUBLE';
      case 'boolean':
        return 'BOOLEAN';
      case 'date':
        return 'VARCHAR';
      default:
        return 'VARCHAR';
    }
  }

  /**
   * Synchronizes all queued tables into the active engine with explicit typed schema
   */
  private async syncPendingTables(): Promise<void> {
    if (this.pendingTables.size === 0) return;

    const uniqueTables = Array.from(new Set(this.pendingTables.values()));

    for (const table of uniqueTables) {
      if (this.syncedTables.has(table.id)) continue;

      if (this.db && this.conn && !this.useFallback) {
        // Explicit Schema in DuckDB
        const tempFileName = `__temp_${table.name.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}.json`;
        try {
          // 1. Create typed table definition
          const colDefs = table.columns.length > 0
            ? table.columns.map(c => `"${c.name}" ${this.mapColumnTypeToDuckDb(c.dataType)}`).join(', ')
            : '"_id" VARCHAR';

          await this.conn.query(`CREATE OR REPLACE TABLE "${table.name}" (${colDefs});`);

          // 2. Insert data using temporary json buffer
          if (table.rows && table.rows.length > 0) {
            const jsonText = JSON.stringify(table.rows);
            await this.db.registerFileText(tempFileName, jsonText);
            await this.conn.query(`INSERT INTO "${table.name}" SELECT * FROM read_json_auto('${tempFileName}');`);
          }

          this.syncedTables.add(table.id);
          this.syncedTables.add(table.name);
        } catch (err: any) {
          console.error(`Erro ao sincronizar tabela ${table.name} no DuckDB:`, err);
          throw new Error(`Falha no registro tipado de "${table.name}" no DuckDB: ${err.message}`);
        } finally {
          // 3. Free temporary files from memory
          try {
            await this.db.dropFile(tempFileName);
          } catch {
            // Ignore temp drop errors
          }
        }
      } else {
        // AlaSQL Registration
        try {
          alasql(`DROP TABLE IF EXISTS [${table.name}]`);
          alasql(`CREATE TABLE [${table.name}]`);
          if (alasql.tables[table.name]) {
            alasql.tables[table.name].data = [...(table.rows || [])];
          }
          this.syncedTables.add(table.id);
          this.syncedTables.add(table.name);
        } catch (err: any) {
          console.error(`Erro ao registrar tabela ${table.name} no AlaSQL:`, err);
        }
      }
    }
  }

  /**
   * Executes SQL query.
   * If DuckDB is active, executes on DuckDB and propagates any syntax/semantic error directly.
   * AlaSQL is only used when DuckDB failed to initialize.
   */
  public async query(sql: string): Promise<Record<string, any>[]> {
    if (!this.isReady) {
      await this.initialize();
    }

    await this.syncPendingTables();

    // 1. DuckDB Execution
    if (this.conn && !this.useFallback) {
      try {
        const arrowResult = await this.conn.query(sql);
        return arrowResult.toArray().map(row => row.toJSON());
      } catch (err: any) {
        // Sem repetição silenciosa no AlaSQL: propague o erro real da consulta
        console.error('Erro na consulta DuckDB:', err);
        throw new Error(`Erro DuckDB: ${err.message || String(err)}`);
      }
    }

    // 2. AlaSQL Fallback Execution (only if DuckDB could not initialize)
    try {
      const res = alasql(sql);
      return (Array.isArray(res) ? res : [res]) as Record<string, any>[];
    } catch (err: any) {
      throw new Error(`Erro SQL (AlaSQL): ${err.message || String(err)}`);
    }
  }
}

export const globalDuckDb = new DuckDbEngine();
