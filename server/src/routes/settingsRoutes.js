// ------------------------------------------------------------
// Site settings routes (Phase A)
//
// Public:  GET /api/settings          (effective settings)
// Admin:   GET  /api/admin/settings   (adminAuth-gated)
//          PUT  /api/admin/settings   (adminAuth-gated)
//
// The admin router reuses the project's adminAuth middleware
// (session-cookie auth — see middleware/sessionAuth.js). No new
// authentication mechanism is introduced.
// ------------------------------------------------------------

import { Router } from 'express';
import adminAuth from '../middleware/sessionAuth.js';
import {
  getPublicSettings,
  getAdminSettings,
  putAdminSettings,
} from '../controllers/settingsController.js';

const router = Router();
router.get('/', getPublicSettings);

const adminRouter = Router();
adminRouter.use(adminAuth);
adminRouter.get('/', getAdminSettings);
adminRouter.put('/', putAdminSettings);

export { adminRouter as adminSettingsRouter };
export default router;
