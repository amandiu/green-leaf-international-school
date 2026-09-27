// ------------------------------------------------------------
// Download input validation (Phase B.6)
//
// Pure format/shape validation — no database access. Unknown
// fields are REJECTED (never silently accepted), matching the
// Phase A/B/D/E/B.1/B.2 validation style.
//
//   POST   /api/admin/downloads             (create)
//   PUT    /api/admin/downloads/:id         (edit metadata)
//   PATCH  /api/admin/downloads/:id/status  (publish/unpublish)
//   GET    /api/downloads?category=…        (public filter value)
//
// File-path safety: the stored reference must be a MANAGED
// documents upload path (/api/uploads/documents/<generated>.pdf)
// produced by the server-side upload pipeline. Arbitrary paths,
// absolute URLs, traversal shapes and double extensions are
// rejected — the client can never point a download row at an
// arbitrary filesystem file.
// ------------------------------------------------------------

import { badRequest } from '../utils/errors.js';

/** Publication lifecycle — the news/gallery vocabulary, reused. */
export const DOWNLOAD_STATUSES = Object.freeze(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

/**
 * Controlled category vocabulary (MASTER PLAN §12 DOWNLOAD CENTER
 * list: Prospectus, Syllabus, Routine, Question Papers, Forms,
 * Notices, Circulars, Academic Documents, Rules & Regulations).
 * A constrained VARCHAR — no relational category system.
 */
export const DOWNLOAD_CATEGORIES = Object.freeze([
  'Prospectus', 'Syllabus', 'Routine', 'Question Papers',
  'Forms', 'Notices', 'Circulars', 'Academic Documents',
  'Rules & Regulations', 'Other',
]);

const TITLE_MAX = 200;        // matches downloads.title
const DESCRIPTION_MAX = 500;  // matches downloads.description
const CATEGORY_MAX = 50;      // matches downloads.category
const SORT_MAX = 100000;

/** Managed documents upload path: /api/uploads/documents/<generated>.pdf */
const DOCUMENT_PATH_RE = /^\/api\/uploads\/documents\/[A-Za-z0-9.-]+\.pdf$/;

/** Status must be one of the known lifecycle values (service filter guard). */
export function validateDownloadStatus(value) {
  if (!DOWNLOAD_STATUSES.includes(value)) {
    throw badRequest(`status must be one of: ${DOWNLOAD_STATUSES.join(', ')}`);
  }
  return value;
}

/** Category must be one of the known values (filter guard + payload rule). */
export function validateDownloadCategory(value) {
  if (typeof value !== 'string' || !DOWNLOAD_CATEGORIES.includes(value)) {
    throw badRequest(`category must be one of: ${DOWNLOAD_CATEGORIES.join(', ')}`);
  }
  return value;
}

/** Required bounded string: trims, rejects empty/whitespace-only. */
function requireTrimmed(value, label, max) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest(`${label} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw badRequest(`${label} must be at most ${max} characters`);
  }
  return trimmed;
}

/** Optional string: undefined/'' → undefined (column stays NULL). */
function optionalTrimmed(value, label, max) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw badRequest(`${label} must be a string or null`);
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw badRequest(`${label} must be at most ${max} characters`);
  }
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Safe file reference. Accepts ONLY a managed documents upload
 * path with a single .pdf extension (server-generated filenames
 * match [0-9a-z.-] and contain no separators). Everything else —
 * absolute URLs, backslashes, "..", other extensions, legacy
 * site paths — is rejected.
 */
export function validateDownloadFile(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest('file is required — upload a document through the file uploader');
  }
  const trimmed = value.trim();
  if (trimmed.length > 500) {
    throw badRequest('file must be at most 500 characters');
  }
  if (trimmed.includes('..') || trimmed.includes('\\') || trimmed.includes('%')) {
    throw badRequest('file must be a safe managed upload path');
  }
  if (!DOCUMENT_PATH_RE.test(trimmed)) {
    throw badRequest('file must be a managed PDF upload path (/api/uploads/documents/….pdf)');
  }
  // No double extensions (file.pdf.js style names are impossible
  // by generation, but the reference is validated defensively).
  if ((trimmed.match(/\.pdf/gi) || []).length !== 1) {
    throw badRequest('file must reference exactly one .pdf document');
  }
  return trimmed;
}

/**
 * Validate + normalize a create/edit payload:
 *   { title, description?, file, category, sort_order? }
 * Unknown fields are rejected; whitespace is normalized.
 * `partial` (edit) only validates provided fields.
 */
export function validateDownloadPayload(input, { partial = false } = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const ALLOWED = ['title', 'description', 'file', 'category', 'sort_order',
    'original_filename', 'file_ext', 'file_bytes'];
  const unknown = Object.keys(input).filter((k) => !ALLOWED.includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }

  const clean = {};

  if (input.title !== undefined || !partial) {
    clean.title = requireTrimmed(input.title, 'title', TITLE_MAX);
  }
  if (input.file !== undefined || !partial) {
    clean.file = validateDownloadFile(input.file);
  }
  if (input.category !== undefined || !partial) {
    const category = requireTrimmed(input.category, 'category', CATEGORY_MAX);
    if (!DOWNLOAD_CATEGORIES.includes(category)) {
      throw badRequest(`category must be one of: ${DOWNLOAD_CATEGORIES.join(', ')}`);
    }
    clean.category = category;
  }
  if (input.description !== undefined) {
    clean.description = optionalTrimmed(input.description, 'description', DESCRIPTION_MAX) ?? null;
  }
  if (input.sort_order !== undefined) {
    const n = typeof input.sort_order === 'string' && input.sort_order.trim() !== ''
      ? Number(input.sort_order)
      : input.sort_order;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > SORT_MAX) {
      throw badRequest(`sort_order must be an integer between 0 and ${SORT_MAX}`);
    }
    clean.sort_order = n;
  }

  // Upload metadata (Phase B.6) — DISPLAY-ONLY facts echoed from the
  // upload response. They never influence storage or serving (the
  // real bytes/ext are validated at upload time; serving derives
  // the Content-Type from the pipeline, not these fields).
  if (input.original_filename !== undefined) {
    if (input.original_filename === null || input.original_filename === '') {
      clean.original_filename = null;
    } else {
      if (typeof input.original_filename !== 'string') {
        throw badRequest('original_filename must be a string or null');
      }
      // No directory components, no CR/LF (header-injection safe).
      const base = input.original_filename.split(/[\\/]/).pop().replace(/[\r\n]/g, '').trim();
      if (base.length > 255) throw badRequest('original_filename must be at most 255 characters');
      clean.original_filename = base || null;
    }
  }
  if (input.file_ext !== undefined) {
    if (input.file_ext === null || input.file_ext === '') {
      clean.file_ext = null;
    } else if (input.file_ext !== 'pdf') {
      throw badRequest('file_ext must be "pdf"');
    } else {
      clean.file_ext = 'pdf';
    }
  }
  if (input.file_bytes !== undefined) {
    if (input.file_bytes === null || input.file_bytes === '') {
      clean.file_bytes = null;
    } else {
      const n = typeof input.file_bytes === 'string' && input.file_bytes.trim() !== ''
        ? Number(input.file_bytes)
        : input.file_bytes;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 10 * 1024 * 1024) {
        throw badRequest('file_bytes must be an integer between 1 and 10485760');
      }
      clean.file_bytes = n;
    }
  }

  return clean;
}

/**
 * Validate a status-transition payload { status } (admin PATCH).
 * Unknown fields are rejected (same pattern as news/gallery).
 */
export function validateDownloadStatusPayload(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const unknown = Object.keys(input).filter((k) => !['status'].includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }
  if (!DOWNLOAD_STATUSES.includes(input.status)) {
    throw badRequest(`status must be one of: ${DOWNLOAD_STATUSES.join(', ')}`);
  }
  return { status: input.status };
}
