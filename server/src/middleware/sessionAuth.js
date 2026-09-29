// ------------------------------------------------------------
// Admin authentication middleware (Admin auth phase)
//
// Replaces the Phase 3.3 ADMIN_TOKEN stopgap as the primary gate
// for all /api/admin/* routes.
//
//   1. PRIMARY — HttpOnly session cookie issued by
//      POST /api/auth/login (HMAC-signed, expiry enforced
//      server-side in utils/sessionToken.js).
//   2. TRANSITION — the old server-side secret may still be sent
//      as `Authorization: Bearer <ADMIN_TOKEN>` for scripts/
//      migrations only while ADMIN_TOKEN remains in server/.env.
//      It grants NO cookie and its use is logged. Remove
//      ADMIN_TOKEN from the environment to disable it entirely.
//
// Fail-closed: with neither mechanism configured every admin
// request is rejected (503). Errors never leak which check failed.
// ------------------------------------------------------------

import { verifySessionToken } from '../utils/sessionToken.js';
import { SESSION_COOKIE_NAME } from '../utils/cookieSession.js';
import { unauthorized } from '../utils/errors.js';
import { findLivePwdAt } from '../models/User.js';

/**
 * LIVE password_changed_at state for one canonical id (three
 * distinguishable values — see User.findLivePwdAt):
 *   undefined → row missing (unknown session subject → deny)
 *   null      → never stamped (VALID; matches a token pwdAt of null)
 *   number    → epoch ms (must EQUAL the token's pwdAt)
 */
async function livePwdAt(canonicalId) {
  return findLivePwdAt(canonicalId);
}

const BEARER_CONFIGURED = Boolean(process.env.ADMIN_TOKEN);

/**
 * Attach req.adminUser when a valid session cookie is present.
 *
 * Phase C.4 (§AN.7/§AN.14): `sub` is now the CANONICAL users.id and
 * the token carries `roles` + `pwdAt`. The middleware re-reads the
 * live users.password_changed_at and rejects the session when it no
 * longer matches the token's pwdAt (password-change invalidation
 * without a session store). The deactivation/deletion check stays
 * in the /me profile re-read (as before). Fail-closed: unknown id,
 * malformed id or unreadable password_changed_at → no identity.
 */
export async function attachSessionUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token) {
    const payload = verifySessionToken(token);
    if (payload) {
      const live = await livePwdAt(payload.sub);
      // undefined = row missing / malformed id → fail closed.
      // Otherwise: live must EQUAL the token's pwdAt — where both
      // being null ("never changed") is a MATCH, and any stamp
      // mismatch (password changed since issue) is a MISMATCH = 401
      // (§AN.7 invalidation without a session store).
      if (live !== undefined && live === (payload.pwdAt ?? null)) {
        // The signed token stores the canonical user id JWT-style as
        // `sub`; expose it as `id` so controllers can use
        // req.adminUser.id (without this mapping /api/auth/me can
        // never resolve the live profile and every refresh drops
        // the session UI).
        //
        // req.adminUser is the LONG-ESTABLISHED identity consumer
        // shape (authController getMe + the server.js rate-limit
        // key read it pre-cutover). Under the users-cutover its
        // values are CANONICAL: id = users.id, roles = the C4
        // roles claim — no router or CMS controller changes.
        req.adminUser = { ...payload, id: payload.sub };
      }
    }
  }
  next();
}

/**
 * Require an authenticated admin (cookie session; Bearer secret as
 * documented transition). Use on every /api/admin/* router.
 */
export function adminAuth(req, res, next) {
  // 1. Cookie session (browser Admin Panel)
  if (req.adminUser) {
    req.adminAuthMethod = 'session';
    return next();
  }

  // 2. Transition: server-side secret via Bearer (scripts/tests)
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    if (!BEARER_CONFIGURED) {
      return res.status(503).json({
        success: false,
        message: 'Admin API is not configured on the server.',
      });
    }
    const a = Buffer.from(token);
    const b = Buffer.from(process.env.ADMIN_TOKEN);
    if (a.length === b.length && a.equals(b)) {
      // Phase C.7: tag the method so the permission gates can keep
      // this deprecated script path working (§AN.14.4 — untouched
      // until its own tracked cleanup). No identity attaches to a
      // Bearer call; the gates treat it as an authorized server
      // consumer, NOT as any canonical identity.
      req.adminAuthMethod = 'bearer';
      return next();
    }
    // A Bearer credential was presented but is wrong → generic 401.
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  // No credentials at all → 401 (503 only when NOTHING is configured).
  if (!BEARER_CONFIGURED) {
    return res.status(503).json({
      success: false,
      message: 'Admin API is not configured on the server.',
    });
  }
  return res.status(401).json({ success: false, message: 'Authentication required.' });
}

/**
 * Express body-parser emits raw HtmlErrors on malformed JSON.
 * Convert them to a safe 400 so the global handler never leaks
 * stack traces from the parser.
 */
export function jsonBodyErrorHandler(err, _req, res, next) {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ success: false, message: 'Request body is not valid JSON.' });
  }
  return next(err);
}

/** Default export for `import adminAuth from ...` call sites. */
export default adminAuth;
