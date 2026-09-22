// ------------------------------------------------------------
// Public home content service (Phase B)
//
// Single place the client talks to GET /api/pages/home. Uses the
// relative /api path (same convention as settingsService) so it
// works on localhost AND via the Cloudflare quick tunnel.
// ------------------------------------------------------------

import { API_ROUTES } from '../../../shared/constants/api';

/**
 * Fetch the effective home content (DB values + per-section
 * fallback merged server-side). Resolves with the grouped
 * sections object; rejects with an Error whose message is safe
 * to log in the browser console.
 */
export async function getPublicHomeContent({ signal } = {}) {
  const response = await fetch(API_ROUTES.PAGES_HOME, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Home content request failed with status ${response.status}`);
  }
  const payload = await response.json();
  if (!payload || payload.success !== true || typeof payload.data !== 'object' || payload.data === null) {
    throw new Error('Home content API returned an unexpected response');
  }
  return payload.data;
}
