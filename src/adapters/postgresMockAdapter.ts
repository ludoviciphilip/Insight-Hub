import { Table, Column, Relationship, DataType } from '../types/bi';

export interface PostgresColumnDef {
  name: string;
  pgType: string;
  biType: DataType;
  isPrimary?: boolean;
  isForeign?: boolean;
  foreignTable?: string;
  foreignColumn?: string;
  nullable: boolean;
  description: string;
}

export interface PostgresTableDef {
  name: string;
  schema: string;
  description: string;
  columns: PostgresColumnDef[];
  rows: Record<string, any>[];
}

export interface PostgresConnectionConfig {
  host: string;
  port: number;
  database: string;
  schema: string;
  user: string;
  ssl: boolean;
}

export interface PostgresDiagnosticInfo {
  version: string;
  serverTime: string;
  activeConnections: number;
  databaseSize: string;
  tablesCount: number;
  isMock: boolean;
  mockNotice: string;
}

// 1. Clientes Table (public.pg_clientes)
const clientesRows: Record<string, any>[] = [
  { id_cliente: 1, razao_social: 'TechSul Soluções em Nuvem Ltda', cnpj: '14.829.102/0001-44', segmento: 'Enterprise', cidade: 'Curitiba', uf: 'PR', limite_credito: 180000.0, status_ativo: true, criado_em: '2023-01-15 09:30:00' },
  { id_cliente: 2, razao_social: 'Varejo Paulistano Distribuição S/A', cnpj: '08.192.834/0001-92', segmento: 'Médio Porte', cidade: 'São Paulo', uf: 'SP', limite_credito: 125000.0, status_ativo: true, criado_em: '2023-02-20 14:15:00' },
  { id_cliente: 3, razao_social: 'Minas Logística & Transportes', cnpj: '21.439.812/0001-18', segmento: 'Enterprise', cidade: 'Belo Horizonte', uf: 'MG', limite_credito: 250000.0, status_ativo: true, criado_em: '2023-03-10 11:00:00' },
  { id_cliente: 4, razao_social: 'Comércio Carioca e Varejo S/A', cnpj: '33.910.428/0001-50', segmento: 'Enterprise', cidade: 'Rio de Janeiro', uf: 'RJ', limite_credito: 210000.0, status_ativo: true, criado_em: '2023-04-05 16:45:00' },
  { id_cliente: 5, razao_social: 'Sul Distribuidora de Eletrônicos', cnpj: '19.283.471/0001-33', segmento: 'Médio Porte', cidade: 'Porto Alegre', uf: 'RS', limite_credito: 95000.0, status_ativo: true, criado_em: '2023-05-18 10:20:00' },
  { id_cliente: 6, razao_social: 'Bahia Atacado do Nordeste Ltda', cnpj: '05.394.812/0001-65', segmento: 'Pequena Empresa', cidade: 'Salvador', uf: 'BA', limite_credito: 50000.0, status_ativo: true, criado_em: '2023-06-22 08:50:00' },
  { id_cliente: 7, razao_social: 'Planalto Suprimentos & TI', cnpj: '02.481.932/0001-07', segmento: 'Enterprise', cidade: 'Brasília', uf: 'DF', limite_credito: 320000.0, status_ativo: true, criado_em: '2023-07-30 13:10:00' },
  { id_cliente: 8, razao_social: 'Campinas Inovação Digital Ltda', cnpj: '28.192.348/0001-81', segmento: 'Pequena Empresa', cidade: 'Campinas', uf: 'SP', limite_credito: 75000.0, status_ativo: false, criado_em: '2023-08-14 15:30:00' },
];

