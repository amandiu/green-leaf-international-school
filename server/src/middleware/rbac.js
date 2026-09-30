// ------------------------------------------------------------
// RBAC authorization middleware (Phase C.7 — SYSTEM_DESIGN §AN.5)
//
// The canonical, approved evolution of the C2–C6 authorization
// model. ONE system — no second permission mechanism:
//
//   requireRole(...codes)     coarse gate: the caller's LIVE role
//                             codes include one of `codes`.
//   requirePermission(...keys) fine gate: the caller's LIVE roles
//                             map to permission keys via
//                             role_permissions (30s TTL cache,
//                             identityService.getRolePermissions).
//                             Coarse default: role `admin` → `*`.
//
// §AN.5 exact behavior, implemented:
//   - role codes + permission keys are validated against the code
//     whitelists (§AN.4 catalog / §AN.5 PERMISSION_KEYS) — unknown
//     keys FAIL CLOSED (400 on registration; a typo can never
//     silently become a permission)
//   - LIVE resolution every request: canonical users row + active
//     user_roles membership via UserRole.findRoleMembershipByUserId
//     — stale session claims (roles changed, identity deactivated
//     after login) can NEVER authorize (the C6 precedent)
//   - fail-closed: unknown id / inactive identity / no membership /
//     DB error → 403 after authentication (401 semantics preserved
//     BEFORE the gate: attachSessionUser + adminAuth run first)
//   - ownership stays a SERVICE concern (§AN.6 layering): these
//     gates authorize, they never fetch or scope resources
//
// §AN.11 denial semantics: 401 = no/expired/invalid session (the
// adminAuth gate keeps that), 403 = authenticated but not
// permitted — introduced HERE, generic message, no permission,
// role or identity detail leakage.
//
// §AN.5 compatibility rule: adminAuth stays the router-level gate
// (any authenticated identity passes the ROUTER; the per-operation
// gates below decide permission) so every existing admin router
// keeps working — C6's live admin-role service check remains as
// the /api/admin/users per-operation authorization, now mounted
// UNDER the requirePermission('users.manage') coarse gate.
// ------------------------------------------------------------

import { PERMISSION_KEYS, ROLE_CODES } from '../validators/identityValidation.js';
import { getRolePermissions } from '../services/identityService.js';
import { findSafeById } from '../models/User.js';
import { findRoleMembershipByUserId } from '../models/UserRole.js';
import { parseUserId } from '../services/ownershipScoping.js';

/** Generic denial — never reveals which permission/role failed. */
const DENIED = 'You do not have permission to perform this action.';

/** Validate gate arguments against the code whitelists (fail closed). */
function assertKnownCodes(kind, values) {
  const whitelist = kind === 'role' ? ROLE_CODES : PERMISSION_KEYS;
  for (const value of values) {
    if (!whitelist.includes(value)) {
      // Developer error at registration time — must be loud, not a
      // silent never-matching gate.
      throw new Error(`Unknown ${kind} code "${value}" — not in the approved ${kind === 'role' ? '§AN.4 catalog' : '§AN.5 whitelist'}`);
    }
  }
}

/**
 * Resolve the caller's LIVE authorization context:
 *   - canonical users row must exist and be ACTIVE (§AN.10)
 *   - roles = ACTIVE user_roles membership (C2 junction)
 *   - allowed permission keys = union of role_permissions per role
 *     (through the §AN.5 short-TTL cache) + `*` when a role is the
 *     seeded `admin` super-role (§AN.5 coarse default)
 * Any failure → { ok: false } (caller denies generically).
 */
async function resolveAuthorizationContext(sessionUserId) {
  const id = parseUserId(sessionUserId);
  if (id === null) return { ok: false };
  const identity = await findSafeById(id);
  if (!identity || identity.is_active !== true) return { ok: false };
  const membership = await findRoleMembershipByUserId(id);
  if (membership.length === 0) return { ok: false, roles: [], keys: new Set() };

  const roles = membership.map((r) => r.code);
  const keys = new Set();
  for (const role of membership) {
    if (role.code === 'admin') {
      keys.add('*'); // §AN.5 coarse default — admin inherits everything
      continue;
    }
    for (const key of await getRolePermissions(role.id)) {
      keys.add(key);
    }
  }
  return { ok: true, roles, keys };
}

/** True when the context grants ANY of the required permission keys. */
function hasAnyKey(context, requiredKeys) {
  if (context.keys.has('*')) return true;
  return requiredKeys.some((k) => context.keys.has(k));
}

/**
 * Coarse gate (§AN.5): requireRole('admin') etc. Requires an
 * authenticated session (attachSessionUser must have run); the
 * session subject must currently hold one of the given roles.
 */
export function requireRole(...codes) {
  assertKnownCodes('role', codes);
  return async (req, res, next) => {
    try {
      if (req.adminAuthMethod === 'bearer') {
        // Deprecated ADMIN_TOKEN script path (§AN.14.4): the request
        // already presented the server-side secret. It authorizes as
        // a legacy script consumer — no canonical identity exists to
        // resolve, and no client input can forge this tag.
        return next();
      }
      if (!req.adminUser?.id) {
        // attachSessionUser/adminAuth did not run — misconfiguration.
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }
      const context = await resolveAuthorizationContext(req.adminUser.id);
      if (!context.ok || !codes.some((c) => context.roles.includes(c))) {
        return res.status(403).json({ success: false, message: DENIED });
      }
      req.authz = context; // downstream ownership checks reuse this
      return next();
    } catch (err) {
      console.error('Authz: requireRole failed:', err.message);
      return res.status(403).json({ success: false, message: DENIED });
    }
  };
}

/**
 * Fine gate (§AN.5): requirePermission('users.manage') etc.
 * Requires an authenticated session; the caller's LIVE roles must
 * map to at least one required permission key (admin → * wildcard).
 */
export function requirePermission(...keys) {
  assertKnownCodes('permission', keys);
  return async (req, res, next) => {
    try {
      if (req.adminAuthMethod === 'bearer') {
        // Deprecated ADMIN_TOKEN script path (§AN.14.4) — see requireRole.
        return next();
      }
      if (!req.adminUser?.id) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }
      const context = await resolveAuthorizationContext(req.adminUser.id);
      if (!context.ok || !hasAnyKey(context, keys)) {
        return res.status(403).json({ success: false, message: DENIED });
      }
      req.authz = context;
      return next();
    } catch (err) {
      console.error('Authz: requirePermission failed:', err.message);
      return res.status(403).json({ success: false, message: DENIED });
    }
  };
}
