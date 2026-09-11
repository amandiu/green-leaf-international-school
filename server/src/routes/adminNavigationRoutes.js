// ------------------------------------------------------------
// Admin navigation routes (Phase 3.3)
//
// Mounted at /api/admin/navigation. EVERY route requires the
// admin credentials (see middleware/adminAuth.js). This module
// does not touch the public GET /api/navigation contract.
// ------------------------------------------------------------

import { Router } from 'express';
import adminAuth from '../middleware/adminAuth.js';
import {
  listNavigation,
  createNavigation,
  updateNavigation,
  deleteNavigation,
} from '../controllers/adminNavigationController.js';

const router = Router();

router.use(adminAuth);

router.get('/', listNavigation);
router.post('/', createNavigation);
router.put('/:id', updateNavigation);
router.delete('/:id', deleteNavigation);

export default router;
