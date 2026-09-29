// ------------------------------------------------------------
// Gallery routes (Phase B.2)
//
// Public:  GET /api/gallery              (PUBLISHED items only)
//          GET /api/gallery/categories   (categories with published items)
// Admin:   POST   /api/admin/gallery             (adminAuth)
//          GET    /api/admin/gallery             (adminAuth)
//          GET    /api/admin/gallery/:id         (adminAuth)
//          PUT    /api/admin/gallery/:id         (adminAuth)
//          PATCH  /api/admin/gallery/:id/status  (adminAuth)
//          DELETE /api/admin/gallery/:id         (adminAuth)
//
// The admin router reuses the project's adminAuth middleware
// (session-cookie auth — see middleware/sessionAuth.js). No new
// authentication mechanism is introduced.
//
// Image uploads are NOT re-implemented here: the admin form uses
// the EXISTING centralized endpoint (POST /api/admin/uploads/image
// with its dedicated rate limiter + hardened pipeline) and sends
// the returned safe path in the gallery payload. No new upload
// surface, no new limiter, no duplicated security code.
// ------------------------------------------------------------

import { Router } from 'express';
import adminAuth from '../middleware/sessionAuth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  listPublicGallery,
  listPublicGalleryCategories,
  listAdminGallery,
  getOneGalleryItem,
  createGallery,
  updateGallery,
  patchGalleryStatus,
  deleteGallery,
} from '../controllers/galleryController.js';

const router = Router();

// ---- Public read-only API (PUBLISHED only) ----
router.get('/', listPublicGallery);
router.get('/categories', listPublicGalleryCategories);

// ---- Admin CRUD (all behind adminAuth) ----
const adminRouter = Router();
adminRouter.use(adminAuth, requirePermission('content.write'));

adminRouter.get('/', listAdminGallery);
adminRouter.post('/', createGallery);
adminRouter.get('/:id', getOneGalleryItem);
adminRouter.put('/:id', updateGallery);
adminRouter.patch('/:id/status', patchGalleryStatus);
adminRouter.delete('/:id', deleteGallery);

export { adminRouter as adminGalleryRouter };
export default router;
