// ------------------------------------------------------------
// Leadership message routes (public + admin)
//
// Public:  GET /api/leadership-messages        (read-only)
// Admin:   /api/admin/leadership-messages/*    (adminAuth-gated)
//
// The admin routes reuse the project's existing adminAuth
// middleware — no second authentication system is introduced.
// ------------------------------------------------------------

import { Router } from 'express';
import adminAuth from '../middleware/adminAuth.js';
import {
  getLeadershipMessages,
  listLeadershipMessages,
  createLeadership,
  updateLeadership,
  deleteLeadership,
  uploadLeadershipImage,
} from '../controllers/leadershipController.js';
import { readImageUpload } from '../middleware/upload.js';

const router = Router();

// ---- Public read-only API ----
router.get('/', getLeadershipMessages);

// ---- Admin CRUD (all behind adminAuth) ----
const adminRouter = Router();
adminRouter.use(adminAuth);

adminRouter.get('/', listLeadershipMessages);
adminRouter.post('/', createLeadership);
adminRouter.post('/image', readImageUpload, uploadLeadershipImage);
adminRouter.put('/:id', updateLeadership);
adminRouter.delete('/:id', deleteLeadership);

export { adminRouter as adminLeadershipRouter };
export default router;
