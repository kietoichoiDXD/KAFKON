import React, { useEffect, useRef, useState } from 'react';
import { API, getApiUrl, safeFetchJson, safeRender } from '../api';
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
type PlatformCredentialStatus = {
  configured: boolean;
  verified: boolean;
  workspace_id?: string | null;
  workspace?: string | null;
  account?: string | null;
  error?: string;
};
type SocialConnectionStatus = {
  slack: PlatformCredentialStatus;
  discord: PlatformCredentialStatus;
  telegram: PlatformCredentialStatus;
  note?: string;
};
type SlackOAuthStatus = {
  configured: boolean;
  verified: boolean;
  oauth_enabled?: boolean;
  active_team_id?: string | null;
  legacy_env_token?: boolean;
  workspaces?: { team_id: string; team: string; account?: string }[];
};
type ConnectionFeedback = { kind: 'checking' | 'success' | 'error'; message: string };
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

type DecomposedTask = {
  id: string;
  title: string;
  owner?: string | null;
  description?: string;
  category?: string;
  priority?: string;
};

type NoiseAuditItem = {
  author?: string;
  timestamp?: string;
  text?: string;
  noise_category?: string;
  reason?: string;
};

type MultiAgentTelemetry = {
  pipeline_name?: string;
  noise_filtered_count?: number;
  quarantined_noise?: NoiseAuditItem[];
  tasks_decomposed_count?: number;
  hallucination_check_status?: string;
  agent_execution_order?: string[];
  audit_notes?: string[];
};

type RunResult = {
  permalink: string;
  messages_read: number;
  story: { title: string; as_a: string; i_want: string; so_that: string };
  invest: { overall: number };
  engine: string;
  evidence: Evidence[];
  decomposed_tasks?: DecomposedTask[];
  agent_telemetry?: MultiAgentTelemetry;
  clarifying_question?: string | null;
  ticket?: { id: string; url: string; title: string };
  ticket_error?: string;
};

