import React, { useState } from 'react';
import { Filter as FilterIcon, X, Trash2, Plus, Check } from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { Filter } from '../../types/bi';
import { useTranslation } from '../../i18n';

export const FiltersPane: React.FC = () => {
  const { filters, removeFilter, clearFilters, tables, addFilter } = useBiStore();
  const { t } = useTranslation();
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState(tables[0]?.id || '');
  const [selectedColumn, setSelectedColumn] = useState('');
  const [operator, setOperator] = useState<Filter['operator']>('equals');
  const [filterVal, setFilterVal] = useState('');

  const currentTable = tables.find(t => t.id === selectedTableId || t.name === selectedTableId) || tables[0];
  const columns = currentTable?.columns || [];

  const handleAdd = () => {
    if (!selectedColumn || !filterVal.trim()) return;
    const newFilter: Filter = {
      id: 'filt_' + Math.random().toString(36).substring(2, 7),
      level: 'report',
      tableId: currentTable.id,
      column: selectedColumn,
      operator,
      value: filterVal.trim(),
    };
    addFilter(newFilter);
    setShowAddFilter(false);
    setFilterVal('');
  };

  return (
    <div className="w-64 border-l border-slate-200 bg-white flex flex-col h-full text-xs select-none">
      {/* Header */}
      <div className="p-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between font-semibold text-slate-700">
        <div className="flex items-center gap-1.5">
          <FilterIcon className="w-4 h-4 text-amber-500" />
          <span>{t.panes.filters.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAddFilter(!showAddFilter)}
            className="p-1 rounded hover:bg-slate-200 text-slate-700 flex items-center gap-0.5 text-[11px] font-medium"
            title={t.panes.filters.title}
          >
            <Plus className="w-3.5 h-3.5 text-amber-600" />
            <span>+</span>
          </button>
          {filters.length > 0 && (
            <button
              onClick={clearFilters}
              className="p-1 rounded text-red-600 hover:bg-red-50 flex items-center gap-0.5 text-[11px]"
              title={t.panes.filters.clearAll}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Add Filter Form */}
      {showAddFilter && (
        <div className="p-3 border-b border-slate-200 bg-amber-50/50 space-y-2">
          <div className="flex items-center justify-between font-bold text-amber-900 text-[11px]">
            <span>Novo Filtro</span>
            <button onClick={() => setShowAddFilter(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Tabela</label>
            <select
              value={selectedTableId}
              onChange={(e) => {
                setSelectedTableId(e.target.value);
                setSelectedColumn('');
              }}
              className="w-full bg-white border border-slate-300 rounded p-1 text-[11px]"
            >
              {tables.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Coluna</label>
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded p-1 text-[11px]"
            >
              <option value="">(Selecione a Coluna)</option>
              {columns.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Operador</label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded p-1 text-[11px]"
              >
                <option value="equals">Igual a</option>
                <option value="contains">Contém</option>
                <option value="greaterThan">Maior que</option>
                <option value="lessThan">Menor que</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Valor</label>
              <input
                type="text"
                placeholder="Ex.: Online"
                value={filterVal}
                onChange={(e) => setFilterVal(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded p-1 text-[11px]"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!selectedColumn || !filterVal.trim()}
            className="w-full mt-1 py-1 rounded bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            Aplicar Filtro
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filters.length === 0 ? (
          <div className="p-4 text-center text-slate-400 flex flex-col items-center justify-center">
            <FilterIcon className="w-6 h-6 mb-2 text-slate-300" />
            <p className="font-medium text-slate-500 text-[11px]">{t.panes.filters.noFilters}</p>
            <p className="text-[10px] text-slate-400 mt-1">
              Clique em barras ou fatias dos gráficos para filtro cruzado automático, ou adicione um filtro acima.
            </p>
          </div>
        ) : (
          filters.map(filter => (
            <div
              key={filter.id}
              className="p-2 rounded bg-amber-50/70 border border-amber-200 text-slate-700 flex flex-col gap-1 text-[11px] relative group"
            >
              <div className="flex items-center justify-between font-semibold text-amber-900">
                <span className="truncate">{filter.column}</span>
                <button
                  onClick={() => removeFilter(filter.id)}
                  className="p-0.5 text-slate-400 hover:text-red-600 rounded"
                  title="Remover filtro"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-slate-600 flex justify-between">
                <span>Tabela: <strong className="text-slate-800">{filter.tableId}</strong></span>
                <span className="text-[9px] uppercase px-1 rounded bg-slate-200 text-slate-600">
                  {filter.operator === 'equals' ? '=' : filter.operator}
                </span>
              </div>
              <div className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded truncate">
                {String(filter.value)}
              </div>
            </div>
          ))
        )}

        {/* Section: Status */}
        <div className="pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Propagação Automática
          </span>
          <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
            Filtros cruzados bidirecionais ativos e sincronizados entre todas as páginas e gráficos.
          </div>
        </div>
      </div>
    </div>
  );
};
