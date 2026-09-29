// ------------------------------------------------------------
// Admin auth routes (Admin auth phase)
//
// Mounted at /api/auth:
//   POST /api/auth/login   → { email, password } + Set-Cookie
//   GET  /api/auth/me      → current admin profile
//   POST /api/auth/logout  → clear session cookie
//
//   Phase C.5 (SYSTEM_DESIGN §AN.8/§AN.11/§AN.12):
//   POST /api/auth/change-password  → authenticated password change
//   POST /api/auth/forgot-password  → admin-issued reset token mechanics
//   POST /api/auth/reset-password   → consume a reset token
//
// Login is rate-limited harder than the global API limiter to
// blunt brute-force attempts (10/10min — UNCHANGED in C5).
// /me and /logout are behind the session middleware (req.adminUser
// required for /me). The Origin/Referer CSRF guard covers ALL
// state-changing routes here (mounted once in server.js).
// ------------------------------------------------------------

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { postLogin, getMe, postLogout } from '../controllers/authController.js';
import {
  postChangePassword, postForgotPassword, postResetPassword,
} from '../controllers/passwordController.js';
import { attachSessionUser, adminAuth } from '../middleware/sessionAuth.js';
import {
  forgotPasswordLimiter,
  forgotPasswordEmailLimiter,
  resetPasswordLimiter,
} from '../middleware/passwordFlowLimiters.js';

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

// ---- Phase C.5: password change + reset (§AN.8) ----
// change-password: global limiter ONLY (§AN.12) — it sits behind
// the authenticated session like /me; the adminAuth gate mirrors
// the /me pattern exactly.
router.post('/change-password', attachSessionUser, adminAuth, postChangePassword);

// forgot-password: DOUBLE bucket (IP 5/15min + per-email 5/15min).
// Order matters — the IP limiter runs first, then the email bucket.
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  forgotPasswordEmailLimiter,
  postForgotPassword,
);

// reset-password: 10/15min per IP (§AN.12).
router.post('/reset-password', resetPasswordLimiter, postResetPassword);

export default router;
