import React, { Suspense, lazy, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { ViewType, WorkspaceTab } from './types';
import { Sidebar } from './components/Sidebar';
import { WorkspaceModal } from './components/WorkspaceModal';
import { AuthGate } from './components/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';

const HomeView = lazy(() => import('./components/HomeView').then((module) => ({ default: module.HomeView })));
const RoomsView = lazy(() => import('./components/RoomsView').then((module) => ({ default: module.RoomsView })));
const LiveRunView = lazy(() => import('./components/LiveRunView').then((module) => ({ default: module.LiveRunView })));
const OpsView = lazy(() => import('./components/OpsView').then((module) => ({ default: module.OpsView })));
const ArtifactsView = lazy(() => import('./components/ArtifactsView').then((module) => ({ default: module.ArtifactsView })));
const AutomationsView = lazy(() => import('./components/AutomationsView').then((module) => ({ default: module.AutomationsView })));
const ReviewView = lazy(() => import('./components/ReviewView').then((module) => ({ default: module.ReviewView })));
const ConflictGraphView = lazy(() => import('./components/ConflictGraphView').then((module) => ({ default: module.ConflictGraphView })));
const TaskSummaryView = lazy(() => import('./components/TaskSummaryView').then((module) => ({ default: module.TaskSummaryView })));

const VALID_VIEWS: ViewType[] = [
  'home',
  'tasks',
  'rooms',
  'live',
  'ops',
  'review',
  'artifacts',
  'automations',
  'conflicts'
];

function getViewFromUrl(): ViewType {
  const hash = window.location.hash.replace('#', '').trim() as ViewType;
  if (VALID_VIEWS.includes(hash)) return hash;
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view') as ViewType;
  if (VALID_VIEWS.includes(viewParam)) return viewParam;
  return 'rooms';
}

export function App() {
  const [currentView, setCurrentView] = useState<ViewType>(() => getViewFromUrl());
  const [mountedViews, setMountedViews] = useState<Set<ViewType>>(() => new Set([currentView]));
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<WorkspaceTab>('Agents');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatResetKey, setChatResetKey] = useState(0);

  // Keep visited views mounted in memory to prevent loss of drafts and tab state
  useEffect(() => {
    setMountedViews(prev => {
      if (prev.has(currentView)) return prev;
      const next = new Set(prev);
      next.add(currentView);
      return next;
    });
  }, [currentView]);

  // Sync state with URL hash and browser back/forward history
  useEffect(() => {
    const handleUrlChange = () => {
      const view = getViewFromUrl();
      setCurrentView(view);
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  const handleSelectView = (view: ViewType) => {
    setCurrentView(view);
    if (window.location.hash !== `#${view}`) {
      window.location.hash = `#${view}`;
    }
  };

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
        onSelectView={handleSelectView}
        onOpenCustomize={(tab) => handleOpenModal(tab ?? 'Agents')}
        onNewChat={() => { handleSelectView('home'); setChatResetKey(k => k + 1); }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Primary Workspace Viewport (Keep-Alive architecture preserves tab state and inputs) */}
      <main className="app-main flex-1 flex overflow-hidden relative bg-slate-50">
        {VALID_VIEWS.map(view => {
          if (!mountedViews.has(view)) return null;
          const isActive = currentView === view;
          return (
            <div
              key={view}
              className={`flex-1 min-w-0 h-full min-h-0 flex-col overflow-hidden ${
                isActive ? 'flex' : 'hidden'
              }`}
              style={{ display: isActive ? undefined : 'none' }}
              aria-hidden={!isActive}
            >
              <ErrorBoundary key={view} onReset={() => setCurrentView(view)}>
                <Suspense
                  fallback={
                    <div
                      className="flex h-full items-center justify-center text-sm text-slate-500"
                      role="status"
                    >
                      Loading workspace…
                    </div>
                  }
                >
                  {view === 'home' && (
                    <HomeView
                      onSelectPrompt={handleSelectPrompt}
                      onNavigateToAutomations={() => handleSelectView('automations')}
                      onOpenSkills={() => handleOpenModal('Skills')}
                      resetKey={chatResetKey}
                    />
                  )}

                  {view === 'tasks' && <TaskSummaryView />}

                  {view === 'live' && (
                    <LiveRunView onOpenConnections={() => handleOpenModal('Connections')} />
                  )}

                  {view === 'ops' && <OpsView />}

                  {view === 'rooms' && <RoomsView />}

                  {view === 'artifacts' && <ArtifactsView />}

                  {view === 'automations' && <AutomationsView />}

                  {view === 'review' && <ReviewView />}

                  {view === 'conflicts' && <ConflictGraphView />}
                </Suspense>
              </ErrorBoundary>
            </div>
          );
        })}
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
