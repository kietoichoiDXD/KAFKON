import React, { useEffect, useState } from 'react';
import { API, safeFetchJson, isGitHubPages } from '../api';
import {
  MOCK_SLACK_CHANNELS,
  MOCK_SLACK_THREADS,
  MOCK_RUN_RESULT,
} from '../data/mockOps';

type Health = {
  mode: string;
  analysis: string;
  tier: string;
  slack: boolean;
  clickup: boolean;
  exa: boolean;
};

type Channel = { id: string; name: string };
type Evidence = {
  label: string;
  field: string;
  value: string;
  quote_source?: string | null;
  source_message?: {
    message_id: string;
    author: string;
    timestamp: string;
    excerpt: string;
    thread_url: string | null;
    match_status: 'matched' | 'unmatched';
  } | null;
};

type RunResult = {
  permalink: string;
  messages_read: number;
  story: { title: string; as_a: string; i_want: string; so_that: string };
  invest: { overall: number };
  engine: string;
  evidence: Evidence[];
  clarifying_question?: string | null;
  ticket?: { id: string; url: string; title: string };
};

const LABEL_STYLE: Record<string, string> = {
  Verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Inferred: 'bg-amber-50 text-amber-700 border-amber-200',
  Assumed: 'bg-purple-50 text-purple-700 border-purple-200',
  Blocked: 'bg-rose-50 text-rose-700 border-rose-200',
};