// 2. Pedidos Table (public.pg_pedidos)
const pedidosRows: Record<string, any>[] = [
  { id_pedido: 5001, id_cliente: 1, numero_nf: 'NF-2025-001', data_emissao: '2025-01-10', canal_venda: 'Direto B2B', condicao_pgto: '30 DDL', valor_bruto: 45000.0, valor_desconto: 2000.0, valor_liquido: 43000.0, status_pedido: 'ENTREGUE' },
  { id_pedido: 5002, id_cliente: 2, numero_nf: 'NF-2025-002', data_emissao: '2025-01-15', canal_venda: 'E-Commerce B2B', condicao_pgto: 'À Vista PIX', valor_bruto: 18500.0, valor_desconto: 500.0, valor_liquido: 18000.0, status_pedido: 'ENTREGUE' },
  { id_pedido: 5003, id_cliente: 3, numero_nf: 'NF-2025-003', data_emissao: '2025-01-22', canal_venda: 'Representante', condicao_pgto: '30/60 DDL', valor_bruto: 82000.0, valor_desconto: 4000.0, valor_liquido: 78000.0, status_pedido: 'FATURADO' },
  { id_pedido: 5004, id_cliente: 4, numero_nf: 'NF-2025-004', data_emissao: '2025-02-05', canal_venda: 'Direto B2B', condicao_pgto: '30 DDL', valor_bruto: 62000.0, valor_desconto: 3000.0, valor_liquido: 59000.0, status_pedido: 'ENTREGUE' },
  { id_pedido: 5005, id_cliente: 5, numero_nf: 'NF-2025-005', data_emissao: '2025-02-12', canal_venda: 'E-Commerce B2B', condicao_pgto: 'Boleto 15D', valor_bruto: 28400.0, valor_desconto: 800.0, valor_liquido: 27600.0, status_pedido: 'ENTREGUE' },
  { id_pedido: 5006, id_cliente: 6, numero_nf: 'NF-2025-006', data_emissao: '2025-02-20', canal_venda: 'Representante', condicao_pgto: 'À Vista', valor_bruto: 14200.0, valor_desconto: 0.0, valor_liquido: 14200.0, status_pedido: 'ENTREGUE' },
  { id_pedido: 5007, id_cliente: 7, numero_nf: 'NF-2025-007', data_emissao: '2025-03-01', canal_venda: 'Direto B2B', condicao_pgto: '30/60/90 DDL', valor_bruto: 115000.0, valor_desconto: 5000.0, valor_liquido: 110000.0, status_pedido: 'FATURADO' },
  { id_pedido: 5008, id_cliente: 1, numero_nf: 'NF-2025-008', data_emissao: '2025-03-14', canal_venda: 'E-Commerce B2B', condicao_pgto: 'À Vista PIX', valor_bruto: 32000.0, valor_desconto: 1200.0, valor_liquido: 30800.0, status_pedido: 'FATURADO' },
  { id_pedido: 5009, id_cliente: 2, numero_nf: 'NF-2025-009', data_emissao: '2025-03-25', canal_venda: 'Representante', condicao_pgto: '30 DDL', valor_bruto: 41000.0, valor_desconto: 1500.0, valor_liquido: 39500.0, status_pedido: 'EM_PROCESSAMENTO' },
  { id_pedido: 5010, id_cliente: 4, numero_nf: 'NF-2025-010', data_emissao: '2025-04-02', canal_venda: 'Direto B2B', condicao_pgto: '30 DDL', valor_bruto: 54000.0, valor_desconto: 2000.0, valor_liquido: 52000.0, status_pedido: 'EM_PROCESSAMENTO' },
  { id_pedido: 5011, id_cliente: 3, numero_nf: 'NF-2025-011', data_emissao: '2025-04-18', canal_venda: 'Direto B2B', condicao_pgto: '30/60 DDL', valor_bruto: 94000.0, valor_desconto: 4500.0, valor_liquido: 89500.0, status_pedido: 'FATURADO' },
  { id_pedido: 5012, id_cliente: 5, numero_nf: 'NF-2025-012', data_emissao: '2025-05-04', canal_venda: 'E-Commerce B2B', condicao_pgto: 'Boleto 15D', valor_bruto: 36000.0, valor_desconto: 1000.0, valor_liquido: 35000.0, status_pedido: 'ENTREGUE' },
];

