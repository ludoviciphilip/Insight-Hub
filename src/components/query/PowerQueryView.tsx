import React, { useState, useMemo } from 'react';
import {
  Sliders,
  Type,
  Hash,
  Calendar,
  Split,
  Replace,
  Trash2,
  Plus,
  Code,
  CheckCircle,
  Database,
  ArrowDownNarrowWide,
  Layers,
  Sparkles,
  Copy,
  Search,
  Check,
  X,
  AlertCircle,
  Table as TableIcon,
  HelpCircle,
  BookOpen,
  ArrowDown,
  ArrowUp,
  Clock,
  ListOrdered,
  Filter,
  Scissors,
  ChevronDown,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { PowerQueryStep, Table, DataType } from '../../types/bi';
import { POWER_BI_FUNCTIONS, PowerBiColumnEngine, FunctionDoc } from '../../engine/powerBiColumnEngine';
import { FormulaEditor } from '../shared/FormulaEditor';

export const PowerQueryView: React.FC = () => {
  const {
    tables,
    appliedSteps,
    applyQueryStep,
    removeQueryStep,
    addTable,
    duplicateTable,
  } = useBiStore();

  const [activeQueryTab, setActiveQueryTab] = useState<'inicio' | 'transformar' | 'adicionarColuna'>('inicio');
  const [selectedTableId, setSelectedTableId] = useState<string>(tables[0]?.id || 'f_Vendas');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal Visibility States
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [showDimModal, setShowDimModal] = useState(false);
  const [showCustomColModal, setShowCustomColModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showRemoveColModal, setShowRemoveColModal] = useState(false);

  // Remove Rows Modal State
  const [showRemoveRowsModal, setShowRemoveRowsModal] = useState<{
    isOpen: boolean;
    type: 'removeTopRows' | 'removeBottomRows' | 'removeBlankRows' | 'keepTopRows' | 'keepBottomRows';
    count: number;
  }>({
    isOpen: false,
    type: 'removeTopRows',
    count: 10,
  });

  // Text Extract Modal State
  const [showTextExtractModal, setShowTextExtractModal] = useState<{
    isOpen: boolean;
    isNewCol: boolean;
    mode: 'firstChars' | 'lastChars' | 'range' | 'beforeDelimiter' | 'afterDelimiter' | 'betweenDelimiters';
    count: number;
    startPos: number;
    length: number;
    delimiter: string;
    startDelimiter: string;
    endDelimiter: string;
    newColumnName: string;
  }>({
    isOpen: false,
    isNewCol: false,
    mode: 'firstChars',
    count: 5,
    startPos: 0,
    length: 5,
    delimiter: '-',
    startDelimiter: '(',
    endDelimiter: ')',
    newColumnName: '',
  });

  // Rename Column Form State
  const [renameTargetCol, setRenameTargetCol] = useState('');
  const [renameNewName, setRenameNewName] = useState('');
  const [renameError, setRenameError] = useState('');

  // Replace Values Form State
  const [replaceTargetCol, setReplaceTargetCol] = useState('');
  const [replaceOldVal, setReplaceOldVal] = useState('');
  const [replaceNewVal, setReplaceNewVal] = useState('');
  const [replaceExact, setReplaceExact] = useState(true);

  // Remove Column Form State
  const [removeTargetCol, setRemoveTargetCol] = useState('');

  // Custom Column Form State
  const [customColName, setCustomColName] = useState('Coluna_Personalizada');
  const [customColType, setCustomColType] = useState<DataType>('text');
  const [customFormula, setCustomFormula] = useState('');
  const [funcCategoryFilter, setFuncCategoryFilter] = useState<string>('Todas');
  const [funcSearchQuery, setFuncSearchQuery] = useState('');
  const [colSearchQuery, setColSearchQuery] = useState('');

  // New Dimension Table State
  const [dimCreationMode, setDimCreationMode] = useState<'extract' | 'manual'>('extract');
  const [dimExtractSourceTable, setDimExtractSourceTable] = useState(tables[0]?.name || 'f_Vendas');
  const [dimExtractColumn, setDimExtractColumn] = useState(tables[0]?.columns[0]?.name || '');
  const [newDimTableName, setNewDimTableName] = useState('d_NovaDimensao');

  // Manual Dim State
  const [manualDimName, setManualDimName] = useState('d_Categorias');
  const [manualColumns, setManualColumns] = useState('ID_Categoria, NomeCategoria');
  const [manualRows, setManualRows] = useState('1, Eletrônicos\n2, Mobiliário\n3, Alimentos\n4, Serviços');

  // Find currently active table
  const currentTable = tables.find(t => t.id === selectedTableId || t.name === selectedTableId) || tables[0];
  const steps = (currentTable ? appliedSteps[currentTable.id] : []) || [
    {
      id: 'step_source',
      name: 'Fonte de Dados',
      type: 'source',
      params: {},
      description: `Carregamento inicial de ${currentTable?.name}`,
    },
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper action: Open Rename Modal
  const openRenameModal = (colName?: string) => {
    const target = colName || selectedColumn || currentTable?.columns[0]?.name || '';
    setRenameTargetCol(target);
    setRenameNewName(target);
    setRenameError('');
    setShowRenameModal(true);
  };

  const handleConfirmRename = () => {
    const trimmed = renameNewName.trim();
    if (!trimmed) {
      setRenameError('O novo nome da coluna não pode ficar vazio.');
      return;
    }
    if (trimmed === renameTargetCol) {
      setShowRenameModal(false);
      return;
    }
    const exists = currentTable?.columns.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setRenameError(`Já existe uma coluna com o nome "${trimmed}".`);
      return;
    }

    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: `Coluna Renomeada (${renameTargetCol} -> ${trimmed})`,
      type: 'rename',
      params: { oldName: renameTargetCol, newName: trimmed },
      description: `Renomeou "${renameTargetCol}" para "${trimmed}"`,
    });

    setSelectedColumn(trimmed);
    setShowRenameModal(false);
    showToast(`Coluna renomeada para "${trimmed}"`);
  };

  // Helper action: Open Replace Modal
  const openReplaceModal = (colName?: string) => {
    const target = colName || selectedColumn || currentTable?.columns[0]?.name || '';
    setReplaceTargetCol(target);
    setReplaceOldVal('');
    setReplaceNewVal('');
    setShowReplaceModal(true);
  };

  const handleConfirmReplace = () => {
    if (!replaceTargetCol) return;

    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: `Valores Substituídos (${replaceTargetCol})`,
      type: 'replaceValues',
      params: {
        column: replaceTargetCol,
        oldValue: replaceOldVal,
        newValue: replaceNewVal,
        matchExact: replaceExact,
      },
      description: `Substituiu "${replaceOldVal}" por "${replaceNewVal}" em "${replaceTargetCol}"`,
    });

    setShowReplaceModal(false);
    showToast(`Valores substituídos na coluna "${replaceTargetCol}"`);
  };

  // Helper action: Open Remove Column Modal
  const openRemoveColModal = (colName?: string) => {
    const target = colName || selectedColumn || currentTable?.columns[0]?.name || '';
    setRemoveTargetCol(target);
    setShowRemoveColModal(true);
  };

  const handleConfirmRemoveColumn = () => {
    if (!removeTargetCol) return;

    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: `Coluna Removida (${removeTargetCol})`,
      type: 'removeColumns',
      params: { columnNames: [removeTargetCol] },
      description: `Coluna "${removeTargetCol}" foi removida da tabela`,
    });

    if (selectedColumn === removeTargetCol) {
      setSelectedColumn('');
    }
    setShowRemoveColModal(false);
    showToast(`Coluna "${removeTargetCol}" removida com sucesso`);
  };

  // Helper action: Duplicate Table
  const handleDuplicateTable = () => {
    if (!currentTable) return;
    const duplicated = duplicateTable(currentTable.id);
    if (duplicated) {
      setSelectedTableId(duplicated.id);
      setSelectedColumn('');
      showToast(`Consulta "${duplicated.name}" criada com sucesso!`);
    }
  };

  // Helper action: Change Data Type
  const handleChangeType = (newType: DataType) => {
    if (!selectedColumn) {
      showToast('Selecione uma coluna primeiro clicando no cabeçalho.');
      return;
    }
    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: `Tipo Alterado (${selectedColumn} -> ${newType})`,
      type: 'changeType',
      params: { columnName: selectedColumn, newType },
      description: `Converteu a coluna "${selectedColumn}" para ${newType.toUpperCase()}`,
    });
    showToast(`Tipo de "${selectedColumn}" alterado para ${newType.toUpperCase()}`);
  };

  // Helper action: Deduplicate
  const handleDeduplicate = () => {
    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: 'Remover Linhas Duplicadas',
      type: 'deduplicate',
      params: {},
      description: 'Removeu registros com valores idênticos em todas as colunas',
    });
    showToast('Linhas duplicadas removidas!');
  };

  // Helper action: Remove Other Columns
  const handleRemoveOtherColumns = () => {
    if (!selectedColumn) {
      showToast('Selecione uma coluna primeiro para mantê-la e remover as outras.');
      return;
    }
    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: `Outras Colunas Removidas (Mantida: ${selectedColumn})`,
      type: 'removeOtherColumns',
      params: { column: selectedColumn, keepColumns: [selectedColumn] },
      description: `Manteve "${selectedColumn}" e removeu todas as outras colunas`,
    });
    showToast(`Mantida "${selectedColumn}" e removidas as demais colunas`);
  };

  // Helper action: Use First Row As Headers
  const handleUseFirstRowAsHeaders = () => {
    if (!currentTable || currentTable.rows.length === 0) return;
    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: 'Usar Primeira Linha como Cabeçalho',
      type: 'useFirstRowAsHeaders',
      params: {},
      description: 'Promoveu os valores da primeira linha para nomes de cabeçalho de coluna',
    });
    setSelectedColumn('');
    showToast('Primeira linha promovida a cabeçalho');
  };

  // Helper action: Use Headers As First Row
  const handleUseHeadersAsFirstRow = () => {
    if (!currentTable) return;
    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: 'Usar Cabeçalho como Primeira Linha',
      type: 'useHeadersAsFirstRow',
      params: {},
      description: 'Rebaixou os cabeçalhos para a primeira linha de dados',
    });
    setSelectedColumn('');
    showToast('Cabeçalhos movidos para a primeira linha');
  };

  // Helper action: Detect Data Types
  const handleDetectDataTypes = () => {
    if (!currentTable) return;
    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: 'Tipos de Dados Detectados',
      type: 'detectDataTypes',
      params: {},
      description: 'Análise automática e detecção de tipos de dados (número, moeda, data, texto)',
    });
    showToast('Tipos de dados detectados e atualizados!');
  };

  // Helper action: Fill Down
  const handleFillDown = () => {
    if (!selectedColumn) {
      showToast('Selecione a coluna que deseja preencher para baixo.');
      return;
    }
    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: `Preencher Abaixo (${selectedColumn})`,
      type: 'fillDown',
      params: { column: selectedColumn },
      description: `Propagou os últimos valores válidos para baixo na coluna "${selectedColumn}"`,
    });
    showToast(`Preenchimento para baixo aplicado em "${selectedColumn}"`);
  };

  // Helper action: Fill Up
  const handleFillUp = () => {
    if (!selectedColumn) {
      showToast('Selecione a coluna que deseja preencher para cima.');
      return;
    }
    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: `Preencher Acima (${selectedColumn})`,
      type: 'fillUp',
      params: { column: selectedColumn },
      description: `Propagou os valores válidos para cima na coluna "${selectedColumn}"`,
    });
    showToast(`Preenchimento para cima aplicado em "${selectedColumn}"`);
  };

  // Helper action: Duplicate Selected Column
  const handleDuplicateSelectedColumn = () => {
    if (!selectedColumn) {
      showToast('Selecione a coluna que deseja duplicar.');
      return;
    }
    const copyName = `${selectedColumn} - Cópia`;
    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: `Coluna Duplicada (${copyName})`,
      type: 'duplicateColumn',
      params: { column: selectedColumn, newColumnName: copyName },
      description: `Duplicou a coluna "${selectedColumn}" como "${copyName}"`,
    });
    setSelectedColumn(copyName);
    showToast(`Coluna "${copyName}" criada!`);
  };

  // Helper action: Add Index Column
  const handleAddIndexColumn = (startIndex: number) => {
    const colName = startIndex === 0 ? 'Índice_0' : 'Índice';
    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: `Coluna de Índice Adicionada (Início: ${startIndex})`,
      type: 'addIndexColumn',
      params: { newColumnName: colName, startIndex },
      description: `Adicionou coluna de índice "${colName}" iniciando em ${startIndex}`,
    });
    setSelectedColumn(colName);
    showToast(`Coluna de índice "${colName}" adicionada com sucesso!`);
  };

  // Helper action: Text Transform
  const handleTextTransform = (mode: 'upper' | 'lower' | 'capitalize' | 'trim', isNewCol: boolean) => {
    if (!selectedColumn) {
      showToast('Selecione uma coluna de texto primeiro.');
      return;
    }
    const modeLabels: Record<string, string> = {
      upper: 'MAIÚSCULA',
      lower: 'minúscula',
      capitalize: 'Capitalizada',
      trim: 'Sem Espaços',
    };
    const label = modeLabels[mode] || mode;
    const newColName = isNewCol ? `${selectedColumn} (${label})` : selectedColumn;

    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: isNewCol ? `Coluna Formatada (${newColName})` : `Texto Formatado (${label})`,
      type: 'textTransform',
      params: { column: selectedColumn, mode, createNewColumn: isNewCol, newColumnName: newColName },
      description: isNewCol
        ? `Criou "${newColName}" aplicando formatação ${label} em "${selectedColumn}"`
        : `Aplicou formatação ${label} diretamente na coluna "${selectedColumn}"`,
    });

    if (isNewCol) setSelectedColumn(newColName);
    showToast(`Texto formatado (${label})${isNewCol ? ' em nova coluna' : ''}!`);
  };

  // Helper action: Date Extract / Transform
  const handleDateExtract = (
    part: 'year' | 'month' | 'monthName' | 'day' | 'dayOfWeek' | 'hour' | 'minute',
    isNewCol: boolean
  ) => {
    if (!selectedColumn) {
      showToast('Selecione uma coluna de data primeiro.');
      return;
    }
    const partLabels: Record<string, string> = {
      year: 'Ano',
      month: 'Mês',
      monthName: 'Nome do Mês',
      day: 'Dia',
      dayOfWeek: 'Dia da Semana',
      hour: 'Hora',
      minute: 'Minuto',
    };
    const label = partLabels[part] || part;
    const newColName = isNewCol ? `${selectedColumn} - ${label}` : selectedColumn;

    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: isNewCol ? `Extração de Data (${newColName})` : `Transformar Data em ${label}`,
      type: 'dateExtract',
      params: { column: selectedColumn, part, createNewColumn: isNewCol, newColumnName: newColName },
      description: isNewCol
        ? `Extraiu ${label} de "${selectedColumn}" para a nova coluna "${newColName}"`
        : `Transformou a coluna "${selectedColumn}" para ${label}`,
    });

    if (isNewCol) setSelectedColumn(newColName);
    showToast(`Extração de ${label}${isNewCol ? ' em nova coluna' : ''} concluída!`);
  };

  // Helper action: Open Text Extract Modal
  const openTextExtractModal = (mode: 'firstChars' | 'lastChars' | 'range' | 'beforeDelimiter' | 'afterDelimiter' | 'betweenDelimiters', isNewCol: boolean) => {
    if (!selectedColumn) {
      showToast('Selecione uma coluna primeiro.');
      return;
    }
    const modeNames: Record<string, string> = {
      firstChars: 'Primeiros',
      lastChars: 'Últimos',
      range: 'Intervalo',
      beforeDelimiter: 'AntesDelim',
      afterDelimiter: 'DepoisDelim',
      betweenDelimiters: 'EntreDelim',
    };
    setShowTextExtractModal({
      isOpen: true,
      isNewCol,
      mode,
      count: 5,
      startPos: 0,
      length: 5,
      delimiter: '-',
      startDelimiter: '(',
      endDelimiter: ')',
      newColumnName: `${selectedColumn} - ${modeNames[mode]}`,
    });
  };

  // Helper action: Confirm Text Extract
  const handleConfirmTextExtract = () => {
    const { mode, isNewCol, newColumnName, count, startPos, length, delimiter, startDelimiter, endDelimiter } = showTextExtractModal;
    if (!selectedColumn) {
      showToast('Selecione uma coluna primeiro.');
      return;
    }
    const modeNames: Record<string, string> = {
      firstChars: 'Primeiros Caracteres',
      lastChars: 'Últimos Caracteres',
      range: 'Intervalo',
      beforeDelimiter: 'Antes do Delimitador',
      afterDelimiter: 'Depois do Delimitador',
      betweenDelimiters: 'Entre Delimitadores',
    };
    const label = modeNames[mode] || mode;
    const colName = isNewCol ? (newColumnName.trim() || `${selectedColumn} - ${label}`) : selectedColumn;

    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: isNewCol ? `Texto Extraído (${colName})` : `Extrair (${label})`,
      type: 'textExtract',
      params: {
        column: selectedColumn,
        mode,
        count: Number(count) || 1,
        startPos: Number(startPos) || 0,
        length: Number(length) || 1,
        delimiter,
        startDelimiter,
        endDelimiter,
        createNewColumn: isNewCol,
        newColumnName: colName,
      },
      description: isNewCol
        ? `Extraiu ${label} de "${selectedColumn}" para nova coluna "${colName}"`
        : `Extraiu ${label} na coluna "${selectedColumn}"`,
    });

    if (isNewCol) setSelectedColumn(colName);
    setShowTextExtractModal(prev => ({ ...prev, isOpen: false }));
    showToast(`Extração de texto realizada com sucesso!`);
  };

  // Helper action: Confirm Remove / Keep Rows
  const handleConfirmRemoveRows = () => {
    const { type, count } = showRemoveRowsModal;
    const numCount = Math.max(1, Number(count) || 1);

    if (type === 'removeTopRows') {
      applyQueryStep(currentTable.id, {
        id: 'step_' + Math.random().toString(36).substring(2, 7),
        name: `Primeiras ${numCount} Linhas Removidas`,
        type: 'removeTopRows',
        params: { count: numCount },
        description: `Removeu as primeiras ${numCount} linhas da tabela`,
      });
      showToast(`${numCount} primeiras linhas removidas!`);
    } else if (type === 'removeBottomRows') {
      applyQueryStep(currentTable.id, {
        id: 'step_' + Math.random().toString(36).substring(2, 7),
        name: `Últimas ${numCount} Linhas Removidas`,
        type: 'removeBottomRows',
        params: { count: numCount },
        description: `Removeu as últimas ${numCount} linhas da tabela`,
      });
      showToast(`${numCount} últimas linhas removidas!`);
    } else if (type === 'removeBlankRows') {
      applyQueryStep(currentTable.id, {
        id: 'step_' + Math.random().toString(36).substring(2, 7),
        name: 'Linhas em Branco Removidas',
        type: 'removeBlankRows',
        params: { column: selectedColumn || undefined },
        description: selectedColumn
          ? `Removeu linhas vazias na coluna "${selectedColumn}"`
          : 'Removeu todas as linhas totalmente vazias',
      });
      showToast('Linhas em branco removidas!');
    } else if (type === 'keepTopRows') {
      applyQueryStep(currentTable.id, {
        id: 'step_' + Math.random().toString(36).substring(2, 7),
        name: `Mantidas Primeiras ${numCount} Linhas`,
        type: 'keepTopRows',
        params: { count: numCount },
        description: `Manteve apenas as primeiras ${numCount} linhas da tabela`,
      });
      showToast(`Mantidas as primeiras ${numCount} linhas!`);
    } else if (type === 'keepBottomRows') {
      applyQueryStep(currentTable.id, {
        id: 'step_' + Math.random().toString(36).substring(2, 7),
        name: `Mantidas Últimas ${numCount} Linhas`,
        type: 'keepBottomRows',
        params: { count: numCount },
        description: `Manteve apenas as últimas ${numCount} linhas da tabela`,
      });
      showToast(`Mantidas as últimas ${numCount} linhas!`);
    }

    setShowRemoveRowsModal(prev => ({ ...prev, isOpen: false }));
  };

  // Custom Column Live Preview Calculation
  const customColPreview = useMemo(() => {
    if (!customFormula.trim() || !currentTable || currentTable.rows.length === 0) {
      return { isValid: false, rows: [] };
    }

    try {
      const sampleRows = currentTable.rows.slice(0, 4).map((row, idx) => {
        const val = PowerBiColumnEngine.evaluateRow(customFormula, row, idx, currentTable.columns);
        return {
          row,
          computed: val,
        };
      });

      return { isValid: true, rows: sampleRows };
    } catch {
      return { isValid: false, rows: [] };
    }
  }, [customFormula, currentTable]);

  // Insert helper token into formula
  const insertIntoFormula = (token: string) => {
    setCustomFormula(prev => {
      const separator = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('(') && !prev.endsWith('&') ? ' ' : '';
      return prev + separator + token;
    });
  };

  // Save Custom Column
  const handleSaveCustomColumn = () => {
    const trimmedName = customColName.trim();
    if (!trimmedName) {
      showToast('Informe o nome da nova coluna.');
      return;
    }
    if (!customFormula.trim()) {
      showToast('Escreva a fórmula da coluna personalizada.');
      return;
    }

    applyQueryStep(currentTable.id, {
      id: 'step_' + Math.random().toString(36).substring(2, 7),
      name: `Coluna Adicionada (${trimmedName})`,
      type: 'addCustomColumn',
      params: {
        newColumnName: trimmedName,
        expression: customFormula.trim(),
        expressionType: customColType,
      },
      description: `Coluna calculada "${trimmedName}" com fórmula: ${customFormula.trim()}`,
    });

    setShowCustomColModal(false);
    setSelectedColumn(trimmedName);
    showToast(`Coluna calculada "${trimmedName}" adicionada com sucesso!`);
  };

  // Create Dimension Table handler
  const handleCreateDimensionTable = () => {
    if (dimCreationMode === 'extract') {
      const srcTbl = tables.find(t => t.name === dimExtractSourceTable || t.id === dimExtractSourceTable);
      if (!srcTbl || !dimExtractColumn) {
        showToast('Selecione uma tabela e coluna válida.');
        return;
      }

      const uniqueValues = Array.from(new Set(srcTbl.rows.map(r => r[dimExtractColumn]))).filter(
        v => v !== null && v !== undefined && v !== ''
      );

      const idKey = `ID_${dimExtractColumn}`;
      const newRows = uniqueValues.map((val, idx) => ({
        [idKey]: idx + 1,
        [dimExtractColumn]: val,
      }));

      const newTable: Table = {
        id: newDimTableName.replace(/\s+/g, '_'),
        name: newDimTableName.replace(/\s+/g, '_'),
        originalName: newDimTableName,
        isDim: true,
        columns: [
          { id: 'c_id_' + Math.random().toString(36).substring(2, 6), name: idKey, originalName: idKey, dataType: 'number' },
          { id: 'c_val_' + Math.random().toString(36).substring(2, 6), name: dimExtractColumn, originalName: dimExtractColumn, dataType: 'text' },
        ],
        rows: newRows,
      };

      addTable(newTable);
      setSelectedTableId(newTable.id);
      setSelectedColumn('');
      setShowDimModal(false);
      showToast(`Tabela dimensão "${newTable.name}" criada com ${newRows.length} registros únicos!`);
    } else {
      const colList = manualColumns.split(',').map(c => c.trim()).filter(Boolean);
      if (!manualDimName || colList.length === 0) {
        showToast('Defina o nome da tabela e ao menos uma coluna.');
        return;
      }

      const parsedRows = manualRows.split('\n').filter(Boolean).map(line => {
        const parts = line.split(',').map(p => p.trim());
        const row: Record<string, any> = {};
        colList.forEach((col, idx) => {
          const val = parts[idx] ?? '';
          row[col] = !isNaN(Number(val)) && val !== '' ? Number(val) : val;
        });
        return row;
      });

      const newTable: Table = {
        id: manualDimName.replace(/\s+/g, '_'),
        name: manualDimName.replace(/\s+/g, '_'),
        originalName: manualDimName,
        isDim: true,
        columns: colList.map(c => ({
          id: 'c_' + Math.random().toString(36).substring(2, 6),
          name: c,
          originalName: c,
          dataType: c.startsWith('ID') ? 'number' : 'text',
        })),
        rows: parsedRows,
      };

      addTable(newTable);
      setSelectedTableId(newTable.id);
      setSelectedColumn('');
      setShowDimModal(false);
      showToast(`Tabela dimensão "${newTable.name}" criada com sucesso!`);
    }
  };

  // Filtered function docs
  const filteredFunctions = useMemo(() => {
    return POWER_BI_FUNCTIONS.filter(f => {
      const matchesCategory = funcCategoryFilter === 'Todas' || f.category === funcCategoryFilter;
      const matchesQuery =
        !funcSearchQuery.trim() ||
        f.name.toLowerCase().includes(funcSearchQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(funcSearchQuery.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [funcCategoryFilter, funcSearchQuery]);

  // Filtered column list for custom column modal
  const filteredColumns = useMemo(() => {
    if (!currentTable) return [];
    if (!colSearchQuery.trim()) return currentTable.columns;
    return currentTable.columns.filter(c =>
      c.name.toLowerCase().includes(colSearchQuery.toLowerCase())
    );
  }, [currentTable, colSearchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden text-xs select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-xs">{toastMessage}</span>
        </div>
      )}

      {/* Power Query Ribbon Navigation Tabs */}
      <div className="flex items-center px-2 bg-slate-100 border-b border-slate-200 text-xs">
        {[
          { id: 'inicio', label: 'Página Inicial' },
          { id: 'transformar', label: 'Transformar' },
          { id: 'adicionarColuna', label: 'Adicionar Coluna' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveQueryTab(tab.id as any)}
            className={`px-3 py-1 font-medium border-b-2 transition-all ${
              activeQueryTab === tab.id
                ? 'border-amber-500 text-slate-900 bg-white font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Power Query Top Action Bar */}
      <div className="bg-white border-b border-slate-200 p-1.5 shadow-xs flex items-center justify-between min-h-[52px]">
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* ======================================================== */}
          {/* TAB 1: PÁGINA INICIAL                                   */}
          {/* ======================================================== */}
          {activeQueryTab === 'inicio' && (
            <>
              {/* Consulta */}
              <div className="pr-2 border-r border-slate-200 flex items-center gap-1.5 shrink-0">
                <span className="font-semibold text-slate-700 text-[11px]">Consulta:</span>
                <select
                  value={selectedTableId}
                  onChange={(e) => {
                    setSelectedTableId(e.target.value);
                    setSelectedColumn('');
                  }}
                  className="border border-slate-300 rounded px-2 py-1 font-bold text-slate-800 bg-slate-50 focus:ring-1 focus:ring-amber-500 text-xs"
                >
                  {tables.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.rows.length} lin)
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleDuplicateTable}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px]"
                  title="Duplicar a consulta selecionada"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-600" />
                  <span>Duplicar</span>
                </button>
              </div>

              {/* Gerenciar Colunas */}
              <div className="flex items-center gap-1 pr-2 border-r border-slate-200 shrink-0">
                <button
                  onClick={() => openRemoveColModal()}
                  className="flex flex-col items-center p-1 rounded hover:bg-red-50 text-red-700"
                  title="Remover coluna selecionada da tabela"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span className="text-[10px] font-semibold mt-0.5">Remover Coluna</span>
                </button>
                <button
                  onClick={handleRemoveOtherColumns}
                  className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
                  title="Remover todas as outras colunas exceto a selecionada"
                >
                  <Filter className="w-4 h-4 text-slate-600" />
                  <span className="text-[10px] font-semibold mt-0.5">Remover Outras</span>
                </button>
              </div>

              {/* Reduzir Linhas */}
              <div className="flex items-center gap-1 pr-2 border-r border-slate-200 shrink-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowRemoveRowsModal({ isOpen: true, type: 'removeTopRows', count: 10 })}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium"
                      title="Remover as primeiras N linhas da tabela"
                    >
                      Remover Primeiras...
                    </button>
                    <button
                      onClick={() => setShowRemoveRowsModal({ isOpen: true, type: 'removeBottomRows', count: 10 })}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium"
                      title="Remover as últimas N linhas da tabela"
                    >
                      Remover Últimas...
                    </button>
                    <button
                      onClick={() => setShowRemoveRowsModal({ isOpen: true, type: 'removeBlankRows', count: 0 })}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium"
                      title="Remover todas as linhas em branco"
                    >
                      Remover Vazias
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowRemoveRowsModal({ isOpen: true, type: 'keepTopRows', count: 10 })}
                      className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px]"
                      title="Manter apenas as primeiras N linhas"
                    >
                      Manter Primeiras...
                    </button>
                    <button
                      onClick={() => setShowRemoveRowsModal({ isOpen: true, type: 'keepBottomRows', count: 10 })}
                      className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px]"
                      title="Manter apenas as últimas N linhas"
                    >
                      Manter Últimas...
                    </button>
                  </div>
                </div>
              </div>

              {/* Transformar Básico */}
              <div className="flex items-center gap-1 pr-2 border-r border-slate-200 shrink-0">
                <button
                  onClick={handleUseFirstRowAsHeaders}
                  className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
                  title="Promover a primeira linha para nome dos cabeçalhos"
                >
                  <TableIcon className="w-4 h-4 text-emerald-600" />
                  <span className="text-[10px] font-semibold mt-0.5">1ª Linha como Cabeçalho</span>
                </button>
                <button
                  onClick={handleUseHeadersAsFirstRow}
                  className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
                  title="Rebaixar os cabeçalhos para a primeira linha"
                >
                  <ArrowDown className="w-4 h-4 text-slate-600" />
                  <span className="text-[10px] font-semibold mt-0.5">Cabeçalho como 1ª Linha</span>
                </button>
                <button
                  onClick={() => openReplaceModal()}
                  className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
                  title="Substituir valores específicos na coluna"
                >
                  <Replace className="w-4 h-4 text-emerald-600" />
                  <span className="text-[10px] font-semibold mt-0.5">Substituir Valores</span>
                </button>
                <button
                  onClick={handleDeduplicate}
                  className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
                  title="Remover linhas duplicadas"
                >
                  <ArrowDownNarrowWide className="w-4 h-4 text-purple-600" />
                  <span className="text-[10px] font-semibold mt-0.5">Remover Duplicatas</span>
                </button>
              </div>

              {/* Dimensões */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (currentTable && currentTable.columns.length > 0) {
                      setDimExtractSourceTable(currentTable.name);
                      setDimExtractColumn(selectedColumn || currentTable.columns[0].name);
                      setNewDimTableName(`d_${selectedColumn || currentTable.columns[0].name}`);
                    }
                    setShowDimModal(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors text-[11px]"
                  title="Criar nova tabela dimensão a partir de uma coluna ou manualmente"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Nova Dimensão</span>
                </button>
              </div>
            </>
          )}

          {/* ======================================================== */}
          {/* TAB 2: TRANSFORMAR (OPERAÇÕES NO LOCAL)                  */}
          {/* ======================================================== */}
          {activeQueryTab === 'transformar' && (
            <>
              {/* Estrutura da Tabela e Coluna */}
              <div className="flex items-center gap-1 pr-2 border-r border-slate-200 shrink-0">
                <button
                  onClick={handleDetectDataTypes}
                  className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
                  title="Detectar automaticamente os tipos de dados de todas as colunas"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-semibold mt-0.5">Detectar Tipo</span>
                </button>
                <button
                  onClick={() => openRenameModal()}
                  className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
                  title="Renomear coluna selecionada"
                >
                  <Type className="w-4 h-4 text-blue-600" />
                  <span className="text-[10px] font-semibold mt-0.5">Renomear</span>
                </button>
                <div className="flex flex-col gap-0.5 pl-1 border-l border-slate-200">
                  <button
                    onClick={handleFillDown}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 text-slate-700 text-[10px]"
                    title="Preencher valores vazios para baixo (Fill Down)"
                  >
                    <ArrowDown className="w-3 h-3 text-emerald-600" />
                    <span>Preencher Abaixo</span>
                  </button>
                  <button
                    onClick={handleFillUp}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 text-slate-700 text-[10px]"
                    title="Preencher valores vazios para cima (Fill Up)"
                  >
                    <ArrowUp className="w-3 h-3 text-emerald-600" />
                    <span>Preencher Acima</span>
                  </button>
                </div>
              </div>

              {/* Coluna de Texto (no local) */}
              <div className="flex items-center gap-1 pr-2 border-r border-slate-200 shrink-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Formatar:</span>
                    <button
                      onClick={() => handleTextTransform('upper', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                      title="Converter texto para MAIÚSCULA"
                    >
                      AA
                    </button>
                    <button
                      onClick={() => handleTextTransform('lower', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Converter texto para minúscula"
                    >
                      aa
                    </button>
                    <button
                      onClick={() => handleTextTransform('capitalize', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Capitalizar cada palavra"
                    >
                      Aa
                    </button>
                    <button
                      onClick={() => handleTextTransform('trim', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Remover espaços em branco no início e fim"
                    >
                      Trim
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Extrair:</span>
                    <button
                      onClick={() => openTextExtractModal('firstChars', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px]"
                      title="Extrair os primeiros N caracteres"
                    >
                      Primeiros...
                    </button>
                    <button
                      onClick={() => openTextExtractModal('lastChars', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px]"
                      title="Extrair os últimos N caracteres"
                    >
                      Últimos...
                    </button>
                    <button
                      onClick={() => openTextExtractModal('beforeDelimiter', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px]"
                      title="Extrair texto antes do delimitador"
                    >
                      Antes Delim...
                    </button>
                    <button
                      onClick={() => openTextExtractModal('afterDelimiter', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px]"
                      title="Extrair texto após o delimitador"
                    >
                      Após Delim...
                    </button>
                  </div>
                </div>
              </div>

              {/* Coluna de Data/Hora (no local) */}
              <div className="flex items-center gap-1 pr-2 border-r border-slate-200 shrink-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Data:</span>
                    <button
                      onClick={() => handleDateExtract('year', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Transformar no Ano"
                    >
                      Ano
                    </button>
                    <button
                      onClick={() => handleDateExtract('month', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Transformar no Mês (1-12)"
                    >
                      Mês
                    </button>
                    <button
                      onClick={() => handleDateExtract('monthName', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Transformar no Nome do Mês (Janeiro, etc.)"
                    >
                      Nome Mês
                    </button>
                    <button
                      onClick={() => handleDateExtract('day', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Transformar no Dia do mês (1-31)"
                    >
                      Dia
                    </button>
                    <button
                      onClick={() => handleDateExtract('dayOfWeek', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Transformar no Dia da Semana"
                    >
                      Dia Semana
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Hora:</span>
                    <button
                      onClick={() => handleDateExtract('hour', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px]"
                      title="Transformar na Hora"
                    >
                      Hora
                    </button>
                    <button
                      onClick={() => handleDateExtract('minute', false)}
                      className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px]"
                      title="Transformar nos Minutos"
                    >
                      Minuto
                    </button>
                  </div>
                </div>
              </div>

              {/* Conversão de Tipo e Valores */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openReplaceModal()}
                  className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
                  title="Substituir valores específicos"
                >
                  <Replace className="w-4 h-4 text-emerald-600" />
                  <span className="text-[10px] font-semibold mt-0.5">Substituir</span>
                </button>
                <div className="flex items-center gap-0.5 border-l border-slate-200 pl-1">
                  <button
                    onClick={() => handleChangeType('text')}
                    className="px-1.5 py-1 rounded hover:bg-slate-100 text-slate-600 text-[10px] font-medium"
                  >
                    ABC
                  </button>
                  <button
                    onClick={() => handleChangeType('number')}
                    className="px-1.5 py-1 rounded hover:bg-slate-100 text-slate-600 text-[10px] font-medium"
                  >
                    123
                  </button>
                  <button
                    onClick={() => handleChangeType('currency')}
                    className="px-1.5 py-1 rounded hover:bg-slate-100 text-slate-600 text-[10px] font-medium"
                  >
                    R$
                  </button>
                  <button
                    onClick={() => handleChangeType('date')}
                    className="px-1.5 py-1 rounded hover:bg-slate-100 text-slate-600 text-[10px] font-medium"
                  >
                    Data
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ======================================================== */}
          {/* TAB 3: ADICIONAR COLUNA (CRIA NOVA COLUNA)              */}
          {/* ======================================================== */}
          {activeQueryTab === 'adicionarColuna' && (
            <>
              {/* Geral */}
              <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200 shrink-0">
                <button
                  onClick={() => {
                    setCustomColName(`Coluna_${(currentTable?.columns.length || 0) + 1}`);
                    setCustomFormula('');
                    setShowCustomColModal(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-xs transition-colors text-xs"
                  title="Adicionar coluna personalizada com fórmulas completas Power BI"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Coluna Personalizada</span>
                </button>
                <button
                  onClick={handleDuplicateSelectedColumn}
                  className="flex flex-col items-center p-1 rounded hover:bg-slate-100 text-slate-700"
                  title="Duplicar coluna selecionada em uma nova coluna"
                >
                  <Copy className="w-4 h-4 text-blue-600" />
                  <span className="text-[10px] font-semibold mt-0.5">Duplicar Coluna</span>
                </button>
                <div className="flex flex-col gap-0.5 pl-1 border-l border-slate-200">
                  <button
                    onClick={() => handleAddIndexColumn(0)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 text-slate-700 text-[10px]"
                    title="Adicionar coluna de índice sequencial iniciando em 0"
                  >
                    <ListOrdered className="w-3 h-3 text-purple-600" />
                    <span>Índice (de 0)</span>
                  </button>
                  <button
                    onClick={() => handleAddIndexColumn(1)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 text-slate-700 text-[10px]"
                    title="Adicionar coluna de índice sequencial iniciando em 1"
                  >
                    <ListOrdered className="w-3 h-3 text-purple-600" />
                    <span>Índice (de 1)</span>
                  </button>
                </div>
              </div>

              {/* A partir de Texto (Nova Coluna) */}
              <div className="flex items-center gap-1 pr-2 border-r border-slate-200 shrink-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Formatar Nova:</span>
                    <button
                      onClick={() => handleTextTransform('upper', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                      title="Criar nova coluna com texto em MAIÚSCULA"
                    >
                      AA
                    </button>
                    <button
                      onClick={() => handleTextTransform('lower', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Criar nova coluna com texto em minúscula"
                    >
                      aa
                    </button>
                    <button
                      onClick={() => handleTextTransform('capitalize', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Criar nova coluna capitalizada"
                    >
                      Aa
                    </button>
                    <button
                      onClick={() => handleTextTransform('trim', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Criar nova coluna sem espaços extras"
                    >
                      Trim
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Extrair Nova:</span>
                    <button
                      onClick={() => openTextExtractModal('firstChars', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px]"
                      title="Criar nova coluna com os primeiros N caracteres"
                    >
                      Primeiros...
                    </button>
                    <button
                      onClick={() => openTextExtractModal('lastChars', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px]"
                      title="Criar nova coluna com os últimos N caracteres"
                    >
                      Últimos...
                    </button>
                    <button
                      onClick={() => openTextExtractModal('beforeDelimiter', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px]"
                      title="Criar nova coluna com texto antes do delimitador"
                    >
                      Antes Delim...
                    </button>
                    <button
                      onClick={() => openTextExtractModal('afterDelimiter', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px]"
                      title="Criar nova coluna com texto após o delimitador"
                    >
                      Após Delim...
                    </button>
                  </div>
                </div>
              </div>

              {/* A partir de Data (Nova Coluna) */}
              <div className="flex items-center gap-1 shrink-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Data Nova:</span>
                    <button
                      onClick={() => handleDateExtract('year', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Criar nova coluna com o Ano"
                    >
                      Ano
                    </button>
                    <button
                      onClick={() => handleDateExtract('month', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Criar nova coluna com o Mês"
                    >
                      Mês
                    </button>
                    <button
                      onClick={() => handleDateExtract('monthName', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Criar nova coluna com o Nome do Mês"
                    >
                      Nome Mês
                    </button>
                    <button
                      onClick={() => handleDateExtract('day', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Criar nova coluna com o Dia"
                    >
                      Dia
                    </button>
                    <button
                      onClick={() => handleDateExtract('dayOfWeek', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px]"
                      title="Criar nova coluna com o Dia da Semana"
                    >
                      Dia Semana
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Hora Nova:</span>
                    <button
                      onClick={() => handleDateExtract('hour', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px]"
                      title="Criar nova coluna com a Hora"
                    >
                      Hora
                    </button>
                    <button
                      onClick={() => handleDateExtract('minute', true)}
                      className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px]"
                      title="Criar nova coluna com o Minuto"
                    >
                      Minuto
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Editor Avançado */}
        <button
          onClick={() => setShowSqlModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-700 font-semibold text-xs shrink-0 ml-2"
          title="Ver o pipeline em SQL DuckDB e M script"
        >
          <Code className="w-3.5 h-3.5 text-amber-400" />
          <span>Editor Avançado</span>
        </button>
      </div>

      {/* Main Body: Data Grid + Applied Steps Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Data Grid with Column Selection */}
        <div className="flex-1 overflow-auto bg-white border-r border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 shadow-xs z-10">
              <tr>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-400 bg-slate-100 border-r border-slate-200 w-12 text-center">
                  #
                </th>
                {currentTable?.columns.map(col => {
                  const isSelected = selectedColumn === col.name;
                  return (
                    <th
                      key={col.id}
                      onClick={() => setSelectedColumn(col.name)}
                      className={`px-3 py-2 border-r cursor-pointer transition-colors min-w-[140px] max-w-[200px] group ${
                        isSelected
                          ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                          : 'border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate" title={col.name}>
                          {col.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] uppercase font-mono px-1 bg-white/70 rounded">
                            {col.dataType}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRenameModal(col.name);
                            }}
                            title="Renomear esta coluna"
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 p-0.5 rounded"
                          >
                            <Type className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRemoveColModal(col.name);
                            }}
                            title="Remover esta coluna"
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-0.5 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {currentTable?.rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-1 text-[10px] text-slate-400 bg-slate-50/70 border-r border-slate-100 text-center font-mono">
                    {i + 1}
                  </td>
                  {currentTable.columns.map(col => {
                    const isSelected = selectedColumn === col.name;
                    return (
                      <td
                        key={col.name}
                        className={`px-3 py-1.5 border-r border-slate-100 text-slate-700 truncate max-w-[200px] ${
                          isSelected ? 'bg-amber-50/50 font-medium' : ''
                        }`}
                      >
                        {row[col.name] !== undefined && row[col.name] !== null
                          ? String(row[col.name])
                          : <span className="text-slate-300 italic">null</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right Sidebar: Applied Steps (Etapas Aplicadas) */}
        <div className="w-68 bg-slate-50 border-l border-slate-200 flex flex-col h-full shadow-inner">
          <div className="p-3 border-b border-slate-200 bg-slate-100/80 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-800 text-xs">Etapas Aplicadas</h4>
              <p className="text-[10px] text-slate-500 font-mono">Pipeline ETL Linear</p>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px]">
              {steps.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {steps.map((st, idx) => (
              <div
                key={st.id}
                className="group p-2 rounded-lg bg-white border border-slate-200 shadow-xs flex items-center justify-between hover:border-amber-400 transition-colors"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-5 h-5 rounded bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {idx + 1}
                  </div>
                  <div className="overflow-hidden">
                    <span className="font-bold text-slate-800 text-[11px] block truncate" title={st.name}>
                      {st.name}
                    </span>
                    <span className="text-[9px] text-slate-400 block truncate" title={st.description}>
                      {st.description || st.type}
                    </span>
                  </div>
                </div>

                {st.type !== 'source' && (
                  <button
                    onClick={() => removeQueryStep(currentTable.id, st.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-1 rounded"
                    title="Remover etapa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-slate-200 bg-slate-100/50 text-[10px] text-slate-500">
            <strong>Dica:</strong> Cada transformação é salva sequencialmente e compila SQL executável no DuckDB & AlaSQL.
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: CRIAR COLUNA PERSONALIZADA (POWER BI STYLE)    */}
      {/* ======================================================== */}
      {showCustomColModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Adicionar Coluna Personalizada</h3>
                  <p className="text-[11px] text-slate-500">
                    Crie novas colunas calculadas com fórmulas compatíveis com Power BI (Texto, Matemática, Datas e Condicionais).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCustomColModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 3 Columns (Columns / Formula Editor / Function Library) */}
            <div className="flex-1 flex overflow-hidden p-4 gap-4">
              {/* Left Column: Available Columns in Current Table */}
              <div className="w-52 border rounded-xl bg-slate-50 flex flex-col p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700 text-xs">Colunas Disponíveis</span>
                  <span className="text-[10px] text-slate-400">{filteredColumns.length}</span>
                </div>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                  <input
                    type="text"
                    placeholder="Filtrar coluna..."
                    value={colSearchQuery}
                    onChange={(e) => setColSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-2 py-1 text-[11px] bg-white border border-slate-300 rounded"
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {filteredColumns.map(col => (
                    <div
                      key={col.id}
                      onDoubleClick={() => insertIntoFormula(`[${col.name}]`)}
                      className="p-1.5 rounded bg-white border border-slate-200 text-slate-800 hover:border-amber-400 hover:bg-amber-50/50 cursor-pointer flex items-center justify-between group transition-colors text-[11px]"
                      title="Dê duplo clique para inserir na fórmula"
                    >
                      <span className="truncate font-medium">{col.name}</span>
                      <button
                        onClick={() => insertIntoFormula(`[${col.name}]`)}
                        className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-800 opacity-0 group-hover:opacity-100 font-bold"
                        title="Inserir [Coluna]"
                      >
                        + Inserir
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400 mt-2 text-center">
                  Dê duplo clique em uma coluna para inseri-la como <code>[Coluna]</code>.
                </p>
              </div>

              {/* Center Column: Formula Editor & Preview */}
              <div className="flex-1 flex flex-col space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Nome da Nova Coluna</label>
                    <input
                      type="text"
                      value={customColName}
                      onChange={(e) => setCustomColName(e.target.value)}
                      placeholder="Ex.: Margem_Calculada"
                      className="w-full border rounded-lg px-2.5 py-1.5 bg-slate-50 font-semibold text-slate-800 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Tipo de Dados</label>
                    <select
                      value={customColType}
                      onChange={(e) => setCustomColType(e.target.value as any)}
                      className="w-full border rounded-lg px-2.5 py-1.5 bg-slate-50 font-semibold text-slate-800 focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="text">Texto (String)</option>
                      <option value="number">Número Decimal (123.45)</option>
                      <option value="currency">Moeda Brasileira (R$)</option>
                      <option value="date">Data (YYYY-MM-DD)</option>
                      <option value="boolean">Booleano (Verdadeiro / Falso)</option>
                    </select>
                  </div>
                </div>

                {/* Quick Operators toolbar */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-semibold">Operadores:</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customFormula.trim().startsWith('=')) {
                        setCustomFormula('=' + customFormula.trim());
                      }
                    }}
                    className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 border border-amber-300 font-mono text-[10px] font-bold flex items-center gap-1"
                    title="Adicionar símbolo de fórmula =[FÓRMULA]"
                  >
                    <span>=[FÓRMULA]</span>
                  </button>
                  {['+', '-', '*', '/', '&', '>', '<', '>=', '<=', '=', '!=', '(', ')'].map(op => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => insertIntoFormula(op)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-bold"
                    >
                      {op}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => insertIntoFormula('""')}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-bold"
                  >
                    ""
                  </button>
                  <button
                    type="button"
                    onClick={() => insertIntoFormula('-1')}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-bold"
                    title="Multiplicador negativo -1"
                  >
                    -1
                  </button>
                </div>

                {/* Formula Textarea */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                      <span>Fórmula da Coluna Personalizada</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-900 font-mono font-bold text-[10px] flex items-center gap-1">
                        <span>=[FÓRMULA]</span>
                      </span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Identificador de cálculo dinâmico Power BI / Power Query
                    </span>
                  </div>

                  <FormulaEditor
                    value={customFormula}
                    onChange={setCustomFormula}
                    dialect="column"
                    columns={currentTable?.columns || []}
                    sampleRow={currentTable?.rows?.[0]}
                    placeholder="Ex.: =[Valor] * -1   ou   =[PrecoUnitario] * [Quantidade]   ou   =IF([ValorTotal] > 1000, UPPER([Categoria]), [Canal])"
                    rows={4}
                  />
                </div>

                {/* Real-time Live Preview */}
                <div className="p-2.5 rounded-xl border bg-slate-50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-700 text-[11px]">
                      Prévia do Cálculo em Tempo Real (Primeiras Linhas)
                    </span>
                    {customColPreview.isValid ? (
                      <span className="text-emerald-700 font-bold text-[10px] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Fórmula válida
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">Aguardando fórmula...</span>
                    )}
                  </div>

                  {customColPreview.rows.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-[10px] divide-y divide-slate-200">
                        <thead>
                          <tr className="bg-slate-200/60 font-semibold text-slate-600">
                            <th className="px-2 py-1">Linha</th>
                            <th className="px-2 py-1 bg-amber-100 text-amber-900 font-bold">
                              Resultado ({customColName || 'Nova Coluna'})
                            </th>
                            {currentTable?.columns.slice(0, 3).map(c => (
                              <th key={c.name} className="px-2 py-1 truncate max-w-[100px]">
                                {c.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {customColPreview.rows.map((r, i) => (
                            <tr key={i}>
                              <td className="px-2 py-1 font-mono text-slate-400">{i + 1}</td>
                              <td className="px-2 py-1 font-bold bg-amber-50/60 text-amber-900 truncate max-w-[150px]">
                                {r.computed !== null && r.computed !== undefined ? String(r.computed) : 'null'}
                              </td>
                              {currentTable?.columns.slice(0, 3).map(c => (
                                <td key={c.name} className="px-2 py-1 text-slate-500 truncate max-w-[100px]">
                                  {String(r.row[c.name] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">
                      Digite ou selecione funções para visualizar os valores gerados imediatamente.
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Power BI Function Library */}
              <div className="w-68 border rounded-xl bg-slate-50 flex flex-col p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700 text-xs flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" /> Funções do Power BI
                  </span>
                  <span className="text-[10px] text-slate-400">{filteredFunctions.length}</span>
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {['Todas', 'Texto', 'Matemática', 'Data', 'Lógica / Condicional', 'Linha'].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFuncCategoryFilter(cat)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                        funcCategoryFilter === cat
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-white border text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Function Search */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                  <input
                    type="text"
                    placeholder="Buscar função..."
                    value={funcSearchQuery}
                    onChange={(e) => setFuncSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-2 py-1 text-[11px] bg-white border border-slate-300 rounded"
                  />
                </div>

                {/* Function List */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                  {filteredFunctions.map(f => (
                    <div
                      key={f.name}
                      className="p-2 rounded-lg bg-white border border-slate-200 text-slate-800 hover:border-amber-400 hover:shadow-xs transition-all"
                    >
                      <div className="flex items-center justify-between font-bold text-[11px] text-amber-900 mb-0.5">
                        <span>{f.name}</span>
                        <button
                          type="button"
                          onClick={() => insertIntoFormula(f.example)}
                          className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[9px] font-bold"
                          title="Inserir exemplo"
                        >
                          Usar
                        </button>
                      </div>
                      <div className="font-mono text-[9px] text-slate-500 mb-1 truncate" title={f.syntax}>
                        {f.syntax}
                      </div>
                      <p className="text-[10px] text-slate-600 leading-tight">{f.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Compatibilidade completa com operadores, strings, números e datas do Power BI.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomColModal(false)}
                  className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomColumn}
                  className="px-5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-xs"
                >
                  OK (Adicionar Coluna)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: RENOMEAR COLUNA                                 */}
      {/* ======================================================== */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <Type className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Renomear Coluna</h3>
              </div>
              <button onClick={() => setShowRenameModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Coluna Atual</label>
                <select
                  value={renameTargetCol}
                  onChange={(e) => {
                    setRenameTargetCol(e.target.value);
                    setRenameNewName(e.target.value);
                    setRenameError('');
                  }}
                  className="w-full border rounded-lg p-2 bg-slate-50 font-bold text-slate-800"
                >
                  {currentTable?.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.dataType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Novo Nome da Coluna</label>
                <input
                  type="text"
                  value={renameNewName}
                  onChange={(e) => {
                    setRenameNewName(e.target.value);
                    setRenameError('');
                  }}
                  className="w-full border rounded-lg p-2 font-bold text-slate-800 bg-white focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {renameError && (
                <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{renameError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="px-3.5 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-100 font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                Renomear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: SUBSTITUIR VALORES                             */}
      {/* ======================================================== */}
      {showReplaceModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Replace className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Substituir Valores</h3>
              </div>
              <button onClick={() => setShowReplaceModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Coluna Alvo</label>
                <select
                  value={replaceTargetCol}
                  onChange={(e) => setReplaceTargetCol(e.target.value)}
                  className="w-full border rounded-lg p-2 bg-slate-50 font-bold text-slate-800"
                >
                  {currentTable?.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Valor a Localizar</label>
                <input
                  type="text"
                  placeholder="Ex.: Pendente"
                  value={replaceOldVal}
                  onChange={(e) => setReplaceOldVal(e.target.value)}
                  className="w-full border rounded-lg p-2 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Substituir por</label>
                <input
                  type="text"
                  placeholder="Ex.: Concluído"
                  value={replaceNewVal}
                  onChange={(e) => setReplaceNewVal(e.target.value)}
                  className="w-full border rounded-lg p-2 font-medium text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="exactMatchCheck"
                  checked={replaceExact}
                  onChange={(e) => setReplaceExact(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <label htmlFor="exactMatchCheck" className="text-slate-700 text-[11px] font-medium cursor-pointer">
                  Correspondência exata da célula inteira
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                className="px-3.5 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-100 font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReplace}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Substituir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: REMOVER COLUNA                                  */}
      {/* ======================================================== */}
      {showRemoveColModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-500/10 text-red-600">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Remover Coluna</h3>
              </div>
              <button onClick={() => setShowRemoveColModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-slate-600 font-semibold block mb-1">Selecione a coluna para remover</label>
              <select
                value={removeTargetCol}
                onChange={(e) => setRemoveTargetCol(e.target.value)}
                className="w-full border rounded-lg p-2 bg-slate-50 font-bold text-slate-800"
              >
                {currentTable?.columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-red-600 mt-2">
                Tem certeza que deseja remover a coluna <strong>"{removeTargetCol}"</strong>? Essa etapa poderá ser desfeita na barra de Etapas Aplicadas.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowRemoveColModal(false)}
                className="px-3.5 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-100 font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveColumn}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                Remover Coluna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: CRIAR TABELA DIMENSÃO                           */}
      {/* ======================================================== */}
      {showDimModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-xs flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-600 text-white font-bold">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Criar Nova Tabela Dimensão</h3>
                  <p className="text-[11px] text-slate-500">
                    Modele dimensões limpas (d_Clientes, d_Produtos, d_Calendario) para o esquema Star Schema.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowDimModal(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Selector */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setDimCreationMode('extract')}
                className={`flex-1 py-1.5 rounded-md font-bold transition-colors ${
                  dimCreationMode === 'extract'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Extrair Valores Únicos (Recomendado)
              </button>
              <button
                type="button"
                onClick={() => setDimCreationMode('manual')}
                className={`flex-1 py-1.5 rounded-md font-bold transition-colors ${
                  dimCreationMode === 'manual'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Criação Manual (Linhas / Colunas)
              </button>
            </div>

            {dimCreationMode === 'extract' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Tabela de Origem</label>
                    <select
                      value={dimExtractSourceTable}
                      onChange={(e) => {
                        setDimExtractSourceTable(e.target.value);
                        const tbl = tables.find(t => t.name === e.target.value || t.id === e.target.value);
                        if (tbl && tbl.columns.length > 0) {
                          setDimExtractColumn(tbl.columns[0].name);
                          setNewDimTableName(`d_${tbl.columns[0].name}`);
                        }
                      }}
                      className="w-full border rounded p-1.5 bg-slate-50 font-semibold"
                    >
                      {tables.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Coluna para Extrair Valores</label>
                    <select
                      value={dimExtractColumn}
                      onChange={(e) => {
                        setDimExtractColumn(e.target.value);
                        setNewDimTableName(`d_${e.target.value}`);
                      }}
                      className="w-full border rounded p-1.5 bg-slate-50 font-bold text-amber-800"
                    >
                      {tables.find(t => t.name === dimExtractSourceTable || t.id === dimExtractSourceTable)?.columns.map(c => (
                        <option key={c.name} value={c.name}>{c.name} ({c.dataType})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nome da Nova Tabela Dimensão</label>
                  <input
                    type="text"
                    value={newDimTableName}
                    onChange={(e) => setNewDimTableName(e.target.value)}
                    className="w-full border rounded p-2 bg-slate-50 font-bold text-slate-800"
                  />
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
                  Isso criará a tabela <strong>{newDimTableName}</strong> contendo valores únicos da coluna <em>{dimExtractColumn}</em> com um identificador sequencial (ID_{dimExtractColumn}).
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nome da Dimensão</label>
                  <input
                    type="text"
                    value={manualDimName}
                    onChange={(e) => setManualDimName(e.target.value)}
                    className="w-full border rounded p-2 bg-slate-50 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Colunas (separadas por vírgula)</label>
                  <input
                    type="text"
                    value={manualColumns}
                    onChange={(e) => setManualColumns(e.target.value)}
                    placeholder="ID_Status, NomeStatus, Cor"
                    className="w-full border rounded p-2 bg-slate-50 text-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Linhas (uma por linha, valores separados por vírgula)</label>
                  <textarea
                    rows={4}
                    value={manualRows}
                    onChange={(e) => setManualRows(e.target.value)}
                    className="w-full border rounded p-2 bg-slate-50 font-mono text-slate-800"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowDimModal(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateDimensionTable}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                Criar Tabela Dimensão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: SQL / M ADVANCED EDITOR                         */}
      {/* ======================================================== */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full p-5 text-xs text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Editor Avançado (Pipeline M / SQL DuckDB)</h3>
              </div>
              <button onClick={() => setShowSqlModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl font-mono text-[11px] text-amber-300 space-y-1 overflow-x-auto max-h-80 border border-slate-800">
              <div className="text-slate-500">// Código gerado automaticamente pelas etapas de transformação:</div>
              <div>let</div>
              <div className="pl-4 text-emerald-400">Fonte = DuckDB.Query("SELECT * FROM {currentTable?.name}");</div>
              {steps.map((st, i) => (
                <div key={st.id} className="pl-4 text-amber-300">
                  Etapa_{i + 1} = #{`"${st.name}"`}({i === 0 ? 'Fonte' : `Etapa_${i}`}),
                </div>
              ))}
              <div>in</div>
              <div className="pl-4 text-blue-400">Etapa_{steps.length}</div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
              >
                Fechar Editor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 7: REMOVER / MANTER LINHAS                          */}
      {/* ======================================================== */}
      {showRemoveRowsModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-50 text-red-600">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {showRemoveRowsModal.type === 'removeTopRows' && 'Remover Primeiras Linhas'}
                  {showRemoveRowsModal.type === 'removeBottomRows' && 'Remover Últimas Linhas'}
                  {showRemoveRowsModal.type === 'removeBlankRows' && 'Remover Linhas em Branco'}
                  {showRemoveRowsModal.type === 'keepTopRows' && 'Manter Primeiras Linhas'}
                  {showRemoveRowsModal.type === 'keepBottomRows' && 'Manter Últimas Linhas'}
                </h3>
              </div>
              <button
                onClick={() => setShowRemoveRowsModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showRemoveRowsModal.type !== 'removeBlankRows' ? (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500">
                  {showRemoveRowsModal.type.startsWith('remove')
                    ? 'Informe quantas linhas devem ser excluídas da tabela:'
                    : 'Informe quantas linhas devem ser preservadas na tabela:'}
                </p>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Número de Linhas</label>
                  <input
                    type="number"
                    min="1"
                    max={currentTable?.rows.length || 1000}
                    value={showRemoveRowsModal.count}
                    onChange={(e) => setShowRemoveRowsModal(prev => ({ ...prev, count: Math.max(1, Number(e.target.value)) }))}
                    className="w-full border rounded-lg p-2 font-bold text-slate-800 bg-white focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px] space-y-1">
                <p>
                  Todas as linhas onde {selectedColumn ? <strong>a coluna "{selectedColumn}"</strong> : 'todas as colunas'} estiverem vazias ou nulas serão removidas.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowRemoveRowsModal(prev => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-100 font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveRows}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 8: EXTRAIR TEXTO                                    */}
      {/* ======================================================== */}
      {showTextExtractModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {showTextExtractModal.isNewCol ? 'Extrair Texto (Nova Coluna)' : 'Extrair Texto no Local'}
                  </h3>
                  <span className="text-[10px] text-slate-400">Coluna: {selectedColumn}</span>
                </div>
              </div>
              <button
                onClick={() => setShowTextExtractModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {showTextExtractModal.isNewCol && (
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Nome da Nova Coluna</label>
                  <input
                    type="text"
                    value={showTextExtractModal.newColumnName}
                    onChange={(e) => setShowTextExtractModal(prev => ({ ...prev, newColumnName: e.target.value }))}
                    className="w-full border rounded-lg p-2 font-bold text-slate-800 bg-white focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              {(showTextExtractModal.mode === 'firstChars' || showTextExtractModal.mode === 'lastChars') && (
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    {showTextExtractModal.mode === 'firstChars' ? 'Contagem de Primeiros Caracteres' : 'Contagem de Últimos Caracteres'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={showTextExtractModal.count}
                    onChange={(e) => setShowTextExtractModal(prev => ({ ...prev, count: Math.max(1, Number(e.target.value)) }))}
                    className="w-full border rounded-lg p-2 font-bold text-slate-800 bg-white"
                  />
                </div>
              )}

              {showTextExtractModal.mode === 'range' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Posição Inicial (0-index)</label>
                    <input
                      type="number"
                      min="0"
                      value={showTextExtractModal.startPos}
                      onChange={(e) => setShowTextExtractModal(prev => ({ ...prev, startPos: Math.max(0, Number(e.target.value)) }))}
                      className="w-full border rounded-lg p-2 font-bold text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Número de Caracteres</label>
                    <input
                      type="number"
                      min="1"
                      value={showTextExtractModal.length}
                      onChange={(e) => setShowTextExtractModal(prev => ({ ...prev, length: Math.max(1, Number(e.target.value)) }))}
                      className="w-full border rounded-lg p-2 font-bold text-slate-800 bg-white"
                    />
                  </div>
                </div>
              )}

              {(showTextExtractModal.mode === 'beforeDelimiter' || showTextExtractModal.mode === 'afterDelimiter') && (
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Delimitador</label>
                  <input
                    type="text"
                    value={showTextExtractModal.delimiter}
                    onChange={(e) => setShowTextExtractModal(prev => ({ ...prev, delimiter: e.target.value }))}
                    placeholder="Ex: - ou / ou @"
                    className="w-full border rounded-lg p-2 font-bold text-slate-800 bg-white"
                  />
                </div>
              )}

              {showTextExtractModal.mode === 'betweenDelimiters' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Delimitador Inicial</label>
                    <input
                      type="text"
                      value={showTextExtractModal.startDelimiter}
                      onChange={(e) => setShowTextExtractModal(prev => ({ ...prev, startDelimiter: e.target.value }))}
                      placeholder="Ex: ("
                      className="w-full border rounded-lg p-2 font-bold text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Delimitador Final</label>
                    <input
                      type="text"
                      value={showTextExtractModal.endDelimiter}
                      onChange={(e) => setShowTextExtractModal(prev => ({ ...prev, endDelimiter: e.target.value }))}
                      placeholder="Ex: )"
                      className="w-full border rounded-lg p-2 font-bold text-slate-800 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowTextExtractModal(prev => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-100 font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmTextExtract}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                Extrair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
