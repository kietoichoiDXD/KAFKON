import React, { useState } from 'react';
import { ViewType, ChatItem } from '../types';
import { CHAT_HISTORY } from '../data/mockData';

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  onOpenCustomize: () => void;
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
  const [activeChatId, setActiveChatId] = useState('1');

  const filteredChats = CHAT_HISTORY.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside
      className={`h-screen bg-[#fbfcfb] border-r border-gray-200/80 flex flex-col justify-between transition-all duration-300 z-30 shrink-0 ${
        isCollapsed ? 'w-16' : 'w-[260px]'
      }`}
    >
      {/* Top Section */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
        <nav className="px-2 space-y-0.5">
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

          <button
            onClick={onOpenCustomize}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13.5px] text-gray-600 hover:bg-gray-100/60 hover:text-gray-900 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[19px] text-gray-500">tune</span>
              {!isCollapsed && <span>Customize</span>}
            </div>
          </button>
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
        {!isCollapsed && (
          <div className="p-2.5 rounded-xl border border-teal-200/80 bg-gradient-to-r from-teal-50/50 to-emerald-50/30">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[12px] font-semibold text-[#7b5cff]">Team trial · 7 days left</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Ends Sep 18, 2026 ·{' '}
                  <span className="underline cursor-pointer hover:text-[#7b5cff]">Upgrade</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[#7b5cff] text-[16px] mt-0.5">schedule</span>
            </div>
          </div>
        )}

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
          {!isCollapsed && (
            <div className="relative p-1 text-gray-400 hover:text-gray-600">
              <span className="material-symbols-outlined text-[19px]">notifications</span>
              <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-[#7b5cff] text-white text-[9px] font-bold flex items-center justify-center">
                31
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
