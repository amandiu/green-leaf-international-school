// ------------------------------------------------------------
// Admin leadership API service
// Page → this service → /api/admin/leadership-messages
// Mirrors the navigationService pattern. Uploads use multipart
// via the shared fetch wrapper's bypass (FormData must not be
// JSON-stringified, so a dedicated uploader is provided).
// ------------------------------------------------------------

import request, { getStoredToken } from './api';

export function fetchAdminLeadershipMessages() {
  return request('/api/admin/leadership-messages');
}

export function createLeadershipMessage(payload) {
  return request('/api/admin/leadership-messages', { method: 'POST', body: payload });
}

export function updateLeadershipMessage(id, payload) {
  return request(`/api/admin/leadership-messages/${id}`, { method: 'PUT', body: payload });
}

export function deleteLeadershipMessage(id) {
  return request(`/api/admin/leadership-messages/${id}`, { method: 'DELETE' });
}

/**
 * Upload a leadership portrait. Sends multipart/form-data with a
 * single "image" part. Returns { image_url } on success; rejects
 * with { status, message } on failure (same shape as `request`).
 */
export async function uploadLeadershipImage(file) {
  const form = new FormData();
  form.append('image', file, file.name);

  let response;
  try {
    response = await fetch('/api/admin/leadership-messages/image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getStoredToken()}` },
      body: form, // browser sets the multipart Content-Type + boundary
    });
  } catch {
    throw { status: 0, message: 'Cannot reach the server. Check your connection.' };
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw {
      status: response.status,
      message: payload?.message || `Upload failed (${response.status})`,
    };
  }
  return payload;
}
