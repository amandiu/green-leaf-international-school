// ------------------------------------------------------------
// Admin navigation API service (Phase 3.3)
// Page → this service → /api/admin/navigation
// ------------------------------------------------------------

import request from './api';

export function fetchAdminNavigation() {
  return request('/api/admin/navigation');
}

export function createNavigationItem(payload) {
  return request('/api/admin/navigation', { method: 'POST', body: payload });
}

export function updateNavigationItem(id, payload) {
  return request(`/api/admin/navigation/${id}`, { method: 'PUT', body: payload });
}

export function deleteNavigationItem(id) {
  return request(`/api/admin/navigation/${id}`, { method: 'DELETE' });
}
