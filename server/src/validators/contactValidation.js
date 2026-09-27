// ------------------------------------------------------------
// Contact message input validation (Phase B.1)
//
// Pure format/shape validation — no database access. Unknown
// fields are REJECTED (never silently accepted), matching the
// Phase A/B/D/E validation style.
//
//   POST  /api/contact                             (public submit)
//   PATCH /api/admin/contact-messages/:id/status   (admin)
//
// The public form fields (verified in client/src/Pages/Contact.jsx):
//   name* / email* / phone / subject* / message*
// Phone is OPTIONAL on the form — the schema matches (no forced
// field just for database completeness).
// ------------------------------------------------------------

import { badRequest } from '../utils/errors.js';

/** Inbox lifecycle (mirrors the news status-whitelist pattern). */
export const CONTACT_STATUSES = Object.freeze([
  'NEW', 'READ', 'REPLIED', 'ARCHIVED',
]);

const NAME_MAX = 120;      // matches contact_messages.name
const EMAIL_MAX = 255;     // matches contact_messages.email
const PHONE_MAX = 40;      // matches contact_messages.phone
const SUBJECT_MAX = 200;   // matches contact_messages.subject
const MESSAGE_MAX = 5000;  // validator bound; column is TEXT

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Loose phone sanity: digits/spaces/()+-. only, 7–40 chars. */
const PHONE_RE = /^[0-9()+\-\s.]{7,40}$/;

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
  if (typeof value !== 'string') throw badRequest(`${label} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw badRequest(`${label} must be at most ${max} characters`);
  }
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Validate + normalize a public submission payload:
 *   { name, email, phone?, subject, message }
 * Unknown fields are rejected; whitespace is normalized (trimmed);
 * email is lowercased for consistent storage/dedup views.
 */
export function validateContactSubmission(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const ALLOWED = ['name', 'email', 'phone', 'subject', 'message'];
  const unknown = Object.keys(input).filter((k) => !ALLOWED.includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }

  const name = requireTrimmed(input.name, 'name', NAME_MAX);
  const email = requireTrimmed(input.email, 'email', EMAIL_MAX).toLowerCase();
  if (!EMAIL_RE.test(email)) throw badRequest('Enter a valid email address');

  const phone = optionalTrimmed(input.phone, 'phone', PHONE_MAX);
  if (phone !== undefined && !PHONE_RE.test(phone)) {
    throw badRequest('Enter a valid phone number');
  }

  const subject = requireTrimmed(input.subject, 'subject', SUBJECT_MAX);
  const message = requireTrimmed(input.message, 'message', MESSAGE_MAX);

  return { name, email, phone: phone ?? null, subject, message };
}

/**
 * Validate a status-transition payload { status } (admin PATCH).
 * Unknown fields are rejected (same as news validateStatusPayload).
 */
export function validateContactStatusPayload(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const unknown = Object.keys(input).filter((k) => !['status'].includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }
  if (!CONTACT_STATUSES.includes(input.status)) {
    throw badRequest(`status must be one of: ${CONTACT_STATUSES.join(', ')}`);
  }
  return { status: input.status };
}