function parseSlackTarget(value: string): { channel: string; timestamp?: string; workspaceId?: string; workspaceSlug?: string } | null {
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
  const workspaceSlug = host.endsWith('.slack.com') && host !== 'app.slack.com' ? host.slice(0, -'.slack.com'.length) : undefined;

  const archive = url.pathname.match(/\/archives\/([CDG][A-Z0-9]+)\/p(\d{10,})/i);
  if (archive) {
    const digits = archive[2];
    const workspaceId = url.searchParams.get('team') || undefined;
    return { channel: archive[1], timestamp: `${digits.slice(0, 10)}.${digits.slice(10).padEnd(6, '0').slice(0, 6)}`, ...(workspaceId ? { workspaceId } : {}), ...(workspaceSlug ? { workspaceSlug } : {}) };
  }

  const clientThread = url.pathname.match(/\/client\/([^/]+)\/([CDG][A-Z0-9]+)\/thread\/[CDG][A-Z0-9]+-(\d{10}\.\d{1,6})/i);
  if (clientThread) return { channel: clientThread[2], timestamp: clientThread[3], workspaceId: clientThread[1], ...(workspaceSlug ? { workspaceSlug } : {}) };

  const client = url.pathname.match(/\/client\/([^/]+)\/([CDG][A-Z0-9]+)/i);
  const channel = client?.[2] || url.searchParams.get('channel');
  const rawTs = url.searchParams.get('thread_ts') || url.searchParams.get('ts') || '';
  if (channel && /^[CDG][A-Z0-9]+$/i.test(channel)) {
    return { channel, ...(rawTs ? { timestamp: rawTs } : {}), ...(client?.[1] ? { workspaceId: client[1] } : {}), ...(workspaceSlug ? { workspaceSlug } : {}) };
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
  const [socialConnections, setSocialConnections] = useState<SocialConnectionStatus | null>(null);
  const [slackOAuthStatus, setSlackOAuthStatus] = useState<SlackOAuthStatus | null>(null);
  const [pendingSlackTarget, setPendingSlackTarget] = useState<ReturnType<typeof parseSlackTarget>>(null);
  const [pendingSlackUrl, setPendingSlackUrl] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channel, setChannel] = useState('');
  const [channelLink, setChannelLink] = useState(() => localStorage.getItem('scribeba.live.channel_link') || '');
  const [channelLinkError, setChannelLinkError] = useState('');
  const [connectionFeedback, setConnectionFeedback] = useState<ConnectionFeedback | null>(null);
  const [ts, setTs] = useState(() => localStorage.getItem('scribeba.live.ts') || '');
  const [skill, setSkill] = useState(() => localStorage.getItem('scribeba.live.skill') || 'startup_lean');
  const [skills, setSkills] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [threads, setThreads] = useState<{
    ts: string;
    text: string;
    reply_count: number;
    signal_level?: 'high' | 'medium' | 'low';
    is_feature?: boolean;
    topic?: string;
    has_noise?: boolean;
  }[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [onlyFeatureThreads, setOnlyFeatureThreads] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [preview, setPreview] = useState<ThreadPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState<boolean>(() => new URLSearchParams(window.location.search).get('demo') === '1');
  const threadRequestId = useRef(0);
  const previewRequestId = useRef(0);
  const selectionRevision = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const active = PRESETS.find(p => p.skill === skill) ?? PRESETS[0];

  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  // Persist form inputs to prevent data loss across navigation and refreshes
  useEffect(() => {
    localStorage.setItem('scribeba.live.channel_link', channelLink);
  }, [channelLink]);

  useEffect(() => {
    localStorage.setItem('scribeba.live.ts', ts);
  }, [ts]);

  useEffect(() => {
    localStorage.setItem('scribeba.live.skill', skill);
  }, [skill]);

  const loadThreads = async (ch: string, directMessageLink = false, announceConnection = false, teamId?: string) => {
    const requestId = ++threadRequestId.current;
    if (!ch) {
      setThreads([]);
      setThreadsLoading(false);
      return;
    }
    setThreads([]);
    setThreadsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ channel: ch });
      if (teamId || pendingSlackTarget?.workspaceId) query.set('team_id', teamId || pendingSlackTarget!.workspaceId!);
      const res = await safeFetchJson<any[]>(`${API}/api/slack/threads?${query.toString()}`);
      if (requestId !== threadRequestId.current) return;
      if (res.ok && Array.isArray(res.data)) {
        setThreads(res.data);
        if (!ts && res.data.length > 0) {
          const best = res.data.find((t: any) => t.signal_level === 'high') || res.data.find((t: any) => t.reply_count > 0) || res.data[0];
          if (best?.ts) {
            setTs(best.ts);
          }
        }
        if (announceConnection) {
          const channelName = channels.find(item => item.id === ch)?.name || ch;
          setConnectionFeedback({
            kind: 'success',
            message: `Slack channel #${channelName} is accessible. ${res.data.length} recent thread${res.data.length === 1 ? '' : 's'} loaded.`,
          });
        }
        if (!res.data.length && !directMessageLink) {
          setError(`Slack access to ${ch} is working, but no recent thread roots were returned. Paste a message permalink or choose a channel with messages.`);
        }
      } else if (isDemo && MOCK_SLACK_CHANNELS.some(mock => mock.id === ch)) {
        setThreads(MOCK_SLACK_THREADS);
        if (announceConnection) {
          setConnectionFeedback({ kind: 'error', message: 'This is a local sample channel; no live Slack connection was checked.' });
        }
      } else {
        setThreads([]);
        const message = res.error || `Could not read channel ${ch}. The configured Slack credentials must belong to that workspace, and the app must be a member of the channel.`;
        setError(message);
        if (announceConnection) setConnectionFeedback({ kind: 'error', message });
      }
      setThreadsLoading(false);
    } catch (e: any) {
      if (requestId !== threadRequestId.current) return;
      setThreads([]);
      setThreadsLoading(false);
      const message = e?.message || `Could not read channel ${ch}. Check the Slack workspace and channel permissions.`;
      setError(message);
      if (announceConnection) setConnectionFeedback({ kind: 'error', message });
    }
  };

  const loadChannels = async (teamId?: string, requestedChannel?: string) => {
    const query = new URLSearchParams();
    if (teamId) query.set('team_id', teamId);
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : '';
    const res = await safeFetchJson<Channel[]>(`${API}/api/slack/channels${suffix}`);
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      setChannels(res.data);
      const chosenChannel = (requestedChannel && res.data.some(item => item.id === requestedChannel))
        ? requestedChannel
        : (channel && res.data.some(item => item.id === channel))
          ? channel
          : res.data[0].id;
      setChannel(chosenChannel);
      void loadThreads(chosenChannel, false, true, teamId);
      return true;
    }
    setChannels([]);
    setChannel('');
    setThreads([]);
    setError(res.error || 'Could not load channels for this Slack workspace.');
    return false;
  };

  const beginSlackOAuth = (target: NonNullable<ReturnType<typeof parseSlackTarget>>, link = '') => {
    if (!slackOAuthStatus?.oauth_enabled) {
      setChannelLinkError('Slack OAuth is not enabled on this server yet. Ask an administrator to configure the Slack OAuth app.');
      return;
    }
    sessionStorage.setItem('scribeba.slack.pending-target', JSON.stringify(target));
    if (link) sessionStorage.setItem('scribeba.slack.pending-link', link);
    const apiBase = getApiUrl() || window.location.origin;
    const start = new URL('/api/slack/oauth/start', apiBase);
    const returnPath = `${window.location.pathname}?view=live`;
    start.searchParams.set('return_to', apiBase === window.location.origin ? returnPath : `${window.location.origin}${returnPath}`);
    if (target.workspaceId) start.searchParams.set('team_id', target.workspaceId);
    if (link && !target.workspaceId && /(^|\.)slack\.com\//i.test(link.replace(/^https?:\/\//i, ''))) start.searchParams.set('link', link);
    window.location.assign(start.toString());
  };

  const clearSelectedThread = () => {
    previewRequestId.current += 1;
    setTs('');
    setSeedStatus(null);
    setPreview(null);
    setPreviewLoading(false);
    setPreviewError(null);
    setResult(null);
    setError(null);
    setConnectionFeedback(null);
  };

  useEffect(() => {
    safeFetchJson<Health>(`${API}/api/health`).then(res => {
      if (res.ok && res.data) {
        setHealth(res.data);
        setIsDemo(new URLSearchParams(window.location.search).get('demo') === '1');
      } else {
        setIsDemo(new URLSearchParams(window.location.search).get('demo') === '1');
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

    safeFetchJson<SocialConnectionStatus>(`${API}/api/social/connection-status`).then(res => {
      if (res.ok && res.data) setSocialConnections(res.data);
    });

    safeFetchJson<SlackOAuthStatus>(`${API}/api/slack/connection-status`).then(async res => {
      const status = res.ok && res.data ? res.data : null;
      if (status) setSlackOAuthStatus(status);
      const params = new URLSearchParams(window.location.search);
      const connected = params.get('slack_connected') === '1';
      const oauthError = params.get('slack_error');
      let target: ReturnType<typeof parseSlackTarget> = null;
      try { target = JSON.parse(sessionStorage.getItem('scribeba.slack.pending-target') || 'null'); } catch { target = null; }
      const pendingLink = sessionStorage.getItem('scribeba.slack.pending-link') || '';
      if (oauthError) {
        setPendingSlackTarget(target);
        setPendingSlackUrl(pendingLink);
        setConnectionFeedback({ kind: 'error', message: `Slack authorization failed (${oauthError}). You can retry connecting the workspace.` });
      }
      if (connected) {
        setConnectionFeedback({ kind: 'success', message: 'Slack workspace connected. Choose a channel, or use the pasted link to open its channel.' });
        sessionStorage.removeItem('scribeba.slack.pending-target');
        sessionStorage.removeItem('scribeba.slack.pending-link');
        if (target) {
          const targetTeamId = target.workspaceId || status?.active_team_id || undefined;
          const restoredTarget = { ...target, ...(targetTeamId ? { workspaceId: targetTeamId } : {}) };
          setPendingSlackTarget(restoredTarget);
          setPendingSlackUrl(pendingLink);
          setTs(target.timestamp || '');
          const loaded = await loadChannels(targetTeamId, target.channel);
          if (loaded) void loadThreads(target.channel, Boolean(target.timestamp), true, targetTeamId);
          else setChannelLinkError(`Connected to Slack, but channel ${target.channel} was not returned. Choose a channel from this workspace's list.`);
        } else {
          setPendingSlackTarget(null);
          await loadChannels(status?.active_team_id || undefined);
        }
        params.delete('slack_connected');
        params.delete('slack_error');
        params.set('view', 'live');
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
      } else if (status?.active_team_id) {
        await loadChannels(status.active_team_id);
      } else if (!isDemo) {
        await loadChannels();
      } else {
        setChannels(MOCK_SLACK_CHANNELS);
        setChannel(MOCK_SLACK_CHANNELS[0].id);
        setThreads(MOCK_SLACK_THREADS);
        setTs(MOCK_SLACK_THREADS[0]?.ts || '');
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
    selectionRevision.current += 1;
    clearSelectedThread();
    setChannel(newCh);
    setConnectionFeedback({ kind: 'checking', message: `Checking access to Slack channel ${newCh}…` });
    void loadThreads(newCh, false, true);
  };

  const useChannelLink = () => {
    const target = parseSlackTarget(channelLink);
    if (!target) {
      setChannelLinkError('Paste a Slack channel/message link or channel ID. The Slack integration must already be authorized and have access.');
      setConnectionFeedback({ kind: 'error', message: 'Slack link format was not recognized.' });
      return;
    }
    setChannelLinkError('');
    selectionRevision.current += 1;
    clearSelectedThread();
    setThreads([]);
    const installedWorkspace = target.workspaceSlug
      ? slackOAuthStatus?.workspaces?.find(item => item.team.toLowerCase().replace(/[^a-z0-9]/g, '') === target.workspaceSlug?.toLowerCase().replace(/[^a-z0-9]/g, ''))
      : undefined;
    const resolvedTeamId = target.workspaceId || installedWorkspace?.team_id || slackOAuthStatus?.active_team_id || undefined;
    const resolvedTarget = { ...target, ...(resolvedTeamId ? { workspaceId: resolvedTeamId } : {}) };
    const installed = Boolean(
      resolvedTeamId &&
      (
        slackOAuthStatus?.active_team_id === resolvedTeamId ||
        slackOAuthStatus?.workspaces?.some(item => item.team_id === resolvedTeamId) ||
        slackOAuthStatus?.verified ||
        socialConnections?.slack.verified
      )
    );
    const needsWorkspaceSelection = !target.workspaceId && !target.workspaceSlug && !slackOAuthStatus?.active_team_id;
    if ((target.workspaceId && !installed) || (!installed && !slackOAuthStatus?.verified) || needsWorkspaceSelection) {
      setChannel('');
      setPendingSlackTarget(resolvedTarget);
      setPendingSlackUrl(channelLink.trim());
      setChannelLinkError(!slackOAuthStatus?.oauth_enabled
        ? 'This Slack workspace is not authorized, and OAuth is not enabled on the server. Ask an administrator to configure the Slack OAuth app.'
        : needsWorkspaceSelection
          ? 'This channel ID does not identify its workspace. Connect Slack and choose the workspace before ScribeBA checks it.'
          : 'This channel belongs to a workspace that is not authorized in this session. Connect it to continue; Slack will ask you to sign in and approve access.');
      setConnectionFeedback({ kind: 'checking', message: `Authorization is needed for ${target.workspaceSlug || target.workspaceId || 'a Slack workspace'}.` });
      return;
    }
    setPendingSlackTarget(resolvedTeamId ? resolvedTarget : null);
    setPendingSlackUrl(resolvedTeamId ? channelLink.trim() : '');
    setChannel(target.channel);
    setTs(target.timestamp || '');
    setConnectionFeedback({ kind: 'checking', message: `Checking Slack access for channel ${target.channel}…` });
    void loadChannels(resolvedTeamId, target.channel).then(loaded => {
      setChannel(target.channel);
      void loadThreads(target.channel, Boolean(target.timestamp), true, resolvedTeamId);
    });
  };

  const readThread = async () => {
    if (!channel || !ts) {
      setPreviewError('Paste a message permalink or choose a thread before reading it.');
      return;
    }
    if (isDemo || (!health?.slack && !slackOAuthStatus?.active_team_id)) {
      setPreviewError('A live Slack connection is not available in this session. Connect the backend Slack integration before reading a real thread.');
      return;
    }
    const requestId = ++previewRequestId.current;
    const requestedChannel = channel;
    const requestedTimestamp = ts;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);
    setResult(null);
    const url = new URL(`${API}/api/slack/thread`, window.location.origin);
    url.searchParams.set('channel', requestedChannel);
    url.searchParams.set('ts', requestedTimestamp);
    if (pendingSlackTarget?.workspaceId) url.searchParams.set('team_id', pendingSlackTarget.workspaceId);
    const response = await safeFetchJson<ThreadPreview>(url.toString());
    if (requestId !== previewRequestId.current) return;
    if (!response.ok || !response.data) {
      const message = response.error || `Could not read thread ${requestedTimestamp} in ${requestedChannel}. Confirm this Slack integration can access that workspace and channel.`;
      setPreviewError(message);
      setConnectionFeedback({ kind: 'error', message });
    } else if (!response.data.messages?.length) {
      const message = 'Slack returned no messages for this thread. Check that the timestamp points to a thread root and the integration can read its messages.';
      setPreviewError(message);
      setConnectionFeedback({ kind: 'error', message });
    } else {
      setPreview(response.data);
      setConnectionFeedback({
        kind: 'success',
        message: `Slack connection confirmed: read ${response.data.messages.length} messages from channel ${requestedChannel}.`,
      });
    }
    setPreviewLoading(false);
  };

  const seedThread = async () => {
    if (!channel) return;
    if (isDemo || (!health?.slack && !slackOAuthStatus?.active_team_id)) {
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
        body: JSON.stringify({ channel, ...(pendingSlackTarget?.workspaceId ? { team_id: pendingSlackTarget.workspaceId } : {}) }),
      });
      if (res.ok && res.data && !res.data.error) {
        previewRequestId.current += 1;
        setPreviewLoading(false);
        setTs(res.data.ts);
        setPreview(null);
        setPreviewError(null);
        setResult(null);
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
        body: JSON.stringify({ channel, ts, skill, ...(pendingSlackTarget?.workspaceId ? { team_id: pendingSlackTarget.workspaceId } : {}) }),
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
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-6 bg-slate-50">
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
              <span className="flex items-center gap-1.5 font-medium" title="This turns green only for a Slack workspace authorized in this browser session.">
                <Dot on={Boolean(slackOAuthStatus?.active_team_id && socialConnections?.slack.verified)} /> Slack workspace
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Dot on={socialConnections?.discord.verified ?? false} /> Discord bot
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Dot on={socialConnections?.telegram.verified ?? false} /> Telegram bot
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
        {(health?.slack || slackOAuthStatus?.active_team_id || slackOAuthStatus?.legacy_env_token) && (
          <p className="-mt-4 mb-0 text-[11px] leading-relaxed text-slate-500">
            {slackOAuthStatus?.legacy_env_token && !slackOAuthStatus?.active_team_id
              ? 'A fixed server token exists, but it is not treated as your connected workspace. Connect the workspace you intend to read. '
              : socialConnections?.slack.verified ? 'Slack workspace verified. ' : 'Connect a Slack workspace to read its channels. '}
            {slackOAuthStatus?.workspaces?.length ? `Authorized Slack workspaces: ${slackOAuthStatus.workspaces.map(workspace => workspace.team).join(', ')}. ` : ''}
            Links identify the channel; Slack asks you to sign in and approve access before this app can read it.
            {socialConnections?.slack.workspace && <> Connected workspace: <strong className="font-semibold text-slate-700">{socialConnections.slack.workspace}</strong>{socialConnections.slack.account ? ` · ${socialConnections.slack.account}` : ''}.</>}
            {socialConnections && (socialConnections.discord.verified || socialConnections.telegram.verified) && <> Discord/Telegram bot credentials are verified, but their channel reader is not available in this view yet.</>}
          </p>
        )}
        {socialConnections?.slack.verified && slackOAuthStatus?.active_team_id && pendingSlackTarget?.workspaceId && pendingSlackTarget.workspaceId !== slackOAuthStatus.active_team_id && (
          <div role="status" aria-live="polite" className="-mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            <span className="material-symbols-outlined mt-0.5 text-[16px]" aria-hidden="true">warning</span>
            <span>The current Slack connection is a different workspace from the pasted link. Authorize the workspace in that link before reading it.</span>
          </div>
        )}
        {socialConnections?.slack.verified && slackOAuthStatus?.active_team_id && (!pendingSlackTarget?.workspaceId || pendingSlackTarget.workspaceId === slackOAuthStatus.active_team_id) && (
          <div role="status" aria-live="polite" className="-mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
            <span className="material-symbols-outlined mt-0.5 text-[16px]" aria-hidden="true">check_circle</span>
            <span>Slack workspace connected: <strong>{socialConnections.slack.workspace || 'your workspace'}</strong>{socialConnections.slack.account ? ` (${socialConnections.slack.account})` : ''}. The selected channel is checked separately.</span>
          </div>
        )}
        {socialConnections && (
          <div className="-mt-3 grid gap-1 text-[11px] leading-relaxed text-slate-500 sm:grid-cols-3" aria-label="Social integration diagnostics">
            <span>Slack: {socialConnections.slack.verified && slackOAuthStatus?.active_team_id ? 'workspace verified' : socialConnections.slack.configured ? (socialConnections.slack.error || 'not connected to this browser session') : 'not connected'}</span>
            <span>Discord: {socialConnections.discord.verified ? 'bot credential verified; channel reader unavailable here' : socialConnections.discord.configured ? (socialConnections.discord.error || 'verification failed') : 'not configured'}</span>
            <span>Telegram: {socialConnections.telegram.verified ? 'bot credential verified; channel reader unavailable here' : socialConnections.telegram.configured ? (socialConnections.telegram.error || 'verification failed') : 'not configured'}</span>
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
                disabled={seeding}
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
                  disabled={seeding}
                  placeholder="https://app.slack.com/client/T…/C… or channel ID"
                  className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-800 focus-ring"
                />
                <button
                  type="button"
                  onClick={useChannelLink}
                  disabled={seeding}
                  className="rounded-lg border border-teal-700 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                >
                  Use link
                </button>
              </div>
              <p className="mb-0 mt-1.5 font-normal leading-relaxed text-slate-500">
                A link identifies a channel or thread. Slack sign-in and consent are required to access a workspace; pasting a link alone cannot authorize it.
              </p>
              {channelLinkError && <p role="alert" className="mb-0 mt-1.5 font-normal text-rose-700">{channelLinkError}</p>}
              {pendingSlackTarget && !channel && (
                <button
                  type="button"
                  onClick={() => beginSlackOAuth(pendingSlackTarget, pendingSlackUrl)}
                  disabled={!slackOAuthStatus?.oauth_enabled}
                  className="mt-2 rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Connect this Slack workspace
                </button>
              )}
              {connectionFeedback && (
                <div
                  role={connectionFeedback.kind === 'error' ? 'alert' : 'status'}
                  aria-live={connectionFeedback.kind === 'error' ? 'assertive' : 'polite'}
                  className={`mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 font-normal leading-relaxed ${
                    connectionFeedback.kind === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : connectionFeedback.kind === 'checking'
                        ? 'border-sky-200 bg-sky-50 text-sky-900'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  <span className="material-symbols-outlined mt-0.5 text-[15px]" aria-hidden="true">
                    {connectionFeedback.kind === 'success' ? 'check_circle' : connectionFeedback.kind === 'checking' ? 'progress_activity' : 'error'}
                  </span>
                  <span>{connectionFeedback.message}</span>
                </div>
              )}
            </div>

            <div className="text-xs font-semibold text-slate-700 md:col-span-2">
              <div className="flex items-center justify-between">
                <span>Thread Timestamp (Target)</span>
                <button
                  type="button"
                  onClick={seedThread}
                  disabled={seeding || !channel || isDemo || (!health?.slack && !slackOAuthStatus?.active_team_id)}
                  title={`Posts sample messages into #${channels.find(c => c.id === channel)?.name || channel}. Use only in a test channel.`}
                  className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-0.5 rounded transition-all disabled:opacity-40 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">add_circle</span>
                  {seeding ? 'Posting sample…' : `Post sample to #${channels.find(c => c.id === channel)?.name || channel}`}
                </button>
              </div>
              <p className="mb-0 mt-1 text-[11px] font-normal leading-relaxed text-amber-800">
                This posts sample messages into the selected Slack channel. It does not import or read existing messages; use a test channel.
              </p>
              <input
                value={ts}
                onChange={e => { previewRequestId.current += 1; setPreviewLoading(false); setTs(e.target.value); setSeedStatus(null); setError(null); setPreview(null); setPreviewError(null); setResult(null); }}
                disabled={seeding}
                placeholder="e.g. 1792281644.225409"
                className="mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono bg-white focus-ring"
              />
            </div>
          </div>

          {/* Quick Thread Selector & Active Discussions Panel */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-teal-600">forum</span>
                Active Discussions in #{channels.find(c => c.id === channel)?.name || channel} ({threads.length})
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() => setOnlyFeatureThreads(true)}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      onlyFeatureThreads
                        ? 'bg-white text-teal-800 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🎯 Feature Threads
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlyFeatureThreads(false)}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      !onlyFeatureThreads
                        ? 'bg-white text-teal-800 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất cả ({threads.length})
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void loadThreads(channel, false, true)}
                  disabled={threadsLoading || !channel}
                  className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 disabled:opacity-40"
                  title="Refresh threads"
                >
                  <span className={`material-symbols-outlined text-[14px] ${threadsLoading ? 'animate-spin' : ''}`}>refresh</span>
                  Refresh
                </button>
              </div>
            </div>

            {threads.length > 0 && (
              <select
                onChange={e => {
                  if (e.target.value) {
                    previewRequestId.current += 1;
                    setPreviewLoading(false);
                    setTs(e.target.value);
                    setSeedStatus(null);
                    setError(null);
                    setPreview(null);
                    setPreviewError(null);
                    setResult(null);
                  }
                }}
                value={threads.some(t => t.ts === ts) ? ts : ''}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 truncate font-mono"
              >
                <option value="">-- Quick select from channel threads --</option>
                {(onlyFeatureThreads ? threads.filter(t => t.signal_level === 'high' || t.is_feature || t.reply_count > 0) : threads).map(t => (
                  <option key={t.ts} value={t.ts}>
                    {t.signal_level === 'high' ? '🎯 ' : t.signal_level === 'low' ? '⚠️ ' : ''}
                    {t.topic ? `[${t.topic}] ` : ''}
                    {t.ts} ({t.reply_count} replies) — {t.text}
                  </option>
                ))}
              </select>
            )}

            {threadsLoading ? (
              <div role="status" className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin text-[16px] text-teal-600">progress_activity</span>
                Loading recent channel discussions…
              </div>
            ) : threads.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto overscroll-contain p-1 border border-slate-100 rounded-lg bg-slate-50/50">
                {(onlyFeatureThreads ? threads.filter(t => t.signal_level === 'high' || t.is_feature || t.reply_count > 0) : threads).map(t => {
                  const isSelected = t.ts === ts;
                  return (
                    <button
                      key={t.ts}
                      type="button"
                      onClick={() => {
                        previewRequestId.current += 1;
                        setPreviewLoading(false);
                        setTs(t.ts);
                        setSeedStatus(null);
                        setError(null);
                        setPreview(null);
                        setPreviewError(null);
                        setResult(null);
                      }}
                      className={`text-left p-2.5 rounded-lg border transition-all flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50 shadow-xs ring-1 ring-teal-600'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {t.signal_level === 'high' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              🎯 Feature Thread
                            </span>
                          ) : t.signal_level === 'low' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                              ⚠️ 0 replies (bỏ qua)
                            </span>
                          ) : null}
                          {t.has_noise && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
                              🛡️ Tự động lọc nhiễu
                            </span>
                          )}
                        </div>
                        {t.topic && (
                          <div className="text-xs font-bold text-slate-900 line-clamp-1">
                            {t.topic}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {t.text || 'Untitled thread'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 w-full mt-1">
                        <span className="font-mono text-[10px] text-slate-400">{t.ts}</span>
                        <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${
                          t.reply_count > 0 ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {t.reply_count} replies
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              !error && !ts && (
                <div className="text-xs text-slate-500 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  No threads loaded for #{channels.find(c => c.id === channel)?.name || channel}. Paste a channel link or select another channel.
                </div>
              )
            )}
          </div>

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
              disabled={previewLoading || isDemo || (!health?.slack && !slackOAuthStatus?.active_team_id) || !channel || !ts}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:border-teal-700 hover:text-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {previewLoading ? 'Reading Slack thread…' : 'Read thread'}
            </button>
            {!health?.slack && !slackOAuthStatus?.active_team_id && !isDemo && <span className="text-xs text-amber-800">Slack is not connected.</span>}
            {previewError && <p role="alert" className="mb-0 text-xs text-rose-700">{previewError}</p>}
          </div>

          {preview && (
            <section className="rounded-xl border border-teal-200 bg-teal-50/40" aria-label="Slack thread preview">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100 px-4 py-3">
                <div>
                  <h2 className="m-0 text-sm font-semibold text-slate-900">{seedStatus ? 'Seeded sample thread preview' : 'Live Slack thread preview'}</h2>
                  <p className="mb-0 mt-1 text-xs text-slate-600">{preview.messages.length} messages · {channel} · {ts}</p>
                </div>
                {preview.permalink && <a href={preview.permalink} target="_blank" rel="noreferrer" className="text-xs font-semibold text-teal-800 underline">Open in Slack ↗</a>}
              </div>
              <div className="space-y-2 p-3" aria-live="polite">
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
        <div ref={resultsRef} />
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

            {/* Multi-Agent Anti-Noise & Decomposition Telemetry */}
            {result.agent_telemetry && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold text-indigo-950">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-indigo-700">psychology</span>
                    <span>Multi-Agent Architecture (4 Staged Agents)</span>
                  </div>
                  <span className="font-mono text-[11px] text-indigo-850 bg-white px-2 py-0.5 rounded border border-indigo-200">
                    {result.agent_telemetry.noise_filtered_count ?? 0} Quarantined · {result.agent_telemetry.tasks_decomposed_count ?? 0} Tasks
                  </span>
                </div>
                {result.agent_telemetry.quarantined_noise && result.agent_telemetry.quarantined_noise.length > 0 && (
                  <div className="text-[11px] text-indigo-900 bg-white/90 p-2.5 rounded border border-indigo-100">
                    <span className="font-bold text-amber-800">🛡️ Anti-Noise Gatekeeper Quarantined:</span>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5 text-slate-700">
                      {result.agent_telemetry.quarantined_noise.map((item, qIdx) => (
                        <li key={qIdx}>
                          <span className="font-mono font-semibold text-slate-800">{item.author || 'User'}</span>: "{item.text}" — <em className="text-amber-800">{item.reason}</em>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {result.decomposed_tasks && result.decomposed_tasks.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Actionable Tasks Breakdown</span>
                  <span className="font-mono text-[11px] text-teal-700 font-semibold">{result.decomposed_tasks.length} Subtasks</span>
                </div>
                <div className="space-y-1.5">
                  {result.decomposed_tasks.map((task, idx) => (
                    <div key={idx} className="p-2.5 bg-teal-50/60 rounded-lg border border-teal-100 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-teal-700 text-white font-mono text-[10px] font-bold">
                            {task.id || `TASK-${idx + 1}`}
                          </span>
                          <strong className="text-slate-900 font-semibold">{task.title}</strong>
                          {task.owner && (
                            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-mono text-[10px]">
                              {task.owner}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-slate-600 m-0 mt-1 leading-relaxed text-[11.5px]">{task.description}</p>
                        )}
                      </div>
                      {task.priority && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 shrink-0">
                          {task.priority}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                      <span className="font-semibold text-slate-900">{safeRender(e.field)}:</span>{' '}
                      {safeRender(e.value)}
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
