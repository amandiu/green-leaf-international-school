// ------------------------------------------------------------
// Navigation input validation (Phase 3.3)
//
// Pure format/shape validation. Hierarchy rules (parent exists,
// depth limits, cycles) live in navigationService because they
// need database access.
//
// Type rules:
//   INTERNAL → url required, safe internal route (/path)
//   EXTERNAL → url required, valid http(s) URL
//   DROPDOWN → url optional (internal route when provided)
// ------------------------------------------------------------

import { NAVIGATION_TYPES } from '../models/NavigationItem.js';
import { badRequest } from '../utils/errors.js';

const TITLE_MAX = 100;
const SLUG_MAX = 100;
const URL_MAX = 255;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INTERNAL_URL_RE = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/;
const EXTERNAL_URL_RE = /^https?:\/\/[^\s]+$/i;

/** Validate + normalize a navigation payload; returns clean fields. */
export function validateNavigationInput(input, { partial = false } = {}) {
  if (typeof input !== 'object' || input === null) {
    throw badRequest('Request body must be a JSON object');
  }

  const clean = {};

  // ---- title ----
  if (input.title === undefined) {
    if (!partial) throw badRequest('title is required');
  } else {
    if (typeof input.title !== 'string' || input.title.trim().length === 0) {
      throw badRequest('title must be a non-empty string');
    }
    if (input.title.trim().length > TITLE_MAX) {
      throw badRequest(`title must be at most ${TITLE_MAX} characters`);
    }
    clean.title = input.title.trim();
  }

  // ---- slug ----
  if (input.slug === undefined) {
    if (!partial) throw badRequest('slug is required');
  } else if (input.slug !== null) {
    if (typeof input.slug !== 'string' || !SLUG_RE.test(input.slug)) {
      throw badRequest(
        'slug must be lowercase letters/numbers separated by single hyphens (e.g. about-us)',
      );
    }
    if (input.slug.length > SLUG_MAX) {
      throw badRequest(`slug must be at most ${SLUG_MAX} characters`);
    }
    clean.slug = input.slug;
  } else if (!partial) {
    throw badRequest('slug is required');
  }

  // ---- type ----
  if (input.type === undefined) {
    if (!partial) throw badRequest('type is required');
  } else {
    if (typeof input.type !== 'string' || !Object.values(NAVIGATION_TYPES).includes(input.type)) {
      throw badRequest('type must be one of INTERNAL, EXTERNAL, DROPDOWN');
    }
    clean.type = input.type;
  }

  // ---- url (depends on type) ----
  if (input.url === undefined) {
    if (!partial) clean.url = null;
  } else if (input.url === null || input.url === '') {
    clean.url = null;
  } else {
    if (typeof input.url !== 'string' || input.url.length > URL_MAX) {
      throw badRequest(`url must be a string of at most ${URL_MAX} characters`);
    }
    const effectiveType = clean.type ?? input._currentType;
    if (effectiveType === 'EXTERNAL' && !EXTERNAL_URL_RE.test(input.url)) {
      throw badRequest('EXTERNAL items require a valid http:// or https:// URL');
    }
    if (effectiveType !== 'EXTERNAL' && !INTERNAL_URL_RE.test(input.url)) {
      throw badRequest('Internal URLs must be site routes starting with "/" (e.g. /about)');
    }
    clean.url = input.url;
  }

  // ---- sort_order ----
  if (input.sort_order === undefined) {
    if (!partial) throw badRequest('sort_order is required');
  } else {
    if (!Number.isInteger(input.sort_order)) {
      throw badRequest('sort_order must be an integer');
    }
    clean.sort_order = input.sort_order;
  }

  // ---- booleans (create defaults: active, same tab) ----
  for (const flag of ['is_active', 'open_new_tab']) {
    if (input[flag] === undefined) {
      if (!partial) {
        clean[flag] = flag === 'is_active'; // true / false
      }
    } else if (typeof input[flag] === 'boolean') {
      clean[flag] = input[flag];
    } else if (input[flag] === 0 || input[flag] === 1) {
      clean[flag] = input[flag] === 1;
    } else {
      throw badRequest(`${flag} must be a boolean`);
    }
  }

  // ---- parent_id ----
  if (input.parent_id === undefined) {
    if (!partial) clean.parent_id = null;
  } else if (input.parent_id === null || input.parent_id === '') {
    clean.parent_id = null;
  } else if (Number.isInteger(input.parent_id) && input.parent_id > 0) {
    clean.parent_id = input.parent_id;
  } else {
    throw badRequest('parent_id must be null or a positive integer');
  }

  // ---- icon ----
  if (input.icon === undefined) {
    if (!partial) clean.icon = null;
  } else if (input.icon === null || input.icon === '') {
    clean.icon = null;
  } else if (typeof input.icon === 'string' && input.icon.length <= 64) {
    clean.icon = input.icon;
  } else {
    throw badRequest('icon must be a string of at most 64 characters');
  }

  return clean;
}
