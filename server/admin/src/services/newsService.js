// ------------------------------------------------------------
// Admin news API service (Phase E)
// Page → this service → /api/admin/news
// Mirrors the contentBlockService/settingsService pattern.
// Auth is the shared HttpOnly session cookie (credentials are
// attached by the shared fetch wrapper).
// ------------------------------------------------------------

import request from './api';

/** All items (all statuses), newest activity first. */
export function fetchAdminNews() {
  return request('/api/admin/news');
}

/** Create a draft (or explicitly-published) item. */
export function createNewsItem(payload) {
  return request('/api/admin/news', { method: 'POST', body: payload });
}

/** Update editable fields (title/type/excerpt/content/image/slug). */
export function updateNewsItem(id, payload) {
  return request(`/api/admin/news/${id}`, { method: 'PUT', body: payload });
}

/** Publish / unpublish (DRAFT) / archive without touching fields. */
export function setNewsStatus(id, status) {
  return request(`/api/admin/news/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

/** Permanently delete an item (news rows are not referenced elsewhere). */
export function deleteNewsItem(id) {
  return request(`/api/admin/news/${id}`, { method: 'DELETE' });
}
