#!/usr/bin/env node
// ------------------------------------------------------------
// Phase 3 — verification-code password reset security suite
// Run from repo root:  node scripts/test-phase3-password-reset.mjs
//
// Requires: server on :5000 (or C5_TEST_BASE) + MariaDB up.
// Covers (§27 C2.1–C2.18 + §12 session invalidation):
//   shape validation (missing/invalid email, missing/bad code,
//   mismatch, weak password) · wrong/expired/used/exhausted code ·
//   unknown email · generic error indistinguishability · successful
//   reset · code single-use after success · old password dead ·
//   new password live · NO automatic login · no sensitive values
//   in responses · concurrent double-consume impossible · pre-reset
//   sessions invalidated (pwdAt seam)
//
// Conventions: dedicated probe user, per-section X-Forwarded-For
// rate-limit identities, UTC-pinned DB session, full cleanup.
// No real passwords or codes are printed — only booleans/digests.
// ------------------------------------------------------------

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';

const require = createRequire(pathToFileURL(resolve('server', 'package.json')));
const mysql = require('mysql2/promise');

if (existsSyncEnv()) { /* noop — env loaded below */ }
function existsSyncEnv() { return true; }
for (const line of readFileSync('server/.env', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'greenleaf_school',
  dateStrings: true, // DATETIME columns are literal UTC here
};
const BASE = process.env.C5_TEST_BASE || 'http://127.0.0.1:5000';

let pass = 0;
let fail = 0;
function ok(cond, label) {
  if (cond) { pass += 1; console.log(`  ✔ ${label}`); }
  else { fail += 1; console.log(`  ✖ ${label}`); }
}

/** fetch with an optional X-Forwarded-For identity (trust proxy 1). */
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

function freshIp() {
  return `192.0.2.${1 + (randomBytes(1)[0] % 200)}`;
}

// ------------------------------------------------------------
// Probe identity + constants
// ------------------------------------------------------------

const STAMP = `${Date.now()}-${randomBytes(3).toString('hex')}`;
const PROBE_EMAIL = `phase3-probe-${STAMP}@greenleaf.test`;
const OLD_PASSWORD = 'OldPass-Phase3!x9';
const NEW_PASSWORD = 'NewPass-Phase3!z7';
const RACE_A = 'RaceWinner-Phase3!a1';
const RACE_B = 'RaceLoser-Phase3!b2';
const GENERIC_REJECT = 'The verification code is invalid or expired.';
const GENERIC_LOGIN = 'Invalid email or password.';

let conn;
let probeId;

/** Issue a fresh code through the REAL HTTP pipeline. */
async function issueCode(email, ip) {
  const r = await api('POST', '/api/auth/forgot-password', {
    body: { email }, ip: ip || freshIp(),
  });
  if (r.status !== 200) throw new Error(`forgot-password failed: ${r.status}`);
  return r;
}

/** Outstanding code row for the probe (metadata only). */
async function outstandingRow() {
  const [rows] = await conn.query(
    'SELECT id, code_hash, expires_at, attempt_count FROM `password_reset_codes`'
      + ' WHERE `user_id` = ? AND `used_at` IS NULL ORDER BY `id` DESC LIMIT 1',
    [probeId],
  );
  return rows[0] || null;
}

/**
 * Recover the RAW code for a stored hash by exhausting the 6-digit
 * space against the SHA-256 digest. This is both the way the suite
 * obtains codes (storage is hash-only by design) and a direct
 * proof that the stored value IS a 6-digit code's SHA-256.
 */
function recoverCode(codeHash) {
  for (let n = 0; n < 1_000_000; n += 1) {
    const candidate = String(n).padStart(6, '0');
    if (sha256(candidate) === codeHash) return candidate;
  }
  return null;
}

async function main() {
  conn = await mysql.createConnection(DB);
  await conn.query("SET time_zone = '+00:00'");

  try {
    // 0. Reachability
    const health = await api('GET', '/api/health');
    if (health.status !== 200) {
      console.error('✖ API server is not reachable on', BASE, '— start it first (cd server && npm run dev)');
      process.exitCode = 1;
      return;
    }
    console.log('Phase 3 — verification-code password reset\n');

    // Probe user (bcryptjs from server/node_modules)
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(OLD_PASSWORD, 4); // probe-only throwaway cost
    const [ins] = await conn.query(
      'INSERT INTO `users` (`email`, `password_hash`, `name`, `is_active`) VALUES (?, ?, ?, 1)',
      [PROBE_EMAIL, hash, 'Phase 3 Probe'],
    );
    probeId = ins.insertId;
    // Login only issues sessions to `admin`-role identities — bind it.
    const [roleRow] = await conn.query("SELECT id FROM `roles` WHERE `code` = 'admin' LIMIT 1");
    await conn.query('INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES (?, ?)', [probeId, roleRow[0].id]);

    // ============ C2.1–C2.4 — request shape validation ============
    console.log('[1] Request shape validation');
    const noEmail = await api('POST', '/api/auth/reset-password', { body: { code: '123456', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, ip: freshIp() });
    ok(noEmail.status === 400, 'C2.1 missing email → 400');

    const badEmail = await api('POST', '/api/auth/reset-password', { body: { email: 'abc', code: '123456', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, ip: freshIp() });
    ok(badEmail.status === 400 && typeof badEmail.json?.message === 'string', 'C2.2 invalid email → 400');

    const noCode = await api('POST', '/api/auth/reset-password', { body: { email: PROBE_EMAIL, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, ip: freshIp() });
    ok(noCode.status === 400, 'C2.3 missing code → 400');

    const badCodeFormat = await api('POST', '/api/auth/reset-password', { body: { email: PROBE_EMAIL, code: '12a456', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, ip: freshIp() });
    ok(badCodeFormat.status === 400, 'C2.4 non-6-digit code → 400');
    const badCodeShort = await api('POST', '/api/auth/reset-password', { body: { email: PROBE_EMAIL, code: '12345', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, ip: freshIp() });
    ok(badCodeShort.status === 400, 'C2.4 5-digit code → 400');
    const noShapeRows = await conn.query('SELECT COUNT(*) n FROM `password_reset_codes` WHERE `user_id` = ?', [probeId]);
    ok(Number(noShapeRows[0][0].n) === 0, 'C2.1–C2.4 no code rows touched by invalid requests');

    // ============ C2.11 — unknown email (enumeration) ============
    console.log('\n[2] Unknown email');
    const unknown = await api('POST', '/api/auth/reset-password', {
      body: { email: `nobody-${STAMP}@x.test`, code: '654321', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, ip: freshIp(),
    });
    ok(unknown.status === 400 && unknown.json?.message === GENERIC_REJECT,
      'C2.11 unknown email → the ONE generic code reject');
    ok(!/not found|does not exist|no account|unknown user/i.test(unknown.json?.message || ''),
      'C2.11 message reveals no account state');

    // ============ C2.5 — wrong code ============
    console.log('\n[3] Wrong code / attempts / expiry (code #1)');
    await issueCode(PROBE_EMAIL);
    const row1 = await outstandingRow();
    const rawCode1 = recoverCode(row1.code_hash);
    ok(rawCode1 !== null && /^\d{6}$/.test(rawCode1),
      'storage proof: code_hash IS the SHA-256 of a 6-digit code (raw never stored)');

    const wrong1 = await api('POST', '/api/auth/reset-password', {
      body: { email: PROBE_EMAIL, code: rawCode1 === '000000' ? '000001' : '000000', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, ip: freshIp(),
    });
    ok(wrong1.status === 400 && wrong1.json?.message === GENERIC_REJECT, 'C2.5 wrong code → generic reject');
    ok(wrong1.json?.message === unknown.json?.message, 'C2.8 wrong-code and unknown-email are BYTE-IDENTICAL rejects');
    ok(!JSON.stringify(wrong1.json).includes('000000'), 'C2.17 response never echoes the submitted code');

    // Cross-user binding: probe's code must NOT work for another email
    const crossUser = await api('POST', '/api/auth/reset-password', {
      body: { email: `other-lookup-${STAMP}@x.test`, code: rawCode1, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, ip: freshIp(),
    });
    ok(crossUser.status === 400 && crossUser.json?.message === GENERIC_REJECT,
      'code is owner-bound: valid code + unknown email → generic reject');
    const pwStillOld = await bcrypt.compare(OLD_PASSWORD,
      (await conn.query('SELECT password_hash FROM `users` WHERE id = ?', [probeId]))[0][0].password_hash);
    ok(pwStillOld, 'cross-user attempt changed NO password');

    // ============ C2.6 — expired code ============
    await conn.query('UPDATE `password_reset_codes` SET `expires_at` = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 MINUTE) WHERE `id` = ?', [row1.id]);
    const expired = await api('POST', '/api/auth/reset-password', {
      body: { email: PROBE_EMAIL, code: rawCode1, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, ip: freshIp(),
    });
    ok(expired.status === 400 && expired.json?.message === GENERIC_REJECT, 'C2.6 expired code (correct code!) → generic reject');
    const pwAfterExpired = await bcrypt.compare(OLD_PASSWORD,
      (await conn.query('SELECT password_hash FROM `users` WHERE id = ?', [probeId]))[0][0].password_hash);
    ok(pwAfterExpired, 'C2.6 expired code changed NO password');

    // ============ C2.8 — attempt ceiling ============
    // Attempts so far on row1: wrong1(1) + expired-correct(2). Add 3 → 5 = ceiling.
    for (let i = 0; i < 3; i += 1) {
      const w = await api('POST', '/api/auth/reset-password', {
        body: { email: PROBE_EMAIL, code: rawCode1 === '000000' ? `00000${i + 1}` : `00000${i}`, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, ip: freshIp(),
      });
      ok(w.status === 400, `C2.8 wrong guess ${i + 1}/3 → rejected`);
    }
    const [after5] = await conn.query('SELECT attempt_count FROM `password_reset_codes` WHERE `id` = ?', [row1.id]);
    ok(Number(after5[0].attempt_count) >= 5, 'C2.8 attempt counter reached the ceiling (5)');
    const sixthCorrect = await api('POST', '/api/auth/reset-password', {
      body: { email: PROBE_EMAIL, code: rawCode1, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, ip: freshIp(),
    });
    ok(sixthCorrect.status === 400 && sixthCorrect.json?.message === GENERIC_REJECT,
      'C2.8 the 6th attempt — even with the CORRECT code — is rejected');
    const pwAfterCeiling = await bcrypt.compare(OLD_PASSWORD,
      (await conn.query('SELECT password_hash FROM `users` WHERE id = ?', [probeId]))[0][0].password_hash);
    ok(pwAfterCeiling, 'C2.8 ceiling never changed the password');

    // Pre-reset session (for the §12 invalidation check later)
    const preLogin = await api('POST', '/api/auth/login', {
      body: { email: PROBE_EMAIL, password: OLD_PASSWORD }, ip: freshIp(),
    });
    ok(preLogin.status === 200 && typeof preLogin.headers.get('set-cookie') === 'string',
      'baseline: probe logs in with the current password');
    const preCookie = (preLogin.headers.get('set-cookie') || '').split(';')[0];

    // ============ C2.9/C2.10 — mismatch + weak password (code #2) ============
    console.log('\n[4] Password rules (code #2 — must survive bad passwords)');
    await issueCode(PROBE_EMAIL); // also invalidates exhausted row #1
    const row2 = await outstandingRow();
    ok(row2.id !== row1.id, 'fresh code issued; previous row invalidated');
    const rawCode2 = recoverCode(row2.code_hash);
    ok(rawCode2 !== null, 'code #2 recovered from its hash');

    const mismatch = await api('POST', '/api/auth/reset-password', {
      body: { email: PROBE_EMAIL, code: rawCode2, newPassword: NEW_PASSWORD, confirmPassword: `${NEW_PASSWORD}-x` }, ip: freshIp(),
    });
    ok(mismatch.status === 400 && /do not match/i.test(mismatch.json?.message || ''), 'C2.9 confirm mismatch → validation error');
    const weak = await api('POST', '/api/auth/reset-password', {
      body: { email: PROBE_EMAIL, code: rawCode2, newPassword: 'short', confirmPassword: 'short' }, ip: freshIp(),
    });
    ok(weak.status === 400 && /at least 8/i.test(weak.json?.message || ''), 'C2.10 weak password → existing policy message');
    const row2After = await outstandingRow();
    ok(row2After !== null && row2After.id === row2.id && Number(row2After.attempt_count) === 0,
      'C2.9/C2.10 policy failures consumed NO code and burned NO attempts');

    // ============ C2.12 — successful reset ============
    console.log('\n[5] Successful reset (code #2)');
    const success = await api('POST', '/api/auth/reset-password', {
      body: { email: PROBE_EMAIL, code: rawCode2, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, ip: freshIp(),
    });
    ok(success.status === 200 && success.json?.success === true, 'C2.12 correct email + code + password → 200');
    ok(success.headers.get('set-cookie') === null, 'C2.16 success sets NO cookie (no automatic login)');
    const successStr = JSON.stringify(success.json).toLowerCase();
    ok(!successStr.includes(NEW_PASSWORD.toLowerCase()) && !successStr.includes(rawCode2)
      && !successStr.includes('token') && !successStr.includes('$2'),
      'C2.17 success body carries no password/code/token VALUES');
    ok(!success.text.includes(rawCode2), 'C2.17 success body never contains the verification code');

    // ============ C2.13 — code dead after success ============
    const replay = await api('POST', '/api/auth/reset-password', {
      body: { email: PROBE_EMAIL, code: rawCode2, newPassword: `${NEW_PASSWORD}-2`, confirmPassword: `${NEW_PASSWORD}-2` }, ip: freshIp(),
    });
    ok(replay.status === 400 && replay.json?.message === GENERIC_REJECT, 'C2.13 replayed code → generic reject');

    // ============ C2.14/C2.15 — old dead, new works ============
    const oldLogin = await api('POST', '/api/auth/login', {
      body: { email: PROBE_EMAIL, password: OLD_PASSWORD }, ip: freshIp(),
    });
    ok(oldLogin.status === 401 && oldLogin.json?.message === GENERIC_LOGIN, 'C2.14 old password → 401');
    const newLogin = await api('POST', '/api/auth/login', {
      body: { email: PROBE_EMAIL.toUpperCase(), password: NEW_PASSWORD }, ip: freshIp(),
    });
    ok(newLogin.status === 200, 'C2.15 new password → 200 (case-insensitive email)');

    // ============ §12 — pre-reset session invalidated ============
    const staleMe = await api('GET', '/api/auth/me', {});
    // (no cookie on purpose — baseline 401 shape)
    ok(staleMe.status === 401, 'session gate: no cookie → 401');
    const stale = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: preCookie } });
    ok(stale.status === 401, '§12 pre-reset session cookie is INVALID after the reset (pwdAt seam)');

    // ============ C2.18 — concurrent double-consume ============
    console.log('\n[6] Race: two simultaneous resets, one code');
    await issueCode(PROBE_EMAIL);
    const row3 = await outstandingRow();
    const rawCode3 = recoverCode(row3.code_hash);
    const raceBodyA = { email: PROBE_EMAIL, code: rawCode3, newPassword: RACE_A, confirmPassword: RACE_A };
    const raceBodyB = { email: PROBE_EMAIL, code: rawCode3, newPassword: RACE_B, confirmPassword: RACE_B };
    const [raceA, raceB] = await Promise.all([
      api('POST', '/api/auth/reset-password', { body: raceBodyA, ip: freshIp() }),
      api('POST', '/api/auth/reset-password', { body: raceBodyB, ip: freshIp() }),
    ]);
    const winners = [raceA, raceB].filter((r) => r.status === 200);
    ok(winners.length === 1, 'C2.18 exactly ONE of two concurrent resets succeeded');
    const aWorks = (await api('POST', '/api/auth/login', { body: { email: PROBE_EMAIL, password: RACE_A }, ip: freshIp() })).status === 200;
    const bWorks = (await api('POST', '/api/auth/login', { body: { email: PROBE_EMAIL, password: RACE_B }, ip: freshIp() })).status === 200;
    ok(aWorks !== bWorks, 'C2.18 the winner\'s password is live, the loser\'s is dead');
    const [usedRows] = await conn.query(
      'SELECT used_at FROM `password_reset_codes` WHERE `id` = ?', [row3.id],
    );
    ok(usedRows[0].used_at !== null, 'C2.18 the consumed row is stamped used exactly once');
  } finally {
    // ---- Cleanup: probe user cascades to codes/sessions data ----
    try {
      if (conn) {
        await conn.query('DELETE FROM `password_reset_codes` WHERE `user_id` = ?', [probeId]);
        await conn.query('DELETE FROM `user_roles` WHERE `user_id` = ?', [probeId]);
        await conn.query('DELETE FROM `users` WHERE `id` = ?', [probeId]);
      }
    } catch (cleanupErr) {
      console.error('  (cleanup warning:', cleanupErr.message + ')');
    }
    if (conn) await conn.end();
    console.log(`\nPhase 3 suite: ${pass} passed, ${fail} failed`);
    if (fail > 0) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Suite crashed:', err.message);
  process.exitCode = 1;
});
