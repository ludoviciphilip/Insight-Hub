import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Search,
  Code,
  Play,
  Save,
  Filter,
  BarChart,
  Layers,
  ArrowRight,
  Database,
  Table as TableIcon,
  CheckCircle,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { globalDataEngine, formatCurrency } from '../../engine/dataEngine';
import { globalDuckDb } from '../../engine/duckdbEngine';

export const MetabaseQuestionView: React.FC = () => {
  const { tables, addVisual, setActiveView, setAiModalOpen, executeDuckDbQuery } = useBiStore();
  const [mode, setMode] = useState<'guided' | 'sql'>('guided');

  // Guided Builder State
  const [selectedTable, setSelectedTable] = useState(tables[0]?.name || 'f_Vendas');
  const [summaryFunc, setSummaryFunc] = useState<'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX'>('SUM');
  const [summaryCol, setSummaryCol] = useState('ValorTotal');
  const [groupByCol, setGroupByCol] = useState('Categoria');
  const [chartType, setChartType] = useState<'column' | 'bar' | 'line' | 'donut' | 'table'>('column');
  const [limit, setLimit] = useState<number>(10);

  // SQL Editor State
  const [sqlQuery, setSqlQuery] = useState(
    'SELECT Categoria, SUM(ValorTotal) AS TotalFaturamento FROM f_Vendas GROUP BY Categoria ORDER BY TotalFaturamento DESC;'
  );
  const [sqlResults, setSqlResults] = useState<any[]>([]);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  const currentTableObj = tables.find(t => t.name === selectedTable) || tables[0];

  // Execute Guided Query dynamically
  const guidedResults = useMemo(() => {
    try {
      const sql =
        summaryFunc === 'COUNT'
          ? `SELECT ${groupByCol} AS Dimensao, COUNT(*) AS Valor FROM ${selectedTable} GROUP BY ${groupByCol} ORDER BY Valor DESC LIMIT ${limit};`
          : `SELECT ${groupByCol} AS Dimensao, ${summaryFunc}(${summaryCol}) AS Valor FROM ${selectedTable} GROUP BY ${groupByCol} ORDER BY Valor DESC LIMIT ${limit};`;
      return globalDataEngine.executeSql(sql);
    } catch (err) {
      return [];
    }
  }, [selectedTable, summaryFunc, summaryCol, groupByCol, limit]);

  // Handle SQL Execution via DuckDB-WASM engine
  const handleRunSql = async () => {
    setSqlError(null);
    const start = performance.now();
    try {
      const res = await executeDuckDbQuery(sqlQuery);
      setSqlResults(res || []);
      setExecutionTime(Number((performance.now() - start).toFixed(1)));
    } catch (err: any) {
      setSqlError(err.message || 'Erro de sintaxe SQL');
      setSqlResults([]);
    }
  };

  // Save as visual to report canvas
  const handleSaveToReport = () => {
    addVisual(chartType === 'donut' ? 'donut' : chartType === 'line' ? 'line' : 'column', selectedTable);
    alert('Visual criado e adicionado ao seu Relatório com sucesso!');
    setActiveView('report');
  };

  // ECharts options for preview
  const chartOption = useMemo(() => {
    const categories = guidedResults.map((r: any) => String(r.Dimensao ?? 'N/D'));
    const data = guidedResults.map((r: any) => Number(r.Valor) || 0);

    if (chartType === 'donut') {
      return {
        tooltip: { trigger: 'item' },
        series: [
          {
            type: 'pie',
            radius: ['45%', '70%'],
            data: categories.map((cat, i) => ({ name: cat, value: data[i] })),
          },
        ],
      };
    }

    return {
      tooltip: { trigger: 'axis' },
      xAxis: { type: chartType === 'bar' ? 'value' : 'category', data: chartType === 'bar' ? undefined : categories },
      yAxis: { type: chartType === 'bar' ? 'category' : 'value', data: chartType === 'bar' ? categories : undefined },
      series: [
        {
          name: `${summaryFunc} de ${summaryCol}`,
          type: chartType === 'line' ? 'line' : 'bar',
          data,
          itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }, [guidedResults, chartType, summaryFunc, summaryCol]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden text-xs select-none">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 p-3 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-200/70 p-1 rounded-lg">
            <button
              onClick={() => setMode('guided')}
              className={`px-3 py-1 rounded font-bold transition-all ${
                mode === 'guided' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Construtor Guiado (Estilo Metabase)
            </button>
            <button
              onClick={() => setMode('sql')}
              className={`px-3 py-1 rounded font-bold transition-all ${
                mode === 'sql' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Editor SQL Nativo
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAiModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200 font-bold"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Perguntar em Linguagem Natural</span>
          </button>
          <button
            onClick={handleSaveToReport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar no Relatório</span>
          </button>
        </div>
      </div>

      {/* MODE 1: GUIDED BUILDER */}
      {mode === 'guided' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Visual Query Workflow Steps: 1. Data -> 2. Summarize -> 3. Group By -> 4. Display */}
          <div className="bg-white border-b border-slate-200 p-3 flex items-center gap-4 shadow-xs overflow-x-auto">
            {/* Step 1: Escolher Tabela */}
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[10px]">
                1
              </span>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Tabela</div>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded px-2 py-1"
                >
                  {tables.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

            {/* Step 2: Resumir / Métrica */}
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[10px]">
                2
              </span>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Resumir por</div>
                <div className="flex gap-1">
                  <select
                    value={summaryFunc}
                    onChange={(e) => setSummaryFunc(e.target.value as any)}
                    className="font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded px-1.5 py-1"
                  >
                    <option value="SUM">Soma de</option>
                    <option value="AVG">Média de</option>
                    <option value="COUNT">Contagem</option>
                    <option value="MIN">Mínimo de</option>
                    <option value="MAX">Máximo de</option>
                  </select>
                  {summaryFunc !== 'COUNT' && (
                    <select
                      value={summaryCol}
                      onChange={(e) => setSummaryCol(e.target.value)}
                      className="font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded px-2 py-1"
                    >
                      {currentTableObj?.columns
                        .filter(c => c.dataType === 'number' || c.dataType === 'currency' || c.dataType === 'percentage')
                        .map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

            {/* Step 3: Agrupar por */}
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[10px]">
                3
              </span>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Agrupar por</div>
                <select
                  value={groupByCol}
                  onChange={(e) => setGroupByCol(e.target.value)}
                  className="font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded px-2 py-1"
                >
                  {currentTableObj?.columns.map(c => (
                    <option key={c.name} value={c.name}>{c.name} ({c.dataType})</option>
                  ))}
                </select>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

            {/* Step 4: Tipo de Visualização */}
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[10px]">
                4
              </span>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Tipo de Visual</div>
                <div className="flex gap-1">
                  {[
                    { id: 'column', label: 'Colunas' },
                    { id: 'bar', label: 'Barras' },
                    { id: 'line', label: 'Linhas' },
                    { id: 'donut', label: 'Rosca' },
                    { id: 'table', label: 'Tabela' },
                  ].map(vt => (
                    <button
                      key={vt.id}
                      onClick={() => setChartType(vt.id as any)}
                      className={`px-2 py-1 rounded text-[11px] font-medium border ${
                        chartType === vt.id
                          ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {vt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Results Display */}
          <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-auto">
            <div className="w-full max-w-4xl h-[420px] bg-white rounded-xl shadow-md border border-slate-200 p-4 flex flex-col">
              <div className="font-bold text-slate-800 text-sm mb-2 flex items-center justify-between">
                <span>
                  {summaryFunc} de {summaryCol} por {groupByCol}
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  {guidedResults.length} registros agregados
                </span>
              </div>

              <div className="flex-1 w-full h-full overflow-hidden">
                {chartType === 'table' ? (
                  <div className="w-full h-full overflow-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-slate-700">{groupByCol}</th>
                          <th className="px-3 py-2 text-right font-bold text-slate-700">{summaryFunc} ({summaryCol})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {guidedResults.map((r: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-1.5 text-slate-800">{String(r.Dimensao)}</td>
                            <td className="px-3 py-1.5 text-right font-bold text-amber-700">
                              {summaryCol.toLowerCase().includes('valor') || summaryCol.toLowerCase().includes('preco')
                                ? formatCurrency(r.Valor)
                                : r.Valor}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ReactECharts option={chartOption} style={{ width: '100%', height: '100%' }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: SQL NATIVO */}
      {mode === 'sql' && (
        <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Code className="w-4 h-4 text-amber-500" />
                <span>Editor SQL Analítico</span>
                {globalDuckDb.getEngineType() === 'alasql' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Motor SQL compatível (AlaSQL)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    DuckDB-WASM (Motor Nativo)
                  </span>
                )}
              </div>
              <button
                onClick={handleRunSql}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Executar SQL</span>
              </button>
            </div>

            {globalDuckDb.getEngineType() === 'alasql' && (
              <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  <strong>Aviso de Dialeto:</strong> Operando em modo de compatibilidade SQL em memória (AlaSQL). Podem ocorrer diferenças pontuais de dialeto em relação ao DuckDB-WASM.
                </span>
              </div>
            )}

            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              rows={5}
              className="w-full font-mono text-xs bg-slate-900 text-amber-300 p-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Digite sua consulta SQL aqui..."
            />

            {sqlError && (
              <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 font-mono text-xs">
                {sqlError}
              </div>
            )}

            {executionTime !== null && !sqlError && (
              <div className="text-[11px] text-emerald-700 font-medium">
                Executado com sucesso em {executionTime}ms • {sqlResults.length} linhas retornadas
              </div>
            )}
          </div>

          {/* SQL Query Results Table */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto">
            {sqlResults.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {Object.keys(sqlResults[0]).map(col => (
                      <th key={col} className="px-3 py-2 font-bold text-slate-700">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sqlResults.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {Object.keys(row).map(col => (
                        <td key={col} className="px-3 py-1.5 text-slate-700">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-400">
                Execute a consulta SQL acima para visualizar a grade de dados.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
