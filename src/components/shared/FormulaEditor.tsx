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
  BookOpen,
  Search,
  X,
} from 'lucide-react';
import { Table, Measure, Column } from '../../types/bi';
import { FUNCTION_REGISTRY, getAllFunctionNames, POWER_BI_FUNCTIONS, FunctionDoc } from '../../engine/expr/registry';
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
  category?: string;
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
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<string>('Todas');

  // Collect all available symbols
  const allSymbols = useMemo(() => {
    const list: SuggestionItem[] = [];
    const addedFns = new Set<string>();

    // 1. All functions from POWER_BI_FUNCTIONS catalog
    for (const fn of POWER_BI_FUNCTIONS) {
      const up = fn.name.toUpperCase();
      if (!addedFns.has(up)) {
        addedFns.add(up);
        const isIter =
          up.endsWith('X') ||
          ['FILTER', 'ADDCOLUMNS', 'SELECTCOLUMNS', 'GENERATE', 'GENERATEALL', 'SUMMARIZE', 'SUMMARIZECOLUMNS', 'GROUPBY'].includes(up);
        list.push({
          label: fn.name,
          insertText: `${fn.name}(`,
          kind: 'function',
          detail: fn.description,
          syntax: fn.syntax,
          category: isIter ? 'Iterador' : fn.category,
        });
      }
    }

    // 2. Any additional functions in FUNCTION_REGISTRY
    for (const [name, fn] of Object.entries(FUNCTION_REGISTRY)) {
      const up = name.toUpperCase();
      if (!addedFns.has(up)) {
        addedFns.add(up);
        const isIter =
          up.endsWith('X') ||
          ['FILTER', 'ADDCOLUMNS', 'SELECTCOLUMNS', 'GENERATE', 'GENERATEALL', 'SUMMARIZE', 'SUMMARIZECOLUMNS', 'GROUPBY'].includes(up);
        list.push({
          label: name,
          insertText: `${name}(`,
          kind: 'function',
          detail: fn.description,
          syntax: fn.syntax,
          category: isIter ? 'Iterador' : fn.category,
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
    } else if (wordMatch && wordMatch[1].length >= 1) {
      const prefix = wordMatch[1].toLowerCase();
      setSuggestionPrefix(wordMatch[1]);
      setSuggestionTrigger('');
      const filtered = allSymbols.filter(
        s => s.label.toLowerCase().includes(prefix)
      );
      filtered.sort((a, b) => {
        const aL = a.label.toLowerCase();
        const bL = b.label.toLowerCase();
        const aExact = aL === prefix;
        const bExact = bL === prefix;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = aL.startsWith(prefix);
        const bStarts = bL.startsWith(prefix);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return aL.localeCompare(bL);
      });
      setSuggestions(filtered.slice(0, 25));
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

  const insertFunction = (fnName: string) => {
    const insertText = `${fnName}(`;
    if (!textareaRef.current) {
      onChange(value ? `${value} ${insertText}` : insertText);
      return;
    }
    const pos = textareaRef.current.selectionStart;
    const textBefore = value.slice(0, pos);
    const textAfter = value.slice(pos);
    const newText = textBefore + insertText + textAfter;
    onChange(newText);
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = pos + insertText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  // Filtered function list for catalog drawer
  const catalogFilteredFns = useMemo(() => {
    return POWER_BI_FUNCTIONS.filter(fn => {
      const up = fn.name.toUpperCase();
      const isIter =
        up.endsWith('X') ||
        ['FILTER', 'ADDCOLUMNS', 'SELECTCOLUMNS', 'GENERATE', 'GENERATEALL', 'SUMMARIZE', 'SUMMARIZECOLUMNS', 'GROUPBY'].includes(up);

      let matchesCat = true;
      if (catalogCategory === 'Iteradores (X)') {
        matchesCat = isIter;
      } else if (catalogCategory !== 'Todas') {
        matchesCat = fn.category === catalogCategory;
      }

      const q = catalogSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        fn.name.toLowerCase().includes(q) ||
        fn.description.toLowerCase().includes(q) ||
        fn.syntax.toLowerCase().includes(q);

      return matchesCat && matchesSearch;
    });
  }, [catalogCategory, catalogSearch]);

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
            onClick={() => setShowCatalog(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors text-[11px] font-semibold ${
              showCatalog
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white'
            }`}
            title="Abrir catálogo completo de funções DAX e iteradores"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Catálogo DAX ({POWER_BI_FUNCTIONS.length})</span>
          </button>

          <button
            type="button"
            onClick={formatDaxCode}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-300 hover:text-amber-200 transition-colors text-[11px] font-medium"
            title="Formatar espaçamentos e recuos do código DAX"
          >
            <Wand2 className="w-3 h-3" />
            <span>Formatar</span>
          </button>
        </div>
      </div>

      {/* Interactive Catalog Drawer */}
      {showCatalog && (
        <div className="bg-slate-900 border-x border-b border-slate-700 p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 text-xs z-30">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Pesquisar função DAX (ex.: SUMX, FILTER, CALCULATE...)"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
              />
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => setCatalogSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowCatalog(false)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs"
              title="Fechar catálogo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1">
            {[
              'Todas',
              'Iteradores (X)',
              'Agregação',
              'Filtro',
              'Tabela',
              'Lógica / Condicional',
              'Texto',
              'Matemática',
              'Data',
              'Informação',
            ].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatalogCategory(cat)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                  catalogCategory === cat
                    ? cat === 'Iteradores (X)'
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'bg-amber-500 text-slate-950'
                    : cat === 'Iteradores (X)'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Quick Iterators bar */}
          <div className="flex items-center gap-1 overflow-x-auto py-1 border-t border-slate-800 text-[10px]">
            <span className="text-amber-400 font-bold shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Iteradores Rápidos:
            </span>
            {['SUMX', 'AVERAGEX', 'COUNTX', 'MINX', 'MAXX', 'CONCATENATEX', 'FILTER', 'ADDCOLUMNS', 'TOPN'].map(itFn => (
              <button
                key={itFn}
                type="button"
                onClick={() => insertFunction(itFn)}
                className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-semibold shrink-0"
              >
                {itFn}()
              </button>
            ))}
          </div>

          {/* Functions List */}
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {catalogFilteredFns.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-xs">
                Nenhuma função encontrada para "{catalogSearch}".
              </div>
            ) : (
              catalogFilteredFns.map(fn => (
                <div
                  key={fn.name}
                  className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 flex items-start justify-between gap-3 group transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-amber-300">{fn.name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                        {fn.category}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 mb-0.5">{fn.syntax}</div>
                    <p className="text-[11px] text-slate-300 leading-normal">{fn.description}</p>
                    {fn.example && (
                      <div className="mt-1 font-mono text-[10px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/40 inline-block">
                        Ex.: {fn.example}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => insertFunction(fn.name)}
                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] shrink-0 shadow-xs transition-colors"
                  >
                    Inserir
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
            className="absolute z-50 left-4 top-12 w-96 max-h-60 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 text-xs"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex justify-between">
              <span>Sugestões disponíveis ({suggestions.length})</span>
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
                      ? (item.category === 'Iterador' ? 'iter' : 'fx')
                      : item.kind === 'measure'
                      ? '[M]'
                      : item.kind === 'column'
                      ? '[C]'
                      : 'tab'}
                  </span>
                  <div className="flex flex-col truncate">
                    <span className="font-mono text-xs font-semibold truncate text-white">{item.label}</span>
                    {item.syntax && (
                      <span className="font-mono text-[9px] text-slate-400 truncate">{item.syntax}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {item.category && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                      {item.category}
                    </span>
                  )}
                  {item.detail && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                      {item.detail}
                    </span>
                  )}
                </div>
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
