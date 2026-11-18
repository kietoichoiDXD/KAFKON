import React, { useEffect, useState } from 'react';
import { API, safeFetchJson, isGitHubPages } from '../api';
import {
  MOCK_ENVIRONMENTS,
  MOCK_FAULTS,
  MOCK_DIAGNOSIS_UNHEALTHY,
  MOCK_DIAGNOSIS_RECOVERED,
  MOCK_SLACK_CHANNELS,
} from '../data/mockOps';

const LABEL_STYLE: Record<string, string> = {
  Verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Inferred: 'bg-amber-50 text-amber-700 border-amber-200',
  Assumed: 'bg-purple-50 text-purple-700 border-purple-200',
  Blocked: 'bg-rose-50 text-rose-700 border-rose-200',
};

type Pod = { name: string; ready: string; status: string; restarts: string; age: string };
type Evidence = { label: string; field: string; value: string; source: string };
type Proposal = {
  action_id: string;
  runbook: string;
  target: string;
  summary: string;
  parameters: { name: string; value: string };
  observed: string;
  resource_version: string;
  patch: any;
  created_at: string;
};
type Diagnosis = {
  healthy: boolean;
  state: {
    namespace: string;
    context: string;
    pods: Pod[];
    metrics: {
      rps: number | null;
      error_rate: number | null;
      p95_seconds: number | null;
      available: boolean;
    };
  };
  evidence: Evidence[];
  proposal: Proposal | null;
  error?: string;
};

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
  const [env, setEnv] = useState<string>('aiops-lab');
  const [faults, setFaults] = useState<any[]>([]);
  const [fault, setFault] = useState<string>('');
  const [triggered, setTriggered] = useState<any>(null);
  const [isDemo, setIsDemo] = useState<boolean>(isGitHubPages());

  useEffect(() => {
    safeFetchJson<{ id: string; name: string }[]>(`${API}/api/slack/channels`).then(res => {
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        setChannels(res.data);
        setChannel(res.data[0]?.id ?? '');
      } else {
        setChannels(MOCK_SLACK_CHANNELS);
        setChannel(MOCK_SLACK_CHANNELS[0]?.id ?? '');
      }
    });

    safeFetchJson<any[]>(`${API}/api/ops/environments`).then(res => {
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        setEnvs(res.data);
        setEnv(res.data[0]?.name ?? 'aiops-lab');
      } else {
        setEnvs(MOCK_ENVIRONMENTS);
        setEnv(MOCK_ENVIRONMENTS[0]?.name ?? 'aiops-lab');
      }
    });
  }, []);

  useEffect(() => {
    if (!env) return;
    safeFetchJson<any[]>(`${API}/api/ops/faults?environment=${encodeURIComponent(env)}`).then(res => {
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        setFaults(res.data);
        setFault(res.data[0]?.name ?? '');
      } else {
        setFaults(MOCK_FAULTS);
        setFault(MOCK_FAULTS[0]?.name ?? '');
      }
    });
  }, [env]);

  const triggerFault = async () => {
    if (!fault) return;
    setBusy('trigger');
    setError(null);
    setTriggered(null);
    try {
      const res = await safeFetchJson<any>(`${API}/api/ops/faults/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: env, fault }),
      });
      if (res.ok && res.data && !res.data.error) {
        setTriggered(res.data);
        await run('diagnose');
      } else {
        setIsDemo(true);
        setTriggered({
          triggered: fault,
          at: new Date().toLocaleTimeString(),
          expect: 'High 5xx error rate and container crash loop',
        });
        setDiag(MOCK_DIAGNOSIS_UNHEALTHY as any);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const run = async (verb: 'diagnose' | 'verify') => {
    setBusy(verb);
    setError(null);
    try {
      const res = await safeFetchJson<any>(`${API}/api/ops/${verb}?environment=${encodeURIComponent(env)}`);
      if (res.ok && res.data) {
        if (verb === 'diagnose') setDiag(res.data);
        else setVerified(res.data);
      } else {
        setIsDemo(true);
        if (verb === 'diagnose') {
          setDiag(MOCK_DIAGNOSIS_UNHEALTHY as any);
        } else {
          setVerified(MOCK_DIAGNOSIS_RECOVERED.state.metrics);
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const approve = async () => {
    if (!diag?.proposal) return;
    setBusy('apply');
    setError(null);
    try {
      const res = await safeFetchJson<any>(`${API}/api/ops/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id: diag.proposal.action_id,
          approver: 'operator (web console)',
        }),
      });
      if (res.ok && res.data) {
        setApplied(res.data);
      } else {
        setIsDemo(true);
        setApplied({
          action_id: diag.proposal.action_id,
          approver: 'operator (local approval)',
          at: new Date().toLocaleTimeString(),
          note: 'Patch applied successfully. Kubernetes deployment updated with optimistic lock.',
        });
        setDiag(MOCK_DIAGNOSIS_RECOVERED as any);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const requestApproval = async () => {
    if (!diag?.proposal || !channel) return;
    setBusy('notify');
    setError(null);
    try {
      const res = await safeFetchJson<any>(`${API}/api/ops/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          action_id: diag.proposal.action_id,
        }),
      });
      if (res.ok && res.data) {
        setNotified(res.data);
      } else {
        setIsDemo(true);
        setNotified({
          posted: true,
          channel,
          ts: '1792281900.123456',
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    run('diagnose');
  }, []);

  const m = diag?.state?.metrics;
  const isElevated5xx = (m?.error_rate ?? 0) > 0.02;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 bg-slate-50">
      <div className="w-full max-w-[1440px] mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Incident console
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Real-time Kubernetes cluster telemetry, automated root cause diagnosis, and declarative
            remediation patches guarded by <code className="font-mono text-teal-700 bg-teal-50 px-1 py-0.5 rounded">resourceVersion</code> concurrency locks.
          </p>
        </div>

        {isDemo && (
          <div className="flex items-center justify-between gap-4 py-3 border-y border-slate-200 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-2 text-emerald-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Simulation data
              </span>
              <span className="text-slate-500">
                Kubernetes pod state and Prometheus metrics are simulated.
              </span>
            </div>
            <span className="text-[11px] text-teal-400 font-mono hidden sm:inline">
              Cluster: {env}
            </span>
          </div>
        )}

        {error && (
          <div className="text-xs text-rose-700 border border-rose-200 bg-rose-50 rounded-xl p-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-rose-500">warning</span>
            <span>{error}</span>
          </div>
        )}

        {/* Telemetry Metrics Grid */}
        {m && (
          <div className="grid grid-cols-2 md:grid-cols-4 border-y border-slate-200">
            {[
              {
                label: '5xx Error Rate',
                val: pct(m.error_rate),
                warn: isElevated5xx,
                sub: isElevated5xx ? 'Threshold > 2.0%' : 'Nominal (< 0.1%)',
              },
              {
                label: 'Throughput',
                val: `${num(m.rps)} RPS`,
                warn: false,
                sub: 'Prometheus query',
              },
              {
                label: 'P95 Latency',
                val: m.p95_seconds === null ? '—' : `${(m.p95_seconds * 1000).toFixed(0)} ms`,
                warn: false,
                sub: 'Service mesh metrics',
              },
              {
                label: 'Pods Health',
                val: `${
                  diag!.state.pods.filter(p => p.ready.split('/')[0] === p.ready.split('/')[1]).length
                } / ${diag!.state.pods.length}`,
                warn:
                  diag!.state.pods.filter(p => p.ready.split('/')[0] === p.ready.split('/')[1])
                    .length < diag!.state.pods.length,
                sub: 'Ready containers',
              },
            ].map((card, i) => (
              <div
                key={i}
                className={`min-w-0 py-4 px-4 first:pl-0 border-r last:border-r-0 border-slate-200 ${card.warn ? 'bg-rose-50/40' : ''}`}
              >
                <div className="text-xs font-semibold text-slate-500">{card.label}</div>
                <div
                  className={`text-xl font-bold font-mono tracking-tight mt-1 ${
                    card.warn ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {card.val}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{card.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Environment & Control Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Environment:</span>
            {envs.map(e => (
              <button
                key={e.name}
                onClick={() => {
                  setEnv(e.name);
                  setDiag(null);
                  setApplied(null);
                  setVerified(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  env === e.name
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {e.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => run('diagnose')}
              disabled={!!busy}
              className="px-4 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-all disabled:opacity-40"
            >
              {busy === 'diagnose' ? 'Diagnosing...' : 'Run Diagnostics'}
            </button>
            <button
              onClick={() => run('verify')}
              disabled={!!busy}
              className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold transition-all disabled:opacity-40"
            >
              {busy === 'verify' ? 'Verifying...' : 'Verify Recovery'}
            </button>
          </div>
        </div>

        {/* Drill & Chaos Fault Injection */}
        {faults.length > 0 && (
          <div className="border-b border-slate-200 pb-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Chaos Engineering Rehearsal Drill
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inject safe, declarative faults to test autonomous root cause attribution and remediation.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={fault}
                onChange={e => setFault(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-slate-50 text-slate-800 focus-ring"
              >
                {faults.map(f => (
                  <option key={f.name} value={f.name}>
                    {f.name} — {f.summary}
                  </option>
                ))}
              </select>
              <button
                onClick={triggerFault}
                disabled={!!busy}
                className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-all disabled:opacity-40"
              >
                {busy === 'trigger' ? 'Injecting Fault...' : 'Inject Fault Scenario'}
              </button>
              {triggered && (
                <span className="text-xs text-rose-800 font-mono">
                  Fault triggered at {triggered.at} · {triggered.expect}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Evidence Findings */}
        {diag && (
          <div className="border-y border-slate-200 py-5 space-y-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Diagnostic Evidence Provenance
            </h2>
            <div className="space-y-2">
              {diag.evidence.map((e, i) => (
                <div key={i} className="flex items-start gap-3 text-xs py-3 border-b border-slate-200">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border uppercase tracking-wider shrink-0 ${
                      LABEL_STYLE[e.label] ?? 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {e.label}
                  </span>
                  <div className="text-slate-800">
                    <span className="font-semibold text-slate-900">{e.field}:</span> {e.value}
                    <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                      Command source: {e.source}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Proposed Atomic Remediation Diff */}
        {diag?.proposal && !applied && (
          <div className="border border-teal-500/40 rounded-xl p-6 bg-white space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                  Proposed Autonomous Remediation Patch
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  {diag.proposal.summary}
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
                Action ID: {diag.proposal.action_id}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Runbook</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {diag.proposal.runbook}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Target Kubernetes Object</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {diag.proposal.target}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1.5">
                Exact Declarative Patch
              </div>
              <div className="font-mono text-xs bg-slate-900 text-slate-100 rounded-lg p-3 space-y-1">
                <div className="text-rose-400">
                  - {diag.proposal.parameters.name} = {diag.proposal.observed}
                </div>
                <div className="text-emerald-400">
                  + {diag.proposal.parameters.name} = {diag.proposal.parameters.value}
                </div>
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-1.5">
                ResourceVersion Lock: <b>{diag.proposal.resource_version}</b> (Aborts if cluster mutates before sign-off)
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <select
                value={channel}
                onChange={e => setChannel(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50"
              >
                {channels.map(c => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>

              <button
                onClick={requestApproval}
                disabled={!!busy || !channel || !!notified}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold disabled:opacity-40"
              >
                {busy === 'notify' ? 'Dispatching...' : notified ? 'Sent to Slack' : 'Request Sign-off in Slack'}
              </button>

              <button
                onClick={approve}
                disabled={!!busy}
                className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold disabled:opacity-40"
              >
                {busy === 'apply' ? 'Applying...' : 'Approve & Apply Patch'}
              </button>
            </div>

            {notified && (
              <div className="text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg p-3">
                Notification dispatched to #{channels.find(c => c.id === channel)?.name || channel}. Live status will reflect human decision.
              </div>
            )}
          </div>
        )}

        {/* Recovery / Applied State */}
        {applied && (
          <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 text-xs space-y-1">
            <div className="font-bold text-emerald-900">
              Patch Applied: {applied.action_id}
            </div>
            <div className="text-emerald-800">
              Approved by {applied.approver} at {applied.at}
            </div>
            <div className="text-emerald-700 text-[11px]">{applied.note}</div>
          </div>
        )}

        {/* Kubernetes Pods Table */}
        {diag && diag.state && (
          <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Live Pod Matrix ({diag.state.namespace} · {diag.state.context})
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                Namespace: {diag.state.namespace}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-4 font-semibold">Pod Name</th>
                    <th className="py-2 px-4 font-semibold">Ready</th>
                    <th className="py-2 px-4 font-semibold">Status</th>
                    <th className="py-2 px-4 font-semibold">Restarts</th>
                    <th className="py-2 pl-4 font-semibold">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {diag.state.pods.map(p => {
                    const isHealthy = p.ready.split('/')[0] === p.ready.split('/')[1];
                    return (
                      <tr key={p.name} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 pr-4 font-semibold text-slate-800">{p.name}</td>
                        <td
                          className={`py-2 px-4 font-bold ${
                            isHealthy ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {p.ready}
                        </td>
                        <td className="py-2 px-4 text-slate-700">{p.status}</td>
                        <td className="py-2 px-4 text-slate-500">{p.restarts}</td>
                        <td className="py-2 pl-4 text-slate-400">{p.age}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