// 3. Itens do Pedido Table (public.pg_itens_pedido)
const itensPedidoRows: Record<string, any>[] = [
  { id_item: 101, id_pedido: 5001, sku: 'SRV-DELL-R750', produto: 'Servidor Dell PowerEdge R750', categoria: 'Hardware & Servidores', qtd: 2, preco_unit: 20000.0, subtotal: 40000.0 },
  { id_item: 102, id_pedido: 5001, sku: 'SW-LIC-WS22', produto: 'Licença Windows Server 2022 Datacenter', categoria: 'Software & Licenças', qtd: 1, preco_unit: 5000.0, subtotal: 5000.0 },
  { id_item: 103, id_pedido: 5002, sku: 'NB-LEN-T14', produto: 'Notebook Lenovo ThinkPad T14 Gen 4', categoria: 'Computadores & Laptops', qtd: 3, preco_unit: 5500.0, subtotal: 16500.0 },
  { id_item: 104, id_pedido: 5002, sku: 'MON-DELL-27', produto: 'Monitor Dell UltraSharp 27" 4K', categoria: 'Periféricos & Displays', qtd: 2, preco_unit: 1000.0, subtotal: 2000.0 },
  { id_item: 105, id_pedido: 5003, sku: 'STG-SAN-60TB', produto: 'Storage SAN All-Flash 60TB NVMe', categoria: 'Armazenamento & Storage', qtd: 1, preco_unit: 75000.0, subtotal: 75000.0 },
  { id_item: 106, id_pedido: 5003, sku: 'CAB-FIBRA-10M', produto: 'Patch Cord Fibra Óptica 10m Duplex', categoria: 'Redes & Infraestrutura', qtd: 14, preco_unit: 500.0, subtotal: 7000.0 },
  { id_item: 107, id_pedido: 5004, sku: 'FW-FORTI-60F', produto: 'Firewall Fortinet FortiGate 60F UTM', categoria: 'Segurança da Informação', qtd: 4, preco_unit: 12000.0, subtotal: 48000.0 },
  { id_item: 108, id_pedido: 5004, sku: 'SW-EP-SEC', produto: 'Licença Anual Endpoint Protection (100 nós)', categoria: 'Software & Licenças', qtd: 1, preco_unit: 14000.0, subtotal: 14000.0 },
  { id_item: 109, id_pedido: 5005, sku: 'SW-CISCO-C9200', produto: 'Switch Cisco Catalyst 9200L 48 Portas PoE', categoria: 'Redes & Infraestrutura', qtd: 2, preco_unit: 12500.0, subtotal: 25000.0 },
  { id_item: 110, id_pedido: 5005, sku: 'AP-CISCO-W6', produto: 'Access Point Cisco Catalyst Wi-Fi 6', categoria: 'Redes & Infraestrutura', qtd: 2, preco_unit: 1700.0, subtotal: 3400.0 },
  { id_item: 111, id_pedido: 5006, sku: 'NB-DELL-LAT', produto: 'Notebook Dell Latitude 5440 i7', categoria: 'Computadores & Laptops', qtd: 2, preco_unit: 6200.0, subtotal: 12400.0 },
  { id_item: 112, id_pedido: 5006, sku: 'DOC-DELL-WD19', produto: 'Docking Station Dell WD19S USB-C', categoria: 'Periféricos & Displays', qtd: 2, preco_unit: 900.0, subtotal: 1800.0 },
  { id_item: 113, id_pedido: 5007, sku: 'SRV-HPE-DL380', produto: 'Servidor HPE ProLiant DL380 Gen10 Plus', categoria: 'Hardware & Servidores', qtd: 2, preco_unit: 45000.0, subtotal: 90000.0 },
  { id_item: 114, id_pedido: 5007, sku: 'UPS-APC-10KVA', produto: 'Nobreak APC Smart-UPS RT 10kVA Trifásico', categoria: 'Energia & Climatização', qtd: 1, preco_unit: 25000.0, subtotal: 25000.0 },
  { id_item: 115, id_pedido: 5008, sku: 'CLD-MIG-SERV', produto: 'Pacote de Consultoria & Migração Cloud AWS', categoria: 'Serviços & Suporte', qtd: 1, preco_unit: 32000.0, subtotal: 32000.0 },
  { id_item: 116, id_pedido: 5009, sku: 'NB-LEN-T14', produto: 'Notebook Lenovo ThinkPad T14 Gen 4', categoria: 'Computadores & Laptops', qtd: 6, preco_unit: 5500.0, subtotal: 33000.0 },
  { id_item: 117, id_pedido: 5009, sku: 'MON-DELL-27', produto: 'Monitor Dell UltraSharp 27" 4K', categoria: 'Periféricos & Displays', qtd: 8, preco_unit: 1000.0, subtotal: 8000.0 },
  { id_item: 118, id_pedido: 5010, sku: 'FW-FORTI-100F', produto: 'Firewall Fortinet FortiGate 100F Dual Power', categoria: 'Segurança da Informação', qtd: 2, preco_unit: 27000.0, subtotal: 54000.0 },
  { id_item: 119, id_pedido: 5011, sku: 'STG-SAN-60TB', produto: 'Storage SAN All-Flash 60TB NVMe', categoria: 'Armazenamento & Storage', qtd: 1, preco_unit: 75000.0, subtotal: 75000.0 },
  { id_item: 120, id_pedido: 5011, sku: 'SW-CISCO-C9200', produto: 'Switch Cisco Catalyst 9200L 48 Portas PoE', categoria: 'Redes & Infraestrutura', qtd: 1, preco_unit: 12500.0, subtotal: 12500.0 },
  { id_item: 121, id_pedido: 5011, sku: 'CAB-FIBRA-10M', produto: 'Patch Cord Fibra Óptica 10m Duplex', categoria: 'Redes & Infraestrutura', qtd: 13, preco_unit: 500.0, subtotal: 6500.0 },
  { id_item: 122, id_pedido: 5012, sku: 'SRV-DELL-R750', produto: 'Servidor Dell PowerEdge R750', categoria: 'Hardware & Servidores', qtd: 1, preco_unit: 20000.0, subtotal: 20000.0 },
  { id_item: 123, id_pedido: 5012, sku: 'NB-DELL-LAT', produto: 'Notebook Dell Latitude 5440 i7', categoria: 'Computadores & Laptops', qtd: 2, preco_unit: 6200.0, subtotal: 12400.0 },
  { id_item: 124, id_pedido: 5012, sku: 'MON-DELL-27', produto: 'Monitor Dell UltraSharp 27" 4K', categoria: 'Periféricos & Displays', qtd: 3, preco_unit: 1000.0, subtotal: 3000.0 },
];

