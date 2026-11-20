import React, { useEffect, useState } from 'react';
import { API } from '../api';

const LABEL_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  Verified: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Inferred: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Assumed: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  Blocked: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

const DEFAULT_SAMPLE_ITEMS = [
  {
    id: 'req-01',
    status: 'Verified',
    tag: 'STARTUP-LEAN',
    title: 'Google Workspace SSO Authentication',
    claim: 'Acme Corp requires Google Workspace SSO with domain restricted strictly to @acmecorp.com.',
    source: '@alex_lead in #proj-auth-federation: "Acme Corp requires Google Workspace SSO."',
    timestamp: 'Today 10:15 UTC',
  },
  {
    id: 'req-02',
    status: 'Verified',
    tag: 'SECURITY-GATE',
    title: 'RBAC Engineer Role Assignment',
    claim: 'All authenticated users from @acmecorp.com domain must be auto-assigned the Engineer role upon first login.',
    source: '@oliver_sec in #proj-auth-federation: "Must restrict to domain @acmecorp.com and assign Engineer role."',
    timestamp: 'Today 10:17 UTC',
  },
  {
    id: 'req-03',
    status: 'Verified',
    tag: 'DB-SCHEMA',
    title: 'Unique Provider Constraint in Users Table',
    claim: 'Database schema migration will add sso_provider column with a unique index constraint.',
    source: '@tony_db in #proj-auth-federation: "I will add sso_provider column with unique constraint."',
    timestamp: 'Today 10:20 UTC',
  },
  {
    id: 'req-04',
    status: 'Blocked',
    tag: 'COMPLIANCE',
    title: 'Session Inactivity Expiration Window',
    claim: 'Ambiguity between 8-hour SOC2 standard and 24-hour developer convenience. No consensus reached in thread.',
    source: '@alex_lead: "What about session expiration? 8h or 24h?" — @oliver_sec: "Avatar sync out of scope. 8h standard for SOC2."',
    timestamp: 'Today 10:22 UTC',
  },
];

