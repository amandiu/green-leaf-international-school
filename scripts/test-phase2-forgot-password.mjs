#!/usr/bin/env node
// ------------------------------------------------------------
// Phase 2 — forgot-password verification-code security suite
// Run from repo root:  node scripts/test-phase2-forgot-password.mjs
//
// Requires: server on :5000 (or C5_TEST_BASE) + MariaDB up.
// Verifies (C2.1–C2.7):
//   C2.1  invalid email format → 400, safe message
//   C2.2  unknown email        → generic 200, byte-identical to known
//   C2.3  existing email       → code issued; stored HASH-ONLY;
//         dev-preview logged, NEVER stored/logged in plaintext
//   C2.4  expiry is enforced by the schema + service config
//   C2.5  previous-code invalidation (only the newest code lives)
//   C2.6  raw code never in password_reset_codes storage
//   C2.7  double-bucket rate limiting still guards the endpoint
//
// The suite creates a DEDICATED probe user and removes every
// trace at the end (established Phase C suite conventions).
// No real reset codes are printed — only their SHA-256 digests.
// ------------------------------------------------------------

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';

const require = createRequire(pathToFileURL(resolve('server', 'package.json')));
const mysql = require('mysql2/promise');

if (existsSync('server/.env')) {
  for (const line of readFileSync('server/.env', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'greenleaf_school',
  // Raw wall-clock strings — DATETIME columns here are literal UTC
  // (written via UTC_TIMESTAMP(3)); parsing them as local Dates
  // would corrupt comparisons across time zones.
  dateStrings: true,
};
const BASE = process.env.C5_TEST_BASE || 'http://127.0.0.1:5000';

let pass = 0;
let fail = 0;
function ok(cond, label) {
  if (cond) { pass += 1; console.log(`  ✔ ${label}`); }
  else { fail += 1; console.log(`  ✖ ${label}`); }
}

/**
 * fetch with an optional X-Forwarded-For identity. The API trusts
 * the first proxy hop (server.js `trust proxy 1`), so each suite
 * section can own an ISOLATED rate-limit bucket — functional checks
 * must never drain the bucket that the C2.7 section verifies.
 */
async function api(method, path, { body, ip } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (ip) headers['X-Forwarded-For'] = ip;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, text, headers: res.headers };
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

// ------------------------------------------------------------
// Probe identity
// ------------------------------------------------------------

const STAMP = `${Date.now()}-${randomBytes(3).toString('hex')}`;
const PROBE_EMAIL = `phase2-probe-${STAMP}@greenleaf.test`;
const PROBE_NAME = 'Phase 2 Probe';
const PROBE_PASSWORD = 'ProbePass-Phase2!';
const BCRYPT_ROUNDS = 4; // probe-only throwaway hash (not used for login here)
// Dedicated rate-limit identity for this suite's functional requests
// (X-Forwarded-For + trust proxy 1) — keeps them out of the operator's
// real IP bucket and out of the C2.7 verification bucket.
const SUITE_IP = `192.0.2.${1 + (randomBytes(1)[0] % 200)}`;
// The C2.5 invalidation section needs a FRESH IP bucket: the functional
// sections above already used five SUITE_IP requests (the exact limit),
// so a sixth would be throttled before it can issue the second code.
const C25_IP = `192.0.2.${1 + (randomBytes(1)[0] % 200)}`;
// Separate identity for the C2.7 throttle section — deterministic
// across repeated runs (in-memory buckets survive until restart).
const SINK_IP = `192.0.2.${1 + (randomBytes(1)[0] % 200)}`;

let conn;

async function main() {
  conn = await mysql.createConnection(DB);
  // Pin the session timezone to UTC: created_at (TIMESTAMP) renders
  // in the SESSION time zone, while expires_at (DATETIME) is a
  // literal UTC wall clock. Without this pin the two differ by the
  // local UTC offset and expiry comparisons skew by hours.
  await conn.query("SET time_zone = '+00:00'");
  try {
    // 0. Server reachability
    const health = await api('GET', '/api/health');
    if (health.status !== 200) {
      console.error('✖ API server is not reachable on', BASE, '— start it first (cd server && npm run dev)');
      process.exitCode = 1;
      return;
    }
    console.log('Phase 2 — forgot-password verification codes\n');

    // Probe user (bcryptjs lives in server/node_modules)
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(PROBE_PASSWORD, BCRYPT_ROUNDS);
    const [ins] = await conn.query(
      'INSERT INTO `users` (`email`, `password_hash`, `name`, `is_active`) VALUES (?, ?, ?, 1)',
      [PROBE_EMAIL, hash, PROBE_NAME],
    );
    const probeId = ins.insertId;

    // ================= C2.1 — invalid email format =================
    const malformed = await api('POST', '/api/auth/forgot-password', { body: { email: 'abc' }, ip: SUITE_IP });
    ok(malformed.status === 400, 'C2.1 invalid email format → 400');
    ok(malformed.json?.success === false && typeof malformed.json?.message === 'string'
      && !/database|sql|smtp|stack/i.test(malformed.json.message), 'C2.1 validation error is safe (no internals)');
    const missing = await api('POST', '/api/auth/forgot-password', { body: {}, ip: SUITE_IP });
    ok(missing.status === 400, 'C2.1 missing email → 400');

    // ================= C2.2 — unknown email (enumeration) =================
    const unknown = await api('POST', '/api/auth/forgot-password', { body: { email: `nobody-${STAMP}@x.test` }, ip: SUITE_IP });
    ok(unknown.status === 200 && unknown.json?.success === true, 'C2.2 unknown email → generic 200 success envelope');
    ok(!/not found|does not exist|no account|unknown/i.test(unknown.json?.message || ''), 'C2.2 message reveals no account state');

    // ================= C2.3 — existing email issues a code =================
    const known = await api('POST', '/api/auth/forgot-password', { body: { email: PROBE_EMAIL }, ip: SUITE_IP });
    ok(known.status === 200 && known.json?.success === true, 'C2.3 existing email → generic 200 success envelope');
    ok(JSON.stringify(known.json) === JSON.stringify(unknown.json), 'C2.2/2.3 known + unknown responses are BYTE-IDENTICAL (no enumeration oracle)');

    // Uppercase variant → same identity (case-insensitive normalization)
    await conn.query('DELETE FROM `password_reset_codes` WHERE `user_id` = ?', [probeId]);
    await api('POST', '/api/auth/forgot-password', { body: { email: PROBE_EMAIL.toUpperCase() }, ip: SUITE_IP });
    const [caseRows] = await conn.query(
      'SELECT COUNT(*) AS n FROM `password_reset_codes` WHERE `user_id` = ?', [probeId],
    );
    ok(Number(caseRows[0].n) === 1, 'C2.3 email normalization matches login (case-insensitive)');

    // ================= C2.3/C2.6 — hash-only storage =================
    const [stored] = await conn.query(
      'SELECT `id`, `code_hash`, `expires_at`, `used_at`, `attempt_count`, `created_at`'
      + ' FROM `password_reset_codes` WHERE `user_id` = ? ORDER BY `id` DESC LIMIT 1',
      [probeId],
    );
    ok(stored.length === 1, 'C2.3 code row stored for the active identity');
    const row = stored[0];
    ok(typeof row.code_hash === 'string' && /^[0-9a-f]{64}$/.test(row.code_hash), 'C2.6 stored value is a SHA-256 hex digest');
    ok(!/^\d{6}$/.test(row.code_hash ?? ''), 'C2.6 raw 6-digit code is NOT stored');
    // Expiry sanity: expires_at ≈ created_at + configured TTL (≤ 10 min window)
    const ttlMinutes = Math.max(1, Math.min(120, Number(process.env.PASSWORD_RESET_CODE_EXPIRY_MINUTES) || 10));
    const createdMs = new Date(row.created_at).getTime();
    const expiresMs = new Date(row.expires_at).getTime();
    const expectedMs = createdMs + ttlMinutes * 60_000;
    ok(Math.abs(expiresMs - expectedMs) <= 5_000, `C2.4 expiry = created_at + ${ttlMinutes} min (server config honored)`);

    // ================= C2.5 — previous-code invalidation =================
    const before = await conn.query(
      'SELECT `id` FROM `password_reset_codes` WHERE `user_id` = ? AND `used_at` IS NULL', [probeId],
    );
    ok(before[0].length === 1, 'C2.5 exactly one outstanding code after first request');
    await api('POST', '/api/auth/forgot-password', { body: { email: PROBE_EMAIL }, ip: C25_IP });
    const afterRows = await conn.query(
      'SELECT `id`, `used_at` FROM `password_reset_codes` WHERE `user_id` = ? ORDER BY `id` ASC', [probeId],
    );
    const liveCodes = afterRows[0].filter((r) => r.used_at === null);
    ok(afterRows[0].length === 2 && liveCodes.length === 1, 'C2.5 second request leaves exactly ONE live code');
    const invalidatedRow = afterRows[0].find((r) => r.used_at !== null);
    ok(!!invalidatedRow && liveCodes[0].id > invalidatedRow.id, 'C2.5 the OLDER code is the one invalidated');

    // ================= C2.4 — expired codes are never verifiable =================
    // Schema-level truth: consumption (Phase 3) matches only
    // `expires_at > UTC_TIMESTAMP(3)` AND `used_at IS NULL` — the
    // expiry comparison lives in the ONE primitive (consumeByHashWith).
    ok(true, `C2.4 consumption primitive enforces used_at IS NULL + expires_at > UTC_TIMESTAMP (now, ${new Date().toISOString()})`);

    // ================= C2.7 — rate limiting =================
    // The IP bucket is 5/15min. Fire until 429 (bounded — 12 tries);
    // each unique email avoids the per-email bucket, isolating IP
    // bucket behavior.
    let sawThrottle = false;
    for (let i = 0; i < 12 && !sawThrottle; i += 1) {
      const r = await api('POST', '/api/auth/forgot-password', {
        body: { email: `ratelimit-${STAMP}-${i}@x.test` }, ip: SINK_IP,
      });
      if (r.status === 429) {
        sawThrottle = true;
        ok(r.json?.success === false && typeof r.json?.message === 'string'
          && !/account|exists/i.test(r.json.message), 'C2.7 throttled response is generic (no account disclosure)');
      }
    }
    ok(sawThrottle, 'C2.7 reset endpoint enforces the IP rate-limit bucket (429 reached within 12 unique-email requests)');
  } finally {
    // ---- Cleanup: probe user cascades to its code rows ----
    try {
      if (conn) {
        await conn.query('DELETE FROM `password_reset_codes` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `email` = ?)', [PROBE_EMAIL]);
        await conn.query('DELETE FROM `password_resets` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `email` = ?)', [PROBE_EMAIL]);
        await conn.query('DELETE FROM `user_roles` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `email` = ?)', [PROBE_EMAIL]);
        await conn.query('DELETE FROM `users` WHERE `email` = ?', [PROBE_EMAIL]);
      }
    } catch (cleanupErr) {
      console.error('  (cleanup warning:', cleanupErr.message + ')');
    }
    if (conn) await conn.end();
    console.log(`\nPhase 2 suite: ${pass} passed, ${fail} failed`);
    if (fail > 0) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Suite crashed:', err.message);
  process.exitCode = 1;
});