const PRESETS = [
  {
    label: 'Lean MVP Ticket',
    skill: 'startup_lean',
    prompt: 'Summarise this thread as an MVP story, label every claim, and file it in ClickUp.',
  },
  {
    label: 'Contract Specification',
    skill: 'agency_detailed',
    prompt: 'Write a billable feature spec with explicit in-scope and out-of-scope boundaries.',
  },
  {
    label: 'Standard Scrum Story',
    skill: 'default',
    prompt: 'Draft a standard user story with Given/When/Then acceptance criteria.',
  },
];

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        on ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-300'
      }`}
    />
  );
}

export function LiveRunView() {
  const [health, setHealth] = useState<Health | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channel, setChannel] = useState('');
  const [ts, setTs] = useState('');
  const [skill, setSkill] = useState('startup_lean');
  const [skills, setSkills] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [threads, setThreads] = useState<{ ts: string; text: string; reply_count: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [isDemo, setIsDemo] = useState<boolean>(isGitHubPages());
  const active = PRESETS.find(p => p.skill === skill) ?? PRESETS[0];

  const loadThreads = (ch: string) => {
    if (!ch) return;
    safeFetchJson<any[]>(`${API}/api/slack/threads?channel=${encodeURIComponent(ch)}`).then(res => {
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        setThreads(res.data);
      } else {
        setThreads(MOCK_SLACK_THREADS);
      }
    });
  };

  useEffect(() => {
    safeFetchJson<Health>(`${API}/api/health`).then(res => {
      if (res.ok && res.data) {
        setHealth(res.data);
      } else {
        setIsDemo(true);
        setHealth({
          mode: 'simulation',
          analysis: 'Sample mode',
          tier: 'offline',
          slack: false,
          clickup: false,
          exa: false,
        });
      }
    });

    safeFetchJson<Channel[]>(`${API}/api/slack/channels`).then(res => {
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        setChannels(res.data);
        const defaultCh = res.data.find((x: any) => x.name === 'all-aiops')?.id || res.data[0].id;
        setChannel(defaultCh);
        loadThreads(defaultCh);
      } else {
        setChannels(MOCK_SLACK_CHANNELS);
        setChannel(MOCK_SLACK_CHANNELS[0].id);
        setThreads(MOCK_SLACK_THREADS);
        setTs(MOCK_SLACK_THREADS[0].ts);
      }
    });

    safeFetchJson<any[]>(`${API}/api/skills`).then(res => {
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        setSkills(res.data.map((x: any) => x.name));
      } else {
        setSkills(['startup_lean', 'agency_detailed', 'default', 'systematic-debugging', 'red-team-tactics']);
      }
    });
  }, []);

  const handleChannelChange = (newCh: string) => {
    setChannel(newCh);
    setTs('');
    setSeedStatus(null);
    loadThreads(newCh);
  };

  const seedThread = async () => {
    if (!channel) return;
    setSeeding(true);
    setError(null);
    setSeedStatus(null);
    try {
      const res = await safeFetchJson<any>(`${API}/api/slack/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      if (res.ok && res.data && !res.data.error) {
        setTs(res.data.ts);
        setSeedStatus(
          `Seeded sample thread (${res.data.messages_count} msgs) in #${
            channels.find(c => c.id === channel)?.name || channel
          }. Thread ts: ${res.data.ts}`
        );
        loadThreads(channel);
      } else {
        setIsDemo(true);
        const mockTs = `179228${Math.floor(1000 + Math.random() * 9000)}.${Math.floor(
          100000 + Math.random() * 900000
        )}`;
        setTs(mockTs);
        setSeedStatus(
          `Seeded sample thread (5 msgs) in #${
            channels.find(c => c.id === channel)?.name || channel
          }. Thread ts: ${mockTs}`
        );
        setThreads(prev => [
          {
            ts: mockTs,
            text: '@alex_lead: Acme Corp requires Google Workspace SSO with @acmecorp.com domain restriction...',
            reply_count: 5,
          },
          ...prev,
        ]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSeeding(false);
    }
  };

  const run = async () => {
    if (!ts || !channel) {
      setError('Select a channel and thread timestamp (or click Seed Sample Thread).');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await safeFetchJson<RunResult>(`${API}/api/slack-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, ts, skill }),
      });
      if (res.ok && res.data) {
        setResult(res.data);
      } else {
        setIsDemo(true);
        await new Promise(r => setTimeout(r, 800));
        setResult({
          ...MOCK_RUN_RESULT,
          engine: 'Nebius (Qwen-30B) / OpenRouter cascade',
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 bg-slate-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Live Execution & Telemetry
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Ingest active Slack discussions, synthesize verifiable Agile requirements, and synchronize
            directly to ClickUp with zero-hallucination guardrails.
          </p>
        </div>

        {isDemo && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-slate-200 rounded-xl text-xs border border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-teal-950 text-teal-300 border border-teal-700 font-mono">
                LOCAL SIMULATION
              </span>
              <span className="text-slate-500">
                Showing built-in sample channels and thread data. Connect the API to use a live workspace.
              </span>
            </div>
          </div>
        )}

        {/* System Health Strip */}
        {health && (
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-700 border border-slate-200 rounded-xl px-4 py-3 bg-white">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium">
                <Dot on={health.slack} /> Slack Bolt
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Dot on={health.clickup} /> ClickUp Sync
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Dot on={health.exa} /> Exa Grounding
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
              <span>Engine:</span>
              <span className="text-slate-800 font-semibold">{health.analysis}</span>
              <span>·</span>
              <span>Tier: {health.tier}</span>
            </div>
          </div>
        )}

        {/* Configuration Panel */}
        <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-xs font-semibold text-slate-700">
              Channel Destination
              <select
                value={channel}
                onChange={e => handleChannelChange(e.target.value)}
                className="mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-800 focus-ring"
              >
                {channels.map(c => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="text-xs font-semibold text-slate-700 md:col-span-2">
              <div className="flex items-center justify-between">
                <span>Thread Timestamp (Target)</span>
                <button
                  type="button"
                  onClick={seedThread}
                  disabled={seeding || !channel}
                  className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-0.5 rounded transition-all disabled:opacity-40 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">add_circle</span>
                  {seeding ? 'Seeding...' : 'Seed Sample Thread (1-Click)'}
                </button>
              </div>
              <input
                value={ts}
                onChange={e => setTs(e.target.value)}
                placeholder="e.g. 1792281644.225409"
                className="mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono bg-white focus-ring"
              />
            </div>
          </div>

          {/* Quick Thread Selector */}
          {threads.length > 0 && (
            <div className="pt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="shrink-0 font-medium text-slate-700">Select Thread:</span>
              <select
                onChange={e => e.target.value && setTs(e.target.value)}
                value={threads.some(t => t.ts === ts) ? ts : ''}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 truncate font-mono"
              >
                <option value="">-- Or choose from existing channel threads --</option>
                {threads.map(t => (
                  <option key={t.ts} value={t.ts}>
                    {t.ts} ({t.reply_count} replies) — {t.text}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700 mb-2">Preset Extraction Strategies</div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setSkill(p.skill)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    skill === p.skill
                      ? 'border-teal-600 bg-teal-50 text-teal-800 font-semibold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 italic mt-2">"{active.prompt}"</p>
          </div>

          {seedStatus && (
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-emerald-600 shrink-0">
                check_circle
              </span>
              <span>{seedStatus}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={run}
              disabled={running || !channel || !ts}
              className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold disabled:opacity-40 transition-all flex items-center gap-2"
            >
              {running && (
                <span className="animate-spin material-symbols-outlined text-[16px]">
                  progress_activity
                </span>
              )}
              {running ? 'Extracting Requirements...' : 'Execute Ingestion & Synthesis'}
            </button>
            {ts && (
              <span className="text-xs text-slate-500 font-mono">
                Target: {ts}
              </span>
            )}
          </div>

          {error && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-rose-500 shrink-0 mt-0.5">
                error
              </span>
              <div>{error}</div>
            </div>
          )}
        </div>

        {/* Execution Result */}
        {result && (
          <div className="border border-slate-200 rounded-xl p-6 bg-white space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 m-0">
                  {result.story.title}
                </h2>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Engine: {result.engine} · Messages Read: {result.messages_read}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg text-sm font-bold text-teal-700 font-mono">
                INVEST {result.invest.overall}/100
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed">
              <span className="font-semibold text-slate-900">As a</span> {result.story.as_a},{' '}
              <span className="font-semibold text-slate-900">I want</span> {result.story.i_want},{' '}
              <span className="font-semibold text-slate-900">So that</span> {result.story.so_that}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Verifiable Claims
              </div>
              <div className="space-y-2">
                {result.evidence.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 text-xs"
                  >
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border uppercase tracking-wider shrink-0 ${
                        LABEL_STYLE[e.label] || 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {e.label}
                    </span>
                    <div className="text-slate-800">
                      <span className="font-semibold text-slate-900">{e.field}:</span> {e.value}
                      {e.quote_source && (
                        e.source_message?.match_status === 'matched' ? (
                          <blockquote className="mt-1 m-0 rounded border border-slate-200 bg-white p-2">
                            <div className="mb-1 flex flex-wrap items-center gap-x-2 text-[11px] not-italic text-slate-500">
                              {e.source_message.author && <span className="font-semibold text-slate-700">{e.source_message.author}</span>}
                              {e.source_message.timestamp && <time>{e.source_message.timestamp}</time>}
                            </div>
                            <div className="text-[11px] italic text-slate-700">“{e.source_message.excerpt || e.quote_source}”</div>
                            {e.source_message.thread_url && <a href={e.source_message.thread_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium not-italic text-teal-700 hover:text-teal-800"><span className="material-symbols-outlined text-[14px]" aria-hidden="true">open_in_new</span>Open source thread</a>}
                          </blockquote>
                        ) : e.source_message?.match_status === 'unmatched' ? (
                          <div className="mt-1 rounded border border-amber-800/60 bg-slate-50 p-2">
                            <span className="inline-flex rounded border border-amber-800 bg-amber-950/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">Source not matched</span>
                            <div className="mt-1 text-[11px] italic text-slate-600">Unverified quote: “{e.quote_source}”</div>
                            {e.source_message.thread_url && <a href={e.source_message.thread_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-800"><span className="material-symbols-outlined text-[14px]" aria-hidden="true">open_in_new</span>Open thread</a>}
                          </div>
                        ) : (
                          <span className="mt-0.5 block text-[11px] italic text-slate-500">
                            — Quote: “{e.quote_source}”
                            {result.permalink && <a href={result.permalink} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 not-italic font-medium text-teal-700 hover:text-teal-800"><span className="material-symbols-outlined text-[13px]" aria-hidden="true">open_in_new</span>Open thread</a>}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {result.clarifying_question && (
              <div className="border border-rose-200 bg-rose-50 rounded-lg p-3 text-xs text-rose-900 flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-rose-600 shrink-0">
                  info
                </span>
                <div>
                  <span className="font-bold">Automated Blocker Clarification:</span>{' '}
                  {result.clarifying_question}
                </div>
              </div>
            )}

            {result.ticket && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <a
                  href={result.ticket.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>
                    ClickUp Ticket #{result.ticket.id} — {result.ticket.title}
                  </span>
                </a>
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Synchronized
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