export const ReviewView: React.FC = () => {
  const [items, setItems] = useState<any[]>(DEFAULT_SAMPLE_ITEMS);
  const [selectedItem, setSelectedItem] = useState<any>(DEFAULT_SAMPLE_ITEMS[3]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/runs`, { credentials: 'include' })
      .then(r => r.json())
      .then((runs: any[]) => {
        if (!Array.isArray(runs) || runs.length === 0) return;
        const real = runs.flatMap((run, ri) =>
          (run.evidence ?? []).map((e: any, ei: number) => ({
            id: `run-${ri}-${ei}`,
            status: e.label,
            tag: run.skill.toUpperCase().replace('_', '-'),
            title: e.field,
            claim: e.value,
            source: e.quote_source ?? run.permalink,
            timestamp: run.at,
          }))
        );
        if (real.length) {
          setItems(real);
          setSelectedItem(real[0]);
          setIsLive(true);
        }
      })
      .catch(() => undefined);
  }, []);

  const filteredItems = items.filter(
    item => filterStatus === 'ALL' || item.status.toUpperCase() === filterStatus
  ).sort((a, b) => Number(b.id === selectedItem?.id) - Number(a.id === selectedItem?.id));

  const blockedCount = items.filter(i => i.status === 'Blocked').length;
  const verifiedCount = items.filter(i => i.status === 'Verified').length;
  const needsReviewCount = items.length - verifiedCount - blockedCount;
  const allDecisionsApproved = items.length > 0 && items.every(item => {
    const decision = item.decision?.status ?? item.decision;
    return decision === 'Approved';
  });
  const readiness = blockedCount > 0
    ? 'Blocked'
    : allDecisionsApproved && verifiedCount === items.length
    ? 'Ready'
    : 'Needs review';
  const canPublish = readiness === 'Ready';
  const selectedDecision = selectedItem?.decision?.status ?? selectedItem?.decision;
  const selectedReadiness = selectedItem?.readiness ?? (
    selectedItem?.status === 'Blocked'
      ? 'Blocked'
      : selectedItem?.status === 'Verified' && selectedDecision === 'Approved'
      ? 'Ready'
      : 'Needs review'
  );

  const focusDecision = () => document.getElementById('decision-state')?.focus();
  const resolveSelectedBlocker = () => {
    if (!selectedItem || selectedItem.status !== 'Blocked' || selectedDecision !== 'Approved') return;
    const updated = { ...selectedItem, status: 'Verified' };
    setItems(current => current.map(item => item.id === selectedItem.id ? updated : item));
    setSelectedItem(updated);
  };

  const exportDocket = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scribeba-evidence-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="review-view flex-1 h-full min-h-0 overflow-hidden bg-slate-50 flex flex-col font-sans">
      <header className="px-6 lg:px-8 py-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 m-0">Evidence audit</h1>
            <span className="text-xs text-slate-500">{isLive ? 'Live run data' : 'Verified sample docket'}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Follow each claim from its speaker quote to its decision and publish readiness.
          </p>
        </div>
        <button onClick={exportDocket} className="px-3.5 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-800 hover:bg-slate-100">
          Export docket
        </button>
      </header>

      <section aria-label="Docket summary" className="grid grid-cols-2 xl:grid-cols-4 border-b border-slate-200 shrink-0">
        <div className="px-6 lg:px-8 py-4 border-r border-slate-200">
          <div className="text-xs text-slate-500">Claims in this docket</div>
          <div className="text-xl font-medium text-slate-900 mt-1 tabular-nums">{items.length}</div>
        </div>
        <div className="px-5 py-4 border-r border-slate-200">
          <div className="text-xs text-slate-500">Evidence verified</div>
          <div className="text-xl font-medium text-emerald-700 mt-1 tabular-nums">{verifiedCount}</div>
        </div>
        <div className="px-5 py-4 border-r border-slate-200">
          <div className="text-xs text-slate-500">Needs review</div>
          <div className="text-xl font-medium text-amber-700 mt-1 tabular-nums">{needsReviewCount}</div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs text-slate-500">Publish readiness</div>
          <div className={`text-xl font-medium mt-1 ${readiness === 'Blocked' ? 'text-rose-700' : readiness === 'Ready' ? 'text-emerald-700' : 'text-slate-900'}`}>
            {readiness}
          </div>
        </div>
      </section>

      <div className="px-6 lg:px-8 py-3 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
        <div role="group" aria-label="Filter claims by evidence status" className="flex items-center gap-1 overflow-x-auto">
          {['ALL', 'VERIFIED', 'INFERRED', 'ASSUMED', 'BLOCKED'].map(status => {
            const count = status === 'ALL' ? items.length : items.filter(item => item.status.toUpperCase() === status).length;
            return (
              <button key={status} onClick={() => setFilterStatus(status)} aria-pressed={filterStatus === status}
                className={`whitespace-nowrap px-2.5 py-2 text-xs font-medium border-b ${filterStatus === status ? 'text-slate-900 border-teal-500' : 'text-slate-500 border-transparent hover:text-slate-800'}`}>
                {status === 'ALL' ? 'All claims' : status[0] + status.slice(1).toLowerCase()} <span className="font-mono">{count}</span>
              </button>
            );
          })}
        </div>
        <span className="hidden sm:inline text-xs text-slate-500 tabular-nums">{filteredItems.length} of {items.length}</span>
      </div>

      <div className="review-matrix flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 overflow-hidden max-lg:block max-lg:overflow-y-auto max-lg:pb-20">
        <section aria-labelledby="evidence-heading" className="min-h-0 overflow-y-auto border-r border-slate-200 px-5 lg:px-6 py-5 lg:self-start lg:max-h-full max-lg:max-h-[35vh] max-lg:border-r-0 max-lg:border-b">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 id="evidence-heading" className="text-base font-semibold text-slate-900">Evidence</h2>
            <span className="text-xs text-slate-500">{filteredItems.length} claims</span>
          </div>
          {filteredItems.length === 0 ? (
            <div className="py-6 text-sm text-slate-500">No claims match this filter.</div>
          ) : (
            <div>
              {filteredItems.map(item => {
                const badge = LABEL_BADGES[item.status] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
                const selected = selectedItem?.id === item.id;
                return (
                  <button key={item.id} onClick={() => setSelectedItem(item)} aria-pressed={selected}
                    className={`w-full text-left py-4 border-b border-slate-200 transition-colors ${selected ? 'border-t border-t-teal-500 bg-slate-100' : 'hover:bg-slate-100/70'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-[11px] font-semibold ${badge.text}`}>{item.status}</span>
                      <span className="text-[11px] font-mono text-slate-500">{item.timestamp}</span>
                    </div>
                    <strong className="block mt-2 text-sm font-semibold text-slate-900">{item.title}</strong>
                    <span className="block mt-1 text-xs leading-relaxed text-slate-600 line-clamp-2">{item.claim}</span>
                    <span className="block mt-2 text-xs text-slate-500 truncate">{item.source}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="decision-heading" className="min-h-0 overflow-y-auto border-r border-slate-200 px-5 lg:px-6 py-5 bg-white lg:self-start lg:max-h-full max-lg:overflow-visible max-lg:border-r-0 max-lg:border-b">
              <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 id="decision-heading" className="text-base font-semibold text-slate-900">Decision</h2>
            <span className="text-xs font-mono text-slate-500">{selectedDecision ?? 'Not recorded'}</span>
          </div>
          {selectedItem ? (
            <>
              <h3 className="text-lg font-semibold leading-snug text-slate-900">{selectedItem.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{selectedItem.claim}</p>
              <div className="mt-6 text-xs font-medium text-slate-500">Source statement</div>
              <blockquote className="mt-2 m-0 px-4 py-3 bg-slate-100 text-sm leading-relaxed text-slate-800">
                {selectedItem.source}
              </blockquote>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                {selectedItem.status === 'Blocked'
                  ? 'The source contains an unresolved question. No decision is inferred from the surrounding discussion.'
                  : selectedDecision
                  ? `Decision status: ${selectedDecision}.`
                  : 'This run contains evidence labels, but no separate decision status. The interface leaves it unassigned.'}
              </p>
              <label className="mt-5 flex flex-col gap-2 text-xs font-medium text-slate-600">
                Decision state
                <select
                  id="decision-state"
                  aria-label="Decision state for selected claim"
                  value={selectedDecision ?? ''}
                  onChange={event => {
                    const value = event.target.value || undefined;
                    const updated = { ...selectedItem, decision: value };
                    setItems(items.map(item => item.id === selectedItem.id ? updated : item));
                    setSelectedItem(updated);
                  }}
                  className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus-ring"
                >
                  <option value="">Not recorded</option>
                  <option value="Proposed">Proposed</option>
                  <option value="Approved">Approved</option>
                  <option value="Superseded">Superseded</option>
                  <option value="Unresolved">Unresolved</option>
                </select>
              </label>
              <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap gap-2">
                <button onClick={() => {
                  const next = selectedItem.status === 'Verified' ? 'Inferred' : 'Verified';
                  setItems(items.map(item => item.id === selectedItem.id ? { ...item, status: next } : item));
                  setSelectedItem((item: any) => ({ ...item, status: next }));
                }} className="px-3 py-2 bg-slate-800 text-white rounded-md text-xs font-semibold hover:bg-slate-700">
                  {selectedItem.status === 'Verified' ? 'Flag as inferred' : 'Mark evidence verified'}
                </button>
                <button onClick={() => {
                  if (selectedItem.status === 'Blocked') resolveSelectedBlocker();
                  else {
                    const updated = { ...selectedItem, status: 'Blocked' };
                    setItems(items.map(item => item.id === selectedItem.id ? updated : item));
                    setSelectedItem(updated);
                  }
                }} disabled={selectedItem.status === 'Blocked' && selectedDecision !== 'Approved'} className="px-3 py-2 border border-slate-300 text-slate-800 rounded-md text-xs font-semibold hover:bg-slate-100 disabled:opacity-40">
                  {selectedItem.status === 'Blocked' ? 'Clear blocker' : 'Mark as blocker'}
                </button>
              </div>
            </>
          ) : <p className="text-sm text-slate-500">Choose an evidence record to inspect its claim and source.</p>}
        </section>

        <section aria-labelledby="readiness-heading" className="min-h-0 overflow-y-auto px-5 lg:px-6 py-5 lg:self-start lg:max-h-full max-lg:overflow-visible">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 id="readiness-heading" className="text-base font-semibold text-slate-900">Readiness</h2>
            {selectedItem && <span className={`text-xs font-semibold ${selectedReadiness === 'Blocked' ? 'text-rose-700' : selectedReadiness === 'Ready' ? 'text-emerald-700' : 'text-amber-700'}`}>{selectedReadiness}</span>}
          </div>
          {selectedItem ? (
            <>
              <div className="text-sm font-semibold text-slate-900">{selectedReadiness === 'Blocked' ? 'External sync paused' : selectedReadiness === 'Ready' ? 'Ready for review' : 'Human review required'}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {selectedReadiness === 'Blocked'
                  ? 'This claim has an unresolved source question. Resolve it before publishing the specification.'
                  : selectedReadiness === 'Ready'
                  ? 'Evidence and decision are both recorded for this claim.'
                  : selectedDecision
                  ? 'Evidence is present, but the current status still needs human review.'
                  : 'Evidence is present. A separate decision has not been recorded for this claim.'}
              </p>
              <dl className="mt-6 divide-y divide-slate-200 border-y border-slate-200 text-sm">
                <div className="py-3 flex justify-between gap-4"><dt className="text-slate-500">Evidence</dt><dd className="m-0 font-medium text-slate-900">{selectedItem.status}</dd></div>
                <div className="py-3 flex justify-between gap-4"><dt className="text-slate-500">Decision</dt><dd className="m-0 font-medium text-slate-900">{selectedDecision ?? '—'}</dd></div>
                <div className="py-3 flex justify-between gap-4"><dt className="text-slate-500">Audit time</dt><dd className="m-0 font-mono text-xs text-slate-800">{selectedItem.timestamp}</dd></div>
              </dl>
              <div className={`mt-5 p-3 text-xs leading-relaxed ${blockedCount ? 'bg-rose-50 text-rose-900' : 'bg-slate-100 text-slate-700'}`}>
                {blockedCount ? `${blockedCount} unresolved claim${blockedCount === 1 ? '' : 's'} prevent this docket from being marked ready.` : canPublish ? 'All claims have verified evidence and an approved decision.' : 'A docket with no blockers still requires an explicit decision before it is ready.'}
              </div>
              {selectedItem.status === 'Blocked' && (
                <div className="mt-4">
                  <button
                    onClick={selectedDecision === 'Approved' ? resolveSelectedBlocker : focusDecision}
                    className="w-full px-3 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-md hover:bg-teal-800 transition-colors"
                  >
                    {selectedDecision === 'Approved' ? 'Clear blocker' : 'Record resolution'}
                  </button>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {selectedDecision === 'Approved'
                      ? 'Approval recorded. Confirm to move this claim back to verified.'
                      : 'Choose Approved in the decision column to enable blocker clearance.'}
                  </p>
                </div>
              )}
            </>
          ) : <p className="text-sm text-slate-500">Readiness details appear when a record is selected.</p>}
        </section>
      </div>
    </div>
  );
};
