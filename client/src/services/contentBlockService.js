// ------------------------------------------------------------
// Public reusable content blocks service (Phase D)
//
// Single place the client talks to GET /api/content/blocks.
// Uses the relative /api path (same convention as the other
// services) so it works on localhost AND via the Cloudflare
// quick tunnel.
// ------------------------------------------------------------

import { API_ROUTES } from '../../../shared/constants/api';

/**
 * Fetch the effective reusable content blocks (DB values + shared
 * defaults merged server-side). Resolves with the blocks object
 * keyed by block_key; rejects with an Error whose message is safe
 * to log in the browser console.
 */
export async function getPublicContentBlocks({ signal } = {}) {
  const response = await fetch(API_ROUTES.CONTENT_BLOCKS, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Content blocks request failed with status ${response.status}`);
  }
  const payload = await response.json();
  if (!payload || payload.success !== true || typeof payload.data !== 'object' || payload.data === null) {
    throw new Error('Content blocks API returned an unexpected response');
  }
  return payload.data;
}

export default getPublicContentBlocks;
