// ------------------------------------------------------------
// Page section routes (Phase B)
//
// Public:  GET /api/pages/home                   (effective home content)
// Admin:   GET /api/admin/pages/home             (adminAuth-gated)
//          PUT /api/admin/pages/home/sections/:key
//
// The admin router reuses the project's adminAuth middleware
// (session-cookie auth — see middleware/sessionAuth.js). No new
// authentication mechanism is introduced. Only the validated
// 'home' page + known section keys are served/written — no
// generic CRUD surface for arbitrary pages/sections.
// ------------------------------------------------------------

import { Router } from 'express';
import adminAuth from '../middleware/sessionAuth.js';
import {
  getPublicHome,
  getAdminHome,
  putHomeSection,
} from '../controllers/pageSectionController.js';

const router = Router();
router.get('/home', getPublicHome);

const adminRouter = Router();
adminRouter.use(adminAuth);
adminRouter.get('/home', getAdminHome);
adminRouter.put('/home/sections/:key', putHomeSection);

export { adminRouter as adminPageSectionRouter };
export default router;
