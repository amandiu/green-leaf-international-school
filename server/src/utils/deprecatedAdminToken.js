// ------------------------------------------------------------
// Deprecated ADMIN_TOKEN helpers (kept for the transition only).
// The value itself stays server-side in server/.env and is never
// exposed to any frontend. See middleware/sessionAuth.js.
// ------------------------------------------------------------

import { randomBytes } from 'node:crypto';

export const ADMIN_TOKEN_CONFIGURED = Boolean(process.env.ADMIN_TOKEN);

/** Convenience for generating a strong token during setup. */
export function generateAdminToken() {
  return randomBytes(32).toString('hex');
}
