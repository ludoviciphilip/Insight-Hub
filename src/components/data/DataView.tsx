import React, { useState, useMemo } from 'react';
import { Database, Search, Download, Filter, Hash, Type, Calendar, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { EtlEngine } from '../../engine/etlEngine';
import { formatCurrency } from '../../engine/dataEngine';

export const DataView: React.FC = () => {
  const { tables } = useBiStore();
  const [activeTableId, setActiveTableId] = useState<string>(tables[0]?.id || 'f_Vendas');
  const [searchTerm, setSearchTerm] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 50;

  const currentTable = tables.find(t => t.id === activeTableId) || tables[0];

  // Column Profiling Statistics
  const columnProfiles = useMemo(() => {
    if (!currentTable) return [];
    return EtlEngine.computeColumnProfiles(currentTable);
  }, [currentTable]);

  // Filtered rows by search term
  const filteredRows = useMemo(() => {
    if (!currentTable) return [];
    if (!searchTerm.trim()) return currentTable.rows;

    const term = searchTerm.toLowerCase();
    return currentTable.rows.filter(r =>
      Object.values(r).some(val => String(val ?? '').toLowerCase().includes(term))
    );
  }, [currentTable, searchTerm]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const displayedRows = filteredRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const handleExportCSV = () => {
    if (!currentTable || !currentTable.rows.length) return;
    const keys = currentTable.columns.map(c => c.name);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [keys.join(';'), ...currentTable.rows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentTable.name}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-slate-100 text-xs select-none">
      {/* Left Sidebar: Tables List */}
      <div className="w-56 bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
        <div className="p-3 border-b border-slate-200 font-semibold text-slate-800 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Database className="w-4 h-4 text-slate-600" />
            <span>Tabelas do Modelo</span>
          </div>
          <span className="text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded font-bold">
            {tables.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {tables.map(tbl => {
            const isCurrent = tbl.id === activeTableId;
            return (
              <button
                key={tbl.id}
                onClick={() => {
                  setActiveTableId(tbl.id);
                  setPageIndex(0);
                }}
                className={`w-full flex items-center justify-between p-2 rounded text-left transition-colors ${
                  isCurrent
                    ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                    : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Database className={`w-3.5 h-3.5 ${isCurrent ? 'text-amber-600' : 'text-slate-400'}`} />
                  <span className="truncate text-[11px]">{tbl.name}</span>
                </div>
                <span className="text-[10px] text-slate-400">{tbl.rows.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Control Bar: Search & Export */}
        <div className="p-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder={`Pesquisar em ${currentTable?.name || ''}...`}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPageIndex(0);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar Tabela (CSV)</span>
            </button>
          </div>
        </div>

        {/* Data Grid with Column Stats Header */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-400 bg-slate-100 border-r border-slate-200 w-12 text-center">
                  #
                </th>
                {currentTable?.columns.map(col => {
                  const profile = columnProfiles.find(p => p.columnName === col.name);
                  return (
                    <th key={col.id} className="px-3 py-2 border-r border-slate-200 min-w-[140px] max-w-[200px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800 text-[11px] truncate" title={col.name}>
                          {col.name}
                        </span>
                        <span className="text-[9px] uppercase px-1 py-0.2 bg-slate-200/80 text-slate-600 rounded">
                          {col.dataType}
                        </span>
                      </div>
                      {/* Quality & Profile Micro Bar */}
                      {profile && (
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[9px] text-slate-400">
                            <span>{profile.distinctCount} únicos</span>
                            {profile.errorCount ? (
                              <span className="text-red-500 font-semibold" title={`${profile.errorCount} erros de conversão`}>
                                {profile.errorCount} erro{profile.errorCount > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span>{profile.nullPercent}% vazios</span>
                            )}
                          </div>
                          <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${profile.validPercent}%` }}
                              className="bg-emerald-500 h-full"
                              title={`${profile.validPercent}% preenchidos`}
                            ></div>
                            <div
                              style={{ width: `${profile.nullPercent}%` }}
                              className="bg-red-400 h-full"
                              title={`${profile.nullPercent}% nulos`}
                            ></div>
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {displayedRows.map((row, i) => (
                <tr key={i} className="hover:bg-amber-50/40 transition-colors">
                  <td className="px-3 py-1 text-[10px] text-slate-400 bg-slate-50/60 border-r border-slate-100 text-center font-mono">
                    {pageIndex * pageSize + i + 1}
                  </td>
                  {currentTable.columns.map(col => {
                    const val = row[col.name];
                    const isCurrency = col.dataType === 'currency';
                    return (
                      <td key={col.name} className="px-3 py-1.5 text-slate-700 border-r border-slate-100 truncate">
                        {isCurrency ? formatCurrency(val) : String(val ?? '')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Bar */}
        <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-slate-600">
          <div className="text-[11px]">
            Exibindo {displayedRows.length} de {filteredRows.length} linhas (Total na tabela: {currentTable?.rows.length})
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px]">
              Página {pageIndex + 1} de {totalPages || 1}
            </span>
            <button
              disabled={pageIndex === 0}
              onClick={() => setPageIndex(p => Math.max(0, p - 1))}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={pageIndex >= totalPages - 1}
              onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
