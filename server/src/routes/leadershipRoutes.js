// ------------------------------------------------------------
// Leadership message + section routes (public + admin)
//
// Public:  GET /api/leadership-messages                 (read-only)
//          GET /api/leadership                          (section + messages, combined)
// Admin:   /api/admin/leadership-messages/*             (adminAuth-gated)
//          /api/admin/leadership-section                (adminAuth-gated)
//
// The admin routes reuse the project's adminAuth middleware
// (session-cookie auth — see middleware/sessionAuth.js).
// ------------------------------------------------------------

import { Router } from 'express';
import adminAuth from '../middleware/sessionAuth.js';
import {
  getLeadershipMessages,
  getPublicLeadership,
  listLeadershipMessages,
  getOneLeadership,
  createLeadership,
  updateLeadership,
  deleteLeadership,
  setLeadershipStatus,
  reorderLeadership,
  getLeadershipSectionSettings,
  updateLeadershipSectionSettings,
  uploadLeadershipImage,
} from '../controllers/leadershipController.js';
import { readImageUpload } from '../middleware/upload.js';

const router = Router();

// ---- Public read-only API ----
router.get('/', getLeadershipMessages);

// ---- Admin CRUD (all behind adminAuth) ----
const adminRouter = Router();
adminRouter.use(adminAuth);

// NOTE: /reorder MUST be declared before /:id so "reorder" is
// never parsed as an id.
adminRouter.get('/', listLeadershipMessages);
adminRouter.post('/', createLeadership);
adminRouter.post('/image', readImageUpload, uploadLeadershipImage);
adminRouter.patch('/reorder', reorderLeadership);
adminRouter.get('/:id', getOneLeadership);
adminRouter.put('/:id', updateLeadership);
adminRouter.patch('/:id/status', setLeadershipStatus);
adminRouter.delete('/:id', deleteLeadership);

export { adminRouter as adminLeadershipRouter };
export default router;
