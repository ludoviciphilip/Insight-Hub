import React, { useRef } from 'react';
import { Plus, Copy, Trash2, Edit2, Smartphone, ArrowLeft, Target, X } from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { VisualCard } from './VisualCard';

export const ReportView: React.FC = () => {
  const {
    pages,
    activePageId,
    setActivePageId,
    addPage,
    renamePage,
    duplicatePage,
    deletePage,
    selectedVisualId,
    setSelectedVisualId,
    canvasZoom,
    layoutMode,
    gridSize,
    showGrid,
    activeDrillthrough,
    clearDrillthrough,
  } = useBiStore();

  const activePage = pages.find(p => p.id === activePageId) || pages[0];
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedVisualId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-200/70 select-none">
      {/* Active Drill-Through Top Navigation Banner */}
      {activeDrillthrough && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 px-4 py-2 flex items-center justify-between shadow-md shrink-0 z-30 border-b border-amber-600">
          <div className="flex items-center gap-3">
            <button
              onClick={() => clearDrillthrough(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all shadow-xs cursor-pointer hover:scale-102"
              title={`Retornar à página ${activeDrillthrough.sourcePageName}`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar para {activeDrillthrough.sourcePageName}</span>
            </button>

            <div className="flex items-center gap-2 text-xs">
              <span className="bg-amber-300 text-slate-950 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-400">
                <Target className="w-3.5 h-3.5 text-slate-900" />
                Detalhamento Ativo (Drill-Through)
              </span>
              <span className="text-white font-medium">
                Entidade filtrada: <strong className="text-amber-100">{activeDrillthrough.field}</strong> ={' '}
                <span className="bg-white text-slate-900 px-2 py-0.5 rounded font-bold shadow-xs">
                  {String(activeDrillthrough.value)}
                </span>
              </span>
              <span className="text-amber-100/80 text-[11px] hidden md:inline">
                • Origem: {activeDrillthrough.sourceVisualTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => clearDrillthrough(false)}
              className="px-2.5 py-1 text-xs bg-amber-400/90 hover:bg-amber-300 text-slate-950 rounded-lg font-semibold transition-colors cursor-pointer"
              title="Manter nesta página mas remover o filtro do detalhamento"
            >
              Limpar Filtro
            </button>
            <button
              onClick={() => clearDrillthrough(true)}
              className="p-1 text-amber-950 hover:bg-amber-600/50 rounded-lg transition-colors cursor-pointer"
              title="Fechar detalhamento e voltar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Central Canvas Area */}
      <div
        className="flex-1 overflow-auto p-6 flex justify-center items-start"
        onClick={handleCanvasClick}
      >
        {layoutMode === 'mobile' ? (
          // Mobile View Container
          <div className="w-[380px] min-h-[680px] bg-white rounded-3xl shadow-2xl border-8 border-slate-800 p-4 relative flex flex-col gap-4 overflow-y-auto">
            <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2 shrink-0"></div>
            <div className="text-center font-bold text-slate-800 text-sm mb-1">
              {activePage?.name || 'Página'} (Layout Celular)
            </div>
            {activePage?.visuals.map(visual => (
              <div key={visual.id} className="relative h-[220px] w-full shrink-0">
                <VisualCard
                  visual={visual}
                  isMobile={true}
                  isSelected={selectedVisualId === visual.id}
                  onSelect={() => setSelectedVisualId(visual.id)}
                />
              </div>
            ))}
            {(!activePage?.visuals || activePage.visuals.length === 0) && (
              <div className="text-center text-xs text-slate-400 py-12">
                Nenhum visual nesta página
              </div>
            )}
          </div>
        ) : (
          // Desktop Free Canvas
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{
              transform: `scale(${canvasZoom / 100})`,
              transformOrigin: 'top center',
              width: 1240,
              height: 820,
              backgroundImage: showGrid
                ? 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)'
                : 'none',
              backgroundSize: `${gridSize || 20}px ${gridSize || 20}px`,
              backgroundPosition: '0 0, 10px 10px',
            }}
            className="bg-white rounded shadow-sm border border-slate-300 relative shrink-0 transition-transform duration-75"
          >
            {activePage?.visuals.map(visual => (
              <VisualCard
                key={visual.id}
                visual={visual}
                isSelected={selectedVisualId === visual.id}
                onSelect={() => setSelectedVisualId(visual.id)}
              />
            ))}

            {(!activePage?.visuals || activePage?.visuals.length === 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
                <p className="text-sm font-semibold">Esta página ainda não possui visuais</p>
                <p className="text-xs mt-1">Clique em "Novo Visual" na barra superior ou selecione campos à direita.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Page Navigation Bar */}
      <div className="h-9 bg-white border-t border-slate-300 flex items-center justify-between px-3 text-xs shrink-0 select-none">
        <div className="flex items-center gap-1 overflow-x-auto">
          {pages.map(page => {
            const isActive = page.id === activePageId;
            return (
              <div
                key={page.id}
                onClick={() => setActivePageId(page.id)}
                className={`group flex items-center gap-2 px-3 py-1 rounded-t border-t-2 cursor-pointer transition-all ${
                  isActive
                    ? 'border-amber-500 bg-amber-50/50 text-slate-900 font-bold shadow-xs'
                    : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="truncate max-w-[140px] text-[11px]">{page.name}</span>

                {/* Page Quick Actions (rename, duplicate, delete) */}
                {isActive && (
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newName = prompt('Novo nome para a página:', page.name);
                        if (newName) renamePage(page.id, newName);
                      }}
                      className="p-0.5 hover:text-amber-700"
                      title="Renomear página"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicatePage(page.id);
                      }}
                      className="p-0.5 hover:text-amber-700"
                      title="Duplicar página"
                    >
                      <Copy className="w-2.5 h-2.5" />
                    </button>
                    {pages.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Excluir página "${page.name}"?`)) {
                            deletePage(page.id);
                          }
                        }}
                        className="p-0.5 hover:text-red-600"
                        title="Excluir página"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={() => addPage()}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-amber-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors ml-1"
            title="Adicionar Nova Página"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Página</span>
          </button>
        </div>

        <div className="text-[10px] text-slate-400 font-medium hidden sm:block">
          Grade: 1240 × 820 px • Resolução Nativa
        </div>
      </div>
    </div>
  );
};
