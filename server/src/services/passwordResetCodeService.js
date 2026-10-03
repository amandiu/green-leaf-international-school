// ------------------------------------------------------------
// Password reset CODE service (Phase 2 — email verification codes)
//
// Email-channel counterpart of passwordResetService (the C5
// admin-issued token flow, which stays untouched). Business rules:
//   - raw code: 6 crypto-random digits from node:crypto
//     randomInt — the only crypto-secure source (§4); NEVER
//     Math.random() or timestamp-derived
//   - storage: SHA-256 hex digest ONLY (CHAR(64)) — the raw code
//     is never persisted, logged or projected (§3)
//   - expiry: PASSWORD_RESET_CODE_EXPIRY_MINUTES (default 10),
//     configured in ONE place (§5)
//   - one-time use: transactional UPDATE ... WHERE used_at IS NULL
//     — Phase 3's verifyResetCode consumes it bound to the owner
//   - previous-code invalidation: issuing a new code marks every
//     other outstanding row used, in the SAME transaction as the
//     insert (§7/§17 — one live code per user, race-safe)
//   - responses are GENERIC: existence and active state never
//     leave this module — the caller decides the generic reply
//   - attempt_count: Phase 3 verification enforces a 5-guess
//     ceiling per code row (§16 — no unlimited guessing)
// ------------------------------------------------------------

import { createHash, randomInt } from 'node:crypto';
import pool from '../config/db.js';
import * as resetCodeModel from '../models/PasswordResetCode.js';
import * as userModel from '../models/User.js';
import { validateEmail } from '../validators/identityValidation.js';
import { validatePassword, hashPassword } from './passwordPolicy.js';
import { badRequest } from '../utils/errors.js';

/**
 * Maximum failed code verifications per code row (Phase 3 — §7).
 * The consume primitive rejects any row at/over this ceiling; a
 * sixth wrong guess can never succeed even with the correct code
 * later. Consistent with the Phase 2 attempt_count foundation.
 */
export const MAX_CODE_ATTEMPTS = 5;

/** TTL in ONE place — env-configurable, default 10 minutes (§5). */
const DEFAULT_CODE_TTL_MINUTES = 10;
const MAX_CODE_TTL_MINUTES = 120;

function resolveTtlMinutes() {
  const raw = Number(process.env.PASSWORD_RESET_CODE_EXPIRY_MINUTES);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_CODE_TTL_MINUTES;
  return Math.min(Math.floor(raw), MAX_CODE_TTL_MINUTES);
}

/** SHA-256 hex digest (64 lowercase hex chars) of the raw code. */
function hashCode(rawCode) {
  return createHash('sha256').update(rawCode, 'utf8').digest('hex');
}

/**
 * Generate ONE 6-digit numeric code from a cryptographically
 * secure source. randomInt is unbiased ([0, 1e6) inclusive-
 * exclusive) and derives from the OS CSPRNG — never Math.random,
 * never timestamp/id/email-derived (§4).
 */
function generateSixDigitCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Create + email a verification code for an email address.
 * The FULL pipeline runs inside ONE transaction (§17): previous
 * outstanding codes are invalidated before the new row is
 * inserted, so two concurrent requests can never yield two live
 * codes — at most one of the two transactions commits last and
 * the loser's row is marked used by the winner's invalidation.
 *
 * Generic by design: an unknown/inactive email resolves to null —
 * the caller decides the generic response (no enumeration, §8).
 * The email side effect runs ONLY for a real, active identity,
 * after the transaction committed (a failed send must not roll
 * back a stored code — the user can still be told generically
 * and retry; rate limiting bounds retries).
 *
 * Returns { delivery } ONLY when an active identity exists:
 *   'sent'    → handed to SMTP
 *   'preview' → dev console preview (no SMTP configured)
 * Returns null for unknown/inactive emails (NO email attempt).
 */
