import { Table, Relationship, Measure } from '../types/bi';
import { validateDateTable } from '../engine/model/dateTable';

export function generateCalendarTable(
  startDate = '2025-01-01',
  endDate = '2026-12-31',
  fiscalYearEndMonth = 12
): Table {
  const rows: Record<string, any>[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  const current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;
    const day = current.getDate();
    const dayOfWeek = current.getDay();
    const quarter = Math.ceil(month / 3);
    const dateStr = current.toISOString().split('T')[0];
    const anoMes = `${year}-${month < 10 ? '0' : ''}${month}`;

    rows.push({
      Data: dateStr,
      Ano: year,
      Trimestre: `T${quarter}`,
      Mes: month,
      NomeMes: monthNames[month - 1],
      Dia: day,
      DiaSemana: dayNames[dayOfWeek],
      AnoMes: anoMes,
    });

    current.setDate(current.getDate() + 1);
  }

  const table: Table = {
    id: 'd_Calendario',
    name: 'd_Calendario',
    originalName: 'd_Calendario',
    isCalendar: true,
    calendarDateColumn: 'Data',
    fiscalYearEndMonth: fiscalYearEndMonth || 12,
    autoDateTimeEnabled: false,
    isDim: true,
    x: 40,
    y: 40,
    columns: [
      { id: 'c_data', name: 'Data', originalName: 'Data', dataType: 'date' },
      { id: 'c_ano', name: 'Ano', originalName: 'Ano', dataType: 'number' },
      { id: 'c_tri', name: 'Trimestre', originalName: 'Trimestre', dataType: 'text' },
      { id: 'c_mes', name: 'Mes', originalName: 'Mes', dataType: 'number' },
      { id: 'c_nomemes', name: 'NomeMes', originalName: 'NomeMes', dataType: 'text' },
      { id: 'c_dia', name: 'Dia', originalName: 'Dia', dataType: 'number' },
      { id: 'c_diasemana', name: 'DiaSemana', originalName: 'DiaSemana', dataType: 'text' },
      { id: 'c_anomes', name: 'AnoMes', originalName: 'AnoMes', dataType: 'text' },
    ],
    rows,
  };

  table.calendarDiagnostics = validateDateTable(table, 'Data');
  return table;
}

