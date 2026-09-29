// ------------------------------------------------------------
// Password-flow rate limiters (Phase C.5 — SYSTEM_DESIGN §AN.12)
//
// Exact approved values:
//   POST /api/auth/forgot-password   5 / 15 min  IP + per-email
//                                    (DOUBLE bucket — §AN.12)
//   POST /api/auth/reset-password    10 / 15 min IP
//   change-password, me, logout      global limiter ONLY
//                                    (600/15min — server.js)
//
// The LOGIN limiter (10/10min, authRoutes.js) is NOT touched and
// NOT reused here — §AN.12 assigns reset endpoints their own
// buckets. Messages are generic: throttling must not reveal
// whether an account exists. draft-7 standard headers add
// Retry-After so clients can show a meaningful wait.
// ------------------------------------------------------------

import rateLimit from 'express-rate-limit';
import { validateEmail } from '../validators/identityValidation.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Generic throttle message — identical for every throttled shape. */
const GENERIC_THROTTLE = 'Too many requests. Try again later.';

/** Per-email memory bucket (5 / 15 min), keyed by normalized email. */
const emailBuckets = new Map(); // email → { count, startedAt }

function emailBucketTake(email) {
  const now = Date.now();
  const entry = emailBuckets.get(email);
  if (!entry || now - entry.startedAt >= FIFTEEN_MINUTES) {
    emailBuckets.set(email, { count: 1, startedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  if (entry.count > 5) {
    const elapsed = now - entry.startedAt;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((FIFTEEN_MINUTES - elapsed) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * SECOND bucket of the double-bucket requirement: 5 requests per
 * 15 minutes PER EMAIL. Runs after the IP limiter. Fail-closed:
 * an unparseable email is a 400 from the controller, not a
 * limiter bypass — malformed email keys are throttled like any
 * other value to keep this middleware side-effect-free.
 */
export function forgotPasswordEmailLimiter(req, res, next) {
  let emailKey = '__unparsed__';
  if (typeof req.body?.email === 'string' && req.body.email.trim() !== '') {
    try {
      emailKey = validateEmail(req.body.email);
    } catch {
      emailKey = '__unparsed__';
    }
  }

  const { allowed, retryAfterSeconds } = emailBucketTake(emailKey);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ success: false, message: GENERIC_THROTTLE });
  }
  return next();
}

/** Bucket 1: 5 requests / 15 min per IP (§AN.12). */
export const forgotPasswordLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: GENERIC_THROTTLE },
});

/** 10 requests / 15 min per IP (§AN.12). */
export const resetPasswordLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: GENERIC_THROTTLE },
});
