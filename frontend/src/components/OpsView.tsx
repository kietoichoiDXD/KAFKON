import React, { useEffect, useState } from 'react';

const API = 'http://localhost:8000';

const LABEL_COLOR: Record<string, string> = {
  Verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Inferred: 'bg-amber-50 text-amber-700 border-amber-200',
  Assumed: 'bg-purple-50 text-purple-700 border-purple-200',
  Blocked: 'bg-rose-50 text-rose-700 border-rose-200',
};

type Pod = { name: string; ready: string; status: string; restarts: string; age: string };
type Evidence = { label: string; field: string; value: string; source: string };
type Proposal = {
  action_id: string; runbook: string; target: string; summary: string;
  parameters: { name: string; value: string }; observed: string;
  resource_version: string; patch: any; created_at: string;
};
type Diagnosis = {
  healthy: boolean;
  state: { namespace: string; context: string; pods: Pod[];
    metrics: { rps: number | null; error_rate: number | null; p95_seconds: number | null; available: boolean } };
  evidence: Evidence[];
  proposal: Proposal | null;
  error?: string;
};

// What to say while demoing, in the order that tells the story.
const SCRIPT = [
  { step: 'Trigger', note: 'Inject a declared fault — the console can only break what it can fix.' },
  { step: 'Diagnose', note: 'Every finding carries the command that produced it.' },
  { step: 'Ask in Slack', note: 'The person who approves sees the diff where they already work.' },
  { step: 'Approve', note: 'A sentence never authorises a write; a click on a visible diff does.' },
  { step: 'Verify', note: 'Applied is not recovered — the rate window still holds the outage.' },
];

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(2)}%`);
const num = (v: number | null, d = 2) => (v === null ? '—' : v.toFixed(d));

export function OpsView() {
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [applied, setApplied] = useState<any>(null);
  const [verified, setVerified] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [channel, setChannel] = useState('');
  const [notified, setNotified] = useState<any>(null);
  const [envs, setEnvs] = useState<any[]>([]);
  const [env, setEnv] = useState<string>('');
  const [faults, setFaults] = useState<any[]>([]);
  const [fault, setFault] = useState<string>('');
  const [triggered, setTriggered] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/api/slack/channels`).then(r => r.json()).then(c => {
      if (Array.isArray(c)) { setChannels(c); setChannel(c[0]?.id ?? ''); }
    }).catch(() => undefined);
    fetch(`${API}/api/ops/environments`).then(r => r.json()).then(e => {
      if (Array.isArray(e)) { setEnvs(e); setEnv(e[0]?.name ?? ''); }
    }).catch(() => undefined);
  }, []);

  // Drill scenarios follow the selected environment; most environments declare none.
  useEffect(() => {
    if (!env) return;
    fetch(`${API}/api/ops/faults?environment=${encodeURIComponent(env)}`)
      .then(r => r.json())
      .then(f => { if (Array.isArray(f)) { setFaults(f); setFault(f[0]?.name ?? ''); } })
      .catch(() => undefined);
  }, [env]);

  const triggerFault = async () => {
    if (!fault) return;
    setBusy('trigger'); setError(null); setTriggered(null);
    try {
      const r = await fetch(`${API}/api/ops/trigger`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fault, environment: env }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setTriggered(d);
      // Give Kubernetes a moment to roll the change before reading it back.
      setTimeout(() => run('diagnose'), 6000);
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const requestApproval = async () => {
    if (!diag?.proposal || !channel) return;
    setBusy('notify'); setError(null);
    try {
      const r = await fetch(`${API}/api/ops/notify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: diag.proposal.action_id, channel }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setNotified(d);
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const run = async (what: 'diagnose' | 'verify') => {
    setBusy(what); setError(null);
    try {
      const r = await fetch(`${API}/api/ops/${what}?environment=${encodeURIComponent(env)}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      if (what === 'diagnose') { setDiag(d); setApplied(null); setVerified(null); setNotified(null); }
      else {
        setVerified(d);
        // Keep the metric cards honest: verify has a fresher error rate than the last diagnose.
        setDiag(prev => prev && { ...prev, state: { ...prev.state,
          metrics: { ...prev.state.metrics, error_rate: d.error_rate } } });
      }
    } catch (e: any) {
      setError(e.message === 'Failed to fetch' ? 'API not running — python -m backend.cli serve' : e.message);
    } finally { setBusy(null); }
  };

  const approve = async () => {
    if (!diag?.proposal) return;
    setBusy('apply'); setError(null);
    try {
      const r = await fetch(`${API}/api/ops/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: diag.proposal.action_id, approver: 'operator' }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setApplied(d);
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  useEffect(() => { run('diagnose'); }, []);

  const m = diag?.state.metrics;
  const bad = (m?.error_rate ?? 0) > 0.02;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-[22px] font-semibold text-gray-900">Incident console</h1>
          <p className="text-[13.5px] text-gray-600 mt-1">
            Reads the live cluster, labels what it can prove, and proposes one named runbook with the
            exact patch. Nothing is written until you approve the action you can see.
          </p>
        </div>

        {error && <p className="text-[13px] text-rose-600 border border-rose-200 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}

        {m && (
          <div className="grid grid-cols-4 gap-3">
            {[
              ['Error rate', pct(m.error_rate), bad],
              ['Requests / s', num(m.rps), false],
              ['p95 latency', m.p95_seconds === null ? '—' : `${(m.p95_seconds * 1000).toFixed(0)} ms`, false],
              ['Pods ready', `${diag!.state.pods.filter(p => p.ready.split('/')[0] === p.ready.split('/')[1]).length}/${diag!.state.pods.length}`, false],
            ].map(([k, v, warn]: any) => (
              <div key={k} className={`rounded-xl border px-4 py-3 bg-white ${warn ? 'border-rose-300' : 'border-gray-200'}`}>
                <div className="text-[11.5px] text-gray-500">{k}</div>
                <div className={`text-[20px] font-semibold ${warn ? 'text-rose-600' : 'text-gray-900'}`}>{v}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {SCRIPT.map((s, i) => (
            <span key={s.step} title={s.note}
                  className="px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[12px] text-gray-600">
              <span className="text-gray-400 mr-1.5">{i + 1}</span>{s.step}
            </span>
          ))}
        </div>

        {envs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-gray-500">Environment</span>
            {envs.map(e => (
              <button
                key={e.name}
                onClick={() => { setEnv(e.name); setDiag(null); setApplied(null); setVerified(null); }}
                className={`px-3 py-1.5 rounded-full border text-[12.5px] transition-colors ${
                  env === e.name
                    ? 'border-[#7b5cff]/50 bg-[#7b5cff]/8 text-[#4a35a8] font-medium'
                    : 'border-gray-200 text-gray-600 hover:border-[#7b5cff]/40'
                }`}
                title={`${e.kind} · ${e.target}`}
              >
                {e.name}
                <span className="text-gray-400 ml-1.5">{e.can_remediate ? e.kind : `${e.kind} · read-only`}</span>
              </button>
            ))}
          </div>
        )}

        {faults.length > 0 && (
          <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-4 space-y-2">
            <h2 className="text-[13px] font-semibold text-amber-900 m-0">Drill</h2>
            <p className="text-[12px] text-amber-800 m-0">
              Inject a declared fault to rehearse the loop. Only the scenarios written in
              integrations.yaml can be triggered, and each one is reversible by a runbook above.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={fault} onChange={e => setFault(e.target.value)}
                      className="border border-amber-200 bg-white rounded-lg px-2.5 py-2 text-[13px]">
                {faults.map(f => <option key={f.name} value={f.name}>{f.name} — {f.summary}</option>)}
              </select>
              <button onClick={triggerFault} disabled={!!busy}
                      className="px-4 py-2 rounded-full bg-amber-600 text-white text-[13.5px] font-medium disabled:opacity-40 hover:bg-amber-700 active:translate-y-px transition-all">
                {busy === 'trigger' ? 'Injecting…' : 'Trigger fault'}
              </button>
              {triggered && (
                <span className="text-[12.5px] text-amber-900">
                  {triggered.triggered} at {triggered.at} · expect <b>{triggered.expect}</b>
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => run('diagnose')} disabled={!!busy}
                  className="px-4 py-2 rounded-full bg-[#7b5cff] text-white text-[13.5px] font-medium disabled:opacity-40">
            {busy === 'diagnose' ? 'Reading cluster…' : 'Diagnose'}
          </button>
          <button onClick={() => run('verify')} disabled={!!busy}
                  className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-[13.5px] disabled:opacity-40">
            {busy === 'verify' ? 'Checking…' : 'Verify recovery'}
          </button>
        </div>

        {diag && (
          <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-3">
            <h2 className="text-[15px] font-semibold">Evidence</h2>
            {diag.evidence.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-[12.5px]">
                <span className={`px-1.5 py-0.5 rounded border shrink-0 ${LABEL_COLOR[e.label] ?? 'bg-gray-50 border-gray-200'}`}>{e.label}</span>
                <span className="text-gray-700">
                  <b>{e.field}</b>: {e.value}
                  <span className="block text-gray-400 font-mono text-[11px] mt-0.5">{e.source}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {diag?.proposal && !applied && (
          <div className="border-2 border-[#7b5cff]/30 rounded-xl p-5 bg-white space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">Proposed fix</h2>
              <span className="text-[11.5px] font-mono text-gray-500">{diag.proposal.action_id}</span>
            </div>
            <p className="text-[13px] text-gray-700">{diag.proposal.summary}</p>
            <div className="grid grid-cols-2 gap-3 text-[12.5px]">
              <div><span className="text-gray-500">Runbook</span><div className="font-semibold">{diag.proposal.runbook}</div></div>
              <div><span className="text-gray-500">Target</span><div className="font-semibold">{diag.proposal.target}</div></div>
            </div>
            <div className="text-[12.5px]">
              <span className="text-gray-500">Exact change</span>
              <div className="mt-1 font-mono text-[12px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <div className="text-rose-600">- {diag.proposal.parameters.name}={diag.proposal.observed}</div>
                <div className="text-emerald-700">+ {diag.proposal.parameters.name}={diag.proposal.parameters.value}</div>
              </div>
            </div>
            <p className="text-[11.5px] text-gray-500">
              Pinned to resourceVersion {diag.proposal.resource_version} — if the deployment changes
              before you approve, this action is refused rather than applied to something else.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select value={channel} onChange={e => setChannel(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-2 text-[13px]">
                {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
              <button onClick={requestApproval} disabled={!!busy || !channel || !!notified}
                      className="px-4 py-2 rounded-full border border-[#7b5cff]/40 text-[#4a35a8] text-[13.5px] font-medium disabled:opacity-40">
                {busy === 'notify' ? 'Sending…' : notified ? 'Sent to Slack' : 'Ask for approval in Slack'}
              </button>
              <button onClick={approve} disabled={!!busy}
                      className="px-4 py-2 rounded-full bg-emerald-600 text-white text-[13.5px] font-medium disabled:opacity-40">
                {busy === 'apply' ? 'Applying…' : 'Approve and apply'}
              </button>
            </div>
            {notified && (
              <p className="text-[12px] text-emerald-700">
                Approval request posted in Slack. The outcome — approved or refused — is posted back
                into that same thread.
              </p>
            )}
          </div>
        )}

        {diag && !diag.proposal && (
          <div className="border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3 text-[13px] text-emerald-800">
            Configuration matches the baseline. No runbook to propose.
          </div>
        )}

        {applied && (
          <div className="border border-gray-200 rounded-xl p-4 bg-white text-[13px] space-y-1">
            <div className="font-semibold text-emerald-700">Applied · {applied.action_id}</div>
            <div className="text-gray-600">approved by {applied.approver} at {applied.at}</div>
            <div className="text-gray-500 text-[12px]">{applied.note}</div>
          </div>
        )}

        {verified && (
          <div className={`border rounded-xl p-4 text-[13px] space-y-1 ${verified.recovered ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
            <div className="font-semibold">{verified.recovered ? 'Recovered' : 'Not recovered yet'}</div>
            <div className="text-gray-700">
              config restored: {String(verified.config_restored)} · pods ready: {String(verified.pods_ready)} ·
              error rate: {pct(verified.error_rate)}
            </div>
            <div className="text-gray-500 text-[12px]">
              The rate window still holds pre-fix samples, so the number falls over a minute or two
              rather than instantly.
            </div>
          </div>
        )}

        {diag && (
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <h2 className="text-[14px] font-semibold mb-2">
              {diag.state.namespace} · {diag.state.context}
            </h2>
            <div className="space-y-1 font-mono text-[12px]">
              {diag.state.pods.map(p => (
                <div key={p.name} className="flex gap-3 text-gray-600">
                  <span className="w-64 truncate">{p.name}</span>
                  <span className={p.ready.split('/')[0] === p.ready.split('/')[1] ? 'text-emerald-600' : 'text-rose-600'}>{p.ready}</span>
                  <span>{p.status}</span>
                  <span className="text-gray-400">restarts {p.restarts}</span>
                  <span className="text-gray-400">{p.age}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
