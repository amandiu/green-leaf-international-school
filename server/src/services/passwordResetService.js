// ------------------------------------------------------------
// Password reset service (Phase C.5 — SYSTEM_DESIGN §AN.8)
//
// Business rules for one-time, 60-minute, hash-only reset tokens:
//   - raw token: 32 crypto-random bytes, base64url — returned
//     ONLY to the intended caller, NEVER stored/logged/projected
//   - storage: SHA-256 hex digest ONLY (CHAR(64))
//   - consumption: transactional; single-use enforced by the
//     UPDATE ... WHERE used_at IS NULL condition (the WHERE
//     clause — not a prior SELECT — makes replay impossible),
//     followed by the atomic password+pwdAt update
//   - success also invalidates every OTHER outstanding token for
//     the user (no token reuse after a password change)
//   - responses are GENERIC: existence, active state, token
//     state and consumption outcome are never distinguished
//
// The raw token never enters this file's logs, error messages or
// return projections — only `createResetToken` hands it to its
// direct caller, once.
// ------------------------------------------------------------

import { createHash, randomBytes } from 'node:crypto';
import pool from '../config/db.js';
import * as passwordResetModel from '../models/PasswordReset.js';
import * as userModel from '../models/User.js';
import { validateEmail } from '../validators/identityValidation.js';
import { validatePassword, hashPassword } from './passwordPolicy.js';
import { parseUserId } from './ownershipScoping.js';

const TOKEN_TTL_MINUTES = 60; // exactly 60 minutes (§AN.8)

/** SHA-256 hex digest (64 lowercase hex chars) of the raw token. */
function hashToken(rawToken) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/**
 * Create a reset token for an email (ADMIN-ISSUED mechanics).
 *
 * Generic by design: an unknown/inactive email resolves to null —
 * the caller decides the generic response (no enumeration, §AN.9).
 * Per §AN.8, issuing a new token invalidates the user's other
 * outstanding tokens, so exactly one live token per user exists.
 *
 * Returns { user, rawToken } ONLY when an active identity exists —
 * the raw token leaves this function exactly once, to its caller.
 */
export async function createResetToken(input) {
  const email = validateEmail(input?.email);
  const user = await userModel.findSafeByEmail(email);
  if (!user || user.is_active !== true) return null;

  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // §AN.8: a new request invalidates other outstanding rows.
    await passwordResetModel.invalidateAllForUserWith(conn, user.id);
    // Expiry is computed SERVER-SIDE from UTC_TIMESTAMP(3) — the
    // established UTC convention (mirrors markPasswordChanged) —
    // so the stored literal is unambiguously UTC regardless of
    // any session time zone or client-side Date serialization.
    await passwordResetModel.insertWith(conn, {
      userId: user.id,
      tokenHash,
      ttlMinutes: TOKEN_TTL_MINUTES,
    });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return { user, rawToken };
}

/**
 * Consume a token and change the password — ONE transaction:
 *   1. consume the row exactly once (WHERE used_at IS NULL)
 *   2. update password_hash + password_changed_at atomically
 *   3. invalidate any other outstanding tokens for the user
 *
 * Return contract (deliberately indistinguishable to callers):
 *   { ok: true }                     → consumed + password changed
 *   { ok: false, reason: 'invalid' } → unknown / used / expired token
 *                                     or the user vanished
 * The `reason` is the generic internal bucket — endpoints surface
 * ONE generic message for every failure shape.
 */
export async function consumeResetToken(rawToken, newPassword) {
  if (typeof rawToken !== 'string' || rawToken.length === 0 || rawToken.length > 200) {
    return { ok: false, reason: 'invalid' };
  }
  // Password policy FIRST — a policy failure must not consume a
  // valid token (the user keeps their single-use chance).
  validatePassword(newPassword);

  const tokenHash = hashToken(rawToken);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // [1] Single-use consumption — atomic, race-safe (§AN.8).
    const consumed = await passwordResetModel.consumeByHashWith(conn, tokenHash);
    if (!consumed) {
      await conn.rollback();
      return { ok: false, reason: 'invalid' };
    }

    // [2] The token must still point at a live, active identity.
    // parseUserId re-validates the stored id's domain (defense in
    // depth — the column only ever holds canonical users.id values).
    const userId = parseUserId(consumed.user_id);
    if (userId === null) {
      await conn.rollback();
      return { ok: false, reason: 'invalid' };
    }
    const user = await userModel.findSafeById(userId);
    if (!user || user.is_active !== true) {
      await conn.rollback();
      return { ok: false, reason: 'invalid' };
    }

    // [3] Atomic password mutation — the approved C4 seam: hash +
    // password_changed_at in ONE statement, so the pwdAt comparison
    // in attachSessionUser invalidates every existing session (§AN.7).
    const password_hash = await hashPassword(newPassword);
    const stamp = await userModel.updatePasswordHashWith(conn, userId, password_hash);
    if (stamp !== 1) {
      await conn.rollback();
      return { ok: false, reason: 'invalid' };
    }

    // [4] Any OTHER outstanding token for this user is now dead.
    await conn.query(
      'UPDATE `password_resets` SET `used_at` = UTC_TIMESTAMP(3)'
        + ' WHERE `user_id` = ? AND `used_at` IS NULL AND `token_hash` <> ?',
      [userId, tokenHash],
    );

    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Generic response wording shared by request + confirm paths.
 * Kept here so the endpoints cannot drift into revealing state.
 */
export const GENERIC_RESET_MESSAGE = 'If the request is valid, the reset can proceed.';
