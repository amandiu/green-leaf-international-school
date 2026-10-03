// ------------------------------------------------------------
// PasswordResetCode model — data access for password_reset_codes
// (Phase 2 — email verification codes)
//
// Data access ONLY — business rules live in the service
// (established convention — see identityService/PasswordReset).
//
// SECURITY: this model never sees raw codes. Callers pass the
// SHA-256 hex digest; no raw code value is stored, logged, or
// projected anywhere in this module.
//
// Phase 2: holds SHA-256 digests of one-time, 10-minute (config)
// email verification codes for the public forgot-password flow.
// The C5 password_resets table (admin-issued tokens) is a SEPARATE
// table and is untouched by this module.
// ------------------------------------------------------------

import pool from '../config/db.js';

const COLUMNS = [
  'id', 'user_id', 'code_hash', 'expires_at', 'used_at', 'attempt_count', 'created_at',
].map((c) => `\`${c}\``).join(', ');

/** Insert one code row on the caller's connection (transaction support). */
export async function insertWith(conn, { userId, codeHash, ttlMinutes }) {
  const [result] = await conn.query(
    'INSERT INTO `password_reset_codes` (`user_id`, `code_hash`, `expires_at`)'
      + ' VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? MINUTE))',
    [userId, codeHash, ttlMinutes],
  );
  return result.insertId;
}

/**
 * Invalidate all OUTSTANDING code rows for one user (transaction
 * support). Phase 2 issuance runs this in the SAME transaction as
 * the insert, so at most ONE outstanding code per user can ever
 * exist — even under concurrent requests (§17 race requirement).
 */
export async function invalidateAllForUserWith(conn, userId) {
  await conn.query(
    'UPDATE `password_reset_codes` SET `used_at` = UTC_TIMESTAMP(3)'
      + ' WHERE `user_id` = ? AND `used_at` IS NULL',
    [userId],
  );
}

/**
 * Consume ONE code row exactly once — the single-use security
 * primitive (same shape as PasswordReset.consumeByHashWith: a
 * transactional UPDATE whose WHERE clause — not a prior SELECT —
 * enforces single use; Phase 3 calls this at verification).
 *
 * Returns the consumed row (user_id included) when THIS call won
 * the race, null when the code was already used/expired/unknown.
 * Rows with an expired code are stamped used_at so a late replay
 * is a no-op even before cleanup.
 */
export async function consumeByHashWith(conn, codeHash) {
  const [result] = await conn.query(
    'UPDATE `password_reset_codes` SET `used_at` = UTC_TIMESTAMP(3)'
      + ' WHERE `code_hash` = ? AND `used_at` IS NULL AND `expires_at` > UTC_TIMESTAMP(3)',
    [codeHash],
  );
  if (result.affectedRows !== 1) return null;
  const [rows] = await conn.query(
    `SELECT ${COLUMNS} FROM \`password_reset_codes\` WHERE \`code_hash\` = ? AND \`used_at\` IS NOT NULL ORDER BY \`id\` DESC LIMIT 1`,
    [codeHash],
  );
  return rows[0] || null;
}

/**
 * Phase 3 — consume ONE code row bound to its OWNER (email + code
 * are verified together, so a code guessed for one account can
 * never reset another). Same race-safe shape as consumeByHashWith:
 * a single conditional UPDATE whose WHERE clause enforces
 *   - correct owner (user_id)
 *   - single use   (used_at IS NULL)
 *   - not expired  (expires_at > UTC_TIMESTAMP(3))
 *   - attempt ceiling not exceeded (attempt_count < maxAttempts)
 * Returns the consumed row when THIS call won the race, null when
 * the code was wrong/expired/used/exhausted/unknown.
 */
export async function consumeByUserAndHashWith(conn, userId, codeHash, maxAttempts) {
  const [result] = await conn.query(
    'UPDATE `password_reset_codes` SET `used_at` = UTC_TIMESTAMP(3)'
      + ' WHERE `user_id` = ? AND `code_hash` = ? AND `used_at` IS NULL'
      + ' AND `expires_at` > UTC_TIMESTAMP(3) AND `attempt_count` < ?'
      + ' ORDER BY `id` DESC LIMIT 1',
    [userId, codeHash, maxAttempts],
  );
  if (result.affectedRows !== 1) return null;
  const [rows] = await conn.query(
    `SELECT ${COLUMNS} FROM \`password_reset_codes\` WHERE \`user_id\` = ? AND \`code_hash\` = ? AND \`used_at\` IS NOT NULL ORDER BY \`id\` DESC LIMIT 1`,
    [userId, codeHash],
  );
  return rows[0] || null;
}

/**
 * Phase 3 — record ONE failed verification guess against the
 * user's OUTSTANDING code row (if any). Keyed by user_id, NOT by
 * the submitted hash: a wrong guess must count against the code
 * the user IS holding, and must be a no-op when no outstanding
 * row exists (used/expired/never issued — no info leak either way).
 * Committed on the pool (outside the failed consume transaction)
 * so the ceiling accumulates across attempts.
 */
export async function incrementOutstandingAttemptsByUser(userId) {
  const [result] = await pool.query(
    'UPDATE `password_reset_codes` SET `attempt_count` = `attempt_count` + 1'
      + ' WHERE `user_id` = ? AND `used_at` IS NULL',
    [userId],
  );
  return result.affectedRows;
}

/**
 * Increment the failed-attempt counter for one code row, by hash.
 * Phase 3's verify endpoint records every failed guess here so the
 * per-row brute-force guard has data to act on.
 * Returns the new attempt_count, or null when the row is gone.
 */
export async function incrementAttemptsByHash(codeHash) {
  const [result] = await pool.query(
    'UPDATE `password_reset_codes` SET `attempt_count` = `attempt_count` + 1 WHERE `code_hash` = ?',
    [codeHash],
  );
  if (result.affectedRows !== 1) return null;
  const [rows] = await pool.query(
    'SELECT `attempt_count` FROM `password_reset_codes` WHERE `code_hash` = ? LIMIT 1',
    [codeHash],
  );
  return rows.length > 0 ? Number(rows[0].attempt_count) : null;
}

/**
 * Latest code row for one user (diagnostics/tests): outstanding,
 * expired or consumed. Never exposes code material — metadata only.
 */
export async function latestByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`password_reset_codes\` WHERE \`user_id\` = ? ORDER BY \`id\` DESC LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

/**
 * Stats for one user (diagnostics/tests): [outstanding, total].
 * Never exposes code material — only counts.
 */
export async function countsByUserId(userId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total, SUM(`used_at` IS NULL) AS outstanding FROM `password_reset_codes` WHERE `user_id` = ?',
    [userId],
  );
  return { total: Number(rows[0].total || 0), outstanding: Number(rows[0].outstanding || 0) };
}
