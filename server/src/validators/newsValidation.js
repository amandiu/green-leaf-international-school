// ------------------------------------------------------------
// News input validation (Phase E)
//
// Pure format/shape validation — no database access. Unknown
// fields are REJECTED (never silently accepted), matching the
// Phase A/B/D validation style.
//
//   POST /api/admin/news
//   PUT  /api/admin/news/:id
//   PATCH /api/admin/news/:id/status
// ------------------------------------------------------------

import { badRequest } from '../utils/errors.js';

/** News types — exactly the categories the existing UI used. */
export const NEWS_TYPES = Object.freeze(['NEWS', 'NOTICE', 'EVENT', 'ANNOUNCEMENT']);

/** Publishing statuses. Public API serves PUBLISHED only. */
export const NEWS_STATUSES = Object.freeze(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

const TITLE_MAX = 200;
const EXCERPT_MAX = 500;
const CONTENT_MAX = 20000;

const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;
/** Site-relative public asset (existing /Activity/…, /api/uploads/…, etc.). */
const ASSET_PATH_RE = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/ ]+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Title: non-empty bounded string. */
export function validateTitle(value, label = 'title') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest(`${label} must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > TITLE_MAX) throw badRequest(`${label} must be at most ${TITLE_MAX} characters`);
  return trimmed;
}

/**
 * Slug: lowercase letters/numbers separated by single hyphens.
 * Empty/undefined → derived from the title by the service.
 */
export function validateSlug(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !SLUG_RE.test(value) || value.length > 200) {
    throw badRequest('slug must be lowercase letters/numbers separated by single hyphens (max 200 characters)');
  }
  return value;
}

/** Type must be one of the known news types. */
export function validateType(value) {
  if (!NEWS_TYPES.includes(value)) {
    throw badRequest(`type must be one of: ${NEWS_TYPES.join(', ')}`);
  }
  return value;
}

/** Status must be one of the known statuses. */
export function validateStatus(value) {
  if (!NEWS_STATUSES.includes(value)) {
    throw badRequest(`status must be one of: ${NEWS_STATUSES.join(', ')}`);
  }
  return value;
}

/** Optional bounded text (excerpt/content): null/'' → null. */
export function validateOptionalText(value, label, max) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest(`${label} must be a string or null`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`${label} must be at most ${max} characters`);
  return trimmed === '' ? null : trimmed;
}

/**
 * Image: nullable public path or http(s) URL — the existing
 * project-wide asset convention (site-relative paths like
 * /Activity/… and /api/uploads/… stay compatible). No new media
 * system in Phase E (documented decision).
 */
export function validateImage(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest('image must be a string or null');
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > 500) throw badRequest('image must be at most 500 characters');
  if (!HTTP_URL_RE.test(trimmed) && !ASSET_PATH_RE.test(trimmed)) {
    throw badRequest('image must be a site-relative path starting with "/" or an http(s) URL');
  }
  return trimmed;
}

/**
 * Validate + normalize a create/update payload:
 *   { title, slug?, type, excerpt?, content?, image?, status? }
 * Returns only provided fields unless required (POST).
 */
export function validateNewsPayload(input, { partial = false } = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const ALLOWED = ['title', 'slug', 'type', 'excerpt', 'content', 'image', 'status'];
  const unknown = Object.keys(input).filter((k) => !ALLOWED.includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }

  const clean = {};

  if (input.title !== undefined || !partial) {
    clean.title = validateTitle(input.title, 'title');
  }
  if (input.slug !== undefined) {
    const slug = validateSlug(input.slug);
    if (slug !== undefined) clean.slug = slug;
  }
  if (input.type !== undefined || !partial) {
    clean.type = validateType(input.type);
  }
  for (const field of ['excerpt', 'content', 'image']) {
    if (input[field] !== undefined) {
      clean[field] = field === 'image'
        ? validateImage(input[field])
        : validateOptionalText(input[field], field, field === 'excerpt' ? EXCERPT_MAX : CONTENT_MAX);
    }
  }
  if (input.status !== undefined) {
    clean.status = validateStatus(input.status);
  } else if (!partial) {
    clean.status = 'DRAFT';
  }

  return clean;
}

/**
 * Validate a status-transition payload { status } (PATCH).
 * Transitioning to PUBLISHED with no prior publish date stamps
 * published_at server-side (UTC) — client timestamps are ignored.
 */
export function validateStatusPayload(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const unknown = Object.keys(input).filter((k) => !['status'].includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }
  return { status: validateStatus(input.status) };
}
