// ------------------------------------------------------------
// Session token helpers (Admin auth phase)
//
// ZERO-dependency, stateless, HMAC-signed tokens:
//   base64url(payload).base64url(HMAC-SHA256(payload, AUTH_SECRET))
//
// Why not JWT: identical guarantees (sign/verify/expiry) with no
// new dependency; the payload format is private to this app.
// Why sessions are stateless: a logout clears the HttpOnly cookie
// and revokes the client copy; tokens expire server-side after
// SESSION_TTL_HOURS (default 12h) regardless.
//
// The secret comes ONLY from AUTH_SECRET in the environment —
// never hardcoded, never sent to any client.
// ------------------------------------------------------------

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS || 12) * 60 * 60 * 1000;

function getSecret() {
  const secret = process.env.AUTH_SECRET || '';
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET is missing or too short (minimum 32 characters)');
  }
  return secret;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function sign(payloadB64) {
  return createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');
}

/** Issue a signed session token for an admin user. */
export function createSessionToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name ?? null,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/**
 * Verify a session token. Returns the payload when valid and
 * unexpired; null otherwise. Signature comparison is timing-safe.
 */
export function verifySessionToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload?.exp !== 'number' || payload.exp < Date.now()) return null;
  return payload;
}

/** Cryptographically random secret (used by the setup script). */
export function generateAuthSecret() {
  return randomBytes(48).toString('hex');
}
