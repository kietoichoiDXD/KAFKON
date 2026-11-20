import React, { Suspense, lazy, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ViewType, WorkspaceTab } from './types';
import { Sidebar } from './components/Sidebar';
import { WorkspaceModal } from './components/WorkspaceModal';
import { AuthGate } from './components/AuthGate';

const HomeView = lazy(() => import('./components/HomeView').then((module) => ({ default: module.HomeView })));
const RoomsView = lazy(() => import('./components/RoomsView').then((module) => ({ default: module.RoomsView })));
const LiveRunView = lazy(() => import('./components/LiveRunView').then((module) => ({ default: module.LiveRunView })));
const OpsView = lazy(() => import('./components/OpsView').then((module) => ({ default: module.OpsView })));
const ArtifactsView = lazy(() => import('./components/ArtifactsView').then((module) => ({ default: module.ArtifactsView })));
const AutomationsView = lazy(() => import('./components/AutomationsView').then((module) => ({ default: module.AutomationsView })));
const ReviewView = lazy(() => import('./components/ReviewView').then((module) => ({ default: module.ReviewView })));
const ConflictGraphView = lazy(() => import('./components/ConflictGraphView').then((module) => ({ default: module.ConflictGraphView })));
const TaskSummaryView = lazy(() => import('./components/TaskSummaryView').then((module) => ({ default: module.TaskSummaryView })));

export function App() {
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as ViewType;
    const validViews: ViewType[] = ['home', 'tasks', 'rooms', 'live', 'ops', 'review', 'artifacts', 'automations', 'conflicts'];
    if (validViews.includes(viewParam)) return viewParam;
    const hash = window.location.hash.replace('#', '') as ViewType;
    if (validViews.includes(hash)) return hash;
    return 'rooms';
  });
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
    <AuthGate>
    <MotionConfig reducedMotion="user">
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
        <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentView}
          className="flex-1 min-w-0 h-full min-h-0 flex flex-col overflow-hidden"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-500" role="status">Loading workspace…</div>}>
        {currentView === 'home' && (
          <HomeView
            onSelectPrompt={handleSelectPrompt}
            onNavigateToAutomations={() => setCurrentView('automations')}
            onOpenSkills={() => handleOpenModal('Skills')}
            resetKey={chatResetKey}
          />
        )}

        {currentView === 'tasks' && <TaskSummaryView />}

        {currentView === 'live' && <LiveRunView onOpenConnections={() => handleOpenModal('Connections')} />}

        {currentView === 'ops' && <OpsView />}

        {currentView === 'rooms' && <RoomsView />}

        {currentView === 'artifacts' && <ArtifactsView />}

        {currentView === 'automations' && <AutomationsView />}

        {currentView === 'review' && <ReviewView />}

        {currentView === 'conflicts' && <ConflictGraphView />}
        </Suspense>
        </motion.div>
        </AnimatePresence>
      </main>

      {/* System Design & Workspace Modal */}
      <WorkspaceModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        initialTab={modalInitialTab}
      />
    </div>
    </MotionConfig>
    </AuthGate>
  );
}

export default App;
