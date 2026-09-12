import React, { useState } from 'react';
import { ViewType, WorkspaceTab } from './types';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { RoomsView } from './components/RoomsView';
import { LiveRunView } from './components/LiveRunView';
import { Petals } from './components/Petals';
import { OpsView } from './components/OpsView';
import { ArtifactsView } from './components/ArtifactsView';
import { AutomationsView } from './components/AutomationsView';
import { ReviewView } from './components/ReviewView';
import { WorkspaceModal } from './components/WorkspaceModal';

export function App() {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<WorkspaceTab>('Agents');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleSelectPrompt = (prompt: string) => {
    alert(`Starting new architectural session on: "${prompt}"`);
  };

  const handleOpenModal = (tab: WorkspaceTab = 'Skills') => {
    setModalInitialTab(tab);
    setIsWorkspaceModalOpen(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#fdf7fb] text-[#221733]">
      <Petals />
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        onOpenCustomize={() => handleOpenModal('Agents')}
        onNewChat={() => setCurrentView('home')}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main View Router */}
      <main className="flex-1 flex overflow-hidden relative">
        {currentView === 'home' && (
          <HomeView
            onSelectPrompt={handleSelectPrompt}
            onNavigateToAutomations={() => setCurrentView('automations')}
            onOpenSkills={() => handleOpenModal('Skills')}
          />
        )}

        {currentView === 'live' && <LiveRunView />}

        {currentView === 'ops' && <OpsView />}

        {currentView === 'rooms' && <RoomsView />}

        {currentView === 'artifacts' && <ArtifactsView />}

        {currentView === 'automations' && <AutomationsView />}

        {currentView === 'review' && <ReviewView />}
      </main>

      {/* Comprehensive Workspace Settings & System Design Modal */}
      <WorkspaceModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        initialTab={modalInitialTab}
      />
    </div>
  );
}

export default App;
