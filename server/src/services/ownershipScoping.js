// ------------------------------------------------------------
// Ownership-scoping helpers (Phase C.3 — linking seams)
//
// Implements the APPROVED §AN.6 ownership/data-scoping contract
// (SYSTEM_DESIGN) as deterministic, fail-closed primitives that
// later Phase C items (C4 cutover consumers, C8 ownership-scoped
// API foundation) and the F/G/H profile phases consume.
//
// SEPARATION OF CONCERNS (the C3 boundary):
//   identity        users.id is the CANONICAL identity reference
//                   (§AN.3). Profile tables link by `user_id`
//                   (students/teachers/guardians — Phase F/G/H,
//                   tables do not exist yet). Nothing else (email,
//                   session subject, admin_users.id) is an
//                   ownership key.
//   authentication  NOT here. This module never touches cookies,
//                   tokens or sessions; the session identity is
//                   resolved by middleware (attachSessionUser)
//                   and passed IN as a plain canonical id.
//   authorization   NOT here. No role/permission logic — coarse
//                   gates (requireRole/requirePermission) arrive
//                   with C7. Callers that are permitted to widen
//                   scope (permission-scoped admins) check that
//                   BEFORE calling these helpers; the helpers
//                   themselves always narrow to the given owner.
//   ownership       THIS module: pure, deterministic narrowing
//                   ("which rows may this identity touch?") with
//                   fail-closed semantics — missing or ambiguous
//                   ownership information NEVER broadens access.
//
// DENIAL CONVENTION: helpers return `null` on denial instead of
// throwing; the caller maps null to the established generic 404
// (no record-existence disclosure, §AN.6/§AN.11 — 403 is a C7
// concern and is intentionally NOT used here).
//
// SQL SAFETY: the only SQL emitted is the tiny fragment builder;
// the column identifier is strictly whitelist-validated and the
// value is always a bound parameter — never interpolated.
// Credentials never pass through this module: user resolution
// reuses the C2 safe projection (password_hash never leaves the
// model layer).
// ------------------------------------------------------------

import pool from '../config/db.js';
import * as userModel from '../models/User.js';
import { badRequest, notFound } from '../utils/errors.js';

/** Maximum value of an UNSIGNED INT column (canonical users.id domain). */
const MAX_UNSIGNED_INT = 4294967295;

/**
 * The canonical owner-link column for profile/ownership tables
 * (§AN.6: users.id → students.user_id / teachers.user_id / …).
 * Kept as a named convention so future migrations/services reuse
 * one spelling.
 */
export const USER_LINK_COLUMN = 'user_id';

/**
 * Parse a candidate canonical user id (client body/URL param,
 * session subject, DB cell) into a canonical integer id.
 * Returns null for anything that is not a positive integer within
 * the UNSIGNED INT domain — never throws. Parsed ≠ trusted: a
 * parsed client-supplied id is only ever used as an equality
 * candidate against the session identity (see resolveOwnerScope),
 * never as a scope on its own.
 */
export function parseUserId(raw) {
  let value = raw;
  if (typeof value === 'string') {
    if (!/^\d+$/.test(value)) return null; // strict digits; no trim/sign/floats
    value = Number(value);
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 1 || value > MAX_UNSIGNED_INT) return null;
  return value;
}

/**
 * Require a canonical user id: like parseUserId but throws the
 * established 400 for malformed input (service-boundary form
 * checks). A syntactically valid id is NOT verified against the
 * users table here — use requireExistingUser for that.
 */
export function requireUserId(raw) {
  const id = parseUserId(raw);
  if (id === null) {
    throw badRequest('Invalid user id');
  }
  return id;
}

/**
 * Resolve a canonical user id to an EXISTING, ACTIVE user using
 * the C2 safe projection. Fails closed: missing or deactivated
 * account → generic 404 (an ownership scope must never resolve
 * through an inactive identity). The returned row never contains
 * credential material.
 */
