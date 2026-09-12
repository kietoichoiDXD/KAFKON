import React, { useState } from 'react';

export const AutomationsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Automations' | 'Runs' | 'Calendar'>('Automations');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All states');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [automations, setAutomations] = useState<
    { id: string; name: string; trigger: string; schedule: string; status: 'Active' | 'Paused' }[]
  >([]);
  const [newAutoName, setNewAutoName] = useState('');
  const [newTrigger, setNewTrigger] = useState('Schedule (Cron)');

  const handleCreate = () => {
    if (newAutoName.trim()) {
      setAutomations([
        ...automations,
        {
          id: Date.now().toString(),
          name: newAutoName.trim(),
          trigger: newTrigger,
          schedule: 'Daily at 08:00 UTC',
          status: 'Active',
        },
      ]);
      setNewAutoName('');
      setIsCreateOpen(false);
    }
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#f8faf9] flex flex-col">
      {/* Top Header */}
      <div className="px-8 pt-6 pb-4 bg-white/70 backdrop-blur border-b border-gray-200/80 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Automations</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Run an agent on a schedule, a webhook, or a repository event
            </p>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-lg bg-[#008775] text-white text-xs font-medium hover:bg-[#007363] transition-all shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New automation</span>
          </button>
        </div>

        {/* Sub tabs */}
        <div className="flex items-center gap-2 mt-4">
          {(['Automations', 'Runs', 'Calendar'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab
                  ? 'bg-teal-100/70 text-[#008775] border border-teal-300/80 font-semibold'
                  : 'text-gray-600 hover:bg-gray-100 border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-8 py-4 flex items-center gap-3 shrink-0">
        <div className="relative max-w-sm w-full">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search automations by name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#008775]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg text-xs text-gray-700 px-3 py-2 focus:outline-none focus:border-[#008775]"
        >
          <option>All states</option>
          <option>Active</option>
          <option>Paused</option>
          <option>Failing</option>
        </select>
      </div>

      {/* Main Content / Empty State */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {automations.length === 0 ? (
          <div className="flex flex-col items-center text-center max-w-sm">
            <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[26px]">account_tree</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">No automations yet</h3>
            <p className="text-xs text-gray-500 mb-4">
              An automation you create will appear here.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="text-xs font-semibold text-[#008775] hover:underline"
            >
              + Create an automation
            </button>
          </div>
        ) : (
          <div className="w-full max-w-4xl space-y-3">
            {automations.map(auto => (
              <div
                key={auto.id}
                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:border-teal-300 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#008775] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[20px]">bolt</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">{auto.name}</h4>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      <span>Trigger: {auto.trigger}</span>
                      <span>•</span>
                      <span>Schedule: {auto.schedule}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    {auto.status}
                  </span>
                  <button
                    onClick={() =>
                      setAutomations(automations.filter(a => a.id !== auto.id))
                    }
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Automation Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 mb-1">New Automation</h3>
            <p className="text-xs text-gray-500 mb-4">
              Schedule recurring checks, governance audits, or webhook responses.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Automation Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily AWS S3 Security Sweep"
                  value={newAutoName}
                  onChange={e => setNewAutoName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-[#008775]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Trigger Type</label>
                <select
                  value={newTrigger}
                  onChange={e => setNewTrigger(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-[#008775] bg-white"
                >
                  <option>Schedule (Cron)</option>
                  <option>GitHub Webhook (PR Created)</option>
                  <option>AWS CloudWatch Alert</option>
                  <option>Linear Issue Status Change</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#008775] hover:bg-[#007363] rounded-lg shadow-sm"
              >
                Create Automation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
