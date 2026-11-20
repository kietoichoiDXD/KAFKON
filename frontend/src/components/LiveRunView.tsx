import React, { useEffect, useState } from 'react';
import { API, safeFetchJson, isGitHubPages } from '../api';
import {
  MOCK_SLACK_CHANNELS,
  MOCK_SLACK_THREADS,
} from '../data/mockOps';

type Health = {
  mode: string;
  analysis: string;
  tier: string;
  slack: boolean;
  discord?: boolean;
  telegram?: boolean;
  clickup: boolean;
  exa: boolean;
  openrouter?: boolean;
  openai?: boolean;
  nebius?: boolean;
};

type Channel = { id: string; name: string };
type ThreadPreview = {
  permalink: string;
  messages: { author: string; timestamp: string; text: string }[];
};
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
  ticket_error?: string;
};

function parseSlackTarget(value: string): { channel: string; timestamp?: string } | null {
  const input = value.trim();
  if (/^[CDG][A-Z0-9]{6,}$/.test(input)) return { channel: input };
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== 'slack.com' && !host.endsWith('.slack.com')) return null;

  const archive = url.pathname.match(/\/archives\/([CDG][A-Z0-9]+)\/p(\d{10,})/i);
  if (archive) {
    const digits = archive[2];
    return { channel: archive[1], timestamp: `${digits.slice(0, 10)}.${digits.slice(10).padEnd(6, '0').slice(0, 6)}` };
  }

  const clientThread = url.pathname.match(/\/client\/[^/]+\/([CDG][A-Z0-9]+)\/thread\/[CDG][A-Z0-9]+-(\d{10}\.\d{1,6})/i);
  if (clientThread) return { channel: clientThread[1], timestamp: clientThread[2] };

  const client = url.pathname.match(/\/client\/[^/]+\/([CDG][A-Z0-9]+)/i);
  const channel = client?.[1] || url.searchParams.get('channel');
  const rawTs = url.searchParams.get('thread_ts') || url.searchParams.get('ts') || '';
  if (channel && /^[CDG][A-Z0-9]+$/i.test(channel)) {
    return { channel, ...(rawTs ? { timestamp: rawTs } : {}) };
  }
  return null;
}

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

