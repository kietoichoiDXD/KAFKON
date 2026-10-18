import React, { useEffect, useState } from 'react';
import { ViewType, ChatItem, WorkspaceTab } from '../types';
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [visibleExtras, setVisibleExtras] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('kafkon-sidebar-extras') || '{}'); } catch { return {}; }
  });

  const toggleExtra = (name: string) => setVisibleExtras(current => {
    const next = { ...current, [name]: !current[name] };
    localStorage.setItem('kafkon-sidebar-extras', JSON.stringify(next));
    return next;
  });

  const openWorkspace = (tab: WorkspaceTab) => {
    onOpenCustomize(tab);
    setMoreOpen(false);
  };

  // The history is the runs this backend performed - not a list of invented conversations.
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

  return (
    <aside
      className={`h-screen bg-[#f7f8fa] border-r border-slate-200/80 flex flex-col justify-between transition-all duration-300 z-30 shrink-0 ${
        isCollapsed ? 'w-16' : 'w-[260px]'
      }`}
    >
      {/* Top Section */}
      <div className="flex flex-col flex-1 min-h-0 overflow-visible">
        {/* Brand & Collapse */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-gray-100">
          {!isCollapsed && (
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSelectView('home')}>
              <div className="w-7 h-7 rounded-lg kf-gradient kf-glow flex items-center justify-center text-white font-extrabold text-[13px]">
                K
              </div>
              <div className="leading-none">
                <div className="font-extrabold text-[15px] tracking-tight kf-gradient-text">ScribeBA</div>
                <div className="kf-jp text-[8.5px] text-gray-400 mt-0.5">カフコン · KAFKON</div>
              </div>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ml-auto"
          >
            <span className="material-symbols-outlined text-[18px]">dock_to_right</span>
          </button>
        </div>

        {/* Workspace Dropdown & New Chat */}
        <div className="p-3 space-y-2">
          {!isCollapsed && (
            <button
              onClick={() => onSelectView('home')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13.5px] font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span>Home</span>
              <span className="material-symbols-outlined text-gray-400 text-[18px]">expand_more</span>
            </button>
          )}

          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full border border-gray-200 hover:border-[#7b5cff] text-[#7b5cff] hover:bg-[#7b5cff]/5 text-[13.5px] font-medium transition-all shadow-sm group"
          >
            <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">add_circle</span>
            {!isCollapsed && <span>New chat</span>}
          </button>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Workspace navigation" className="relative px-2 space-y-1">
          <button
            onClick={() => onSelectView('live')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13.5px] transition-colors ${
              currentView === 'live'
                ? 'bg-gradient-to-r from-[#ff5f9e]/12 to-[#7b5cff]/12 text-[#3d2b63] font-semibold ring-1 ring-[#7b5cff]/15'
                : 'text-gray-600 hover:bg-gray-100/60 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[19px] text-gray-500">bolt</span>
              {!isCollapsed && <span>Live run</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded border border-[#7b5cff]/40 text-[#7b5cff] uppercase">
                Live
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectView('ops')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13.5px] transition-colors ${
              currentView === 'ops'
                ? 'bg-gradient-to-r from-[#ff5f9e]/12 to-[#7b5cff]/12 text-[#3d2b63] font-semibold ring-1 ring-[#7b5cff]/15'
                : 'text-gray-600 hover:bg-gray-100/60 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[19px] text-gray-500">emergency_home</span>
              {!isCollapsed && <span>Incidents</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded border border-rose-400/50 text-rose-500 uppercase">
                Ops
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectView('rooms')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13.5px] transition-colors ${
              currentView === 'rooms'
                ? 'bg-gradient-to-r from-[#ff5f9e]/12 to-[#7b5cff]/12 text-[#3d2b63] font-semibold ring-1 ring-[#7b5cff]/15'
                : 'text-gray-600 hover:bg-gray-100/60 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[19px] text-gray-500">forum</span>
              {!isCollapsed && <span>Rooms</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded border border-[#7b5cff]/40 text-[#7b5cff] uppercase">
                New
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectView('artifacts')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13.5px] transition-colors ${
              currentView === 'artifacts'
                ? 'bg-gradient-to-r from-[#ff5f9e]/12 to-[#7b5cff]/12 text-[#3d2b63] font-semibold ring-1 ring-[#7b5cff]/15'
                : 'text-gray-600 hover:bg-gray-100/60 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[19px] text-gray-500">deployed_code</span>
              {!isCollapsed && <span>Artifacts</span>}
            </div>
          </button>

          <button
            onClick={() => onSelectView('automations')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13.5px] transition-colors ${
              currentView === 'automations'
                ? 'bg-gradient-to-r from-[#ff5f9e]/12 to-[#7b5cff]/12 text-[#3d2b63] font-semibold ring-1 ring-[#7b5cff]/15'
                : 'text-gray-600 hover:bg-gray-100/60 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[19px] text-gray-500">precision_manufacturing</span>
              {!isCollapsed && <span>Automations</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded border border-[#7b5cff]/40 text-[#7b5cff] uppercase">
                New
              </span>
            )}
          </button>

          {/* Stitch Integration Tab */}
          <button
            onClick={() => onSelectView('review')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13.5px] transition-colors ${
              currentView === 'review'
                ? 'bg-[#7b5cff]/10 text-[#7b5cff] font-semibold'
                : 'text-gray-600 hover:bg-gray-100/60 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[19px] text-emerald-600">verified</span>
              {!isCollapsed && <span>Evidence Review</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                Stitch
              </span>
            )}
          </button>

          <div className="relative">
          <button
            onClick={() => { setMoreOpen(open => !open); setOpenGroup(null); }}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13.5px] transition-all duration-200 ${moreOpen ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'}`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[19px] text-gray-500">more_horiz</span>
              {!isCollapsed && <span>More</span>}
            </div>
            {!isCollapsed && <span className="material-symbols-outlined text-[16px] text-gray-400">{moreOpen ? 'expand_less' : 'expand_more'}</span>}
          </button>

          {!isCollapsed && moreOpen && (
            <div role="menu" className="absolute left-full top-0 z-50 w-[242px] rounded-xl border border-slate-200/90 bg-white shadow-[0_16px_36px_rgba(15,23,42,0.12)] p-2.5 space-y-0.5 overflow-visible">
              <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">Show in sidebar</div>
              {[
                ['Connections', 'link', 'Connections'], ['Skills', 'auto_awesome', 'Skills'],
                ['Agents', 'group', 'Agents'], ['Knowledge', 'book', 'Knowledge'],
                ['Credentials', 'key', 'Credentials'], ['Commands', 'command', 'Commands'],
                ['Approval', 'check_circle', 'Approval'], ['Notifications', 'notifications', 'Notifications'],
              ].map(([name, icon, label]) => (
                <button key={name} onClick={() => { toggleExtra(name); openWorkspace(name as WorkspaceTab); }} className="w-full min-h-8 flex items-center gap-2.5 px-2 py-1 rounded-md text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5cff]/40 text-left">
                  <span className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${visibleExtras[name] ? 'bg-[#08b8d4] border-[#08b8d4] text-white' : 'border-[#08b8d4]'}`}>
                    {visibleExtras[name] && <span className="material-symbols-outlined text-[12px]">check</span>}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-slate-500">{icon}</span><span>{label}</span>
                </button>
              ))}
              <div className="my-2 border-t border-slate-100" />
              {[
                ['Optimize', 'optimize', ['Overview', 'Cost Health', 'Cost Explorer', 'Findings', 'Anomalies', 'Reports']],
                ['Review', 'code', ['Overview', 'Reviews', 'Releases', 'Learnings', 'Insights', 'Pipelines', 'Customizations', 'Settings']],
                ['Cyber', 'security', ['Overview', 'Security Findings', 'Threats', 'Compliance', 'Reports']],
                ['Resolve', 'monitor_heart', ['Overview', 'Pulse', 'Investigation', 'Insights', 'Integrations', 'On-call', 'Runbooks', 'Settings']],
              ].map(([group, icon, children]) => (
                <div key={group as string} className="relative">
                  <button
                    aria-expanded={openGroup === group}
                    onClick={() => setOpenGroup(openGroup === group ? null : group as string)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5cff]/40 ${openGroup === group ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    <span className="material-symbols-outlined text-[16px] text-slate-500">{icon as string}</span>
                    <span className="flex-1">{group as string}</span>
                    <span className="material-symbols-outlined text-[14px] text-slate-400">chevron_right</span>
                  </button>
                  {openGroup === group && (
                    <div className="absolute left-full top-1/2 z-[60] ml-1 w-[190px] max-h-[calc(100vh-24px)] -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-2 shadow-[0_16px_36px_rgba(15,23,42,0.12)]">
                      {(children as string[]).map(child => (
                        <button key={child} onClick={() => { if ((group as string) === 'Review') onSelectView('review'); else if ((group as string) === 'Resolve' && child === 'Investigation') onSelectView('ops'); else if (child === 'Overview') onSelectView('home'); setOpenGroup(null); setMoreOpen(false); }} className="w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] leading-5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5cff]/40">
                          {child}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => { onOpenCustomize(); setMoreOpen(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12.5px] text-gray-700 hover:bg-gray-50 text-left">
                <span className="material-symbols-outlined text-[16px] text-gray-500">settings</span>Workspace settings
              </button>
            </div>
          )}
          </div>
        </nav>

        {/* Chat History Section */}
        {!isCollapsed && (
          <div className="mt-4 flex-1 flex flex-col min-h-0 px-2">
            <div className="flex items-center justify-between px-2.5 py-1 text-gray-500 text-[12px] font-medium">
              <div className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                <span>Chats</span>
                <span className="material-symbols-outlined text-[14px]">expand_more</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <button
                  onClick={() => setSearchQuery(q => (q ? '' : ' '))}
                  className="hover:text-gray-600 p-0.5"
                  title="Search chats"
                >
                  <span className="material-symbols-outlined text-[15px]">search</span>
                </button>
                <button className="hover:text-gray-600 p-0.5" title="Filter chats">
                  <span className="material-symbols-outlined text-[15px]">tune</span>
                </button>
              </div>
            </div>

            {searchQuery !== '' && (
              <div className="px-2 py-1">
                <input
                  type="text"
                  placeholder="Filter chats..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full text-xs px-2 py-1 border rounded bg-white focus:outline-none focus:border-[#7b5cff]"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-0.5 mt-1 pr-1">
              {filteredChats.length === 0 && (
                <p className="px-2.5 py-3 text-[12px] text-gray-400 m-0">
                  {isGitHubPages() ? 'Demo Mode · No runs recorded.' : runs === null ? 'Backend not running.' : 'No runs yet. Start one from Live run.'}
                </p>
              )}
              {filteredChats.map(chat => {
                const isActive = activeChatId === chat.id;
                return (
                  <button
                    key={chat.id}
                    onClick={() => {
                      setActiveChatId(chat.id);
                      onSelectView('home');
                    }}
                    className={`w-full group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${
                      isActive
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="material-symbols-outlined text-[15px] text-gray-400 group-hover:text-gray-600">
                        chat_bubble_outline
                      </span>
                      <span className="truncate">{chat.title}</span>
                    </div>
                    {isActive ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#7b5cff] shrink-0"></span>
                    ) : chat.time ? (
                      <span className="text-[11px] text-gray-400 shrink-0">{chat.time}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section */}
      <div className="p-2.5 border-t border-gray-100 space-y-2">
        {/* User Workspace Profile */}
        <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-gray-100/70 transition-colors cursor-pointer">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#1e2321] text-white flex items-center justify-center text-xs font-bold shrink-0">
              KQ
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-gray-800 truncate">
                  nguyen thanh dat's Wo..
                </div>
                <div className="text-[11px] text-gray-400">Team workspace</div>
              </div>
            )}
          </div>
          {!isCollapsed && filteredChats.length > 0 && (
            <div className="relative p-1 text-gray-400" title={`${filteredChats.length} runs recorded`}>
              <span className="material-symbols-outlined text-[19px]">notifications</span>
              <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-[#7b5cff] text-white text-[9px] font-bold flex items-center justify-center">
                {filteredChats.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
