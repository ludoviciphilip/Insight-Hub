import React, { useState, useMemo } from 'react';
import { X, Network, Search, Layers, Table as TableIcon, FileCode, ArrowRight, CornerDownRight } from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { buildModelDependencyGraph, DependencyNode } from '../../engine/model/dependencyGraph';

interface DependencyGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDefinition?: (name: string) => void;
}

export const DependencyGraphModal: React.FC<DependencyGraphModalProps> = ({
  isOpen,
  onClose,
  onNavigateToDefinition,
}) => {
  const { tables, measures, userDefinedFunctions } = useBiStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'measure' | 'table' | 'udf'>('all');

  const graph = useMemo(() => {
    return buildModelDependencyGraph(tables, measures, userDefinedFunctions);
  }, [tables, measures, userDefinedFunctions]);

  if (!isOpen) return null;

  const filteredNodes = graph.nodes.filter(n => {
    if (filterType !== 'all' && n.type !== filterType) return false;
    if (!searchTerm) return true;
    return n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.tableName && n.tableName.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const selectedNode = graph.nodes.find(n => n.id === selectedNodeId) || filteredNodes[0] || null;

  // Inbound edges (who references selectedNode)
  const inboundEdges = selectedNode ? graph.edges.filter(e => e.toId === selectedNode.id) : [];
  const referencingNodes = inboundEdges.map(e => graph.nodes.find(n => n.id === e.fromId)).filter(Boolean) as DependencyNode[];

  // Outbound edges (what selectedNode references)
  const outboundEdges = selectedNode ? graph.edges.filter(e => e.fromId === selectedNode.id) : [];
  const referencedNodes = outboundEdges.map(e => graph.nodes.find(n => n.id === e.toId)).filter(Boolean) as DependencyNode[];

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'table':
        return <TableIcon className="w-4 h-4 text-emerald-600" />;
      case 'measure':
        return <FileCode className="w-4 h-4 text-indigo-600" />;
      case 'udf':
        return <Layers className="w-4 h-4 text-amber-600" />;
      default:
        return <Network className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Gráfico de Dependências do Modelo</h2>
              <p className="text-xs text-slate-500">
                Mapeamento das referências cruzadas entre medidas, colunas, tabelas e funções personalizadas.
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

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filtrar por nome de medida, coluna ou tabela..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            {(['all', 'measure', 'table', 'udf'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                  filterType === f
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'measure' ? 'Medidas' : f === 'table' ? 'Tabelas' : 'UDFs'}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400">
            {graph.nodes.length} nós, {graph.edges.length} conexões
          </span>
        </div>

        {/* Main Split Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Column: Node Explorer */}
          <div className="w-full md:w-1/2 border-r border-slate-200 overflow-y-auto p-4 flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Objetos do Modelo</h3>
            {filteredNodes.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">Nenhum objeto encontrado.</div>
            ) : (
              filteredNodes.map(node => (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    selectedNode?.id === node.id
                      ? 'border-teal-500 bg-teal-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getNodeIcon(node.type)}
                      <span className="font-mono text-xs font-semibold text-slate-800">{node.name}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase font-medium">
                      {node.type}
                    </span>
                  </div>
                  {node.formula && (
                    <div className="mt-1.5 font-mono text-[10px] text-slate-500 bg-slate-50 p-1 rounded border border-slate-100 truncate">
                      {node.formula}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Right Column: Node Details & Dependency Tree */}
          <div className="w-full md:w-1/2 bg-slate-50 overflow-y-auto p-6 flex flex-col gap-6">
            {selectedNode ? (
              <>
                {/* Node Summary Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                        {getNodeIcon(selectedNode.type)}
                      </div>
                      <div>
                        <h4 className="font-mono font-bold text-sm text-slate-800">{selectedNode.name}</h4>
                        <p className="text-xs text-slate-500">Tipo: {selectedNode.type.toUpperCase()}</p>
                      </div>
                    </div>
                    {onNavigateToDefinition && selectedNode.type === 'measure' && (
                      <button
                        onClick={() => {
                          onNavigateToDefinition(selectedNode.name);
                          onClose();
                        }}
                        className="px-2.5 py-1 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium flex items-center gap-1"
                      >
                        Ir para Definição <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {selectedNode.formula && (
                    <div className="mt-3">
                      <span className="text-[11px] font-semibold text-slate-500 block mb-1">Fórmula DAX:</span>
                      <pre className="p-2.5 bg-slate-900 text-amber-300 font-mono text-xs rounded-lg overflow-x-auto whitespace-pre-wrap">
                        {selectedNode.formula}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Inbound: Who references this? */}
                <div className="flex flex-col gap-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <CornerDownRight className="w-4 h-4 text-indigo-600" />
                    Utilizado por ({referencingNodes.length})
                  </h5>
                  {referencingNodes.length === 0 ? (
                    <p className="text-xs text-slate-400 bg-white p-3 rounded-lg border border-slate-200">
                      Nenhuma outra medida depende diretamente deste objeto.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {referencingNodes.map(ref => (
                        <div
                          key={ref.id}
                          onClick={() => setSelectedNodeId(ref.id)}
                          className="px-3 py-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-400 cursor-pointer flex items-center justify-between text-xs transition-all"
                        >
                          <div className="flex items-center gap-2">
                            {getNodeIcon(ref.type)}
                            <span className="font-mono font-medium text-slate-700">{ref.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">Ver detalhes →</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outbound: What does this reference? */}
                <div className="flex flex-col gap-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <ArrowRight className="w-4 h-4 text-emerald-600" />
                    Depende de ({referencedNodes.length})
                  </h5>
                  {referencedNodes.length === 0 ? (
                    <p className="text-xs text-slate-400 bg-white p-3 rounded-lg border border-slate-200">
                      Este objeto não faz referência a outras medidas ou tabelas.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {referencedNodes.map(dep => (
                        <div
                          key={dep.id}
                          onClick={() => setSelectedNodeId(dep.id)}
                          className="px-3 py-2 bg-white rounded-lg border border-slate-200 hover:border-emerald-400 cursor-pointer flex items-center justify-between text-xs transition-all"
                        >
                          <div className="flex items-center gap-2">
                            {getNodeIcon(dep.type)}
                            <span className="font-mono font-medium text-slate-700">{dep.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">Ver detalhes →</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Selecione um objeto à esquerda para visualizar sua teia de dependências.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>O gráfico é reconstruído em tempo real a partir das fórmulas de todas as medidas e colunas calculadas.</span>
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
