import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, FileCode, Check, Trash2, ArrowRight } from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { DaxEngine } from '../../engine/daxEngine';
import { Measure } from '../../types/bi';

export interface ParsedImportMeasure {
  id: string;
  tableName: string;
  measureName: string;
  formula: string;
  isValid: boolean;
  error?: string;
  isCollision: boolean;
  selected: boolean;
}

interface DaxImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DaxImportModal: React.FC<DaxImportModalProps> = ({ isOpen, onClose }) => {
  const { tables, measures, addMeasure, updateMeasure } = useBiStore();
  const [scriptText, setScriptText] = useState('');
  const [delimiter, setDelimiter] = useState<',' | ';'>(';');
  const [parsedItems, setParsedItems] = useState<ParsedImportMeasure[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  if (!isOpen) return null;

  const defaultTableName = tables[0]?.name || 'f_Vendas';

  const parseScript = () => {
    if (!scriptText.trim()) return;

    let text = scriptText;
    // Normalize delimiter if comma was selected
    if (delimiter === ';') {
      // In DAX pt-BR formulas, semicolons separate function arguments.
    }

    const items: ParsedImportMeasure[] = [];

    // Regex 1: DEFINE MEASURE 'Table'[Name] = <formula> or MEASURE 'Table'[Name] = <formula>
    const measureRegex = /(?:DEFINE\s+)?MEASURE\s+(?:'([^']+)'|([a-zA-Z_][a-zA-Z0-9_]*))\[([a-zA-Z_][a-zA-Z0-9_ ]*)\]\s*=\s*([\s\S]*?)(?=(?:(?:DEFINE\s+)?MEASURE|\s*$))/gi;
    let match: RegExpExecArray | null;

    let foundAny = false;
    while ((match = measureRegex.exec(text)) !== null) {
      foundAny = true;
      const tbl = match[1] || match[2] || defaultTableName;
      const name = match[3].trim();
      let formula = match[4].trim();

      // Clean trailing EVALUATE or DEFINE keywords if captured
      formula = formula.replace(/\n\s*EVALUATE[\s\S]*$/i, '').trim();

      const validation = DaxEngine.validate(formula, tables, measures);
      const collision = measures.some(m => m.name.toLowerCase() === name.toLowerCase());

      items.push({
        id: `imp_${Date.now()}_${items.length}`,
        tableName: tbl,
        measureName: name,
        formula,
        isValid: Boolean(validation.isValid),
        error: validation.errorMessage || validation.error,
        isCollision: collision,
        selected: Boolean(validation.isValid),
      });
    }

    // Fallback: If not standard MEASURE syntax, look for lines like: [MeasureName] = <formula> or Name = <formula>
    if (!foundAny) {
      const lineBlocks = text.split(/\n\s*\n/);
      for (const block of lineBlocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        const simpleMatch = trimmed.match(/^(?:\[([^\]]+)\]|([a-zA-Z_][a-zA-Z0-9_ ]*))\s*=\s*([\s\S]+)$/);
        if (simpleMatch) {
          const name = (simpleMatch[1] || simpleMatch[2]).trim();
          const formula = simpleMatch[3].trim();

          const validation = DaxEngine.validate(formula, tables, measures);
          const collision = measures.some(m => m.name.toLowerCase() === name.toLowerCase());

          items.push({
            id: `imp_${Date.now()}_${items.length}`,
            tableName: defaultTableName,
            measureName: name,
            formula,
            isValid: Boolean(validation.isValid),
            error: validation.errorMessage || validation.error,
            isCollision: collision,
            selected: Boolean(validation.isValid),
          });
        }
      }
    }

