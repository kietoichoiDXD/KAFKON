import React, { useEffect, useState } from 'react';
import { ViewType, WorkspaceTab } from '../types';
import { get, Run, isGitHubPages } from '../api';
import { MOCK_RUNS } from '../data/mockOps';

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  onOpenCustomize: (tab?: WorkspaceTab) => void;
  onNewChat: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onOpenCustomize,
  onNewChat,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatId, setActiveChatId] = useState('0');
  const [runs, setRuns] = useState<Run[] | null>(null);

  useEffect(() => {
    get<Run[]>('/api/runs').then(res => {
      if (res && res.length > 0) {
        setRuns(res);
      } else if (isGitHubPages() || res === null) {
        setRuns(MOCK_RUNS as any);
      } else {
        setRuns([]);
      }
    });
  }, []);

  const filteredChats = (runs ?? [])
    .map((r, i) => ({ id: String(i), title: r.title, time: r.at.slice(11, 16), engine: r.engine }))
    .filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const navItems = [
    {
      id: 'projects' as ViewType,
      label: 'Projects',
      mobileLabel: 'Projects',
      icon: 'folder_open',
      badge: 'Hub',
      badgeClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    },
    {
      id: 'home' as ViewType,
      label: 'Spec Studio',
      mobileLabel: 'Studio',
      icon: 'terminal',
      badge: null,
    },
    {
      id: 'tasks' as ViewType,
      label: 'Product Tasks',
      mobileLabel: 'Tasks',
      icon: 'summarize',
      badge: 'ClickUp',
    },
    {
      id: 'live' as ViewType,
      label: 'Live Telemetry',
      mobileLabel: 'Live',
      icon: 'bolt',
      badge: 'Live',
    },
    {
      id: 'ops' as ViewType,
      label: 'AIOps Incident',
      mobileLabel: 'Ops',
      icon: 'healing',
      badge: 'Cluster',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    },
    {
      id: 'review' as ViewType,
      label: 'Evidence Audit',
      mobileLabel: 'Audit',
      icon: 'fact_check',
      badge: '3-Axis',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
    {
      id: 'conflicts' as ViewType,
      label: 'Task ↔ Code',
      mobileLabel: 'Code',
      icon: 'account_tree',
      badge: null,
    },
    {
      id: 'artifacts' as ViewType,
      label: 'Integrity Seals',
      mobileLabel: 'Seals',
      icon: 'folder_zip',
      badge: null,
    },
    {
      id: 'rooms' as ViewType,
      label: 'Chat Rooms',
      mobileLabel: 'Rooms',
      icon: 'forum',
      badge: 'Slack',
    },
    {
      id: 'automations' as ViewType,
      label: 'Automations',
      mobileLabel: 'Rules',
      icon: 'precision_manufacturing',
      badge: null,
    },
  ];

  return (
    <aside
      className={`scribeba-sidebar h-full border-r flex flex-col justify-between transition-all duration-200 z-30 shrink-0 ${
        isCollapsed ? 'w-16' : 'w-[260px]'
      }`}
    >
      {/* Top Brand Header */}
      <div className="sidebar-content flex flex-col flex-1 min-h-0">
        <div className="sidebar-brandbar h-14 px-3 flex items-center justify-between border-b border-slate-200">
          <div
            role="button"
            tabIndex={0}
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => onSelectView('home')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectView('home');
              }
            }}
          >
            <div className="w-8 h-8 rounded-md bg-slate-900 text-teal-400 font-bold flex items-center justify-center text-sm group-hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">hub</span>
            </div>
            {!isCollapsed && (
              <div className="leading-tight">
                <div className="font-bold text-[15px] tracking-tight text-slate-900">ScribeBA</div>
                <div className="text-[11px] font-semibold text-slate-500">Studio</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors ml-auto"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isCollapsed ? 'menu_open' : 'menu'}
            </span>
          </button>
        </div>

        {/* Action Button: New Session */}
        <div className="sidebar-new-session p-3">
          <button
            type="button"
            onClick={onNewChat}
            aria-label="Start a new session"
            title="Start a new session"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors bg-teal-700 text-white hover:bg-teal-800"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {!isCollapsed && <span>New Session</span>}
          </button>
        </div>

        {/* Navigation Rail */}
        <nav aria-label="Main navigation" className="sidebar-nav px-2 space-y-1">
          {navItems.map(item => {
            const isActive = currentView === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelectView(item.id)}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`material-symbols-outlined text-[19px] shrink-0 ${
                      isActive ? 'text-teal-700' : 'text-slate-500'
                    }`}
                  >
                    {item.icon}
                  </span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                  <span className="sidebar-mobile-label">{item.mobileLabel}</span>
                </div>
                {!isCollapsed && item.badge && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider shrink-0 ${
                      item.badgeClass || 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Telemetry Status Strip */}
        {!isCollapsed && (
          <div className="sidebar-inference-status mx-3 my-3 p-2.5 rounded-md bg-slate-100 border border-slate-200 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-700 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-700"></span>
                <span>Inference Core</span>
              </span>
              <span className="font-mono text-slate-900 font-semibold">Nebius Qwen-30B</span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Hallucination Guard</span>
              <span className="text-teal-900 font-semibold">Active (3-Axis)</span>
            </div>
          </div>
        )}

        {/* Recent Runs History */}
        {!isCollapsed && (
          <div className="sidebar-recent-runs flex-1 flex flex-col min-h-0 px-2 mt-1">
            <div className="flex items-center justify-between px-2.5 py-1 text-slate-700 text-[13px] font-semibold">
              <span>Recent runs</span>
              <button
                type="button"
                onClick={() => setSearchQuery(q => (q ? '' : ' '))}
                className="hover:text-slate-900 text-slate-600"
                title="Search runs"
              >
                <span className="material-symbols-outlined text-[16px]">search</span>
              </button>
            </div>

            {searchQuery !== '' && (
              <div className="px-2 py-1">
                <input
                  type="text"
                  placeholder="Filter runs..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white focus-ring text-slate-800"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-0.5 mt-1 pr-1">
              {filteredChats.length === 0 && (
                <p className="px-2.5 py-3 text-xs text-slate-600">
                  {isGitHubPages() ? 'Demo Mode: Mock runs loaded.' : 'No recent runs found.'}
                </p>
              )}
              {filteredChats.map(chat => {
                const isActive = activeChatId === chat.id;
                return (
                  <button
                    type="button"
                    key={chat.id}
                    onClick={() => {
                      setActiveChatId(chat.id);
                      onSelectView('home');
                    }}
                    className={`w-full group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="material-symbols-outlined text-[16px] text-slate-600 group-hover:text-slate-800 shrink-0">
                        description
                      </span>
                      <span className="truncate">{chat.title}</span>
                    </div>
                    {chat.time && (
                      <span className="text-[11px] font-mono text-slate-600 shrink-0 ml-1">
                        {chat.time}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer Section */}
      <div className="p-2 border-t border-slate-200 space-y-1">
        <button
          type="button"
          onClick={() => onOpenCustomize('Agents')}
          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-slate-900 text-teal-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
              BA
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">
                  Mission Workspace
                </div>
                <div className="text-[11px] text-slate-700">KAFKON · Production</div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <span className="material-symbols-outlined text-slate-600 text-[18px]">settings</span>
          )}
        </button>
      </div>
    </aside>
  );
};
