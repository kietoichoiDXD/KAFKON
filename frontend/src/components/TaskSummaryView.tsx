import React, { useEffect, useState, useMemo } from 'react';
import { API, safeFetchJson, safeRender } from '../api';

export interface PrioritizedTask {
  id: string;
  name: string;
  description?: string;
  url?: string;
  status?: string;
  priority?: string;
  priority_tier: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  importance_score: number;
  miss_risk: string;
  risk_reason: string;
  action_needed: string;
  is_blocked?: boolean;
  is_mvp_core?: boolean;
  is_unassigned?: boolean;
  assignees?: string[];
  tags?: string[];
}

interface PrioritizedResponse {
  task_count: number;
  high_priority_count: number;
  blocked_count: number;
  at_risk_count: number;
  status_counts: Record<string, number>;
  tasks: PrioritizedTask[];
}

export const TaskSummaryView: React.FC = () => {
  const [data, setData] = useState<PrioritizedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'high' | 'blocked' | 'risk' | 'active'>('high');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  
  // Slack notification modal & status
  const [slackBusy, setSlackBusy] = useState(false);
  const [slackNote, setSlackNote] = useState('');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New ClickUp task modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'urgent' | 'high' | 'normal'>('high');
  const [createBusy, setCreateBusy] = useState(false);

  // Executive AI summary
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const loadPrioritizedTasks = async () => {
    setLoading(true);
    setError('');
    const res = await safeFetchJson<PrioritizedResponse>(`${API}/api/clickup/tasks/prioritized`);
    if (!res.ok || !res.data) {
      setError(res.error || 'Could not load prioritized tasks from ClickUp.');
    } else {
      setData(res.data);
      // Auto-select urgent or top 2 tasks if none selected
      const urgentOrHigh = (res.data.tasks || []).filter(t => t.priority_tier === 'URGENT' || t.importance_score >= 85);
      if (urgentOrHigh.length > 0) {
        setSelectedTaskIds(new Set(urgentOrHigh.slice(0, 3).map(t => t.id)));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadPrioritizedTasks();
  }, []);

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    const res = await safeFetchJson<{ summary: string }>(`${API}/api/clickup/tasks/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok && res.data?.summary) {
      setAiSummary(res.data.summary);
    }
    setSummaryLoading(false);
  };

  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = (visibleTasks: PrioritizedTask[]) => {
    const visibleIds = visibleTasks.map(t => t.id);
    const allSelected = visibleIds.every(id => selectedTaskIds.has(id));
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Dispatch selected tasks to Slack
  const handleNotifySlack = async (customTasks?: PrioritizedTask[]) => {
    const tasksToSend = customTasks || (data?.tasks || []).filter(t => selectedTaskIds.has(t.id));
    if (tasksToSend.length === 0) {
      setToastMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 nhiệm vụ để thông báo lên Slack!' });
      return;
    }

    setSlackBusy(true);
    setToastMessage(null);
    const res = await safeFetchJson<{ message: string; channel: string }>(`${API}/api/clickup/tasks/notify-slack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: tasksToSend,
        channel: 'C0CFE9GL4AK',
        note: slackNote || 'Phát hiện nhiệm vụ cốt lõi / nguy cơ bỏ sót cần giải quyết gấp.',
      }),
    });

    if (res.ok && res.data) {
      setToastMessage({ type: 'success', text: res.data.message || 'Đã gửi cảnh báo lên Slack thành công!' });
      setSlackNote('');
    } else {
      setToastMessage({ type: 'error', text: res.error || 'Không thể gửi tin nhắn lên Slack. Kiểm tra quyền channel.' });
    }
    setSlackBusy(false);
  };

  // Create new task directly to ClickUp
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    setCreateBusy(true);
    const res = await safeFetchJson<{ message: string; task: any }>(`${API}/api/clickup/tasks/create-or-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTaskName.trim(),
        description: newTaskDesc.trim(),
        priority: newTaskPriority,
        tags: ['agent-prioritized', 'high-priority'],
      }),
    });

    if (res.ok && res.data) {
      setToastMessage({ type: 'success', text: res.data.message || 'Đã thêm task vào ClickUp thành công!' });
      setIsCreateModalOpen(false);
      setNewTaskName('');
      setNewTaskDesc('');
      void loadPrioritizedTasks();
    } else {
      setToastMessage({ type: 'error', text: res.error || 'Lỗi khi tạo task trên ClickUp.' });
    }
    setCreateBusy(false);
  };

  // Filter tasks based on active tab and search query
  const filteredTasks = useMemo(() => {
    if (!data?.tasks) return [];
    let list = data.tasks;

    if (filterTab === 'high') {
      list = list.filter(t => t.priority_tier === 'URGENT' || t.priority_tier === 'HIGH' || t.importance_score >= 75);
    } else if (filterTab === 'blocked') {
      list = list.filter(t => t.is_blocked || (t.status || '').toLowerCase().includes('block'));
    } else if (filterTab === 'risk') {
      list = list.filter(t => t.miss_risk !== 'NORMAL' && t.miss_risk !== 'COMPLETED');
    } else if (filterTab === 'active') {
      list = list.filter(t => !['done', 'complete', 'closed'].includes((t.status || '').toLowerCase()));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.risk_reason || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, filterTab, searchQuery]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-900">
      {/* Top Banner / Toast Notification */}
      {toastMessage && (
        <div
          role="alert"
          className={`shrink-0 px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {toastMessage.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-0.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-teal-800">
              <span className="material-symbols-outlined text-base">task_alt</span>
              Agentic Task Prioritizer & Dispatch
            </div>
            <h1 className="m-0 text-2xl font-bold tracking-tight text-slate-900">
              Phát hiện & Quản lý Task Quan Trọng
            </h1>
            <p className="mb-0 mt-1 text-xs text-slate-600">
              Tự động phân hạng mức độ ưu tiên, cảnh báo nguy cơ bị bỏ sót (Miss Risk) và điều phối sang ClickUp & Slack.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-xs hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-base text-teal-700">add_task</span>
              Thêm task vào ClickUp
            </button>

            <button
              type="button"
              onClick={() => void loadPrioritizedTasks()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
              title="Làm mới danh sách task"
            >
              <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              Làm mới
            </button>

            <button
              type="button"
              onClick={() => void handleGenerateSummary()}
              disabled={summaryLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-800 disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-base ${summaryLoading ? 'animate-spin' : ''}`}>
                {summaryLoading ? 'progress_activity' : 'smart_toy'}
              </span>
              {summaryLoading ? 'AI đang tóm tắt…' : 'AI Tóm tắt Backlog'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain p-5 lg:p-6">
        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <strong className="font-bold">Không thể tải danh sách nhiệm vụ:</strong> {error}
          </div>
        )}

        {/* Backlog Metrics Dashboard */}
        {data && (
          <section aria-label="Backlog health metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Tổng số nhiệm vụ"
              value={data.task_count}
              icon="format_list_bulleted"
              color="text-slate-800"
              bg="bg-slate-100"
            />
            <MetricCard
              label="🔥 Task Quan Trọng Cần Làm"
              value={data.high_priority_count}
              icon="local_fire_department"
              color="text-amber-700"
              bg="bg-amber-50"
              alert={data.high_priority_count > 0}
            />
            <MetricCard
              label="🚨 Đang Bị Chặn (Blocker)"
              value={data.blocked_count}
              icon="block"
              color="text-rose-700"
              bg="bg-rose-50"
              alert={data.blocked_count > 0}
            />
            <MetricCard
              label="⚠️ Nguy Cơ Bỏ Sót (At Risk)"
              value={data.at_risk_count}
              icon="notification_important"
              color="text-purple-700"
              bg="bg-purple-50"
              alert={data.at_risk_count > 0}
            />
          </section>
        )}

        {/* AI Executive Summary Block (if generated) */}
        {aiSummary && (
          <ExecutiveSummaryCard
            summary={aiSummary}
            onClose={() => setAiSummary(null)}
          />
        )}

        {/* Controls: Filter Pills, Search Bar, and Batch Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterTabButton
              active={filterTab === 'high'}
              onClick={() => setFilterTab('high')}
              icon="local_fire_department"
              label="🔥 Task Quan Trọng"
              count={data?.high_priority_count}
            />
            <FilterTabButton
              active={filterTab === 'risk'}
              onClick={() => setFilterTab('risk')}
              icon="notification_important"
              label="⚠️ Nguy Cơ Bỏ Sót"
              count={data?.at_risk_count}
            />
            <FilterTabButton
              active={filterTab === 'blocked'}
              onClick={() => setFilterTab('blocked')}
              icon="block"
              label="🚨 Bị Chặn"
              count={data?.blocked_count}
            />
            <FilterTabButton
              active={filterTab === 'active'}
              onClick={() => setFilterTab('active')}
              icon="pending_actions"
              label="⏳ Chưa Hoàn Thành"
            />
            <FilterTabButton
              active={filterTab === 'all'}
              onClick={() => setFilterTab('all')}
              icon="view_list"
              label="Tất cả"
              count={data?.task_count}
            />
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm task, mô tả..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-600 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>

        {/* Bulk Action Bar (when tasks are selected) */}
        {selectedTaskIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-2.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-900">
              <span className="material-symbols-outlined text-[18px]">check_box</span>
              Đã chọn <span className="font-bold underline">{selectedTaskIds.size}</span> nhiệm vụ quan trọng
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedTaskIds(new Set())}
                className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1"
              >
                Bỏ chọn
              </button>

              <button
                type="button"
                onClick={() => void handleNotifySlack()}
                disabled={slackBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-900 disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-[16px] ${slackBusy ? 'animate-spin' : ''}`}>
                  {slackBusy ? 'progress_activity' : 'campaign'}
                </span>
                {slackBusy ? 'Đang gửi Slack…' : 'Gửi cảnh báo lên Slack (#all-ai4l-aio)'}
              </button>
            </div>
          </div>
        )}

        {/* Task List Table */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden flex-1 min-h-[300px] flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                aria-label="Chọn tất cả các task đang hiển thị"
                checked={filteredTasks.length > 0 && filteredTasks.every(t => selectedTaskIds.has(t.id))}
                onChange={() => toggleSelectAllVisible(filteredTasks)}
                className="rounded text-teal-700 focus:ring-teal-500 h-4 w-4"
              />
              <span>Tên nhiệm vụ & Nguy cơ bỏ sót</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="w-24 text-center">Độ quan trọng</span>
              <span className="w-24 text-center">Trạng thái</span>
              <span className="w-24 text-right">Thao tác</span>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center p-12 text-xs text-slate-500 gap-2">
              <span className="material-symbols-outlined animate-spin text-teal-600 text-xl">progress_activity</span>
              Đang tải danh sách nhiệm vụ từ ClickUp & Database…
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
              <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">task</span>
              <p className="text-xs text-slate-500 m-0">Không tìm thấy nhiệm vụ nào phù hợp với bộ lọc.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto">
              {filteredTasks.map(task => {
                const isSelected = selectedTaskIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    className={`flex items-start justify-between gap-4 p-4 transition-colors ${
                      isSelected ? 'bg-teal-50/40' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Left: Checkbox + Title + Risk Reason + Action Needed */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectTask(task.id)}
                        className="mt-1 rounded text-teal-700 focus:ring-teal-500 h-4 w-4"
                      />

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Priority Tier Badge */}
                          <PriorityBadge tier={task.priority_tier} />

                          {/* Miss Risk Badge */}
                          {task.miss_risk === 'CRITICAL_BLOCKED' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              🚨 Blocker
                            </span>
                          )}
                          {task.miss_risk === 'UNASSIGNED_HIGH_PRIORITY' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              ⚠️ Chưa có Assignee
                            </span>
                          )}
                          {task.miss_risk === 'TIME_SENSITIVE' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              ⏱️ SLA 48h
                            </span>
                          )}

                          {/* Title with ClickUp Link */}
                          {task.url ? (
                            <a
                              href={task.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-slate-900 hover:text-teal-700 hover:underline truncate"
                            >
                              {safeRender(task.name)}
                            </a>
                          ) : (
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {safeRender(task.name)}
                            </span>
                          )}
                        </div>

                        {/* Risk Diagnosis */}
                        <div className="text-[11px] text-slate-600 leading-relaxed bg-slate-50/80 p-2 rounded-lg border border-slate-200/60">
                          <span className="font-semibold text-slate-800">Chẩn đoán:</span>{' '}
                          {safeRender(task.risk_reason)}
                        </div>

                        {/* Action Needed */}
                        <div className="text-[11px] text-teal-800 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">arrow_right_alt</span>
                          <span className="font-medium">Đề xuất:</span> {safeRender(task.action_needed)}
                        </div>
                      </div>
                    </div>

                    {/* Right: Score + Status + Action Buttons */}
                    <div className="flex items-center gap-6 shrink-0 pt-1">
                      {/* Importance Score Meter */}
                      <div className="w-24 text-center">
                        <div className="text-xs font-bold font-mono text-slate-800">
                          {task.importance_score}/100
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              task.importance_score >= 85
                                ? 'bg-rose-500'
                                : task.importance_score >= 70
                                ? 'bg-amber-500'
                                : 'bg-teal-500'
                            }`}
                            style={{ width: `${task.importance_score}%` }}
                          />
                        </div>
                      </div>

                      {/* Status */}
                      <div className="w-24 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-full">
                          {task.status || 'to do'}
                        </span>
                      </div>

                      {/* Quick Actions */}
                      <div className="w-24 text-right flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void handleNotifySlack([task])}
                          disabled={slackBusy}
                          className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Gửi riêng task này lên Slack"
                        >
                          <span className="material-symbols-outlined text-[16px]">campaign</span>
                        </button>

                        {task.url && (
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-md transition-colors"
                            title="Mở trong ClickUp"
                          >
                            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Modal: Create Task Directly in ClickUp */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <span className="material-symbols-outlined text-teal-700">add_task</span>
                Thêm Nhiệm Vụ Mới Vào ClickUp
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề nhiệm vụ *
                </label>
                <input
                  type="text"
                  required
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  placeholder="e.g. [MVP] Đặt trước sách: Cấu hình tự động gửi email sau 48h"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả chi tiết / Tiêu chí nghiệm thu
                </label>
                <textarea
                  rows={4}
                  value={newTaskDesc}
                  onChange={e => setNewTaskDesc(e.target.value)}
                  placeholder="Ghi chú chi tiết yêu cầu kỹ thuật, tiêu chí Given-When-Then, hoặc assignee..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mức độ ưu tiên
                </label>
                <select
                  value={newTaskPriority}
                  onChange={e => setNewTaskPriority(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-hidden"
                >
                  <option value="urgent">🔴 Khẩn cấp (Urgent - Blocker)</option>
                  <option value="high">🟠 Quan trọng cao (High - MVP Core)</option>
                  <option value="normal">🟡 Tiêu chuẩn (Normal)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-[16px] ${createBusy ? 'animate-spin' : ''}`}>
                    {createBusy ? 'progress_activity' : 'cloud_upload'}
                  </span>
                  {createBusy ? 'Đang tạo trên ClickUp…' : 'Tạo task trên ClickUp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function MetricCard({
  label,
  value,
  icon,
  color,
  bg,
  alert = false,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  bg: string;
  alert?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-slate-500 truncate">{label}</div>
        <strong className={`block text-xl font-bold tracking-tight ${alert ? color : 'text-slate-900'}`}>
          {value}
        </strong>
      </div>
    </div>
  );
}

function FilterTabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
        active
          ? 'bg-teal-700 text-white font-semibold shadow-2xs'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
      }`}
    >
      <span className="material-symbols-outlined text-[15px]">{icon}</span>
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold ${
            active ? 'bg-teal-900 text-teal-100' : 'bg-slate-200 text-slate-700'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function PriorityBadge({ tier }: { tier: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' }) {
  if (tier === 'URGENT') {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
        URGENT
      </span>
    );
  }
  if (tier === 'HIGH') {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
        HIGH
      </span>
    );
  }
  if (tier === 'NORMAL') {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
        NORMAL
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-100">
      LOW
    </span>
  );
}

function FormattedText({ text }: { text: string }) {
  // Parse bold **text** into <strong> tags, clean double asterisks
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <span>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          return (
            <strong key={index} className="font-bold text-slate-900">
              {part}
            </strong>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

function ProgressTaskItem({ line }: { line: string }) {
  const cleaned = line.replace(/^-\s*/, '').trim();
  if (!cleaned) return null;

  // Extract tags in [brackets]
  const tagMatches = Array.from(cleaned.matchAll(/\[(.*?)\]/g)).map(m => m[1]);

  // Extract duplication warning e.g. (2 bản ghi trùng lặp)
  const dupMatch = cleaned.match(/\((.*?trùng lặp.*?)\)/i);
  const dupNote = dupMatch ? dupMatch[1] : null;

  // Clean title
  let title = cleaned.replace(/\[.*?\]/g, '');
  if (dupNote) {
    title = title.replace(/\(.*?\)/g, '');
  }
  title = title.trim();

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-indigo-100 bg-white/90 p-2.5 shadow-2xs transition-all hover:border-indigo-300">
      <span className="material-symbols-outlined text-[15px] text-indigo-600 mt-0.5 shrink-0">
        radio_button_checked
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {tagMatches.map((tag, idx) => {
            const isProgress = tag.toLowerCase().includes('progress');
            const isMVP = tag.toLowerCase() === 'mvp';
            return (
              <span
                key={idx}
                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                  isProgress
                    ? 'bg-blue-100 text-blue-800 border-blue-200 uppercase tracking-wide'
                    : isMVP
                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {tag}
              </span>
            );
          })}

          {dupNote && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
              <span className="material-symbols-outlined text-[12px]">content_copy</span>
              {dupNote}
            </span>
          )}
        </div>
        <div className="text-xs font-medium text-slate-800 leading-snug">
          {title}
        </div>
      </div>
    </div>
  );
}

function SummarySectionBlock({
  section,
}: {
  section: {
    title: string;
    category: 'overview' | 'progress' | 'blockers' | 'recommendations' | 'other';
    body: string;
  };
}) {
  const { title, category, body } = section;

  if (category === 'overview') {
    return (
      <div className="rounded-xl border border-sky-200/90 bg-gradient-to-br from-white to-sky-50/50 p-4 space-y-2.5 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-800 border border-sky-200">
            <span className="material-symbols-outlined text-[16px]">pie_chart</span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-sky-950">{title}</span>
        </div>
        <div className="text-xs leading-relaxed text-slate-700">
          <FormattedText text={body} />
        </div>
      </div>
    );
  }

  if (category === 'progress') {
    const lines = body.split('\n').filter(l => l.trim().length > 0);
    return (
      <div className="rounded-xl border border-indigo-200/90 bg-gradient-to-br from-white to-indigo-50/40 p-4 space-y-2.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200">
            <span className="material-symbols-outlined text-[16px]">pending_actions</span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-950">{title}</span>
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <ProgressTaskItem key={i} line={line} />
          ))}
        </div>
      </div>
    );
  }

  if (category === 'blockers') {
    const isClean = body.toLowerCase().includes('không có task bị block') ||
                    body.toLowerCase().includes('không có blocker') ||
                    body.toLowerCase().includes('0 task');
    return (
      <div
        className={`rounded-xl border p-4 space-y-2.5 shadow-2xs ${
          isClean
            ? 'border-emerald-200/90 bg-gradient-to-br from-white to-emerald-50/40 text-emerald-950'
            : 'border-rose-200/90 bg-gradient-to-br from-white to-rose-50/50 text-rose-950'
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
              isClean ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isClean ? 'verified' : 'block'}
            </span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
        </div>
        <div className="text-xs leading-relaxed flex items-center gap-2">
          {isClean && (
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">
              check_circle
            </span>
          )}
          <span><FormattedText text={body} /></span>
        </div>
      </div>
    );
  }

  if (category === 'recommendations') {
    return (
      <div className="rounded-xl border border-teal-200/90 bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/30 p-4 space-y-2.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-800 border border-teal-200">
            <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-950">{title}</span>
        </div>
        <div className="text-xs leading-relaxed text-slate-800 font-normal">
          <FormattedText text={body} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px] text-teal-700">info</span>
        <span className="text-xs font-bold text-slate-900">{title}</span>
      </div>
      <div className="text-xs leading-relaxed text-slate-700">
        <FormattedText text={body} />
      </div>
    </div>
  );
}

function ExecutiveSummaryCard({
  summary,
  onClose,
}: {
  summary: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sections = useMemo(() => {
    const rawParts = summary.split(/\*\*(.+?):?\*\*/);
    const result: Array<{
      title: string;
      category: 'overview' | 'progress' | 'blockers' | 'recommendations' | 'other';
      body: string;
    }> = [];

    if (rawParts.length > 1) {
      for (let i = 1; i < rawParts.length; i += 2) {
        const title = (rawParts[i] || '').trim();
        const body = (rawParts[i + 1] || '').trim();
        const lower = title.toLowerCase();

        let category: 'overview' | 'progress' | 'blockers' | 'recommendations' | 'other' = 'other';
        if (lower.includes('tổng quan') || lower.includes('overview')) category = 'overview';
        else if (lower.includes('đang thực hiện') || lower.includes('in progress') || lower.includes('tiến độ')) category = 'progress';
        else if (lower.includes('blocker') || lower.includes('gỡ vướng') || lower.includes('chặn')) category = 'blockers';
        else if (lower.includes('đề xuất') || lower.includes('hành động') || lower.includes('action')) category = 'recommendations';

        result.push({ title, category, body });
      }
    }
    return result;
  }, [summary]);

  return (
    <section className="rounded-2xl border border-teal-200/90 bg-gradient-to-br from-white via-teal-50/20 to-slate-50 p-5 shadow-xs space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-teal-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-700 text-white shadow-2xs">
            <span className="material-symbols-outlined text-[18px]">smart_toy</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-950 m-0">
                AI Executive Backlog Summary
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Live Grounded
              </span>
            </div>
            <p className="text-[11px] text-slate-500 m-0">
              Báo cáo tổng hợp backlog thông minh được trích xuất từ dữ liệu thực tế trên ClickUp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
            title="Sao chép nội dung tóm tắt"
          >
            <span className="material-symbols-outlined text-[14px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? 'Đã chép!' : 'Sao chép'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50/70 px-2.5 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">expand_less</span>
            <span>Ẩn tóm tắt</span>
          </button>
        </div>
      </div>

      {/* Grid of Sections if parsed, or fallback formatted text */}
      {sections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {sections.map((sec, idx) => (
            <SummarySectionBlock key={idx} section={sec} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-800">
          <FormattedText text={summary} />
        </div>
      )}
    </section>
  );
}
