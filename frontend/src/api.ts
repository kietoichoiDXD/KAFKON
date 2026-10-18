// One place that knows where the backend is, so no component invents its own URL.

export const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('SCRIBEBA_API_URL');
    if (custom) return custom.trim().replace(/\/$/, '');
  }
  return (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
};

export const setApiUrl = (url: string): void => {
  if (typeof window !== 'undefined') {
    if (url.trim()) {
      localStorage.setItem('SCRIBEBA_API_URL', url.trim().replace(/\/$/, ''));
    } else {
      localStorage.removeItem('SCRIBEBA_API_URL');
    }
  }
};

export const API = getApiUrl();

export const isGitHubPages = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.includes('github.io');
};

export type Health = {
  mode: string;
  analysis: string;
  tier: string;
  slack: boolean;
  clickup: boolean;
  exa: boolean;
  openrouter?: boolean;
  gemini?: boolean;
  aws?: boolean;
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

export interface SafeFetchResult<T> {
  ok: boolean;
  data: T | null;
  error?: string;
  isHtml?: boolean;
}

/** Robust fetch that validates Content-Type and prevents SyntaxError on HTML (e.g. GitHub Pages 404). */
export async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<SafeFetchResult<T>> {
  try {
    const r = await fetch(url, init);
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return {
        ok: false,
        data: null,
        isHtml: true,
        error: `Endpoint returned HTML (${r.status} ${r.statusText}). When on GitHub Pages, start backend with 'python -m backend.cli serve' or connect your backend URL.`,
      };
    }
    const data = await r.json();
    if (!r.ok) {
      return {
        ok: false,
        data: null,
        error: data?.error || data?.message || `Request failed with status ${r.status}`,
      };
    }
    return { ok: true, data };
  } catch (err: any) {
    return {
      ok: false,
      data: null,
      error: err.message === 'Failed to fetch'
        ? 'Cannot reach API. Start backend with: python -m backend.cli serve'
        : err.message,
    };
  }
}

/** Returns null when the backend is unreachable, so callers can show an honest empty state or fallback. */
export async function get<T>(path: string): Promise<T | null> {
  const res = await safeFetchJson<T>(`${API}${path}`);
  return res.ok ? res.data : null;
}

export async function post<T>(path: string, body: any): Promise<T | null> {
  const res = await safeFetchJson<T>(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok ? res.data : null;
}

export const LABEL_COLOR: Record<string, string> = {
  Verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Inferred: 'bg-amber-50 text-amber-700 border-amber-200',
  Assumed: 'bg-purple-50 text-purple-700 border-purple-200',
  Blocked: 'bg-rose-50 text-rose-700 border-rose-200',
};
