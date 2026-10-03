// ------------------------------------------------------------
// LoginPage (Admin auth phase)
//
// Replaces the placeholder login form in App.jsx with the real
// email + password flow against POST /api/auth/login. On success
// the router sends the user to their intended destination.
// ------------------------------------------------------------

import { useState } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { siteConfig } from '../../../../shared/config/siteConfig';
import { Alert, Loader } from '../components/Feedback';

export default function LoginPage({ user, initializing, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Phase 1: password visibility toggle — pure UI state, the value
  // itself is never touched (C2.4).
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-50">
        <Loader label="Checking session…" />
      </div>
    );
  }

  // Already logged in → no reason to show the form again.
  if (user) {
    return <Navigate to={from} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    setBusy(true);
    try {
      await onLogin(email.trim(), password);
      setPassword('');
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'mt-1 w-full rounded-lg border border-charcoal-200 px-4 py-2 outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-charcoal-700';

  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal-50 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg"
      >
        <h1 className="text-2xl font-bold text-forest-700 text-center">
          {siteConfig.seo.adminTitle}
        </h1>
        <p className="mt-2 text-center text-sm text-charcoal-500">
          Sign in with your admin account.
        </p>

        {error && (
          <div className="mt-4">
            <Alert kind="error" onClose={() => setError('')}>{error}</Alert>
          </div>
        )}

        <div className="mt-6">
          <label htmlFor="admin-email" className={labelClass}>Email</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="admin@example.com"
            maxLength={255}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="admin-password" className={labelClass}>Password</label>
          <div className="relative">
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-11`}
              placeholder="••••••••"
            />
            {/* type="button" keeps the toggle out of the form submit;
                only the input's `type` flips — the value never changes. */}
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              title={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-charcoal-400 transition-colors hover:text-charcoal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {/* Phase 1: entry point only — the real reset flow lands later. */}
        <div className="mt-2 text-right">
          <Link
            to="/forgot-password"
            className="rounded text-sm font-medium text-forest-600 hover:text-forest-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
          >
            Forgot Password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-forest-600 py-2.5 font-semibold text-white transition-colors hover:bg-forest-700 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Login'}
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------
 * Phase 1: password visibility icons — minimal inline SVGs so
 * no icon-library dependency is added. Decorative only; the
 * wrapping button carries the accessible name.
 * ------------------------------------------------------------ */
function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
