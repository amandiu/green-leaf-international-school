// ------------------------------------------------------------
// Content block input validation (Phase D)
//
// Pure format/shape validation — no database access. Each block
// type has ONE explicit schema; unknown fields are rejected
// (never silently accepted), matching the Phase A/B validation
// style.
//
//   PUT    /api/admin/content/blocks/:key
//   POST   /api/admin/content/blocks
//   DELETE /api/admin/content/blocks/:key
//
// Tokens: sanctioned {{settings}} tokens keep following Site
// Settings at render time — settings values must NEVER be copied
// into a block. Sanctioned token set (resolved by the client
// resolver, homeContentResolver.settingsTokens):
//   identity.name, identity.shortName, social.youtube,
//   contact.admissionsEmail, contact.phone, location.address
// ------------------------------------------------------------

import { badRequest } from '../utils/errors.js';

/** Block types with a validated schema (Phase D: CTA only). */
export const BLOCK_TYPES = Object.freeze(['CTA']);

const TITLE_MAX = 200;
const STRING_MAX = 500;
const DESCRIPTION_MAX = 1000;
const LABEL_MAX = 100;
const ACTIONS_MAX = 6;

/** Known stable CTA action ids (renderers select by id). */
export const CTA_ACTION_IDS = Object.freeze([
  'info', 'contact-page', 'email', 'call',
]);

const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;
const INTERNAL_LINK_RE = /^\/[A-Za-z0-9\-._~/]*$/;

/** A CTA action href: internal path, mailto:, tel:, http(s) URL or a {{token}}. */
function actionHref(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest(`${label} must be a non-empty string`);
  }
  const str = value.trim();
  if (str.length > STRING_MAX) {
    throw badRequest(`${label} must be at most ${STRING_MAX} characters`);
  }
  const TOKEN_HREF_RE = /^\{\{(contact\.admissionsEmail|contact\.phone)\}\}$/;
  const MAILTO_RE = /^mailto:(\{\{contact\.admissionsEmail\}\}|[^\s@]+@[^\s@]+\.[^\s@]+)$/;
  const TEL_RE = /^tel:(\{\{contact\.phone\}\}|[0-9+()\-.\s]{5,20})$/;
  const valid =
    TOKEN_HREF_RE.test(str) ||
    MAILTO_RE.test(str) ||
    TEL_RE.test(str) ||
    INTERNAL_LINK_RE.test(str) ||
    HTTP_URL_RE.test(str);
  if (!valid) {
    throw badRequest(
      `${label} must be an internal path ("/admissions"), a mailto:/tel: address or token, or an http(s) URL`,
    );
  }
  return str;
}

/**
 * Validate + normalize a CTA block content object.
 * Shape: { eyebrow, title, description, actions: [{ id, label, href }] }
 * Action ids must be unique and from the known id list (renderers
 * select actions by stable id — arbitrary ids would break that).
 */
export function validateCtaContent(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('CTA content must be a JSON object');
  }
  const ALLOWED = ['eyebrow', 'title', 'description', 'actions'];
  const unknown = Object.keys(input).filter((k) => !ALLOWED.includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }

  const clean = {
    eyebrow: typeof input.eyebrow === 'string' ? input.eyebrow.trim().slice(0, 100) : '',
    title: (typeof input.title === 'string' && input.title.trim())
      ? input.title.trim()
      : (() => { throw badRequest('CTA title must be a non-empty string'); })(),
    description: typeof input.description === 'string' ? input.description.trim() : '',
  };
  if (clean.title.length > TITLE_MAX) throw badRequest(`CTA title must be at most ${TITLE_MAX} characters`);
  if (clean.eyebrow.length > 100) throw badRequest('CTA eyebrow must be at most 100 characters');
  if (clean.description.length > DESCRIPTION_MAX) {
    throw badRequest(`CTA description must be at most ${DESCRIPTION_MAX} characters`);
  }

  if (!Array.isArray(input.actions) || input.actions.length === 0) {
    throw badRequest('CTA actions must be a non-empty array');
  }
  if (input.actions.length > ACTIONS_MAX) {
    throw badRequest(`CTA actions must contain at most ${ACTIONS_MAX} items`);
  }

  const seenIds = new Set();
  clean.actions = input.actions.map((action, i) => {
    if (typeof action !== 'object' || action === null || Array.isArray(action)) {
      throw badRequest(`actions[${i}] must be an object`);
    }
    const actionFields = ['id', 'label', 'href'];
    const actionUnknown = Object.keys(action).filter((k) => !actionFields.includes(k));
    if (actionUnknown.length > 0) {
      throw badRequest(`Unknown field "actions[${i}].${actionUnknown[0]}"`);
    }
    const id = (typeof action.id === 'string' && action.id.trim()) ? action.id.trim() : null;
    if (!id || !CTA_ACTION_IDS.includes(id)) {
      throw badRequest(`actions[${i}].id must be one of: ${CTA_ACTION_IDS.join(', ')}`);
    }
    if (seenIds.has(id)) {
      throw badRequest(`Duplicate action id "${id}"`);
    }
    seenIds.add(id);
    const label = (typeof action.label === 'string' && action.label.trim())
      ? action.label.trim()
      : (() => { throw badRequest(`actions[${i}].label must be a non-empty string`); })();
    if (label.length > LABEL_MAX) {
      throw badRequest(`actions[${i}].label must be at most ${LABEL_MAX} characters`);
    }
    return { id, label, href: actionHref(action.href ?? '', `actions[${i}].href`) };
  });

  return clean;
}

/** Validate + normalize one block payload { name, content }. */
export function validateBlockPayload(input, { partial = false } = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const ALLOWED = ['name', 'content'];
  const unknown = Object.keys(input).filter((k) => !ALLOWED.includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }
  const clean = {};
  if (input.name !== undefined || !partial) {
    const name = (typeof input.name === 'string' && input.name.trim())
      ? input.name.trim()
      : (() => { throw badRequest('name must be a non-empty string'); })();
    if (name.length > 150) throw badRequest('name must be at most 150 characters');
    clean.name = name;
  }
  if (input.content !== undefined || !partial) {
    clean.content = validateCtaContent(input.content ?? null);
  }
  return clean;
}

/** Stable block_key format: lowercase words separated by hyphens. */
const BLOCK_KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Validate a client-supplied block key (create only). */
export function validateBlockKey(key) {
  if (typeof key !== 'string' || !BLOCK_KEY_RE.test(key) || key.length > 100) {
    throw badRequest(
      'block_key must be lowercase letters/numbers separated by hyphens (max 100 characters)',
    );
  }
  return key;
}
