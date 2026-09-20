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

const BEARER_CONFIGURED = Boolean(process.env.ADMIN_TOKEN);

/** Attach req.adminUser when a valid session cookie is present. */
export function attachSessionUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token) {
    const payload = verifySessionToken(token);
    if (payload) req.adminUser = payload; // { sub→id, email, name, exp }
  }
  next();
}

/**
 * Require an authenticated admin (cookie session; Bearer secret as
 * documented transition). Use on every /api/admin/* router.
 */
export function adminAuth(req, res, next) {
  // 1. Cookie session (browser Admin Panel)
  if (req.adminUser) return next();

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
