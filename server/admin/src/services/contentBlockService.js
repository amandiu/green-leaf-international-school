// ------------------------------------------------------------
// Admin reusable content blocks API service (Phase D)
// Page → this service → /api/admin/content/blocks
// Mirrors the settingsService/homeContentService pattern.
// Auth is the shared HttpOnly session cookie (credentials are
// attached by the shared fetch wrapper).
// ------------------------------------------------------------

import request from './api';

/**
 * Effective blocks + derived usage ("Used in"). Performs the
 * one-time legacy reference migration on the backend.
 */
export function fetchAdminContentBlocks() {
  return request('/api/admin/content/blocks');
}

/**
 * Save a block's content. Payload: { name, content } — validated
 * per-type server-side. Returns { success, data: { blocks } }.
 */
export function updateContentBlock(key, payload) {
  return request(`/api/admin/content/blocks/${key}`, { method: 'PUT', body: payload });
}

/** Toggle a block's active flag without touching content. */
export function setContentBlockActive(key, isActive) {
  return request(`/api/admin/content/blocks/${key}/active`, {
    method: 'PATCH',
    body: { isActive },
  });
}

/**
 * Delete a block. Refused with 409 while the block is referenced
 * — the error message names the consumers.
 */
export function deleteContentBlock(key) {
  return request(`/api/admin/content/blocks/${key}`, { method: 'DELETE' });
}
