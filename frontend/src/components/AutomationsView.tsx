import React, { useState } from 'react';

type AutomationItem = {
  id: string;
  name: string;
  trigger: string;
  schedule: string;
  status: 'Active' | 'Paused';
  lastRun: string;
};

const DEFAULT_AUTOMATIONS: AutomationItem[] = [
  {
    id: 'auto-1',
    name: 'Daily Slack Agile Synthesis & Blocker Audit',
    trigger: 'Cron Schedule',
    schedule: 'Daily at 09:00 UTC',
    status: 'Active',
    lastRun: 'Today 09:00 UTC (Invest 94/100)',
  },
  {
    id: 'auto-2',
    name: 'Prometheus Telemetry & Kubernetes Drift Watcher',
    trigger: 'Webhook Alert',
    schedule: 'Continuous Polling (Every 60s)',
    status: 'Active',
    lastRun: '1 min ago (Nominal: 0.04% 5xx)',
  },
  {
    id: 'auto-3',
    name: 'ClickUp Two-Way Ticket Seal Re-verification',
    trigger: 'ClickUp Webhook',
    schedule: 'On Issue Status Mutation',
    status: 'Active',
    lastRun: '2 hours ago (SHA-256 Validated)',
  },
];

export const AutomationsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Automations' | 'Runs' | 'Calendar'>('Automations');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All states');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [automations, setAutomations] = useState<AutomationItem[]>(DEFAULT_AUTOMATIONS);
  const [newAutoName, setNewAutoName] = useState('');
  const [newTrigger, setNewTrigger] = useState('Cron Schedule');

  const handleCreate = () => {
    if (newAutoName.trim()) {
      setAutomations([
        ...automations,
        {
          id: `auto-${Date.now()}`,
          name: newAutoName.trim(),
          trigger: newTrigger,
          schedule: 'Hourly at :00',
          status: 'Active',
          lastRun: 'Pending initial trigger',
        },
      ]);
      setNewAutoName('');
      setIsCreateOpen(false);
    }
  };

  const filtered = automations.filter(a => {
    if (statusFilter !== 'All states' && a.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      return a.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const toggleStatus = (id: string) => {
    setAutomations(items => items.map(item => item.id === id
      ? { ...item, status: item.status === 'Active' ? 'Paused' : 'Active' }
      : item));
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <div className="px-8 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Automations
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Run ScribeBA agents autonomously on cron schedules, channel webhooks, or Kubernetes cluster events.
            </p>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New automation</span>
          </button>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center gap-2 mt-4">
          {(['Automations', 'Runs', 'Calendar'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={`px-2.5 py-2 border-b text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'text-slate-900 border-teal-500'
                  : 'text-slate-500 border-transparent hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Filters only apply to the automation inventory. */}
      {activeTab === 'Automations' && <div className="px-8 py-3 bg-white border-b border-slate-200 flex items-center gap-3 shrink-0">
        <div className="relative max-w-sm w-full">
          <span className="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search active pipelines..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus-ring"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 px-3 py-1.5 focus-ring"
        >
          <option>All states</option>
          <option>Active</option>
          <option>Paused</option>
        </select>
      </div>}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-[1440px] mx-auto w-full">
        {activeTab === 'Automations' && <div>
          {filtered.length === 0 && <p className="py-10 text-sm text-slate-400">No automations match these filters.</p>}
          {filtered.map(auto => (
            <div
              key={auto.id}
              className="py-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-100/40 transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{auto.name}</h4>
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                    <span>Trigger: {auto.trigger}</span>
                    <span>·</span>
                    <span>Schedule: {auto.schedule}</span>
                    <span>·</span>
                    <span className="text-slate-400">Last: {auto.lastRun}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded border ${auto.status === 'Active' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-slate-800 text-slate-300 border-slate-600'}`}>
                  {auto.status}
                </span>
                <button
                  onClick={() => toggleStatus(auto.id)}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white border border-slate-600 rounded-md hover:bg-slate-800 transition-colors"
                  aria-label={`${auto.status === 'Active' ? 'Pause' : 'Resume'} ${auto.name}`}
                >
                  {auto.status === 'Active' ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={() => setAutomations(automations.filter(a => a.id !== auto.id))}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Remove automation"
                  aria-label={`Remove ${auto.name}`}
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>}

        {activeTab === 'Runs' && <section aria-labelledby="runs-heading">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <h2 id="runs-heading" className="text-sm font-semibold text-slate-900">Latest activity</h2>
            <span className="text-xs text-slate-500">From the current automation feed</span>
          </div>
          {automations.length === 0 ? <p className="py-10 text-sm text-slate-400">No automation activity is available yet.</p> : automations.map(auto => (
            <div key={auto.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 py-4 border-t border-slate-700">
              <div className="min-w-0"><p className="text-sm font-medium text-slate-900">{auto.name}</p><p className="text-xs text-slate-500 mt-1">{auto.lastRun}</p></div>
              <span className="text-[10px] font-mono uppercase text-slate-500">{auto.status}</span>
            </div>
          ))}
        </section>}

        {activeTab === 'Calendar' && <section aria-labelledby="schedule-heading">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <h2 id="schedule-heading" className="text-sm font-semibold text-slate-900">Schedule overview</h2>
            <span className="text-xs text-slate-500">Configured triggers</span>
          </div>
          {automations.length === 0 ? <p className="py-10 text-sm text-slate-400">Create an automation to see its schedule here.</p> : automations.map(auto => (
            <div key={auto.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)_auto] gap-2 py-4 border-t border-slate-700 items-baseline">
              <p className="text-sm font-medium text-slate-900">{auto.name}</p><p className="text-xs text-slate-500">{auto.schedule}</p><span className="text-[10px] font-mono uppercase text-slate-500">{auto.trigger}</span>
            </div>
          ))}
        </section>}
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">New Autonomous Pipeline</h3>
            <p className="text-xs text-slate-500 mb-4">
              Schedule recurring chat thread ingestion or incident telemetry monitors.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pipeline Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily #proj-auth Gherkin Generation"
                  value={newAutoName}
                  onChange={e => setNewAutoName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus-ring"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Trigger Mechanism
                </label>
                <select
                  value={newTrigger}
                  onChange={e => setNewTrigger(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus-ring"
                >
                  <option value="Cron Schedule">Cron Schedule (Periodic)</option>
                  <option value="Slack Mention">Slack @ScribeBA Mention</option>
                  <option value="Prometheus Alert">Prometheus Alert Webhook</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
              >
                Deploy Pipeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
