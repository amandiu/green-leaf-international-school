// ------------------------------------------------------------
// Admin home content API service (Phase B)
// Page → this service → /api/admin/pages/home
// Mirrors the settingsService pattern. Auth is the shared
// HttpOnly session cookie (attached by the shared fetch wrapper).
// ------------------------------------------------------------

import request from './api';

/** Current effective home content (DB values + section fallbacks). */
export function fetchAdminHome() {
  return request('/api/admin/pages/home');
}

/**
 * Save one section. Payload: the section's content object
 * (validated per-section server-side). Returns { success, data }
 * where data is the merged effective home content AFTER the write.
 */
export function updateHomeSection(sectionKey, payload) {
  return request(`/api/admin/pages/home/sections/${sectionKey}`, {
    method: 'PUT',
    body: payload,
  });
}

// ------------------------------------------------------------
// Phase B.3: generic page content API — same endpoints
// generalized to any validated page identifier
// ('about' | 'academics' | 'campus'). Auth is unchanged (shared
// HttpOnly session cookie via the shared fetch wrapper).
// ------------------------------------------------------------

/** Current effective page content (DB values + section fallbacks). */
export function fetchAdminPage(page) {
  return request(`/api/admin/pages/${page}`);
}

/**
 * Save one section of one page. Payload: the section's content
 * object (validated per-section server-side). Returns
 * { success, data } where data is the merged effective page
 * content AFTER the write.
 */
export function updatePageSection(page, sectionKey, payload) {
  return request(`/api/admin/pages/${page}/sections/${sectionKey}`, {
    method: 'PUT',
    body: payload,
  });
}
