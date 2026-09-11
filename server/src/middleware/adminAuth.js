// ------------------------------------------------------------
// Admin authentication middleware (Phase 3.3 — stopgap)
//
// The project does not yet have a real auth system (no users
// table / sessions / JWT — scheduled for a later phase). Until
// then, ALL /api/admin/* routes are protected by a shared admin
// token from the environment:
//
//   server/.env →  ADMIN_TOKEN=<long random string>
//
// - Fail-closed: if ADMIN_TOKEN is not configured, every admin
//   request is rejected (503) — CRUD is never publicly exposed.
// - Sent by clients as:  Authorization: Bearer <ADMIN_TOKEN>
// - The real authentication/authorization system replaces this
//   middleware without changing any route definitions.
// ------------------------------------------------------------

import { randomBytes } from 'node:crypto';

export const ADMIN_TOKEN_CONFIGURED = Boolean(process.env.ADMIN_TOKEN);

/** Convenience for generating a strong token during setup. */
export function generateAdminToken() {
  return randomBytes(32).toString('hex');
}

export default function adminAuth(req, res, next) {
  if (!ADMIN_TOKEN_CONFIGURED) {
    return res.status(503).json({
      success: false,
      message: 'Admin API is not configured. Set ADMIN_TOKEN in the server environment.',
    });
  }

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Admin authentication required.',
    });
  }

  const a = Buffer.from(token);
  const b = Buffer.from(process.env.ADMIN_TOKEN);
  const matches = a.length === b.length && a.equals(b);

  if (!matches) {
    return res.status(401).json({
      success: false,
      message: 'Invalid admin credentials.',
    });
  }

  return next();
}
