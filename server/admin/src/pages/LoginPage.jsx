// ------------------------------------------------------------
// LoginPage (Admin auth phase)
//
// Replaces the placeholder login form in App.jsx with the real
// email + password flow against POST /api/auth/login. On success
// the router sends the user to their intended destination.
// ------------------------------------------------------------

import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Alert, Loader } from '../components/Feedback';

export default function LoginPage({ user, initializing, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
          Green Leaf Admin
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
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="••••••••"
          />
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
