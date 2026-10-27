import React, { useState } from 'react';
import { X, Plus, Trash2, Edit3, Download, Upload, Check, AlertCircle, Code } from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { UserDefinedFunction } from '../../types/bi';
import { UdfManager } from '../../engine/model/udfManager';
import { DaxEngine } from '../../engine/daxEngine';

interface UdfLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UdfLibraryModal: React.FC<UdfLibraryModalProps> = ({ isOpen, onClose }) => {
  const { userDefinedFunctions, addUserDefinedFunction, updateUserDefinedFunction, deleteUserDefinedFunction, setUserDefinedFunctions } = useBiStore();

  const [editingUdf, setEditingUdf] = useState<UserDefinedFunction | null>(null);
  const [name, setName] = useState('');
  const [paramsStr, setParamsStr] = useState('');
  const [body, setBody] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Geral');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingUdf({
      id: `udf_${Date.now()}`,
      name: '',
      parameters: [],
      body: '',
      description: '',
      category: 'Geral',
    });
    setName('');
    setParamsStr('');
    setBody('');
    setDescription('');
    setCategory('Geral');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleStartEdit = (udf: UserDefinedFunction) => {
    setEditingUdf(udf);
    setName(udf.name);
    setParamsStr(udf.parameters.join(', '));
    setBody(udf.body);
    setDescription(udf.description || '');
    setCategory(udf.category || 'Geral');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSave = () => {
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('O nome da função é obrigatório.');
      return;
    }
    if (!body.trim()) {
      setErrorMsg('A fórmula/corpo da função é obrigatória.');
      return;
    }

    // Validate body syntax with DaxEngine
    const valRes = DaxEngine.validate(body.trim(), [], []);
    if (!valRes.isValid) {
      setErrorMsg(`Erro de sintaxe na fórmula: ${valRes.errorMessage}`);
      return;
    }

    const params = paramsStr
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const savedUdf: UserDefinedFunction = {
      id: editingUdf?.id || `udf_${Date.now()}`,
      name: name.trim(),
      parameters: params,
      body: body.trim(),
      description: description.trim(),
      category: category.trim() || 'Geral',
      updatedAt: new Date().toISOString(),
    };

    if (editingUdf && userDefinedFunctions.some(u => u.id === editingUdf.id)) {
      updateUserDefinedFunction(editingUdf.id, savedUdf);
      setSuccessMsg(`Função "${savedUdf.name}" atualizada com sucesso!`);
    } else {
      addUserDefinedFunction(savedUdf);
      setSuccessMsg(`Função "${savedUdf.name}" adicionada com sucesso!`);
    }

    setEditingUdf(null);
  };

  const handleExportJson = () => {
    const jsonStr = UdfManager.exportToJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insighthub-udf-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccessMsg('Biblioteca de UDFs exportada com sucesso!');
  };

  const handleImportJson = () => {
    if (!importJsonText.trim()) return;
    try {
      const res = UdfManager.importFromJson(importJsonText);
      setUserDefinedFunctions(res.functions);
      setShowImportBox(false);
      setImportJsonText('');
      setSuccessMsg(`${res.imported} funções importadas com sucesso!`);
    } catch (e: any) {
      setErrorMsg(e.message || 'Falha ao importar JSON.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Biblioteca de Funções do Usuário (UDF)</h2>
              <p className="text-xs text-slate-500">
                Crie e gerencie funções reutilizáveis em DAX com suporte a parâmetros, autocomplete e exportação JSON.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartCreate}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" /> Nova Função UDF
            </button>
            <button
              onClick={() => setShowImportBox(!showImportBox)}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4 text-slate-500" /> Importar JSON
            </button>
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-slate-500" /> Exportar JSON
            </button>
          </div>
          <span className="text-xs text-slate-500">
            {userDefinedFunctions.length} função(ões) cadastrada(s)
          </span>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Import JSON Area */}
        {showImportBox && (
          <div className="p-4 mx-6 mt-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-700">Cole o JSON da Biblioteca UDF:</label>
            <textarea
              value={importJsonText}
              onChange={e => setImportJsonText(e.target.value)}
              placeholder='{"functions": [{"name": "MinhaFuncao", "parameters": ["a", "b"], "body": "a + b"}]}'
              rows={4}
              className="font-mono text-xs p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImportBox(false)}
                className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportJson}
                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700"
              >
                Concluir Importação
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
          {/* Left: UDF List */}
          <div className="w-full md:w-1/2 flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Funções Disponíveis</h3>
            {userDefinedFunctions.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                Nenhuma função UDF cadastrada ainda. Clique em "Nova Função UDF".
              </div>
            ) : (
              userDefinedFunctions.map(udf => (
                <div
                  key={udf.id}
                  className={`p-3 rounded-lg border transition-all ${
                    editingUdf?.id === udf.id
                      ? 'border-indigo-500 bg-indigo-50/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-indigo-700">{udf.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                          ({udf.parameters.join(', ') || 'sem parâmetros'})
                        </span>
                      </div>
                      {udf.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{udf.description}</p>
                      )}
                      <div className="mt-2 font-mono text-[11px] bg-slate-50 p-1.5 rounded border border-slate-100 text-slate-700 truncate">
                        = {udf.body}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => handleStartEdit(udf)}
                        title="Editar"
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteUserDefinedFunction(udf.id)}
                        title="Excluir"
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: Form Editor */}
          <div className="w-full md:w-1/2 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            {editingUdf ? (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {userDefinedFunctions.some(u => u.id === editingUdf.id) ? 'Editar Função' : 'Nova Função'}
                </h3>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Nome da Função</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: MargemPercentual"
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Parâmetros (separados por vírgula)
                  </label>
                  <input
                    type="text"
                    value={paramsStr}
                    onChange={e => setParamsStr(e.target.value)}
                    placeholder="Ex: receita, custo"
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Expressão DAX (Corpo da Função)</label>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Ex: DIVIDE(receita - custo, receita, 0)"
                    rows={4}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Descrição / Documentação</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ex: Retorna a margem percentual com tratamento de zero"
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => setEditingUdf(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-1.5 text-xs bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-xs"
                  >
                    Salvar UDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Code className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs">Selecione uma função à esquerda para editar ou clique em "Nova Função UDF".</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>UDFs registradas tornam-se disponíveis globalmente para todas as medidas e consultas DAX.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
