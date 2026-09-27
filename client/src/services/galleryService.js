// ------------------------------------------------------------
// Gallery API service (Phase B.2) — public, read-only.
//
// The thin HTTP layer used by the useGallery hook. No component
// fetches gallery data on its own; everything goes through
// useGallery() so consumers share one cached list.
// ------------------------------------------------------------

import { API_ROUTES } from '../../../shared/constants/api';

/**
 * Published gallery items in display order, optionally filtered by
 * category. Each item: { id, title, caption, image, category,
 * sort_order }. Unpublished items can never appear here (server
 * serves PUBLISHED only).
 */
export function getPublishedGallery({ category, limit } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (limit) params.set('limit', String(limit));
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetch(`${API_ROUTES.GALLERY}${query}`, {
    headers: { Accept: 'application/json' },
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Gallery API ${res.status}`);
      return res.json();
    })
    .then((data) => (Array.isArray(data?.items) ? data.items : []));
}

/** Categories that currently have published items (for filters). */
export function getPublishedGalleryCategories() {
  return fetch(`${API_ROUTES.GALLERY}/categories`, {
    headers: { Accept: 'application/json' },
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Gallery API ${res.status}`);
      return res.json();
    })
    .then((data) => (Array.isArray(data?.data?.categories) ? data.data.categories : []));
}
