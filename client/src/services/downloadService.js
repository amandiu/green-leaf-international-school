// ------------------------------------------------------------
// Public downloads service (Phase B.6)
//
// Single place the client talks to the public downloads APIs.
// Uses the relative /api path (same convention as galleryService)
// so it works on localhost AND via the Cloudflare quick tunnel.
// ------------------------------------------------------------

import { API_ROUTES } from '../../../shared/constants/api';

/**
 * Published downloads, display order. Each item:
 * { id, title, description, category, file, original_filename,
 *   file_ext, file_bytes } — the managed file reference doubles
 * as the download link (served securely through /api/downloads/:id/file).
 */
export async function getPublishedDownloads({ category, signal } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_ROUTES.DOWNLOADS}${query}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Downloads request failed with status ${response.status}`);
  }
  const payload = await response.json();
  if (!payload || payload.success !== true || !Array.isArray(payload.data?.items)) {
    throw new Error('Downloads API returned an unexpected response');
  }
  return payload.data.items;
}

/** Categories that currently have published items (filter chips). */
export async function getPublishedDownloadCategories({ signal } = {}) {
  const response = await fetch(`${API_ROUTES.DOWNLOADS}/categories`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Download categories request failed with status ${response.status}`);
  }
  const payload = await response.json();
  if (!payload || payload.success !== true || !Array.isArray(payload.data?.categories)) {
    throw new Error('Download categories API returned an unexpected response');
  }
  return payload.data.categories;
}

/** Human-readable size for the cards. */
export function formatDownloadSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Secure download URL for a published item. */
export function downloadFileUrl(id) {
  return `${API_ROUTES.DOWNLOADS}/${id}/file`;
}