// 4. Estoque de Armazém Table (public.pg_estoque_armazem)
const estoqueArmazemRows: Record<string, any>[] = [
  { id_estoque: 1, armazem: 'Armazém Central SP (Barueri)', sku: 'SRV-DELL-R750', qtd_disponivel: 14, qtd_reservada: 3, custo_medio_un: 14200.0, ultima_revisao: '2025-05-01' },
  { id_estoque: 2, armazem: 'Armazém Central SP (Barueri)', sku: 'NB-LEN-T14', qtd_disponivel: 45, qtd_reservada: 12, custo_medio_un: 3950.0, ultima_revisao: '2025-05-02' },
  { id_estoque: 3, armazem: 'Armazém Central SP (Barueri)', sku: 'MON-DELL-27', qtd_disponivel: 80, qtd_reservada: 15, custo_medio_un: 680.0, ultima_revisao: '2025-05-03' },
  { id_estoque: 4, armazem: 'Armazém Central SP (Barueri)', sku: 'FW-FORTI-60F', qtd_disponivel: 22, qtd_reservada: 4, custo_medio_un: 8400.0, ultima_revisao: '2025-05-01' },
  { id_estoque: 5, armazem: 'Armazém Sul (Curitiba)', sku: 'SW-CISCO-C9200', qtd_disponivel: 18, qtd_reservada: 5, custo_medio_un: 8900.0, ultima_revisao: '2025-05-02' },
  { id_estoque: 6, armazem: 'Armazém Sul (Curitiba)', sku: 'NB-DELL-LAT', qtd_disponivel: 30, qtd_reservada: 8, custo_medio_un: 4600.0, ultima_revisao: '2025-05-04' },
  { id_estoque: 7, armazem: 'Armazém Rio Santos (Duque de Caxias)', sku: 'SRV-HPE-DL380', qtd_disponivel: 6, qtd_reservada: 2, custo_medio_un: 31000.0, ultima_revisao: '2025-05-01' },
  { id_estoque: 8, armazem: 'Armazém Rio Santos (Duque de Caxias)', sku: 'STG-SAN-60TB', qtd_disponivel: 4, qtd_reservada: 1, custo_medio_un: 52000.0, ultima_revisao: '2025-05-05' },
];

