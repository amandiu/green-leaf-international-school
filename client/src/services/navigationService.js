// ------------------------------------------------------------
// Public navigation service (Phase 3.4)
//
// Single place the client talks to the public navigation API.
// Uses the relative /api path so it works on localhost AND via
// the Cloudflare quick tunnel (never hardcode localhost:5000).
// ------------------------------------------------------------

import { API_ROUTES } from '../../../shared/constants/api';

/**
 * Fetch the active public navigation tree.
 * Resolves with the items array; rejects with an Error whose
 * message is safe to log in the browser console.
 */
export async function getPublicNavigation({ signal } = {}) {
  const response = await fetch(API_ROUTES.NAVIGATION, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Navigation request failed with status ${response.status}`);
  }
  const payload = await response.json();
  if (!payload || payload.success !== true || !Array.isArray(payload.data)) {
    throw new Error('Navigation API returned an unexpected response');
  }
  return payload.data;
}
