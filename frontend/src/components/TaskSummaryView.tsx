import React, { useState } from 'react';
import { API, safeFetchJson } from '../api';

type TaskSummary = {
  summary: string;
  summary_mode: 'ai' | 'counts_only' | string;
  task_count: number;
  active_count: number;
  blocked_count: number;
  status_counts: Record<string, number>;
  scope_note: string;
  tasks: { id: string; name: string; url: string; status: string }[];
};

export const TaskSummaryView: React.FC = () => {
  const [result, setResult] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const summarize = async () => {
    setLoading(true);
    setError('');
    const response = await safeFetchJson<TaskSummary>(`${API}/api/clickup/tasks/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!response.ok || !response.data) {
      setError(response.error || 'Could not summarize the ClickUp backlog.');
    } else {
      setResult(response.data);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-900">
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-5 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-teal-800">
              <span className="material-symbols-outlined text-base" aria-hidden="true">summarize</span>
              Product overview
            </div>
            <h1 className="m-0 text-2xl font-semibold tracking-tight">Product Tasks</h1>
            <p className="mb-0 mt-1 max-w-2xl text-sm text-slate-600">
              Summarize the current ClickUp backlog, see its status mix, and spot tasks explicitly marked as blocked.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void summarize()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`} aria-hidden="true">
              {loading ? 'progress_activity' : 'auto_awesome'}
            </span>
            {loading ? 'Summarizing backlog…' : result ? 'Refresh summary' : 'Summarize product tasks'}
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 overflow-y-auto overscroll-contain flex-col gap-5 p-5 lg:p-8">
        {error && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <strong className="font-semibold">Summary unavailable.</strong> {error}
            <p className="mb-0 mt-1 text-xs text-rose-700">Check that you are signed in and the ClickUp connection is configured, then retry.</p>
          </div>
        )}

        {!result && !loading && !error && (
          <section className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">view_kanban</span>
            </span>
            <h2 className="m-0 text-lg font-semibold">Get a clear view of the product backlog</h2>
            <p className="mb-4 mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
              ScribeBA reads the configured ClickUp list and summarizes task themes and recorded statuses. Task descriptions are sent to the configured AI provider after secret and personal-data redaction.
            </p>
            <button type="button" onClick={() => void summarize()} className="rounded-md border border-teal-800 px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50">
              Summarize product tasks
            </button>
          </section>
        )}

        {loading && !result && (
          <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-600" role="status">
            Loading ClickUp tasks and preparing a grounded summary…
          </div>
        )}

        {result && (
          <>
            <section aria-label="Backlog metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="Tasks in scope" value={result.task_count} icon="checklist" />
              <Metric label="Not marked complete" value={result.active_count} icon="pending_actions" />
              <Metric label="Marked blocked / on hold" value={result.blocked_count} icon="block" alert={result.blocked_count > 0} />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="m-0 text-base font-semibold">Backlog summary</h2>
                  <p className="mb-0 mt-1 text-xs text-slate-500">Source: configured ClickUp list</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${result.summary_mode === 'ai' ? 'border-teal-200 bg-teal-50 text-teal-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                  {result.summary_mode === 'ai' ? 'AI summary · grounded in task data' : 'Status summary · AI unavailable'}
                </span>
              </div>
              <div className="whitespace-pre-wrap px-5 py-5 text-sm leading-7 text-slate-700">{result.summary}</div>
            </section>

            <section className="grid grid-cols-1 gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="m-0 text-sm font-semibold">Status breakdown</h2>
                {Object.keys(result.status_counts).length ? (
                  <ul className="mb-0 mt-4 space-y-3 p-0">
                    {Object.entries(result.status_counts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                      <li key={status} className="flex list-none items-center justify-between gap-3 text-sm">
                        <span className="truncate text-slate-700">{status}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800">{count}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mb-0 mt-3 text-sm text-slate-500">No tasks returned from ClickUp.</p>}
                <p className="mb-0 mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">{result.scope_note}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="m-0 text-sm font-semibold">Recently updated tasks</h2>
                <ul className="mb-0 mt-3 divide-y divide-slate-100 p-0">
                  {result.tasks.map(task => (
                    <li key={task.id || task.name} className="flex list-none items-start justify-between gap-4 py-3 first:pt-1 last:pb-0">
                      <div className="min-w-0">
                        {task.url ? <a href={task.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-teal-800 hover:underline">{task.name}</a> : <span className="text-sm font-medium text-slate-800">{task.name}</span>}
                        <div className="mt-1 text-xs text-slate-500">{task.status || 'Open'}</div>
                      </div>
                      <span className="material-symbols-outlined shrink-0 text-base text-slate-400" aria-hidden="true">open_in_new</span>
                    </li>
                  ))}
                  {!result.tasks.length && <li className="list-none py-3 text-sm text-slate-500">No task details to show.</li>}
                </ul>
              </div>
            </section>
            <p className="mb-0 text-xs leading-relaxed text-slate-500">
              Summary reflects task titles, descriptions and statuses returned by ClickUp. It does not establish priority, ownership, deadlines or delivery risk unless those facts are present in the source; confirm decisions with the task owner.
            </p>
          </>
        )}
      </main>
    </div>
  );
};

function Metric({ label, value, icon, alert = false }: { label: string; value: number; icon: string; alert?: boolean }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${alert ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      </span>
      <div>
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <strong className={`mt-1 block text-2xl font-semibold ${alert ? 'text-rose-700' : 'text-slate-900'}`}>{value}</strong>
      </div>
    </div>
  );
}
