// ------------------------------------------------------------
// AuthGate (Phase 3.3 — stopgap unlock until real auth phase)
//
// Wraps admin management screens. A valid admin key (verified by
// the server) unlocks the UI for this browser session only.
// The server remains the real gate: without a valid token every
// admin API call fails regardless of what this component shows.
// ------------------------------------------------------------

import { useState } from 'react';
import { Alert } from './Feedback';

export default function AuthGate({ unlocked, onUnlock, onLock, children }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (unlocked) {
    return (
      <div>
        <div className="flex justify-end px-6 pt-4">
          <button
            type="button"
            onClick={onLock}
            className="rounded-lg border border-charcoal-200 px-3 py-1.5 text-xs font-medium text-charcoal-600 hover:bg-charcoal-100 transition-colors"
          >
            Lock admin
          </button>
        </div>
        {children}
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onUnlock(key.trim());
      setKey('');
    } catch (err) {
      setError(err.message || 'Unlock failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal-50 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg"
      >
        <h1 className="text-2xl font-bold text-forest-700 text-center">
          Green Leaf Admin
        </h1>
        <p className="mt-2 text-center text-sm text-charcoal-500">
          Enter the admin key to manage navigation.
        </p>

        {error && (
          <div className="mt-4">
            <Alert kind="error" onClose={() => setError('')}>{error}</Alert>
          </div>
        )}

        <label
          htmlFor="admin-key"
          className="mt-6 block text-sm font-medium text-charcoal-700"
        >
          Admin key
        </label>
        <input
          id="admin-key"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-charcoal-200 px-4 py-2 outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent"
          placeholder="••••••••••••"
          required
        />

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-forest-600 py-2.5 font-semibold text-white transition-colors hover:bg-forest-700 disabled:opacity-60"
        >
          {busy ? 'Verifying…' : 'Unlock'}
        </button>

        <p className="mt-4 text-center text-xs text-charcoal-400">
          The key is set via ADMIN_TOKEN in the server environment.
        </p>
      </form>
    </div>
  );
}
