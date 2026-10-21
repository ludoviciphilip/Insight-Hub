import { Table, Relationship, Measure } from '../../../types/bi';

export function createMockDataset(): {
  tables: Table[];
  relationships: Relationship[];
  measures: Measure[];
} {
  const d_Produtos: Table = {
    id: 'd_Produtos',
    name: 'd_Produtos',
    originalName: 'd_Produtos',
    columns: [
      { id: 'p1', name: 'ID_Produto', originalName: 'ID_Produto', dataType: 'text' },
      { id: 'p2', name: 'NomeProduto', originalName: 'NomeProduto', dataType: 'text' },
      { id: 'p3', name: 'Categoria', originalName: 'Categoria', dataType: 'text' },
      { id: 'p4', name: 'PrecoUnitario', originalName: 'PrecoUnitario', dataType: 'currency' },
    ],
    rows: [
      { ID_Produto: 'P001', NomeProduto: 'Notebook Pro 16', Categoria: 'Eletrônicos', PrecoUnitario: 8500.0 },
      { ID_Produto: 'P002', NomeProduto: 'Monitor Ultrawide 34', Categoria: 'Eletrônicos', PrecoUnitario: 3200.0 },
      { ID_Produto: 'P003', NomeProduto: 'Cadeira Ergonômica', Categoria: 'Móveis', PrecoUnitario: 1450.0 },
      { ID_Produto: 'P004', NomeProduto: 'Mesa Elevatória', Categoria: 'Móveis', PrecoUnitario: 2890.0 },
    ],
  };

  const d_Clientes: Table = {
    id: 'd_Clientes',
    name: 'd_Clientes',
    originalName: 'd_Clientes',
    columns: [
      { id: 'c1', name: 'ID_Cliente', originalName: 'ID_Cliente', dataType: 'text' },
      { id: 'c2', name: 'NomeCliente', originalName: 'NomeCliente', dataType: 'text' },
      { id: 'c3', name: 'Estado', originalName: 'Estado', dataType: 'text' },
      { id: 'c4', name: 'Regiao', originalName: 'Regiao', dataType: 'text' },
    ],
    rows: [
      { ID_Cliente: 'C001', NomeCliente: 'TechCorp Brasil', Estado: 'SP', Regiao: 'Sudeste' },
      { ID_Cliente: 'C002', NomeCliente: 'SulLog Transportes', Estado: 'RS', Regiao: 'Sul' },
      { ID_Cliente: 'C003', NomeCliente: 'Minas Telecom', Estado: 'MG', Regiao: 'Sudeste' },
      { ID_Cliente: 'C004', NomeCliente: 'Nordeste Varejo', Estado: 'BA', Regiao: 'Nordeste' },
    ],
  };

  const d_Calendario: Table = {
    id: 'd_Calendario',
    name: 'd_Calendario',
    originalName: 'd_Calendario',
    columns: [
      { id: 'cal1', name: 'Data', originalName: 'Data', dataType: 'date' },
      { id: 'cal2', name: 'Ano', originalName: 'Ano', dataType: 'number' },
      { id: 'cal3', name: 'Mes', originalName: 'Mes', dataType: 'number' },
      { id: 'cal4', name: 'NomeMes', originalName: 'NomeMes', dataType: 'text' },
    ],
    rows: [
      { Data: '2025-01-15', Ano: 2025, Mes: 1, NomeMes: 'Janeiro' },
      { Data: '2025-02-10', Ano: 2025, Mes: 2, NomeMes: 'Fevereiro' },
      { Data: '2025-03-20', Ano: 2025, Mes: 3, NomeMes: 'Março' },
    ],
  };

  const f_Vendas: Table = {
    id: 'f_Vendas',
    name: 'f_Vendas',
    originalName: 'f_Vendas',
    columns: [
      { id: 'v1', name: 'ID_Venda', originalName: 'ID_Venda', dataType: 'text' },
      { id: 'v2', name: 'ID_Produto', originalName: 'ID_Produto', dataType: 'text' },
      { id: 'v3', name: 'ID_Cliente', originalName: 'ID_Cliente', dataType: 'text' },
      { id: 'v4', name: 'Data', originalName: 'Data', dataType: 'date' },
      { id: 'v5', name: 'Quantidade', originalName: 'Quantidade', dataType: 'number' },
      { id: 'v6', name: 'ValorTotal', originalName: 'ValorTotal', dataType: 'currency' },
    ],
    rows: [
      { ID_Venda: 'V001', ID_Produto: 'P001', ID_Cliente: 'C001', Data: '2025-01-15', Quantidade: 2, ValorTotal: 17000.0 },
      { ID_Venda: 'V002', ID_Produto: 'P002', ID_Cliente: 'C002', Data: '2025-01-15', Quantidade: 1, ValorTotal: 3200.0 },
      { ID_Venda: 'V003', ID_Produto: 'P003', ID_Cliente: 'C003', Data: '2025-02-10', Quantidade: 4, ValorTotal: 5800.0 },
      { ID_Venda: 'V004', ID_Produto: 'P004', ID_Cliente: 'C001', Data: '2025-03-20', Quantidade: 1, ValorTotal: 2890.0 },
    ],
  };

  const f_Logistica: Table = {
    id: 'f_Logistica',
    name: 'f_Logistica',
    originalName: 'f_Logistica',
    columns: [
      { id: 'l1', name: 'ID_Viagem', originalName: 'ID_Viagem', dataType: 'text' },
      { id: 'l2', name: 'Motorista', originalName: 'Motorista', dataType: 'text' },
      { id: 'l3', name: 'Rota', originalName: 'Rota', dataType: 'text' },
      { id: 'l4', name: 'KmRodado', originalName: 'KmRodado', dataType: 'number' },
      { id: 'l5', name: 'CustoTotalViagem', originalName: 'CustoTotalViagem', dataType: 'currency' },
    ],
    rows: [
      { ID_Viagem: 'TR01', Motorista: 'Carlos Silva', Rota: 'SP -> RJ', KmRodado: 430, CustoTotalViagem: 1250.0 },
      { ID_Viagem: 'TR02', Motorista: 'Marcos Souza', Rota: 'SP -> Curitiba', KmRodado: 410, CustoTotalViagem: 1100.0 },
      { ID_Viagem: 'TR03', Motorista: 'Roberto Lima', Rota: 'BH -> SP', KmRodado: 580, CustoTotalViagem: 1680.0 },
    ],
  };

  const relationships: Relationship[] = [
    {
      id: 'rel_vendas_produtos',
      fromTable: 'f_Vendas',
      fromColumn: 'ID_Produto',
      toTable: 'd_Produtos',
      toColumn: 'ID_Produto',
      cardinality: 'N:1',
      crossFilterDirection: 'both',
      isActive: true,
    },
    {
      id: 'rel_vendas_clientes',
      fromTable: 'f_Vendas',
      fromColumn: 'ID_Cliente',
      toTable: 'd_Clientes',
      toColumn: 'ID_Cliente',
      cardinality: 'N:1',
      crossFilterDirection: 'both',
      isActive: true,
    },
    {
      id: 'rel_vendas_calendario',
      fromTable: 'f_Vendas',
      fromColumn: 'Data',
      toTable: 'd_Calendario',
      toColumn: 'Data',
      cardinality: 'N:1',
      crossFilterDirection: 'both',
      isActive: true,
    },
  ];

  const measures: Measure[] = [
    {
      id: 'm_fat',
      name: 'Faturamento Total',
      tableName: 'f_Vendas',
      formula: 'SUM(f_Vendas[ValorTotal])',
      format: 'currency',
    },
    {
      id: 'm_qtd',
      name: 'Quantidade Total',
      tableName: 'f_Vendas',
      formula: 'SUM(f_Vendas[Quantidade])',
      format: 'number',
    },
    {
      id: 'm_ticket',
      name: 'Ticket Médio',
      tableName: 'f_Vendas',
      formula: 'DIVIDE([Faturamento Total], [Quantidade Total], 0)',
      format: 'currency',
    },
  ];

  return {
    tables: [d_Produtos, d_Clientes, d_Calendario, f_Vendas, f_Logistica],
    relationships,
    measures,
  };
}
