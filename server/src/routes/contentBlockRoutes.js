// ------------------------------------------------------------
// Content block routes (Phase D)
//
// Public:  GET /api/content/blocks               (effective reusable blocks)
// Admin:   GET    /api/admin/content/blocks              (adminAuth)
//          PUT    /api/admin/content/blocks/:key         (adminAuth)
//          PATCH  /api/admin/content/blocks/:key/active  (adminAuth)
//          DELETE /api/admin/content/blocks/:key         (adminAuth)
//
// The admin router reuses the project's adminAuth middleware
// (session-cookie auth — see middleware/sessionAuth.js). No new
// authentication mechanism is introduced. Only known block keys
// are served/written — no generic CRUD surface for arbitrary
// content.
// ------------------------------------------------------------

import { Router } from 'express';
import adminAuth from '../middleware/sessionAuth.js';
import {
  getPublicBlocks,
  getAdminBlocksController,
  putBlock,
  patchBlockActive,
  deleteBlockController,
} from '../controllers/contentBlockController.js';

const router = Router();
router.get('/blocks', getPublicBlocks);

const adminRouter = Router();
adminRouter.use(adminAuth);
adminRouter.get('/blocks', getAdminBlocksController);
adminRouter.put('/blocks/:key', putBlock);
adminRouter.patch('/blocks/:key/active', patchBlockActive);
adminRouter.delete('/blocks/:key', deleteBlockController);

export { adminRouter as adminContentRouter };
export default router;