export async function requireExistingUser(userId) {
  const id = requireUserId(userId);
  const user = await userModel.findSafeById(id);
  if (!user || user.is_active !== true) {
    throw notFound('User not found');
  }
  return user;
}

/**
 * Resolve the ownership scope for a request (§AN.6 — the portal
 * contract): the resource owner is ALWAYS the session identity;
 * a client-supplied requestedUserId can only CONFIRM it, never
 * widen it.
 *
 *   resolveOwnerScope({ sessionUserId })                    → { userId: session }
 *   resolveOwnerScope({ sessionUserId, requestedUserId })   → { userId } when
 *                                                             canonically EQUAL to
 *                                                             the session identity
 *   anything else (mismatch, invalid, missing session id)   → null (deny)
 *
 * Returns null (caller → generic 404) whenever ownership cannot
 * be established — absence of information never means
 * "unrestricted".
 */
export function resolveOwnerScope({ sessionUserId, requestedUserId } = {}) {
  const session = parseUserId(sessionUserId);
  if (session === null) return null; // no authenticated identity → no scope

  // No requested id → narrowest possible scope: the caller's own.
  if (requestedUserId === undefined || requestedUserId === null) {
    return { userId: session };
  }

  // A requested id must be a well-formed canonical id AND equal
  // to the session identity to be honored at all.
  const requested = parseUserId(requestedUserId);
  if (requested === null || requested !== session) return null;

  return { userId: requested };
}

/**
 * Ownership double-check for a fetched row (§AN.6: services scope
 * every model call; this verifies the RETURNED row really belongs
 * to the session identity before it is used — the second half of
 * the IDOR contract).
 *
 *   row owned by sessionUserId            → the row
 *   row missing, mismatched owner, or
 *   WITHOUT ownership information         → null (fail-closed: a
 *   (row[ownerKey] undefined/null)          row that cannot prove
 *                                           ownership is never
 *                                           treated as owned)
 */
export function assertOwnedRow(row, sessionUserId, { ownerKey = USER_LINK_COLUMN } = {}) {
  if (!row || typeof row !== 'object') return null;
  const session = parseUserId(sessionUserId);
  if (session === null) return null;
  const owner = parseUserId(row[ownerKey]);
  if (owner === null || owner !== session) return null;
  return row;
}

/**
 * Parameterized WHERE fragment scoping a query to rows owned by
 * `userId` (§AN.6: models embed the scoped id in WHERE — never a
 * raw client id). Compose with the caller's existing WHERE clause:
 *
 *   const scope = ownedBy(sessionUserId);
 *   // "... WHERE `is_active` = 1 " + scope.fragment
 *   pool.query(`${base}${scope.fragment}`, [...baseParams, ...scope.params])
 *
 * Column must be a plain SQL identifier ([a-z_][a-z0-9_]*); any
 * other value throws 400 BEFORE any query runs (fail-closed — no
 * injection surface through the identifier).
 */
export function ownedBy(userId, { column = USER_LINK_COLUMN } = {}) {
  if (typeof column !== 'string' || !/^[a-z_][a-z0-9_]*$/i.test(column)) {
    throw badRequest('Invalid ownership column');
  }
  const id = requireUserId(userId);
  return {
    fragment: ` AND \`${column}\` = ?`,
    params: [id],
  };
}

/**
 * Live rows for one canonical user id (read-only diagnostics /
 * future C8 tests). Safe projection only; returns [] for an id
 * with no assignments.
 */
export async function listUserRoleCodes(userId) {
  const id = requireUserId(userId);
  const [rows] = await pool.query(
    'SELECT `r`.`code` FROM `user_roles` `ur` JOIN `roles` `r` ON `r`.`id` = `ur`.`role_id`'
      + ' WHERE `ur`.`user_id` = ? ORDER BY `ur`.`is_primary` DESC, `ur`.`id` ASC',
    [id],
  );
  return rows.map((r) => r.code);
}
