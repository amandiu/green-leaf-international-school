// ------------------------------------------------------------
// Public leadership service
//
// Single place the client talks to the public leadership APIs.
// Uses the relative /api path so it works on localhost AND via
// the Vite proxy / Cloudflare tunnel (never hardcode
// localhost:5000). Follows the navigationService pattern.
// ------------------------------------------------------------

import { API_ROUTES } from '../../../shared/constants/api';

/**
 * Fetch the combined public leadership payload:
 *   { section: { eyebrow, title, description } | null, messages: [...] }
 * `section` is null when the admin deactivated the Leadership
 * section (the homepage then hides the whole block gracefully).
 */
export async function getPublicLeadership({ signal } = {}) {
  const response = await fetch(API_ROUTES.LEADERSHIP, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Leadership request failed with status ${response.status}`);
  }
  const payload = await response.json();
  if (
    !payload
    || payload.success !== true
    || typeof payload.data !== 'object'
    || payload.data === null
    || !Array.isArray(payload.data.messages)
  ) {
    throw new Error('Leadership API returned an unexpected response');
  }
  return payload.data;
}

/**
 * Fetch the active public leadership messages (messages only —
 * legacy convenience endpoint, kept for compatibility).
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
