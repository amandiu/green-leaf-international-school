// ------------------------------------------------------------
// Password-flow controllers (Phase C.5 — SYSTEM_DESIGN §AN.8/§AN.11)
//
//   POST /api/auth/change-password   authenticated; body
//                                    { currentPassword, newPassword }
//   POST /api/auth/forgot-password   public; body { email }
//   POST /api/auth/reset-password    public; Phase 3 body
//                                    { email, code, newPassword, confirmPassword }
//
// RESPONSE CONTRACT (§AN.8/§AN.9 — no account enumeration):
//   - forgot-password answers IDENTICALLY for known/unknown/
//     inactive emails and for throttled requests
//   - reset-password answers IDENTICALLY for invalid/expired/
//     reused tokens and unknown accounts
//   - success and failure envelopes always use the canonical
//     { success, message?, data } shape (the news {items}
//     deviation is never replicated — §AN.11)
//
// ADMIN-ISSUED MECHANICS + PHASE 2 EMAIL CODES (§AN.8): the raw
// reset token / verification code is NEVER returned by any
// endpoint — a conditional secret would be an account-existence
// oracle and an unauthenticated takeover path. The C6 admin UI
// still issues tokens through createResetToken; the public
// forgot-password endpoint now issues + emails the Phase 2
// 6-digit verification codes (passwordResetCodeService →
// password_reset_codes, separate table, hash-only).
// ------------------------------------------------------------

import { changePassword } from '../services/passwordChangeService.js';
import { consumeResetToken } from '../services/passwordResetService.js';
import {
  issueResetCodeForEmail, verifyResetCode,
} from '../services/passwordResetCodeService.js';
import { badRequest, HttpError } from '../utils/errors.js';

/** The ONE generic forgot message (no state disclosure) — Phase 2
 * wording: the endpoint now delivers a 6-digit VERIFICATION CODE,
 * so the message says "code", not the C5-era "token" (§12). */
const GENERIC_RESET_MESSAGE = 'If an account exists for this email, a verification code has been sent.';

/** Map service errors to responses; anything else → safe 500. */
function sendServiceError(res, err, fallback) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  console.error(fallback.log, err.message);
  return res.status(500).json({ success: false, message: fallback.message });
}

/**
 * POST /api/auth/change-password (requires attachSessionUser + adminAuth).
 * 200 → the session is now INVALID by design (pwdAt stamp moved);
 * the client must re-authenticate. The response carries no token.
 */
export async function postChangePassword(req, res) {
  try {
    await changePassword(req.adminUser.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Password changed. Please sign in again.',
    });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Auth: change-password failed:',
      message: 'Password change failed',
    });
  }
}

/**
 * POST /api/auth/forgot-password — public, double-bucketed.
 *
 * Phase 2 (email verification codes): issues a 6-digit crypto-
 * random code for ACTIVE identities ONLY and delivers it through
 * the configured mail channel (SMTP; dev console preview when no
 * SMTP is configured outside production). The code is stored
 * hash-only (password_reset_codes — SEPARATE from the C5 admin-
 * issued password_resets tokens, which this endpoint does NOT
 * touch) and the raw code NEVER appears in any response or log.
 *
 * §AN.8/§AN.9 — NO ACCOUNT ENUMERATION: unknown/inactive emails,
 * known emails with a failed delivery, and SMTP-misconfigured
 * production instances ALL receive this ONE identical generic
 * response. Existence, active state and delivery outcome never
 * reach the client.
 */
export async function postForgotPassword(req, res) {
  try {
    if (typeof req.body?.email !== 'string') {
      throw badRequest('Email is required');
    }
    // Issues + emails the code for real identities; resolves to
    // null for unknown/inactive emails (no email attempt). ALL
    // outcomes below share the same generic reply.
    const issued = await issueResetCodeForEmail(req.body.email);
    if (issued === null) {
      console.log('Auth: forgot-password — no active account for the requested email (no email sent)');
    }
    res.status(200).json({ success: true, message: GENERIC_RESET_MESSAGE, data: {} });
  } catch (err) {
    if (err instanceof HttpError) {
      // Validation (400) keeps its safe, non-revealing message.
      return res.status(err.status).json({ success: false, message: err.message });
    }
    // SMTP/DB/unknown failure → safe generic 500; technical detail
    // stays in the server log WITHOUT any code material (§22/§23).
    console.error('Auth: forgot-password failed:', err.message);
    return res.status(500).json({ success: false, message: 'Password reset request failed' });
  }
}

/**
 * POST /api/auth/reset-password — Phase 3 (verification-code form:
 * { email, code, newPassword, confirmPassword }) with the C5/C6
 * ADMIN-ISSUED TOKEN FORM ({ token, newPassword }) preserved as a
 * supported fallback, since the C6 UserManagement reset-issue UI
 * still hands out those tokens out-of-band. Same rate limiter
 * (10/15min per IP — unchanged since C5).
 *
 * §13 — NO AUTOMATIC LOGIN: success returns a message ONLY — no
 * token, no Set-Cookie. The user signs in manually with the new
 * password, so a successful reset can never hand a session to the
 * requester.
 *
 * §8 — GENERIC REJECTS: unknown email, wrong code, expired,
 * already-used and attempt-exhausted code ALL return the ONE
 * message below. Existence and code state never reach the client.
 * Only SHAPE errors (missing/malformed fields, password-policy,
 * confirm mismatch) are 400s — field-shape problems, not account
 * state; the SAME generic message regardless of which part was
 * wrong (no code-state oracle).
 */
const GENERIC_CODE_REJECT = 'The verification code is invalid or expired.';

export async function postResetPassword(req, res) {
  try {
    const { token } = req.body ?? {};

    // ---- C5/C6 admin-issued token form (unchanged contract) ----
    if (typeof token === 'string' && token !== '') {
      const result = await consumeResetToken(token, req.body?.newPassword);
      if (!result.ok) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token.',
        });
      }
      console.log('Auth: password reset successful (admin-issued reset token consumed)');
      return res.status(200).json({
        success: true,
        message: 'Password reset successfully. Please sign in with the new password.',
      });
    }

    // ---- Phase 3 verification-code form ----
    const { email, code } = req.body ?? {};
    // Field-shape validation first (safe, non-revealing messages).
    if (typeof email !== 'string' || email.trim() === '') {
      throw badRequest('Email is required');
    }
    if (typeof code !== 'string' || code.trim() === '') {
      throw badRequest('Enter the 6-digit verification code');
    }
    if (req.body?.confirmPassword !== req.body?.newPassword) {
      throw badRequest('Passwords do not match.');
    }

    // ONE transaction: consume code + update password (§5/§14/§25),
    // or lose the code race with NO password change (§5).
    const result = await verifyResetCode({
      email,
      code,
      newPassword: req.body?.newPassword,
    });
    if (!result.ok) {
      // Generic for wrong/expired/used/exhausted code AND unknown
      // account — indistinguishable (§8).
      return res.status(400).json({ success: false, message: GENERIC_CODE_REJECT });
    }

    // Safe operational log only — no code, no password (§22).
    console.log('Auth: password reset successful (verification code consumed)');
    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (err) {
    if (err instanceof HttpError) {
      // Validation errors (missing fields, bad format, weak
      // password) — safe rule-quoting messages only.
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Auth: reset-password failed:', err.message);
    return res.status(500).json({ success: false, message: 'Password reset failed' });
  }
}
