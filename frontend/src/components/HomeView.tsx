import React, { useEffect, useRef, useState } from 'react';
import { get, Health, Run, LABEL_COLOR } from '../api';

interface HomeViewProps {
  onSelectPrompt: (prompt: string) => void;
  onNavigateToAutomations: () => void;
  onOpenSkills: () => void;
  /** Bumped by the sidebar's New chat button; clears the conversation. */
  resetKey?: number;
}

type Turn =
  | { role: 'you'; text: string }
  | { role: 'agent'; result: any; skill: string; tier: string }
  | { role: 'reply'; text: string }
  | { role: 'ops'; diag: any }
  | { role: 'error'; text: string };

const SUGGESTIONS = [
  'Summarise the SSO thread in #proj-auth-federation and label every requirement.',
  'Which decisions in this thread are still Assumed? Ask the channel about them.',
  'Draft the ClickUp ticket from this thread using the agency_detailed skill.',
  'Compare what startup_lean and agency_detailed would file for the same thread.',
];

function Analysis({ result, skill, tier }: { result: any; skill: string; tier: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 p-5 space-y-3 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15.5px] font-semibold text-gray-900 m-0">{result.story?.title}</h3>
        <span className="text-[13px] font-semibold text-[#7b5cff] shrink-0">
          INVEST {result.invest?.overall}/100
        </span>
      </div>
      {result.story?.as_a && (
        <p className="text-[13px] text-gray-700 m-0">
          <b>As a</b> {result.story.as_a} · <b>I want</b> {result.story.i_want} ·{' '}
          <b>So that</b> {result.story.so_that}
        </p>
      )}
      <div className="space-y-1.5">
        {(result.evidence ?? []).map((e: any, i: number) => (
          <div key={i} className="flex items-start gap-2 text-[12.5px]">
            <span className={`px-1.5 py-0.5 rounded border shrink-0 ${LABEL_COLOR[e.label] ?? 'bg-gray-50 border-gray-200'}`}>
              {e.label}
            </span>
            <span className="text-gray-700">
              <b>{e.field}</b>: {e.value}
              {e.quote_source ? <i className="text-gray-500"> — {e.quote_source}</i> : null}
            </span>
          </div>
        ))}
      </div>
      {result.clarifying_question && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 text-[12.5px] text-amber-900">
          ScribeBA would ask: {result.clarifying_question}
        </div>
      )}
      <p className="text-[11.5px] text-gray-400 m-0">
        {skill} · tier {tier} · reads the text only. Use <b>Live run</b> to reply in a real thread
        and file the ticket.
      </p>
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
  const [showIntegrations, setShowIntegrations] = useState(true);
  const [modelMode, setModelMode] = useState('Light · Auto');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    get<Health>('/api/health').then(setHealth);
    get<Run[]>('/api/runs').then(setRuns);
  }, []);

  // New chat means a blank slate, not just a route change.
  useEffect(() => {
    if (resetKey) { setTurns([]); setPromptInput(''); }
  }, [resetKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, analyzing]);

  // A claim nobody answered is the thing actually waiting on a person.
  const open = (runs ?? [])
    .map(r => ({
      title: r.title,
      blocked: r.evidence.filter(e => e.label === 'Blocked' || e.label === 'Assumed').length,
    }))
    .filter(r => r.blocked > 0);

  const tier = modelMode.startsWith('Pro') ? 'high' : 'low';

  const submit = async () => {
    const text = promptInput.trim();
    if (!text || analyzing) return;
    setTurns(t => [...t, { role: 'you', text }]);
    setPromptInput('');          // clearing the box is what makes it read as a conversation
    setAnalyzing(true);
    // Send the whole conversation, not just the last line. A follow-up like "8h or 24h?" is
    // meaningless alone and was being dismissed as routine chatter.
    const history = [
      ...turns.filter((t): t is { role: 'you'; text: string } => t.role === 'you').map(t => t.text),
      text,
    ].flatMap(m => m.split('\n').filter(l => l.trim()));
    try {
      const resp = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, skill, tier }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Request failed');
      // A pasted discussion comes back as a labelled analysis; a question comes back as prose.
      setTurns(t => [...t,
        data.type === 'text' ? { role: 'reply', text: data.text }
        : data.type === 'ops' ? { role: 'ops', diag: data }
        : { role: 'agent', result: data, skill, tier }]);
    } catch (e: any) {
      setTurns(t => [...t, {
        role: 'error',
        text: e.message === 'Failed to fetch'
          ? 'The API is not running. Start it with: python -m backend.cli serve'
          : e.message,
      }]);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const started = turns.length > 0 || analyzing;

  const composer = (
    <div className="w-full bg-white rounded-2xl border border-gray-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-4 transition-all focus-within:border-[#7b5cff]/60">
      <div className="flex items-center gap-3 text-xs text-gray-400 font-mono mb-2 overflow-x-auto pb-1">
        {(['@agents', '#resources', '/skills', '$credentials'] as const).map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => {
              setPromptInput(p => (p ? `${p} ${tag} ` : `${tag} `));
              if (tag === '/skills') onOpenSkills();
            }}
            className={`cursor-pointer transition-colors bg-transparent border-0 p-0 ${
              tag === '/skills' ? 'hover:text-[#7b5cff] font-semibold' : 'hover:text-gray-600'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <textarea
        value={promptInput}
        onChange={e => setPromptInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={started ? 'Ask a follow-up, or paste another thread…' : 'Paste a thread, or point ScribeBA at a channel…'}
        rows={started ? 2 : 3}
        className="w-full resize-none border-0 p-0 text-[15px] text-gray-800 placeholder-gray-400 focus:ring-0 focus:outline-none bg-transparent leading-relaxed"
      />

      <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100">
        <select
          value={skill}
          onChange={e => setSkill(e.target.value)}
          className="text-xs text-gray-600 bg-transparent border-0 focus:ring-0 cursor-pointer"
          title="Skill file applied to the analysis"
        >
          <option value="startup_lean">startup_lean</option>
          <option value="agency_detailed">agency_detailed</option>
          <option value="default">default</option>
        </select>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModelMode(m => (m === 'Light · Auto' ? 'Pro · Deep Reasoning' : 'Light · Auto'))}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            title="Light runs the low tier, Pro runs the high tier"
          >
            <span>{modelMode}</span>
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!promptInput.trim() || analyzing}
            aria-label="Send"
            className="w-8 h-8 rounded-full bg-[#7b5cff] text-white flex items-center justify-center hover:bg-[#6b4ae8] active:translate-y-px transition-all shadow-sm disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Once a conversation exists the hero gets out of the way and the thread takes the screen.
  if (started) {
    return (
      <div className="flex-1 h-screen flex flex-col"
           style={{ background: 'radial-gradient(900px 380px at 50% -18%, rgba(255,95,158,0.10), transparent 60%), #fdf7fb' }}>
        <div className="flex-1 overflow-y-auto px-6 pt-8">
          <div className="w-full max-w-3xl mx-auto space-y-4 pb-6">
            {turns.map((t, i) =>
              t.role === 'you' ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[80%] bg-[#7b5cff] text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] whitespace-pre-wrap m-0">
                    {t.text}
                  </p>
                </div>
              ) : t.role === 'agent' ? (
                <Analysis key={i} result={t.result} skill={t.skill} tier={t.tier} />
              ) : t.role === 'ops' ? (
                <div key={i} className="bg-white rounded-2xl border border-gray-200/90 p-5 space-y-3 shadow-sm">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-[15.5px] font-semibold text-gray-900 m-0">
                      {t.diag.state.namespace}
                    </h3>
                    <span className={`text-[13px] font-semibold ${(t.diag.state.metrics.error_rate ?? 0) > 0.02 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      error rate {t.diag.state.metrics.error_rate === null ? '—' : `${(t.diag.state.metrics.error_rate * 100).toFixed(2)}%`}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {t.diag.evidence.map((e: any, j: number) => (
                      <div key={j} className="flex items-start gap-2 text-[12.5px]">
                        <span className={`px-1.5 py-0.5 rounded border shrink-0 ${LABEL_COLOR[e.label] ?? 'bg-gray-50 border-gray-200'}`}>
                          {e.label}
                        </span>
                        <span className="text-gray-700">
                          <b>{e.field}</b>: {e.value}
                          <span className="block text-gray-400 font-mono text-[11px] mt-0.5">{e.source}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  {t.diag.proposal && (
                    <p className="text-[12.5px] text-gray-600 m-0">
                      Proposed <b>{t.diag.proposal.runbook}</b> on {t.diag.proposal.target} ·{' '}
                      <span className="font-mono text-[11.5px]">{t.diag.proposal.action_id}</span> —
                      open <b>Incidents</b> to see the exact patch and approve it.
                    </p>
                  )}
                </div>
              ) : t.role === 'reply' ? (
                <div key={i} className="bg-white rounded-2xl border border-gray-200/90 px-5 py-4 shadow-sm">
                  <p className="text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap m-0">{t.text}</p>
                </div>
              ) : (
                <p key={i} className="text-[13px] text-rose-600 border border-rose-200 bg-rose-50 rounded-xl px-4 py-3 m-0">
                  {t.text}
                </p>
              )
            )}
            {analyzing && (
              <div className="bg-white rounded-2xl border border-gray-200/90 p-5 space-y-2.5 animate-pulse">
                <div className="h-3.5 w-2/3 bg-gray-100 rounded" />
                <div className="h-3 w-full bg-gray-100 rounded" />
                <div className="h-3 w-5/6 bg-gray-100 rounded" />
                <p className="text-[12px] text-gray-400 m-0 pt-1">Reading the thread…</p>
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
    <div
      className="flex-1 h-screen overflow-y-auto flex flex-col items-center justify-start p-6 relative"
      style={{
        background:
          'radial-gradient(1100px 480px at 50% -12%, rgba(255,95,158,0.16), transparent 62%),' +
          'radial-gradient(900px 420px at 92% 8%, rgba(123,92,255,0.14), transparent 60%), #fdf7fb',
      }}
    >
      <div className="w-full max-w-3xl pt-12 pb-6 flex flex-col items-center">
        <div className="flex flex-col items-center mb-6 relative z-10">
          <div className="w-14 h-14 rounded-2xl kf-gradient kf-glow flex items-center justify-center text-white text-[22px] font-extrabold mb-3">
            K
          </div>
          <p className="kf-jp text-[10px] text-[#a78bd0] mb-1">スクライブ・ビーエー · 議論を仕様へ</p>
          <h1 className="text-3xl md:text-[34px] font-extrabold tracking-tight text-center kf-gradient-text">
            Where should we begin, Kiet Tran Quoc?
          </h1>
          <p className="text-[13px] text-gray-500 mt-2 text-center max-w-lg">
            ScribeBA reads the thread where the decision actually happened, labels every claim, and
            asks the channel when something is missing.
          </p>
        </div>

        {composer}

        {showIntegrations && health && (
          <div className="w-full mt-3 flex items-center justify-between gap-3 bg-white/70 border border-gray-200/70 rounded-xl px-3.5 py-2 text-[12.5px] text-gray-600">
            <span>
              {health.slack && health.clickup && health.analysis !== 'local-deterministic'
                ? 'Slack, ClickUp and the model provider are connected.'
                : 'Some connections are missing — see the panel below.'}
            </span>
            <button onClick={() => setShowIntegrations(false)} aria-label="Dismiss"
                    className="text-gray-400 hover:text-gray-600">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        <div className="w-full mt-4 space-y-1 text-[13.5px] text-gray-600">
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => { setPromptInput(s); onSelectPrompt(s); }}
              className="w-full text-left flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-white hover:text-gray-900 transition-colors group cursor-pointer"
            >
              <span className="text-gray-400 group-hover:text-[#7b5cff] font-mono mt-0.5">↳</span>
              <span className="flex-1">{s}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4 mt-auto mb-6">
        <section className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm flex flex-col min-h-[190px]">
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Needs you</h2>
          {open.length === 0 ? (
            <p className="flex-1 flex items-center justify-center text-[13px] text-gray-400 m-0">
              {runs === null ? 'Backend not running' : 'No unanswered questions.'}
            </p>
          ) : (
            <ul className="flex-1 space-y-2 list-none p-0 m-0">
              {open.slice(0, 3).map((r, i) => (
                <li key={i} className="text-[12px] text-gray-700 leading-snug">
                  <span className="text-rose-600 font-semibold">{r.blocked}</span> open ·{' '}
                  <span className="text-gray-500">{r.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm min-h-[190px] flex flex-col">
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Connections</h2>
          <div className="space-y-2 flex-1">
            {(health
              ? [
                  ['Slack', health.slack, health.slack ? 'token loaded' : 'no token'],
                  ['ClickUp', health.clickup, health.clickup ? 'list configured' : 'not configured'],
                  ['Model', health.analysis !== 'local-deterministic', health.analysis],
                  ['Exa', health.exa, health.exa ? 'key loaded' : 'no key'],
                ]
              : [['Backend', false, 'not running']]
            ).map(([name, on, note]: any) => (
              <div key={name} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2 font-medium text-gray-700">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  {name}
                </span>
                <span className="text-gray-400 font-mono text-[11px]">{note}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm min-h-[190px] flex flex-col">
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Recent runs</h2>
          {!runs || runs.length === 0 ? (
            <p className="flex-1 flex items-center justify-center text-[13px] text-gray-400 m-0">
              {runs === null ? 'Backend not running' : 'No runs yet.'}
            </p>
          ) : (
            <ul className="flex-1 space-y-2 list-none p-0 m-0">
              {runs.slice(0, 3).map((r, i) => (
                <li key={i} className="text-[12px] leading-snug">
                  <span className="font-semibold text-gray-800">{r.invest}</span>
                  <span className="text-gray-400"> · {r.skill} · </span>
                  <span className="text-gray-500 font-mono text-[11px]">{r.at.slice(11, 16)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