export async function issueResetCodeForEmail(emailInput) {
  const email = validateEmail(emailInput);
  const user = await userModel.findSafeByEmail(email);
  if (!user || user.is_active !== true) return null;

  const rawCode = generateSixDigitCode();
  const codeHash = hashCode(rawCode);
  const ttlMinutes = resolveTtlMinutes();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // §7: a new request invalidates the user's other live codes.
    await resetCodeModel.invalidateAllForUserWith(conn, user.id);
    await resetCodeModel.insertWith(conn, {
      userId: user.id,
      codeHash,
      ttlMinutes,
    });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Post-commit side effect: delivery. Import lazily to avoid a
  // dependency cycle (mailService ← siteConfig only; services may
  // freely import each other — lazy keeps load order trivial).
  const { sendResetCodeEmail } = await import('./mailService.js');
  const delivery = await sendResetCodeEmail({
    to: user.email,
    code: rawCode,
    expiryMinutes: ttlMinutes,
  });

  return { delivery };
}

/**
 * PHASE 3 — verify a code + set the new password in ONE transaction
 * (§5 atomic flow; the C5 consumeResetToken pattern, email+code form):
 *
 *   1. validate email/code/policy shapes (policy BEFORE any state
 *      changes — a weak password never burns the single-use chance)
 *   2. consume the code row exactly once, bound to its owner:
 *      UPDATE ... WHERE user_id = ? AND code_hash = ? AND used_at IS NULL
 *      AND expires_at > now AND attempt_count < MAX (§6/§14/§25 — the
 *      WHERE clause makes replay and double-consumption impossible;
 *      two racing requests can never both win the row)
 *   3. update password_hash + password_changed_at atomically — the
 *      established pwdAt seam invalidates every existing session
 *      for the account on next request (§12 — verified in
 *      attachSessionUser; no second auth mechanism invented)
 *
 * If the password update fails the transaction ROLLS BACK, so the
 * code is NOT consumed (§5). If the code loses the race the
 * password is NOT updated (§5). NO automatic login: the endpoint
 * only ever returns { ok } — no token, no cookie (§13).
 *
 * Failure accounting (§7): a LOSING guess increments the user's
 * OUTSTANDING row's attempt_count (committed outside the rolled-
 * back transaction so the ceiling accumulates). No-op when no
 * outstanding row exists — used/expired/unknown are then
 * indistinguishable to any observer (§8 enumeration safety).
 *
 * Return contract (deliberately generic — the caller maps BOTH
 * outcomes to ONE safe message):
 *   { ok: true }  → code consumed + password changed
 *   { ok: false } → unknown/inactive email, wrong code, expired,
 *                   used, or attempts exhausted
 */
export async function verifyResetCode({ email, code, newPassword }) {
  const normalizedEmail = validateEmail(email);
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw badRequest('Enter the 6-digit verification code');
  }
  // Same policy as every other password mutation (§9) — reuse, no
  // second rule set. Throws 400 on violation BEFORE any write.
  validatePassword(newPassword);

  const user = await userModel.findSafeByEmail(normalizedEmail);
  if (!user || user.is_active !== true) return { ok: false };

  const codeHash = hashCode(code);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // [1] Race-safe single-use consumption, bound to the owner.
    const consumed = await resetCodeModel.consumeByUserAndHashWith(
      conn, user.id, codeHash, MAX_CODE_ATTEMPTS,
    );
    if (!consumed) {
      await conn.rollback();
      // Count THIS failed guess against the outstanding row (if any).
      await resetCodeModel.incrementOutstandingAttemptsByUser(user.id);
      return { ok: false };
    }

    // [2] Atomic hash + stamp (the approved C4 seam) — the pwdAt
    // mismatch then 401s every pre-reset session (§12).
    const password_hash = await hashPassword(newPassword);
    const stamp = await userModel.updatePasswordHashWith(conn, user.id, password_hash);
    if (stamp !== 1) {
      await conn.rollback();
      return { ok: false };
    }

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
 * Expiry minutes as configured — surfaced for the email template
 * and for tests/diagnostics. No code material.
 */
export function getCodeTtlMinutes() {
  return resolveTtlMinutes();
}
