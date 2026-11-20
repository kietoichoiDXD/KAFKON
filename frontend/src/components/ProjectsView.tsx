import React, { useEffect, useState, useMemo } from 'react';
import { API, safeFetchJson, safeRender } from '../api';
import { ProjectItem, SocialChannelItem, ViewType } from '../types';

interface ProjectsViewProps {
  onSelectView?: (view: ViewType) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onSelectView }) => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('scribeba.projects.theme') === 'dark';
  });
  
  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRepo, setFormRepo] = useState('');
  const [formBranch, setFormBranch] = useState('main');
  const [formLocalPath, setFormLocalPath] = useState('');
  const [formSlack, setFormSlack] = useState('');
  const [formClickUp, setFormClickUp] = useState('');
  const [formDiscord, setFormDiscord] = useState('');
  const [formAiInstructions, setFormAiInstructions] = useState('');
  const [formStatus, setFormStatus] = useState('active');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Social Channels Manager Modal State
  const [channelModalProject, setChannelModalProject] = useState<ProjectItem | null>(null);
  const [availableSlackChannels, setAvailableSlackChannels] = useState<
    Array<{ id: string; name: string; is_private?: boolean; is_member?: boolean }>
  >([]);
  const [loadingSlackChannels, setLoadingSlackChannels] = useState(false);
  const [newChanPlatform, setNewChanPlatform] = useState<'slack' | 'discord' | 'telegram'>('slack');
  const [selectedSlackChannelId, setSelectedSlackChannelId] = useState<string>('');
  const [customChannelId, setCustomChannelId] = useState('');
  const [customChannelName, setCustomChannelName] = useState('');
  const [newChanPurpose, setNewChanPurpose] = useState('');
  const [newChanIsPrimary, setNewChanIsPrimary] = useState(false);
  const [addingChannel, setAddingChannel] = useState(false);
  const [pingStatus, setPingStatus] = useState<{
    channelId: string;
    loading: boolean;
    message: string;
    success?: boolean;
  } | null>(null);

  // Quick Bring AI via Slack Link State
  const [quickSlackUrl, setQuickSlackUrl] = useState('');
  const [quickProjectId, setQuickProjectId] = useState<string>('');
  const [quickPostAnnouncement, setQuickPostAnnouncement] = useState(true);
  const [quickAutoAnalyze, setQuickAutoAnalyze] = useState(true);
  const [bringingAi, setBringingAi] = useState(false);
  const [bringAiFeedback, setBringAiFeedback] = useState<{
    ok: boolean;
    message: string;
    channel_name?: string;
    permalink?: string;
    messages_count?: number;
    project_name?: string;
    analysis?: any;
  } | null>(null);

  // Modal Direct Slack Link State
  const [channelConnectMode, setChannelConnectMode] = useState<'link' | 'workspace'>('link');
  const [modalSlackUrl, setModalSlackUrl] = useState('');
  const [modalPostAnnouncement, setModalPostAnnouncement] = useState(true);
  const [modalAutoAnalyze, setModalAutoAnalyze] = useState(true);
  const [modalBringingAi, setModalBringingAi] = useState(false);
  const [modalBringAiFeedback, setModalBringAiFeedback] = useState<{
    ok: boolean;
    message: string;
    channel_name?: string;
    permalink?: string;
  } | null>(null);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('scribeba.projects.theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const loadProjects = async () => {
    setLoading(true);
    const [projRes, activeRes] = await Promise.all([
      safeFetchJson<ProjectItem[]>(`${API}/api/projects`),
      safeFetchJson<ProjectItem>(`${API}/api/projects/active`),
    ]);

    if (projRes.ok && Array.isArray(projRes.data)) {
      setProjects(projRes.data);
    }
    if (activeRes.ok && activeRes.data?.id) {
      setActiveProject(activeRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const handleOpenCreate = () => {
    setEditingProject(null);
    setFormName('');
    setFormDesc('');
    setFormRepo('');
    setFormBranch('main');
    setFormLocalPath('D:/Hackathon/AITinker');
    setFormSlack('#all-ai4l-aio');
    setFormClickUp('901202868154');
    setFormDiscord('');
    setFormAiInstructions('');
    setFormStatus('active');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (project: ProjectItem) => {
    setEditingProject(project);
    setFormName(project.name);
    setFormDesc(project.description || '');
    setFormRepo(project.repo_url || '');
    setFormBranch(project.repo_branch || 'main');
    setFormLocalPath(project.local_path || '');
    setFormSlack(project.slack_channel || '');
    setFormClickUp(project.clickup_list_id || '');
    setFormDiscord(project.discord_channel || '');
    setFormAiInstructions(project.ai_instructions || '');
    setFormStatus(project.status || 'active');
    setIsModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    setFeedback(null);

    const payload = {
      name: formName.trim(),
      description: formDesc.trim(),
      repo_url: formRepo.trim(),
      repo_branch: formBranch.trim(),
      local_path: formLocalPath.trim(),
      slack_channel: formSlack.trim(),
      clickup_list_id: formClickUp.trim(),
      discord_channel: formDiscord.trim(),
      ai_instructions: formAiInstructions.trim(),
      status: formStatus,
    };

    if (editingProject) {
      const res = await safeFetchJson<{ message: string }>(`${API}/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Cập nhật project thành công!' });
        setIsModalOpen(false);
        void loadProjects();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Lỗi khi cập nhật project.' });
      }
    } else {
      const res = await safeFetchJson<{ project: ProjectItem }>(`${API}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setFeedback({ type: 'success', text: `Đã thêm project "${formName}" thành công!` });
        setIsModalOpen(false);
        void loadProjects();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Lỗi khi tạo project.' });
      }
    }
    setSaving(false);
  };

  const handleActivateProject = async (project: ProjectItem) => {
    const res = await safeFetchJson<{ active_project: ProjectItem }>(`${API}/api/projects/${project.id}/activate`, {
      method: 'POST',
    });
    if (res.ok && res.data?.active_project) {
      const act = res.data.active_project;
      setActiveProject(act);
      setFeedback({ type: 'success', text: `Đã chuyển sang không gian làm việc của project: ${project.name}` });
      localStorage.setItem('scribeba.active_project_id', project.id);
      window.dispatchEvent(new CustomEvent('project-changed', { detail: { project: act } }));
      if (onSelectView) {
        setTimeout(() => onSelectView('home'), 400);
      }
    }
  };

  const handleStartProjectChat = async (project: ProjectItem) => {
    await safeFetchJson(`${API}/api/projects/${project.id}/activate`, { method: 'POST' });
    setActiveProject(project);
    localStorage.setItem('scribeba.active_project_id', project.id);

    // Create fresh clean session specifically for this project
    const sessRes = await safeFetchJson<{ id: string }>(`${API}/api/projects/${project.id}/new-session`, {
      method: 'POST',
    });
    const sessionId = sessRes.ok ? sessRes.data?.id : undefined;

    window.dispatchEvent(new CustomEvent('project-changed', { detail: { project, sessionId } }));
    if (onSelectView) {
      onSelectView('home');
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa project "${name}"?`)) return;
    const res = await safeFetchJson(`${API}/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setFeedback({ type: 'success', text: `Đã xóa project "${name}".` });
      void loadProjects();
    }
  };

  const handleOpenChannelManager = async (project: ProjectItem) => {
    setChannelModalProject(project);
    setNewChanPlatform('slack');
    setSelectedSlackChannelId('');
    setCustomChannelId('');
    setCustomChannelName('');
    setNewChanPurpose('Hội thoại kỹ thuật & Task extraction');
    setNewChanIsPrimary(false);
    setPingStatus(null);

    setLoadingSlackChannels(true);
    const res = await safeFetchJson<
      Array<{ id: string; name: string; is_private?: boolean; is_member?: boolean }>
    >(`${API}/api/slack/channels`);
    if (res.ok && Array.isArray(res.data)) {
      setAvailableSlackChannels(res.data);
      if (res.data.length > 0) {
        setSelectedSlackChannelId(res.data[0].id);
        setCustomChannelName(res.data[0].name);
      }
    }
    setLoadingSlackChannels(false);
  };

  const handleAddChannelToProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelModalProject) return;

    let targetId = '';
    let targetName = '';

    if (newChanPlatform === 'slack') {
      if (selectedSlackChannelId === '__custom__') {
        targetId = customChannelId.trim();
        targetName = customChannelName.trim() || targetId;
      } else {
        const found = availableSlackChannels.find(c => c.id === selectedSlackChannelId);
        targetId = selectedSlackChannelId;
        targetName = found ? found.name : targetId;
      }
    } else {
      targetId = customChannelId.trim();
      targetName = customChannelName.trim() || targetId;
    }

    if (!targetId) {
      setFeedback({ type: 'error', text: 'Vui lòng chọn hoặc nhập mã kênh (Channel ID/Name).' });
      return;
    }

    setAddingChannel(true);
    const payload = {
      id: targetId,
      name: targetName.replace(/^#/, ''),
      platform: newChanPlatform,
      is_primary: newChanIsPrimary,
      purpose: newChanPurpose.trim() || 'Hội thoại kỹ thuật & Task extraction',
    };

    const res = await safeFetchJson<{ status: string; message: string; channels: SocialChannelItem[] }>(
      `${API}/api/projects/${channelModalProject.id}/social-channels`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (res.ok && res.data?.channels) {
      const updatedChannels = res.data.channels;
      setChannelModalProject(prev => (prev ? { ...prev, social_channels: updatedChannels } : null));
      setFeedback({ type: 'success', text: res.data.message || 'Đã thêm kênh thành công!' });
      setNewChanPurpose('Hội thoại kỹ thuật & Task extraction');
      setCustomChannelId('');
      setCustomChannelName('');
      void loadProjects();
    } else {
      setFeedback({ type: 'error', text: res.error || 'Lỗi khi thêm kênh vào project.' });
    }
    setAddingChannel(false);
  };

  const handleRemoveChannel = async (channelId: string) => {
    if (!channelModalProject) return;
    if (!window.confirm('Bạn có chắc chắn muốn gỡ kênh này khỏi project?')) return;

    const res = await safeFetchJson<{ status: string; message: string; channels: SocialChannelItem[] }>(
      `${API}/api/projects/${channelModalProject.id}/social-channels/${channelId}`,
      { method: 'DELETE' }
    );

    if (res.ok && res.data?.channels) {
      const updatedChannels = res.data.channels;
      setChannelModalProject(prev => (prev ? { ...prev, social_channels: updatedChannels } : null));
      setFeedback({ type: 'success', text: 'Đã gỡ kênh khỏi project.' });
      void loadProjects();
    } else {
      setFeedback({ type: 'error', text: res.error || 'Lỗi khi gỡ kênh.' });
    }
  };

  const handleSetPrimary = async (channelId: string, platform: string) => {
    if (!channelModalProject) return;
    const res = await safeFetchJson<{ status: string; message: string; channels: SocialChannelItem[] }>(
      `${API}/api/projects/${channelModalProject.id}/social-channels/set-primary`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, platform }),
      }
    );

    if (res.ok && res.data?.channels) {
      setChannelModalProject(prev => (prev ? { ...prev, social_channels: res.data!.channels } : null));
      setFeedback({ type: 'success', text: res.data.message || 'Đã cập nhật kênh chính.' });
      void loadProjects();
    } else {
      setFeedback({ type: 'error', text: res.error || 'Lỗi khi đặt kênh chính.' });
    }
  };

  const handleTestPing = async (channel: SocialChannelItem) => {
    if (!channelModalProject) return;
    setPingStatus({
      channelId: channel.id,
      loading: true,
      message: `Đang gửi tin nhắn kiểm tra tới #${channel.name}...`,
    });

    const res = await safeFetchJson<{ status: string; message: string; ts?: string }>(
      `${API}/api/projects/${channelModalProject.id}/social-channels/test-ping`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channel.id,
          channel_name: channel.name,
          platform: channel.platform,
        }),
      }
    );

    if (res.ok) {
      setPingStatus({
        channelId: channel.id,
        loading: false,
        success: true,
        message: res.data?.message || `Đã kết nối thành công tới #${channel.name}!`,
      });
    } else {
      setPingStatus({
        channelId: channel.id,
        loading: false,
        success: false,
        message: res.error || 'Không thể gửi tin nhắn tới kênh.',
      });
    }
  };

  const handleQuickBringAi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const url = quickSlackUrl.trim();
    if (!url) return;

    const targetProjId = quickProjectId || activeProject?.id || (projects[0]?.id ?? '');
    setBringingAi(true);
    setBringAiFeedback(null);

    try {
      const res = await safeFetchJson<{
        status: string;
        message: string;
        channel_id: string;
        channel_name: string;
        thread_ts?: string;
        permalink?: string;
        messages_count?: number;
        project_id: string;
        project_name: string;
        analysis?: any;
        error?: string;
      }>(`${API}/api/slack/bring-ai-to-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          project_id: targetProjId,
          post_announcement: quickPostAnnouncement,
          auto_analyze: quickAutoAnalyze,
        }),
      });

      if (res.ok && res.data) {
        setBringAiFeedback({
          ok: true,
          message: res.data.message || `Đã đưa ScribeBA AI vào kênh #${res.data.channel_name}!`,
          channel_name: res.data.channel_name,
          permalink: res.data.permalink,
          messages_count: res.data.messages_count,
          project_name: res.data.project_name,
          analysis: res.data.analysis,
        });
        await loadProjects();
      } else {
        setBringAiFeedback({
          ok: false,
          message: res.error || 'Không thể đưa AI vào kênh Slack.',
        });
      }
    } catch (err: any) {
      setBringAiFeedback({
        ok: false,
        message: err.message || 'Lỗi kết nối máy chủ.',
      });
    } finally {
      setBringingAi(false);
    }
  };

  const handleModalBringAi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!channelModalProject) return;
    const url = modalSlackUrl.trim();
    if (!url) return;

    setModalBringingAi(true);
    setModalBringAiFeedback(null);

    try {
      const res = await safeFetchJson<{
        status: string;
        message: string;
        channel_id: string;
        channel_name: string;
        thread_ts?: string;
        permalink?: string;
        messages_count?: number;
        project_id: string;
        project_name: string;
        analysis?: any;
        error?: string;
      }>(`${API}/api/slack/bring-ai-to-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          project_id: channelModalProject.id,
          post_announcement: modalPostAnnouncement,
          auto_analyze: modalAutoAnalyze,
        }),
      });

      if (res.ok && res.data) {
        setModalBringAiFeedback({
          ok: true,
          message: res.data.message || `Đã đưa AI vào kênh #${res.data.channel_name}!`,
          channel_name: res.data.channel_name,
          permalink: res.data.permalink,
        });
        setModalSlackUrl('');
        // Reload project data to update modal
        const refreshed = await safeFetchJson<ProjectItem[]>(`${API}/api/projects`);
        if (refreshed.ok && Array.isArray(refreshed.data)) {
          setProjects(refreshed.data);
          const updated = refreshed.data.find(p => p.id === channelModalProject.id);
          if (updated) setChannelModalProject(updated);
        }
      } else {
        setModalBringAiFeedback({
          ok: false,
          message: res.error || 'Không thể đưa AI vào kênh Slack.',
        });
      }
    } catch (err: any) {
      setModalBringAiFeedback({
        ok: false,
        message: err.message || 'Lỗi kết nối máy chủ.',
      });
    } finally {
      setModalBringingAi(false);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Gần đây';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
  };

  const filteredProjects = useMemo(() => {
    let list = [...projects];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.repo_url || '').toLowerCase().includes(q) ||
        (p.slack_channel || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const diff = (a.updated_at || 0) - (b.updated_at || 0);
      return sortOrder === 'desc' ? -diff : diff;
    });
    return list;
  }, [projects, searchQuery, sortOrder]);

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden font-sans transition-colors ${
        isDarkMode ? 'bg-[#18181b] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Notification Toast */}
      {feedback && (
        <div
          role="alert"
          className={`shrink-0 px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b transition-all ${
            feedback.type === 'success'
              ? isDarkMode
                ? 'bg-emerald-950/80 text-emerald-200 border-emerald-800/60'
                : 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : isDarkMode
              ? 'bg-rose-950/80 text-rose-200 border-rose-800/60'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {feedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className={isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Main Header */}
      <header
        className={`shrink-0 border-b px-8 py-5 transition-colors ${
          isDarkMode ? 'border-zinc-800/80 bg-[#18181b]' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h1
              className={`m-0 text-3xl font-normal font-serif tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Projects
            </h1>
            <span className={`text-xs font-mono ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
              ({projects.length} workspace{projects.length === 1 ? '' : 's'})
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <span
                className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] ${
                  isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                }`}
              >
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className={`w-56 rounded-full border pl-9 pr-3 py-1.5 text-xs transition-colors focus:outline-hidden ${
                  isDarkMode
                    ? 'border-zinc-700 bg-zinc-900/90 text-zinc-200 placeholder-zinc-500 focus:border-zinc-500'
                    : 'border-slate-300 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-teal-600 focus:bg-white'
                }`}
              />
            </div>

            {/* Sort Toggle Button */}
            <button
              type="button"
              onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
              className={`p-2 rounded-full transition-colors ${
                isDarkMode
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Đổi thứ tự sắp xếp"
            >
              <span className="material-symbols-outlined text-[20px]">swap_vert</span>
            </button>

            {/* Theme Toggle Button (Sáng / Tối) */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isDarkMode
                  ? 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-2xs'
              }`}
              title={isDarkMode ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
            >
              <span className="material-symbols-outlined text-[16px] text-amber-500">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
              <span>{isDarkMode ? 'Giao diện Tối' : 'Giao diện Sáng'}</span>
            </button>

            {/* New Project Button */}
            <button
              type="button"
              onClick={handleOpenCreate}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-xs transition-colors ${
                isDarkMode
                  ? 'bg-white text-zinc-900 hover:bg-zinc-100'
                  : 'bg-teal-700 text-white hover:bg-teal-800'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              New project
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain p-8">
        {/* ⚡ Quick Slack Link: Bring AI directly without API Key */}
        <section
          aria-label="Đưa AI vào kênh Slack"
          className={`rounded-2xl border p-5 transition-all shadow-xs shrink-0 ${
            isDarkMode
              ? 'border-purple-800/60 bg-gradient-to-r from-purple-950/40 via-zinc-900 to-zinc-900 text-white'
              : 'border-purple-200 bg-gradient-to-r from-purple-50/80 via-white to-purple-50/40 text-slate-900 shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-purple-200/50 dark:border-purple-900/40">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs ${
                  isDarkMode ? 'bg-purple-900/80 text-purple-200' : 'bg-purple-600 text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">link</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold m-0 flex items-center gap-1.5">
                    <span>Đưa ScribeBA AI vào Kênh / Thread Slack qua Link</span>
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    ⚡ Không cần cấu hình Key
                  </span>
                </div>
                <p className={`text-xs mt-0.5 m-0 ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Dán link bất kỳ từ Slack (kênh hoặc tin nhắn thread). AI sẽ tự tham gia, gửi lời chào và trích xuất task vào ClickUp cho dự án.
                </p>
              </div>
            </div>

            {/* Quick Demo Fill Button */}
            <button
              type="button"
              onClick={() => {
                setQuickSlackUrl('https://ai4l-aio.slack.com/archives/C0CFE9GL4AK/p1795162883105679');
                if (!quickProjectId && (activeProject?.id || projects[0]?.id)) {
                  setQuickProjectId(activeProject?.id || projects[0]?.id);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                isDarkMode
                  ? 'border-purple-800/80 bg-purple-950/50 text-purple-200 hover:bg-purple-900/60'
                  : 'border-purple-200 bg-purple-100/70 text-purple-800 hover:bg-purple-200/80'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-purple-600">lightbulb</span>
              <span>Dán link mẫu thực tế (#all-ai4l-aio)</span>
            </button>
          </div>

          {/* Form Controls */}
          <form onSubmit={handleQuickBringAi} className="mt-3.5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              {/* Project Target Selector */}
              <div className="md:col-span-4">
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 text-slate-500 dark:text-zinc-400">
                  Dự án gắn kết
                </label>
                <select
                  value={quickProjectId || activeProject?.id || (projects[0]?.id ?? '')}
                  onChange={e => setQuickProjectId(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-xs font-medium focus:outline-hidden ${
                    isDarkMode
                      ? 'border-zinc-700 bg-zinc-800 text-white focus:border-purple-500'
                      : 'border-slate-300 bg-white text-slate-900 focus:border-purple-600'
                  }`}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {activeProject?.id === p.id ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Slack URL Input */}
              <div className="md:col-span-6">
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 text-slate-500 dark:text-zinc-400">
                  Link Kênh hoặc Link Tin Nhắn / Thread Slack
                </label>
                <div className="relative">
                  <span
                    className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] ${
                      isDarkMode ? 'text-zinc-500' : 'text-slate-400'
                    }`}
                  >
                    alternate_email
                  </span>
                  <input
                    type="url"
                    required
                    value={quickSlackUrl}
                    onChange={e => setQuickSlackUrl(e.target.value)}
                    placeholder="https://workspace.slack.com/archives/C0CFE9GL4AK/p1795162883..."
                    className={`w-full rounded-xl border pl-9 pr-3 py-2 text-xs focus:outline-hidden ${
                      isDarkMode
                        ? 'border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:border-purple-500'
                        : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-purple-600'
                    }`}
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="md:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={bringingAi || !quickSlackUrl.trim()}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 px-4 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[18px] ${bringingAi ? 'animate-spin' : ''}`}>
                    {bringingAi ? 'progress_activity' : 'rocket_launch'}
                  </span>
                  <span>{bringingAi ? 'Đang đưa vào...' : 'Đưa AI Vào'}</span>
                </button>
              </div>
            </div>

            {/* Checkbox Options */}
            <div className="flex items-center gap-5 flex-wrap pt-1 text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quickPostAnnouncement}
                  onChange={e => setQuickPostAnnouncement(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className={isDarkMode ? 'text-zinc-300' : 'text-slate-700'}>
                  Gửi thông báo chào mừng & sự hiện diện của AI vào Slack
                </span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quickAutoAnalyze}
                  onChange={e => setQuickAutoAnalyze(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className={isDarkMode ? 'text-zinc-300' : 'text-slate-700'}>
                  Tự động phân tích hội thoại & tạo task vào Backlog
                </span>
              </label>
            </div>
          </form>

          {/* Real-time Feedback Banner */}
          {bringAiFeedback && (
            <div
              className={`mt-3.5 p-3.5 rounded-xl border text-xs transition-all ${
                bringAiFeedback.ok
                  ? isDarkMode
                    ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-200'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : isDarkMode
                  ? 'border-rose-800/80 bg-rose-950/40 text-rose-200'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${
                      bringAiFeedback.ok ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {bringAiFeedback.ok ? 'check_circle' : 'error'}
                  </span>
                  <div className="space-y-1">
                    <p className="font-bold text-xs m-0">{bringAiFeedback.message}</p>
                    {bringAiFeedback.ok && (
                      <div className="flex items-center gap-3 flex-wrap text-[11px] opacity-90">
                        {bringAiFeedback.channel_name && (
                          <span className="font-semibold">Kênh: #{bringAiFeedback.channel_name}</span>
                        )}
                        {bringAiFeedback.messages_count !== undefined && (
                          <span>· Đã quét: {bringAiFeedback.messages_count} tin nhắn</span>
                        )}
                        {bringAiFeedback.project_name && (
                          <span>· Dự án: {bringAiFeedback.project_name}</span>
                        )}
                        {bringAiFeedback.permalink && (
                          <a
                            href={bringAiFeedback.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold underline inline-flex items-center gap-0.5 hover:opacity-80"
                          >
                            <span>Mở nguồn Slack</span>
                            <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                          </a>
                        )}
                      </div>
                    )}

                    {bringAiFeedback.analysis?.decomposed_tasks && bringAiFeedback.analysis.decomposed_tasks.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-800/50 flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">⚡ Trích xuất {bringAiFeedback.analysis.decomposed_tasks.length} tasks:</span>
                        {bringAiFeedback.analysis.decomposed_tasks.slice(0, 3).map((t: any, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-zinc-800 border border-emerald-300 dark:border-emerald-700 text-slate-800 dark:text-zinc-200 text-[11px] font-medium"
                          >
                            {safeRender(t.title)}
                          </span>
                        ))}
                        {onSelectView && (
                          <button
                            type="button"
                            onClick={() => onSelectView('tasks')}
                            className="ml-auto px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            Xem toàn bộ Task →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setBringAiFeedback(null)}
                  className="opacity-70 hover:opacity-100 p-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </section>
        {loading ? (
          <div
            className={`flex flex-1 items-center justify-center text-xs gap-2 ${
              isDarkMode ? 'text-zinc-500' : 'text-slate-500'
            }`}
          >
            <span className="material-symbols-outlined animate-spin text-teal-600 text-xl">
              progress_activity
            </span>
            Loading projects...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div
            className={`flex flex-1 flex-col items-center justify-center p-16 text-center border border-dashed rounded-2xl ${
              isDarkMode
                ? 'border-zinc-800 bg-zinc-900/30'
                : 'border-slate-300 bg-white shadow-2xs'
            }`}
          >
            <span
              className={`material-symbols-outlined text-4xl mb-3 ${
                isDarkMode ? 'text-zinc-600' : 'text-slate-300'
              }`}
            >
              folder_open
            </span>
            <h2 className={`text-sm font-semibold m-0 ${isDarkMode ? 'text-zinc-300' : 'text-slate-800'}`}>
              No projects found
            </h2>
            <p className={`text-xs mt-1 max-w-sm ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
              Tạo project mới hoặc kết nối repository GitHub để phân tách ngữ cảnh làm việc và các kênh social.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className={`mt-4 rounded-full px-4 py-2 text-xs font-semibold shadow-xs ${
                isDarkMode
                  ? 'bg-white text-zinc-900 hover:bg-zinc-100'
                  : 'bg-teal-700 text-white hover:bg-teal-800'
              }`}
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProjects.map(project => {
              const isActive = activeProject?.id === project.id;
              return (
                <div
                  key={project.id}
                  className={`group relative rounded-xl border p-4.5 transition-all flex flex-col justify-between gap-3 ${
                    isDarkMode
                      ? isActive
                        ? 'border-teal-500/80 bg-zinc-900/90 shadow-md ring-1 ring-teal-500/50'
                        : 'border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80'
                      : isActive
                      ? 'border-teal-600 bg-teal-50/50 ring-1 ring-teal-600 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Project Icon + Title + Badges */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Project Icon */}
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                          isDarkMode
                            ? 'bg-zinc-800/90 text-zinc-300 border-zinc-700/60'
                            : isActive
                            ? 'bg-teal-100 text-teal-800 border-teal-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[22px]">
                          {project.repo_url ? 'terminal' : 'folder'}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2
                            onClick={() => void handleActivateProject(project)}
                            className={`text-sm font-bold cursor-pointer truncate m-0 transition-colors ${
                              isDarkMode
                                ? 'text-white hover:text-teal-400'
                                : 'text-slate-900 hover:text-teal-700'
                            }`}
                          >
                            {safeRender(project.name)}
                          </h2>

                          {/* Status Badge */}
                          {project.status === 'example' ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                isDarkMode
                                  ? 'bg-zinc-800 text-zinc-400 border-zinc-700/50'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              Example project
                            </span>
                          ) : isActive ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              Active Workspace
                            </span>
                          ) : null}

                          <span
                            className={`text-xs ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}
                          >
                            {formatDate(project.updated_at || project.created_at)}
                          </span>
                        </div>

                        {/* Description */}
                        {project.description && (
                          <p
                            className={`text-xs line-clamp-1 leading-relaxed m-0 ${
                              isDarkMode ? 'text-zinc-400' : 'text-slate-600'
                            }`}
                          >
                            {safeRender(project.description)}
                          </p>
                        )}

                        {/* Channels & Repo Connection Chips */}
                        <div className="flex items-center gap-1.5 pt-1 flex-wrap text-[11px]">
                          {project.repo_url && (
                            <a
                              href={project.repo_url}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border transition-colors ${
                                isDarkMode
                                  ? 'bg-zinc-800/80 text-zinc-300 hover:text-white border-zinc-700/60'
                                  : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 border-slate-200'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[13px]">code</span>
                              <span className="truncate max-w-[200px]">
                                {project.repo_url.replace('https://github.com/', '')}
                              </span>
                            </a>
                          )}

                          {/* Connected Social & Slack Channels */}
                          {project.social_channels && project.social_channels.length > 0 ? (
                            project.social_channels.map(ch => (
                              <button
                                key={`${ch.platform}-${ch.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleOpenChannelManager(project);
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-transform hover:scale-105 ${
                                  ch.platform === 'slack'
                                    ? isDarkMode
                                      ? 'bg-purple-950/50 text-purple-200 border-purple-800/60 hover:border-purple-600'
                                      : 'bg-purple-50 text-purple-800 border-purple-200 hover:border-purple-400'
                                    : ch.platform === 'discord'
                                    ? isDarkMode
                                      ? 'bg-indigo-950/50 text-indigo-200 border-indigo-800/60'
                                      : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                    : isDarkMode
                                    ? 'bg-sky-950/50 text-sky-200 border-sky-800/60'
                                    : 'bg-sky-50 text-sky-800 border-sky-200'
                                }`}
                                title={`${ch.purpose || 'Kênh hội thoại'} (Bấm để quản lý hoặc Test Ping)`}
                              >
                                <span className="material-symbols-outlined text-[13px]">
                                  {ch.platform === 'slack' ? 'forum' : ch.platform === 'discord' ? 'sports_esports' : 'send'}
                                </span>
                                <span>#{ch.name}</span>
                                {ch.is_primary && (
                                  <span className="text-[9px] bg-purple-200 text-purple-900 px-1 rounded-xs font-bold uppercase tracking-wider">
                                    Primary
                                  </span>
                                )}
                              </button>
                            ))
                          ) : project.slack_channel ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              <span className="material-symbols-outlined text-[13px]">forum</span>
                              Slack: {project.slack_channel}
                            </span>
                          ) : null}

                          {/* Quick Add / Manage Channels Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleOpenChannelManager(project);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-colors ${
                              isDarkMode
                                ? 'border-purple-800/60 bg-purple-950/40 text-purple-300 hover:bg-purple-900/60 hover:text-white'
                                : 'border-purple-300 bg-purple-100/70 text-purple-900 hover:bg-purple-200 shadow-2xs'
                            }`}
                            title="Quản lý và thêm kênh Slack cho dự án này"
                          >
                            <span className="material-symbols-outlined text-[13px]">add_comment</span>
                            <span>+ Kênh Slack</span>
                          </button>

                          {project.clickup_list_id && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 border border-pink-200">
                              <span className="material-symbols-outlined text-[13px]">task_alt</span>
                              ClickUp List: {project.clickup_list_id}
                            </span>
                          )}

                          {project.local_path && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[10px] ${
                                isDarkMode
                                  ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/40'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {project.local_path}
                            </span>
                          )}
                        </div>

                        {/* AI Instruction Isolation Note */}
                        {project.ai_instructions && (
                          <div
                            className={`mt-1.5 text-[11px] italic px-2.5 py-1.5 rounded-lg border ${
                              isDarkMode
                                ? 'bg-zinc-950/50 text-zinc-400 border-zinc-800/80'
                                : 'bg-slate-50/90 text-slate-600 border-slate-200/80'
                            }`}
                          >
                            <span
                              className={`font-semibold not-italic ${
                                isDarkMode ? 'text-zinc-300' : 'text-slate-800'
                              }`}
                            >
                              Chỉ dẫn Agent riêng:
                            </span>{' '}
                            {safeRender(project.ai_instructions)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleActivateProject(project)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-2xs ${
                          isActive
                            ? 'bg-teal-700 text-white hover:bg-teal-800'
                            : isDarkMode
                            ? 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700'
                            : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {isActive ? 'check' : 'login'}
                        </span>
                        {isActive ? 'Đang làm việc' : 'Mở Project'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleStartProjectChat(project)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer ${
                          isDarkMode
                            ? 'bg-purple-900/60 text-purple-200 hover:bg-purple-800'
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                        }`}
                        title="Vào phiên chat riêng của dự án này (Khởi tạo phiên sạch, không dùng chat mẫu)"
                      >
                        <span className="material-symbols-outlined text-[15px]">chat</span>
                        <span>Chat Dự Án</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleOpenChannelManager(project)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDarkMode
                            ? 'text-purple-400 hover:text-white hover:bg-zinc-800'
                            : 'text-purple-700 hover:text-purple-900 hover:bg-purple-100'
                        }`}
                        title="Quản lý và kết nối kênh Slack & Social"
                      >
                        <span className="material-symbols-outlined text-[18px]">forum</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(project)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDarkMode
                            ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                        title="Cấu hình kênh social & repository"
                      >
                        <span className="material-symbols-outlined text-[18px]">settings</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteProject(project.id, project.name)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDarkMode
                            ? 'text-zinc-500 hover:text-rose-400 hover:bg-zinc-800'
                            : 'text-slate-400 hover:text-rose-700 hover:bg-rose-50'
                        }`}
                        title="Xóa project"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal: Create or Edit Project */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div
            className={`w-full max-w-xl rounded-2xl border shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto ${
              isDarkMode
                ? 'bg-zinc-900 border-zinc-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div
              className={`flex items-center justify-between border-b pb-3 ${
                isDarkMode ? 'border-zinc-800' : 'border-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-bold">
                <span className="material-symbols-outlined text-teal-600">
                  {editingProject ? 'settings' : 'create_new_folder'}
                </span>
                {editingProject ? 'Cấu hình Project & Kênh Social' : 'Thêm Project Mới (Như GitHub / Claude)'}
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={isDarkMode ? 'text-zinc-400 hover:text-white' : 'text-slate-400 hover:text-slate-600'}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              {/* Project Name */}
              <div>
                <label
                  className={`block text-xs font-semibold mb-1 ${
                    isDarkMode ? 'text-zinc-300' : 'text-slate-700'
                  }`}
                >
                  Tên Project *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Cách sử dụng Claude, Thư viện số & Đặt trước sách"
                  className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                    isDarkMode
                      ? 'border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:border-teal-500'
                      : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-teal-600'
                  }`}
                />
              </div>

              {/* Description */}
              <div>
                <label
                  className={`block text-xs font-semibold mb-1 ${
                    isDarkMode ? 'text-zinc-300' : 'text-slate-700'
                  }`}
                >
                  Mô tả phạm vi & Mục tiêu
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="e.g. Quản lý luồng đặt sách thư viện và email thông báo 48h..."
                  className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                    isDarkMode
                      ? 'border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:border-teal-500'
                      : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-teal-600'
                  }`}
                />
              </div>

              {/* GitHub Repo URL */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    className={`block text-xs font-semibold mb-1 ${
                      isDarkMode ? 'text-zinc-300' : 'text-slate-700'
                    }`}
                  >
                    GitHub Repository URL
                  </label>
                  <input
                    type="url"
                    value={formRepo}
                    onChange={e => setFormRepo(e.target.value)}
                    placeholder="https://github.com/my-org/my-project"
                    className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                      isDarkMode
                        ? 'border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:border-teal-500'
                        : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-teal-600'
                    }`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-xs font-semibold mb-1 ${
                      isDarkMode ? 'text-zinc-300' : 'text-slate-700'
                    }`}
                  >
                    Branch
                  </label>
                  <input
                    type="text"
                    value={formBranch}
                    onChange={e => setFormBranch(e.target.value)}
                    placeholder="main"
                    className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                      isDarkMode
                        ? 'border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:border-teal-500'
                        : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-teal-600'
                    }`}
                  />
                </div>
              </div>

              {/* Local Folder / Terminal Path */}
              <div>
                <label
                  className={`block text-xs font-semibold mb-1 ${
                    isDarkMode ? 'text-zinc-300' : 'text-slate-700'
                  }`}
                >
                  Thư mục làm việc máy cục bộ (Terminal Path)
                </label>
                <input
                  type="text"
                  value={formLocalPath}
                  onChange={e => setFormLocalPath(e.target.value)}
                  placeholder="D:/Hackathon/AITinker"
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-hidden ${
                    isDarkMode
                      ? 'border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:border-teal-500'
                      : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-teal-600'
                  }`}
                />
              </div>

              {/* Social Channels Integration */}
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t ${
                  isDarkMode ? 'border-zinc-800' : 'border-slate-100'
                }`}
              >
                <div>
                  <label className="block text-xs font-semibold text-purple-700 mb-1">
                    Kênh Slack liên kết
                  </label>
                  <input
                    type="text"
                    value={formSlack}
                    onChange={e => setFormSlack(e.target.value)}
                    placeholder="#all-ai4l-aio hoặc Channel ID"
                    className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                      isDarkMode
                        ? 'border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:border-purple-500'
                        : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-purple-600'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-pink-700 mb-1">
                    ClickUp List ID
                  </label>
                  <input
                    type="text"
                    value={formClickUp}
                    onChange={e => setFormClickUp(e.target.value)}
                    placeholder="901202868154"
                    className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                      isDarkMode
                        ? 'border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:border-pink-500'
                        : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-pink-600'
                    }`}
                  />
                </div>
              </div>

              {/* AI Agent Instructions Isolation */}
              <div>
                <label className="block text-xs font-semibold text-teal-800 mb-1">
                  Chỉ dẫn riêng cho AI Agent (Tránh nhầm lẫn ngữ cảnh giữa các Project)
                </label>
                <textarea
                  rows={3}
                  value={formAiInstructions}
                  onChange={e => setFormAiInstructions(e.target.value)}
                  placeholder="Chỉ dẫn kiến trúc, phạm vi module, hoặc thuật ngữ đặc thù của riêng project này..."
                  className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                    isDarkMode
                      ? 'border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 focus:border-teal-500'
                      : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-teal-600'
                  }`}
                />
              </div>

              {/* Status */}
              <div>
                <label
                  className={`block text-xs font-semibold mb-1 ${
                    isDarkMode ? 'text-zinc-300' : 'text-slate-700'
                  }`}
                >
                  Trạng thái
                </label>
                <select
                  value={formStatus}
                  onChange={e => setFormStatus(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                    isDarkMode
                      ? 'border-zinc-700 bg-zinc-800 text-white focus:border-teal-500'
                      : 'border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:border-teal-600'
                  }`}
                >
                  <option value="active">Active (Đang phát triển)</option>
                  <option value="example">Example project (Dự án mẫu)</option>
                  <option value="archived">Archived (Lưu trữ)</option>
                </select>
              </div>

              {/* Actions */}
              <div
                className={`flex items-center justify-end gap-2 pt-3 border-t ${
                  isDarkMode ? 'border-zinc-800' : 'border-slate-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg ${
                    isDarkMode ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60 shadow-xs"
                >
                  <span className={`material-symbols-outlined text-[16px] ${saving ? 'animate-spin' : ''}`}>
                    {saving ? 'progress_activity' : 'save'}
                  </span>
                  {saving ? 'Đang lưu…' : editingProject ? 'Lưu thay đổi' : 'Tạo Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quản lý Kênh Slack & Social */}
      {channelModalProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div
            className={`w-full max-w-2xl rounded-2xl border shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto ${
              isDarkMode
                ? 'bg-zinc-900 border-zinc-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`flex items-start justify-between border-b pb-3.5 ${
                isDarkMode ? 'border-zinc-800' : 'border-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    isDarkMode ? 'bg-purple-950/80 text-purple-300' : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">forum</span>
                </div>
                <div>
                  <h3 className="text-base font-bold m-0 flex items-center gap-2">
                    <span>Quản lý Kênh Slack & Social</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-mono font-medium">
                      {channelModalProject.name}
                    </span>
                  </h3>
                  <p
                    className={`text-xs mt-0.5 m-0 ${
                      isDarkMode ? 'text-zinc-400' : 'text-slate-500'
                    }`}
                  >
                    Gắn các kênh Slack/Discord vào dự án để AI tự động lọc hội thoại và gom task riêng biệt.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChannelModalProject(null)}
                className={`p-1 rounded-lg ${
                  isDarkMode ? 'text-zinc-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Ping Feedback Notice */}
            {pingStatus && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between border transition-all ${
                  pingStatus.loading
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : pingStatus.success
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[18px] ${pingStatus.loading ? 'animate-spin' : ''}`}>
                    {pingStatus.loading ? 'progress_activity' : pingStatus.success ? 'check_circle' : 'error'}
                  </span>
                  <span className="font-medium">{pingStatus.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPingStatus(null)}
                  className="text-xs opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            )}

            {/* List of Connected Channels */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Kênh đang kết nối ({channelModalProject.social_channels?.length || 0})
                </span>
                <span className="text-[11px] text-slate-400">
                  Kênh chính (Primary) sẽ là nơi nhận báo cáo tóm tắt & tạo task
                </span>
              </div>

              {(!channelModalProject.social_channels || channelModalProject.social_channels.length === 0) ? (
                <div
                  className={`p-6 text-center rounded-xl border border-dashed text-xs ${
                    isDarkMode ? 'border-zinc-800 text-zinc-500' : 'border-slate-300 text-slate-500'
                  }`}
                >
                  Dự án này chưa kết nối kênh Slack nào. Hãy chọn một kênh bên dưới để bắt đầu!
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {channelModalProject.social_channels.map(channel => {
                    const isSlack = channel.platform === 'slack';
                    const isPingLoading = pingStatus?.channelId === channel.id && pingStatus.loading;
                    return (
                      <div
                        key={channel.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          channel.is_primary
                            ? isDarkMode
                              ? 'border-purple-600/70 bg-purple-950/30'
                              : 'border-purple-300 bg-purple-50/50'
                            : isDarkMode
                            ? 'border-zinc-800 bg-zinc-800/40'
                            : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              isSlack
                                ? 'bg-purple-100 text-purple-700'
                                : channel.platform === 'discord'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-sky-100 text-sky-700'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {isSlack ? 'forum' : channel.platform === 'discord' ? 'sports_esports' : 'send'}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold">#{channel.name}</span>
                              <span className="text-[10px] font-mono opacity-60">({channel.id})</span>
                              {channel.is_primary ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                                  ⭐ Kênh chính
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleSetPrimary(channel.id, channel.platform)}
                                  className="text-[10px] font-medium text-slate-500 hover:text-purple-600 underline"
                                >
                                  Đặt làm kênh chính
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate m-0">
                              {channel.purpose || 'Kênh thảo luận & trích xuất task'}
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isSlack && (
                            <button
                              type="button"
                              onClick={() => void handleTestPing(channel)}
                              disabled={isPingLoading}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 ${
                                isDarkMode
                                  ? 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-2xs'
                              }`}
                              title="Gửi tin nhắn test lên Slack để xác nhận bot đang hoạt động"
                            >
                              <span className={`material-symbols-outlined text-[14px] ${isPingLoading ? 'animate-spin text-purple-500' : 'text-purple-600'}`}>
                                {isPingLoading ? 'progress_activity' : 'send'}
                              </span>
                              <span>{isPingLoading ? 'Đang gửi...' : 'Test Ping'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleRemoveChannel(channel.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Gỡ kênh khỏi project"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Connect Mode Switcher */}
            <div className="flex items-center gap-2 border-b pb-2 border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setChannelConnectMode('link')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  channelConnectMode === 'link'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : isDarkMode
                    ? 'text-zinc-400 hover:text-white bg-zinc-800'
                    : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">link</span>
                <span>Dán Link Slack (Khuyên dùng - Nhanh nhất)</span>
              </button>

              <button
                type="button"
                onClick={() => setChannelConnectMode('workspace')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  channelConnectMode === 'workspace'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : isDarkMode
                    ? 'text-zinc-400 hover:text-white bg-zinc-800'
                    : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">tune</span>
                <span>Chọn Kênh Workspace / Khác</span>
              </button>
            </div>

            {channelConnectMode === 'link' ? (
              <form
                onSubmit={handleModalBringAi}
                className={`p-4 rounded-xl border space-y-3.5 ${
                  isDarkMode ? 'border-purple-900/60 bg-purple-950/20' : 'border-purple-200 bg-purple-50/50'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-purple-600">bolt</span>
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                      Đưa AI vào kênh qua Link (Tự động kết nối dự án)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalSlackUrl('https://ai4l-aio.slack.com/archives/C0CFE9GL4AK/p1795162883105679')}
                    className="text-[11px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 font-medium hover:opacity-80 cursor-pointer"
                  >
                    💡 Dán link mẫu thực tế
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Link Kênh hoặc Thread Slack:
                  </label>
                  <input
                    type="url"
                    required
                    value={modalSlackUrl}
                    onChange={e => setModalSlackUrl(e.target.value)}
                    placeholder="https://ai4l-aio.slack.com/archives/C0CFE9GL4AK/p1795162883..."
                    className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                      isDarkMode
                        ? 'border-zinc-700 bg-zinc-800 text-white focus:border-purple-500'
                        : 'border-slate-300 bg-white text-slate-900 focus:border-purple-600'
                    }`}
                  />
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 m-0">
                    ScribeBA AI sẽ tự động đọc tin nhắn, gửi lời chào vào Slack và gắn kênh này vào dự án <strong>{channelModalProject.name}</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-wrap text-xs">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalPostAnnouncement}
                      onChange={e => setModalPostAnnouncement(e.target.checked)}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-slate-700 dark:text-zinc-300">Gửi tin nhắn chào mừng AI vào Slack</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalAutoAnalyze}
                      onChange={e => setModalAutoAnalyze(e.target.checked)}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-slate-700 dark:text-zinc-300">Tự động phân tích & tạo task</span>
                  </label>
                </div>

                {modalBringAiFeedback && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
                      modalBringAiFeedback.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-rose-50 text-rose-900 border-rose-200'
                    }`}
                  >
                    <span>{modalBringAiFeedback.message}</span>
                    <button
                      type="button"
                      onClick={() => setModalBringAiFeedback(null)}
                      className="text-xs opacity-70 hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={modalBringingAi || !modalSlackUrl.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 shadow-xs cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${modalBringingAi ? 'animate-spin' : ''}`}>
                      {modalBringingAi ? 'progress_activity' : 'rocket_launch'}
                    </span>
                    {modalBringingAi ? 'Đang đưa AI vào...' : '🚀 Đưa AI Vào Kênh & Kết Nối Ngay'}
                  </button>
                </div>
              </form>
            ) : (
            /* Form: Add New Channel */
            <form
              onSubmit={handleAddChannelToProject}
              className={`p-4 rounded-xl border space-y-3.5 ${
                isDarkMode ? 'border-zinc-800 bg-zinc-800/20' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Kết Nối Thêm Kênh Mới
                </span>

                {/* Platform tabs */}
                <div className="flex items-center gap-1 bg-slate-200 dark:bg-zinc-800 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setNewChanPlatform('slack')}
                    className={`px-2 py-0.5 rounded-md font-semibold text-[11px] transition-colors ${
                      newChanPlatform === 'slack'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                    }`}
                  >
                    Slack
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChanPlatform('discord')}
                    className={`px-2 py-0.5 rounded-md font-semibold text-[11px] transition-colors ${
                      newChanPlatform === 'discord'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                    }`}
                  >
                    Discord
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChanPlatform('telegram')}
                    className={`px-2 py-0.5 rounded-md font-semibold text-[11px] transition-colors ${
                      newChanPlatform === 'telegram'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                    }`}
                  >
                    Telegram
                  </button>
                </div>
              </div>

              {newChanPlatform === 'slack' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Chọn kênh Slack từ Workspace:
                  </label>
                  {loadingSlackChannels ? (
                    <div className="text-xs flex items-center gap-2 text-slate-500 py-1">
                      <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                      Đang quét danh sách kênh từ Slack...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={selectedSlackChannelId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedSlackChannelId(val);
                          if (val !== '__custom__') {
                            const found = availableSlackChannels.find(c => c.id === val);
                            if (found) setCustomChannelName(found.name);
                          }
                        }}
                        className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                          isDarkMode
                            ? 'border-zinc-700 bg-zinc-800 text-white focus:border-purple-500'
                            : 'border-slate-300 bg-white text-slate-900 focus:border-purple-600'
                        }`}
                      >
                        {availableSlackChannels.map(ch => (
                          <option key={ch.id} value={ch.id}>
                            #{ch.name} ({ch.id}) {ch.is_member ? '✓ Bot đã tham gia' : ''}
                          </option>
                        ))}
                        <option value="__custom__">➕ Nhập ID kênh Slack khác...</option>
                      </select>

                      {selectedSlackChannelId === '__custom__' && (
                        <input
                          type="text"
                          required
                          value={customChannelId}
                          onChange={(e) => setCustomChannelId(e.target.value)}
                          placeholder="Mã Channel ID (e.g. C0123456789)"
                          className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                            isDarkMode
                              ? 'border-zinc-700 bg-zinc-800 text-white focus:border-purple-500'
                              : 'border-slate-300 bg-white text-slate-900 focus:border-purple-600'
                          }`}
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-zinc-300">
                      Tên Kênh ({newChanPlatform.toUpperCase()})
                    </label>
                    <input
                      type="text"
                      required
                      value={customChannelName}
                      onChange={(e) => setCustomChannelName(e.target.value)}
                      placeholder={newChanPlatform === 'discord' ? '#dev-general' : '@dev_alert_group'}
                      className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                        isDarkMode
                          ? 'border-zinc-700 bg-zinc-800 text-white focus:border-teal-500'
                          : 'border-slate-300 bg-white text-slate-900 focus:border-teal-600'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-zinc-300">
                      Channel ID hoặc Webhook URL
                    </label>
                    <input
                      type="text"
                      required
                      value={customChannelId}
                      onChange={(e) => setCustomChannelId(e.target.value)}
                      placeholder={newChanPlatform === 'discord' ? 'discord-webhook-id' : 'tg-chat-id-12345'}
                      className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                        isDarkMode
                          ? 'border-zinc-700 bg-zinc-800 text-white focus:border-teal-500'
                          : 'border-slate-300 bg-white text-slate-900 focus:border-teal-600'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Purpose & Suggestion Chips */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Mục đích sử dụng của kênh này:
                </label>
                <input
                  type="text"
                  value={newChanPurpose}
                  onChange={(e) => setNewChanPurpose(e.target.value)}
                  placeholder="e.g. Hội thoại kỹ thuật, Báo cáo Blocker, Kênh QA..."
                  className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-hidden ${
                    isDarkMode
                      ? 'border-zinc-700 bg-zinc-800 text-white focus:border-teal-500'
                      : 'border-slate-300 bg-white text-slate-900 focus:border-teal-600'
                  }`}
                />
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400">Gợi ý nhanh:</span>
                  {[
                    'Hội thoại kỹ thuật & Task extraction',
                    'Báo cáo Bug & Blocker',
                    'Thông báo Release & Triển khai',
                    'Trao đổi chung & Ý tưởng mới',
                  ].map(suggest => (
                    <button
                      key={suggest}
                      type="button"
                      onClick={() => setNewChanPurpose(suggest)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        isDarkMode
                          ? 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {suggest}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary checkbox */}
              <label className="flex items-center gap-2 cursor-pointer text-xs pt-1">
                <input
                  type="checkbox"
                  checked={newChanIsPrimary}
                  onChange={(e) => setNewChanIsPrimary(e.target.checked)}
                  className="rounded-sm border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="font-medium text-slate-700 dark:text-zinc-300">
                  Đặt kênh này làm kênh chính (Primary) của project này
                </span>
              </label>

              {/* Submit Add Channel */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={addingChannel}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-60 shadow-xs cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[16px] ${addingChannel ? 'animate-spin' : ''}`}>
                    {addingChannel ? 'progress_activity' : 'add_link'}
                  </span>
                  {addingChannel ? 'Đang kết nối...' : '+ Kết nối kênh vào Project'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
