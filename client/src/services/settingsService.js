// ------------------------------------------------------------
// Public site settings service (Phase A)
//
// Single place the client talks to GET /api/settings. Uses the
// relative /api path (same convention as navigationService) so it
// works on localhost AND via the Cloudflare quick tunnel.
// ------------------------------------------------------------

import { API_ROUTES } from '../../../shared/constants/api';

/**
 * Fetch the effective site settings (DB values + siteConfig
 * fallback merged server-side). Resolves with the grouped
 * settings object; rejects with an Error whose message is safe
 * to log in the browser console.
 */
export async function getPublicSettings({ signal } = {}) {
  const response = await fetch(API_ROUTES.SETTINGS, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Settings request failed with status ${response.status}`);
  }
  const payload = await response.json();
  if (!payload || payload.success !== true || typeof payload.data !== 'object' || payload.data === null) {
    throw new Error('Settings API returned an unexpected response');
  }
  return payload.data;
}
