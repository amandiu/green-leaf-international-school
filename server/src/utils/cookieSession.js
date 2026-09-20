// ------------------------------------------------------------
// HttpOnly session cookie helpers (Admin auth phase)
//
// Single place defining the session cookie so the controllers,
// middleware and logout always agree on name + options.
// ------------------------------------------------------------

export const SESSION_COOKIE_NAME = 'greenleaf_admin_session';

/** Cookie options shared by login and logout. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,                 // never readable from JS (XSS hardening)
  sameSite: 'lax',                // CSRF hardening; same-site admin fetches work
  secure: process.env.NODE_ENV === 'production', // HTTPS-only in production
  maxAge: Number(process.env.SESSION_TTL_HOURS || 12) * 60 * 60 * 1000,
  path: '/',
};
