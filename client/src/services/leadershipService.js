// ------------------------------------------------------------
// Public leadership message service
//
// Single place the client talks to the public leadership API.
// Uses the relative /api path so it works on localhost AND via
// the Vite proxy / Cloudflare tunnel (never hardcode
// localhost:5000). Follows the navigationService pattern.
// ------------------------------------------------------------

import { API_ROUTES } from '../../../shared/constants/api';

/**
 * Fetch the active public leadership messages.
 * Resolves with the records array; rejects with an Error whose
 * message is safe to log in the browser console.
 */
export async function getPublicLeadershipMessages({ signal } = {}) {
  const response = await fetch(API_ROUTES.LEADERSHIP_MESSAGES, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Leadership request failed with status ${response.status}`);
  }
  const payload = await response.json();
  if (!payload || payload.success !== true || !Array.isArray(payload.data)) {
    throw new Error('Leadership API returned an unexpected response');
  }
  return payload.data;
}
