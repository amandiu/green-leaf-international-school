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

/**
 * Credential fetch by canonical id (includes password_hash) —
 * C5 change-password use only: the authenticated flow must verify
 * the CURRENT password against the live canonical hash. Same
 * projection discipline as findByEmailWithHash: the hash never
 * leaves the service layer.
 */
export async function findByIdWithHash(id) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`users\` WHERE \`id\` = ? LIMIT 1`,
    [id],
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
 * All users with their resolved role codes, primary role FIRST.
 * Phase C.6 admin user-management list. SAFE projection only:
 * password_hash and password_changed_at are never selected (the
 * SAFE_COLUMNS discipline). Two queries — users + the role join —
 * merged here to avoid an N+1 per-user lookup.
 */
export async function listSafeUsersWithRoles() {
  const [users] = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM \`users\` ORDER BY \`id\` ASC`,
  );
  const [roleRows] = await pool.query(
    'SELECT `ur`.`user_id`, `r`.`code`, `ur`.`is_primary`'
      + ' FROM `user_roles` `ur` JOIN `roles` `r` ON `r`.`id` = `ur`.`role_id`'
      + ' ORDER BY `ur`.`user_id` ASC, `ur`.`is_primary` DESC, `ur`.`id` ASC',
  );
  const rolesByUser = new Map();
  for (const row of roleRows) {
    if (!rolesByUser.has(row.user_id)) rolesByUser.set(row.user_id, []);
    rolesByUser.get(row.user_id).push(row.code);
  }
  return users.map((u) => ({
    ...toJs(u),
    roles: rolesByUser.get(u.id) || [],
  }));
}

/**
 * Set the is_active lifecycle flag (Phase C.6 admin deactivation).
 * Returns affected rows (0 = unknown id). Deliberately the ONLY
 * lifecycle state — no suspended/locked/pending (§AN.10).
 */
export async function setActive(id, isActive) {
  const [result] = await pool.query(
    'UPDATE `users` SET `is_active` = ? WHERE `id` = ?',
    [isActive ? 1 : 0, id],
  );
  return result.affectedRows;
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

/**
 * Transaction-scoped form of the SAME atomic seam (C5 reset
 * consumption): identical single-statement hash + stamp update,
 * executed on the CALLER's connection so it commits/rolls back
 * together with the token consumption around it (§AN.8). Not a
 * second password-update mechanism — the pool form above stays
 * the non-transactional entry point (change-password flow).
 */
export async function updatePasswordHashWith(conn, id, password_hash) {
  const [result] = await conn.query(
    'UPDATE `users` SET `password_hash` = ?, `password_changed_at` = UTC_TIMESTAMP(3) WHERE `id` = ?',
    [password_hash, id],
  );
  return result.affectedRows;
}
