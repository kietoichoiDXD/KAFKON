import React, { useEffect, useState } from 'react';
import { get, Health, Run, LABEL_COLOR } from '../api';

interface HomeViewProps {
  onSelectPrompt: (prompt: string) => void;
  onNavigateToAutomations: () => void;
  onOpenSkills: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectPrompt,
  onNavigateToAutomations,
  onOpenSkills,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [skill, setSkill] = useState('startup_lean');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);

  useEffect(() => {
    get<Health>('/api/health').then(setHealth);
    get<Run[]>('/api/runs').then(setRuns);
  }, []);

  // A claim nobody answered is the thing actually waiting on a person.
  const open = (runs ?? [])
    .map(r => ({ title: r.title, blocked: r.evidence.filter(e => e.label === 'Blocked' || e.label === 'Assumed').length }))
    .filter(r => r.blocked > 0);
  const [showIntegrations, setShowIntegrations] = useState(true);
  const [modelMode, setModelMode] = useState('Light · Auto');

  // Starter prompts. They exist so a first-time visitor can press one instead of facing an
  // empty box, so each is a whole request ScribeBA can actually act on.
  const suggestions = [
    'Summarise the SSO thread in #proj-auth-federation and label every requirement.',
    'Which decisions in this thread are still Assumed? Ask the channel about them.',
    'Draft the ClickUp ticket from this thread using the agency_detailed skill.',
    'Compare what startup_lean and agency_detailed would file for the same thread.',
  ];

  const submit = async () => {
    const text = promptInput.trim();
    if (!text || analyzing) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      // Each line is one speaker's turn, which is how a pasted Slack thread arrives.
      const resp = await fetch('http://localhost:8000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: text.split('\n').filter(l => l.trim()),
          skill,
          // The selector used to be decoration; it now picks the real cascade tier.
          tier: modelMode.startsWith('Pro') ? 'high' : 'low',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Analysis failed');
      setResult(data);
    } catch (e: any) {
      setError(
        e.message === 'Failed to fetch'
          ? 'The API is not running. Start it with: python -m backend.cli serve'
          : e.message
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (promptInput.trim()) {
        submit();
      }
    }
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto flex flex-col items-center justify-start p-6 relative"
         style={{
           background:
             'radial-gradient(1100px 480px at 50% -12%, rgba(255,95,158,0.16), transparent 62%),' +
             'radial-gradient(900px 420px at 92% 8%, rgba(123,92,255,0.14), transparent 60%), #fdf7fb',
         }}>
      {/* Top spacing */}
      <div className="w-full max-w-3xl pt-12 pb-6 flex flex-col items-center">
        {/* Main Greeting */}
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

        {/* Prompt Input Box */}
        <div className="w-full bg-white rounded-2xl border border-gray-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-4 relative transition-all focus-within:border-[#7b5cff]/60 focus-within:shadow-[0_8px_30px_-4px_rgba(0,135,117,0.12)]">
          {/* Quick tags */}
          <div className="flex items-center gap-3 text-xs text-gray-400 font-mono mb-2 overflow-x-auto pb-1">
            <span
              onClick={() => setPromptInput(p => (p ? `${p} @agents ` : '@agents '))}
              className="cursor-pointer hover:text-gray-600 transition-colors"
            >
              @agents
            </span>
            <span
              onClick={() => setPromptInput(p => (p ? `${p} #resources ` : '#resources '))}
              className="cursor-pointer hover:text-gray-600 transition-colors"
            >
              #resources
            </span>
            <span
              onClick={() => {
                setPromptInput(p => (p ? `${p} /skills ` : '/skills '));
                onOpenSkills();
              }}
              className="cursor-pointer hover:text-[#7b5cff] font-semibold transition-colors"
            >
              /skills
            </span>
            <span
              onClick={() => setPromptInput(p => (p ? `${p} $credentials ` : '$credentials '))}
              className="cursor-pointer hover:text-gray-600 transition-colors"
            >
              $credentials
            </span>
          </div>

          {/* Textarea */}
          <textarea
            value={promptInput}
            onChange={e => setPromptInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a thread, or point ScribeBA at a channel..."
            rows={3}
            className="w-full resize-none border-0 p-0 text-[15px] text-gray-800 placeholder-gray-400 focus:ring-0 focus:outline-none bg-transparent leading-relaxed"
          />

          {/* Bottom Toolbar inside Prompt Box */}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Add attachment"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>
              <button
                type="button"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Tuning settings"
              >
                <span className="material-symbols-outlined text-[19px]">tune</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Model Selector */}
              <button
                type="button"
                onClick={() =>
                  setModelMode(m =>
                    m === 'Light · Auto' ? 'Pro · Deep Reasoning' : 'Light · Auto'
                  )
                }
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <span>{modelMode}</span>
                <span className="material-symbols-outlined text-[16px] text-gray-400">expand_more</span>
              </button>

              {/* Submit Button */}
              <button
                type="button"
                onClick={submit}
                className="w-8 h-8 rounded-full bg-[#7b5cff] text-white flex items-center justify-center hover:bg-[#6b4ae8] transition-colors shadow-sm disabled:opacity-50"
                disabled={!promptInput.trim() || analyzing}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
            </div>
          </div>
        </div>

        {/* Integration Strip */}
        {showIntegrations && (
          <div className="w-full mt-2.5 py-2 px-3 rounded-xl bg-gray-100/70 border border-gray-200/60 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2 truncate">
              <span className="truncate">Connect Slack, ClickUp and your model provider to ScribeBA</span>
              <div className="flex items-center gap-1.5 text-gray-600 ml-1">
                <span className="material-symbols-outlined text-[16px] text-teal-600" title="Cloud MCP">cloud_sync</span>
                <span className="material-symbols-outlined text-[16px] text-amber-600" title="AWS">dns</span>
                <span className="material-symbols-outlined text-[16px] text-gray-700" title="GitHub">hub</span>
                <span className="material-symbols-outlined text-[16px] text-orange-500" title="GitLab">token</span>
                <span className="material-symbols-outlined text-[16px] text-blue-500" title="Docker">view_in_ar</span>
                <span className="material-symbols-outlined text-[16px] text-indigo-500" title="Kubernetes">settings_system_daydream</span>
              </div>
            </div>
            <button
              onClick={() => setShowIntegrations(false)}
              className="text-gray-400 hover:text-gray-600 p-0.5"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        )}

        {(analyzing || error || result) && (
          <div className="w-full mt-4 bg-white rounded-2xl border border-gray-200/90 p-5 space-y-3">
            {analyzing && <p className="text-[13.5px] text-gray-500">Reading the thread…</p>}
            {error && <p className="text-[13px] text-rose-600">{error}</p>}
            {result && (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[16px] font-semibold text-gray-900">{result.story?.title}</h2>
                  <span className="text-[13px] font-semibold text-[#7b5cff] shrink-0">
                    INVEST {result.invest?.overall}/100
                  </span>
                </div>
                {result.story?.as_a && (
                  <p className="text-[13px] text-gray-700">
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
                <p className="text-[11.5px] text-gray-400">
                  Skill {skill} · tier {modelMode.startsWith('Pro') ? 'high' : 'low'} · this reads the
                  text only. Use <b>Live run</b> to reply in a real thread and file the ticket.
                </p>
              </>
            )}
          </div>
        )}

        {/* Quick Suggestions List */}
        <div className="w-full mt-4 space-y-1 text-[13.5px] text-gray-600">
          {suggestions.map((s, idx) => (
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

      {/* Three panels, all fed by the running backend. */}
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
