// ------------------------------------------------------------
// PasswordReset model — data access for password_resets (C5)
//
// Data access ONLY — business rules live in the service
// (established convention — see identityService/adminAuthService).
//
// SECURITY: this model never sees raw tokens. Callers pass the
// SHA-256 hex digest; no raw token value is stored, logged, or
// projected anywhere in this module.
//
// Phase C.5 (SYSTEM_DESIGN §AN.8): password_resets holds
// SHA-256 digests of one-time, 60-minute reset tokens.
// ------------------------------------------------------------

import pool from '../config/db.js';

const COLUMNS = ['id', 'user_id', 'token_hash', 'expires_at', 'used_at', 'created_at']
  .map((c) => `\`${c}\``)
  .join(', ');

/** Insert one token row on the caller's connection (transaction support). */
export async function insertWith(conn, { userId, tokenHash, ttlMinutes }) {
  const [result] = await conn.query(
    'INSERT INTO `password_resets` (`user_id`, `token_hash`, `expires_at`)'
      + ' VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? MINUTE))',
    [userId, tokenHash, ttlMinutes],
  );
  return result.insertId;
}

/** Invalidate all OUTSTANDING rows for one user (transaction support). */
export async function invalidateAllForUserWith(conn, userId) {
  await conn.query(
    'UPDATE `password_resets` SET `used_at` = UTC_TIMESTAMP(3)'
      + ' WHERE `user_id` = ? AND `used_at` IS NULL',
    [userId],
  );
}

/**
 * Consume ONE token row exactly once — the single-use security
 * primitive (§AN.8: transactional UPDATE with a used_at check;
 * the WHERE clause — not a prior SELECT — enforces single use).
 *
 * Returns the consumed row (user_id included) when THIS call
 * won the race, null when the token was already used/expired/
 * unknown. Rows with an expired token are stamped used_at so a
 * late replay is a no-op even before GC.
 */
export async function consumeByHashWith(conn, tokenHash) {
  const [result] = await conn.query(
    'UPDATE `password_resets` SET `used_at` = UTC_TIMESTAMP(3)'
      + ' WHERE `token_hash` = ? AND `used_at` IS NULL AND `expires_at` > UTC_TIMESTAMP(3)',
    [tokenHash],
  );
  if (result.affectedRows !== 1) return null;
  const [rows] = await conn.query(
    `SELECT ${COLUMNS} FROM \`password_resets\` WHERE \`token_hash\` = ? AND \`used_at\` IS NOT NULL ORDER BY \`id\` DESC LIMIT 1`,
    [tokenHash],
  );
  return rows[0] || null;
}

/**
 * Stats for one user (diagnostics/tests): [outstanding, total].
 * Never exposes token material — only counts.
 */
export async function countsByUserId(userId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total, SUM(`used_at` IS NULL) AS outstanding FROM `password_resets` WHERE `user_id` = ?',
    [userId],
  );
  return { total: Number(rows[0].total || 0), outstanding: Number(rows[0].outstanding || 0) };
}
