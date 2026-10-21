import { Table, Column } from '../types/bi';

export interface ConnectionConfig {
  id: string;
  name: string;
  type: 'postgres' | 'mysql' | 'sqlserver' | 'oracle' | 'rest_api' | 'gateway';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  url?: string;
  environment: 'dev' | 'test' | 'prod';
  gatewayUrl?: string;
  useGateway?: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  availableTables?: string[];
}

export interface DataSourceAdapter {
  type: string;
  testConnection(config: ConnectionConfig): Promise<ConnectionTestResult>;
  fetchSchema(config: ConnectionConfig): Promise<{ tableName: string; columns: Column[] }[]>;
  executeQuery(config: ConnectionConfig, query: string): Promise<Record<string, any>[]>;
}

export class MockDatabaseAdapter implements DataSourceAdapter {
  type = 'relational-database';

  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    const start = performance.now();
    await new Promise(res => setTimeout(res, 600));
    const latency = Math.round(performance.now() - start);

    if (config.useGateway && !config.gatewayUrl) {
      return {
        success: false,
        message: 'Modo Gateway ativado, mas nenhuma URL de Gateway On-Premises foi fornecida.',
        latencyMs: latency,
      };
    }

    return {
      success: true,
      message: `Conexão bem-sucedida ao ${config.type.toUpperCase()} no ambiente [${config.environment.toUpperCase()}]! (Modo Simulado / Demonstrativo)`,
      latencyMs: latency,
      availableTables: ['tb_faturamento', 'tb_estoque_armazem', 'tb_fornecedores', 'tb_ordens_servico'],
    };
  }

  async fetchSchema(config: ConnectionConfig): Promise<{ tableName: string; columns: Column[] }[]> {
    await new Promise(res => setTimeout(res, 400));
    return [
      {
        tableName: 'tb_faturamento',
        columns: [
          { id: 'c1', name: 'id_nf', originalName: 'id_nf', dataType: 'number' },
          { id: 'c2', name: 'data_emissao', originalName: 'data_emissao', dataType: 'date' },
          { id: 'c3', name: 'valor_total_nf', originalName: 'valor_total_nf', dataType: 'currency' },
          { id: 'c4', name: 'status_sefaz', originalName: 'status_sefaz', dataType: 'text' },
        ],
      },
      {
        tableName: 'tb_fornecedores',
        columns: [
          { id: 'f1', name: 'id_fornecedor', originalName: 'id_fornecedor', dataType: 'number' },
          { id: 'f2', name: 'razao_social', originalName: 'razao_social', dataType: 'text' },
          { id: 'f3', name: 'cnpj', originalName: 'cnpj', dataType: 'text' },
          { id: 'f4', name: 'uf', originalName: 'uf', dataType: 'text', dataCategory: 'state' },
        ],
      },
    ];
  }

  async executeQuery(config: ConnectionConfig, query: string): Promise<Record<string, any>[]> {
    await new Promise(res => setTimeout(res, 500));
    // Sample mock return
    return [
      { id_nf: 10091, data_emissao: '2025-05-10', valor_total_nf: 24500.0, status_sefaz: 'Autorizada' },
      { id_nf: 10092, data_emissao: '2025-05-11', valor_total_nf: 18200.0, status_sefaz: 'Autorizada' },
      { id_nf: 10093, data_emissao: '2025-05-12', valor_total_nf: 9400.0, status_sefaz: 'Autorizada' },
    ];
  }
}

export class RestApiAdapter implements DataSourceAdapter {
  type = 'rest_api';

  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    if (!config.url) {
      return { success: false, message: 'URL da API REST não informada.', latencyMs: 0 };
    }
    const start = performance.now();
    try {
      // In browser, try HEAD or GET
      const resp = await fetch(config.url, { method: 'GET' });
      const latency = Math.round(performance.now() - start);
      if (resp.ok) {
        return { success: true, message: `API REST respondeu HTTP ${resp.status} em ${latency}ms`, latencyMs: latency };
      }
      return {
        success: false,
        message: `API retornou status HTTP ${resp.status}: ${resp.statusText}`,
        latencyMs: latency,
      };
    } catch (err: any) {
      const latency = Math.round(performance.now() - start);
      return {
        success: false,
        message: `Erro ao conectar na URL: ${err.message}. Verifique se os cabeçalhos CORS permitem requisições do navegador.`,
        latencyMs: latency,
      };
    }
  }

  async fetchSchema(config: ConnectionConfig): Promise<{ tableName: string; columns: Column[] }[]> {
    return [];
  }

  async executeQuery(config: ConnectionConfig, query: string): Promise<Record<string, any>[]> {
    if (!config.url) throw new Error('URL da API ausente');
    const resp = await fetch(config.url);
    const data = await resp.json();
    return Array.isArray(data) ? data : [data];
  }
}

export const mockDbAdapter = new MockDatabaseAdapter();
export const restApiAdapter = new RestApiAdapter();
