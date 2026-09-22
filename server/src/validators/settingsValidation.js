// ------------------------------------------------------------
// Site settings input validation (Phase A + Phase C)
//
// Pure format/shape validation — no database access. Defines the
// ALLOWED setting groups/keys (anything unknown is rejected, not
// silently accepted) and per-field rules shared by:
//   - PUT /api/admin/settings   (full/partial group payloads)
//   - the seed source of truth (siteConfig.js structure)
//
// Phase C single-source-of-truth rule: the school address is
// `location.address` ONLY. The old `contact.address` duplicate is
// retired — writes are rejected (400) and consumers read the
// central location value.
// ------------------------------------------------------------

import { badRequest } from '../utils/errors.js';

/** Human-readable group labels for error messages. */
export const SETTING_GROUPS = Object.freeze({
  identity: [
    'name', 'shortName', 'subName', 'tagline', 'description', 'monogram',
  ],
  branding: ['logo', 'favicon', 'ogImage'],
  // Phase C: 'address' removed — location.address is the ONLY
  // editable school address (single source of truth).
  contact: [
    'email', 'phone', 'admissionsEmail',
    'officeHours', 'officeHoursClosed',
  ],
  social: ['facebook', 'youtube', 'instagram', 'linkedin'],
  location: ['address', 'mapsQuery', 'mapsZoom'],
  seo: ['title', 'description'],
});

const STRING_MAX = 500;        // reasonable ceiling for any single setting
const DESCRIPTION_MAX = 1000;  // identity.description / seo.description
const MONOGRAM_MAX = 3;        // siteConfig keeps it 1–2 characters
const MAPS_ZOOM_MIN = 1;
const MAPS_ZOOM_MAX = 22;      // Google Maps supported zoom range
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;

/** A path/URL for logo/favicon/ogImage: site-relative path or absolute http(s) URL. */
const ASSET_RE = /^(\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/]+|https?:\/\/[^\s]+)$/i;

/**
 * String setting: trims, enforces max length. Empty string is
 * NOT allowed here (nullable fields handle their own emptiness).
 */
function requireNonEmptyString(value, label, max = STRING_MAX) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest(`${label} must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw badRequest(`${label} must be at most ${max} characters`);
  }
  return trimmed;
}

/** Nullable string: null/'' → null; otherwise a trimmed bounded string. */
function optionalString(value, label, max = STRING_MAX) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest(`${label} must be a string or null`);
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw badRequest(`${label} must be at most ${max} characters`);
  }
  return trimmed === '' ? null : trimmed;
}

/** http(s) URL, optionally null (social links). */
function optionalHttpUrl(value, label) {
  const str = optionalString(value, label, STRING_MAX);
  if (str === undefined || str === null) return str;
  if (!HTTP_URL_RE.test(str)) {
    throw badRequest(`${label} must be a valid http:// or https:// URL (or null)`);
  }
  return str;
}

/** Validate one field value against its group.field rule. */
function validateField(group, field, value) {
  const label = `${group}.${field}`;

  switch (`${group}.${field}`) {
    // ---- identity (all required, non-empty) ----
    case 'identity.name':
    case 'identity.shortName':
    case 'identity.subName':
    case 'identity.tagline':
    case 'identity.description':
      return requireNonEmptyString(value, label, DESCRIPTION_MAX);
    case 'identity.monogram':
      return requireNonEmptyString(value, label, MONOGRAM_MAX);

    // ---- branding (site-relative path or http(s) URL) ----
    case 'branding.logo':
    case 'branding.favicon':
    case 'branding.ogImage': {
      const str = requireNonEmptyString(value, label, STRING_MAX);
      if (!ASSET_RE.test(str)) {
        throw badRequest(
          `${label} must be a site-relative path starting with "/" or an http(s) URL`,
        );
      }
      return str;
    }

    // ---- contact ----
    case 'contact.email':
    case 'contact.admissionsEmail': {
      const str = requireNonEmptyString(value, label, STRING_MAX);
      if (!EMAIL_RE.test(str)) {
        throw badRequest(`${label} must be a valid email address`);
      }
      return str;
    }
    case 'contact.phone':
    case 'contact.officeHours':
    case 'contact.officeHoursClosed':
      // Free-form display strings — not over-restricted.
      return requireNonEmptyString(value, label);

    // ---- social (nullable http(s) URLs) ----
    case 'social.facebook':
    case 'social.youtube':
    case 'social.instagram':
    case 'social.linkedin':
      return optionalHttpUrl(value, label);

    // ---- location ----
    case 'location.address':
    case 'location.mapsQuery':
      return optionalString(value, label);
    case 'location.mapsZoom': {
      if (value === undefined) return undefined;
      const zoom = typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : value;
      if (typeof zoom !== 'number' || !Number.isInteger(zoom)) {
        throw badRequest(`${label} must be an integer between ${MAPS_ZOOM_MIN} and ${MAPS_ZOOM_MAX}`);
      }
      if (zoom < MAPS_ZOOM_MIN || zoom > MAPS_ZOOM_MAX) {
        throw badRequest(`${label} must be between ${MAPS_ZOOM_MIN} and ${MAPS_ZOOM_MAX}`);
      }
      return zoom;
    }

    // ---- seo ----
    case 'seo.title':
      return requireNonEmptyString(value, label);
    case 'seo.description':
      return requireNonEmptyString(value, label, DESCRIPTION_MAX);

    default:
      // Unknown keys never reach here (the allow-list check below
      // runs first) — this is a defensive guard only.
      throw badRequest(`Unsupported setting "${label}"`);
  }
}

/**
 * Validate + normalize a settings payload of the shape:
 *   { identity: { name, shortName, ... }, branding: { ... }, ... }
 *
 * - Unknown GROUPS are rejected (not silently ignored).
 * - Unknown FIELDS inside a known group are rejected.
 * - Partial payloads are allowed (only provided fields are returned).
 * Returns { group: { field: cleanValue } }.
 */
export function validateSettingsPayload(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }

  const clean = {};

  for (const [group, fields] of Object.entries(input)) {
    if (!(group in SETTING_GROUPS)) {
      throw badRequest(`Unknown settings group "${group}"`);
    }
    if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
      throw badRequest(`${group} must be an object of settings`);
    }

    for (const [field, value] of Object.entries(fields)) {
      if (!SETTING_GROUPS[group].includes(field)) {
        throw badRequest(`Unknown setting "${group}.${field}"`);
      }
      const cleanValue = validateField(group, field, value);
      if (cleanValue !== undefined) {
        if (!clean[group]) clean[group] = {};
        clean[group][field] = cleanValue;
      }
    }
  }

  if (Object.keys(clean).length === 0) {
    throw badRequest('No settings to update were provided');
  }
  return clean;
}

/**
 * Flatten a grouped payload into [ { key, value, group } ] rows for
 * the model's upsertMany. Numbers are stored as their string form.
 */
export function flattenSettings(grouped) {
  const rows = [];
  for (const [group, fields] of Object.entries(grouped)) {
    for (const [field, value] of Object.entries(fields)) {
      rows.push({
        key: `${group}.${field}`,
        value: value === null ? null : String(value),
        group,
      });
    }
  }
  return rows;
}
