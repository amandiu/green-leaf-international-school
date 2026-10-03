// ------------------------------------------------------------
// ForgotPasswordPage (Phase 2 — wired to the request API;
// Phase 3 — navigates into /reset-password on success)
//
//   - client-side email validation BEFORE the network call
//   - busy-gated submit (duplicate rapid submissions impossible)
//   - the server's GENERIC success message is shown verbatim —
//     the response is identical for known/unknown emails and the
//     page must never reveal whether an account exists
//   - on success the user continues to /reset-password; ONLY the
//     normalized email travels with the navigation state (and is
//     mirrored to sessionStorage so a reload keeps it). The
//     verification code and passwords NEVER touch storage (§18).
// ------------------------------------------------------------

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { siteConfig } from '../../../../shared/config/siteConfig';
import request from '../services/api';
import { Alert } from '../components/Feedback';

/** sessionStorage key — email only, never code/passwords (§18). */
export const RESET_EMAIL_STORAGE_KEY = 'gl_reset_email';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const inputClass = 'mt-1 w-full rounded-lg border border-charcoal-200 px-4 py-2 outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent disabled:bg-charcoal-50 disabled:opacity-60';
  const labelClass = 'block text-sm font-medium text-charcoal-700';

  // Client-side format check ONLY (mirrors the server validator:
  // trim + lowercase + bounded). Server validation stays the
  // authority; this just avoids a pointless network round-trip.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function validateClient(value) {
    const trimmed = value.trim();
    if (trimmed === '') return 'Email is required.';
    if (!EMAIL_RE.test(trimmed.toLowerCase())) return 'Enter a valid email address.';
    if (trimmed.length > 255) return 'Email must be at most 255 characters.';
    return '';
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validateClient(email);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    try {
      await request('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
      });
      // Generic success REGARDLESS of account existence — never
      // reflect the email back ("we sent it to …" is forbidden §20/§19).
      // Continue into the reset step with the email in local state.
      const normalized = email.trim().toLowerCase();
      try { sessionStorage.setItem(RESET_EMAIL_STORAGE_KEY, normalized); } catch { /* private mode */ }
      navigate('/reset-password', { state: { email: normalized } });
    } catch (err) {
      setError(err?.message || 'Password reset request failed. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-forest-700 text-center">
          Forgot Password
        </h1>

        <p className="mt-2 text-center text-sm text-charcoal-500">
          Enter your registered admin email and we&apos;ll send you a
          verification code to reset your password.
        </p>

        {error && (
          <div className="mt-4">
            <Alert kind="error" onClose={() => setError('')}>{error}</Alert>
          </div>
        )}

        <form onSubmit={submit} data-testid="forgot-password-form">
          <div className="mt-6">
            <label htmlFor="forgot-email" className={labelClass}>Email</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="admin@example.com"
              maxLength={255}
              disabled={busy}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-lg bg-forest-600 py-2.5 font-semibold text-white transition-colors hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Sending…' : 'Send Verification Code'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link
            to="/login"
            className="rounded text-sm font-medium text-forest-600 hover:text-forest-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
          >
            Back to Login
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-charcoal-400">
          {siteConfig.seo.adminTitle}
        </p>
      </div>
    </div>
  );
}
