import React, { useState, useEffect, useRef } from 'react';
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
  DEFAULT_SQUAD_AGENTS,
  CURATED_OSS_REPOS,
  DEFAULT_PRODUCTION_TREE,
  INITIAL_ROOMS,
} from '../data/mockRooms';
import { ProductionTreeVisualizer } from './ProductionTreeVisualizer';
import { API } from '../api';

type RoomTab = 'chat' | 'tree' | 'tasks' | 'channels' | 'agent' | 'repos';

// Older browser snapshots contained demo webhook URLs and Telegram chat IDs.
// Strip sensitive credentials while preserving legitimate server connection state.
const sanitizeRoomConnections = (source: RoomItem[]): RoomItem[] =>
  source.map(room => ({
    ...room,
    social_links: (room.social_links || []).map(({ webhook_url: _webhook, chat_id: _chatId, ...link }) => ({
      ...link,
      enabled: link.enabled ?? false,
      status: link.status ?? (link.enabled ? 'Connected' : 'Disconnected'),
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
    return params.get('room') || localStorage.getItem('scribeba_selected_room') || 'room-auth-iam';
  });
  const [activeTab, setActiveTab] = useState<RoomTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab') as RoomTab;
    if (['chat', 'tree', 'tasks', 'channels', 'agent', 'repos'].includes(t)) return t;
    const saved = localStorage.getItem('scribeba_room_active_tab') as RoomTab;
    if (['chat', 'tree', 'tasks', 'channels', 'agent', 'repos'].includes(saved)) return saved;
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
  const [chatInput, setChatInput] = useState(() => localStorage.getItem('scribeba_room_draft_input') || '');
  const [chatPlatformSender, setChatPlatformSender] = useState<'Slack' | 'Discord' | 'Telegram' | 'PM Lead'>('Slack');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Multi-Agent Swarm Debate state
  const [isDebateModalOpen, setIsDebateModalOpen] = useState(false);
  const [isDebating, setIsDebating] = useState(false);
  const [debateTopic, setDebateTopic] = useState('');

  // Task Review & Dispatch state
  const [isDispatchingTask, setIsDispatchingTask] = useState<string | null>(null);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState<string | null>(null);

  // Add Agent from Repo / Custom modal state
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentAvatar, setNewAgentAvatar] = useState('🤖');
  const [newAgentRole, setNewAgentRole] = useState('');
  const [newAgentRepo, setNewAgentRepo] = useState('');
  const [newAgentInstructions, setNewAgentInstructions] = useState('');
  const [newAgentModel, setNewAgentModel] = useState('Nebius Qwen-30B (Fast)');
  const [newAgentAutonomy, setNewAgentAutonomy] = useState<'Supervised' | 'Semi-Autonomous' | 'Autonomous'>('Semi-Autonomous');
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [selectedAgentToEditId, setSelectedAgentToEditId] = useState<string>('lead-agile-pm');

  // Persist selected room, active tab, and draft input to localStorage
  useEffect(() => {
    if (selectedRoomId) localStorage.setItem('scribeba_selected_room', selectedRoomId);
  }, [selectedRoomId]);

  useEffect(() => {
    localStorage.setItem('scribeba_room_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('scribeba_room_draft_input', chatInput);
  }, [chatInput]);

  // New Task Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('High');
  const [newTaskEvidence, setNewTaskEvidence] = useState<'Verified' | 'Inferred' | 'Assumed' | 'Blocked'>('Verified');
  const [newTaskStory, setNewTaskStory] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Realtime polling for room conversation updates
  useEffect(() => {
    if (!selectedRoomId && !rooms[0]?.id) return;
    const targetRoomId = selectedRoomId || rooms[0]?.id;
    if (activeTab !== 'chat') return;

    const interval = setInterval(() => {
      fetch(`${API}/api/rooms/${targetRoomId}`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.chat_messages)) {
            setRooms(prev =>
              prev.map(r => (r.id === targetRoomId ? {
                ...r,
                chat_messages: data.chat_messages,
                tasks: data.tasks || r.tasks,
                squad_agents: data.squad_agents || r.squad_agents,
              } : r))
            );
          }
        })
        .catch(() => {});
    }, 2500);

    return () => clearInterval(interval);
  }, [selectedRoomId, activeTab, rooms]);

  // Current selected room
  const currentRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0] || null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentRoom?.chat_messages?.length, isAiThinking]);

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
    localStorage.removeItem('scribeba_room_draft_input');
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

  // Handle Multi-Agent Swarm Debate
  const handleRunSwarmDebate = async (customTopic?: string) => {
    if (!currentRoom) return;
    setIsDebating(true);
    const topicToUse = customTopic || debateTopic.trim() || currentRoom.topic || currentRoom.description;
    try {
      const res = await fetch(`${API}/api/rooms/${currentRoom.id}/swarm-debate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ topic: topicToUse }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          setRooms(prev => prev.map(r => (r.id === data.room.id ? { ...data.room } : r)));
        }
      }
    } catch (err) {
      console.error('Swarm debate error:', err);
    } finally {
      setIsDebating(false);
      setIsDebateModalOpen(false);
    }
  };

  // Handle Review & Dispatch Task
  const handleDispatchTask = async (taskId: string, action: 'approve' | 'reject' | 'dispatch_clickup', notes?: string) => {
    if (!currentRoom) return;
    setIsDispatchingTask(taskId);
    try {
      const res = await fetch(`${API}/api/rooms/${currentRoom.id}/dispatch-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ task_id: taskId, action, notes }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          setRooms(prev => prev.map(r => (r.id === data.room.id ? { ...data.room } : r)));
        }
        if (action === 'dispatch_clickup' && data.task?.clickup_url) {
          setDispatchSuccessMsg(`🚀 Đã đồng bộ nhiệm vụ lên ClickUp: "${data.task.title}"`);
          setTimeout(() => setDispatchSuccessMsg(null), 6000);
        } else if (action === 'approve') {
          setDispatchSuccessMsg(`✅ Đã phê duyệt và giao việc: "${data.task.title}"`);
          setTimeout(() => setDispatchSuccessMsg(null), 5000);
        }
      }
    } catch (err) {
      console.error('Dispatch task error:', err);
    } finally {
      setIsDispatchingTask(null);
    }
  };

  // Save Agent in Squad (Customized or from Repo)
  const handleSaveSquadAgent = async (agent: RoomAgentConfig) => {
    if (!currentRoom) return;
    setIsSavingAgent(true);
    try {
      const res = await fetch(`${API}/api/rooms/${currentRoom.id}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(agent),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          setRooms(prev => prev.map(r => (r.id === data.room.id ? { ...data.room } : r)));
        }
        setDispatchSuccessMsg(`✨ Đã lưu cấu hình Agent: ${agent.agent_name}`);
        setTimeout(() => setDispatchSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error('Save squad agent error:', err);
    } finally {
      setIsSavingAgent(false);
      setIsAddAgentModalOpen(false);
    }
  };

  // Delete Agent from Squad
  const handleDeleteSquadAgent = async (agentId: string) => {
    if (!currentRoom) return;
    try {
      const res = await fetch(`${API}/api/rooms/${currentRoom.id}/agents/${agentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setRooms(prev =>
          prev.map(r => {
            if (r.id !== currentRoom.id) return r;
            return {
              ...r,
              squad_agents: (r.squad_agents || []).filter(a => a.agent_id !== agentId),
            };
          })
        );
      }
    } catch (err) {
      console.error('Delete squad agent error:', err);
    }
  };

  // 1-Click activate OSS repo into room squad
  const handleInstallCuratedRepo = async (repo: any) => {
    if (!currentRoom) return;
    const newAgent: RoomAgentConfig = {
      agent_id: `agent-oss-${repo.repo.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      agent_name: `${repo.title} Agent`,
      avatar: '⚡',
      role: repo.role,
      repo_binding: repo.url,
      skills: [repo.role.toLowerCase().replace(/\s+/g, '_')],
      instructions: `Ground yourself in the open-source repository ${repo.repo} (${repo.url}). ${repo.description}`,
      model_tier: 'Nebius Qwen-30B (Fast)',
      autonomy_mode: 'Semi-Autonomous',
      verification_rigor: 'Strict 3-Axis',
      temperature: 0.2,
    };
    await handleSaveSquadAgent(newAgent);
    setActiveTab('chat');
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
    <div className="flex-1 h-full min-h-0 overflow-hidden bg-slate-50 flex flex-col font-sans">
      {/* Top Main Header */}
      <header className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">hub</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight m-0">
                Project Rooms
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Keep each project’s conversation, tasks, repository view, and channel setup together.
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
      <div className="flex-1 min-h-0 overflow-hidden flex">
        {/* ROOM STUDIO VIEW (Single Room Focused) */}
        {selectedRoomId && currentRoom ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-50">
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
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                          title={`${l.platform} channel reference: ${l.channel}. ${l.enabled ? 'Connected' : 'Not connected'}.`}
                        >
                          {l.platform}{l.enabled ? '' : ' · Not connected'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-tabs inside Studio */}
              <div className="flex flex-wrap items-center justify-end gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => setActiveTab('chat')}
                  title="Read and write messages in this room"
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'chat'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">chat</span>
                  <span>Chat</span>
                </button>

                <button
                  onClick={() => setActiveTab('tree')}
                  title="Browse the repository structure"
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'tree'
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px] text-teal-600">account_tree</span>
                  <span>Code</span>
                </button>

                <button
                  onClick={() => setActiveTab('tasks')}
                  title="View and update this room’s tasks"
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'tasks'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">view_kanban</span>
                  <span>Tasks ({currentRoom.tasks.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('channels')}
                  title="Manage channel references and connection status"
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'channels'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">sensors</span>
                  <span>Channels</span>
                </button>

                <button
                  onClick={() => setActiveTab('agent')}
                  title="Choose the AI role for this room"
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'agent'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">tune</span>
                  <span>Agent</span>
                </button>

                <button
                  onClick={() => setActiveTab('repos')}
                  title="View repositories available to this room"
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'repos'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">source</span>
                  <span>Repositories</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT */}
            <div className={`${activeTab === 'chat' ? 'flex-1 min-h-0 overflow-hidden' : 'flex-1 min-h-0 overflow-y-auto overscroll-contain'} p-6`}>
              {/* TAB 1: ROOM CHAT */}
              {activeTab === 'chat' && (
                <div className="max-w-5xl mx-auto h-full flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  {/* Room chat and shortcuts */}
                  <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Room conversation</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">Messages here stay in this room. Connect a channel in Channels to import or send social messages.</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-500 mr-1">Shortcuts:</span>
                        <button
                          onClick={() => handleSendMessage('/tree')}
                          className="px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-mono font-semibold transition-colors flex items-center gap-1"
                          title="Show the repository tree in the conversation"
                        >
                          <span>Code tree</span>
                        </button>
                        <button
                          onClick={() => handleSendMessage('/sync')}
                          className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-mono font-semibold transition-colors flex items-center gap-1"
                          title="Sync latest discussion from Slack channel"
                        >
                          <span className="material-symbols-outlined text-[13px]">sync</span>
                          <span>Sync Slack</span>
                        </button>
                        <button
                          onClick={() => handleSendMessage('/tasks')}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-mono font-semibold transition-colors flex items-center gap-1"
                        >
                          <span>Room tasks</span>
                        </button>
                        <button
                          onClick={() => handleSendMessage('Check for any unverified claims or blocked requirements')}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-mono font-semibold transition-colors"
                        >
                          <span>Review open questions</span>
                        </button>
                      </div>
                    </div>

                    {/* Active Agent Squad bar & Swarm Debate Trigger */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mr-1">
                          <span className="material-symbols-outlined text-[15px] text-teal-600">groups</span>
                          Hội đồng Agent ({(currentRoom.squad_agents || DEFAULT_SQUAD_AGENTS).length}):
                        </span>
                        {(currentRoom.squad_agents || DEFAULT_SQUAD_AGENTS).map(agent => (
                          <span
                            key={agent.agent_id}
                            title={`${agent.role} · Model: ${agent.model_tier}`}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white text-slate-800 border border-slate-200 shadow-2xs hover:border-teal-400 hover:bg-teal-50/50 cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedAgentToEditId(agent.agent_id);
                              setActiveTab('agent');
                            }}
                          >
                            <span>{agent.avatar || '🤖'}</span>
                            <span className="font-semibold">{agent.agent_name.replace(' & INVEST Scorer', '').replace(' & System Architect', '').replace(' & DevSecOps Auditor', '').replace(' & Execution Specialist', '')}</span>
                          </span>
                        ))}
                      </div>

                      {/* Swarm Debate Action Trigger */}
                      <button
                        disabled={isDebating}
                        onClick={() => {
                          setDebateTopic(currentRoom.topic || currentRoom.description || '');
                          setIsDebateModalOpen(true);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all ${
                          isDebating
                            ? 'bg-teal-100 text-teal-700 cursor-wait'
                            : 'bg-gradient-to-r from-teal-600 via-indigo-600 to-purple-600 hover:from-teal-700 hover:to-purple-700 text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px] animate-spin-slow">
                          {isDebating ? 'sync' : 'forum'}
                        </span>
                        <span>{isDebating ? 'Đang tranh biện...' : '🤖 Thảo luận Đa Agent'}</span>
                      </button>
                    </div>

                    {dispatchSuccessMsg && (
                      <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 animate-fadeIn">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                        <span>{dispatchSuccessMsg}</span>
                      </div>
                    )}
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 bg-slate-50/50">
                    {currentRoom.chat_messages.map(msg => {
                      const isAi = msg.platform === 'AI Agent';
                      const isHumanGate = msg.sender.includes('Human PM Gate') || msg.sender.includes('[Human Gate]');
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col items-start max-w-3xl ${isHumanGate ? 'w-full' : ''}`}
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
                                  : isHumanGate
                                  ? 'bg-purple-100 text-purple-900 border-purple-300 font-bold'
                                  : msg.platform === 'AI Agent'
                                  ? 'bg-teal-50 text-teal-900 border-teal-300 font-bold'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {isHumanGate ? 'Human Gate' : msg.platform}
                            </span>
                            <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                              {msg.avatar && <span>{msg.avatar}</span>}
                              <span>{msg.sender}</span>
                            </span>
                            {msg.agent_role && (
                              <span className="text-[10px] text-teal-700 font-medium bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                                {msg.agent_role}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500 font-mono">{msg.time}</span>
                          </div>

                          <div
                            className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                              isHumanGate
                                ? 'bg-purple-50/90 border-purple-300 text-purple-950 shadow-xs w-full font-sans'
                                : isAi
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
                                  Room tasks ({currentRoom.tasks.length}):
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
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input and message label */}
                  <div className="p-3 bg-white border-t border-slate-200">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-slate-600">Label this message:</span>
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
                    <p className="text-[11px] text-slate-500 mb-2">This label identifies the message source in the room. It does not post to Slack, Discord, or Telegram.</p>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Write a message for this room…"
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
                        <span>Room tasks ({currentRoom.tasks.length})</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Track work discussed in this room. The {currentRoom.agent_config.agent_name} role can help organize it.
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

                  {/* Human Review Gate for Pending Dispatch Tasks */}
                  {(() => {
                    const pendingTasks = currentRoom.tasks.filter(t => t.dispatch_status === 'pending_review');
                    if (pendingTasks.length === 0) return null;
                    return (
                      <div className="bg-gradient-to-r from-teal-50/90 via-sky-50/90 to-indigo-50/90 border-2 border-teal-500/50 rounded-xl p-4 shadow-sm mb-4 animate-fadeIn">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-teal-200/60">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[20px] text-teal-700 animate-pulse">fact_check</span>
                            <h3 className="text-sm font-bold text-slate-900">
                              📋 Cổng Phê Duyệt Nhiệm Vụ (Human Review Gate)
                            </h3>
                            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                              {pendingTasks.length} nhiệm vụ chờ kiểm tra
                            </span>
                          </div>
                          <span className="text-xs text-slate-600">
                            Các task do Agent Squad tự động bóc tách từ tranh luận, cần Human PM phê duyệt trước khi giao việc
                          </span>
                        </div>

                        <div className="space-y-3">
                          {pendingTasks.map(task => (
                            <div key={task.id} className="bg-white p-3.5 rounded-lg border border-teal-200 shadow-2xs flex flex-col md:flex-row md:items-start justify-between gap-3">
                              <div className="flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                    task.priority === 'Critical' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                    task.priority === 'High' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                                  }`}>
                                    {task.priority}
                                  </span>
                                  <h4 className="text-xs font-bold text-slate-900">{task.title}</h4>
                                  <span className="text-[11px] text-slate-500">· Phụ trách: <strong className="text-slate-800">{task.assigned_to}</strong></span>
                                </div>

                                {task.target_files && task.target_files.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1 text-[11px]">
                                    <span className="text-slate-500 font-semibold">📁 File:</span>
                                    {task.target_files.map((file, i) => (
                                      <span key={i} className="px-1.5 py-0.2 font-mono text-[10px] bg-slate-100 text-teal-900 font-medium rounded border border-slate-200">
                                        {file}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {task.execution_steps && task.execution_steps.length > 0 && (
                                  <div className="bg-slate-50 p-2 rounded border border-slate-200/80 mt-1">
                                    <div className="text-[10px] font-bold text-slate-600 mb-1">🛠️ Các bước thực thi chi tiết (Step-by-step):</div>
                                    <ol className="list-decimal list-inside text-[11px] text-slate-700 space-y-0.5 leading-relaxed">
                                      {task.execution_steps.map((step, idx) => (
                                        <li key={idx}><span className="font-normal">{step}</span></li>
                                      ))}
                                    </ol>
                                  </div>
                                )}

                                {task.story && (
                                  <p className="text-[11px] text-slate-600 italic bg-amber-50/50 p-1.5 rounded border border-amber-200/50">
                                    {task.story}
                                  </p>
                                )}
                              </div>

                              <div className="flex md:flex-col items-center gap-2 shrink-0">
                                <button
                                  disabled={isDispatchingTask === task.id}
                                  onClick={() => handleDispatchTask(task.id, 'approve')}
                                  className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs flex items-center justify-center gap-1 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                  <span>{isDispatchingTask === task.id ? 'Đang xử lý...' : 'Phê duyệt & Giao việc'}</span>
                                </button>
                                <button
                                  disabled={isDispatchingTask === task.id}
                                  onClick={() => handleDispatchTask(task.id, 'dispatch_clickup')}
                                  className="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-xs flex items-center justify-center gap-1 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[14px]">rocket_launch</span>
                                  <span>{isDispatchingTask === task.id ? 'Đang đẩy...' : 'Đẩy lên ClickUp'}</span>
                                </button>
                                <button
                                  disabled={isDispatchingTask === task.id}
                                  onClick={() => handleDispatchTask(task.id, 'reject')}
                                  className="w-full px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded text-xs font-medium border border-slate-200 transition-colors"
                                >
                                  <span>Từ chối</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

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

                                  {task.target_files && task.target_files.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {task.target_files.slice(0, 2).map((f, i) => (
                                        <span key={i} className="text-[9px] font-mono px-1 py-0.2 bg-slate-100 rounded text-slate-600 truncate max-w-[140px]">
                                          {f}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {task.clickup_url && (
                                    <a
                                      href={task.clickup_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 mb-2 transition-colors"
                                    >
                                      <span>ClickUp Task</span>
                                      <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                                    </a>
                                  )}

                                  <div className="text-[10px] font-mono text-slate-500 mb-2 flex items-center justify-between gap-1">
                                    <span className="truncate flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[12px]">link</span>
                                      {task.source_anchor}
                                    </span>
                                    {task.dispatch_status && (
                                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold shrink-0 ${
                                        task.dispatch_status === 'approved' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                                        task.dispatch_status === 'dispatched' ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' :
                                        task.dispatch_status === 'pending_review' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                        'bg-slate-100 text-slate-600'
                                      }`}>
                                        {task.dispatch_status === 'approved' ? 'Đã duyệt' :
                                         task.dispatch_status === 'dispatched' ? 'Đã đẩy ClickUp' :
                                         task.dispatch_status === 'pending_review' ? 'Chờ duyệt' : 'Draft'}
                                      </span>
                                    )}
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
                            <div className="text-[11px] text-slate-500 mt-0.5">This is a saved channel address. It is not connected yet; a workspace admin must authorize the integration and grant access.</div>
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

              {/* TAB 5: AGENT CONFIG & SQUAD MANAGEMENT */}
              {activeTab === 'agent' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-teal-600">groups</span>
                        <span>Hội đồng Agent & Cá nhân hóa (Agent Squad & Repo Grounding)</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Quản lý đội ngũ AI Agent chuyên biệt: phân vai trò, gán repository ngữ cảnh thực tế và điều chỉnh mức độ tự chủ.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsAddAgentModalOpen(true)}
                      className="px-3 py-1.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                      <span>+ Thêm Agent từ Repo</span>
                    </button>
                  </div>

                  {/* Squad Members Selector */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <label className="text-xs font-bold text-slate-900 block mb-2">
                      Chọn Agent trong Hội đồng để cấu hình:
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {(currentRoom.squad_agents || DEFAULT_SQUAD_AGENTS).map(agent => (
                        <div
                          key={agent.agent_id}
                          onClick={() => setSelectedAgentToEditId(agent.agent_id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                            selectedAgentToEditId === agent.agent_id
                              ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/30 shadow-xs'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-lg">{agent.avatar || '🤖'}</span>
                              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 bg-white rounded border border-slate-200 text-slate-700">
                                {agent.autonomy_mode}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-slate-900 mb-0.5 line-clamp-1">{agent.agent_name}</div>
                            <p className="text-[11px] text-slate-600 leading-tight line-clamp-2">{agent.role}</p>
                          </div>
                          {agent.repo_binding && (
                            <div className="mt-2 text-[10px] font-mono text-teal-800 bg-teal-100/50 px-1.5 py-0.5 rounded truncate">
                              📁 {agent.repo_binding}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active Selected Agent Form */}
                  {(() => {
                    const squad = currentRoom.squad_agents || DEFAULT_SQUAD_AGENTS;
                    const activeAgent = squad.find(a => a.agent_id === selectedAgentToEditId) || squad[0];
                    if (!activeAgent) return null;

                    return (
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 animate-fadeIn">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{activeAgent.avatar || '🤖'}</span>
                            <div>
                              <h3 className="text-xs font-bold text-slate-900">Chi tiết cấu hình: {activeAgent.agent_name}</h3>
                              <p className="text-[11px] text-slate-500">{activeAgent.role}</p>
                            </div>
                          </div>
                          {squad.length > 1 && (
                            <button
                              onClick={() => handleDeleteSquadAgent(activeAgent.agent_id)}
                              className="text-xs text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 font-medium"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                              <span>Xóa Agent</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-slate-800 block mb-1">
                              Tên Agent & Chức danh
                            </label>
                            <input
                              type="text"
                              value={activeAgent.agent_name}
                              onChange={e => {
                                const updated = { ...activeAgent, agent_name: e.target.value };
                                setRooms(prev => prev.map(r => r.id === currentRoom.id ? {
                                  ...r,
                                  squad_agents: (r.squad_agents || []).map(a => a.agent_id === activeAgent.agent_id ? updated : a)
                                } : r));
                              }}
                              className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus-ring"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-800 block mb-1">
                              Biểu tượng / Avatar
                            </label>
                            <div className="flex items-center gap-2">
                              {['👔', '🏛️', '🛡️', '⚡', '💻', '🛠️', '🔒', '📊', '🤖'].map(emoji => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...activeAgent, avatar: emoji };
                                    setRooms(prev => prev.map(r => r.id === currentRoom.id ? {
                                      ...r,
                                      squad_agents: (r.squad_agents || []).map(a => a.agent_id === activeAgent.agent_id ? updated : a)
                                    } : r));
                                  }}
                                  className={`p-1.5 rounded-lg border text-base ${
                                    activeAgent.avatar === emoji
                                      ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/30'
                                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-slate-800 block mb-1">
                              Vai trò & Trách nhiệm chính
                            </label>
                            <input
                              type="text"
                              value={activeAgent.role}
                              onChange={e => {
                                const updated = { ...activeAgent, role: e.target.value };
                                setRooms(prev => prev.map(r => r.id === currentRoom.id ? {
                                  ...r,
                                  squad_agents: (r.squad_agents || []).map(a => a.agent_id === activeAgent.agent_id ? updated : a)
                                } : r));
                              }}
                              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus-ring"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-800 block mb-1">
                              Repository / Codebase Binding (File hoặc Folder ngữ cảnh)
                            </label>
                            <input
                              type="text"
                              value={activeAgent.repo_binding || ''}
                              placeholder="e.g. backend/api.py hoặc d:/Hackathon/AITinker"
                              onChange={e => {
                                const updated = { ...activeAgent, repo_binding: e.target.value };
                                setRooms(prev => prev.map(r => r.id === currentRoom.id ? {
                                  ...r,
                                  squad_agents: (r.squad_agents || []).map(a => a.agent_id === activeAgent.agent_id ? updated : a)
                                } : r));
                              }}
                              className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus-ring"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-slate-800 block mb-1">
                              Model Tier
                            </label>
                            <select
                              value={activeAgent.model_tier}
                              onChange={e => {
                                const updated = { ...activeAgent, model_tier: e.target.value };
                                setRooms(prev => prev.map(r => r.id === currentRoom.id ? {
                                  ...r,
                                  squad_agents: (r.squad_agents || []).map(a => a.agent_id === activeAgent.agent_id ? updated : a)
                                } : r));
                              }}
                              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus-ring"
                            >
                              <option value="Nebius Qwen-30B (Fast)">Nebius Qwen-30B (Fast Ingestion)</option>
                              <option value="Claude 3.5 Sonnet (High)">Claude 3.5 Sonnet (Complex Logic)</option>
                              <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (Low Latency)</option>
                              <option value="DeepSeek R1 (Reasoning)">DeepSeek R1 (Deep Tree Reasoning)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-800 block mb-1">
                              Chế độ Tự chủ (Autonomy Mode)
                            </label>
                            <select
                              value={activeAgent.autonomy_mode}
                              onChange={e => {
                                const updated = { ...activeAgent, autonomy_mode: e.target.value as any };
                                setRooms(prev => prev.map(r => r.id === currentRoom.id ? {
                                  ...r,
                                  squad_agents: (r.squad_agents || []).map(a => a.agent_id === activeAgent.agent_id ? updated : a)
                                } : r));
                              }}
                              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus-ring"
                            >
                              <option value="Supervised">Supervised (Chờ Human PM phê duyệt)</option>
                              <option value="Semi-Autonomous">Semi-Autonomous (Tự động thảo luận & phác thảo)</option>
                              <option value="Autonomous">Autonomous (Tự động bóc tách & dispatch)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-800 block mb-1">
                            Chỉ thị Hệ thống & Định hướng Hành vi (System Prompt)
                          </label>
                          <textarea
                            rows={4}
                            value={activeAgent.instructions}
                            onChange={e => {
                              const updated = { ...activeAgent, instructions: e.target.value };
                              setRooms(prev => prev.map(r => r.id === currentRoom.id ? {
                                ...r,
                                squad_agents: (r.squad_agents || []).map(a => a.agent_id === activeAgent.agent_id ? updated : a)
                              } : r));
                            }}
                            className="w-full text-xs font-mono p-3 border border-slate-200 rounded-lg text-slate-900 focus-ring leading-relaxed"
                          />
                        </div>

                        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                          <span className="text-xs text-slate-500">
                            Cấu hình Agent sẽ được lưu bền vững vào máy chủ và áp dụng ngay trong tranh biện room.
                          </span>
                          <button
                            disabled={isSavingAgent}
                            onClick={() => handleSaveSquadAgent(activeAgent)}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">save</span>
                            <span>{isSavingAgent ? 'Đang lưu...' : 'Lưu Cấu Hình Agent'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 6: CURATED OSS REPOSITORIES */}
              {activeTab === 'repos' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-teal-600">source</span>
                      <span>Kho Agent Framework Nguồn Mở Tích Hợp (Curated OSS Agent Frameworks)</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Các framework mã nguồn mở hàng đầu được đóng gói sẵn để bạn có thể kích hoạt trực tiếp thành Agent trong Squad với 1 click.
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

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleInstallCuratedRepo(repo)}
                              className="px-2.5 py-1 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1 transition-all"
                            >
                              <span className="material-symbols-outlined text-[13px]">bolt</span>
                              <span>Kích hoạt vào Squad</span>
                            </button>
                            <a
                              href={repo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-slate-700 hover:text-teal-700 flex items-center gap-0.5"
                            >
                              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                            </a>
                          </div>
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 max-w-6xl mx-auto w-full space-y-6">
            {/* Metric KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Project rooms
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {rooms.length}
                </div>
                <div className="text-[11px] text-teal-700 font-medium mt-0.5">
                  Workspaces for team projects
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Channel references
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {rooms.reduce((acc, r) => acc + r.social_links.length, 0)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Saved addresses; connection status is shown per room
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Room tasks
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {rooms.reduce((acc, r) => acc + r.tasks.length, 0)}
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  Tasks across all rooms
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  AI roles
                </div>
                <div className="text-2xl font-bold font-mono text-teal-800 mt-1">
                  {SPECIALIZED_PM_AGENTS.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Roles available to assign to a room
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
                <h3 className="text-base font-bold text-slate-900">Create project room</h3>
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

      {/* MODAL: MULTI-AGENT SWARM DEBATE */}
      {isDebateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Thảo luận Đa Agent & Phân rã Tasks</h3>
                  <p className="text-xs text-slate-500">Hội đồng 4 Agent sẽ phản biện nghiệp vụ, kiến trúc và an ninh</p>
                </div>
              </div>
              <button onClick={() => !isDebating && setIsDebateModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Chủ đề / Yêu cầu cần Hội đồng Agent thảo luận & phân rã *
                </label>
                <textarea
                  rows={3}
                  value={debateTopic}
                  onChange={e => setDebateTopic(e.target.value)}
                  placeholder="e.g. Google Workspace SSO with domain restriction & account provisioning for Acme Corp"
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus-ring leading-relaxed"
                />
              </div>

              {/* Squad Preview */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 block mb-2">Thành viên tham gia tranh biện:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <span>👔</span>
                    <span className="font-semibold">Lead Agile PM</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <span>🏛️</span>
                    <span className="font-semibold">Tech Lead Architect</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <span>🛡️</span>
                    <span className="font-semibold">QA & Security Auditor</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <span>⚡</span>
                    <span className="font-semibold">Dev Task Decomposer</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                disabled={isDebating}
                onClick={() => setIsDebateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy bỏ
              </button>
              <button
                disabled={isDebating || !debateTopic.trim()}
                onClick={() => handleRunSwarmDebate()}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-teal-600 via-indigo-600 to-purple-600 hover:from-teal-700 hover:to-purple-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-2"
              >
                {isDebating ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                    <span>Đang tranh biện & phân rã tasks...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                    <span>Bắt đầu Thảo luận</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD AGENT FROM REPO */}
      {isAddAgentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-teal-600">source</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Thêm Agent từ Repository</h3>
                  <p className="text-xs text-slate-500">Gán ngữ cảnh mã nguồn cụ thể để Agent hiểu rõ codebase</p>
                </div>
              </div>
              <button onClick={() => !isSavingAgent && setIsAddAgentModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 mb-5 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Tên Agent & Chức danh *</label>
                <input
                  type="text"
                  placeholder="e.g. Backend API Core Engineer"
                  value={newAgentName}
                  onChange={e => setNewAgentName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Avatar</label>
                  <div className="flex items-center gap-1.5">
                    {['💻', '🛠️', '🔒', '📊', '⚡', '🤖'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewAgentAvatar(emoji)}
                        className={`p-1.5 rounded-lg border text-base ${
                          newAgentAvatar === emoji
                            ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/30'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Model Tier</label>
                  <select
                    value={newAgentModel}
                    onChange={e => setNewAgentModel(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Nebius Qwen-30B (Fast)">Nebius Qwen-30B (Fast)</option>
                    <option value="Claude 3.5 Sonnet (High)">Claude 3.5 Sonnet</option>
                    <option value="DeepSeek R1 (Reasoning)">DeepSeek R1</option>
                    <option value="Gemini 2.5 Flash">Gemini 2.5 Flash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Repository / Local Path Liên Kết *
                </label>
                <input
                  type="text"
                  placeholder="e.g. backend/api.py hoặc https://github.com/org/repo"
                  value={newAgentRepo}
                  onChange={e => setNewAgentRepo(e.target.value)}
                  className="w-full font-mono text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus-ring"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Agent sẽ dùng ngữ cảnh mã nguồn này khi phản biện kiến trúc và đề xuất file sửa đổi.</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Vai trò & Trách nhiệm</label>
                <input
                  type="text"
                  placeholder="e.g. Phụ trách API endpoints, data validation và xử lý concurrency"
                  value={newAgentRole}
                  onChange={e => setNewAgentRole(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus-ring"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Chỉ thị Hệ thống (System Prompt)</label>
                <textarea
                  rows={3}
                  placeholder="Directives for the agent regarding code quality, testing rigor, etc."
                  value={newAgentInstructions}
                  onChange={e => setNewAgentInstructions(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border border-slate-200 rounded-lg text-slate-900 focus-ring"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                disabled={isSavingAgent}
                onClick={() => setIsAddAgentModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                disabled={isSavingAgent || !newAgentName.trim()}
                onClick={() => {
                  const agentObj: RoomAgentConfig = {
                    agent_id: `agent-custom-${Date.now()}`,
                    agent_name: newAgentName.trim(),
                    avatar: newAgentAvatar,
                    role: newAgentRole.trim() || 'Kỹ sư phát triển phần mềm',
                    repo_binding: newAgentRepo.trim() || 'Local Codebase',
                    skills: ['repo_code_specialist'],
                    instructions: newAgentInstructions.trim() || 'Phân tích mã nguồn thực tế và đề xuất file sửa đổi chuẩn xác.',
                    model_tier: newAgentModel,
                    autonomy_mode: newAgentAutonomy,
                    verification_rigor: 'Strict 3-Axis',
                    temperature: 0.2,
                  };
                  handleSaveSquadAgent(agentObj);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>{isSavingAgent ? 'Đang thêm...' : 'Tạo & Thêm vào Squad'}</span>
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
