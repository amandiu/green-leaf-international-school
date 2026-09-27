// ------------------------------------------------------------
// Admin contact messages API service (Phase B.1)
// Page → this service → /api/admin/contact-messages
// Mirrors the newsService admin pattern. Auth is the shared
// HttpOnly session cookie (attached by the shared fetch wrapper).
// ------------------------------------------------------------

import request from './api';

/** All messages (newest first), or filtered by inbox status. */
export function fetchContactMessages(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/api/admin/contact-messages${query}`);
}

/** One message by id. */
export function fetchContactMessage(id) {
  return request(`/api/admin/contact-messages/${id}`);
}

/** Move a message through the inbox lifecycle (READ/REPLIED/ARCHIVED…). */
export function setContactMessageStatus(id, status) {
  return request(`/api/admin/contact-messages/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

/** Permanently delete a message (contact rows are not referenced elsewhere). */
export function deleteContactMessage(id) {
  return request(`/api/admin/contact-messages/${id}`, { method: 'DELETE' });
}