export const POSTGRES_TABLES: PostgresTableDef[] = [
  {
    name: 'pg_clientes',
    schema: 'public',
    description: 'Cadastro de clientes corporativos B2B com CNPJ, limite de crédito e localização',
    columns: [
      { name: 'id_cliente', pgType: 'SERIAL PRIMARY KEY', biType: 'number', isPrimary: true, nullable: false, description: 'Chave primária do cliente' },
      { name: 'razao_social', pgType: 'VARCHAR(150)', biType: 'text', nullable: false, description: 'Razão social empresarial' },
      { name: 'cnpj', pgType: 'VARCHAR(18)', biType: 'text', nullable: false, description: 'Cadastro Nacional de Pessoa Jurídica' },
      { name: 'segmento', pgType: 'VARCHAR(50)', biType: 'text', nullable: false, description: 'Classificação de porte e segmento' },
      { name: 'cidade', pgType: 'VARCHAR(100)', biType: 'text', nullable: false, description: 'Município sede' },
      { name: 'uf', pgType: 'VARCHAR(2)', biType: 'text', nullable: false, description: 'Unidade Federativa' },
      { name: 'limite_credito', pgType: 'NUMERIC(12,2)', biType: 'currency', nullable: false, description: 'Limite de crédito rotativo concedido' },
      { name: 'status_ativo', pgType: 'BOOLEAN', biType: 'boolean', nullable: false, description: 'Flag de status cadastral' },
      { name: 'criado_em', pgType: 'TIMESTAMP WITHOUT TIME ZONE', biType: 'text', nullable: false, description: 'Data e hora de registro no ERP' },
    ],
    rows: clientesRows,
  },
  {
    name: 'pg_pedidos',
    schema: 'public',
    description: 'Cabeçalho de ordens de vendas e faturamento de produtos e serviços corporativos',
    columns: [
      { name: 'id_pedido', pgType: 'SERIAL PRIMARY KEY', biType: 'number', isPrimary: true, nullable: false, description: 'Identificador único da ordem' },
      { name: 'id_cliente', pgType: 'INTEGER REFERENCES public.pg_clientes(id_cliente)', biType: 'number', isForeign: true, foreignTable: 'pg_clientes', foreignColumn: 'id_cliente', nullable: false, description: 'Chave estrangeira do cliente' },
      { name: 'numero_nf', pgType: 'VARCHAR(20)', biType: 'text', nullable: false, description: 'Número do documento fiscal' },
      { name: 'data_emissao', pgType: 'DATE', biType: 'date', nullable: false, description: 'Data do pedido / emissão' },
      { name: 'canal_venda', pgType: 'VARCHAR(50)', biType: 'text', nullable: false, description: 'Canal de originação da venda' },
      { name: 'condicao_pgto', pgType: 'VARCHAR(50)', biType: 'text', nullable: false, description: 'Termos de faturamento' },
      { name: 'valor_bruto', pgType: 'NUMERIC(12,2)', biType: 'currency', nullable: false, description: 'Valor total bruto dos itens' },
      { name: 'valor_desconto', pgType: 'NUMERIC(12,2)', biType: 'currency', nullable: false, description: 'Descontos comerciais concedidos' },
      { name: 'valor_liquido', pgType: 'NUMERIC(12,2)', biType: 'currency', nullable: false, description: 'Faturamento líquido final' },
      { name: 'status_pedido', pgType: 'VARCHAR(30)', biType: 'text', nullable: false, description: 'Estado do pedido (FATURADO, ENTREGUE, etc.)' },
    ],
    rows: pedidosRows,
  },
  {
    name: 'pg_itens_pedido',
    schema: 'public',
    description: 'Detalhamento de produtos, SKUs, categorias e precificação por linha de pedido',
    columns: [
      { name: 'id_item', pgType: 'SERIAL PRIMARY KEY', biType: 'number', isPrimary: true, nullable: false, description: 'Identificador da linha' },
      { name: 'id_pedido', pgType: 'INTEGER REFERENCES public.pg_pedidos(id_pedido)', biType: 'number', isForeign: true, foreignTable: 'pg_pedidos', foreignColumn: 'id_pedido', nullable: false, description: 'Chave do pedido' },
      { name: 'sku', pgType: 'VARCHAR(50)', biType: 'text', nullable: false, description: 'Código SKU do item' },
      { name: 'produto', pgType: 'VARCHAR(150)', biType: 'text', nullable: false, description: 'Nome descritivo do produto' },
      { name: 'categoria', pgType: 'VARCHAR(80)', biType: 'text', nullable: false, description: 'Categoria de tecnologia' },
      { name: 'qtd', pgType: 'INTEGER', biType: 'number', nullable: false, description: 'Quantidade faturada' },
      { name: 'preco_unit', pgType: 'NUMERIC(12,2)', biType: 'currency', nullable: false, description: 'Preço unitário de tabela' },
      { name: 'subtotal', pgType: 'NUMERIC(12,2)', biType: 'currency', nullable: false, description: 'Total da linha (qtd * preco_unit)' },
    ],
    rows: itensPedidoRows,
  },
  {
    name: 'pg_estoque_armazem',
    schema: 'public',
    description: 'Posição consolidada de estoques por centro de distribuição e armazém logístico',
    columns: [
      { name: 'id_estoque', pgType: 'SERIAL PRIMARY KEY', biType: 'number', isPrimary: true, nullable: false, description: 'ID único do registro de estoque' },
      { name: 'armazem', pgType: 'VARCHAR(100)', biType: 'text', nullable: false, description: 'Nome do Centro de Distribuição / Armazém' },
      { name: 'sku', pgType: 'VARCHAR(50)', biType: 'text', nullable: false, description: 'SKU do produto estocado' },
      { name: 'qtd_disponivel', pgType: 'INTEGER', biType: 'number', nullable: false, description: 'Quantidade física livre para venda' },
      { name: 'qtd_reservada', pgType: 'INTEGER', biType: 'number', nullable: false, description: 'Quantidade alocada a pedidos em trânsito' },
      { name: 'custo_medio_un', pgType: 'NUMERIC(12,2)', biType: 'currency', nullable: false, description: 'Custo médio ponderado contábil' },
      { name: 'ultima_revisao', pgType: 'DATE', biType: 'date', nullable: false, description: 'Data do último inventário físico' },
    ],
    rows: estoqueArmazemRows,
  },
];