    setParsedItems(items);
    setHasParsed(true);
    setImportSummary(null);
  };

  const handleImport = () => {
    const selected = parsedItems.filter(i => i.selected);
    if (selected.length === 0) return;

    let addedCount = 0;
    let updatedCount = 0;

    for (const item of selected) {
      // Find matching table
      const targetTable =
        tables.find(t => t.name.toLowerCase() === item.tableName.toLowerCase()) ||
        tables[0];
      const tableId = targetTable ? targetTable.id : (tables[0]?.id || '');

      const existing = measures.find(m => m.name.toLowerCase() === item.measureName.toLowerCase());
      const tblName = targetTable ? targetTable.name : item.tableName;
      if (existing) {
        updateMeasure(existing.id, {
          formula: item.formula,
          tableName: tblName,
          tableId,
        });
        updatedCount++;
      } else {
        const newM: Measure = {
          id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: item.measureName,
          tableName: tblName,
          tableId,
          formula: item.formula,
          format: 'number',
        };
        addMeasure(newM);
        addedCount++;
      }
    }

    setImportSummary(`Importação concluída: ${addedCount} medidas adicionadas, ${updatedCount} atualizadas.`);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const toggleSelect = (id: string) => {
    setParsedItems(prev =>
      prev.map(item => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const sampleScript = `// Exemplo DAX Studio / Power BI Desktop
MEASURE 'f_Vendas'[Margem Bruta] = DIVIDE([Lucro], [Total Vendas], 0)
MEASURE 'f_Vendas'[Vendas Ano Anterior] = CALCULATE([Total Vendas], SAMEPERIODLASTYEAR('d_Calendario'[Data]))
MEASURE 'f_Vendas'[Meta Dinamica] = [Total Vendas] * 1.15`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded bg-amber-400/10 text-amber-400">
              <Upload className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Importador Power BI / DAX Studio</h2>
              <p className="text-xs text-slate-400">
                Cole scripts com definições de medidas para validação e importação em lote
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm px-2 py-1">
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!hasParsed ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Script DAX (Cole as medidas do Power BI Desktop ou DAX Studio):</span>
                <div className="flex items-center gap-2">
                  <span>Separador de argumentos:</span>
                  <select
                    value={delimiter}
                    onChange={e => setDelimiter(e.target.value as any)}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-200"
                  >
                    <option value=";">Ponto e vírgula (; / pt-BR)</option>
                    <option value=",">Vírgula (, / en-US)</option>
                  </select>
                  <button
                    onClick={() => setScriptText(sampleScript)}
                    className="text-amber-400 hover:underline"
                  >
                    Preencher Exemplo
                  </button>
                </div>
              </div>

              <textarea
                value={scriptText}
                onChange={e => setScriptText(e.target.value)}
                placeholder={sampleScript}
                rows={12}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  {parsedItems.length} medida(s) identificada(s) no script. Revise antes de importar:
                </div>
                <button
                  onClick={() => setHasParsed(false)}
                  className="text-xs text-amber-400 hover:underline"
                >
                  ← Editar Script
                </button>
              </div>

              {importSummary && (
                <div className="p-3 rounded bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {importSummary}
                </div>
              )}

              <div className="border border-slate-800 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-3 w-10"></th>
                      <th className="p-3 font-medium">Nome da Medida</th>
                      <th className="p-3 font-medium">Tabela Alvo</th>
                      <th className="p-3 font-medium">Fórmula DAX</th>
                      <th className="p-3 font-medium">Validação</th>
                      <th className="p-3 font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                    {parsedItems.map(item => (
                      <tr key={item.id} className="hover:bg-slate-800/40">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            disabled={!item.isValid}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0"
                          />
                        </td>
                        <td className="p-3 font-mono font-semibold text-amber-300">
                          [{item.measureName}]
                        </td>
                        <td className="p-3 text-slate-300">{item.tableName}</td>
                        <td className="p-3 font-mono text-slate-400 max-w-xs truncate" title={item.formula}>
                          {item.formula}
                        </td>
                        <td className="p-3">
                          {item.isValid ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                              Válida
                            </span>
                          ) : (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 cursor-help"
                              title={item.error}
                            >
                              Erro Sintático
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {item.isCollision ? (
                            <span className="text-[10px] text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Sobrescrever
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Nova</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {hasParsed && `${parsedItems.filter(i => i.selected).length} selecionadas`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Cancelar
            </button>
            {!hasParsed ? (
              <button
                onClick={parseScript}
                disabled={!scriptText.trim()}
                className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-sm"
              >
                Analisar Script
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleImport}
                disabled={parsedItems.filter(i => i.selected).length === 0}
                className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                Importar Selecionadas ({parsedItems.filter(i => i.selected).length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
