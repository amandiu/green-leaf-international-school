// ------------------------------------------------------------
// ResetPasswordPage (Phase 3 — verification-code password reset)
//
//   POST /api/auth/reset-password  { email, code, newPassword, confirmPassword }
//
//   - reached from ForgotPasswordPage; the EMAIL arrives via
//     navigation state (mirrored to sessionStorage). The email is
//     pre-filled + editable — no code or password is ever stored
//     or carried in the URL (§3/§18).
//   - client-side validation: code = exactly 6 digits; password
//     policy mirrors the server rule (min 8); confirm must match.
//     The SERVER remains the final authority (§17).
//   - eye toggles are real <button type="button"> elements with
//     aria-label/aria-pressed — flipping only the input's `type`,
//     never the value (§16).
//   - busy-gated submit; success shows the message + Back to
//     Login. NO automatic login (§13) — no session is created
//     here, so a reset can never hand a session to the requester.
// ------------------------------------------------------------

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { siteConfig } from '../../../../shared/config/siteConfig';
import request from '../services/api';
import { Alert } from '../components/Feedback';
import { RESET_EMAIL_STORAGE_KEY } from './ForgotPasswordPage';

export default function ResetPasswordPage() {
  const location = useLocation();

  const stateEmail = typeof location.state?.email === 'string' ? location.state.email : '';
  let storedEmail = '';
  try { storedEmail = sessionStorage.getItem(RESET_EMAIL_STORAGE_KEY) || ''; } catch { /* private mode */ }
  const [email, setEmail] = useState(stateEmail || storedEmail);

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const inputClass = 'mt-1 w-full rounded-lg border border-charcoal-200 px-4 py-2 outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent disabled:bg-charcoal-50 disabled:opacity-60';
  const labelClass = 'block text-sm font-medium text-charcoal-700';

  const CODE_RE = /^\d{6}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Client-side checks ONLY — mirrors the server rules so honest
  // mistakes fail fast; the server re-validates everything (§17).
  function validateClient() {
    if (email.trim() === '') return 'Email is required.';
    if (!EMAIL_RE.test(email.trim().toLowerCase())) return 'Enter a valid email address.';
    if (!CODE_RE.test(code)) return 'Enter the 6-digit verification code.';
    if (newPassword.length < 8) return 'Password must be at least 8 characters.';
    if (newPassword.length > 200) return 'Password must be at most 200 characters.';
    if (newPassword !== confirmPassword) return 'Passwords do not match.';
    return '';
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validateClient();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    try {
      await request('/api/auth/reset-password', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          code,
          newPassword,
          confirmPassword,
        },
      });
      /* Success (§20/§24): clear the secrets from memory and show
         the message + Back to Login. The page NEVER renders the
         password. NO automatic login — the user signs in
         manually (§13). */
      setSuccess(true);
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      try { sessionStorage.removeItem(RESET_EMAIL_STORAGE_KEY); } catch { /* private mode */ }
    } catch (err) {
      setError(err?.message || 'Password reset failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-forest-700 text-center">
          Reset Password
        </h1>

        {success ? (
          // Success state (§20): manual sign-in only.
          <>
            <div className="mt-4">
              <Alert kind="success">
                Password reset successfully. You can now sign in with your new password.
              </Alert>
            </div>
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="rounded text-sm font-medium text-forest-600 hover:text-forest-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
              >
                Back to Login
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-center text-sm text-charcoal-500">
              A verification code has been sent if an account exists for this email.
            </p>

            {error && (
              <div className="mt-4">
                <Alert kind="error" onClose={() => setError('')}>{error}</Alert>
              </div>
            )}

            <form onSubmit={submit} data-testid="reset-password-form" autoComplete="off">
              <div className="mt-6">
                <label htmlFor="reset-email" className={labelClass}>Email</label>
                <input
                  id="reset-email"
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

              <div className="mt-4">
                <label htmlFor="reset-code" className={labelClass}>Verification Code</label>
                <input
                  id="reset-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${inputClass} tracking-[0.5em] text-center text-lg`}
                  placeholder="••••••"
                  maxLength={6}
                  disabled={busy}
                />
              </div>

              <div className="mt-4">
                <label htmlFor="reset-new-password" className={labelClass}>New Password</label>
                <div className="relative">
                  <input
                    id="reset-new-password"
                    type={showNew ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${inputClass} pr-11`}
                    placeholder="At least 8 characters"
                    maxLength={200}
                    disabled={busy}
                  />
                  <EyeToggleButton
                    visible={showNew}
                    onToggle={() => setShowNew((v) => !v)}
                    targetId="reset-new-password"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="reset-confirm-password" className={labelClass}>Confirm New Password</label>
                <div className="relative">
                  <input
                    id="reset-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${inputClass} pr-11`}
                    placeholder="Repeat the new password"
                    maxLength={200}
                    disabled={busy}
                  />
                  <EyeToggleButton
                    visible={showConfirm}
                    onToggle={() => setShowConfirm((v) => !v)}
                    targetId="reset-confirm-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="mt-6 w-full rounded-lg bg-forest-600 py-2.5 font-semibold text-white transition-colors hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Resetting…' : 'Reset Password'}
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
          </>
        )}

        <p className="mt-6 text-center text-xs text-charcoal-400">
          {siteConfig.seo.adminTitle}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ */
function EyeToggleButton({ visible, onToggle, targetId }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible}
      aria-controls={targetId}
      title={visible ? 'Hide password' : 'Show password'}
      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-charcoal-400 transition-colors hover:text-charcoal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
    >
      {visible ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
