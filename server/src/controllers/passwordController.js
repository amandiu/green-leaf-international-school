// ------------------------------------------------------------
// Password-flow controllers (Phase C.5 — SYSTEM_DESIGN §AN.8/§AN.11)
//
//   POST /api/auth/change-password   authenticated; body
//                                    { currentPassword, newPassword }
//   POST /api/auth/forgot-password   public; body { email }
//   POST /api/auth/reset-password    public; body { token, newPassword }
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
// ADMIN-ISSUED MECHANICS (§AN.8): until the email adapter exists
// the raw token is NEVER returned by any endpoint — a public
// conditional token would be an account-existence oracle and an
// unauthenticated takeover path (see postForgotPassword). The
// createResetToken service is the approved issuance primitive for
// the future notification adapter and the C6 reset-issue UI.
// ------------------------------------------------------------

import { changePassword } from '../services/passwordChangeService.js';
import { consumeResetToken } from '../services/passwordResetService.js';
import { badRequest, HttpError } from '../utils/errors.js';

/** The ONE generic forgot/reset message (no state disclosure). */
const GENERIC_RESET_MESSAGE = 'If the account exists, a reset token has been issued.';

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
 * §AN.8: "password reset is ADMIN-ISSUED until email exists" — the
 * raw reset token is NEVER returned here. A conditional token would
 * BE an account-existence oracle (§AN.9/§AN.16 forbid exactly that)
 * and an unauthenticated password-takeover path for any known
 * email. Today (no email adapter, no C6 issuance UI yet) this is
 * the rate-limited generic sink required by §AN.11/§AN.12; when the
 * notification adapter lands it starts issuing + emailing tokens,
 * and C6's admin UI calls the SAME createResetToken service the
 * tests exercise. ONE identical response for known/unknown/inactive
 * emails and throttled requests.
 */
export async function postForgotPassword(req, res) {
  try {
    if (typeof req.body?.email !== 'string') {
      throw badRequest('Email is required');
    }
    // Normalize/validate ONLY (safe messages); nothing is created —
    // no delivery channel exists, so an undeliverable token would
    // be dead weight and churn outstanding admin-issued tokens.
    const { validateEmail } = await import('../validators/identityValidation.js');
    validateEmail(req.body.email);
    res.status(200).json({ success: true, message: GENERIC_RESET_MESSAGE, data: {} });
  } catch (err) {
    if (err instanceof HttpError) {
      // Validation (400) keeps its safe, non-revealing message.
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Auth: forgot-password failed:', err.message);
    return res.status(500).json({ success: false, message: 'Password reset request failed' });
  }
}

/**
 * POST /api/auth/reset-password — public, rate-limited.
 * ONE generic failure for invalid/expired/used token or vanished
 * account; never reveals which.
 */
export async function postResetPassword(req, res) {
  try {
    if (typeof req.body?.token !== 'string' || req.body.token === '') {
      throw badRequest('Token is required');
    }
    const result = await consumeResetToken(req.body.token, req.body?.newPassword);
    if (!result.ok) {
      // Consumed-but-vanished-account cannot happen (FK + active
      // check inside the transaction) — this is the generic reject.
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token.',
      });
    }
    res.status(200).json({
      success: true,
      message: 'Password has been reset. Please sign in with the new password.',
    });
  } catch (err) {
    if (err instanceof HttpError) {
      // Validation errors (missing/weak password) — safe messages.
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Auth: reset-password failed:', err.message);
    return res.status(500).json({ success: false, message: 'Password reset failed' });
  }
}
