// ------------------------------------------------------------
// Admin navigation routes (Phase 3.3)
//
// Mounted at /api/admin/navigation. EVERY route requires the
// admin session (see middleware/sessionAuth.js). This module
// does not touch the public GET /api/navigation contract.
// ------------------------------------------------------------

import { Router } from 'express';
import adminAuth from '../middleware/sessionAuth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  listNavigation,
  createNavigation,
  updateNavigation,
  deleteNavigation,
} from '../controllers/adminNavigationController.js';

const router = Router();

// Phase C.7 (§AN.5): coarse permission gate ON TOP of the binary
// adminAuth gate. The seeded `admin` role inherits `*` (§AN.5 coarse
// default), so every existing admin flow is unchanged; a non-admin
// identity (valid session, no admin role) is denied 403 here.
router.use(adminAuth, requirePermission('content.write'));

router.get('/', listNavigation);
router.post('/', createNavigation);
router.put('/:id', updateNavigation);
router.delete('/:id', deleteNavigation);

export default router;
