// ------------------------------------------------------------
// Admin user management routes (Phase C.6 — SYSTEM_DESIGN §AN.17)
//
// Mounted at /api/admin/users (server.js):
//   GET    /                     → list canonical identities (safe projection)
//   POST   /                     → create a canonical identity (+ roles)
//   PUT    /:id/status           → is_active lifecycle (ACTIVE/INACTIVE)
//   POST   /:id/roles            → assign a catalog role (makePrimary swap)
//   POST   /:id/reset-token      → ADMIN-ISSUED one-time reset token (C5 §AN.8)
//
// Gate: the router-level adminAuth (binary, fail-closed) — the
// SAME gate as every /api/admin/* router. The per-operation
// admin-role authorization check lives in adminUserService
// ("admin-only" per the C6 row); full requireRole/requirePermission
// RBAC stays C7 (NOT implemented here — §AN.5 permission
// enforcement boundary). Origin/Referer CSRF guard covers all
// state-changing methods (mounted once in server.js).
// ------------------------------------------------------------

import { Router } from 'express';
import adminAuth from '../middleware/sessionAuth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  getAdminUsers,
  postAdminUsers,
  putAdminUserStatus,
  postAdminUserRole,
  postAdminUserResetToken,
} from '../controllers/adminUserController.js';

const router = Router();

// Phase C.7 (§AN.5): the coarse users.manage gate joins adminAuth.
// The per-operation LIVE admin-role check in adminUserService is
// PRESERVED underneath (the C6 authorization contract — the C7
// middleware authorizes the surface, the service still re-resolves
// identity per operation). admin → * passes; a non-admin identity
// with a valid session is denied 403 here.
router.use(adminAuth, requirePermission('users.manage'));

router.get('/', getAdminUsers);
router.post('/', postAdminUsers);
router.put('/:id/status', putAdminUserStatus);
router.post('/:id/roles', postAdminUserRole);
router.post('/:id/reset-token', postAdminUserResetToken);

export default router;
