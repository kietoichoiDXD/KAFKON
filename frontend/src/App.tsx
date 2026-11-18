import React, { useState } from 'react';
import { ViewType, WorkspaceTab } from './types';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { RoomsView } from './components/RoomsView';
import { LiveRunView } from './components/LiveRunView';
import { OpsView } from './components/OpsView';
import { ArtifactsView } from './components/ArtifactsView';
import { AutomationsView } from './components/AutomationsView';
import { ReviewView } from './components/ReviewView';
import { ConflictGraphView } from './components/ConflictGraphView';
import { WorkspaceModal } from './components/WorkspaceModal';

export function App() {
  const [currentView, setCurrentView] = useState<ViewType>('review');
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<WorkspaceTab>('Agents');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatResetKey, setChatResetKey] = useState(0);

  const handleSelectPrompt = (_prompt: string) => {};

  const handleOpenModal = (tab: WorkspaceTab = 'Skills') => {
    setModalInitialTab(tab);
    setIsWorkspaceModalOpen(true);
  };

  return (
    <div className="app-shell flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Main Command Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        onOpenCustomize={(tab) => handleOpenModal(tab ?? 'Agents')}
        onNewChat={() => { setCurrentView('home'); setChatResetKey(k => k + 1); }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Primary Workspace Viewport */}
      <main className="app-main flex-1 flex overflow-hidden relative bg-slate-50">
        {currentView === 'home' && (
          <HomeView
            onSelectPrompt={handleSelectPrompt}
            onNavigateToAutomations={() => setCurrentView('automations')}
            onOpenSkills={() => handleOpenModal('Skills')}
            onNewChat={() => { setCurrentView('home'); setChatResetKey(k => k + 1); }}
            resetKey={chatResetKey}
          />
        )}

        {currentView === 'live' && <LiveRunView />}

        {currentView === 'ops' && <OpsView />}

        {currentView === 'rooms' && <RoomsView />}

        {currentView === 'artifacts' && <ArtifactsView />}

        {currentView === 'automations' && <AutomationsView />}

        {currentView === 'review' && <ReviewView />}

        {currentView === 'conflicts' && <ConflictGraphView />}
      </main>

      {/* System Design & Workspace Modal */}
      <WorkspaceModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        initialTab={modalInitialTab}
      />
    </div>
  );
}

export default App;
