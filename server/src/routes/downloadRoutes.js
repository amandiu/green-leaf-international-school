// ------------------------------------------------------------
// Downloads routes (Phase B.6)
//
// Public:  GET /api/downloads                (PUBLISHED items only)
//          GET /api/downloads/categories     (categories with published items)
//          GET /api/downloads/:id/file       (secure DB-mediated file serving)
// Admin:   GET    /api/admin/downloads              (adminAuth)
//          POST   /api/admin/downloads              (adminAuth)
//          GET    /api/admin/downloads/:id          (adminAuth)
//          PUT    /api/admin/downloads/:id          (adminAuth)
//          PATCH  /api/admin/downloads/:id/status   (adminAuth)
//          DELETE /api/admin/downloads/:id          (adminAuth)
//
// Document uploads reuse the shared upload architecture:
//   POST /api/admin/uploads/document
// Same adminAuth gate + a DEDICATED rate limiter (mirrors the
// image upload limiter), same raw-body streaming middleware, but
// the DOCUMENT branch of the pipeline (PDF allowlist + magic
// bytes, no image processing). The image endpoint is untouched.
//
// File serving is DB-mediated: the requested id must reference a
// PUBLISHED row and the path comes from the stored managed
// reference — never from URL input. There is deliberately NO
// /api/downloads/files/:filename route (that shape would allow
// filesystem probing by filename).
// ------------------------------------------------------------

import { Router } from 'express';
import adminAuth from '../middleware/sessionAuth.js';
import {
  listPublicDownloads,
  listPublicDownloadCategories,
  downloadFile,
  listAdminDownloads,
  getAdminDownload,
  createAdminDownload,
  updateAdminDownload,
  patchAdminDownloadStatus,
  deleteAdminDownload,
} from '../controllers/downloadController.js';

const router = Router();

// ---- Public read-only API (PUBLISHED only) ----
router.get('/', listPublicDownloads);
router.get('/categories', listPublicDownloadCategories);
router.get('/:id/file', downloadFile);

// ---- Admin CRUD (all behind adminAuth) ----
const adminRouter = Router();
adminRouter.use(adminAuth);

adminRouter.get('/', listAdminDownloads);
adminRouter.post('/', createAdminDownload);
adminRouter.get('/:id', getAdminDownload);
adminRouter.put('/:id', updateAdminDownload);
adminRouter.patch('/:id/status', patchAdminDownloadStatus);
adminRouter.delete('/:id', deleteAdminDownload);

export { adminRouter as adminDownloadRouter };
export default router;
