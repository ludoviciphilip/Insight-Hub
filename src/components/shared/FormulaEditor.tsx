import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Code,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Maximize2,
  Minimize2,
  HelpCircle,
  Layers,
  Wand2,
} from 'lucide-react';
import { Table, Measure, Column } from '../../types/bi';
import { FUNCTION_REGISTRY, getAllFunctionNames } from '../../engine/expr/registry';
import { validateDax, DaxValidationResult } from '../../engine/expr/validator';
import { PowerBiColumnEngine } from '../../engine/powerBiColumnEngine';

export interface FormulaEditorProps {
  value: string;
  onChange: (val: string) => void;
  dialect?: 'dax' | 'column';
  tables?: Table[];
  measures?: Measure[];
  columns?: Column[];
  sampleRow?: Record<string, any>;
  placeholder?: string;
  rows?: number;
  minHeight?: string;
}

interface SuggestionItem {
  label: string;
  insertText: string;
  kind: 'function' | 'column' | 'measure' | 'table' | 'keyword';
  detail?: string;
  syntax?: string;
}

export const FormulaEditor: React.FC<FormulaEditorProps> = ({
  value,
  onChange,
  dialect = 'dax',
  tables = [],
  measures = [],
  columns = [],
  sampleRow,
  placeholder = 'Digite a fórmula aqui...',
  rows = 5,
  minHeight = '120px',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPos, setCursorPos] = useState<number>(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [suggestionPrefix, setSuggestionPrefix] = useState<string>('');
  const [suggestionTrigger, setSuggestionTrigger] = useState<string>('');

  // Collect all available symbols
  const allSymbols = useMemo(() => {
    const list: SuggestionItem[] = [];

    // Functions
    for (const [name, fn] of Object.entries(FUNCTION_REGISTRY)) {
      list.push({
        label: name,
        insertText: `${name}(`,
        kind: 'function',
        detail: fn.description,
        syntax: fn.syntax,
      });
    }

    // Additional common DAX aggregations & filters
    const extraDax = [
      { name: 'CALCULATE', syntax: 'CALCULATE(Expr, Filter1, ...)', detail: 'Modifica o contexto de filtro da expressão' },
      { name: 'ALL', syntax: 'ALL(Table_or_Column)', detail: 'Remove filtros de tabela ou coluna' },
      { name: 'ALLEXCEPT', syntax: 'ALLEXCEPT(Table, Col1, ...)', detail: 'Remove todos os filtros exceto nas colunas especificadas' },
      { name: 'FILTER', syntax: 'FILTER(Table, Condition)', detail: 'Filtra uma tabela linha a linha' },
      { name: 'SUM', syntax: 'SUM(Table[Column])', detail: 'Soma todos os números de uma coluna' },
      { name: 'AVERAGE', syntax: 'AVERAGE(Table[Column])', detail: 'Calcula a média de uma coluna' },
      { name: 'MIN', syntax: 'MIN(Table[Column])', detail: 'Retorna o menor valor de uma coluna' },
      { name: 'MAX', syntax: 'MAX(Table[Column])', detail: 'Retorna o maior valor de uma coluna' },
      { name: 'COUNT', syntax: 'COUNT(Table[Column])', detail: 'Conta valores existentes em uma coluna' },
      { name: 'COUNTROWS', syntax: 'COUNTROWS(Table)', detail: 'Conta o total de linhas da tabela' },
      { name: 'DISTINCTCOUNT', syntax: 'DISTINCTCOUNT(Table[Column])', detail: 'Conta valores únicos em uma coluna' },
      { name: 'RELATED', syntax: 'RELATED(Table[Column])', detail: 'Obtém valor correspondente em tabela relacionada' },
    ];
    for (const extra of extraDax) {
      if (!list.some(item => item.label === extra.name)) {
        list.push({
          label: extra.name,
          insertText: `${extra.name}(`,
          kind: 'function',
          detail: extra.detail,
          syntax: extra.syntax,
        });
      }
    }

    // Measures
    for (const m of measures) {
      list.push({
        label: `[${m.name}]`,
        insertText: `[${m.name}]`,
        kind: 'measure',
        detail: `Medida: ${m.tableName}`,
        syntax: m.formula,
      });
    }

    // Columns from current columns prop or tables
    const colSet = new Set<string>();
    for (const c of columns) {
      colSet.add(c.name);
      list.push({
        label: `[${c.name}]`,
        insertText: `[${c.name}]`,
        kind: 'column',
        detail: `Coluna (${c.dataType || 'text'})`,
      });
    }

    for (const t of tables) {
      // Table suggestion
      list.push({
        label: `'${t.name}'`,
        insertText: `'${t.name}'`,
        kind: 'table',
        detail: `Tabela: ${t.rows?.length || 0} linhas`,
      });

      // Table[Column]
      for (const c of t.columns || []) {
        if (!colSet.has(c.name)) {
          colSet.add(c.name);
          list.push({
            label: `${t.name}[${c.name}]`,
            insertText: `${t.name}[${c.name}]`,
            kind: 'column',
            detail: `Coluna da tabela ${t.name}`,
          });
        }
      }
    }

    // Keywords
    const keywords = ['VAR', 'RETURN', 'NOT', 'IN', 'TRUE()', 'FALSE()', 'BLANK()'];
    for (const kw of keywords) {
      list.push({
        label: kw,
        insertText: kw.endsWith('()') ? kw : `${kw} `,
        kind: 'keyword',
        detail: 'Palavra-chave DAX',
      });
    }

    return list;
  }, [tables, measures, columns]);

  // Validation
  const validation: DaxValidationResult = useMemo(() => {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return {
        isValid: true,
        referencedTables: [],
        referencedColumns: [],
        referencedMeasures: [],
      };
    }

    if (dialect === 'column') {
      // In column dialect, test evaluation on sample row or empty row
      const testRow = sampleRow || {};
      const res = PowerBiColumnEngine.evaluateRowDetailed(trimmed, testRow, 0, columns);
      if (res.error) {
        return {
          isValid: false,
          errorMessage: res.error,
          referencedTables: [],
          referencedColumns: [],
          referencedMeasures: [],
        };
      }
      return {
        isValid: true,
        referencedTables: [],
        referencedColumns: [],
        referencedMeasures: [],
      };
    }

    // DAX dialect validation
    return validateDax(trimmed, tables, measures);
  }, [value, dialect, tables, measures, columns, sampleRow]);

  // Track cursor position and trigger autocomplete
  const handleKeyUpOrClick = () => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    setCursorPos(pos);

    const textBefore = value.slice(0, pos);
    // Find current word or token before cursor
    const bracketMatch = textBefore.match(/\[([a-zA-Z0-9_\u00C0-\u017F ]*)$/);
    const quoteMatch = textBefore.match(/'([a-zA-Z0-9_\u00C0-\u017F ]*)$/);
    const wordMatch = textBefore.match(/([a-zA-Z0-9_\u00C0-\u017F\.]+)$/);

    if (bracketMatch) {
      const prefix = bracketMatch[1].toLowerCase();
      setSuggestionPrefix(bracketMatch[1]);
      setSuggestionTrigger('[');
      const filtered = allSymbols.filter(
        s => (s.kind === 'column' || s.kind === 'measure') && s.label.toLowerCase().includes(prefix)
      );
      setSuggestions(filtered.slice(0, 10));
      setSelectedSuggestionIdx(0);
      setShowSuggestions(filtered.length > 0);
    } else if (quoteMatch) {
      const prefix = quoteMatch[1].toLowerCase();
      setSuggestionPrefix(quoteMatch[1]);
      setSuggestionTrigger("'");
      const filtered = allSymbols.filter(
        s => s.kind === 'table' && s.label.toLowerCase().includes(prefix)
      );
      setSuggestions(filtered.slice(0, 10));
      setSelectedSuggestionIdx(0);
      setShowSuggestions(filtered.length > 0);
    } else if (wordMatch && wordMatch[1].length >= 2) {
      const prefix = wordMatch[1].toLowerCase();
      setSuggestionPrefix(wordMatch[1]);
      setSuggestionTrigger('');
      const filtered = allSymbols.filter(
        s => s.label.toLowerCase().includes(prefix)
      );
      setSuggestions(filtered.slice(0, 10));
      setSelectedSuggestionIdx(0);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const applySuggestion = (item: SuggestionItem) => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const textBefore = value.slice(0, pos);
    const textAfter = value.slice(pos);

    let replaceStart = pos;
    if (suggestionTrigger === '[') {
      const match = textBefore.match(/\[([a-zA-Z0-9_\u00C0-\u017F ]*)$/);
      if (match) replaceStart = pos - match[0].length;
    } else if (suggestionTrigger === "'") {
      const match = textBefore.match(/'([a-zA-Z0-9_\u00C0-\u017F ]*)$/);
      if (match) replaceStart = pos - match[0].length;
    } else {
      const match = textBefore.match(/([a-zA-Z0-9_\u00C0-\u017F\.]+)$/);
      if (match) replaceStart = pos - match[0].length;
    }

    const newText = value.slice(0, replaceStart) + item.insertText + textAfter;
    onChange(newText);
    setShowSuggestions(false);

    // Reposition cursor
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = replaceStart + item.insertText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIdx(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIdx(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      applySuggestion(suggestions[selectedSuggestionIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSuggestions(false);
    }
  };

  // Formatter helper: Clean DAX indentation & linebreaks
  const formatDaxCode = () => {
    let code = (value || '').trim();
    if (!code) return;

    // Normalize spacing
    code = code.replace(/\r\n/g, '\n');

    // Indent VAR / RETURN blocks
    code = code.replace(/\bVAR\b\s+/gi, '\nVAR ');
    code = code.replace(/\bRETURN\b\s+/gi, '\nRETURN\n    ');

    // Add newline after top-level CALCULATE/IF opening paren
    code = code.replace(/(CALCULATE|SWITCH|IF)\s*\(\s*/gi, (match) => `${match.trim()}\n    `);

    // Clean multiple empty lines
    code = code.replace(/\n{3,}/g, '\n\n').trim();

    onChange(code);
  };

  return (
    <div className="flex flex-col relative font-sans">
      {/* Top action toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 rounded-t-xl border border-slate-700 text-slate-300 text-xs">
        <div className="flex items-center gap-2">
          <Code className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-slate-200">
            {dialect === 'dax' ? 'Editor DAX' : 'Editor de Coluna Power Query'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 uppercase font-mono">
            {dialect}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={formatDaxCode}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-amber-300 hover:text-amber-200 transition-colors text-[11px] font-medium"
            title="Formatar espaçamentos e recuos do código DAX"
          >
            <Wand2 className="w-3 h-3" />
            <span>Formatar</span>
          </button>
        </div>
      </div>

      {/* Code Textarea with autocomplete */}
      <div className="relative bg-slate-950 border-x border-slate-700 focus-within:border-amber-500">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={handleKeyUpOrClick}
          onClick={handleKeyUpOrClick}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          style={{ minHeight }}
          spellCheck={false}
          className="w-full p-3 font-mono text-xs text-amber-200 bg-transparent focus:outline-none resize-y leading-relaxed"
        />

        {/* Autocomplete Popup */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            className="absolute z-50 left-4 top-12 w-80 max-h-56 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 text-xs"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex justify-between">
              <span>Sugestões disponíveis</span>
              <span>Tab / Enter</span>
            </div>
            {suggestions.map((item, idx) => (
              <div
                key={item.label + idx}
                onClick={() => applySuggestion(item)}
                onMouseEnter={() => setSelectedSuggestionIdx(idx)}
                className={`px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                  idx === selectedSuggestionIdx
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase font-bold shrink-0 ${
                      item.kind === 'function'
                        ? 'bg-blue-500/20 text-blue-300'
                        : item.kind === 'measure'
                        ? 'bg-purple-500/20 text-purple-300'
                        : item.kind === 'column'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {item.kind === 'function'
                      ? 'fx'
                      : item.kind === 'measure'
                      ? '[M]'
                      : item.kind === 'column'
                      ? '[C]'
                      : 'tab'}
                  </span>
                  <span className="font-mono text-xs font-semibold truncate">{item.label}</span>
                </div>
                {item.detail && (
                  <span className="text-[10px] text-slate-400 ml-2 truncate max-w-[120px]">
                    {item.detail}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation status bar with inline error underlines and suggested fix */}
      <div
        className={`px-3 py-2 rounded-b-xl border border-slate-700 flex items-center justify-between text-xs transition-colors ${
          !value.trim()
            ? 'bg-slate-900 text-slate-400'
            : validation.isValid
            ? 'bg-slate-900 text-emerald-400'
            : 'bg-red-950/70 border-red-800/80 text-red-300'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {!value.trim() ? (
            <span className="text-[11px] text-slate-400">Insira uma expressão DAX. Digite "[" para listar colunas ou medidas.</span>
          ) : validation.isValid ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold text-[11px] text-emerald-300">
                Fórmula DAX válida
              </span>
              {validation.referencedColumns?.length > 0 && (
                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  (Colunas: {validation.referencedColumns.join(', ')})
                </span>
              )}
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium text-[11px] text-red-200">
                  {validation.errorMessage}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Shortcut hints */}
        <div className="flex items-center gap-2 text-[10px] text-slate-400 shrink-0">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[9px]">
              [
            </kbd>{' '}
            Colunas/Medidas
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[9px]">
              '
            </kbd>{' '}
            Tabelas
          </span>
        </div>
      </div>
    </div>
  );
};