export class PostgresMockConnector {
  public readonly isMock = true;
  public readonly defaultHost = 'pg-production-dw.internal.corp';
  public readonly defaultPort = 5432;
  public readonly defaultDatabase = 'enterprise_dw';
  public readonly defaultSchema = 'public';
  public readonly defaultUser = 'postgres_bi_reader';

  /**
   * Simulates PostgreSQL 16 connection handshake with realistic SSL negotiation and timing
   */
  public async testConnection(config?: Partial<PostgresConnectionConfig>): Promise<{
    success: boolean;
    message: string;
    latencyMs: number;
    diagnostics: PostgresDiagnosticInfo;
  }> {
    const start = performance.now();
    // Simulate network roundtrip (25-45ms)
    await new Promise(r => setTimeout(r, 350));
    const latency = Math.max(18, Math.round(performance.now() - start));

    const totalRows = POSTGRES_TABLES.reduce((acc, t) => acc + t.rows.length, 0);

    return {
      success: true,
      message: `Conectado com sucesso ao PostgreSQL 16.2 no banco "${config?.database || this.defaultDatabase}" (Esquema "${config?.schema || this.defaultSchema}"). Modo Mock ativo: dados simulados em memória sem necessidade de gateway de rede.`,
      latencyMs: latency,
      diagnostics: {
        version: 'PostgreSQL 16.2 (Ubuntu 16.2-1.pgdg22.04+1) on x86_64-pc-linux-gnu, compiled by gcc 11.4.0',
        serverTime: new Date().toISOString(),
        activeConnections: 4,
        databaseSize: '14.2 MB',
        tablesCount: POSTGRES_TABLES.length,
        isMock: true,
        mockNotice: 'Ambiente demonstrativo em memória (Mock). Nenhuma porta de rede ou credencial confidencial é exigida.',
      },
    };
  }

