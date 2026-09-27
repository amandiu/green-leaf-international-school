// ------------------------------------------------------------
// Page section routes (Phase B + B.3)
//
// Public:  GET /api/pages/:page                  (effective page content)
// Admin:   GET /api/admin/pages/:page            (adminAuth-gated)
//          PUT /api/admin/pages/:page/sections/:key
//
// Phase B.3: the fixed '/home' routes were generalized to any
// page with a validated section schema ('home' | 'about' |
// 'academics' | 'campus'). Controllers 404 unknown pages/section
// keys — there is NO generic CRUD surface for arbitrary
// pages/sections.
//
// The admin router reuses the project's adminAuth middleware
// (session-cookie auth — see middleware/sessionAuth.js). No new
// authentication mechanism is introduced.
// ------------------------------------------------------------

import { Router } from 'express';
import adminAuth from '../middleware/sessionAuth.js';
import {
  getPublicPage,
  getAdminPage,
  putPageSection,
} from '../controllers/pageSectionController.js';

const router = Router();
router.get('/:page', getPublicPage);

const adminRouter = Router();
adminRouter.use(adminAuth);
adminRouter.get('/:page', getAdminPage);
adminRouter.put('/:page/sections/:key', putPageSection);

export { adminRouter as adminPageSectionRouter };
export default router;
