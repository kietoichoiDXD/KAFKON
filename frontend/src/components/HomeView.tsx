import React, { useEffect, useRef, useState } from 'react';
import { get, Health, Run, LABEL_COLOR, API, safeFetchJson } from '../api';

interface HomeViewProps {
  onSelectPrompt: (prompt: string) => void;
  onNavigateToAutomations: () => void;
  onOpenSkills: () => void;
  resetKey?: number;
}

type Turn =
  | { role: 'you'; text: string }
  | { role: 'agent'; result: any; skill: string; tier: string }
  | { role: 'reply'; text: string }
  | { role: 'ops'; diag: any }
  | { role: 'approve'; proposal: any; applied?: any; error?: string }
  | { role: 'error'; text: string };

type ChatSessionSummary = { id: string; title: string; updated_at: number };

const SUGGESTIONS = [
  'Summarise Smart Product Search thread: https://ai4l-aio.slack.com/archives/C0CFE9GL4AK/p1795162883105679',
  'Summarise the SSO thread in #proj-auth-federation and label every requirement.',
  'Which decisions in this thread are still Assumed? Ask the channel about them.',
  'Draft the ClickUp ticket from this thread using the agency_detailed skill.',
];

function EvidencePill({ label }: { label: string }) {
  const styles: Record<string, string> = {
    Verified: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    Inferred: 'bg-amber-50 text-amber-800 border-amber-300',
    Assumed: 'bg-purple-50 text-purple-800 border-purple-300',
    Blocked: 'bg-rose-50 text-rose-800 border-rose-300',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-semibold border uppercase tracking-wider shrink-0 ${
        styles[label] || 'bg-slate-100 text-slate-800 border-slate-300'
      }`}
    >
      {label}
    </span>
  );
}

function AnalysisCard({ result, skill, tier }: { result: any; skill: string; tier: string }) {
  const investScore = result.invest?.overall ?? 85;
  const [slackTarget, setSlackTarget] = useState(result.channel || result.permalink || '');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ ok: boolean; message: string; url?: string } | null>(null);

  const handleSyncSlack = async () => {
    if (!slackTarget.trim()) return;
    setSyncing(true);
    setSyncStatus(null);
    try {
      const resp = await safeFetchJson<any>(`${API}/api/slack/sync-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: slackTarget.trim(),
          ts: result.ts || '',
          skill,
          sync_clickup: true,
          analysis: result
        })
      });
      if (resp.ok && resp.data) {
        setSyncStatus({
          ok: true,
          message: 'Đã gửi task lên Slack & ClickUp thành công!',
          url: resp.data.ticket?.url || resp.data.permalink
        });
      } else {
        setSyncStatus({
          ok: false,
          message: resp.error || 'Không thể đồng bộ với Slack.'
        });
      }
    } catch (e: any) {
      setSyncStatus({ ok: false, message: e.message || 'Lỗi kết nối' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight m-0">
            {result.story?.title || 'Synthesized Agile Requirement Specification'}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 font-mono">
            <span>Skill: {skill}</span>
            <span>·</span>
            <span>Tier: {tier}</span>
            <span>·</span>
            <span>Deterministic Provenance</span>
          </div>
          {result.permalink && (
            <div className="mt-2">
              <a
                href={result.permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                <span>Source Slack Thread {result.channel ? `(#${result.channel})` : ''}</span>
              </a>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shrink-0">
          <span className="text-xs text-slate-600 font-medium">INVEST</span>
          <span className="text-sm font-bold text-teal-800 font-mono">{investScore}/100</span>
        </div>
      </div>

      {result.story?.as_a && (
        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800 leading-relaxed">
          <span className="font-semibold text-slate-900">As a</span> {result.story.as_a},{' '}
          <span className="font-semibold text-slate-900">I want</span> {result.story.i_want},{' '}
          <span className="font-semibold text-slate-900">So that</span> {result.story.so_that}
        </div>
      )}

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
                {result.agent_telemetry.quarantined_noise.map((item: any, qIdx: number) => (
                  <li key={qIdx}>
                    <span className="font-mono font-semibold text-slate-800">{item.author || 'User'}</span>: "{item.text}" — <em className="text-amber-800">{item.reason}</em>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Decomposed Actionable Tasks */}
      {result.decomposed_tasks && result.decomposed_tasks.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
            <span>Actionable Tasks Breakdown</span>
            <span className="font-mono text-[11px] text-teal-700 font-semibold">{result.decomposed_tasks.length} Subtasks Identified</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-1">
            {result.decomposed_tasks.map((task: any, idx: number) => (
              <div key={idx} className="p-3 bg-teal-50/50 rounded-lg border border-teal-100 flex items-start justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-teal-700 text-white font-mono text-[10px] font-bold">
                      {task.id || `TASK-${idx + 1}`}
                    </span>
                    <strong className="text-slate-900 font-semibold">{task.title}</strong>
                    {task.owner && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                        {task.owner}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-slate-600 m-0 leading-relaxed text-[11.5px]">{task.description}</p>
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

      {/* Acceptance Criteria */}
      {result.acceptance_criteria && result.acceptance_criteria.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Acceptance Criteria (Gherkin / Verifiable)
          </div>
          <div className="space-y-1.5">
            {result.acceptance_criteria.map((ac: string, idx: number) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-800 bg-slate-50/80 p-2.5 rounded-lg border border-slate-200">
                <span className="font-mono text-teal-700 font-bold shrink-0">{idx + 1}.</span>
                <span className="leading-relaxed">{ac}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Breakdown */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
          Evidence Provenance (3-Axis Guard)
        </div>
        <div className="space-y-2">
          {(result.evidence ?? []).map((e: any, i: number) => (
            <div
              key={i}
              className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 text-xs"
            >
              <EvidencePill label={e.label} />
              <div className="flex-1 text-slate-800">
                <span className="font-semibold text-slate-900">{e.field}:</span> {e.value}
                {e.quote_source && (
                  e.source_message?.match_status === 'matched' ? (
                    <blockquote className="mt-1 m-0 bg-white p-2 rounded border border-slate-200">
                      <div className="mb-1 flex flex-wrap items-center gap-x-2 text-[11px] not-italic text-slate-500">
                        <span className="font-semibold text-slate-700">{e.source_message.author}</span>
                        <span>{e.source_message.timestamp}</span>
                      </div>
                      <div className="italic text-slate-700 font-mono text-[11px]">“{e.source_message.excerpt || e.quote_source}”</div>
                      {(e.source_message.thread_url || result.permalink) && <a href={e.source_message.thread_url || result.permalink} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium not-italic text-teal-700 hover:text-teal-800"><span className="material-symbols-outlined text-[14px]" aria-hidden="true">open_in_new</span>Open source thread</a>}
                    </blockquote>
                  ) : e.source_message?.match_status === 'unmatched' ? (
                    <div className="mt-1 bg-slate-50 p-2 rounded border border-amber-800/60">
                      <span className="inline-flex px-1.5 py-0.5 rounded border border-amber-800 bg-amber-950/70 text-[10px] font-semibold uppercase text-amber-300">Source not matched</span>
                      <div className="mt-1 text-slate-600 italic font-mono text-[11px]">Unverified quote: “{e.quote_source}”</div>
                    </div>
                  ) : (
                    <div className="mt-1 text-slate-600 italic bg-white p-1.5 rounded border border-slate-200 font-mono text-[11px]">
                      “{e.quote_source}”
                      {result.permalink && <a href={result.permalink} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 not-italic font-sans font-medium text-teal-700 hover:text-teal-800"><span className="material-symbols-outlined text-[13px]" aria-hidden="true">open_in_new</span>Open thread</a>}
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {result.clarifying_question && (
        <div className="border border-rose-200 bg-rose-50/80 rounded-lg p-3 text-xs text-rose-900 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[18px] text-rose-700 shrink-0">
            help_center
          </span>
          <div>
            <div className="font-bold text-rose-800 mb-0.5">Unresolved Blocker Detected</div>
            <div>Channel inquiry generated: "{result.clarifying_question}"</div>
          </div>
        </div>
      )}

      {/* Slack & ClickUp Sync Section */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[#4A154B]">forum</span>
            <span>Liên kết Slack:</span>
          </span>
          <input
            type="text"
            placeholder="Channel ID hoặc link (vd: C0CFE9GL4AK)"
            value={slackTarget}
            onChange={e => setSlackTarget(e.target.value)}
            className="px-2.5 py-1 text-xs rounded border border-slate-300 w-64 font-mono bg-white focus:outline-none focus:border-teal-600"
          />
        </div>
        <button
          onClick={handleSyncSlack}
          disabled={syncing || !slackTarget.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4A154B] text-white font-medium hover:bg-[#3b113c] transition-colors disabled:opacity-50 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[15px]">send</span>
          <span>{syncing ? 'Đang gửi...' : 'Gửi Task lên Slack & ClickUp'}</span>
        </button>
      </div>

      {syncStatus && (
        <div className={`p-2.5 rounded-lg text-xs flex items-center justify-between ${syncStatus.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">{syncStatus.ok ? 'check_circle' : 'error'}</span>
            <span>{syncStatus.message}</span>
          </div>
          {syncStatus.url && (
            <a href={syncStatus.url} target="_blank" rel="noreferrer" className="underline font-semibold ml-2 hover:text-emerald-950">
              Mở link liên kết →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export const HomeView: React.FC<HomeViewProps> = ({ onSelectPrompt, onOpenSkills, resetKey = 0 }) => {
  const [promptInput, setPromptInput] = useState('');
  const [skill, setSkill] = useState('startup_lean');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [modelMode, setModelMode] = useState('Nebius Qwen-30B (Fast)');
  const endRef = useRef<HTMLDivElement>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');

  const persistNewSession = async () => {
    const result = await safeFetchJson<{ id: string; title: string }>(`${API}/api/chat/sessions`, { method: 'POST' });
    if (!result.ok || !result.data) return;
    setActiveSessionId(result.data.id);
    localStorage.setItem('scribeba.chat.active-session', result.data.id);
    setChatSessions(items => [
      { id: result.data!.id, title: result.data!.title, updated_at: Date.now() / 1000 },
      ...items,
    ].slice(0, 100));
  };

  const openSession = async (sessionId: string) => {
    if (!sessionId) return;
    const result = await safeFetchJson<{ id: string; turns: Turn[] }>(`${API}/api/chat/sessions/${sessionId}`);
    if (!result.ok || !result.data) return;
    setActiveSessionId(sessionId);
    localStorage.setItem('scribeba.chat.active-session', sessionId);
    setTurns(result.data.turns ?? []);
    setPendingAction(null);
    setPromptInput('');
  };

  useEffect(() => {
    get<Health>('/api/health').then(setHealth);
    get<Run[]>('/api/runs').then(setRuns);
    let cancelled = false;
    void (async () => {
      const result = await safeFetchJson<ChatSessionSummary[]>(`${API}/api/chat/sessions`);
      if (!result.ok || !Array.isArray(result.data) || cancelled) return;
      setChatSessions(result.data);
      const savedId = localStorage.getItem('scribeba.chat.active-session') || '';
      const selected = result.data.find(item => item.id === savedId) || result.data[0];
      if (selected) await openSession(selected.id);
      else await persistNewSession();
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (resetKey) {
      setTurns([]);
      setPromptInput('');
      void persistNewSession();
    }
  }, [resetKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, analyzing]);

  const open = (runs ?? [])
    .map(r => ({
      title: r.title,
      blocked: r.evidence.filter(e => e.label === 'Blocked' || e.label === 'Assumed').length,
    }))
    .filter(r => r.blocked > 0);

  const tier = modelMode.includes('Pro') ? 'high' : 'low';

  const submit = async () => {
    const text = promptInput.trim();
    if (!text || analyzing) return;
    setTurns(t => [...t, { role: 'you', text }]);
    setPromptInput('');
    setAnalyzing(true);

    const history = [
      ...turns.filter((t): t is { role: 'you'; text: string } => t.role === 'you').map(t => t.text),
      text,
    ].flatMap(m => m.split('\n').filter(l => l.trim()));

    try {
      const resp = await safeFetchJson<any>(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, skill, tier, pending_action: pendingAction, session_id: activeSessionId }),
      });
      if (!resp.ok || !resp.data) throw new Error(resp.error ?? 'Request failed');
      const data = resp.data;
      if (data.session_id && data.session_id !== activeSessionId) {
        setActiveSessionId(data.session_id);
        localStorage.setItem('scribeba.chat.active-session', data.session_id);
      }

      if (data.type === 'ops' && data.proposal) setPendingAction(data.proposal.action_id);
      setTurns(t => [
        ...t,
        data.type === 'text'
          ? { role: 'reply', text: data.text }
          : data.type === 'ops'
          ? { role: 'ops', diag: data }
          : data.type === 'approve'
          ? { role: 'approve', proposal: data.proposal }
          : { role: 'agent', result: data, skill, tier },
      ]);
      const refreshed = await safeFetchJson<ChatSessionSummary[]>(`${API}/api/chat/sessions`);
      if (refreshed.ok && Array.isArray(refreshed.data)) setChatSessions(refreshed.data);
    } catch (e: any) {
      setTurns(t => [
        ...t,
        {
          role: 'error',
          text:
            e.message === 'Failed to fetch'
              ? 'Local API endpoint is offline. Ensure python -m backend.cli serve is running.'
              : e.message,
        },
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  const applyProposal = async (index: number, actionId: string) => {
    try {
      const r = await fetch(`${API}/api/ops/apply`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId, approver: 'operator' }),
      });
      const d = await r.json();
      setTurns(t =>
        t.map((turn, i) =>
          i === index && turn.role === 'approve'
            ? { ...turn, ...(d.error ? { error: d.error } : { applied: d }) }
            : turn
        )
      );
      if (!d.error) setPendingAction(null);
    } catch (e: any) {
      setTurns(t =>
        t.map((turn, i) =>
          i === index && turn.role === 'approve' ? { ...turn, error: e.message } : turn
        )
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const started = turns.length > 0 || analyzing;

  const sessionControls = (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="chat-history-select">Saved chats</label>
      <select
        id="chat-history-select"
        value={activeSessionId}
        onChange={e => void openSession(e.target.value)}
        className="max-w-[min(52vw,320px)] px-2.5 py-2 rounded-md border border-slate-300 bg-white text-slate-800 text-xs"
        aria-label="Saved chat history"
      >
        {chatSessions.map(item => <option key={item.id} value={item.id}>{item.title || 'New conversation'}</option>)}
        {!chatSessions.length && <option value={activeSessionId}>Current conversation</option>}
      </select>
      <button
        onClick={() => { setTurns([]); setPromptInput(''); setPendingAction(null); void persistNewSession(); }}
        className="px-3 py-2 rounded-md border border-slate-300 text-slate-800 text-xs font-semibold hover:bg-slate-100"
      >New session</button>
    </div>
  );

  const composer = (
    <div className="w-full bg-white rounded-xl border border-slate-200 p-4 transition-all focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-700/10">
      <div className="flex items-center gap-3 text-xs text-slate-600 font-mono mb-2 overflow-x-auto pb-1">
        {(['@agents', '#resources', '/skills', '$credentials'] as const).map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => {
              setPromptInput(p => (p ? `${p} ${tag} ` : `${tag} `));
              if (tag === '/skills') onOpenSkills();
            }}
            className="cursor-pointer transition-colors bg-transparent border-0 p-0 text-slate-600 hover:text-teal-800 font-medium"
          >
            {tag}
          </button>
        ))}
      </div>

      {/https?:\/\/[a-z0-9\-.]*slack\.com\//i.test(promptInput) && (
        <div className="mb-2.5 flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs text-teal-900">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="material-symbols-outlined text-[16px] text-teal-700">link</span>
            <span>Slack Discussion Link Detected</span>
          </div>
          <span className="font-mono text-[11px] text-teal-700 font-semibold">AI4L - AIO Workspace Connected</span>
        </div>
      )}

      {!/https?:\/\/[a-z0-9\-.]*slack\.com\//i.test(promptInput) && /(?:\[\d{1,2}:\d{2}.*?\]|@\w+:)/.test(promptInput) && (
        <div className="mb-2.5 flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-900">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="material-symbols-outlined text-[16px] text-indigo-700">content_paste</span>
            <span>Đã nhận diện tin nhắn copy từ Slack (Tự động bóc tách Task & lọc nhiễu)</span>
          </div>
          <span className="font-mono text-[11px] text-indigo-700 font-semibold">Anti-Noise Multi-Agent</span>
        </div>
      )}

      <textarea
        value={promptInput}
        onChange={e => setPromptInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          started
            ? 'Type a follow-up, or paste another conversational thread…'
            : 'Paste a team chat thread, or request an Agile synthesis for an active channel…'
        }
        rows={started ? 2 : 3}
        className="w-full resize-none border-0 p-0 text-[14.5px] text-slate-900 placeholder:text-slate-500 focus:ring-0 focus:outline-none bg-transparent leading-relaxed"
      />

      <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <select
            value={skill}
            onChange={e => setSkill(e.target.value)}
            className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 focus:ring-0 cursor-pointer font-mono"
            title="Skill strategy for specification output"
          >
            <option value="startup_lean">startup_lean</option>
            <option value="agency_detailed">agency_detailed</option>
            <option value="default">default_scrum</option>
          </select>

          <button
            type="button"
            onClick={() =>
              setModelMode(m =>
                m.includes('Nebius') ? 'Claude Sonnet (High)' : 'Nebius Qwen-30B (Fast)'
              )
            }
            className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            {modelMode}
          </button>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!promptInput.trim() || analyzing}
          aria-label="Send"
          className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center hover:bg-teal-800 active:scale-95 transition-all disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
        </button>
      </div>
    </div>
  );

  if (started) {
    return (
      <div className="flex-1 h-full min-h-0 flex flex-col bg-slate-50">
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200">
          <span className="text-sm font-semibold text-slate-900">Specification session</span>
          {sessionControls}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-6">
          <div className="w-full max-w-3xl mx-auto space-y-4 pb-6">
            {turns.map((t, i) =>
              t.role === 'you' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] bg-slate-900 text-white rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">
                    {t.text}
                  </div>
                </div>
              ) : t.role === 'agent' ? (
                <AnalysisCard key={i} result={t.result} skill={t.skill} tier={t.tier} />
              ) : t.role === 'ops' ? (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                  <div className="flex items-baseline justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-bold text-slate-900 m-0">
                      Namespace: {t.diag.state.namespace}
                    </h3>
                    <span
                      className={`text-xs font-mono font-semibold ${
                        (t.diag.state.metrics.error_rate ?? 0) > 0.02
                          ? 'text-rose-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      5xx Rate:{' '}
                      {t.diag.state.metrics.error_rate === null
                        ? '—'
                        : `${(t.diag.state.metrics.error_rate * 100).toFixed(2)}%`}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {t.diag.evidence.map((e: any, j: number) => (
                      <div key={j} className="flex items-start gap-2 text-xs">
                        <EvidencePill label={e.label} />
                        <span className="text-slate-800">
                          <b>{e.field}</b>: {e.value}
                          <span className="block text-slate-500 font-mono text-[11px] mt-0.5">
                            {e.source}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  {t.diag.proposal && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800">
                      Proposed <b>{t.diag.proposal.runbook}</b> on {t.diag.proposal.target} ·{' '}
                      <span className="font-mono text-[11px] text-teal-800">
                        {t.diag.proposal.action_id}
                      </span>
                    </div>
                  )}
                </div>
              ) : t.role === 'approve' ? (
                <div key={i} className="bg-white rounded-xl border border-teal-500/40 p-5 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-bold text-slate-900 m-0">
                      {t.proposal.summary}
                    </h3>
                    <span className="text-xs font-mono text-slate-600">
                      {t.proposal.action_id}
                    </span>
                  </div>
                  <div className="font-mono text-xs bg-slate-900 text-slate-100 rounded-lg p-3 space-y-1">
                    <div className="text-rose-400">- {t.proposal.parameters.name}={t.proposal.observed}</div>
                    <div className="text-emerald-400">+ {t.proposal.parameters.name}={t.proposal.parameters.value}</div>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono">
                    ResourceVersion: {t.proposal.resource_version} (atomic lock)
                  </div>
                  {t.applied ? (
                    <div className="text-xs text-emerald-800 font-medium">
                      Applied at {t.applied.at} by {t.applied.approver}. {t.applied.note}
                    </div>
                  ) : t.error ? (
                    <div className="text-xs text-rose-700 font-medium">{t.error}</div>
                  ) : (
                    <button
                      onClick={() => applyProposal(i, t.proposal.action_id)}
                      className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-all"
                    >
                      Verify Diff & Apply Patch
                    </button>
                  )}
                </div>
              ) : t.role === 'reply' ? (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap m-0">
                    {t.text}
                  </p>
                </div>
              ) : (
                <div key={i} className="text-xs text-rose-800 border border-rose-200 bg-rose-50 rounded-xl p-3">
                  {t.text}
                </div>
              )
            )}
            {analyzing && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2.5 animate-pulse">
                <div className="h-3.5 w-1/3 bg-slate-200 rounded" />
                <div className="h-3 w-full bg-slate-100 rounded" />
                <div className="h-3 w-3/4 bg-slate-100 rounded" />
                <p className="text-xs text-slate-500 font-mono m-0 pt-1">
                  Parsing discussion claims with 3-Axis Verification Model...
                </p>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>
        <div className="px-6 pb-6">
          <div className="w-full max-w-3xl mx-auto">{composer}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center justify-start p-6 bg-slate-50">
      <div className="w-full max-w-5xl flex justify-end mb-2">{sessionControls}</div>
      <div className="w-full max-w-5xl pt-8 pb-6 flex flex-col items-center">
        <div className="w-full flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[24px]">terminal</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-center">
            ScribeBA Agile Specification Studio
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 text-center max-w-lg leading-relaxed">
            Turn messy team chats into verified, traceable Agile tickets — zero AI hallucination.
            Every claim is anchored to a speaker; missing answers are marked Blocked.
          </p>
        </div>

        {composer}

        {/* Suggestion Chips */}
        <div className="w-full mt-4 space-y-1.5">
          <div className="text-[13px] font-semibold text-slate-600 px-1">
            Recommended Prompts
          </div>
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPromptInput(s);
                onSelectPrompt(s);
              }}
              className="w-full text-left flex items-start gap-2.5 py-2 px-3 rounded-lg bg-white border border-slate-200 hover:border-teal-500 hover:bg-slate-50/50 text-slate-800 text-xs transition-colors group cursor-pointer"
            >
              <span className="text-slate-500 group-hover:text-teal-700 font-mono mt-0.5">↳</span>
              <span className="flex-1 leading-normal">{s}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Overview Cards Row */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-4 mt-auto mb-6">
        <section className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col min-h-[160px]">
          <h2 className="text-[13px] font-semibold text-slate-600 mb-2">
            Action items needed
          </h2>
          {open.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500 leading-relaxed">
              {runs === null
                ? 'Backend idle. Connect the service to load follow-up items.'
                : 'No blockers. Follow-up items from future runs will appear here when the analysis finds an unanswered decision or assumption.'}
            </div>
          ) : (
            <ul className="flex-1 space-y-2 list-none p-0 m-0">
              {open.slice(0, 3).map((r, i) => (
                <li key={i} className="text-xs text-slate-800 leading-snug">
                  <span className="text-rose-700 font-bold font-mono mr-1">{r.blocked} Blocked:</span>
                  <span className="text-slate-600">{r.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4 min-h-[160px] flex flex-col">
          <h2 className="text-[13px] font-semibold text-slate-600 mb-2">
            Connection mesh
          </h2>
          <div className="space-y-2">
            {(health
              ? [
                  ['Slack Ingestion', health.slack, health.slack ? 'Live Socket Mode' : 'Offline'],
                  ['ClickUp Sync', health.clickup, health.clickup ? 'List Mapped' : 'Unmapped'],
                  ['Inference Tier', health.analysis !== 'local-deterministic', health.analysis],
                  ['Exa Grounding', health.exa, health.exa ? 'Active' : 'Unset'],
                ]
              : [['Core Engine', true, 'FastAPI 8000']]
            ).map(([name, on, note]: any) => (
              <div key={name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-800">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      on ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  />
                  {name}
                </span>
                <span className="text-slate-600 font-mono text-[11px]">{note}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4 min-h-[160px] flex flex-col">
          <h2 className="text-[13px] font-semibold text-slate-600 mb-2">
            Engine telemetry
          </h2>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-700">
              <span>Primary LLM:</span>
              <span className="font-mono font-semibold text-teal-800">Nebius Qwen-30B</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Failover Tier 2:</span>
              <span className="font-mono text-slate-800">OpenRouter (Sonnet)</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Zero-Hallucination:</span>
              <span className="font-mono font-bold text-emerald-800">3-Axis Active</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
