// ------------------------------------------------------------
// News API service (Phase E) — public, read-only.
//
// The thin HTTP layer used by the central NewsProvider. No
// component fetches news on its own; everything goes through
// useNews() so the whole app shares ONE request.
// ------------------------------------------------------------

import { API_ROUTES } from '../../../shared/constants/api';

/**
 * Published news/notices, newest first. Each item:
 * { id, title, slug, type, excerpt, image, published_at,
 *   dateLabel } — `content` is detail-only.
 */
export function getPublishedNews() {
  return fetch(API_ROUTES.NEWS, { headers: { Accept: 'application/json' } })
    .then(async (res) => {
      if (!res.ok) throw new Error(`News API ${res.status}`);
      return res.json();
    })
    .then((data) => (Array.isArray(data?.items) ? data.items : []));
}

/** One published item by slug (detail page). */
export function getPublishedNewsBySlug(slug) {
  return fetch(`${API_ROUTES.NEWS}/${encodeURIComponent(slug)}`, {
    headers: { Accept: 'application/json' },
  }).then(async (res) => {
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`News API ${res.status}`);
    return res.json();
  });
}
