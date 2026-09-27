// ------------------------------------------------------------
// Public page content service (Phase B.3)
//
// Single place the client talks to GET /api/pages/:page for the
// DB-backed informational pages. Uses the relative /api path
// (same convention as homeContentService) so it works on
// localhost AND via the Cloudflare quick tunnel.
// ------------------------------------------------------------

import { API_ROUTES } from '../../../shared/constants/api';

/**
 * Fetch the effective page content (DB values + per-section
 * fallback merged server-side). Resolves with the grouped
 * sections object; rejects with an Error whose message is safe
 * to log in the browser console.
 */
export async function getPublicPageContent(page, { signal } = {}) {
  const routeMap = {
    about: API_ROUTES.PAGES_ABOUT,
    academics: API_ROUTES.PAGES_ACADEMICS,
    campus: API_ROUTES.PAGES_CAMPUS,
  };
  const route = routeMap[page];
  if (!route) {
    throw new Error(`Unknown page "${page}"`);
  }
  const response = await fetch(route, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Page content request failed with status ${response.status}`);
  }
  const payload = await response.json();
  if (!payload || payload.success !== true || typeof payload.data !== 'object' || payload.data === null) {
    throw new Error('Page content API returned an unexpected response');
  }
  return payload.data;
}

export default getPublicPageContent;
