// ------------------------------------------------------------
// Admin auth routes (Admin auth phase)
//
// Mounted at /api/auth:
//   POST /api/auth/login   → { email, password } + Set-Cookie
//   GET  /api/auth/me      → current admin profile
//   POST /api/auth/logout  → clear session cookie
//
// Login is rate-limited harder than the global API limiter to
// blunt brute-force attempts. /me and /logout are behind the
// session middleware (req.adminUser required for /me).
// ------------------------------------------------------------

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { postLogin, getMe, postLogout } from '../controllers/authController.js';
import { attachSessionUser, adminAuth } from '../middleware/sessionAuth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,                  // 10 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
});

router.post('/login', loginLimiter, postLogin);
router.get('/me', attachSessionUser, adminAuth, getMe);
router.post('/logout', attachSessionUser, postLogout);

export default router;
