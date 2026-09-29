// ------------------------------------------------------------
// Ownership-scope request middleware (Phase C.8 — SYSTEM_DESIGN
// §AN.17 C8: "Ownership-scoped API foundation (helpers + tests;
// NO portal endpoints)" — the middleware layer that CONSUMES the
// C3 §AN.6 primitives, as anticipated by the C3 note:
// "Middleware/profile tables that CONSUME these helpers remain
// future work (C4 cutover, C8, Phases F/G/H)").
//
// What this middleware DOES (§AN.6 ownership layering):
//   - after attachSessionUser (C4) has established the canonical
//     session subject, resolve the request's ownership scope via
//     C3 resolveOwnerScope and attach it as `req.ownerScope`
//     ({ userId } on success, null when ownership cannot be
//     established — C3's fail-closed denial contract)
//   - bind `req.ownsRow(row, { ownerKey })` so services can run
//     the C3 owned-row double-check in one call
//   - `requireOwnershipScope` (optional terminal form): respond a
//     GENERIC 404 when no scope exists — §AN.6 denials "never
//     confirm the existence of inaccessible records"
//
// What this middleware does NOT do:
//   - it NEVER reads a client-supplied owner id by default: §AN.6
//     — "GET /api/portal/... endpoints never accept an owner id
//     from the client body/URL as authorization input". A route
//     may OPT IN to confirm-only extraction via
//     `requestedUserIdField`; resolveOwnerScope still narrows any
//     requested id to the session identity (confirm, never widen).
//   - it does NOT authorize: coarse/fine authorization is C7
//     (requireRole/requirePermission); ownership is a separate
//     concern answered by the resolved scope + service checks
//   - it mounts NOTHING: Phase C8 ships no public endpoint —
//     portal routes (Phase N) consume this foundation
// ------------------------------------------------------------

import { resolveOwnerScope, assertOwnedRow } from '../services/ownershipScoping.js';

/** The generic ownership-denial body (§AN.6: no record disclosure). */
const NOT_FOUND_BODY = { success: false, message: 'Not found' };

/**
 * Attach the request's ownership scope.
 *
 *   app.use(attachOwnershipScope());                        // session-only scope
 *   router.get('/x', attachOwnershipScope({                 // confirm-only id
 *     requestedUserIdField: 'userId',                       // body/params/query
 *   }));
 *
 * Behavior:
 *   - no authenticated session (attachSessionUser did not attach
 *     req.adminUser) → req.ownerScope = null (fail closed)
 *   - otherwise → C3 resolveOwnerScope over the session subject
 *     (+ the opt-in requested field when configured)
 *   - `req.ownsRow(row, { ownerKey })` → C3 assertOwnedRow bound
 *     to this request's session identity (null when the row cannot
 *     PROVE ownership)
 *
 * This middleware never terminates a request and never throws.
 */
export function attachOwnershipScope({ requestedUserIdField = null } = {}) {
  return (req, _res, next) => {
    const sessionUserId = req.adminUser?.id ?? null;

    // Default: the client is NEVER asked who owns the resource —
    // the narrowest scope is the session identity itself.
    let requestedUserId;
    if (requestedUserIdField) {
      requestedUserId =
        req.body?.[requestedUserIdField]
        ?? req.params?.[requestedUserIdField]
        ?? req.query?.[requestedUserIdField]
        ?? undefined;
    }

    req.ownerScope = resolveOwnerScope({ sessionUserId, requestedUserId });
    req.ownsRow = (row, options) => assertOwnedRow(row, sessionUserId, options);
    next();
  };
}

/**
 * Terminal form for routes where an ownership scope is REQUIRED
 * before any service work: no scope → generic 404 (no disclosure
 * of WHY — §AN.6/§AN.11 semantics). Use after attachOwnershipScope.
 */
export function requireOwnershipScope(req, res, next) {
  if (!req.ownerScope) {
    return res.status(404).json(NOT_FOUND_BODY);
  }
  return next();
}
