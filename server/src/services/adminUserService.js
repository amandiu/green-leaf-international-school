// ------------------------------------------------------------
// Admin user management service (Phase C.6)
//
// Orchestration over the EXISTING canonical identity seams —
// nothing here duplicates C2/C5 logic:
//   - listing            → User.listSafeUsersWithRoles (safe
//                          projection; no credential fields)
//   - creation           → identityService.createUser (bcrypt-12,
//                          email normalization, transaction, 409)
//   - role assignment    → identityService.assignRole (makePrimary
//                          swap transaction; C2 primary contract)
//   - lifecycle          → User.setActive (is_active ONLY — §AN.10)
//   - reset issuance     → passwordResetService.createResetToken
//                          (C5 primitive: hash-only, 60-min,
//                          one-live-token-per-user)
//
// Authorization (§AN.17 C6 row: "admin-only"; C7 NOT implemented):
// every operation re-resolves the CALLER's LIVE state — canonical
// users row (is_active) + role codes from user_roles/roles — and
// requires the seeded `admin` role code (fail-closed 403). This is
// deliberately the SAME boundary the C4 login enforces at issuance,
// re-checked per operation so stale session claims (role changed,
// identity deactivated after login) cannot authorize admin work.
// This is NOT requireRole/requirePermission: no permission keys,
// no role_permissions reads, no 403 framework — C7 owns that.
//
// SECURITY: no credential field ever leaves the models; raw reset
// tokens are returned to the admin caller exactly once and never
// logged; admin_users is never read or written here.
// ------------------------------------------------------------

import * as userModel from '../models/User.js';
import { findRoleCodesByUserId } from '../models/UserRole.js';
import { parseUserId } from './ownershipScoping.js';
import { createUser, assignRole } from './identityService.js';
import { createResetToken } from './passwordResetService.js';
import { validateOptionalName, validateEmail, ROLE_CODES } from '../validators/identityValidation.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';

/** Generic admin-boundary error — no detail about which check failed. */
const ADMIN_REQUIRED = 'Administrator access is required.';

/**
 * LIVE per-operation authorization (§AN.17 C6: "admin-only").
 * Resolves the caller's CURRENT canonical identity + roles rather
 * than trusting the session's login-time claims. Fail-closed:
 * unknown id, deactivated identity or missing `admin` role → 403.
 */
async function requireAdminIdentity(sessionUserId) {
  const id = parseUserId(sessionUserId);
  if (id === null) throw forbidden(ADMIN_REQUIRED);
  const identity = await userModel.findSafeById(id);
  if (!identity || identity.is_active !== true) throw forbidden(ADMIN_REQUIRED);
  const roleCodes = await findRoleCodesByUserId(id);
  if (!roleCodes.includes('admin')) throw forbidden(ADMIN_REQUIRED);
  return identity;
}

/** Validate the create payload against the approved C6 operation. */
function normalizeCreateInput(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const ALLOWED = ['email', 'name', 'roles', 'primaryRole', 'password'];
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
    return r;
  });
  let primaryRole = roles[0];
  if (input.primaryRole !== undefined) {
    if (typeof input.primaryRole !== 'string') {
      throw badRequest('primaryRole must be a role code string');
    }
    primaryRole = input.primaryRole;
  }
  if (typeof input.password !== 'string' || input.password.length < 8) {
    throw badRequest('Password must be at least 8 characters');
  }
  if (input.password.length > 200) {
    throw badRequest('Password must be at most 200 characters');
  }
  return { email, name, roles, primaryRole, password: input.password };
}

/** Validate a /:id path/body id as a canonical user id. */
function parseCanonicalId(rawId) {
  const id = parseUserId(rawId);
  if (id === null) throw badRequest('Invalid user id');
  return id;
}

/**
 * List every canonical identity with resolved roles (primary
 * first). Inactive users are INCLUDED — §AN.10 makes is_active the
 * lifecycle; hiding inactive rows would blind the admin to the
 * accounts it must be able to re-activate.
 */
export async function listUsers(sessionUserId) {
  await requireAdminIdentity(sessionUserId);
  const users = await userModel.listSafeUsersWithRoles();
  return { users, total: users.length };
}

/**
 * Create a canonical identity (+ roles) through the C2 service.
 * Returns the safe projection — never credential material.
 */
export async function adminCreateUser(sessionUserId, input) {
  await requireAdminIdentity(sessionUserId);
  const clean = normalizeCreateInput(input);
  const user = await createUser(
    { email: clean.email, name: clean.name, roles: clean.roles, primaryRole: clean.primaryRole },
    { password: clean.password },
  );
  return { user };
}

/**
 * Set the is_active lifecycle state. Sessions of a deactivated
 * identity die at the /me re-read (established behavior) and are
 * denied by the live checks above — no session-store work is
 * needed or invented here.
 */
export async function setUserActive(sessionUserId, userId, isActive) {
  await requireAdminIdentity(sessionUserId);
  const id = parseCanonicalId(userId);
  const affected = await userModel.setActive(id, isActive);
  if (affected === 0) throw notFound('User not found');
  return { ok: true };
}

/**
 * Assign a role through the C2 service (makePrimary swap when
 * requested). Duplicate assignment → the C2 409.
 */
export async function adminAssignRole(sessionUserId, userId, input) {
  await requireAdminIdentity(sessionUserId);
  const id = parseCanonicalId(userId);
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const ALLOWED = ['role', 'makePrimary'];
  const unknown = Object.keys(input).filter((k) => !ALLOWED.includes(k));
  if (unknown.length > 0) throw badRequest(`Unknown field "${unknown[0]}"`);
  if (typeof input.role !== 'string') throw badRequest('role is required');
  if (!ROLE_CODES.includes(input.role)) {
    throw badRequest(`role must be one of: ${ROLE_CODES.join(', ')}`);
  }
  if (input.makePrimary !== undefined && typeof input.makePrimary !== 'boolean') {
    throw badRequest('makePrimary must be a boolean');
  }
  const user = await assignRole(id, input.role, { makePrimary: input.makePrimary === true });
  return { user };
}

/**
 * ADMIN-ISSUED RESET (the C5 §AN.8 completion): issue a one-time
 * 60-minute reset token through the EXACT C5 primitive. The raw
 * token is returned to the authenticated admin exactly once (the
 * admin hands it to the user out-of-band until email exists).
 * Unknown/inactive identity → generic 404 (fail-closed; the admin
 * UI can always confirm existence through the list endpoint, so no
 * enumeration concern applies here).
 */
export async function adminIssueResetToken(sessionUserId, userId) {
  await requireAdminIdentity(sessionUserId);
  const id = parseCanonicalId(userId);
  const safe = await userModel.findSafeById(id);
  if (!safe || safe.is_active !== true) {
    throw notFound('User not found');
  }
  const issued = await createResetToken({ email: safe.email });
  return {
    resetToken: issued.rawToken,
    expiresInMinutes: 60,
    user: { id: safe.id, email: safe.email, name: safe.name },
  };
}