  /**
   * Retrieves schema catalog of all available PostgreSQL tables
   */
  public getSchema(): PostgresTableDef[] {
    return POSTGRES_TABLES;
  }

  /**
   * Executes a simulated SQL query against the mock PostgreSQL tables
   */
  public async executeQuery(sql: string): Promise<{ rows: Record<string, any>[]; rowCount: number }> {
    await new Promise(r => setTimeout(r, 150));
    const clean = sql.trim().toLowerCase();

    for (const table of POSTGRES_TABLES) {
      if (clean.includes(table.name.toLowerCase())) {
        return {
          rows: [...table.rows],
          rowCount: table.rows.length,
        };
      }
    }

    return {
      rows: [...POSTGRES_TABLES[1].rows],
      rowCount: POSTGRES_TABLES[1].rows.length,
    };
  }

  /**
   * Converts selected mock PostgreSQL tables into InsightHub Table instances
   * and generates relational model links automatically.
   */
  public importTables(selectedTableNames: string[] = []): {
    tables: Table[];
    relationships: Relationship[];
  } {
    const tablesToImport = POSTGRES_TABLES.filter(t =>
      selectedTableNames.length === 0 || selectedTableNames.includes(t.name)
    );

    const tables: Table[] = tablesToImport.map((t, idx) => {
      const columns: Column[] = t.columns.map(c => ({
        id: `col_${t.name}_${c.name}`,
        name: c.name,
        originalName: c.name,
        dataType: c.biType,
        description: `${c.description} [PostgreSQL: ${c.pgType}]`,
      }));

      return {
        id: t.name,
        name: t.name,
        originalName: t.name,
        columns,
        rows: JSON.parse(JSON.stringify(t.rows)),
        isDim: t.name === 'pg_clientes' || t.name === 'pg_estoque_armazem',
        x: 40 + (idx % 2) * 360,
        y: 40 + Math.floor(idx / 2) * 280,
      };
    });

    // Auto-create relationships between imported tables if both sides exist
    const importedNames = new Set(tables.map(t => t.name));
    const relationships: Relationship[] = [];

    if (importedNames.has('pg_clientes') && importedNames.has('pg_pedidos')) {
      relationships.push({
        id: 'rel_pg_clientes_pedidos',
        fromTable: 'pg_clientes',
        fromColumn: 'id_cliente',
        toTable: 'pg_pedidos',
        toColumn: 'id_cliente',
        cardinality: '1:N',
        crossFilterDirection: 'both',
        isActive: true,
      });
    }

    if (importedNames.has('pg_pedidos') && importedNames.has('pg_itens_pedido')) {
      relationships.push({
        id: 'rel_pg_pedidos_itens',
        fromTable: 'pg_pedidos',
        fromColumn: 'id_pedido',
        toTable: 'pg_itens_pedido',
        toColumn: 'id_pedido',
        cardinality: '1:N',
        crossFilterDirection: 'both',
        isActive: true,
      });
    }

    return { tables, relationships };
  }
}

export const postgresMockConnector = new PostgresMockConnector();