export function LiveRunView({ onOpenConnections }: { onOpenConnections?: () => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channel, setChannel] = useState('');
  const [channelLink, setChannelLink] = useState('');
  const [channelLinkError, setChannelLinkError] = useState('');
  const [ts, setTs] = useState('');
  const [skill, setSkill] = useState('startup_lean');
  const [skills, setSkills] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [threads, setThreads] = useState<{ ts: string; text: string; reply_count: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [preview, setPreview] = useState<ThreadPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState<boolean>(isGitHubPages());
  const active = PRESETS.find(p => p.skill === skill) ?? PRESETS[0];

  const loadThreads = (ch: string) => {
    if (!ch) return;
    safeFetchJson<any[]>(`${API}/api/slack/threads?channel=${encodeURIComponent(ch)}`).then(res => {
      if (res.ok && Array.isArray(res.data)) {
        setThreads(res.data);
        if (!res.data.length) setError('No threads were returned for this channel. Paste a message permalink or choose another channel.');
      } else if (isDemo) {
        setThreads(MOCK_SLACK_THREADS);
      } else {
        setThreads([]);
        setError(res.error || 'Could not load Slack threads. Check the integration and channel permissions.');
      }
    });
  };

  useEffect(() => {
    safeFetchJson<Health>(`${API}/api/health`).then(res => {
      if (res.ok && res.data) {
        setHealth(res.data);
        setIsDemo(!res.data.slack);
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
      } else if (isDemo) {
        setChannels(MOCK_SLACK_CHANNELS);
        setChannel(MOCK_SLACK_CHANNELS[0].id);
        setThreads(MOCK_SLACK_THREADS);
        setTs(MOCK_SLACK_THREADS[0].ts);
      } else {
        setChannels([]);
        setThreads([]);
        setError(res.error || 'No Slack channels are available to this integration. Check channel scopes and bot membership.');
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
    setError(null);
    setPreview(null);
    setPreviewError(null);
    setResult(null);
    loadThreads(newCh);
  };

  const useChannelLink = () => {
    const target = parseSlackTarget(channelLink);
    if (!target) {
      setChannelLinkError('Paste a Slack channel/message link or channel ID. The Slack integration must already be authorized and have access.');
      return;
    }
    setChannelLinkError('');
    setChannel(target.channel);
    setTs(target.timestamp || '');
    setResult(null);
    setPreview(null);
    setPreviewError(null);
    setError(null);
    setSeedStatus(null);
    loadThreads(target.channel);
  };

  const readThread = async () => {
    if (!channel || !ts) {
      setPreviewError('Paste a message permalink or choose a thread before reading it.');
      return;
    }
    if (isDemo || !health?.slack) {
      setPreviewError('A live Slack connection is not available in this session. Connect the backend Slack integration before reading a real thread.');
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);
    setResult(null);
    const url = new URL(`${API}/api/slack/thread`, window.location.origin);
    url.searchParams.set('channel', channel);
    url.searchParams.set('ts', ts);
    const response = await safeFetchJson<ThreadPreview>(url.toString());
    if (!response.ok || !response.data) {
      setPreviewError(response.error || 'Could not read this Slack thread. Verify the link and bot permissions.');
    } else if (!response.data.messages?.length) {
      setPreviewError('Slack returned no messages for this thread. Check that the timestamp points to a thread root and the integration can read its messages.');
    } else {
      setPreview(response.data);
    }
    setPreviewLoading(false);
  };

  const seedThread = async () => {
    if (!channel) return;
    if (isDemo || !health?.slack) {
      setError('Sample seeding is unavailable without a live Slack connection.');
      return;
    }
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
        setError(res.error || 'Could not seed a Slack sample thread. No sample data was substituted.');
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
    if (!preview) {
      setError('Read and review the Slack thread before starting analysis.');
      setRunning(false);
      return;
    }
    try {
      const res = await safeFetchJson<RunResult>(`${API}/api/slack-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, ts, skill }),
      });
      if (res.ok && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || 'The live Slack analysis failed. No sample result was substituted.');
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Live Execution & Telemetry
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Ingest active Slack discussions, synthesize verifiable Agile requirements, and synchronize
              directly to ClickUp with evidence for review.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenConnections}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-teal-700 hover:text-teal-900"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">cable</span>
            Configure integrations
          </button>
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
                <Dot on={health.discord ?? false} /> Discord
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Dot on={health.telegram ?? false} /> Telegram
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Dot on={Boolean(health.openrouter || health.openai || health.nebius)} /> AI providers
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
                {channel && !channels.some(c => c.id === channel) && (
                  <option value={channel}>#{channel} · selected from link</option>
                )}
                {channels.map(c => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="text-xs font-semibold text-slate-700 md:col-span-2">
              <label htmlFor="slack-channel-link">Paste Slack channel link</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input
                  id="slack-channel-link"
                  value={channelLink}
                  onChange={e => { setChannelLink(e.target.value); setChannelLinkError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); useChannelLink(); } }}
                  placeholder="https://app.slack.com/client/T…/C… or channel ID"
                  className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-800 focus-ring"
                />
                <button
                  type="button"
                  onClick={useChannelLink}
                  className="rounded-lg border border-teal-700 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                >
                  Use link
                </button>
              </div>
              <p className="mb-0 mt-1.5 font-normal leading-relaxed text-slate-500">
                A channel link loads its thread list. A message permalink selects its thread directly. Neither link signs in or grants access; a workspace administrator must configure Slack access.
              </p>
              {channelLinkError && <p role="alert" className="mb-0 mt-1.5 font-normal text-rose-700">{channelLinkError}</p>}
            </div>

            <div className="text-xs font-semibold text-slate-700 md:col-span-2">
              <div className="flex items-center justify-between">
                <span>Thread Timestamp (Target)</span>
                <button
                  type="button"
                  onClick={seedThread}
                  disabled={seeding || !channel || isDemo || !health?.slack}
                  className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-0.5 rounded transition-all disabled:opacity-40 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">add_circle</span>
                  {seeding ? 'Seeding...' : 'Seed Sample Thread (1-Click)'}
                </button>
              </div>
              <input
                value={ts}
                onChange={e => { setTs(e.target.value); setPreview(null); setPreviewError(null); setResult(null); }}
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
                onChange={e => {
                  if (e.target.value) {
                    setTs(e.target.value);
                    setPreview(null);
                    setPreviewError(null);
                    setResult(null);
                  }
                }}
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

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={readThread}
              disabled={previewLoading || isDemo || !health?.slack || !channel || !ts}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:border-teal-700 hover:text-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {previewLoading ? 'Reading Slack thread…' : 'Read thread'}
            </button>
            {!health?.slack && !isDemo && <span className="text-xs text-amber-800">Slack is not connected.</span>}
            {previewError && <p role="alert" className="mb-0 text-xs text-rose-700">{previewError}</p>}
          </div>

          {preview && (
            <section className="rounded-xl border border-teal-200 bg-teal-50/40" aria-label="Slack thread preview">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100 px-4 py-3">
                <div>
                  <h2 className="m-0 text-sm font-semibold text-slate-900">Live Slack thread preview</h2>
                  <p className="mb-0 mt-1 text-xs text-slate-600">{preview.messages.length} messages · {channel} · {ts}</p>
                </div>
                {preview.permalink && <a href={preview.permalink} target="_blank" rel="noreferrer" className="text-xs font-semibold text-teal-800 underline">Open in Slack ↗</a>}
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto p-3" aria-live="polite">
                {preview.messages.map((message, index) => (
                  <article key={`${message.timestamp}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-[11px] text-slate-500">
                      <strong className="text-slate-800">{message.author || 'Unknown speaker'}</strong>
                      <time>{message.timestamp}</time>
                    </div>
                    <p className="mb-0 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">{message.text}</p>
                  </article>
                ))}
              </div>
              <div className="border-t border-teal-100 px-4 py-3">
                <p className="mb-3 text-xs leading-relaxed text-slate-600">
                  Review the source before continuing. The next action posts the analysis to this Slack thread and attempts to create a task in the configured ClickUp list.
                </p>
                <button
                  type="button"
                  onClick={run}
                  disabled={running || !preview || isDemo || Boolean(result)}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running && <span className="material-symbols-outlined animate-spin text-base" aria-hidden="true">progress_activity</span>}
                  {running ? 'Analyzing and filing…' : result ? 'Analysis complete' : 'Analyze, reply & create ClickUp task'}
                </button>
              </div>
            </section>
          )}

          <div className="flex items-center gap-3 pt-2">
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

          {result?.ticket_error && (
            <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Analysis completed, but ClickUp task creation failed: {result.ticket_error}
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
