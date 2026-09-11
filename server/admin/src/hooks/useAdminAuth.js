// ------------------------------------------------------------
// Admin auth hook (Phase 3.3 — stopgap until the real auth phase)
//
// Session-only unlock gated on the server's ADMIN_TOKEN. The UI
// hides management features without a token but ALWAYS defers to
// the server: every admin API call is rejected server-side when
// the token is missing or wrong.
// ------------------------------------------------------------

import { useCallback, useState } from 'react';
import request, {
  getStoredToken,
  storeToken,
  clearToken,
} from '../services/api';

export default function useAdminAuth() {
  const [token, setToken] = useState(getStoredToken);

  const unlock = useCallback(async (candidate) => {
    // Verify against the server before storing anything.
    await request('/api/admin/navigation', {
      headers: { Authorization: `Bearer ${candidate}` },
    }).catch((err) => {
      if (err.status === 401) throw new Error('Invalid admin key.');
      if (err.status === 503) {
        throw new Error('Admin API is not configured on the server (ADMIN_TOKEN missing).');
      }
      throw err;
    });
    storeToken(candidate);
    setToken(candidate);
  }, []);

  const lock = useCallback(() => {
    clearToken();
    setToken('');
  }, []);

  return { token, unlock, lock };
}
