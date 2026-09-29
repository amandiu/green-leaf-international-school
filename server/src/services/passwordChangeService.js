// ------------------------------------------------------------
// Password change service (Phase C.5 — SYSTEM_DESIGN §AN.8/§AN.7)
//
// AUTHENTICATED password change for the logged-in identity:
//   - current password REQUIRED and verified against the
//     canonical users.password_hash (bcrypt compare)
//   - new password under the SAME established policy (min 8,
//     bcrypt-12 — see passwordPolicy.js)
//   - mutation through the approved atomic seam (hash +
//     password_changed_at in ONE statement), so the C4 pwdAt
//     comparison invalidates every previously issued session
//     (§AN.7) — including the session that performed the change
//   - wrong current password → generic 401 in the same wording
//     family as login (no which-part-failed disclosure beyond
//     the required "current password" semantics)
//
// No re-login is invented: the approved design invalidates the
// session and the client re-authenticates explicitly.
// ------------------------------------------------------------

import bcrypt from 'bcryptjs';
import * as userModel from '../models/User.js';
import { parseUserId } from './ownershipScoping.js';
import { validatePassword, hashPassword } from './passwordPolicy.js';
import { badRequest, unauthorized } from '../utils/errors.js';

/** Wrong-current-password error — generic, no detail leakage. */
const GENERIC_CURRENT = 'Current password is incorrect.';

/** Validate + normalize the change payload shape (unknown fields rejected). */
function normalizeChangeInput(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  const ALLOWED = ['currentPassword', 'newPassword'];
  const unknown = Object.keys(input).filter((k) => !ALLOWED.includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }
  if (typeof input.currentPassword !== 'string' || input.currentPassword === '') {
    throw badRequest('Current password is required');
  }
  const currentPassword = input.currentPassword;
  const newPassword = validatePassword(input.newPassword);
  return { currentPassword, newPassword };
}

/**
 * Change the password for one canonical user id.
 * Throws 400 (validation) / 401 (wrong current password).
 * On success every existing session for the identity is dead
 * (pwdAt mismatch) and the client must log in again.
 */
export async function changePassword(userId, input) {
  if (parseUserId(userId) === null) {
    throw unauthorized('Session is no longer valid.');
  }
  const { currentPassword, newPassword } = normalizeChangeInput(input);

  // Canonical credential fetch — the model projects password_hash
  // ONLY through the *WithHash functions (established convention).
  const hashRow = await userModel.findByIdWithHash(userId);
  if (!hashRow) {
    // Session subject vanished between attachSessionUser and now.
    throw unauthorized('Session is no longer valid.');
  }

  const currentOk = await bcrypt.compare(currentPassword, hashRow.password_hash);
  if (!currentOk) {
    throw unauthorized(GENERIC_CURRENT);
  }

  const password_hash = await hashPassword(newPassword);
  const affected = await userModel.updatePasswordHash(userId, password_hash);
  if (affected !== 1) {
    // The row disappeared mid-flow (deleted) — fail closed.
    throw unauthorized('Session is no longer valid.');
  }

  return { ok: true };
}
