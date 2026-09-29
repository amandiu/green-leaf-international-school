// ------------------------------------------------------------
// Admin user management controllers (Phase C.6)
//
// Mounted under /api/admin/users (adminAuth-gated router). The
// per-operation admin-role authorization check lives in
// adminUserService (§AN.17 C6 row: "admin-only"; the full RBAC
// framework remains C7). Response contract: canonical
// { success, message?, data } — safe projections only; password
// hashes, reset-token hashes and lifecycle stamps never appear.
//
// Reset issuance returns the RAW token ONCE to the authenticated
// admin (§AN.8 ADMIN-ISSUED until email exists). It is never
// logged and never appears in list/other responses.
// ------------------------------------------------------------

import {
  listUsers,
  adminCreateUser,
  setUserActive,
  adminAssignRole,
  adminIssueResetToken,
} from '../services/adminUserService.js';
import { recordAdminMutation } from '../services/auditLogService.js';
import { badRequest, HttpError } from '../utils/errors.js';

/** Map service errors to responses; anything else → safe 500. */
function sendServiceError(res, err, fallback) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  console.error(fallback.log, err.message);
  return res.status(500).json({ success: false, message: fallback.message });
}

/** The session's canonical subject (C4: sub = users.id). */
function sessionUserId(req) {
  return req.adminUser?.id;
}

/** Parse a /:id path segment as a canonical user id. */
function parseIdParam(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0 || id > 4294967295) {
    throw badRequest('Invalid user id');
  }
  return id;
}

/**
 * GET /api/admin/users — full canonical identity list (safe).
 */
export async function getAdminUsers(req, res) {
  try {
    const data = await listUsers(sessionUserId(req));
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, { log: 'AdminUsers: list failed:', message: 'Failed to load users' });
  }
}

/**
 * POST /api/admin/users — create a canonical identity (+ roles).
 */
export async function postAdminUsers(req, res) {
  try {
    const { user } = await adminCreateUser(sessionUserId(req), req.body);
    // D3 (§AN.19): audit the SUCCESSFUL privileged write. meta is a
    // deliberate whitelist — role CODES only, never the password.
    await recordAdminMutation(req, {
      action: 'USER_CREATE',
      entity: 'user',
      entityId: user?.id,
      meta: { roles: (user?.roles ?? []).join(',') },
    });
    res.status(201).json({ success: true, data: { user } });
  } catch (err) {
    return sendServiceError(res, err, { log: 'AdminUsers: create failed:', message: 'Failed to create user' });
  }
}

/**
 * PUT /api/admin/users/:id/status — is_active lifecycle
 * (ACTIVE/INACTIVE only — §AN.10; no second lifecycle state).
 */
export async function putAdminUserStatus(req, res) {
  try {
    if (typeof req.body?.isActive !== 'boolean') {
      throw badRequest('isActive must be a boolean');
    }
    await setUserActive(sessionUserId(req), parseIdParam(req), req.body.isActive);
    // D3: status transition is the minimal safe metadata.
    await recordAdminMutation(req, {
      action: 'USER_STATUS_SET',
      entity: 'user',
      entityId: req.params.id,
      meta: { to: req.body.isActive ? 'ACTIVE' : 'INACTIVE' },
    });
    res.status(200).json({ success: true, message: req.body.isActive ? 'User activated' : 'User deactivated' });
  } catch (err) {
    return sendServiceError(res, err, { log: 'AdminUsers: status change failed:', message: 'Failed to change user status' });
  }
}

/**
 * POST /api/admin/users/:id/roles — assign a catalog role
 * (makePrimary triggers the C2 primary-swap transaction).
 */
export async function postAdminUserRole(req, res) {
  try {
    const { user } = await adminAssignRole(sessionUserId(req), parseIdParam(req), req.body);
    // D3: assigned role code + primary flag — the C2 service already
    // validated the role against the catalog.
    await recordAdminMutation(req, {
      action: 'USER_ROLE_ASSIGN',
      entity: 'user',
      entityId: user?.id ?? req.params.id,
      meta: { role: req.body?.role, makePrimary: req.body?.makePrimary === true },
    });
    res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    return sendServiceError(res, err, { log: 'AdminUsers: role assignment failed:', message: 'Failed to assign role' });
  }
}

/**
 * POST /api/admin/users/:id/reset-token — ADMIN-ISSUED reset
 * (C5 §AN.8 completion). Raw token returned exactly once.
 */
export async function postAdminUserResetToken(req, res) {
  try {
    const data = await adminIssueResetToken(sessionUserId(req), parseIdParam(req));
    // D3: the ISSUE is audited; the raw token itself is NEVER stored,
    // logged or echoed into meta (§AN.19 forbidden data — §AN.8).
    await recordAdminMutation(req, {
      action: 'USER_RESET_TOKEN_ISSUE',
      entity: 'user',
      entityId: data?.user?.id ?? req.params.id,
      meta: null,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, { log: 'AdminUsers: reset issuance failed:', message: 'Failed to issue reset token' });
  }
}
