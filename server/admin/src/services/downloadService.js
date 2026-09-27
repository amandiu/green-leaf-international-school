// ------------------------------------------------------------
// Admin downloads API service (Phase B.6)
// Page → this service → /api/admin/downloads
// Mirrors the galleryService admin pattern. Auth is the shared
// HttpOnly session cookie (attached by the shared fetch wrapper).
// Document uploads go through the centralized upload surface
// (POST /api/admin/uploads/document — shared pipeline, PDF
// allowlist branch); this service only persists the returned
// safe path.
// ------------------------------------------------------------

import request from './api';

/** All items (all statuses), display order; optional filters. */
export function fetchDownloads({ status, category } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/admin/downloads${query}`);
}

/** One item by id. */
export function fetchDownload(id) {
  return request(`/api/admin/downloads/${id}`);
}

/** Create an item (defaults to DRAFT server-side). */
export function createDownload(payload) {
  return request('/api/admin/downloads', { method: 'POST', body: payload });
}

/** Update editable fields (title/description/category/file/sort). */
export function updateDownload(id, payload) {
  return request(`/api/admin/downloads/${id}`, { method: 'PUT', body: payload });
}

/** Publish / unpublish (DRAFT) / archive without touching fields. */
export function setDownloadStatus(id, status) {
  return request(`/api/admin/downloads/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

/** Permanently delete an item (managed file cleanup is server-side). */
export function deleteDownload(id) {
  return request(`/api/admin/downloads/${id}`, { method: 'DELETE' });
}

/**
 * Upload one PDF to POST /api/admin/uploads/document.
 * Returns { file_path, bytes, original_filename, file_ext };
 * rejects with { status, message } like the shared fetch wrapper.
 */
export async function uploadDocument(file) {
  const form = new FormData();
  form.append('image', file, file.name); // same single-part contract as images

  let response;
  try {
    response = await fetch('/api/admin/uploads/document', {
      method: 'POST',
      credentials: 'include', // HttpOnly session cookie
      body: form,
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
  return payload?.data || {};
}
