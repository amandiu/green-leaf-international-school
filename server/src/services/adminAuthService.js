// ------------------------------------------------------------
// Admin authentication service
//
// Business rules (NOT in the controller):
//   - email is lowercased/trimmed before lookup
//   - login is allowed ONLY for is_active accounts
//   - bcrypt.compare ALWAYS runs (dummy hash when the email is
//     unknown) so response timing does not reveal which part failed
//   - one generic error message for unknown email / wrong password
//   - password hashes never leave this module
//
// Phase C.4 (§AN.14): the authentication source is the CANONICAL
// `users` table (sub = users.id). admin_users remains as a legacy
// read-only reference (kept, never dropped) — it is no longer read
// by the login path. The admin login endpoint still only issues a
// session to identities holding the seeded `admin` role (a
// login-service boundary check, NOT requireRole/C7 middleware).
// ------------------------------------------------------------

import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { findByEmailWithHash, findSafeById } from '../models/User.js';
import { findRoleCodesByUserId } from '../models/UserRole.js';
import { createUser } from './identityService.js';
import { createSessionToken } from '../utils/sessionToken.js';
import { badRequest, unauthorized } from '../utils/errors.js';


/** Generic credential error — never reveals which part was wrong. */
const GENERIC_CREDENTIALS = 'Invalid email or password.';

/** Normalize + validate the login payload shape. */
function normalizeCredentials(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (!email) throw badRequest('Email is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Enter a valid email address');
  if (!password) throw badRequest('Password is required');
  return { email, password };
}

/**
 * Verify credentials and return { user, token } on success.
 * Throws a generic 401 on any credential mismatch.
 *
 * Phase C.4 cutover (§AN.14): the lookup source is the canonical
 * `users` table; the session subject is the canonical users.id.
 * The session is issued only to identities whose resolved role
 * codes include `admin` — a non-admin canonical identity must not
 * obtain an admin session through this endpoint (no enumeration:
 * every failure below returns the SAME generic 401).
 */
export async function login(input) {
  const { email, password } = normalizeCredentials(input);
  const row = await findByEmailWithHash(email);

  // Timing-safe: always run one bcrypt compare, even for unknown emails.
  const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.WT8FiFbBoZgdY6bWiDgttV0nGbbQzHy';
  const hash = row?.password_hash || DUMMY_HASH;
  const passwordOk = await bcrypt.compare(password, hash);

  // Canonical role resolution — only reached when the row exists.
  let roleCodes = [];
  if (row) {
    roleCodes = await findRoleCodesByUserId(row.id);
  }

  if (
    !row
    || !passwordOk
    || Number(row.is_active) !== 1
    || !roleCodes.includes('admin')
  ) {
    throw unauthorized(GENERIC_CREDENTIALS);
  }

  const user = {
    id: row.id,
    email: row.email,
    name: row.name,
    roles: roleCodes,
    pwdAt: row.password_changed_at ? new Date(row.password_changed_at).getTime() : null,
  };
  return { user, token: createSessionToken(user) };
}

/**
 * Current admin profile (safe columns) for /api/auth/me.
 *
 * Phase C.4: resolves through the CANONICAL users table (the token
 * `sub` is users.id). Re-reads the live row so deactivation or
 * deletion takes effect immediately.
 */
export async function getAdminProfile(userId) {
  const user = await findSafeById(userId);
  if (!user || user.is_active !== true) {
    // Account deleted/deactivated after the token was issued.
    throw unauthorized('Session is no longer valid.');
  }
  return user;
}

// ------------------------------------------------------------
// One-time setup script support (npm run admin:create)
// ------------------------------------------------------------

/**
 * Create an admin account from the setup script.
 *
 * Phase C.4 (§AN.14): creation is CANONICAL — the account is a
 * users row (+ exactly-one primary `admin` role) so it can log in
 * against the cutover authentication source. The C2 identity
 * service performs the validation/transaction (bcrypt-12, email
 * normalization, duplicate 409). A pre-cutover admin_users row
 * with the same email makes the copy gate report a CONFLICT (the
 * duplicate is audited, never silently merged) — create the
 * legacy account first, then re-run the copy before login.
 */
export async function createAdminAccount({ email, password, name }) {
  return createUser(
    { email, name, roles: ['admin'], primaryRole: 'admin' },
    { password },
  );
}

/**
 * How many admins exist (setup script decision hint).
 * Phase C.4: the CANONICAL admin count — post-cutover the login
 * source is users, so the bootstrap hint must reflect canonical
 * identities (a legacy-only count would mislead a fresh setup).
 */
export async function adminCount() {
  const [rows] = await pool.query(
    'SELECT COUNT(DISTINCT `ur`.`user_id`) AS n FROM `user_roles` `ur`'
      + ' JOIN `roles` `r` ON `r`.`id` = `ur`.`role_id` WHERE `r`.`code` = ?',
    ['admin'],
  );
  return rows[0].n;
}
