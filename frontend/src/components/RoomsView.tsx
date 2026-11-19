import React, { useState, useEffect } from 'react';
import {
  RoomItem,
  RoomSocialLink,
  RoomAgentConfig,
  RoomTask,
  RoomChatMessage,
  TreeNode,
} from '../types';
import {
  SPECIALIZED_PM_AGENTS,
  CURATED_OSS_REPOS,
  DEFAULT_PRODUCTION_TREE,
  INITIAL_ROOMS,
} from '../data/mockRooms';
import { ProductionTreeVisualizer } from './ProductionTreeVisualizer';
import { API } from '../api';

type RoomTab = 'chat' | 'tree' | 'tasks' | 'channels' | 'agent' | 'repos';

// Older browser snapshots contained demo webhook URLs and Telegram chat IDs.
// Strip those fields and reset sample connections before they reach the UI.
const sanitizeRoomConnections = (source: RoomItem[]): RoomItem[] =>
  source.map(room => ({
    ...room,
    social_links: (room.social_links || []).map(({ webhook_url: _webhook, chat_id: _chatId, ...link }) => ({
      ...link,
      enabled: false,
      status: 'Disconnected',
    })),
  }));

export const RoomsView: React.FC = () => {
  // Rooms state initialized with rich initial mock rooms
  const [rooms, setRooms] = useState<RoomItem[]>(() => {
    const saved = localStorage.getItem('scribeba_rooms_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? sanitizeRoomConnections(parsed) : INITIAL_ROOMS;
      } catch {
        return INITIAL_ROOMS;
      }
    }
    return INITIAL_ROOMS;
  });

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('room') === 'none') return null;
    return params.get('room') || 'room-auth-iam';
  });
  const [activeTab, setActiveTab] = useState<RoomTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab') as RoomTab;
    if (['chat', 'tree', 'tasks', 'channels', 'agent', 'repos'].includes(t)) return t;
    return 'chat';
  });
  const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<RoomTask['status'] | null>(null);

  // Filter state for all rooms overview
  const [filterQuery, setFilterQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<'All' | 'Slack' | 'Discord' | 'Telegram'>('All');

  // Modal: Create Room state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('modal') === 'create';
  });
  const [newRoomName, setNewRoomName] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('modal') === 'create' ? 'proj-realtime-checkout' : '';
  });
  const [newRoomTopic, setNewRoomTopic] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('modal') === 'create' ? 'Distributed order reservation, Redis locks, and Stripe idempotency' : '';
  });
  const [newRoomDescription, setNewRoomDescription] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('modal') === 'create' ? 'Transactional squad handling multi-channel sprint triage.' : '';
  });
  const [selectedAgentId, setSelectedAgentId] = useState<string>('agile-pm');

  // Channel toggles for creation
  const [enableSlack, setEnableSlack] = useState(true);
  const [slackChannelName, setSlackChannelName] = useState('proj-sprint-chat');
  const [enableDiscord, setEnableDiscord] = useState(true);
  const [discordChannelName, setDiscordChannelName] = useState('dev-operations');
  const [enableTelegram, setEnableTelegram] = useState(false);
  const [telegramChannelName, setTelegramChannelName] = useState('@squad_ops_bot');

  // Chat input state
  const [chatInput, setChatInput] = useState('');
  const [chatPlatformSender, setChatPlatformSender] = useState<'Slack' | 'Discord' | 'Telegram' | 'PM Lead'>('Slack');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // New Task Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('High');
  const [newTaskEvidence, setNewTaskEvidence] = useState<'Verified' | 'Inferred' | 'Assumed' | 'Blocked'>('Verified');
  const [newTaskStory, setNewTaskStory] = useState('');

  // Initial sync from backend API if available
  useEffect(() => {
    fetch(`${API}/api/rooms`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setRooms(sanitizeRoomConnections(data));
        }
      })
      .catch(() => {});
  }, []);

  // Persist rooms to localStorage
  useEffect(() => {
    localStorage.setItem('scribeba_rooms_v3', JSON.stringify(rooms));
  }, [rooms]);

  // Current selected room
  const currentRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0] || null;

  // Handle Create Room
  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return;

    const agent = SPECIALIZED_PM_AGENTS.find(a => a.agent_id === selectedAgentId) || SPECIALIZED_PM_AGENTS[0];

    const socialLinks: RoomSocialLink[] = [];
    if (enableSlack) {
      socialLinks.push({
        platform: 'Slack',
        channel: slackChannelName.startsWith('#') ? slackChannelName : `#${slackChannelName}`,
        enabled: true,
        status: 'Disconnected',
      });
    }
    if (enableDiscord) {
      socialLinks.push({
        platform: 'Discord',
        channel: discordChannelName.startsWith('#') ? discordChannelName : `#${discordChannelName}`,
        enabled: true,
        status: 'Disconnected',
      });
    }
    if (enableTelegram) {
      socialLinks.push({
        platform: 'Telegram',
        channel: telegramChannelName.startsWith('@') ? telegramChannelName : `@${telegramChannelName}`,
        enabled: true,
        status: 'Disconnected',
      });
    }

    const newRoom: RoomItem = {
      id: `room-${Date.now()}`,
      name: newRoomName.trim(),
      topic: newRoomTopic.trim() || 'Requirement decomposition, cross-platform ingestion, and production code mapping',
      description: newRoomDescription.trim() || 'Autonomous project room managed by specialized PM agent.',
      social_links: socialLinks,
      agent_config: { ...agent },
      tasks: [
        {
          id: `task-${Date.now()}-1`,
          title: `Initialize architecture baseline for ${newRoomName.trim()}`,
          status: 'In Progress',
          priority: 'High',
          evidence_label: 'Verified',
          assigned_to: agent.agent_name,
          source_anchor: 'System Initializer',
          story: 'As a Project Manager, I want verified codebase structure and zero ambiguous requirements.',
        },
      ],
      chat_messages: [
        {
          id: `msg-${Date.now()}-0`,
          sender: `${agent.agent_name} (AI)`,
          platform: 'AI Agent',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `Room created successfully. Linked channels: ${socialLinks.map(s => `${s.platform} (${s.channel})`).join(', ') || 'None'}. I am standing by to manage tasks and visualize the production tree. Type /tree to inspect the repository hierarchy.`,
        },
      ],
    };

    setRooms(prev => [newRoom, ...prev]);
    setSelectedRoomId(newRoom.id);
    setActiveTab('chat');
    setIsCreateModalOpen(false);

    // Sync to backend API if reachable
    fetch(`${API}/api/rooms`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRoom),
    }).catch(() => {});

    // Reset form
    setNewRoomName('');
    setNewRoomTopic('');
    setNewRoomDescription('');
  };

  // Delete Room
  const handleDeleteRoom = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this room and detach linked social channels?')) {
      fetch(`${API}/api/rooms/${roomId}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
      const nextRooms = rooms.filter(r => r.id !== roomId);
      setRooms(nextRooms);
      if (selectedRoomId === roomId) {
        setSelectedRoomId(nextRooms.length > 0 ? nextRooms[0].id : null);
      }
    }
  };

  // Handle Send Chat Message & /tree command
  const handleSendMessage = (customText?: string) => {
    const textToSend = customText ?? chatInput;
    if (!textToSend.trim() || !currentRoom) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isTreeCommand = textToSend.trim().toLowerCase() === '/tree';
    const isTasksCommand = textToSend.trim().toLowerCase() === '/tasks';

    const userMsg: RoomChatMessage = {
      id: `msg-${Date.now()}`,
      sender: chatPlatformSender === 'PM Lead' ? 'PM Lead (You)' : `@dev_${chatPlatformSender.toLowerCase()}`,
      platform: chatPlatformSender === 'PM Lead' ? 'Console' : chatPlatformSender,
      time: timeStr,
      text: textToSend.trim(),
    };

    // Append user message
    const updatedMessages = [...currentRoom.chat_messages, userMsg];

    setRooms(prev =>
      prev.map(r => (r.id === currentRoom.id ? { ...r, chat_messages: updatedMessages } : r))
    );
    setChatInput('');
    setIsAiThinking(true);

    // Try backend API first with graceful fallback
    fetch(`${API}/api/rooms/${currentRoom.id}/chat`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: textToSend.trim(),
        sender: userMsg.sender,
        platform: userMsg.platform,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.ai_message) {
          const aiMsg: RoomChatMessage = {
            id: data.ai_message.id || `ai-msg-${Date.now()}`,
            sender: data.ai_message.sender || `${currentRoom.agent_config.agent_name} (AI)`,
            platform: 'AI Agent',
            time: data.ai_message.time || timeStr,
            text: data.ai_message.text,
            has_tree: data.ai_message.has_tree ?? isTreeCommand,
            has_tasks: data.ai_message.has_tasks ?? isTasksCommand,
          };
          setRooms(prev =>
            prev.map(r =>
              r.id === currentRoom.id ? { ...r, chat_messages: [...r.chat_messages, aiMsg] } : r
            )
          );
          setIsAiThinking(false);
          return;
        }
        triggerLocalFallback();
      })
      .catch(() => {
        triggerLocalFallback();
      });

    const triggerLocalFallback = () => {
      let aiResponseText = '';
      let hasTree = false;
      let hasTasks = false;

      aiResponseText = 'Backend is not connected. Your message was kept in this browser only; no AI analysis, repository lookup, or channel delivery was performed.';
      hasTree = false;
      hasTasks = false;

      const aiMsg: RoomChatMessage = {
        id: `ai-msg-${Date.now()}`,
        sender: `${currentRoom.agent_config.agent_name} (AI)`,
        platform: 'AI Agent',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: aiResponseText,
        has_tree: hasTree,
        has_tasks: hasTasks,
      };

      setRooms(prev =>
        prev.map(r =>
          r.id === currentRoom.id
            ? { ...r, chat_messages: [...r.chat_messages, aiMsg] }
            : r
        )
      );
      setIsAiThinking(false);
    };
  };

  // Add Task to Room
  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !currentRoom) return;

    const task: RoomTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      status: 'Backlog',
      priority: newTaskPriority,
      evidence_label: newTaskEvidence,
      assigned_to: currentRoom.agent_config.agent_name,
      source_anchor: `PM Manual Ingestion (${currentRoom.name})`,
      story: newTaskStory.trim() || 'As a Project Manager, I want verified task delivery to prevent production regressions.',
    };

    setRooms(prev =>
      prev.map(r =>
        r.id === currentRoom.id ? { ...r, tasks: [task, ...r.tasks] } : r
      )
    );

    setIsTaskModalOpen(false);
    setNewTaskTitle('');
    setNewTaskStory('');
  };

  // Move Task status
  const handleMoveTaskStatus = (taskId: string, newStatus: RoomTask['status']) => {
    if (!currentRoom) return;
    setRooms(prev =>
      prev.map(r => {
        if (r.id !== currentRoom.id) return r;
        return {
          ...r,
          tasks: r.tasks.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)),
        };
      })
    );
  };

  // Update Agent Config
  const handleUpdateAgentConfig = (updates: Partial<RoomAgentConfig>) => {
    if (!currentRoom) return;
    setRooms(prev =>
      prev.map(r => {
        if (r.id !== currentRoom.id) return r;
        return {
          ...r,
          agent_config: { ...r.agent_config, ...updates },
        };
      })
    );
  };

  // Toggle Social Channel
  const handleToggleChannel = (index: number) => {
    if (!currentRoom) return;
    setRooms(prev =>
      prev.map(r => {
        if (r.id !== currentRoom.id) return r;
        const updatedLinks = [...r.social_links];
        updatedLinks[index] = {
          ...updatedLinks[index],
          enabled: !updatedLinks[index].enabled,
        status: 'Disconnected',
        };
        return { ...r, social_links: updatedLinks };
      })
    );
  };

  // Filtered rooms list
  const filteredRooms = rooms.filter(r => {
    const matchesQuery =
      r.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      r.topic.toLowerCase().includes(filterQuery.toLowerCase()) ||
      r.agent_config.agent_name.toLowerCase().includes(filterQuery.toLowerCase());

    if (!matchesQuery) return false;
    if (filterPlatform === 'All') return true;
    return r.social_links.some(s => s.platform === filterPlatform && s.enabled);
  });

  return (
    <div className="flex-1 h-screen overflow-hidden bg-slate-50 flex flex-col font-sans">
      {/* Top Main Header */}
      <header className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">hub</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight m-0">
                PM Autonomous Room Studio
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-teal-100 text-teal-800 border border-teal-200">
                Multi-Channel Mesh
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Link Slack, Discord & Telegram to specialized PM AI agents with live production codebase tree visualization.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedRoomId && (
            <button
              onClick={() => setSelectedRoomId(null)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              <span>All Rooms</span>
            </button>
          )}

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Create Room</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-hidden flex">
        {/* ROOM STUDIO VIEW (Single Room Focused) */}
        {selectedRoomId && currentRoom ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Room Studio Navigation Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      #{currentRoom.name}
                    </span>
                    <span className="text-xs font-semibold text-slate-900 truncate max-w-sm">
                      {currentRoom.topic}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                      <span className="material-symbols-outlined text-[13px] text-teal-600">smart_toy</span>
                      {currentRoom.agent_config.agent_name}
                    </span>
                    <span className="text-slate-300">·</span>
                    <div className="flex items-center gap-1">
                      {currentRoom.social_links.map(l => (
                        <span
                          key={l.platform}
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                            l.enabled
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                              : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                          }`}
                          title={`${l.platform}: ${l.channel}`}
                        >
                          {l.platform}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-tabs inside Studio */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'chat'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">chat</span>
                  <span>Social Chat Bridge</span>
                </button>

                <button
                  onClick={() => setActiveTab('tree')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'tree'
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px] text-teal-600">account_tree</span>
                  <span>Production Tree</span>
                </button>

                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'tasks'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">view_kanban</span>
                  <span>Task Board ({currentRoom.tasks.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('channels')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'channels'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">sensors</span>
                  <span>Social Channels</span>
                </button>

                <button
                  onClick={() => setActiveTab('agent')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'agent'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">tune</span>
                  <span>Agent Config</span>
                </button>

                <button
                  onClick={() => setActiveTab('repos')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'repos'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">source</span>
                  <span>Curated OSS</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* TAB 1: SOCIAL CHAT BRIDGE */}
              {activeTab === 'chat' && (
                <div className="max-w-5xl mx-auto h-full flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  {/* Chat Sub-header with Slash Commands */}
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Unified Multi-Channel Stream
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        (Slack + Discord + Telegram + ScribeBA Agent)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick Commands:</span>
                      <button
                        onClick={() => handleSendMessage('/tree')}
                        className="px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-mono font-semibold transition-colors flex items-center gap-1"
                        title="Render live production directory hierarchy in chat"
                      >
                        <span>🌲 /tree</span>
                      </button>
                      <button
                        onClick={() => handleSendMessage('/tasks')}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-mono font-semibold transition-colors flex items-center gap-1"
                      >
                        <span>📋 /tasks</span>
                      </button>
                      <button
                        onClick={() => handleSendMessage('Check for any unverified claims or blocked requirements')}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-mono font-semibold transition-colors"
                      >
                        <span>🛡️ /audit</span>
                      </button>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                    {currentRoom.chat_messages.map(msg => {
                      const isAi = msg.platform === 'AI Agent';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isAi ? 'items-start' : 'items-start'} max-w-3xl`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                msg.platform === 'Slack'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : msg.platform === 'Discord'
                                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                  : msg.platform === 'Telegram'
                                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                                  : msg.platform === 'AI Agent'
                                  ? 'bg-teal-50 text-teal-900 border-teal-300 font-bold'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {msg.platform}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{msg.sender}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{msg.time}</span>
                          </div>

                          <div
                            className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                              isAi
                                ? 'bg-teal-50/60 border-teal-200 text-slate-900 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-800 shadow-xs'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.text}</p>

                            {/* EMBEDDED PRODUCTION TREE IN CHAT */}
                            {msg.has_tree && (
                              <div className="mt-3 pt-3 border-t border-teal-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-teal-900 flex items-center gap-1 font-mono">
                                    <span className="material-symbols-outlined text-[16px] text-teal-700">account_tree</span>
                                    Production Codebase Hierarchy (Live Tree)
                                  </span>
                                  <button
                                    onClick={() => setActiveTab('tree')}
                                    className="text-[11px] font-semibold text-teal-800 hover:underline flex items-center gap-0.5"
                                  >
                                    <span>Expand Fullscreen</span>
                                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                                  </button>
                                </div>
                                <ProductionTreeVisualizer
                                  tree={DEFAULT_PRODUCTION_TREE}
                                  className="max-h-72 border border-teal-200"
                                />
                              </div>
                            )}

                            {/* EMBEDDED TASKS IN CHAT */}
                            {msg.has_tasks && (
                              <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                                <span className="text-xs font-bold text-slate-900 block font-mono">
                                  Active Room Stories ({currentRoom.tasks.length}):
                                </span>
                                {currentRoom.tasks.map(t => (
                                  <div
                                    key={t.id}
                                    className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                          t.status === 'Done'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : t.status === 'Blocked'
                                            ? 'bg-rose-100 text-rose-800'
                                            : 'bg-amber-100 text-amber-800'
                                        }`}
                                      >
                                        {t.status}
                                      </span>
                                      <span className="font-medium text-slate-800">{t.title}</span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      {t.assigned_to}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {isAiThinking && (
                      <div className="flex items-center gap-2 text-xs text-teal-800 font-mono bg-teal-50 p-2.5 rounded-lg border border-teal-200 w-fit">
                        <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                        <span>{currentRoom.agent_config.agent_name} is synthesizing requirements...</span>
                      </div>
                    )}
                  </div>

                  {/* Input & Sender Toolbar */}
                  <div className="p-3 bg-white border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-slate-500">Send message as:</span>
                      {(['Slack', 'Discord', 'Telegram', 'PM Lead'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setChatPlatformSender(p)}
                          className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                            chatPlatformSender === p
                              ? 'bg-slate-800 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Type a team message or '/tree' to render codebase visualizer..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                        className="flex-1 px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus-ring bg-slate-50"
                      />
                      <button
                        onClick={() => handleSendMessage()}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">send</span>
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PRODUCTION TREE FULLSCREEN */}
              {activeTab === 'tree' && (
                <div className="max-w-5xl mx-auto space-y-4">
                  <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-teal-600">account_tree</span>
                        <span>Production Codebase Architecture & File Tree</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Live directory hierarchy for squad #{currentRoom.name}. Verified against real backend and frontend source files.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded border border-slate-200 text-slate-700">
                        Root: /D:/Hackathon/AITinker
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Visualizer Panel */}
                    <div className="lg:col-span-2">
                      <ProductionTreeVisualizer
                        tree={DEFAULT_PRODUCTION_TREE}
                        onSelectFile={node => setSelectedFile(node)}
                        selectedPath={selectedFile?.path}
                      />
                    </div>

                    {/* File Inspector Panel */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 mb-3">
                          <span className="material-symbols-outlined text-[18px] text-teal-600">visibility</span>
                          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            File Inspector
                          </span>
                        </div>

                        {selectedFile ? (
                          <div className="space-y-3 font-mono text-xs">
                            <div>
                              <div className="text-[11px] text-slate-500 font-sans">Filename:</div>
                              <div className="font-bold text-slate-900">{selectedFile.name}</div>
                            </div>

                            <div>
                              <div className="text-[11px] text-slate-500 font-sans">Relative Path:</div>
                              <div className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 break-all">
                                {selectedFile.path}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                                <div className="text-[10px] text-slate-500 font-sans">Lines of Code</div>
                                <div className="text-sm font-bold text-slate-900">{selectedFile.lines ?? 120}</div>
                              </div>
                              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                                <div className="text-[10px] text-slate-500 font-sans">File Size</div>
                                <div className="text-sm font-bold text-slate-900">{selectedFile.size_kb ?? 4.2} KB</div>
                              </div>
                            </div>

                            <div className="pt-2">
                              <span className="text-[11px] text-slate-500 font-sans block mb-1">Architecture Role:</span>
                              <p className="text-slate-700 text-xs font-sans leading-relaxed bg-teal-50/50 p-2.5 rounded border border-teal-200">
                                Monitored by {currentRoom.agent_config.agent_name}. Any PR touching this file triggers requirement claim verification.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-12 text-slate-400">
                            <span className="material-symbols-outlined text-[32px] text-slate-300 block mb-2">touch_app</span>
                            <p className="text-xs">Click any file in the tree to inspect details, line count, and architecture role.</p>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-200 mt-4">
                        <button
                          onClick={() => {
                            if (selectedFile) {
                              handleSendMessage(`I examined file ${selectedFile.path} (${selectedFile.lines || 100} lines). Let's review the requirements.`);
                              setActiveTab('chat');
                            }
                          }}
                          disabled={!selectedFile}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">chat</span>
                          <span>Discuss in Room Chat</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: KANBAN TASK BOARD */}
              {activeTab === 'tasks' && (
                <div className="max-w-5xl mx-auto space-y-4">
                  <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-teal-600">view_kanban</span>
                        <span>Zero-Blocker Task Board ({currentRoom.tasks.length} Stories)</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Enforces INVEST criteria and 3-axis verification. Managed by {currentRoom.agent_config.agent_name}.
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Drag cards between columns, or use each card’s status menu with a keyboard.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsTaskModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Add Task</span>
                    </button>
                  </div>

                  {/* 4-Column Board */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {(['Backlog', 'In Progress', 'Blocked', 'Done'] as const).map(colStatus => {
                      const colTasks = currentRoom.tasks.filter(t => t.status === colStatus);
                      return (
                        <div
                          key={colStatus}
                          onDragOver={event => {
                            if (!draggedTaskId) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                            setDropTargetStatus(colStatus);
                          }}
                          onDragLeave={event => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                              setDropTargetStatus(current => current === colStatus ? null : current);
                            }
                          }}
                          onDrop={event => {
                            event.preventDefault();
                            const taskId = event.dataTransfer.getData('text/plain');
                            if (taskId) handleMoveTaskStatus(taskId, colStatus);
                            setDraggedTaskId(null);
                            setDropTargetStatus(null);
                          }}
                          aria-label={`${colStatus} tasks drop area`}
                          className={`bg-slate-100/70 p-3 rounded-xl border flex flex-col min-h-[420px] transition-colors ${
                            dropTargetStatus === colStatus
                              ? 'border-teal-500 bg-teal-50/70'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  colStatus === 'Done'
                                    ? 'bg-emerald-600'
                                    : colStatus === 'Blocked'
                                    ? 'bg-rose-600'
                                    : colStatus === 'In Progress'
                                    ? 'bg-amber-600'
                                    : 'bg-slate-400'
                                }`}
                              />
                              {colStatus}
                            </span>
                            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                              {colTasks.length}
                            </span>
                          </div>

                          <div className="flex-1 space-y-2.5 overflow-y-auto">
                            {colTasks.map(task => (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={event => {
                                  event.dataTransfer.setData('text/plain', task.id);
                                  event.dataTransfer.effectAllowed = 'move';
                                  setDraggedTaskId(task.id);
                                }}
                                onDragEnd={() => {
                                  setDraggedTaskId(null);
                                  setDropTargetStatus(null);
                                }}
                                title="Drag to move this task to another column"
                                className={`bg-white p-3 rounded-lg border shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between ${
                                  draggedTaskId === task.id
                                    ? 'border-teal-500 opacity-50'
                                    : 'border-slate-200'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span
                                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                        task.priority === 'Critical'
                                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                                          : task.priority === 'High'
                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                          : 'bg-slate-100 text-slate-700 border-slate-200'
                                      }`}
                                    >
                                      {task.priority}
                                    </span>

                                    <span
                                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                                        task.evidence_label === 'Verified'
                                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                                          : task.evidence_label === 'Blocked'
                                          ? 'bg-rose-50 text-rose-800 font-semibold'
                                          : 'bg-amber-50 text-amber-800 font-medium'
                                      }`}
                                    >
                                      {task.evidence_label}
                                    </span>
                                  </div>

                                  <h4 className="text-xs font-bold text-slate-900 leading-snug mb-2">
                                    {task.title}
                                  </h4>

                                  {task.story && (
                                    <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                                      {task.story}
                                    </p>
                                  )}

                                  <div className="text-[10px] font-mono text-slate-500 mb-2 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">link</span>
                                    <span className="truncate">{task.source_anchor}</span>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                  <span className="text-[11px] text-slate-600 font-medium">
                                    {task.assigned_to}
                                  </span>

                                  {/* Quick status stepper */}
                                  <select
                                    value={task.status}
                                    onChange={e => handleMoveTaskStatus(task.id, e.target.value as any)}
                                    aria-label={`Move ${task.title} to a different status`}
                                    className="text-[10px] font-semibold border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50 text-slate-700 cursor-pointer"
                                  >
                                    <option value="Backlog">Backlog</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Blocked">Blocked</option>
                                    <option value="Done">Done</option>
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: SOCIAL CHANNELS */}
              {activeTab === 'channels' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-teal-600">sensors</span>
                      <span>Connected Social Ingestion Bridges</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure webhooks and bot tokens for Slack, Discord, and Telegram to stream discussions directly to {currentRoom.agent_config.agent_name}.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {currentRoom.social_links.map((link, idx) => (
                      <div
                        key={link.platform}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                              link.platform === 'Slack'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : link.platform === 'Discord'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'bg-sky-50 text-sky-800 border border-sky-200'
                            }`}
                          >
                            {link.platform.substring(0, 2).toUpperCase()}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{link.platform} Bridge</span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.2 rounded border font-semibold ${
                                  link.status === 'Connected' || link.status === 'Listening'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {link.status === 'Connected' || link.status === 'Listening' ? link.status : 'Not connected'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 font-mono mt-0.5">
                              Channel / Handle: <strong className="text-slate-900">{link.channel}</strong>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Credentials are not configured for this channel.</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800" title="Configure the integration on the backend before testing it">Not connected</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: AGENT CONFIG */}
              {activeTab === 'agent' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-teal-600">tune</span>
                      <span>Specialized PM Agent Configuration</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tailor the AI agent that autonomously triages chats, validates claims, decomposes tasks, and maps the codebase.
                    </p>
                  </div>

                  {/* Preset Selector */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <label className="text-xs font-bold text-slate-900 block mb-2">
                      Switch to Specialized Agent Preset:
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {SPECIALIZED_PM_AGENTS.map(agent => (
                        <div
                          key={agent.agent_id}
                          onClick={() => handleUpdateAgentConfig(agent)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            currentRoom.agent_config.agent_id === agent.agent_id
                              ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500/30'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-900 mb-1">{agent.agent_name}</div>
                          <p className="text-[11px] text-slate-600 leading-tight line-clamp-2">{agent.role}</p>
                          <div className="mt-2 text-[10px] font-mono text-teal-800 font-semibold">
                            {agent.model_tier} · {agent.autonomy_mode}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Directives & Controls Form */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-800 block mb-1">
                          Agent Name & Title
                        </label>
                        <input
                          type="text"
                          value={currentRoom.agent_config.agent_name}
                          onChange={e => handleUpdateAgentConfig({ agent_name: e.target.value })}
                          className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus-ring"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-800 block mb-1">
                          Model Tier
                        </label>
                        <select
                          value={currentRoom.agent_config.model_tier}
                          onChange={e => handleUpdateAgentConfig({ model_tier: e.target.value })}
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus-ring"
                        >
                          <option value="Nebius Qwen-30B (Fast)">Nebius Qwen-30B (Fast Ingestion)</option>
                          <option value="Claude 3.5 Sonnet (High)">Claude 3.5 Sonnet (Complex Logic)</option>
                          <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (Low Latency)</option>
                          <option value="DeepSeek R1 (Reasoning)">DeepSeek R1 (Deep Tree Reasoning)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-800 block mb-1">
                          Autonomy Mode
                        </label>
                        <select
                          value={currentRoom.agent_config.autonomy_mode}
                          onChange={e => handleUpdateAgentConfig({ autonomy_mode: e.target.value as any })}
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus-ring"
                        >
                          <option value="Supervised">Supervised (Requires PM Confirmation)</option>
                          <option value="Semi-Autonomous">Semi-Autonomous (Auto Drafts Stories)</option>
                          <option value="Autonomous">Autonomous (Direct Backlog & Code Mapping)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-800 block mb-1">
                          Verification Rigor
                        </label>
                        <select
                          value={currentRoom.agent_config.verification_rigor}
                          onChange={e => handleUpdateAgentConfig({ verification_rigor: e.target.value as any })}
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus-ring"
                        >
                          <option value="Strict 3-Axis">Strict 3-Axis (Zero-Blocker Ingestion)</option>
                          <option value="Balanced">Balanced Agile (Standard QA Gates)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-1">
                        System Instructions & Behavioral Directives
                      </label>
                      <textarea
                        rows={4}
                        value={currentRoom.agent_config.instructions}
                        onChange={e => handleUpdateAgentConfig({ instructions: e.target.value })}
                        className="w-full text-xs font-mono p-3 border border-slate-200 rounded-lg text-slate-900 focus-ring leading-relaxed"
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-amber-700">Room agent settings are local only; backend persistence is unavailable.</span>
                        <button disabled title="No backend route is available to save room agent settings" className="px-4 py-2 bg-slate-200 text-slate-500 rounded-lg text-xs font-semibold cursor-not-allowed">
                          Save unavailable
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: CURATED OSS REPOSITORIES */}
              {activeTab === 'repos' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-teal-600">source</span>
                      <span>Curated Open-Source Repositories for Social Mesh & Tree Visualization</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Key open-source frameworks and libraries integrated to build multi-channel agents, Slack/Discord/Telegram adapters, and interactive codebase visualizers.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {CURATED_OSS_REPOS.map(repo => (
                      <div
                        key={repo.repo}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs font-bold text-teal-700">
                              {repo.repo}
                            </span>
                            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                              ⭐ {repo.stars}
                            </span>
                          </div>

                          <h3 className="text-xs font-bold text-slate-900 mb-1">
                            {repo.title}
                          </h3>

                          <p className="text-xs text-slate-600 leading-relaxed mb-3">
                            {repo.description}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                            {repo.role}
                          </span>

                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-slate-700 hover:text-teal-700 flex items-center gap-1"
                          >
                            <span>GitHub</span>
                            <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ALL ROOMS OVERVIEW (When no room is selected or browsing all) */
          <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full space-y-6">
            {/* Metric KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active Rooms
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {rooms.length}
                </div>
                <div className="text-[11px] text-teal-700 font-medium mt-0.5">
                  PM Autonomous Squads
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Social Channels Linked
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {rooms.reduce((acc, r) => acc + r.social_links.filter(s => s.enabled).length, 0)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Slack · Discord · Telegram
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Zero-Blocker Stories
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {rooms.reduce((acc, r) => acc + r.tasks.length, 0)}
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  3-Axis Verified
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Specialized Agents
                </div>
                <div className="text-2xl font-bold font-mono text-teal-800 mt-1">
                  {SPECIALIZED_PM_AGENTS.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Pre-Trained Roles Available
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <span className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
                <input
                  type="text"
                  placeholder="Filter rooms by squad, topic, or agent..."
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus-ring text-slate-900"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {(['All', 'Slack', 'Discord', 'Telegram'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setFilterPlatform(p)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                      filterPlatform === p
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Room Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map(room => {
                const totalTasks = room.tasks.length;
                const doneTasks = room.tasks.filter(t => t.status === 'Done').length;
                const blockedTasks = room.tasks.filter(t => t.status === 'Blocked').length;

                return (
                  <div
                    key={room.id}
                    onClick={() => {
                      setSelectedRoomId(room.id);
                      setActiveTab('chat');
                    }}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-teal-400 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          #{room.name}
                        </span>

                        <button
                          onClick={e => handleDeleteRoom(room.id, e)}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                          title="Delete room"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 mb-1 leading-snug">
                        {room.topic}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                        {room.description}
                      </p>

                      {/* Agent Tag */}
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between mb-3 text-xs">
                        <span className="text-[11px] text-slate-600 font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-teal-600">smart_toy</span>
                          {room.agent_config.agent_name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-semibold">
                          {room.agent_config.model_tier.split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    <div>
                      {/* Social Platform Chips */}
                      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                        {room.social_links.map(s => (
                          <span
                            key={s.platform}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                              s.enabled
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                                : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                            }`}
                          >
                            {s.platform}
                          </span>
                        ))}
                      </div>

                      {/* Task Stats Bar */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700 font-semibold">
                            {doneTasks}/{totalTasks} Done
                          </span>
                          {blockedTasks > 0 && (
                            <span className="text-rose-600 font-bold">
                              · {blockedTasks} Blocked
                            </span>
                          )}
                        </div>

                        <span className="text-teal-700 font-semibold flex items-center gap-0.5 hover:underline font-sans text-xs">
                          <span>Open Studio</span>
                          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: CREATE ROOM */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600 text-[20px]">add_circle</span>
                <h3 className="text-base font-bold text-slate-900">Create Autonomous Project Room</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Room Name */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Squad / Room Name *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-xs font-bold">#</span>
                  <input
                    type="text"
                    placeholder="proj-auth-v2"
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus-ring"
                    autoFocus
                  />
                </div>
              </div>

              {/* Topic */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Core Objective / Topic *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Google Workspace SSO, RBAC roles, and token session security"
                  value={newRoomTopic}
                  onChange={e => setNewRoomTopic(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus-ring"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Squad Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Cross-functional engineering pod syncing on architecture and sprint deliverables."
                  value={newRoomDescription}
                  onChange={e => setNewRoomDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus-ring"
                />
              </div>

              {/* Social Channels Mesh */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-2">
                  Link Social Ingestion Channels
                </label>
                <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {/* Slack */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableSlack}
                        onChange={e => setEnableSlack(e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-xs font-bold text-slate-800">Slack Channel</span>
                    </label>
                    <input
                      type="text"
                      disabled={!enableSlack}
                      value={slackChannelName}
                      onChange={e => setSlackChannelName(e.target.value)}
                      placeholder="#proj-sprint-chat"
                      className="text-xs font-mono px-2.5 py-1 border border-slate-200 rounded w-48 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  {/* Discord */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableDiscord}
                        onChange={e => setEnableDiscord(e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-xs font-bold text-slate-800">Discord Channel</span>
                    </label>
                    <input
                      type="text"
                      disabled={!enableDiscord}
                      value={discordChannelName}
                      onChange={e => setDiscordChannelName(e.target.value)}
                      placeholder="#dev-operations"
                      className="text-xs font-mono px-2.5 py-1 border border-slate-200 rounded w-48 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  {/* Telegram */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableTelegram}
                        onChange={e => setEnableTelegram(e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-xs font-bold text-slate-800">Telegram Bot</span>
                    </label>
                    <input
                      type="text"
                      disabled={!enableTelegram}
                      value={telegramChannelName}
                      onChange={e => setTelegramChannelName(e.target.value)}
                      placeholder="@squad_ops_bot"
                      className="text-xs font-mono px-2.5 py-1 border border-slate-200 rounded w-48 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Specialized PM Agent Preset */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Assign Specialized PM AI Agent
                </label>
                <select
                  value={selectedAgentId}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus-ring"
                >
                  {SPECIALIZED_PM_AGENTS.map(agent => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.agent_name} ({agent.model_tier} · {agent.autonomy_mode})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {SPECIALIZED_PM_AGENTS.find(a => a.agent_id === selectedAgentId)?.role}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRoom}
                disabled={!newRoomName.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 rounded-lg transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                <span>Create Room & Launch Agent</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD TASK */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900">Add Task to {currentRoom?.name}</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Task Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Restrict SSO auth callback to @acmecorp.com"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus-ring"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={e => setNewTaskPriority(e.target.value as any)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Evidence Status</label>
                  <select
                    value={newTaskEvidence}
                    onChange={e => setNewTaskEvidence(e.target.value as any)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Verified">Verified</option>
                    <option value="Inferred">Inferred</option>
                    <option value="Assumed">Assumed</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">INVEST User Story</label>
                <textarea
                  rows={3}
                  placeholder="As a [Role], I want [Feature] so that [Benefit]."
                  value={newTaskStory}
                  onChange={e => setNewTaskStory(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus-ring"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 rounded-lg"
              >
                Add Story
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
