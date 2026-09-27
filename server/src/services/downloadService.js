// ------------------------------------------------------------
// Download service (Phase B.6)
//
// THE single runtime source for public downloadable documents.
// Mirrors the gallery service (Phase B.2):
//
//   - status lifecycle DRAFT → PUBLISHED → ARCHIVED; the public
//     list AND file serving serve PUBLISHED rows only.
//   - The stored `file` reference is a MANAGED documents upload
//     path produced by the server-side pipeline (validated again
//     on write). The DB never stores client-supplied filesystem
//     paths, so serving by id cannot traverse the filesystem.
//   - Orphan-safe file cleanup (gallery/news pattern): a managed
//     file is unlinked ONLY when no other downloads row still
//     references it. Missing files count as success (idempotent).
//     Deletion failures never fail the request.
// ------------------------------------------------------------

import {
  findPublished, findPublishedCategories, findAllAdmin, findById,
  countFile, insert, update, updateStatus, remove,
} from '../models/Download.js';
import {
  validateDownloadPayload,
  validateDownloadStatusPayload,
  validateDownloadStatus,
  validateDownloadCategory,
} from '../validators/downloadValidation.js';
import { notFound } from '../utils/errors.js';
import pool from '../config/db.js';
import {
  deleteDocument, resolveDocumentPath,
  ALLOWED_DOCUMENT_EXTENSIONS,
} from '../utils/documentUpload.js';
import { stat } from 'node:fs/promises';

export { DOWNLOAD_CATEGORIES, DOWNLOAD_STATUSES } from '../validators/downloadValidation.js';

/** Publicly exportable formats/size facts (used by tests + UI copy). */
export const DOWNLOAD_FILE_RULES = Object.freeze({
  extensions: ALLOWED_DOCUMENT_EXTENSIONS,
  maxBytes: 10 * 1024 * 1024,
});

/**
 * Orphan-safe managed-file cleanup. The physical file is unlinked
 * ONLY when no other downloads row still references the same path.
 * Anything that is not a managed documents path resolves to null
 * and is never touched on disk.
 */
async function cleanupDocumentIfUnused(oldFile, replacementFile) {
  if (!oldFile || oldFile === replacementFile) return;
  if (!resolveDocumentPath(oldFile)) return; // not a managed path
  try {
    const [rows] = await pool
      .query('SELECT `id` FROM `downloads` WHERE `file` = ? LIMIT 1', [oldFile]);
    if (rows.length === 0) {
      await deleteDocument(oldFile);
    }
  } catch (err) {
    console.error('Download file cleanup failed:', err?.message || err);
  }
}

/** Public list of PUBLISHED items in display order. */
export async function getPublicDownloads({ category, limit, offset } = {}) {
  if (category) validateDownloadCategory(category);
  const items = await findPublished({ category, limit, offset });
  // Safe public projection: drop admin-only metadata (status,
  // sort_order, timestamps). The managed file reference doubles as
  // the public download link (served through the DB by id).
  return items.map(({
    status, sort_order, created_at, updated_at, ...pub
  }) => pub);
}

/** Distinct categories with published items (public filter chips). */
export async function getPublicDownloadCategories() {
  return findPublishedCategories();
}

/** Admin list (all statuses, optional filters). */
export async function getAdminDownloads({ status, category } = {}) {
  if (status) validateDownloadStatus(status);
  if (category) validateDownloadCategory(category);
  return findAllAdmin({ status, category });
}

/** Admin detail by id. */
export async function getAdminDownloadById(id) {
  const item = await findById(id);
  if (!item) throw notFound(`Download ${id} not found`);
  return item;
}

/**
 * Create a download row. Defaults to DRAFT; publishing goes
 * through the status endpoint (same lifecycle as news/gallery).
 */
export async function createDownload(input) {
  const clean = validateDownloadPayload(input);
  const id = await insert({
    ...clean,
    status: 'DRAFT',
    original_filename: clean.original_filename ?? null,
    file_ext: clean.file_ext ?? null,
    file_bytes: clean.file_bytes ?? null,
  });
  return getAdminDownloadById(id);
}

/**
 * Update editable fields. File replacement: the new reference is
 * validated and the DB is updated first; the replaced managed
 * file is cleaned up afterward ONLY if no other row references it
 * (gallery convention — the row update is what matters).
 */
export async function updateDownload(id, input) {
  const existing = await findById(id);
  if (!existing) throw notFound(`Download ${id} not found`);

  const clean = validateDownloadPayload(input, { partial: true });
  const next = {
    title: clean.title ?? existing.title,
    description: clean.description !== undefined ? clean.description : existing.description,
    category: clean.category ?? existing.category,
    file: clean.file ?? existing.file,
    // Replacement metadata rides with a new file reference; when
    // only metadata is edited, the stored values are preserved.
    original_filename: clean.file ? (clean.original_filename ?? existing.original_filename) : existing.original_filename,
    file_ext: clean.file ? (clean.file_ext ?? existing.file_ext) : existing.file_ext,
    file_bytes: clean.file ? (clean.file_bytes ?? existing.file_bytes) : existing.file_bytes,
    sort_order: clean.sort_order ?? existing.sort_order,
  };
  // A file replacement MUST carry consistent metadata — require the
  // caller (the admin UI) to pass the upload response facts.
  if (clean.file && !clean.original_filename) {
    next.original_filename = null;
    next.file_ext = null;
    next.file_bytes = null;
  }
  await update(id, next);
  await cleanupDocumentIfUnused(existing.file, next.file);
  return getAdminDownloadById(id);
}

/** Status transition (publish/unpublish/archive). */
export async function setDownloadStatus(id, input) {
  const existing = await findById(id);
  if (!existing) throw notFound(`Download ${id} not found`);
  const { status } = validateDownloadStatusPayload(input);
  await updateStatus(id, status);
  return getAdminDownloadById(id);
}

/**
 * Delete a download row. The managed file is unlinked only when
 * no other row references it; missing files are already-success.
 */
export async function deleteDownload(id) {
  const existing = await findById(id);
  if (!existing) throw notFound(`Download ${id} not found`);
  await remove(id);
  await cleanupDocumentIfUnused(existing.file, null);
  return { deleted: existing.id };
}

/**
 * Resolve a PUBLISHED download for secure serving. Returns the DB
 * row + a strictly-confined absolute path (or null when the
 * physical file is missing). THIS is the serving gate: the
 * requested id must be PUBLISHED, and the path comes from the DB
 * reference — never from URL input — so arbitrary filesystem
 * reads are impossible by construction.
 */
export async function resolvePublishedDownloadFile(id) {
  const item = await findById(id);
  if (!item) throw notFound('Download not found');
  if (item.status !== 'PUBLISHED') {
    throw notFound('Download not found');
  }
  const filePath = resolveDocumentPath(item.file);
  if (!filePath) {
    // Malformed reference (should be impossible — validated on
    // write). Log server-side, answer safely.
    console.error(`Download ${item.id}: unresolvable file reference`);
    throw notFound('Download not found');
  }
  try {
    await stat(filePath);
  } catch {
    console.error(`Download ${item.id}: managed file missing on disk: ${item.file}`);
    throw notFound('Download not found');
  }
  return {
    item,
    filePath,
    filename: item.original_filename || `${item.title}.pdf`,
    contentType: 'application/pdf',
  };
}
