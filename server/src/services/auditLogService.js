// ------------------------------------------------------------
// Audit log service (Phase D.3 — SYSTEM_DESIGN §AN.19)
//
// THE single shared audit seam. One contract, enforced here so
// future callers cannot accidentally violate it:
//
//   recordAdminMutation(req, { action, entity, entityId, meta })
//
//   - ACTOR: resolved SERVER-SIDE from the authenticated session
//     (req.adminUser.id = canonical users.id, C4). The service
//     signature deliberately does NOT accept actor/ip/timestamp
//     parameters — a caller cannot forge them even by mistake.
//     The deprecated ADMIN_TOKEN bearer path (§AN.14.4) has NO
//     canonical identity: user_id = NULL, actor_email = NULL,
//     and meta.bearer = true marks the consumer class.
//   - ACTION/ENTITY: controlled application-defined constants the
//     CALLER passes (each call site names its own action); the
//     service only guards shape (non-empty bounded strings).
//   - META: validated against the §AN.19 minimal-metadata rule —
//     null, or a plain JSON object whose values are primitives
//     (string/number/boolean/null). Arrays and nested objects are
//     REJECTED here (defense against accidental bulk payloads);
//     callers pass only deliberately selected scalar fields.
//   - IP: server-derived req.ip (established trust-proxy setting).
//   - AT: never accepted — the DB stamps created_at (UTC).
//
// FAILURE POLICY (§5 of the D3 implementation contract): the
// business response must never fail because bookkeeping failed —
// mirroring the established image-cleanup convention — but the
// failure is NEVER silent: it is logged loudly server-side, and
// the boolean return lets call sites/tests observe it. Callers
// invoke AFTER the business operation succeeded, so a failed
// business operation never produces an audit row (§AN.19: no
// FAILED_* events exist).
// ------------------------------------------------------------

import * as auditLogModel from '../models/AuditLog.js';

const ACTION_RE = /^[A-Z][A-Z0-9_]{2,63}$/; // STABLE_CONSTANT_NAME form
const ENTITY_RE = /^[a-z][a-z0-9_]{1,63}$/; // snake_case category

/** Meta values must be JSON primitives — no nested objects/arrays. */
function isPrimitive(v) {
  return v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/**
 * Append one privileged-write audit row. Resolves every protected
 * field from the request's server-side context. NEVER throws —
 * returns true when the row was persisted, false otherwise.
 *
 * @param {object} req authenticated express request (adminAuth ran)
 * @param {object} event { action, entity, entityId?, meta? }
 */
export async function recordAdminMutation(req, { action, entity, entityId = null, meta = null }) {
  try {
    // --- Controlled event names/categories (fail loud in dev) ---
    if (typeof action !== 'string' || !ACTION_RE.test(action)) {
      throw new Error(`auditLog: invalid action name "${action}"`);
    }
    if (typeof entity !== 'string' || !ENTITY_RE.test(entity)) {
      throw new Error(`auditLog: invalid entity category "${entity}"`);
    }

    // --- META whitelist enforcement (§AN.19) ---
    let cleanMeta = null;
    if (meta !== undefined && meta !== null) {
      if (typeof meta !== 'object' || Array.isArray(meta)) {
        throw new Error('auditLog: meta must be null or a plain object');
      }
      const entries = Object.entries(meta);
      if (entries.length > 16) {
        throw new Error('auditLog: meta exceeds 16 fields — not minimal');
      }
      for (const [k, v] of entries) {
        if (typeof k !== 'string' || k.length > 64 || !isPrimitive(v)) {
          throw new Error(`auditLog: meta field "${k}" is not a whitelisted primitive`);
        }
        if (typeof v === 'string' && v.length > 255) {
          throw new Error(`auditLog: meta field "${k}" exceeds 255 chars`);
        }
      }
      cleanMeta = meta;
    }

    // --- entity_id: string snapshot, bounded ---
    let cleanEntityId = null;
    if (entityId !== undefined && entityId !== null) {
      cleanEntityId = String(entityId);
      if (cleanEntityId.length === 0 || cleanEntityId.length > 64) {
        throw new Error('auditLog: entityId must be 1-64 chars');
      }
    }

    // --- ACTOR: server-side session identity only (C4 canonical) ---
    // Bearer-path writes (§AN.14.4) carry no canonical identity.
    const isBearer = req?.adminAuthMethod === 'bearer';
    const actorId = !isBearer && Number.isInteger(req?.adminUser?.id) ? req.adminUser.id : null;
    const actorEmail = !isBearer && typeof req?.adminUser?.email === 'string' ? req.adminUser.email : null;

    const finalMeta = cleanMeta ?? (isBearer ? { bearer: true } : null);

    await auditLogModel.insert({
      userId: actorId,
      actorEmail,
      action,
      entity,
      entityId: cleanEntityId,
      meta: finalMeta,
      ip: typeof req?.ip === 'string' ? req.ip : null,
    });
    return true;
  } catch (err) {
    // Loud, server-side only — never leaks to the client response,
    // never blocks the already-successful business operation.
    console.error('auditLog: FAILED to persist audit row:', err.message);
    return false;
  }
}
