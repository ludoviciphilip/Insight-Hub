import React from 'react';
import {
  BarChart3,
  Table,
  Layers,
  Sliders,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { ActiveView } from '../../types/bi';

export const SidebarNav: React.FC = () => {
  const { activeView, setActiveView, setLimitationsModalOpen } = useBiStore();

  const navItems: { view: ActiveView; label: string; icon: any }[] = [
    { view: 'report', label: 'Relatório', icon: BarChart3 },
    { view: 'data', label: 'Dados', icon: Table },
    { view: 'model', label: 'Modelo', icon: Layers },
    { view: 'query', label: 'Power Query', icon: Sliders },
    { view: 'metabase', label: 'Pergunta (Metabase)', icon: Search },
    { view: 'dashboard', label: 'Dashboards & Metas', icon: LayoutDashboard },
    { view: 'governance', label: 'Workspaces & Governança', icon: ShieldCheck },
  ];

  return (
    <div className="w-14 bg-slate-900 border-r border-slate-800 flex flex-col items-center justify-between py-2 select-none z-20">
      {/* Top Icons */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setActiveView(item.view)}
              title={item.label}
              className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
                isActive
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Icon className="w-5 h-5" />
              {isActive && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-5 bg-amber-400 rounded-r"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Icons: Help & Limitations */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => setLimitationsModalOpen(true)}
          title="Avisos e Limitações do Sistema"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
