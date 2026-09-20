// ------------------------------------------------------------
// Admin auth controllers (Admin auth phase)
//
// POST /api/auth/login   → issue HttpOnly session cookie
// GET  /api/auth/me      → current admin profile (401 when not)
// POST /api/auth/logout  → clear the session cookie
//
// The cookie is HttpOnly + SameSite=Lax so the browser never
// exposes the session to JavaScript and no Bearer header is
// needed for normal admin usage. No tokens/passwords are logged.
// ------------------------------------------------------------

import {
  login,
  getAdminProfile,
} from '../services/adminAuthService.js';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '../utils/cookieSession.js';

/** Map service errors to responses; everything else → safe 500. */
function sendServiceError(res, err, fallback) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  console.error(fallback.log, err.message);
  return res.status(500).json({ success: false, message: fallback.message });
}

import { HttpError } from '../utils/errors.js';

/**
 * POST /api/auth/login
 * Body: { email, password } → 200 { user } + Set-Cookie session
 * Any credential mismatch → 401 with the same generic message.
 */
export async function postLogin(req, res) {
  try {
    const { user, token } = await login(req.body);
    res.cookie(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Auth: login failed:',
      message: 'Login failed',
    });
  }
}

/**
 * GET /api/auth/me
 * Requires a valid session cookie (attachSessionUser ran) —
 * req.adminUser is already verified; re-reads the live profile
 * so deactivation/deletion takes effect immediately.
 */
export async function getMe(req, res) {
  try {
    const user = await getAdminProfile(req.adminUser.id);
    res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Auth: profile lookup failed:',
      message: 'Failed to load profile',
    });
  }
}

/**
 * POST /api/auth/logout
 * Always succeeds and always clears the cookie (idempotent).
 */
export async function postLogout(req, res) {
  res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
  res.status(200).json({ success: true, message: 'Logged out' });
}
