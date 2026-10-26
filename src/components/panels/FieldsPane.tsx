import React, { useState } from 'react';
import {
  Database,
  Calendar,
  Hash,
  Type,
  MapPin,
  Sigma,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Folder,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { Column, Measure } from '../../types/bi';
import { useTranslation } from '../../i18n';

export const FieldsPane: React.FC = () => {
  const { t } = useTranslation();
  const {
    tables,
    measures,
    selectedVisualId,
    updateVisual,
    pages,
    activePageId,
    setQuickMeasureModalOpen,
    setCustomMeasureModalOpen,
    deleteMeasure,
    openCustomMeasureModal,
  } = useBiStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingMeasureId, setDeletingMeasureId] = useState<string | null>(null);
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({
    f_Vendas: true,
    d_Clientes: false,
    f_DRE: false,
    f_Logistica: false,
    f_RH: false,
    d_Calendario: false,
  });

  const toggleTable = (id: string) => {
    setExpandedTables(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'Comercial': true,
    'Métricas Personalizadas': true,
  });

  const toggleFolder = (key: string) => {
    setExpandedFolders(prev => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };

  const activePage = pages.find(p => p.id === activePageId);
  const selectedVisual = activePage?.visuals.find(v => v.id === selectedVisualId);

  const renderMeasureItem = (measure: Measure, tableId: string) => (
    <div
      key={measure.id}
      className="flex items-center justify-between px-1.5 py-1 rounded text-amber-800 hover:bg-amber-50 cursor-pointer group"
    >
      <div
        onClick={() => handleAddFieldToSelectedVisual(tableId, measure.name, true)}
        title={`Medida DAX: ${measure.formula}\nClique para adicionar ao visual ativo`}
        className="flex items-center gap-1.5 truncate flex-1 min-w-0"
      >
        <Sigma className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="truncate text-[11px] font-medium">{measure.name}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCustomMeasureModal(measure.id);
          }}
          title={`Editar medida "${measure.name}"`}
          className="p-1 rounded hover:bg-amber-200/60 text-slate-400 hover:text-amber-800 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Edit2 className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDeletingMeasureId(measure.id);
          }}
          title={`Excluir medida "${measure.name}"`}
          className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3 h-3" />
        </button>
        <span className="text-[9px] text-amber-600 bg-amber-100/60 px-1 rounded group-hover:hidden">
          DAX
        </span>
      </div>
    </div>
  );

  const getColumnIcon = (col: Column) => {
    if (col.dataCategory) return <MapPin className="w-3.5 h-3.5 text-blue-500" />;
    if (col.dataType === 'number' || col.dataType === 'currency' || col.dataType === 'percentage') {
      return <Hash className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (col.dataType === 'date') {
      return <Calendar className="w-3.5 h-3.5 text-emerald-500" />;
    }
    return <Type className="w-3.5 h-3.5 text-slate-400" />;
  };

  const handleAddFieldToSelectedVisual = (tableName: string, colName: string, isNumeric: boolean) => {
    if (!selectedVisual) return;

    if (isNumeric) {
      updateVisual(selectedVisual.id, {
        dataConfig: {
          ...selectedVisual.dataConfig,
          tableId: tableName,
          yAxisFields: [colName],
        },
      });
    } else {
      updateVisual(selectedVisual.id, {
        dataConfig: {
          ...selectedVisual.dataConfig,
          tableId: tableName,
          xAxisField: colName,
        },
      });
    }
  };

  return (
    <div className="w-64 border-l border-slate-200 bg-white flex flex-col h-full text-xs select-none">
      {/* Header */}
      <div className="p-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between font-semibold text-slate-700">
        <div className="flex items-center gap-1.5">
          <Database className="w-4 h-4 text-slate-500" />
          <span>{t.panes.fields.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCustomMeasureModalOpen(true)}
            className="flex items-center gap-1 text-[11px] text-purple-700 hover:text-purple-800 font-semibold px-1.5 py-0.5 rounded hover:bg-purple-50 transition-colors"
            title={t.panes.fields.newMeasure}
          >
            <Sigma className="w-3 h-3 text-purple-600" />
            <span>+ Medida</span>
          </button>
          <button
            onClick={() => setQuickMeasureModalOpen(true)}
            className="flex items-center gap-0.5 text-[11px] text-amber-700 hover:text-amber-800 font-medium px-1 py-0.5 rounded hover:bg-amber-50 transition-colors"
            title={t.ribbonActions.quickMeasure}
          >
            <Plus className="w-3 h-3 text-amber-600" />
            <span>Rápida</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-slate-100">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
          <input
            type="text"
            placeholder={t.panes.fields.search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded pl-7 pr-2 py-1 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 text-[11px]"
          />
        </div>
      </div>

      {/* Tables & Columns List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {tables.map(table => {
          const isExpanded = expandedTables[table.id] ?? false;
          const filteredCols = table.columns.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase())
          );
          const tableMeasures = measures.filter(m => m.tableName === table.id || m.tableName === table.name);

          if (searchTerm && filteredCols.length === 0 && tableMeasures.length === 0) {
            return null;
          }

          return (
            <div key={table.id} className="rounded border border-transparent hover:border-slate-200">
              {/* Table Header */}
              <div
                onClick={() => toggleTable(table.id)}
                className="flex items-center justify-between p-1.5 rounded cursor-pointer hover:bg-slate-50 text-slate-700 font-medium"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  {table.isCalendar ? (
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Database className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                  <span className="truncate text-[11px] font-semibold">{table.name}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">{table.rows.length}</span>
              </div>

              {/* Table Columns and Measures */}
              {isExpanded && (
                <div className="pl-5 pr-1 py-1 space-y-0.5 border-l-2 border-slate-100 ml-3 mt-0.5">
                  {/* Measures grouped by Display Folder */}
                  {(() => {
                    const folderMap: Record<string, Measure[]> = {};
                    const rootMeasures: Measure[] = [];

                    tableMeasures.forEach(m => {
                      const f = (m.displayFolder || '').trim();
                      if (f) {
                        if (!folderMap[f]) folderMap[f] = [];
                        folderMap[f].push(m);
                      } else {
                        rootMeasures.push(m);
                      }
                    });

                    return (
                      <>
                        {Object.entries(folderMap).map(([folderName, folderMeasures]) => {
                          const folderKey = `${table.id}_${folderName}`;
                          const isFolderOpen = expandedFolders[folderKey] ?? true;

                          return (
                            <div key={folderName} className="rounded mb-1">
                              <div
                                onClick={() => toggleFolder(folderKey)}
                                className="flex items-center justify-between px-1.5 py-1 rounded cursor-pointer hover:bg-slate-100 text-slate-700 font-medium"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  {isFolderOpen ? (
                                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                                  )}
                                  <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-100 shrink-0" />
                                  <span className="truncate text-[11px] font-semibold text-slate-700">
                                    {folderName}
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-400 bg-slate-100 px-1 rounded font-normal">
                                  {folderMeasures.length}
                                </span>
                              </div>

                              {isFolderOpen && (
                                <div className="pl-4 space-y-0.5 border-l border-amber-200/80 ml-2.5 my-0.5">
                                  {folderMeasures.map(measure => renderMeasureItem(measure, table.id))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {rootMeasures.map(measure => renderMeasureItem(measure, table.id))}
                      </>
                    );
                  })()}

                  {/* Columns */}
                  {filteredCols.map(col => {
                    const isNum =
                      col.dataType === 'number' || col.dataType === 'currency' || col.dataType === 'percentage';
                    return (
                      <div
                        key={col.id}
                        onClick={() => handleAddFieldToSelectedVisual(table.id, col.name, isNum)}
                        title={`Coluna: ${col.name} (${col.dataType})\nClique para aplicar ao visual selecionado`}
                        className="flex items-center justify-between px-1.5 py-1 rounded text-slate-600 hover:bg-slate-100 cursor-pointer group"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {getColumnIcon(col)}
                          <span className="truncate text-[11px]">{col.name}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 uppercase opacity-0 group-hover:opacity-100">
                          {col.dataType === 'currency' ? 'R$' : col.dataType}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de Confirmação Exclusão de Medida */}
      {deletingMeasureId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-100 text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Excluir Medida DAX?</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  A medida "
                  {measures.find(m => m.id === deletingMeasureId)?.name || 'selecionada'}
                  " será removida do modelo e dos gráficos associados.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingMeasureId(null)}
                className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-100 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteMeasure(deletingMeasureId);
                  setDeletingMeasureId(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
              >
                Excluir Medida
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
