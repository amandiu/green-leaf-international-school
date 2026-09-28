// ------------------------------------------------------------
// User model — data access for users (Phase C.2 identity)
//
// All SQL lives here. Password hashing/verification lives in the
// service (established convention — see adminAuthService).
//
// SECURITY: password_hash is fetched ONLY by the *WithHash
// functions and must never be projected into safe payloads.
// Phase C.4 (§AN.14): this table IS the authentication source —
// the login path and session middleware read it (canonical
// users.id as the session subject).
// ------------------------------------------------------------

import pool from '../config/db.js';
import { parseUserId } from '../services/ownershipScoping.js';

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = [
  'id', 'email', 'password_hash', 'name', 'is_active',
  'password_changed_at', 'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

/** Safe projection — password_hash must NEVER leave the model.
 *  Phase C.4: password_changed_at is ALSO excluded — it is session
 *  metadata consumed internally (findLivePwdAt + the pwdAt claim),
 *  never profile data, so /api/auth/me keeps the exact pre-cutover
 *  response shape. */
const SAFE_COLUMNS = [
  'id', 'email', 'name', 'is_active', 'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

function toJs(row) {
  if (!row) return null;
  return { ...row, is_active: row.is_active === 1 };
}

/** Create a user. Password hash is computed by the CALLER (service). */
export async function insert({ email, password_hash, name = null, is_active = true }) {
  const [result] = await pool.query(
    'INSERT INTO `users` (`email`, `password_hash`, `name`, `is_active`) VALUES (?, ?, ?, ?)',
    [email, password_hash, name, is_active ? 1 : 0],
  );
  return result.insertId;
}

/** Login-pattern fetch (includes password_hash) — cutover use only. */
export async function findByEmailWithHash(email) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`users\` WHERE \`email\` = ? LIMIT 1`,
    [email],
  );
  return rows[0] || null;
}

/** Safe profile by id (no password_hash). */
export async function findSafeById(id) {
  const [rows] = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM \`users\` WHERE \`id\` = ? LIMIT 1`,
    [id],
  );
  return toJs(rows[0]);
}

/** Safe profile by exact email (no password_hash). */
export async function findSafeByEmail(email) {
  const [rows] = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM \`users\` WHERE \`email\` = ? LIMIT 1`,
    [email],
  );
  return toJs(rows[0]);
}

/** True when the email is registered (duplicate guard). */
export async function emailExists(email) {
  const [rows] = await pool.query(
    'SELECT `id` FROM `users` WHERE `email` = ? LIMIT 1',
    [email],
  );
  return rows.length > 0;
}

/** Count all users (verify / diagnostics). */
export async function countUsers() {
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM `users`');
  return rows[0].n;
}

/**
 * LIVE password_changed_at state for one canonical id, as three
 * distinguishable values (Phase C.4, §AN.7):
 *   undefined → the user row does NOT exist (unknown id; caller
 *               must fail closed — no identity can be confirmed)
 *   null      → row exists, never stamped (user never changed its
 *               password — a VALID state that matches a token
 *               pwdAt of null; §AN.13: copied admin rows are
 *               stamped at the copy, so cutover admin sessions
 *               carry a real epoch value)
 *   number    → epoch ms of the live stamp (compared for equality
 *               against the token's pwdAt claim)
 */
export async function findLivePwdAt(id) {
  if (parseUserId(id) === null) return undefined;
  const [rows] = await pool.query(
    'SELECT `password_changed_at` FROM `users` WHERE `id` = ? LIMIT 1',
    [id],
  );
  if (rows.length === 0) return undefined;
  const value = rows[0].password_changed_at;
  return value ? new Date(value).getTime() : null;
}
export async function markPasswordChanged(id, { password_hash = null } = {}) {
  const [result] = await pool.query(
    'UPDATE `users` SET `password_changed_at` = UTC_TIMESTAMP(3)'
      + (password_hash ? ', `password_hash` = ?' : '')
      + ' WHERE `id` = ?',
    password_hash ? [password_hash, id] : [id],
  );
  return result.affectedRows;
}

/**
 * Set a new bcrypt hash + stamp password_changed_at atomically
 * (one statement). Phase C.4 seam: the C5 password-change flow
 * calls this; the pwdAt comparison in attachSessionUser then
 * invalidates every previously issued session (§AN.7).
 * Returns affected rows (0 = unknown id).
 */
export async function updatePasswordHash(id, password_hash) {
  const [result] = await pool.query(
    'UPDATE `users` SET `password_hash` = ?, `password_changed_at` = UTC_TIMESTAMP(3) WHERE `id` = ?',
    [password_hash, id],
  );
  return result.affectedRows;
}
