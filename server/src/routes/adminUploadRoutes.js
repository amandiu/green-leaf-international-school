// ------------------------------------------------------------
// Centralized admin image upload routes (shared image-upload phase)
//
//   POST /api/admin/uploads/image
//
// Auth: the SAME adminAuth session gate as every /api/admin/*
// route (middleware/sessionAuth.js) — no new auth mechanism, no
// public upload access, no CORS changes.
//
// Rate limiting: a DEDICATED limiter for uploads only (abuse
// protection for expensive image processing). It does not share
// buckets with the global API limiter or touch the login limiter.
//
// Order matters: adminAuth runs BEFORE the body is read, so
// unauthenticated visitors are rejected (401) before any bytes
// are buffered.
// ------------------------------------------------------------

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import adminAuth from '../middleware/sessionAuth.js';
import { readImageUpload } from '../middleware/upload.js';
import { uploadAdminImage } from '../controllers/uploadsController.js';

const router = Router();

/**
 * Dedicated upload limiter: 30 uploads / 15 min per IP. Generous
 * for real admin work (a homepage refresh is well under 30) but
 * tight enough to stop automated abuse of the image pipeline.
 * Standard express-rate-limit behavior: throttled requests get 429.
 */
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many uploads. Please try again later.' },
});

router.use(adminAuth);
router.post('/image', uploadRateLimit, readImageUpload, uploadAdminImage);

export default router;
