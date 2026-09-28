// ------------------------------------------------------------
// Identity input validation (Phase C.2 — identity foundation)
//
// Pure format/shape validation — no database access — following
// the established validator convention (unknown fields rejected,
// bounded strings, whitelists). Used by identityService only:
// C2 has NO HTTP surface (SYSTEM_DESIGN §AN.17 C2 row: "API
// impact: none new").
// ------------------------------------------------------------

import { badRequest } from '../utils/errors.js';

/** Role codes — exactly the seeded catalog (seed 006, §AN.4). */
export const ROLE_CODES = Object.freeze(['admin', 'student', 'teacher', 'guardian']);

/** Permission keys accepted by role_permissions (code whitelist, §AN.5). */
export const PERMISSION_KEYS = Object.freeze([
  'users.read',
  'users.manage',
  'content.read',
  'content.write',
  'students.read',
  'students.write',
  'teachers.read',
  'teachers.write',
  'guardians.read',
  'guardians.write',
  'attendance.read',
  'attendance.manage',
  'results.read',
  'results.manage',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate + normalize an email (trim + lowercase; format-checked). */
export function validateEmail(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest('Email is required');
  }
  const email = value.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw badRequest('Enter a valid email address');
  if (email.length > 255) throw badRequest('Email must be at most 255 characters');
  return email;
}

/** Optional display name: null/'' → null; bounded (mirrors admin_users). */
export function validateOptionalName(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest('name must be a string or null');
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > 120) throw badRequest('name must be at most 120 characters');
  return trimmed;
}

/** Role code must be in the seeded catalog. */
export function validateRoleCode(value) {
  if (!ROLE_CODES.includes(value)) {
    throw badRequest(`role must be one of: ${ROLE_CODES.join(', ')}`);
  }
  return value;
}

/** Permission key must be in the code whitelist. */
export function validatePermissionKey(value) {
  if (!PERMISSION_KEYS.includes(value)) {
    throw badRequest(`Unknown permission key "${value}"`);
  }
  return value;
}

/**
 * Validate a user-creation payload:
 *   { email, name?, roles: [code], primaryRole? }
 * Unknown fields rejected; `roles` non-empty; primaryRole must be
 * inside `roles` when provided (defaults to roles[0]).
 */
export function validateUserPayload(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const ALLOWED = ['email', 'name', 'roles', 'primaryRole'];
  const unknown = Object.keys(input).filter((k) => !ALLOWED.includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }

  const email = validateEmail(input.email);
  const name = validateOptionalName(input.name);

  if (!Array.isArray(input.roles) || input.roles.length === 0) {
    throw badRequest('roles must be a non-empty array of role codes');
  }
  const roles = input.roles.map((r) => {
    if (typeof r !== 'string') throw badRequest('each role must be a string code');
    return validateRoleCode(r);
  });
  const uniqueRoles = [...new Set(roles)];

  let primaryRole = uniqueRoles[0];
  if (input.primaryRole !== undefined) {
    if (typeof input.primaryRole !== 'string') throw badRequest('primaryRole must be a role code string');
    primaryRole = validateRoleCode(input.primaryRole);
    if (!uniqueRoles.includes(primaryRole)) {
      throw badRequest('primaryRole must be one of the assigned roles');
    }
  }

  return { email, name, roles: uniqueRoles, primaryRole };
}
