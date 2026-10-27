/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useBiStore } from './store/useBiStore';
import { Ribbon } from './components/layout/Ribbon';
import { SidebarNav } from './components/layout/SidebarNav';
import { ReportView } from './components/report/ReportView';
import { DataView } from './components/data/DataView';
import { ModelView } from './components/model/ModelView';
import { PowerQueryView } from './components/query/PowerQueryView';
import { MetabaseQuestionView } from './components/metabase/MetabaseQuestionView';
import { DashboardsView } from './components/dashboards/DashboardsView';
import { GovernanceView } from './components/governance/GovernanceView';
import { DaxQueryView } from './components/daxquery/DaxQueryView';
import { DaxComplianceView } from './components/compliance/DaxComplianceView';
import { VisualizationsPane } from './components/panels/VisualizationsPane';
import { FieldsPane } from './components/panels/FieldsPane';
import { FiltersPane } from './components/panels/FiltersPane';
import { AiAssistantModal } from './components/ai/AiAssistantModal';
import { DataSourceModal } from './components/modals/DataSourceModal';
import { QuickMeasureModal } from './components/modals/QuickMeasureModal';
import { CustomMeasureModal } from './components/modals/CustomMeasureModal';
import { LimitationsModal } from './components/modals/LimitationsModal';
import { ThemeManagerModal } from './components/modals/ThemeManagerModal';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

export default function App() {
  const { activeView, loadProject, isPresentationMode } = useBiStore();

  const [showFiltersPane, setShowFiltersPane] = useState(true);
  const [showVisualsPane, setShowVisualsPane] = useState(true);
  const [showFieldsPane, setShowFieldsPane] = useState(true);

  // Attempt to load existing saved project on first launch
  useEffect(() => {
    loadProject().catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* Top Ribbon Toolbar (Hidden in full presentation mode) */}
      {!isPresentationMode && (
        <Ribbon
          showFiltersPane={showFiltersPane}
          setShowFiltersPane={setShowFiltersPane}
          showVisualsPane={showVisualsPane}
          setShowVisualsPane={setShowVisualsPane}
          showFieldsPane={showFieldsPane}
          setShowFieldsPane={setShowFieldsPane}
        />
      )}

      {/* Main Body Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Vertical Power BI Navigation Bar */}
        {!isPresentationMode && <SidebarNav />}

        {/* Center Main Stage according to Active View */}
        <div className="flex-1 flex overflow-hidden relative">
          {activeView === 'report' && <ReportView />}
          {activeView === 'data' && <DataView />}
          {activeView === 'model' && <ModelView />}
          {activeView === 'query' && <PowerQueryView />}
          {activeView === 'metabase' && <MetabaseQuestionView />}
          {activeView === 'dashboard' && <DashboardsView />}
          {activeView === 'governance' && <GovernanceView />}
          {activeView === 'daxquery' && <DaxQueryView />}
          {activeView === 'daxcompliance' && <DaxComplianceView />}

          {/* Right Collapsible Panes (only visible in Report View) */}
          {activeView === 'report' && !isPresentationMode && (
            <div className="flex h-full shrink-0">
              {showFiltersPane && <FiltersPane />}
              {showVisualsPane && (
                <ErrorBoundary fallbackTitle="Painel de Visualizações">
                  <VisualizationsPane />
                </ErrorBoundary>
              )}
              {showFieldsPane && <FieldsPane />}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Global Modals */}
      <AiAssistantModal />
      <DataSourceModal />
      <QuickMeasureModal />
      <CustomMeasureModal />
      <LimitationsModal />
      <ThemeManagerModal />
    </div>
  );
}
