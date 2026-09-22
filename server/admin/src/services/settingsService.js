// ------------------------------------------------------------
// Admin site settings API service (Phase A)
// Page → this service → /api/admin/settings
// Mirrors the navigationService/leadershipService pattern.
// Auth is the shared HttpOnly session cookie (credentials are
// attached by the shared fetch wrapper).
// ------------------------------------------------------------

import request from './api';

/** Current effective settings (DB values + siteConfig fallback). */
export function fetchAdminSettings() {
  return request('/api/admin/settings');
}

/**
 * Save settings. Payload: { identity: {...}, branding: {...}, ... }
 * — partial groups allowed. Returns { success, data } where data is
 * the merged effective settings AFTER the write.
 */
export function updateAdminSettings(payload) {
  return request('/api/admin/settings', { method: 'PUT', body: payload });
}
