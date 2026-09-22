// ------------------------------------------------------------
// News routes (Phase E)
//
// Public: read-only, PUBLISHED items only.
// Admin:  full CRUD + status transitions, adminAuth-protected.
// Mounted in server.js as  /api/news  and  /api/admin/news.
// ------------------------------------------------------------

import { Router } from 'express';
import {
  listPublicNews, getPublicNewsItem,
  listAdminNews, getAdminNewsItem,
  createAdminNewsItem, updateAdminNewsItem,
  patchAdminNewsStatus, deleteAdminNewsItem,
} from '../controllers/newsController.js';
import adminAuth from '../middleware/sessionAuth.js';

const publicRouter = Router();
publicRouter.get('/', listPublicNews);
publicRouter.get('/:slug', getPublicNewsItem);

const adminRouter = Router();
adminRouter.use(adminAuth);
adminRouter.get('/', listAdminNews);
adminRouter.get('/:id', getAdminNewsItem);
adminRouter.post('/', createAdminNewsItem);
adminRouter.put('/:id', updateAdminNewsItem);
adminRouter.patch('/:id/status', patchAdminNewsStatus);
adminRouter.delete('/:id', deleteAdminNewsItem);

export { publicRouter as newsPublicRoutes, adminRouter as newsAdminRoutes };
