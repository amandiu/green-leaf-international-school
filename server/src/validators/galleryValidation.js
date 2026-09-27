// ------------------------------------------------------------
// Gallery item input validation (Phase B.2)
//
// Pure format/shape validation — no database access. Unknown
// fields are REJECTED (never silently accepted), matching the
// Phase A/B/D/E/B.1 validation style.
//
//   POST   /api/admin/gallery              (create)
//   PUT    /api/admin/gallery/:id          (edit metadata)
//   PATCH  /api/admin/gallery/:id/status   (publish/unpublish)
//   GET    /api/gallery?category=…         (public filter value)
//
// Image path safety: the stored reference must be a MANAGED
// upload path (/api/uploads/images/<plain file>) or a legacy
// site-relative path (/Activity/…). Arbitrary filesystem paths,
// absolute URLs and traversal shapes are rejected.
// ------------------------------------------------------------

import { badRequest } from '../utils/errors.js';

/** Publication lifecycle — the news_items vocabulary, reused. */
export const GALLERY_STATUSES = Object.freeze([
  'DRAFT', 'PUBLISHED', 'ARCHIVED',
]);

/**
 * Planned categories (MASTER PLAN §12). A simple constrained
 * VARCHAR — NO relational album system (documented decision).
 */
export const GALLERY_CATEGORIES = Object.freeze([
  'Academic Events', 'Sports', 'Cultural Programs', 'Science Fair',
  'Educational Tour', 'School Events', 'Campus', 'Other',
]);

const TITLE_MAX = 150;    // matches gallery_items.title
const CAPTION_MAX = 500;  // matches gallery_items.caption
const CATEGORY_MAX = 50;  // matches gallery_items.category
const SORT_MAX = 100000;

/** Managed generic upload path: /api/uploads/images/<plain file>. */
const UPLOAD_PATH_RE = /^\/api\/uploads\/images\/[A-Za-z0-9._-]+$/;
/** Legacy site-relative asset paths (e.g. /Activity/foo.jpg). */
const SITE_ASSET_RE = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@% ]+$/;

/** Status must be one of the known lifecycle values (service filter guard). */
export function validateGalleryStatus(value) {
  if (!GALLERY_STATUSES.includes(value)) {
    throw badRequest(`status must be one of: ${GALLERY_STATUSES.join(', ')}`);
  }
  return value;
}

/** Category must be one of the known values (filter guard + payload rule). */
export function validateGalleryCategory(value) {
  if (typeof value !== 'string' || !GALLERY_CATEGORIES.includes(value)) {
    throw badRequest(`category must be one of: ${GALLERY_CATEGORIES.join(', ')}`);
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
 * Safe image reference. Accepts only the two sanctioned shapes;
 * absolute URLs, backslashes, "..", and anything outside the
 * managed upload namespace is rejected (no client-controlled
 * filesystem paths, ever).
 */
export function validateGalleryImage(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest('image is required — upload one through the image uploader');
  }
  const trimmed = value.trim();
  if (trimmed.length > 500) {
    throw badRequest('image must be at most 500 characters');
  }
  if (trimmed.includes('..') || trimmed.includes('\\')) {
    throw badRequest('image must be a safe site-relative path');
  }
  const isUpload = UPLOAD_PATH_RE.test(trimmed);
  // Legacy assets: site-relative but NOT inside a managed upload
  // namespace with a non-conforming filename.
  const isLegacy = !isUpload
    && SITE_ASSET_RE.test(trimmed)
    && !trimmed.startsWith('/api/');
  if (!isUpload && !isLegacy) {
    throw badRequest('image must be a managed upload path (/api/uploads/images/…) or a site-relative asset path');
  }
  return trimmed;
}

/**
 * Validate + normalize a create/edit payload:
 *   { title, caption?, image, category, sort_order? }
 * Unknown fields are rejected; whitespace is normalized.
 * `partial` (edit) only validates provided fields.
 */
export function validateGalleryPayload(input, { partial = false } = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const ALLOWED = ['title', 'caption', 'image', 'category', 'sort_order'];
  const unknown = Object.keys(input).filter((k) => !ALLOWED.includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }

  const clean = {};

  if (input.title !== undefined || !partial) {
    clean.title = requireTrimmed(input.title, 'title', TITLE_MAX);
  }
  if (input.image !== undefined || !partial) {
    clean.image = validateGalleryImage(input.image);
  }
  if (input.category !== undefined || !partial) {
    const category = requireTrimmed(input.category, 'category', CATEGORY_MAX);
    if (!GALLERY_CATEGORIES.includes(category)) {
      throw badRequest(`category must be one of: ${GALLERY_CATEGORIES.join(', ')}`);
    }
    clean.category = category;
  }
  if (input.caption !== undefined) {
    clean.caption = optionalTrimmed(input.caption, 'caption', CAPTION_MAX) ?? null;
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

  return clean;
}

/**
 * Validate a status-transition payload { status } (admin PATCH).
 * Unknown fields are rejected (same pattern as news/contact).
 */
export function validateGalleryStatusPayload(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const unknown = Object.keys(input).filter((k) => !['status'].includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }
  if (!GALLERY_STATUSES.includes(input.status)) {
    throw badRequest(`status must be one of: ${GALLERY_STATUSES.join(', ')}`);
  }
  return { status: input.status };
}
