import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeftRight,
  Check,
  Database,
  Calendar,
  Key,
  Link2,
  Sparkles,
  X,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { Relationship, Table } from '../../types/bi';

export const ModelView: React.FC = () => {
  const { tables, relationships, addRelationship, deleteRelationship } = useBiStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Direct Interactive Connection State (Click column A, then click column B)
  const [connectingSource, setConnectingSource] = useState<{ tableId: string; tableName: string; columnName: string } | null>(null);

  // New relationship modal form state
  const [fromTable, setFromTable] = useState(tables[0]?.id || '');
  const [fromColumn, setFromColumn] = useState('');
  const [toTable, setToTable] = useState(tables[1]?.id || tables[0]?.id || '');
  const [toColumn, setToColumn] = useState('');
  const [cardinality, setCardinality] = useState<'1:N' | 'N:1' | '1:1' | 'N:N'>('N:1');
  const [crossFilterDirection, setCrossFilterDirection] = useState<'single' | 'both'>('single');

  const selectedFromTableObj = tables.find(t => t.id === fromTable || t.name === fromTable) || tables[0];
  const selectedToTableObj = tables.find(t => t.id === toTable || t.name === toTable) || tables[1] || tables[0];

  const handleOpenModal = () => {
    // Smart default: pick a fact table (or last imported table) and a dimension table
    const factTbl = tables.find(t => !t.isDim && !t.isCalendar) || tables[tables.length - 1] || tables[0];
    const dimTbl = tables.find(t => t.isCalendar || t.isDim) || tables.find(t => t.id !== factTbl?.id) || tables[0];

    const source = factTbl || tables[0];
    const target = dimTbl || tables[1] || tables[0];

    if (source) {
      setFromTable(source.id);
      // If source has 'Data', prefer 'Data'
      const hasDate = source.columns.find(c => c.name.toLowerCase() === 'data' || c.dataType === 'date');
      const defaultCol = hasDate ? hasDate.name : source.columns[0]?.name || '';
      setFromColumn(defaultCol);

      if (target) {
        setToTable(target.id);
        // If target has column with same name, pick it
        const matchingCol = target.columns.find(c => c.name === defaultCol);
        setToColumn(matchingCol ? matchingCol.name : target.columns[0]?.name || '');
      }
    }

    setIsModalOpen(true);
  };

  const handleFromTableChange = (newTblId: string) => {
    setFromTable(newTblId);
    const tbl = tables.find(t => t.id === newTblId || t.name === newTblId);
    if (!tbl) return;

    // Keep current column if it exists in new table
    const exists = tbl.columns.some(c => c.name === fromColumn);
    let chosenCol = fromColumn;
    if (!exists) {
      const hasDate = tbl.columns.find(c => c.name.toLowerCase() === 'data');
      chosenCol = hasDate ? hasDate.name : tbl.columns[0]?.name || '';
      setFromColumn(chosenCol);
    }

    // Auto-match target column if target table has the same column
    if (selectedToTableObj && chosenCol) {
      const targetMatch = selectedToTableObj.columns.find(c => c.name === chosenCol);
      if (targetMatch) {
        setToColumn(targetMatch.name);
      }
    }
  };

  const handleToTableChange = (newToId: string) => {
    setToTable(newToId);
    const tbl = tables.find(t => t.id === newToId || t.name === newToId);
    if (!tbl) return;

    // Prefer column that matches fromColumn
    const matching = tbl.columns.find(c => c.name === fromColumn);
    if (matching) {
      setToColumn(matching.name);
    } else {
      const exists = tbl.columns.some(c => c.name === toColumn);
      if (!exists) {
        setToColumn(tbl.columns[0]?.name || '');
      }
    }
  };

  const handleFromColumnChange = (newCol: string) => {
    setFromColumn(newCol);
    // If destination table has identical column name (e.g. 'Data' or 'ID_Cliente'), auto-match it!
    if (selectedToTableObj) {
      const targetMatch = selectedToTableObj.columns.find(c => c.name === newCol);
      if (targetMatch) {
        setToColumn(targetMatch.name);
      }
    }
  };

  const handleCreateRelationship = () => {
    if (!selectedFromTableObj || !selectedToTableObj) {
      alert('Selecione tabelas válidas.');
      return;
    }
    if (!fromColumn || !toColumn) {
      alert('Selecione uma coluna válida para ambas as tabelas.');
      return;
    }
    if (selectedFromTableObj.name === selectedToTableObj.name && fromColumn === toColumn) {
      alert('Não é possível criar um relacionamento da mesma tabela e coluna com ela mesma.');
      return;
    }

    // Check if duplicate
    const alreadyExists = relationships.some(
      r =>
        ((r.fromTable === selectedFromTableObj.name && r.toTable === selectedToTableObj.name) ||
         (r.fromTable === selectedFromTableObj.id && r.toTable === selectedToTableObj.id)) &&
        r.fromColumn === fromColumn &&
        r.toColumn === toColumn
    );
    if (alreadyExists) {
      alert(`Este relacionamento entre ${selectedFromTableObj.name}[${fromColumn}] e ${selectedToTableObj.name}[${toColumn}] já existe.`);
      return;
    }

    const newRel: Relationship = {
      id: 'rel_' + Math.random().toString(36).substr(2, 6),
      fromTable: selectedFromTableObj.name,
      fromColumn: fromColumn,
      toTable: selectedToTableObj.name,
      toColumn: toColumn,
      cardinality,
      crossFilterDirection,
      isActive: true,
    };

    addRelationship(newRel);
    setIsModalOpen(false);
  };

  // Interactive Click-to-Connect column handler
  const handleColumnClick = (table: Table, colName: string) => {
    if (!connectingSource) {
      // Step 1: select source column
      setConnectingSource({
        tableId: table.id,
        tableName: table.name,
        columnName: colName,
      });
    } else {
      // Step 2: select target column
      if (connectingSource.tableId === table.id) {
        // Clicked same table, change selection
        if (connectingSource.columnName === colName) {
          setConnectingSource(null);
        } else {
          setConnectingSource({
            tableId: table.id,
            tableName: table.name,
            columnName: colName,
          });
        }
        return;
      }

      // Create relationship between connectingSource and this clicked column
      const sourceTbl = tables.find(t => t.id === connectingSource.tableId) || tables[0];
      const targetTbl = table;

      const newRel: Relationship = {
        id: 'rel_' + Math.random().toString(36).substr(2, 6),
        fromTable: sourceTbl.name,
        fromColumn: connectingSource.columnName,
        toTable: targetTbl.name,
        toColumn: colName,
        cardinality: 'N:1',
        crossFilterDirection: 'single',
        isActive: true,
      };

      addRelationship(newRel);
      setConnectingSource(null);
    }
  };

  const handleAutoDetect = () => {
    let detected = 0;
    tables.forEach(t1 => {
      tables.forEach(t2 => {
        if (t1.id !== t2.id) {
          t1.columns.forEach(c1 => {
            // Check for match:
            // 1. Column named 'Data' or 'Date'
            // 2. Column starting with 'ID_'
            // 3. Exact matching name
            const matchCol = t2.columns.find(
              c2 =>
                c2.name === c1.name &&
                (c1.name.toLowerCase() === 'data' ||
                 c1.name.toLowerCase() === 'date' ||
                 c1.name.startsWith('ID_') ||
                 c1.dataType === c2.dataType)
            );

            if (matchCol) {
              const alreadyExists = relationships.some(
                r =>
                  (r.fromTable === t1.name && r.toTable === t2.name && r.fromColumn === c1.name && r.toColumn === matchCol.name) ||
                  (r.fromTable === t2.name && r.toTable === t1.name && r.fromColumn === matchCol.name && r.toColumn === c1.name) ||
                  (r.fromTable === t1.id && r.toTable === t2.id && r.fromColumn === c1.name && r.toColumn === matchCol.name) ||
                  (r.fromTable === t2.id && r.toTable === t1.id && r.fromColumn === matchCol.name && r.toColumn === c1.name)
              );

              if (!alreadyExists) {
                // If t2 is dim or calendar, make t1 -> t2
                const fromT = t2.isCalendar || t2.isDim ? t1 : t2;
                const toT = t2.isCalendar || t2.isDim ? t2 : t1;
                const fromC = fromT === t1 ? c1.name : matchCol.name;
                const toC = fromT === t1 ? matchCol.name : c1.name;

                addRelationship({
                  id: 'rel_auto_' + Math.random().toString(36).substr(2, 6),
                  fromTable: fromT.name,
                  fromColumn: fromC,
                  toTable: toT.name,
                  toColumn: toC,
                  cardinality: 'N:1',
                  crossFilterDirection: 'single',
                  isActive: true,
                });
                detected++;
              }
            }
          });
        }
      });
    });

    alert(detected > 0 ? `${detected} relacionamentos detectados e criados automaticamente!` : 'Nenhum novo relacionamento pendente encontrado.');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden select-none relative">
      {/* Top Model Control Bar */}
      <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-amber-500" />
          <span className="font-bold text-slate-800 text-sm">Visualização de Modelo Semântico</span>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-medium">
            Esquema Estrela • {tables.length} tabelas • {relationships.length} relacionamentos
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoDetect}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition-colors"
            title="Detectar automaticamente colunas correspondentes (Data, ID_*, etc.)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Auto Detectar Relações</span>
          </button>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-xs transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Relacionamento</span>
          </button>
        </div>
      </div>

      {/* Interactive Linking Prompt Bar */}
      {connectingSource && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 flex items-center justify-between text-xs font-bold shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 animate-pulse" />
            <span>
              Origem selecionada: <strong>{connectingSource.tableName}[{connectingSource.columnName}]</strong>. Agora clique em uma coluna na tabela de destino para criar a relação!
            </span>
          </div>
          <button
            onClick={() => setConnectingSource(null)}
            className="bg-black/20 hover:bg-black/30 text-white rounded px-2 py-0.5 text-[11px] flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancelar</span>
          </button>
        </div>
      )}

      {/* Diagram Canvas with Entity Cards */}
      <div className="flex-1 overflow-auto p-8 relative flex flex-wrap gap-8 items-start justify-center">
        {tables.map(table => {
          const isFact = !table.isDim && !table.isCalendar;
          const relatedRels = relationships.filter(
            r => r.fromTable === table.id || r.toTable === table.id || r.fromTable === table.name || r.toTable === table.name
          );

          return (
            <div
              key={table.id}
              className={`w-64 bg-white rounded-xl shadow-md border transition-all hover:shadow-lg flex flex-col overflow-hidden ${
                isFact ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-300'
              }`}
            >
              {/* Card Header */}
              <div
                className={`p-2.5 flex items-center justify-between text-xs font-bold border-b ${
                  isFact ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  {table.isCalendar ? (
                    <Calendar className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Database className="w-4 h-4 opacity-80" />
                  )}
                  <span className="truncate">{table.name}</span>
                </div>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-black/20">
                  {isFact ? 'Fato' : table.isCalendar ? 'Calendário' : 'Dimensão'}
                </span>
              </div>

              {/* Columns List - Clickable for fast linking */}
              <div className="p-2 space-y-1 max-h-64 overflow-y-auto text-[11px]">
                {table.columns.map(col => {
                  const isKey = col.name.startsWith('ID_') || col.name.toLowerCase() === 'data' || col.dataType === 'date';
                  const isConnected = relatedRels.some(r => r.fromColumn === col.name || r.toColumn === col.name);
                  const isSourceSelected =
                    connectingSource?.tableId === table.id && connectingSource?.columnName === col.name;

                  return (
                    <div
                      key={col.id || col.name}
                      onClick={() => handleColumnClick(table, col.name)}
                      className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-all ${
                        isSourceSelected
                          ? 'bg-amber-400 text-slate-950 font-bold shadow-xs ring-2 ring-amber-500'
                          : isConnected
                          ? 'bg-amber-50/90 font-semibold text-amber-900 border border-amber-200 hover:bg-amber-100'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      title="Clique para conectar esta coluna com outra tabela"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {isKey ? <Key className="w-3 h-3 text-amber-500 shrink-0" /> : null}
                        <span className="truncate">{col.name}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 uppercase font-mono">{col.dataType}</span>
                    </div>
                  );
                })}
              </div>

              {/* Card Footer: Relationship summary */}
              <div className="p-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
                <span>{table.rows.length} registros</span>
                <span className="font-semibold text-slate-700">{relatedRels.length} conexões</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Relationships Table at Bottom */}
      <div className="bg-white border-t border-slate-200 p-3 max-h-52 overflow-y-auto text-xs shrink-0">
        <div className="font-semibold text-slate-700 mb-2 flex items-center justify-between">
          <span>Relacionamentos Ativos no Modelo Semântico</span>
          <span className="text-slate-400 text-[11px] font-normal">
            Filtros se propagam automaticamente através dessas regras de junção.
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {relationships.map(rel => (
            <div
              key={rel.id}
              className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <div className="flex flex-col gap-0.5">
                <div className="font-bold text-slate-900 text-[11px] flex items-center gap-1.5">
                  <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {rel.fromTable}[{rel.fromColumn}]
                  </span>
                  {rel.crossFilterDirection === 'both' ? (
                    <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  )}
                  <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {rel.toTable}[{rel.toColumn}]
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Cardinalidade: <span className="font-semibold text-slate-700">{rel.cardinality}</span> • Direção:{' '}
                  <span className="font-semibold text-slate-700">
                    {rel.crossFilterDirection === 'both' ? 'Ambas' : 'Única'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => deleteRelationship(rel.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                title="Excluir relacionamento"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {relationships.length === 0 && (
            <div className="col-span-3 text-center py-4 text-slate-400">
              Nenhum relacionamento criado ainda. Clique em "Novo Relacionamento" ou em uma coluna para conectar tabelas.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Relationship */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500 rounded-lg text-slate-950 font-bold">
                  <Link2 className="w-4 h-4" />
                </div>
                <span className="font-bold text-slate-900 text-sm">Criar Relacionamento de Modelo</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* FROM TABLE */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">De: Tabela de Origem</label>
                <select
                  value={fromTable}
                  onChange={(e) => handleFromTableChange(e.target.value)}
                  className="w-full border rounded-lg p-2 bg-slate-50 font-bold text-slate-800"
                >
                  {tables.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* FROM COLUMN */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Coluna de Origem</label>
                <select
                  value={fromColumn}
                  onChange={(e) => handleFromColumnChange(e.target.value)}
                  className="w-full border rounded-lg p-2 bg-slate-50 font-bold text-amber-800"
                >
                  {selectedFromTableObj?.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.dataType})
                    </option>
                  ))}
                </select>
              </div>

              {/* TO TABLE */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Para: Tabela de Destino</label>
                <select
                  value={toTable}
                  onChange={(e) => handleToTableChange(e.target.value)}
                  className="w-full border rounded-lg p-2 bg-slate-50 font-bold text-slate-800"
                >
                  {tables.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* TO COLUMN */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Coluna de Destino</label>
                <select
                  value={toColumn}
                  onChange={(e) => setToColumn(e.target.value)}
                  className="w-full border rounded-lg p-2 bg-slate-50 font-bold text-amber-800"
                >
                  {selectedToTableObj?.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.dataType})
                    </option>
                  ))}
                </select>
              </div>

              {/* Cardinality */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Cardinalidade</label>
                <select
                  value={cardinality}
                  onChange={(e) => setCardinality(e.target.value as any)}
                  className="w-full border rounded-lg p-2 bg-slate-50"
                >
                  <option value="N:1">Muitos para um (N:1)</option>
                  <option value="1:N">Um para muitos (1:N)</option>
                  <option value="1:1">Um para um (1:1)</option>
                  <option value="N:N">Muitos para muitos (N:N)</option>
                </select>
              </div>

              {/* Cross Filter Direction */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Direção do Filtro Cruzado</label>
                <select
                  value={crossFilterDirection}
                  onChange={(e) => setCrossFilterDirection(e.target.value as any)}
                  className="w-full border rounded-lg p-2 bg-slate-50"
                >
                  <option value="single">Única (Padrão)</option>
                  <option value="both">Ambas (Bidirecional)</option>
                </select>
              </div>
            </div>

            {/* Live Relationship Preview Box */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-[10px] uppercase font-bold text-amber-800 block mb-1.5">
                Regra de Relacionamento Selecionada:
              </span>
              <div className="font-mono text-xs font-bold text-slate-900 flex items-center gap-2">
                <span className="bg-white px-2.5 py-1 rounded border border-amber-300">
                  {selectedFromTableObj?.name}[{fromColumn}]
                </span>
                <span className="text-amber-600 font-bold">➔</span>
                <span className="bg-white px-2.5 py-1 rounded border border-amber-300">
                  {selectedToTableObj?.name}[{toColumn}]
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateRelationship}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-xs transition-colors"
              >
                Salvar Relacionamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
