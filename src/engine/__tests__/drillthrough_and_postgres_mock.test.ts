import { describe, it, expect, beforeEach } from 'vitest';
import { postgresMockConnector, POSTGRES_TABLES } from '../../adapters/postgresMockAdapter';
import { useBiStore } from '../../store/useBiStore';

describe('PostgresMockConnector', () => {
  it('correctly reports itself as a mock connection with clear indicators', () => {
    expect(postgresMockConnector.isMock).toBe(true);
    expect(postgresMockConnector.defaultDatabase).toBe('enterprise_dw');
    expect(postgresMockConnector.defaultPort).toBe(5432);
  });

  it('provides realistic connection testing with diagnostic information', async () => {
    const res = await postgresMockConnector.testConnection();
    expect(res.success).toBe(true);
    expect(res.diagnostics.isMock).toBe(true);
    expect(res.diagnostics.mockNotice).toContain('Ambiente demonstrativo');
    expect(res.diagnostics.version).toContain('PostgreSQL 16.2');
    expect(res.latencyMs).toBeGreaterThan(0);
    expect(res.diagnostics.tablesCount).toBe(4);
  });

  it('exposes a predefined schema with primary keys, foreign keys and typed columns', () => {
    const schema = postgresMockConnector.getSchema();
    expect(schema.length).toBe(4);

    const pedidosTable = schema.find(t => t.name === 'pg_pedidos');
    expect(pedidosTable).toBeDefined();
    expect(pedidosTable?.schema).toBe('public');

    const idPedidoCol = pedidosTable?.columns.find(c => c.name === 'id_pedido');
    expect(idPedidoCol?.isPrimary).toBe(true);
    expect(idPedidoCol?.pgType).toContain('SERIAL');

    const idClienteCol = pedidosTable?.columns.find(c => c.name === 'id_cliente');
    expect(idClienteCol?.isForeign).toBe(true);
    expect(idClienteCol?.foreignTable).toBe('pg_clientes');

    const valorLiquidoCol = pedidosTable?.columns.find(c => c.name === 'valor_liquido');
    expect(valorLiquidoCol?.biType).toBe('currency');
  });

  it('executes simulated queries and returns expected rows', async () => {
    const queryResult = await postgresMockConnector.executeQuery('SELECT * FROM public.pg_clientes;');
    expect(queryResult.rowCount).toBe(8);
    expect(queryResult.rows.length).toBe(8);
    expect(queryResult.rows[0].razao_social).toBeDefined();
    expect(queryResult.rows[0].cnpj).toBeDefined();
  });

  it('imports selected mock PostgreSQL tables into InsightHub data models and creates relationships', () => {
    const result = postgresMockConnector.importTables(['pg_clientes', 'pg_pedidos', 'pg_itens_pedido']);
    expect(result.tables.length).toBe(3);

    const clientes = result.tables.find(t => t.name === 'pg_clientes');
    const pedidos = result.tables.find(t => t.name === 'pg_pedidos');
    expect(clientes).toBeDefined();
    expect(pedidos).toBeDefined();
    expect(clientes?.rows.length).toBe(8);
    expect(pedidos?.rows.length).toBe(12);

    // Auto-generated relationships
    expect(result.relationships.length).toBe(2);
    const rel1 = result.relationships.find(r => r.fromTable === 'pg_clientes' && r.toTable === 'pg_pedidos');
    expect(rel1).toBeDefined();
    expect(rel1?.fromColumn).toBe('id_cliente');
    expect(rel1?.toColumn).toBe('id_cliente');
    expect(rel1?.isActive).toBe(true);
  });
});

describe('ReportView Drill-Through Feature', () => {
  beforeEach(() => {
    useBiStore.setState({
      activePageId: 'page_executivo',
      filters: [],
      activeDrillthrough: null,
    });
  });

  it('executes drill-through navigation and applies entity filter', () => {
    const store = useBiStore.getState();

    // Navigate to page_detalhes filtering by Categoria = 'Eletrônicos'
    store.executeDrillthrough('page_detalhes', 'Categoria', 'Eletrônicos', 'Faturamento por Categoria');

    const updated = useBiStore.getState();
    expect(updated.activePageId).toBe('page_detalhes');
    expect(updated.activeDrillthrough).toBeDefined();
    expect(updated.activeDrillthrough?.field).toBe('Categoria');
    expect(updated.activeDrillthrough?.value).toBe('Eletrônicos');
    expect(updated.activeDrillthrough?.sourcePageId).toBe('page_executivo');
    expect(updated.activeDrillthrough?.sourceVisualTitle).toBe('Faturamento por Categoria');

    // A drill filter was registered in the filters list
    const drillFilter = updated.filters.find(f => f.id.startsWith('drill_filter_'));
    expect(drillFilter).toBeDefined();
    expect(drillFilter?.column).toBe('Categoria');
    expect(drillFilter?.value).toBe('Eletrônicos');
    expect(drillFilter?.level).toBe('page');
  });

  it('clears drill-through filter and navigates back to source page', () => {
    const store = useBiStore.getState();

    store.executeDrillthrough('page_detalhes', 'Regiao', 'Sudeste', 'Distribuição Geográfica');
    expect(useBiStore.getState().activePageId).toBe('page_detalhes');

    // Click "Voltar" (clearDrillthrough with returnToSource = true)
    store.clearDrillthrough(true);

    const cleared = useBiStore.getState();
    expect(cleared.activePageId).toBe('page_executivo');
    expect(cleared.activeDrillthrough).toBeNull();
    const remainingDrillFilters = cleared.filters.filter(f => f.id.startsWith('drill_filter_'));
    expect(remainingDrillFilters.length).toBe(0);
  });

  it('allows clearing drill filter while staying on the detail page', () => {
    const store = useBiStore.getState();

    store.executeDrillthrough('page_detalhes', 'Vendedor', 'Lucas Martins', 'Top Vendedores');
    expect(useBiStore.getState().activePageId).toBe('page_detalhes');

    // Clear filter only without returning
    store.clearDrillthrough(false);

    const cleared = useBiStore.getState();
    expect(cleared.activePageId).toBe('page_detalhes');
    expect(cleared.activeDrillthrough).toBeNull();
    expect(cleared.filters.some(f => f.id.startsWith('drill_filter_'))).toBe(false);
  });
});
