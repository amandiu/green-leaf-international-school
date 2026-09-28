// ------------------------------------------------------------
// Origin/Referer CSRF baseline (Phase C.4 — SYSTEM_DESIGN §AN.9)
//
// §AN.9 decision, implemented exactly:
//   "ADD cheap Origin/Referer validation middleware for
//    /api/auth/* and /api/admin/* state-changing routes (reject
//    when an Origin header is present and not allowlisted); full
//    double-submit CSRF tokens re-evaluated in the Phase P review
//    when portal forms arrive."
//
// Rule (fail-closed, cheap, no library):
//   - Safe methods (GET/HEAD/OPTIONS) pass — they must not change
//     state, and the admin SPA's AuthGate flow relies on GET /me.
//   - No Origin AND no Referer → ALLOW. This is the approved
//     policy: same-origin browser fetches send Origin; curl /
//     server-to-server scripts send neither. (Strictly requiring
//     one of them would break the existing ADMIN_TOKEN script
//     path and any non-browser API consumer — §AN.14 keeps that
//     path until its separately tracked removal.)
//   - Origin PRESENT → must be in the allowlist (CLIENT_URL,
//     ADMIN_URL, exact match after normalization; no wildcard,
//     never "*"). Referer is not consulted when Origin is present
//     (browsers omit neither for cross-site POSTs; Origin is the
//     stronger signal).
//   - Origin ABSENT but Referer PRESENT → Referer's origin must be
//     allowlisted.
// A rejected request → 403 { success:false, message } with no
// detail about WHICH check failed (no origin probing).
//
// This middleware only NARROWS: it never authenticates, never
// authorizes beyond the origin check, and never reads bodies.
// Mount centrally BEFORE the routers (see server.js).
// ------------------------------------------------------------

/** Origins allowed to make state-changing authenticated calls. */
function allowedOrigins() {
  return [
    process.env.CLIENT_URL || 'http://localhost:5173',
    process.env.ADMIN_URL || 'http://localhost:5174',
  ]
    .filter(Boolean)
    .map(normalizeOrigin);
}

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value));
    // Origin comparison ignores default ports (https://x === https://x:443).
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
  } catch {
    return null;
  }
}

function originAllowed(rawOrigin) {
  const origin = normalizeOrigin(rawOrigin);
  if (origin === null) return false;
  return allowedOrigins().includes(origin);
}

/**
 * Origin/Referer validation for state-changing authenticated
 * surfaces. Exported for tests; mounted in server.js.
 */
export function originRefererGuard(req, res, next) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;

  if (originHeader) {
    if (!originAllowed(originHeader)) {
      return res.status(403).json({
        success: false,
        message: 'Request origin is not allowed.',
      });
    }
    return next();
  }

  if (refererHeader) {
    if (!originAllowed(refererHeader)) {
      return res.status(403).json({
        success: false,
        message: 'Request origin is not allowed.',
      });
    }
    return next();
  }

  // Neither header present → the approved policy allows it
  // (non-browser API consumers / curl keep working; the browser
  // CSRF vector sends Origin on cross-site state-changing fetches).
  return next();
}
