// ------------------------------------------------------------
// Admin auth hook (Admin auth phase)
//
// Real email/password authentication against the server:
//   POST /api/auth/login  → HttpOnly session cookie
//   GET  /api/auth/me     → restore the session on refresh
//   POST /api/auth/logout → invalidate in the browser
//
// No token is stored in the browser — the HttpOnly cookie is the
// credential and is never readable by JavaScript.
// ------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import request from '../services/api';

export default function useAdminAuth() {
  const [user, setUser] = useState(null);
  // `initializing` covers the refresh case: /api/auth/me decides
  // the session before any gate renders a redirect.
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    request('/api/auth/me')
      .then((res) => {
        if (!cancelled) setUser(res?.data?.user || null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Email + password login; throws { message } on failure. */
  const login = useCallback(async (email, password) => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setUser(res?.data?.user || null);
    return res?.data?.user;
  }, []);

  /** Logout (server clears the cookie) and drop local state. */
  const logout = useCallback(async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      /* the local state drop below is what matters in the UI */
    }
    setUser(null);
  }, []);

  return { user, initializing, login, logout };
}
