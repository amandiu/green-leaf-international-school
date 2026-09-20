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
// ------------------------------------------------------------

import bcrypt from 'bcryptjs';
import { findByEmailWithHash, findSafeById, createAdmin, emailExists, countAdmins } from '../models/AdminUser.js';
import { createSessionToken } from '../utils/sessionToken.js';
import { badRequest, unauthorized, conflict } from '../utils/errors.js';

const BCRYPT_ROUNDS = 12;

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
 */
export async function login(input) {
  const { email, password } = normalizeCredentials(input);
  const row = await findByEmailWithHash(email);

  // Timing-safe: always run one bcrypt compare, even for unknown emails.
  const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.WT8FiFbBoZgdY6bWiDgttV0nGbbQzHy';
  const hash = row?.password_hash || DUMMY_HASH;
  const passwordOk = await bcrypt.compare(password, hash);

  if (!row || !passwordOk || row.is_active !== 1) {
    throw unauthorized(GENERIC_CREDENTIALS);
  }

  const user = {
    id: row.id,
    email: row.email,
    name: row.name,
  };
  return { user, token: createSessionToken(user) };
}

/** Current admin profile (safe columns) for /api/auth/me. */
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate + create an admin account from the setup script. */
export async function createAdminAccount({ email, password, name }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) {
    throw badRequest('Enter a valid email address');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw badRequest('Password must be at least 8 characters');
  }
  const cleanName = String(name || '').trim() || null;

  if (await emailExists(cleanEmail)) {
    throw conflict('An admin account with this email already exists');
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return createAdmin({ email: cleanEmail, password_hash, name: cleanName });
}

/** How many admins exist (setup script decision hint). */
export async function adminCount() {
  return countAdmins();
}
