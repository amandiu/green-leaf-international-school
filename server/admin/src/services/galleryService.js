// ------------------------------------------------------------
// Admin gallery API service (Phase B.2)
// Page → this service → /api/admin/gallery
// Mirrors the newsService admin pattern. Auth is the shared
// HttpOnly session cookie (attached by the shared fetch wrapper).
// Image uploads go through the existing uploadService (shared
// pipeline) — this service only persists the returned safe path.
// ------------------------------------------------------------

import request from './api';

/** All items (all statuses), display order; optional filters. */
export function fetchGalleryItems({ status, category } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/admin/gallery${query}`);
}

/** One item by id. */
export function fetchGalleryItem(id) {
  return request(`/api/admin/gallery/${id}`);
}

/** Create an item (defaults to DRAFT server-side). */
export function createGalleryItem(payload) {
  return request('/api/admin/gallery', { method: 'POST', body: payload });
}

/** Update editable metadata/image. */
export function updateGalleryItem(id, payload) {
  return request(`/api/admin/gallery/${id}`, { method: 'PUT', body: payload });
}

/** Publish / unpublish (DRAFT) / archive without touching fields. */
export function setGalleryItemStatus(id, status) {
  return request(`/api/admin/gallery/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

/** Permanently delete an item (image file cleanup is server-side). */
export function deleteGalleryItem(id) {
  return request(`/api/admin/gallery/${id}`, { method: 'DELETE' });
}
