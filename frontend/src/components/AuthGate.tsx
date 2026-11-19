import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { getApiUrl } from '../api';

type SessionState = 'loading' | 'open' | 'locked';

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${getApiUrl()}/api/auth/session`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not check sign-in status.');
        return response.json();
      })
      .then((result) => {
        if (active) setState(result.auth_required && !result.authenticated ? 'locked' : 'open');
      })
      .catch(() => {
        // Local/static builds without an API keep working. Any API request still
        // gets enforced by the backend when public mode is enabled.
        if (active) setState('open');
      });
    return () => { active = false; };
  }, []);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error('That invite password did not match.');
      setPassword('');
      setState('open');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500" role="status">Checking access…</div>;
  }
  if (state === 'open') return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 text-slate-900">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-lg font-semibold text-teal-700">S</div>
        <h1 className="text-xl font-semibold tracking-tight">ScribeBA Studio</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Enter your invite password to open this workspace.</p>
        <label htmlFor="invite-password" className="mt-6 block text-sm font-medium text-slate-700">Invite password</label>
        <input
          autoComplete="current-password"
          id="invite-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
        />
        {error && <p className="mt-3 text-sm text-rose-600" role="alert">{error}</p>}
        <button disabled={submitting} className="mt-5 h-11 w-full rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60">
          {submitting ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </main>
  );
}
