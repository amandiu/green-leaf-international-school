// ------------------------------------------------------------
// Contact message routes (Phase B.1)
//
// Public:  POST /api/contact                (submit; read-only API
//                                           for messages does NOT
//                                           exist — data is private)
// Admin:   GET    /api/admin/contact-messages            (adminAuth)
//          GET    /api/admin/contact-messages/:id        (adminAuth)
//          PATCH  /api/admin/contact-messages/:id/status (adminAuth)
//          DELETE /api/admin/contact-messages/:id        (adminAuth)
//
// The admin router reuses the project's adminAuth middleware
// (session-cookie auth — see middleware/sessionAuth.js). No new
// authentication mechanism is introduced.
//
// Rate limiting: the GLOBAL /api/* limiter (600 req / 15 min per
// admin-identity-or-IP) already covers this public endpoint — no
// redundant second limiter is added (verified in server.js).
// ------------------------------------------------------------

import { Router } from 'express';
import adminAuth from '../middleware/sessionAuth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  postContact,
  listContactMessages,
  getOneContactMessage,
  patchContactMessageStatus,
  deleteContactMessageController,
} from '../controllers/contactController.js';

const router = Router();

// ---- Public submit (the ONLY public contact endpoint) ----
router.post('/', postContact);

// ---- Admin inbox (adminAuth + C7 permission gates) ----
const adminRouter = Router();
adminRouter.use(adminAuth);
// C7 split (§AN.5): reading the inbox is content.read; mutating
// (status/delete) is content.write. (admin → * passes everything;
// existing admin behavior is unchanged.)

adminRouter.get('/', requirePermission('content.read'), listContactMessages);
adminRouter.get('/:id', requirePermission('content.read'), getOneContactMessage);
adminRouter.patch('/:id/status', requirePermission('content.write'), patchContactMessageStatus);
adminRouter.delete('/:id', requirePermission('content.write'), deleteContactMessageController);

export { adminRouter as adminContactRouter };
export default router;
