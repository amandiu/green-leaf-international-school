// ------------------------------------------------------------
// Leadership message input validation
//
// Pure format/shape validation. Rules that need database access
// (unique role, id existence, image reference) live in
// leadershipService, mirroring the navigation feature split.
// ------------------------------------------------------------

import { badRequest } from '../utils/errors.js';

const ROLE_MAX = 80;      // matches VARCHAR(80)
const NAME_MAX = 120;     // matches VARCHAR(120)
const TITLE_MAX = 160;    // matches VARCHAR(160)
const MESSAGE_MAX = 5000; // well within TEXT capacity
const IMAGE_MAX = 255;    // matches VARCHAR(255)
/** Public-safe relative upload path, e.g. /api/uploads/leadership/abc123.jpg */
const IMAGE_RE = /^\/api\/uploads\/leadership\/[A-Za-z0-9._-]+$/;

/** Validate + normalize a payload; returns clean fields only. */
export function validateLeadershipInput(input, { partial = false } = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }

  const clean = {};

  // ---- role (required; any non-empty string — future-proof) ----
  if (input.role === undefined) {
    if (!partial) throw badRequest('role is required');
  } else {
    if (typeof input.role !== 'string' || input.role.trim().length === 0) {
      throw badRequest('role must be a non-empty string');
    }
    if (input.role.trim().length > ROLE_MAX) {
      throw badRequest(`role must be at most ${ROLE_MAX} characters`);
    }
    clean.role = input.role.trim();
  }

  // ---- name (optional; null = not yet verified/published) ----
  if (input.name === undefined) {
    if (!partial) clean.name = null;
  } else if (input.name === null || input.name === '') {
    clean.name = null;
  } else {
    if (typeof input.name !== 'string') {
      throw badRequest('name must be a string or null');
    }
    if (input.name.trim().length > NAME_MAX) {
      throw badRequest(`name must be at most ${NAME_MAX} characters`);
    }
    clean.name = input.name.trim();
  }

  // ---- title (optional message heading) ----
  if (input.title === undefined) {
    if (!partial) clean.title = null;
  } else if (input.title === null || input.title === '') {
    clean.title = null;
  } else {
    if (typeof input.title !== 'string') {
      throw badRequest('title must be a string or null');
    }
    if (input.title.trim().length > TITLE_MAX) {
      throw badRequest(`title must be at most ${TITLE_MAX} characters`);
    }
    clean.title = input.title.trim();
  }

  // ---- message (optional; the public cell shows a pending note when null) ----
  if (input.message === undefined) {
    if (!partial) clean.message = null;
  } else if (input.message === null || input.message === '') {
    clean.message = null;
  } else {
    if (typeof input.message !== 'string') {
      throw badRequest('message must be a string or null');
    }
    if (input.message.trim().length === 0) {
      clean.message = null;
    } else if (input.message.length > MESSAGE_MAX) {
      throw badRequest(`message must be at most ${MESSAGE_MAX} characters`);
    } else {
      clean.message = input.message;
    }
  }

  // ---- image_url (public-safe relative path only) ----
  if (input.image_url === undefined) {
    if (!partial) clean.image_url = null;
  } else if (input.image_url === null || input.image_url === '') {
    clean.image_url = null;
  } else {
    if (typeof input.image_url !== 'string' || !IMAGE_RE.test(input.image_url)) {
      throw badRequest(
        'image_url must be an upload path like /api/uploads/leadership/<file> (or null)',
      );
    }
    if (input.image_url.length > IMAGE_MAX) {
      throw badRequest(`image_url must be at most ${IMAGE_MAX} characters`);
    }
    clean.image_url = input.image_url;
  }

  // ---- sort_order ----
  if (input.sort_order === undefined) {
    if (!partial) clean.sort_order = 0;
  } else {
    if (!Number.isInteger(input.sort_order) || input.sort_order < 0) {
      throw badRequest('sort_order must be a non-negative integer');
    }
    clean.sort_order = input.sort_order;
  }

  // ---- is_active (create default: active) ----
  if (input.is_active === undefined) {
    if (!partial) clean.is_active = true;
  } else if (typeof input.is_active === 'boolean') {
    clean.is_active = input.is_active;
  } else if (input.is_active === 0 || input.is_active === 1) {
    clean.is_active = input.is_active === 1;
  } else {
    throw badRequest('is_active must be a boolean');
  }

  return clean;
}