export function getSampleDatasets(): { tables: Table[]; relationships: Relationship[]; measures: Measure[] } {
  // 1. Clientes Dimension
  const clientesRows = [
    { ID_Cliente: 101, Nome: 'TechSul Soluções', Segmento: 'Enterprise', Cidade: 'Curitiba', Estado: 'PR', LimiteCredito: 150000 },
    { ID_Cliente: 102, Nome: 'Varejo Paulistano', Segmento: 'Médio Porte', Cidade: 'São Paulo', Estado: 'SP', LimiteCredito: 85000 },
    { ID_Cliente: 103, Nome: 'Minas Log & Distribuição', Segmento: 'Enterprise', Cidade: 'Belo Horizonte', Estado: 'MG', LimiteCredito: 220000 },
    { ID_Cliente: 104, Nome: 'Comércio Carioca S/A', Segmento: 'Enterprise', Cidade: 'Rio de Janeiro', Estado: 'RJ', LimiteCredito: 180000 },
    { ID_Cliente: 105, Nome: 'Sul Distribuidora', Segmento: 'Médio Porte', Cidade: 'Porto Alegre', Estado: 'RS', LimiteCredito: 95000 },
    { ID_Cliente: 106, Nome: 'Bahia Atacado Norte', Segmento: 'Pequena Empresa', Cidade: 'Salvador', Estado: 'BA', LimiteCredito: 45000 },
    { ID_Cliente: 107, Nome: 'Planalto Suprimentos', Segmento: 'Enterprise', Cidade: 'Brasília', Estado: 'DF', LimiteCredito: 310000 },
    { ID_Cliente: 108, Nome: 'Campinas Tech Store', Segmento: 'Pequena Empresa', Cidade: 'Campinas', Estado: 'SP', LimiteCredito: 60000 },
  ];

  const dClientes: Table = {
    id: 'd_Clientes',
    name: 'd_Clientes',
    originalName: 'd_Clientes',
    isDim: true,
    x: 40,
    y: 340,
    columns: [
      { id: 'c_id_cli', name: 'ID_Cliente', originalName: 'ID_Cliente', dataType: 'number' },
      { id: 'c_nome_cli', name: 'Nome', originalName: 'Nome', dataType: 'text' },
      { id: 'c_seg_cli', name: 'Segmento', originalName: 'Segmento', dataType: 'text' },
      { id: 'c_cid_cli', name: 'Cidade', originalName: 'Cidade', dataType: 'text', dataCategory: 'city' },
      { id: 'c_est_cli', name: 'Estado', originalName: 'Estado', dataType: 'text', dataCategory: 'state' },
      { id: 'c_lim_cli', name: 'LimiteCredito', originalName: 'LimiteCredito', dataType: 'currency' },
    ],
    rows: clientesRows,
  };

  // 2. Vendas Fact
  const categorias = ['Eletrônicos', 'Mobiliário', 'Alimentos & Bebidas', 'Moda & Uniformes', 'Serviços Cloud'];
  const produtos = [
    { nome: 'Servidor Rack 2U', cat: 'Eletrônicos', preco: 14500, custo: 9200 },
    { nome: 'Workstation Pro', cat: 'Eletrônicos', preco: 8200, custo: 5400 },
    { nome: 'Mesa Executiva L', cat: 'Mobiliário', preco: 2400, custo: 1350 },
    { nome: 'Cadeira Ergonômica', cat: 'Mobiliário', preco: 1650, custo: 890 },
    { nome: 'Kit Café Gourmet 50kg', cat: 'Alimentos & Bebidas', preco: 1850, custo: 1100 },
    { nome: 'Uniformes Linha Pro', cat: 'Moda & Uniformes', preco: 980, custo: 480 },
    { nome: 'Plano Cloud Enterprise', cat: 'Serviços Cloud', preco: 5200, custo: 1950 },
  ];
  const vendedores = ['Ana Martins', 'Bruno Silveira', 'Camila Santos', 'Diego Ferreira', 'Eduarda Souza'];
  const canais = ['E-commerce B2B', 'Venda Direta', 'Representantes', 'Parceiros'];

  const vendasRows: Record<string, any>[] = [];
  const baseDate = new Date('2025-01-05');
  let vendaId = 1001;

  for (let i = 0; i < 90; i++) {
    const curDate = new Date(baseDate.getTime() + i * 2.8 * 86400000);
    const dateStr = curDate.toISOString().split('T')[0];
    const p = produtos[i % produtos.length];
    const cli = clientesRows[i % clientesRows.length];
    const vend = vendedores[i % vendedores.length];
    const canal = canais[i % canais.length];
    const qtd = ((i * 7) % 8) + 1;
    const desconto = (i % 5 === 0) ? 0.1 : (i % 7 === 0) ? 0.05 : 0;
    const valorBruto = p.preco * qtd;
    const valorTotal = Math.round(valorBruto * (1 - desconto));
    const custoTotal = p.custo * qtd;
    const margemLucro = valorTotal - custoTotal;

    vendasRows.push({
      ID_Venda: vendaId++,
      Data: dateStr,
      Ano: curDate.getFullYear(),
      Mes: curDate.getMonth() + 1,
      ID_Cliente: cli.ID_Cliente,
      Cliente: cli.Nome,
      Estado: cli.Estado,
      Regiao: ['SP', 'RJ', 'MG'].includes(cli.Estado) ? 'Sudeste' : ['PR', 'RS'].includes(cli.Estado) ? 'Sul' : cli.Estado === 'BA' ? 'Nordeste' : 'Centro-Oeste',
      Categoria: p.cat,
      Produto: p.nome,
      Vendedor: vend,
      Canal: canal,
      Quantidade: qtd,
      PrecoUnitario: p.preco,
      ValorTotal: valorTotal,
      CustoTotal: custoTotal,
      MargemLucro: margemLucro,
      MargemPercentual: Number(((margemLucro / valorTotal) * 100).toFixed(1)),
      StatusEntrega: i % 11 === 0 ? 'Em Trânsito' : 'Entregue',
    });
  }

  const fVendas: Table = {
    id: 'f_Vendas',
    name: 'f_Vendas',
    originalName: 'f_Vendas',
    isDim: false,
    x: 320,
    y: 120,
    columns: [
      { id: 'v_id', name: 'ID_Venda', originalName: 'ID_Venda', dataType: 'number' },
      { id: 'v_data', name: 'Data', originalName: 'Data', dataType: 'date' },
      { id: 'v_cli_id', name: 'ID_Cliente', originalName: 'ID_Cliente', dataType: 'number' },
      { id: 'v_cli', name: 'Cliente', originalName: 'Cliente', dataType: 'text' },
      { id: 'v_est', name: 'Estado', originalName: 'Estado', dataType: 'text' },
      { id: 'v_reg', name: 'Regiao', originalName: 'Regiao', dataType: 'text' },
      { id: 'v_cat', name: 'Categoria', originalName: 'Categoria', dataType: 'text' },
      { id: 'v_prod', name: 'Produto', originalName: 'Produto', dataType: 'text' },
      { id: 'v_vend', name: 'Vendedor', originalName: 'Vendedor', dataType: 'text' },
      { id: 'v_canal', name: 'Canal', originalName: 'Canal', dataType: 'text' },
      { id: 'v_qtd', name: 'Quantidade', originalName: 'Quantidade', dataType: 'number' },
      { id: 'v_preco', name: 'PrecoUnitario', originalName: 'PrecoUnitario', dataType: 'currency' },
      { id: 'v_valtot', name: 'ValorTotal', originalName: 'ValorTotal', dataType: 'currency' },
      { id: 'v_custotot', name: 'CustoTotal', originalName: 'CustoTotal', dataType: 'currency' },
      { id: 'v_margem', name: 'MargemLucro', originalName: 'MargemLucro', dataType: 'currency' },
      { id: 'v_margempct', name: 'MargemPercentual', originalName: 'MargemPercentual', dataType: 'percentage' },
      { id: 'v_status', name: 'StatusEntrega', originalName: 'StatusEntrega', dataType: 'text' },
    ],
    rows: vendasRows,
  };

  // 3. DRE Financeiro (Resultado Operacional, Resultado Líquido Contábil, Investimentos)
  const dreMonths = [
    { mes: 1, nome: 'Jan/25' }, { mes: 2, nome: 'Fev/25' }, { mes: 3, nome: 'Mar/25' },
    { mes: 4, nome: 'Abr/25' }, { mes: 5, nome: 'Mai/25' }, { mes: 6, nome: 'Jun/25' },
    { mes: 7, nome: 'Jul/25' }, { mes: 8, nome: 'Ago/25' }, { mes: 9, nome: 'Set/25' },
    { mes: 10, nome: 'Out/25' }, { mes: 11, nome: 'Nov/25' }, { mes: 12, nome: 'Dez/25' },
  ];

  const dreRows: Record<string, any>[] = [];
  let dreId = 1;

  dreMonths.forEach(m => {
    const recBruta = 420000 + m.mes * 18500;
    const deducoes = Math.round(recBruta * 0.12);
    const recLiquida = recBruta - deducoes;
    const cmv = Math.round(recLiquida * 0.48);
    const margemContrib = recLiquida - cmv;
    const despOper = 68000 + m.mes * 1200;
    const ebitda = margemContrib - despOper;
    const depAmort = 14500;
    const resOperacionalEbit = ebitda - depAmort;
    const resFinanceiro = -9800; // juros/despesas bancárias
    const impostosIrCsll = Math.round((resOperacionalEbit + resFinanceiro) * 0.15);
    const resultadoLiquido = resOperacionalEbit + resFinanceiro - impostosIrCsll;
    const capexInvestimento = 25000 + (m.mes % 3 === 0 ? 35000 : 0);

    const contas = [
      { tipo: 'Resultado Operacional', conta: '1. Receita Bruta de Vendas', val: recBruta, orc: recBruta * 0.95 },
      { tipo: 'Resultado Operacional', conta: '2. (-) Deduções e Impostos', val: -deducoes, orc: -deducoes * 0.95 },
      { tipo: 'Resultado Operacional', conta: '3. (=) Receita Operacional Líquida', val: recLiquida, orc: recLiquida * 0.95 },
      { tipo: 'Resultado Operacional', conta: '4. (-) Custos Mercadorias (CMV)', val: -cmv, orc: -cmv * 1.02 },
      { tipo: 'Resultado Operacional', conta: '5. (=) Margem de Contribuição', val: margemContrib, orc: margemContrib * 0.92 },
      { tipo: 'Resultado Operacional', conta: '6. (-) Despesas Fixas & Comerciais', val: -despOper, orc: -despOper * 0.98 },
      { tipo: 'Resultado Operacional', conta: '7. (=) EBITDA (LAJIDA)', val: ebitda, orc: ebitda * 0.90 },
      { tipo: 'Resultado Líquido Contábil', conta: '8. (-) Depreciação e Amortização', val: -depAmort, orc: -depAmort },
      { tipo: 'Resultado Líquido Contábil', conta: '9. (+/-) Resultado Financeiro Líquido', val: resFinanceiro, orc: -11000 },
      { tipo: 'Resultado Líquido Contábil', conta: '10. (=) Lucro Líquido do Exercício', val: resultadoLiquido, orc: resultadoLiquido * 0.88 },
      { tipo: 'Investimento / Financiamento', conta: '11. CAPEX / Modernização Ativos', val: -capexInvestimento, orc: -30000 },
    ];

    contas.forEach(c => {
      dreRows.push({
        ID_DRE: dreId++,
        Mes: m.mes,
        NomeMes: m.nome,
        TipoResultado: c.tipo,
        ContaDRE: c.conta,
        ValorRealizado: c.val,
        ValorOrcado: Math.round(c.orc),
        DesvioOrcamento: Math.round(c.val - c.orc),
        AtingimentoPct: Number(((c.val / c.orc) * 100).toFixed(1)),
      });
    });
  });

  const fDRE: Table = {
    id: 'f_DRE',
    name: 'f_DRE_Financeiro',
    originalName: 'f_DRE_Financeiro',
    isDim: false,
    x: 600,
    y: 80,
    columns: [
      { id: 'd_id', name: 'ID_DRE', originalName: 'ID_DRE', dataType: 'number' },
      { id: 'd_mes', name: 'Mes', originalName: 'Mes', dataType: 'number' },
      { id: 'd_nomemes', name: 'NomeMes', originalName: 'NomeMes', dataType: 'text' },
      { id: 'd_tipo', name: 'TipoResultado', originalName: 'TipoResultado', dataType: 'text' },
      { id: 'd_conta', name: 'ContaDRE', originalName: 'ContaDRE', dataType: 'text' },
      { id: 'd_real', name: 'ValorRealizado', originalName: 'ValorRealizado', dataType: 'currency' },
      { id: 'd_orc', name: 'ValorOrcado', originalName: 'ValorOrcado', dataType: 'currency' },
      { id: 'd_desv', name: 'DesvioOrcamento', originalName: 'DesvioOrcamento', dataType: 'currency' },
      { id: 'd_ating', name: 'AtingimentoPct', originalName: 'AtingimentoPct', dataType: 'percentage' },
    ],
    rows: dreRows,
  };

  // 4. Logística & Frota
  const motoristas = ['Carlos Silva', 'Marcos Rocha', 'Juliana Lima', 'Roberto Alves', 'Fernando Souza'];
  const veiculos = [
    { placa: 'BRA-2E19', tipo: 'Carreta Bitrem' },
    { placa: 'RPO-9J42', tipo: 'Toco Baú' },
    { placa: 'SPX-3K81', tipo: 'VUC Urbano' },
    { placa: 'MGZ-4M10', tipo: 'Van Carga' },
  ];
  const rotas = [
    { rota: 'São Paulo -> Rio de Janeiro', km: 435 },
    { rota: 'São Paulo -> Belo Horizonte', km: 586 },
    { rota: 'Curitiba -> São Paulo', km: 408 },
    { rota: 'Goiânia -> Brasília', km: 209 },
    { rota: 'Salvador -> Aracaju', km: 356 },
  ];

  const logisticaRows: Record<string, any>[] = [];
  let logId = 5001;

  for (let i = 0; i < 60; i++) {
    const mot = motoristas[i % motoristas.length];
    const veic = veiculos[i % veiculos.length];
    const r = rotas[i % rotas.length];
    const litros = Math.round(r.km / (veic.tipo.includes('Carreta') ? 2.3 : veic.tipo.includes('Toco') ? 3.8 : 7.2));
    const custoCombustivel = Math.round(litros * 6.15); // R$ 6.15/L
    const pedagios = Math.round((r.km / 65) * 18.5);
    const manutencao = (i % 4 === 0) ? 650 : 120;
    const custoTotal = custoCombustivel + pedagios + manutencao;
    const receitaFrete = Math.round(custoTotal * 1.55 + (r.km * 2.8));
    const margem = receitaFrete - custoTotal;
    const custoPorKm = Number((custoTotal / r.km).toFixed(2));

    logisticaRows.push({
      ID_Viagem: logId++,
      Data: new Date(2025, 0, 1 + i * 4).toISOString().split('T')[0],
      Motorista: mot,
      PlacaVeiculo: veic.placa,
      TipoVeiculo: veic.tipo,
      Rota: r.rota,
      KmRodado: r.km,
      LitrosCombustivel: litros,
      GastoCombustivel: custoCombustivel,
      Pedagios: pedagios,
      CustoManutencao: manutencao,
      CustoTotalViagem: custoTotal,
      ReceitaFrete: receitaFrete,
      MargemFrete: margem,
      CustoPorKm: custoPorKm,
    });
  }

  const fLogistica: Table = {
    id: 'f_Logistica',
    name: 'f_Logistica',
    originalName: 'f_Logistica',
    isDim: false,
    x: 620,
    y: 380,
    columns: [
      { id: 'l_id', name: 'ID_Viagem', originalName: 'ID_Viagem', dataType: 'number' },
      { id: 'l_data', name: 'Data', originalName: 'Data', dataType: 'date' },
      { id: 'l_mot', name: 'Motorista', originalName: 'Motorista', dataType: 'text' },
      { id: 'l_placa', name: 'PlacaVeiculo', originalName: 'PlacaVeiculo', dataType: 'text' },
      { id: 'l_tipo', name: 'TipoVeiculo', originalName: 'TipoVeiculo', dataType: 'text' },
      { id: 'l_rota', name: 'Rota', originalName: 'Rota', dataType: 'text' },
      { id: 'l_km', name: 'KmRodado', originalName: 'KmRodado', dataType: 'number' },
      { id: 'l_litros', name: 'LitrosCombustivel', originalName: 'LitrosCombustivel', dataType: 'number' },
      { id: 'l_comb', name: 'GastoCombustivel', originalName: 'GastoCombustivel', dataType: 'currency' },
      { id: 'l_ped', name: 'Pedagios', originalName: 'Pedagios', dataType: 'currency' },
      { id: 'l_manut', name: 'CustoManutencao', originalName: 'CustoManutencao', dataType: 'currency' },
      { id: 'l_custo', name: 'CustoTotalViagem', originalName: 'CustoTotalViagem', dataType: 'currency' },
      { id: 'l_rec', name: 'ReceitaFrete', originalName: 'ReceitaFrete', dataType: 'currency' },
      { id: 'l_margem', name: 'MargemFrete', originalName: 'MargemFrete', dataType: 'currency' },
      { id: 'l_custokm', name: 'CustoPorKm', originalName: 'CustoPorKm', dataType: 'currency' },
    ],
    rows: logisticaRows,
  };

  // 5. RH & Pessoas
  const departamentos = ['Tecnologia', 'Comercial', 'Operações & Logística', 'Financeiro & Jurídico', 'RH'];
  const rhRows: Record<string, any>[] = [];
  let rhId = 1;

  for (let m = 1; m <= 12; m++) {
    departamentos.forEach(dept => {
      const baseHeadcount = dept === 'Operações & Logística' ? 85 : dept === 'Comercial' ? 42 : dept === 'Tecnologia' ? 38 : dept === 'Financeiro & Jurídico' ? 18 : 12;
      const hc = baseHeadcount + Math.floor(Math.sin(m) * 3);
      const adm = m % 2 === 0 ? 3 : 1;
      const dem = m % 3 === 0 ? 2 : 0;
      const turnover = Number((((adm + dem) / (2 * hc)) * 100).toFixed(1));
      const horasExtras = Math.round(hc * (dept === 'Operações & Logística' ? 14.5 : 4.2));
      const absenteismo = Number(((Math.random() * 2 + 1.2)).toFixed(1));

      rhRows.push({
        ID_RH: rhId++,
        Mes: m,
        NomeMes: dreMonths[m - 1].nome,
        Departamento: dept,
        Headcount: hc,
        Admissoes: adm,
        Demissoes: dem,
        TurnoverPct: turnover,
        HorasExtrasTotal: horasExtras,
        AbsenteismoPct: absenteismo,
      });
    });
  }

  const fRH: Table = {
    id: 'f_RH',
    name: 'f_RH_Metricas',
    originalName: 'f_RH_Metricas',
    isDim: false,
    x: 880,
    y: 220,
    columns: [
      { id: 'rh_id', name: 'ID_RH', originalName: 'ID_RH', dataType: 'number' },
      { id: 'rh_mes', name: 'Mes', originalName: 'Mes', dataType: 'number' },
      { id: 'rh_nomemes', name: 'NomeMes', originalName: 'NomeMes', dataType: 'text' },
      { id: 'rh_dept', name: 'Departamento', originalName: 'Departamento', dataType: 'text' },
      { id: 'rh_hc', name: 'Headcount', originalName: 'Headcount', dataType: 'number' },
      { id: 'rh_adm', name: 'Admissoes', originalName: 'Admissoes', dataType: 'number' },
      { id: 'rh_dem', name: 'Demissoes', originalName: 'Demissoes', dataType: 'number' },
      { id: 'rh_turnover', name: 'TurnoverPct', originalName: 'TurnoverPct', dataType: 'percentage' },
      { id: 'rh_he', name: 'HorasExtrasTotal', originalName: 'HorasExtrasTotal', dataType: 'number' },
      { id: 'rh_abs', name: 'AbsenteismoPct', originalName: 'AbsenteismoPct', dataType: 'percentage' },
    ],
    rows: rhRows,
  };

  const dCalendario = generateCalendarTable('2025-01-01', '2025-12-31');

  // Relationships
  const relationships: Relationship[] = [
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
      crossFilterDirection: 'single',
      isActive: true,
    },
    {
      id: 'rel_logistica_calendario',
      fromTable: 'f_Logistica',
      fromColumn: 'Data',
      toTable: 'd_Calendario',
      toColumn: 'Data',
      cardinality: 'N:1',
      crossFilterDirection: 'single',
      isActive: true,
    },
  ];

  // Pre-configured DAX Measures
  const measures: Measure[] = [
    {
      id: 'm_fat_total',
      name: 'Faturamento Total',
      tableName: 'f_Vendas',
      formula: 'SUM(f_Vendas[ValorTotal])',
      format: 'currency',
      description: 'Soma total dos valores transacionados de vendas em reais',
      displayFolder: 'Comercial',
    },
    {
      id: 'm_custo_total',
      name: 'Custo Total Mercadorias',
      tableName: 'f_Vendas',
      formula: 'SUM(f_Vendas[CustoTotal])',
      format: 'currency',
      description: 'Custo total de aquisição/fabricação',
      displayFolder: 'Comercial',
    },
    {
      id: 'm_margem_lucro',
      name: 'Lucro Bruto',
      tableName: 'f_Vendas',
      formula: '[Faturamento Total] - [Custo Total Mercadorias]',
      format: 'currency',
      description: 'Margem de lucro bruta realizada',
      displayFolder: 'Comercial',
    },
    {
      id: 'm_margem_pct',
      name: 'Margem Bruta %',
      tableName: 'f_Vendas',
      formula: 'DIVIDE([Lucro Bruto], [Faturamento Total], 0)',
      format: 'percentage',
      description: 'Percentual de margem de contribuição sobre receita',
      displayFolder: 'Comercial',
    },
    {
      id: 'm_ticket_medio',
      name: 'Ticket Médio',
      tableName: 'f_Vendas',
      formula: 'DIVIDE([Faturamento Total], COUNTROWS(f_Vendas), 0)',
      format: 'currency',
      description: 'Valor médio por transação de venda',
      displayFolder: 'Comercial',
    },
    {
      id: 'm_faturamento_ytd',
      name: 'Faturamento YTD',
      tableName: 'f_Vendas',
      formula: 'TOTALYTD([Faturamento Total], d_Calendario[Data])',
      format: 'currency',
      description: 'Faturamento acumulado no ano atual',
      displayFolder: 'Inteligência Temporal',
    },
    {
      id: 'm_faturamento_ano_anterior',
      name: 'Faturamento Ano Anterior',
      tableName: 'f_Vendas',
      formula: 'CALCULATE([Faturamento Total], SAMEPERIODLASTYEAR(d_Calendario[Data]))',
      format: 'currency',
      description: 'Faturamento no mesmo período do ano anterior para comparação YoY',
      displayFolder: 'Inteligência Temporal',
    },
    {
      id: 'm_crescimento_yoy',
      name: 'Crescimento YoY %',
      tableName: 'f_Vendas',
      formula: 'DIVIDE([Faturamento Total] - [Faturamento Ano Anterior], [Faturamento Ano Anterior], 0)',
      format: 'percentage',
      description: 'Variação percentual ano a ano',
      displayFolder: 'Inteligência Temporal',
    },
    {
      id: 'm_ebitda_total',
      name: 'EBITDA Realizado',
      tableName: 'f_DRE',
      formula: 'CALCULATE(SUM(f_DRE[ValorRealizado]), f_DRE[ContaDRE] = "7. (=) EBITDA (LAJIDA)")',
      format: 'currency',
      description: 'EBITDA operacional acumulado',
      displayFolder: 'Controladoria & DRE',
    },
    {
      id: 'm_custo_medio_km',
      name: 'Custo Médio por Km',
      tableName: 'f_Logistica',
      formula: 'DIVIDE(SUM(f_Logistica[CustoTotalViagem]), SUM(f_Logistica[KmRodado]), 0)',
      format: 'currency',
      description: 'Eficiência de frete: Custo total dividido por quilômetros rodados',
      displayFolder: 'Logística',
    },
    {
      id: 'm_headcount_total',
      name: 'Headcount Médio',
      tableName: 'f_RH',
      formula: 'AVERAGE(f_RH[Headcount])',
      format: 'number',
      description: 'Média de colaboradores ativos no período',
      displayFolder: 'RH & Pessoas',
    },
  ];

  return {
    tables: [fVendas, dClientes, fDRE, fLogistica, fRH, dCalendario],
    relationships,
    measures,
  };
}
