// ------------------------------------------------------------
// Change Password page (Phase C.5)
//
// Admin → Change Password: authenticated self-service password
// change (POST /api/auth/change-password — SYSTEM_DESIGN §AN.8).
//
// Conventions mirror the existing admin pages: same shell styling,
// Alert banners (Feedback.jsx contract), busy gating, and the
// shared API client (credentials included; 401/503 →
// onUnauthorized). Server behavior after success: the session is
// INVALIDATED by the pwdAt stamp (§AN.7) — the page surfaces the
// server's message and routes the admin back to /login to sign in
// again. No automatic re-login is invented. Password values are
// never logged or displayed.
// ------------------------------------------------------------

import { useState } from 'react';
import request from '../services/api';
import { Alert, Loader } from '../components/Feedback';

function ChangePassword({ onUnauthorized }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setBusy(true);
    try {
      await request('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      // Success → the server has already invalidated this session
      // (pwdAt stamp). Send the admin to /login to sign in again.
      setNotice('Password changed. Please sign in again.');
      setTimeout(() => onUnauthorized(), 1200);
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) {
        onUnauthorized();
        return;
      }
      setError(err?.message || 'Password change failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    // Keep the form visible while submitting; show the spinner inline.
    return (
      <div className="min-h-screen bg-charcoal-50">
        <main className="mx-auto w-full max-w-md px-6 py-10">
          <Loader label="Changing password…" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-50">
      <main className="mx-auto w-full max-w-md px-6 py-10">
        <h1 className="text-xl font-bold text-forest-700">Change Password</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          Changing your password signs you out everywhere, including this device.
        </p>

        {error && (
          <div className="mt-4">
            <Alert kind="error" onClose={() => setError('')}>{error}</Alert>
          </div>
        )}
        {notice && (
          <div className="mt-4">
            <Alert kind="success">{notice}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-charcoal-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4">
            <div>
              <label htmlFor="current-password" className={labelClass}>Current password</label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                disabled={busy}
                required
              />
            </div>
            <div>
              <label htmlFor="new-password" className={labelClass}>New password</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                disabled={busy}
                minLength={8}
                required
              />
              <p className="mt-1 text-xs text-charcoal-400">Minimum 8 characters.</p>
            </div>
            <div>
              <label htmlFor="confirm-password" className={labelClass}>Confirm new password</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                disabled={busy}
                minLength={8}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-lg bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
          >
            {busy ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </main>
    </div>
  );
}

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-charcoal-500';
const inputClass = 'w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm text-charcoal-900 focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-100 disabled:opacity-50';

export default ChangePassword;
