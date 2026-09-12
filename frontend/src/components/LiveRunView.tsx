import React, { useEffect, useState } from 'react';

const API = 'http://localhost:8000';

type Health = {
  mode: string;
  analysis: string;
  tier: string;
  slack: boolean;
  clickup: boolean;
  exa: boolean;
};

type Channel = { id: string; name: string };

type Evidence = { label: string; field: string; value: string; quote_source?: string | null };

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

const LABEL_COLOR: Record<string, string> = {
  Verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Inferred: 'bg-amber-50 text-amber-700 border-amber-200',
  Assumed: 'bg-purple-50 text-purple-700 border-purple-200',
  Blocked: 'bg-rose-50 text-rose-700 border-rose-200',
};

function Dot({ on }: { on: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${on ? 'bg-emerald-500' : 'bg-gray-300'}`} />;
}

export function LiveRunView() {
  const [health, setHealth] = useState<Health | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channel, setChannel] = useState('');
  const [ts, setTs] = useState('');
  const [skill, setSkill] = useState('startup_lean');
  const [skills, setSkills] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => {
    fetch(`${API}/api/health`).then(r => r.json()).then(setHealth).catch(() => setError('API is not running. Start it with: python -m backend.cli serve'));
    fetch(`${API}/api/slack/channels`).then(r => r.json()).then(c => {
      if (Array.isArray(c)) { setChannels(c); setChannel(c[0]?.id ?? ''); }
    }).catch(() => undefined);
    fetch(`${API}/api/skills`).then(r => r.json()).then(s => setSkills(s.map((x: any) => x.name))).catch(() => undefined);
  }, []);

  const run = async () => {
    setRunning(true); setError(null); setResult(null);
    try {
      const resp = await fetch(`${API}/api/slack-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, ts, skill }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Run failed');
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold text-gray-900">Live run</h1>
          <p className="text-[13.5px] text-gray-600 mt-1">
            Reads a real Slack thread, replies in it, and files the ClickUp ticket. Everything on this
            page is the running backend — nothing here is sample data.
          </p>
        </div>

        {health && (
          <div className="flex flex-wrap gap-4 text-[12.5px] text-gray-700 border border-gray-200 rounded-xl px-4 py-3 bg-white">
            <span className="flex items-center gap-1.5"><Dot on={health.slack} /> Slack</span>
            <span className="flex items-center gap-1.5"><Dot on={health.clickup} /> ClickUp</span>
            <span className="flex items-center gap-1.5"><Dot on={health.exa} /> Exa</span>
            <span className="flex items-center gap-1.5">
              <Dot on={health.analysis !== 'local-deterministic'} />
              Analysis: {health.analysis === 'local-deterministic' ? 'local engine (no model key)' : health.analysis}
            </span>
            <span className="text-gray-400">tier {health.tier}</span>
          </div>
        )}

        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <label className="text-[12.5px] text-gray-600">
              Channel
              <select value={channel} onChange={e => setChannel(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[13px]">
                {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </label>
            <label className="text-[12.5px] text-gray-600">
              Thread ts
              <input value={ts} onChange={e => setTs(e.target.value)} placeholder="1789198080.991569"
                     className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[13px]" />
            </label>
            <label className="text-[12.5px] text-gray-600">
              Skill
              <select value={skill} onChange={e => setSkill(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[13px]">
                {skills.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <button onClick={run} disabled={running || !channel || !ts}
                  className="px-4 py-2 rounded-full bg-[#008775] text-white text-[13.5px] font-medium disabled:opacity-40">
            {running ? 'Running…' : 'Run in thread'}
          </button>
          {error && <p className="text-[12.5px] text-rose-600">{error}</p>}
        </div>

        {result && (
          <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[16px] font-semibold">{result.story.title}</h2>
              <span className="flex items-center gap-2">
                <span className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-600">
                  engine: {result.engine}
                </span>
                <span className="text-[13px] text-[#008775] font-semibold">INVEST {result.invest.overall}/100</span>
              </span>
            </div>
            <p className="text-[13px] text-gray-700">
              <b>As a</b> {result.story.as_a} · <b>I want</b> {result.story.i_want} · <b>So that</b> {result.story.so_that}
            </p>
            <p className="text-[12.5px] text-gray-500">
              Read {result.messages_read} messages · <a className="text-[#008775] underline" href={result.permalink} target="_blank" rel="noreferrer">source thread</a>
            </p>

            <div className="space-y-1.5">
              {result.evidence.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-[12.5px]">
                  <span className={`px-1.5 py-0.5 rounded border shrink-0 ${LABEL_COLOR[e.label] ?? 'bg-gray-50 border-gray-200'}`}>{e.label}</span>
                  <span><b>{e.field}</b>: {e.value}{e.quote_source ? <i className="text-gray-500"> — {e.quote_source}</i> : null}</span>
                </div>
              ))}
            </div>

            {result.clarifying_question && (
              <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 text-[12.5px] text-amber-900">
                Asked back in the thread: {result.clarifying_question}
              </div>
            )}

            {result.ticket && (
              <a href={result.ticket.url} target="_blank" rel="noreferrer"
                 className="inline-block text-[13px] text-[#008775] underline">
                ClickUp {result.ticket.id} — {result.ticket.title}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
