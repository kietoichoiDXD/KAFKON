// One place that knows where the backend is, so no component invents its own URL.
export const API = 'http://localhost:8000';

export type Health = {
  mode: string;
  analysis: string;
  tier: string;
  slack: boolean;
  clickup: boolean;
  exa: boolean;
};

export type Evidence = {
  label: 'Verified' | 'Inferred' | 'Assumed' | 'Blocked' | string;
  field: string;
  value: string;
  quote_source?: string | null;
};

export type Run = {
  at: string;
  skill: string;
  channel: string;
  permalink: string;
  title: string;
  invest: number;
  engine?: string;
  evidence: Evidence[];
  clarifying_question?: string | null;
  ticket?: { id: string; url: string; title: string } | null;
};

export type Skill = {
  name: string;
  version: string;
  team_type: string;
  description: string;
  required_fields: string[];
};

/** Returns null when the backend is unreachable, so callers can show an honest empty state
 *  instead of sample data pretending to be real. */
export async function get<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d && (d as any).error ? null : (d as T);
  } catch {
    return null;
  }
}

export const LABEL_COLOR: Record<string, string> = {
  Verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Inferred: 'bg-amber-50 text-amber-700 border-amber-200',
  Assumed: 'bg-purple-50 text-purple-700 border-purple-200',
  Blocked: 'bg-rose-50 text-rose-700 border-rose-200',
};
