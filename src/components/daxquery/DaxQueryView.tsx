import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Download,
  Plus,
  X,
  Sparkles,
  Network,
  Code,
  BookOpen,
  Check,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Layers,
  History,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { DaxEngine } from '../../engine/daxEngine';
import { globalDataEngine } from '../../engine/dataEngine';
import { DaxQueryExecutionResult, DaxQueryTab, DaxQueryHistoryItem } from '../../types/bi';
import { DAX_SNIPPETS, getSignatureHelpAtOffset, getDaxGuideUrl } from '../../engine/shared/intellisense';
import { UdfLibraryModal } from './UdfLibraryModal';
import { DependencyGraphModal } from './DependencyGraphModal';
import { DaxAiAssistantModal } from './DaxAiAssistantModal';
import { DaxImportModal } from './DaxImportModal';
import { formatNumber } from '../../engine/shared/formatter';

export const DaxQueryView: React.FC = () => {
  const {
    tables,
    measures,
    userDefinedFunctions,
    daxQueries,
    activeDaxQueryTabId,
    setActiveDaxQueryTabId,
    addDaxQueryTab,
    closeDaxQueryTab,
    updateDaxQueryText,
    addMeasure,
    updateMeasure,
    addUserDefinedFunction,
    addTable,
  } = useBiStore();

  const activeTab = daxQueries.find(q => q.id === activeDaxQueryTabId) || daxQueries[0];

  const [isRunning, setIsRunning] = useState(false);
  const [queryResult, setQueryResult] = useState<DaxQueryExecutionResult | null>(null);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [activeBottomTab, setActiveBottomTab] = useState<'results' | 'plan' | 'history'>('results');
  const [history, setHistory] = useState<DaxQueryHistoryItem[]>([]);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [isUdfModalOpen, setIsUdfModalOpen] = useState(false);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Signature help
  const [signatureHelp, setSignatureHelp] = useState<{
    functionName?: string;
    activeParameterIndex: number;
    daxGuideUrl?: string;
    syntax?: string;
    description?: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keyboard shortcut Ctrl+Enter to run query
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleExecuteQuery();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleExecuteQuery = () => {
    if (!activeTab || !activeTab.query.trim()) return;

    setIsRunning(true);
    setCurrentPage(1);

    setTimeout(() => {
      try {
        const model = globalDataEngine;
        const res = DaxEngine.executeDaxQuery(activeTab.query, model);
        setQueryResult(res);
        setActiveResultIndex(0);

        // Record history
        const rowCount = res.results.reduce((acc, r) => acc + (r.rowCount || 0), 0);
        const historyItem: DaxQueryHistoryItem = {
          id: `hist_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          query: activeTab.query,
          success: res.success,
          durationMs: res.totalDurationMs,
          rowCount,
          error: res.error,
        };
        setHistory(prev => [historyItem, ...prev.slice(0, 19)]);

        if (!res.success && res.error) {
          showToast(`Erro na consulta: ${res.error}`, 'error');
        }
      } catch (err: any) {
        showToast(err.message || 'Erro inesperado ao executar consulta DAX.', 'error');
      } finally {
        setIsRunning(false);
      }
    }, 20);
  };

  // "Atualizar modelo com estas definições"
  const handleApplyDefinitionsToModel = () => {
    if (!queryResult || !queryResult.definedObjects) {
      showToast('Execute a consulta com bloco DEFINE antes de atualizar o modelo.', 'error');
      return;
    }

    const { measures: defMeasures, columns: defCols, tables: defTables, functions: defFunctions } = queryResult.definedObjects;

    let appliedCount = 0;

    // 1. Apply measures
    for (const m of defMeasures) {
      const existing = measures.find(existingM => existingM.name.toLowerCase() === m.name.toLowerCase());
      if (existing) {
        updateMeasure(existing.id, {
          formula: m.formula,
          tableName: m.table,
        });
      } else {
        addMeasure({
          id: `msr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: m.name,
          tableName: m.table || 'f_Vendas',
          formula: m.formula,
          format: 'number',
        });
      }
      appliedCount++;
    }

    // 2. Apply UDFs
    for (const fn of defFunctions) {
      addUserDefinedFunction({
        id: `udf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: fn.name,
        parameters: fn.parameters,
        body: fn.body,
        category: 'DAX Query',
      });
      appliedCount++;
    }

    if (appliedCount > 0) {
      showToast(`${appliedCount} definição(ões) aplicadas com sucesso ao modelo!`);
    } else {
      showToast('Nenhuma instrução MEASURE ou FUNCTION encontrada na cláusula DEFINE.', 'error');
    }
  };

  const handleExportCsv = () => {
    const currentTable = queryResult?.results?.[activeResultIndex]?.table;
    if (!currentTable || currentTable.rows.length === 0) {
      showToast('Nenhum resultado tabular para exportar.', 'error');
      return;
    }

    const headers = currentTable.columns.join(',');
    const rows = currentTable.rows.map((row: Record<string, any>) =>
      currentTable.columns
        .map((col: string) => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dax-query-result-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Resultado exportado com sucesso para CSV!');
  };

  const handleInsertSnippet = (template: string) => {
    if (!activeTab) return;
    const currentQuery = activeTab.query;
    const newQuery = currentQuery ? `${currentQuery}\n\n${template}` : template;
    updateDaxQueryText(activeTab.id, newQuery);
    showToast('Snippet inserido na consulta ativa.');
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeTab) return;
    const newText = e.target.value;
    updateDaxQueryText(activeTab.id, newText);

    const offset = e.target.selectionStart;
    const sig = getSignatureHelpAtOffset(newText, offset);
    setSignatureHelp(sig);
  };

  const handleTextareaKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const offset = (e.target as HTMLTextAreaElement).selectionStart;
    const sig = getSignatureHelpAtOffset(activeTab?.query || '', offset);
    setSignatureHelp(sig);
  };

  // Pagination for result table
  const activeTableResult = queryResult?.results?.[activeResultIndex]?.table;
  const totalRows = activeTableResult?.rows?.length || 0;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRows = activeTableResult?.rows?.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  ) || [];

  const lineCount = (activeTab?.query || '').split('\n').length;

  const hasDefinitions =
    queryResult?.definedObjects &&
    (queryResult.definedObjects.measures.length > 0 ||
      queryResult.definedObjects.functions.length > 0 ||
      queryResult.definedObjects.columns.length > 0 ||
      queryResult.definedObjects.tables.length > 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Toast */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-xs font-semibold shadow-xl border flex items-center gap-2 transition-all ${
            toastMsg.type === 'success'
              ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950 border-rose-500/40 text-rose-300'
          }`}
        >
          {toastMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Toolbar */}
      <div className="h-12 border-b border-slate-800 bg-slate-950 px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          {/* Run Query Button */}
          <button
            onClick={handleExecuteQuery}
            disabled={isRunning}
            className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-2 shadow-md transition-all"
            title="Executar Consulta (Ctrl + Enter)"
          >
            {isRunning ? (
              <div className="w-3.5 h-3.5 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Executar</span>
            <kbd className="text-[10px] bg-slate-950/20 px-1 py-0.5 rounded font-mono">Ctrl+Enter</kbd>
          </button>

          {/* Apply Definitions to Model */}
          <button
            onClick={handleApplyDefinitionsToModel}
            disabled={!hasDefinitions}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 border transition-all ${
              hasDefinitions
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30 shadow-xs'
                : 'border-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
            }`}
            title="Salva medidas, colunas e UDFs da cláusula DEFINE no modelo de dados"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Atualizar modelo com estas definições</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            disabled={!activeTableResult || activeTableResult.rows.length === 0}
            className="px-3 py-1.5 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 text-xs font-medium rounded-lg flex items-center gap-1.5"
            title="Exportar resultado atual para CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Exportar CSV</span>
          </button>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          {/* Snippets Dropdown */}
          <div className="relative group">
            <button className="px-3 py-1.5 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span>Snippets DAX</span>
            </button>
            <div className="absolute right-0 top-full mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 z-30 hidden group-hover:block">
              {DAX_SNIPPETS.map(snip => (
                <button
                  key={snip.id}
                  onClick={() => handleInsertSnippet(snip.template)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/80 flex flex-col gap-0.5"
                >
                  <span className="font-semibold text-amber-300">{snip.title}</span>
                  <span className="text-[10px] text-slate-400 line-clamp-1">{snip.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* UDF Library */}
          <button
            onClick={() => setIsUdfModalOpen(true)}
            className="px-3 py-1.5 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1.5"
            title="Biblioteca de Funções do Usuário (UDF)"
          >
            <Code className="w-3.5 h-3.5 text-indigo-400" />
            <span>Biblioteca UDF</span>
            <span className="text-[10px] px-1.5 rounded-full bg-slate-800 text-indigo-300 border border-indigo-500/30">
              {userDefinedFunctions.length}
            </span>
          </button>

          {/* Dependency Graph */}
          <button
            onClick={() => setIsGraphModalOpen(true)}
            className="px-3 py-1.5 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1.5"
            title="Gráfico de Dependências do Modelo"
          >
            <Network className="w-3.5 h-3.5 text-teal-400" />
            <span>Dependências</span>
          </button>

          {/* Import Script (Power BI / DAX Studio) */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1.5"
            title="Importar Medidas do Power BI Desktop ou DAX Studio"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>Importar Script</span>
          </button>

          {/* AI Assistant */}
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md"
            title="Assistente IA DAX (Gemini)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Assistente IA</span>
          </button>
        </div>
      </div>

      {/* Query Tabs Bar */}
      <div className="h-9 bg-slate-950 border-b border-slate-800/80 flex items-center px-2 gap-1 overflow-x-auto shrink-0 select-none">
        {daxQueries.map(tab => {
          const isActive = tab.id === activeTab?.id;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveDaxQueryTabId(tab.id)}
              className={`h-7 px-3 rounded-t-md flex items-center gap-2 cursor-pointer text-xs font-medium transition-all ${
                isActive
                  ? 'bg-slate-900 text-amber-400 border-t-2 border-amber-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <span>{tab.title}</span>
              {daxQueries.length > 1 && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    closeDaxQueryTab(tab.id);
                  }}
                  className="w-4 h-4 rounded flex items-center justify-center hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={() => addDaxQueryTab()}
          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded text-xs ml-1"
          title="Nova Consulta DAX"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Main Stage: Editor (Top) and Results (Bottom) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Editor Area */}
        <div className="h-1/2 flex flex-col border-b border-slate-800 bg-slate-900 relative">
          <div className="flex-1 flex overflow-hidden">
            {/* Line Numbers */}
            <div className="w-12 bg-slate-950 border-r border-slate-800/80 py-3 text-right pr-2 text-slate-600 font-mono text-xs select-none">
              {Array.from({ length: Math.max(1, lineCount) }).map((_, i) => (
                <div key={i} className="leading-6">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code Textarea */}
            <textarea
              ref={textareaRef}
              value={activeTab?.query || ''}
              onChange={handleTextareaChange}
              onKeyUp={handleTextareaKeyUp}
              onClick={e => {
                const offset = (e.target as HTMLTextAreaElement).selectionStart;
                setSignatureHelp(getSignatureHelpAtOffset(activeTab?.query || '', offset));
              }}
              placeholder="Digite sua consulta DAX (ex: EVALUATE SUMMARIZECOLUMNS('d_Calendario'[Ano], [Faturamento Total]))"
              className="flex-1 p-3 bg-slate-900 text-slate-100 font-mono text-xs leading-6 outline-none resize-none selection:bg-indigo-600/40"
              spellCheck={false}
            />
          </div>

          {/* Signature Help Banner */}
          {signatureHelp && signatureHelp.functionName && (
            <div className="absolute bottom-2 left-16 right-4 bg-slate-800/95 backdrop-blur-md border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs flex items-center justify-between z-20">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="font-mono font-bold text-amber-300 shrink-0">
                  {signatureHelp.syntax || `${signatureHelp.functionName}(...)`}
                </span>
                {signatureHelp.description && (
                  <span className="text-slate-400 truncate text-[11px] border-l border-slate-700 pl-2">
                    {signatureHelp.description}
                  </span>
                )}
              </div>
              {signatureHelp.daxGuideUrl && (
                <a
                  href={signatureHelp.daxGuideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 font-medium text-[11px] flex items-center gap-1 shrink-0 ml-3"
                >
                  Documentação dax.guide <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Results Area (Bottom Half) */}
        <div className="h-1/2 flex flex-col bg-slate-950 overflow-hidden">
          {/* Subtabs Header */}
          <div className="h-9 border-b border-slate-800 bg-slate-900/50 px-4 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveBottomTab('results')}
                className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                  activeBottomTab === 'results'
                    ? 'bg-slate-800 text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Resultados</span>
                {queryResult && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300">
                    {queryResult.results.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveBottomTab('plan')}
                className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                  activeBottomTab === 'plan'
                    ? 'bg-slate-800 text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Plano de Execução</span>
                {queryResult && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({queryResult.totalDurationMs} ms)
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveBottomTab('history')}
                className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                  activeBottomTab === 'history'
                    ? 'bg-slate-800 text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Histórico</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300">
                  {history.length}
                </span>
              </button>
            </div>

            {/* Multiple EVALUATE results selector */}
            {activeBottomTab === 'results' && queryResult && queryResult.results.length > 1 && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-500 mr-1">Conjunto de Dados:</span>
                {queryResult.results.map((r, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveResultIndex(idx);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-0.5 text-xs rounded font-medium ${
                      activeResultIndex === idx
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Resultado {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subtab Contents */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeBottomTab === 'results' && (
              <>
                {queryResult?.error ? (
                  <div className="m-6 p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-rose-200 mb-1">Erro na Execução da Consulta DAX</h4>
                      <p className="font-mono leading-relaxed">{queryResult.error}</p>
                    </div>
                  </div>
                ) : !activeTableResult || activeTableResult.rows.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
                    <Database className="w-10 h-10 text-slate-700 mb-2" />
                    <span>Nenhum resultado gerado. Clique em "Executar" para rodar a consulta.</span>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Paginated Grid */}
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
                          <tr>
                            <th className="py-2 px-3 text-[11px] text-slate-500 font-mono w-12 border-r border-slate-800/60">
                              #
                            </th>
                            {activeTableResult.columns.map((col: string) => (
                              <th
                                key={col}
                                className="py-2 px-3 text-slate-300 font-semibold font-mono text-xs border-r border-slate-800/60 truncate"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {paginatedRows.map((row: Record<string, any>, rIdx: number) => {
                            const globalIdx = (currentPage - 1) * pageSize + rIdx + 1;
                            return (
                              <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500 border-r border-slate-800/60">
                                  {globalIdx}
                                </td>
                                {activeTableResult.columns.map((col: string) => {
                                  const val = row[col];
                                  const isNum = typeof val === 'number';
                                  return (
                                    <td
                                      key={col}
                                      className={`py-1.5 px-3 font-mono text-xs border-r border-slate-800/60 truncate ${
                                        isNum ? 'text-right text-emerald-300' : 'text-slate-300'
                                      }`}
                                    >
                                      {val === null || val === undefined
                                        ? '(Em branco)'
                                        : isNum
                                        ? formatNumber(val)
                                        : String(val)}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar */}
                    <div className="h-10 border-t border-slate-800 bg-slate-900/60 px-4 flex items-center justify-between text-xs text-slate-400 select-none">
                      <div className="flex items-center gap-2">
                        <span>
                          Mostrando {(currentPage - 1) * pageSize + 1} a{' '}
                          {Math.min(currentPage * pageSize, totalRows)} de {totalRows} linhas
                        </span>
                        <span className="text-slate-600">•</span>
                        <span>Tempo: {queryResult?.totalDurationMs} ms</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span>Linhas por página:</span>
                          <select
                            value={pageSize}
                            onChange={e => {
                              setPageSize(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                            className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-0.5 text-xs outline-none"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            className="p-1 rounded hover:bg-slate-800 disabled:opacity-30"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="px-2">
                            {currentPage} de {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            className="p-1 rounded hover:bg-slate-800 disabled:opacity-30"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeBottomTab === 'plan' && (
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Etapas do Plano de Execução DAX
                </h4>
                {!queryResult ? (
                  <p className="text-xs text-slate-500">Execute uma consulta para inspecionar o plano de execução.</p>
                ) : (
                  queryResult.executionPlan.map((stage, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            stage.status === 'success'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <span className="font-semibold text-xs text-slate-200">{stage.name}</span>
                          {stage.details && (
                            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{stage.details}</p>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-amber-400">{stage.durationMs} ms</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeBottomTab === 'history' && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Histórico de Consultas Executadas
                </h4>
                {history.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4">Nenhuma consulta executada nesta sessão ainda.</p>
                ) : (
                  history.map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (activeTab) updateDaxQueryText(activeTab.id, item.query);
                        showToast('Consulta restaurada para o editor ativo.');
                      }}
                      className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div className="flex flex-col gap-1 overflow-hidden pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.success ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          <span className="text-xs font-mono text-slate-400">{item.timestamp}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                            {item.durationMs} ms
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {item.rowCount} linha(s)
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-300 truncate max-w-xl">
                          {item.query.replace(/\n/g, ' ')}
                        </p>
                      </div>
                      <span className="text-xs text-amber-400 shrink-0 font-medium">Restaurar →</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <UdfLibraryModal isOpen={isUdfModalOpen} onClose={() => setIsUdfModalOpen(false)} />
      <DependencyGraphModal
        isOpen={isGraphModalOpen}
        onClose={() => setIsGraphModalOpen(false)}
        onNavigateToDefinition={name => {
          if (activeTab) {
            updateDaxQueryText(
              activeTab.id,
              `EVALUATE\n  ROW("Definicao", "${name}", "Valor", [${name}])`
            );
          }
        }}
      />
      <DaxAiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        initialFormula={activeTab?.query || ''}
        onApplyFormula={(formula, measureName) => {
          if (activeTab) {
            const queryWithDef = `DEFINE\n  MEASURE f_Vendas[${measureName || 'MedidaIA'}] = ${formula}\n\nEVALUATE\n  ROW("Resultado", [${measureName || 'MedidaIA'}])`;
            updateDaxQueryText(activeTab.id, queryWithDef);
          }
        }}
      />
      <DaxImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
};
