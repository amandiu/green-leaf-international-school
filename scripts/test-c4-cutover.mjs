// ------------------------------------------------------------
// Phase C.4 — authentication cutover verification suite
// Run from repo root:  node scripts/test-c4-cutover.mjs
//
// Requires: server on :5000 (or C4_TEST_BASE) + MariaDB up, AND a
// real admin credential pair (C4_TEST_ADMIN_EMAIL /
// C4_TEST_ADMIN_PASSWORD — loaded from server/.env if present).
// Verifies: COPY (idempotency + 1:1 gate), LOGIN (users-canonical,
// generic errors, no enumeration, admin-role boundary), SESSION
// (canonical sub, roles/pwdAt claims, tamper/legacy rejection),
// pwdAt INVALIDATION, LOGOUT, CSRF Origin/Referer baseline, ADMIN
// compatibility (adminAuth + a real CMS mutation), SECURITY
// (no enumeration / no credential leakage / admin_users untouched)
// and ROLLBACK boundaries (gate behavior + copy idempotency).
// ------------------------------------------------------------

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createHmac } from 'node:crypto';

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
};
const BASE = process.env.C4_TEST_BASE || 'http://127.0.0.1:5000';
const ADMIN_EMAIL = process.env.C4_TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.C4_TEST_ADMIN_PASSWORD;

let pass = 0;
let fail = 0;
function ok(cond, label) {
  if (cond) { pass += 1; console.log(`  ✔ ${label}`); }
  else { fail += 1; console.log(`  ✖ ${label}`); }
}

/**
 * fetch with cookie handling (single-jar, mirrors the admin SPA's
 * credentials: 'include' behavior) and optional extra headers.
 */
async function api(method, path, { body, headers = {}, jar } = {}) {
  const h = { ...headers };
  if (body !== undefined && !(h['Content-Type'] ?? h['content-type'])) {
    h['Content-Type'] = 'application/json';
  }
  if (jar?.cookie) h.Cookie = jar.cookie;
  const res = await fetch(`${BASE}${path}`, {
    method, headers: h, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  const setCookie = res.headers.get('set-cookie');
  if (jar && setCookie) {
    // Store the cookie exactly as issued (first pair, incl. attributes).
    jar.cookie = setCookie.split(';')[0];
    jar.fullSetCookie = setCookie;
  }
  return { status: res.status, json, text, setCookie };
}

function decodeTokenPayload(token) {
  const [body] = String(token).split('.');
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
}

// timezone:'Z' mirrors the server pool (config/db.js): DATETIME values
// are parsed as UTC. Without it the suite would interpret the same
// stored stamp as LOCAL time and mis-compare the pwdAt claim by the
// local UTC offset.
const conn = await mysql.createConnection({ ...DB, multipleStatements: false, timezone: 'Z' });
const q = async (sql, params) => (await conn.query(sql, params))[0];

// Snapshot admin_users for the "never modified" assertions.
const adminUsersBefore = await q('SELECT id, email, password_hash, name, is_active, created_at, updated_at FROM admin_users ORDER BY id');

// ============================================================
// [A] COPY — 1:1 gate + idempotent rerun
// ============================================================
console.log('\n[A] COPY — 1:1 gate + idempotency');
{
  const { execFileSync } = await import('node:child_process');
  // Run the gate in VERIFY-ONLY mode first (must pass, must not copy).
  let out;
  try {
    out = execFileSync('node', ['src/scripts/migrateAdminUsersToUsers.js', '--verify-only'], {
      cwd: resolve('server'), encoding: 'utf8', timeout: 60_000,
    });
    ok(/VERIFIED\s*: YES/.test(out), 'verify-only gate: VERIFIED=YES (exit 0)');
  } catch (e) {
    ok(false, `verify-only gate failed: ${String(e.stdout || e.message).slice(-200)}`);
  }
  // Idempotent rerun (full mode; inserts nothing new).
  try {
    out = execFileSync('node', ['src/scripts/migrateAdminUsersToUsers.js'], {
      cwd: resolve('server'), encoding: 'utf8', timeout: 60_000,
    });
    ok(!/copied admin_users/.test(out), 'idempotent rerun copies NOTHING new');
    ok(/VERIFIED\s*: YES/.test(out), 'idempotent rerun gate still VERIFIED=YES');
  } catch (e) {
    ok(false, `idempotent rerun failed: ${String(e.stdout || e.message).slice(-200)}`);
  }

  const users = await q('SELECT id, email, password_hash, is_active, password_changed_at, created_at FROM users ORDER BY id');
  const adminRoleId = (await q("SELECT id FROM roles WHERE code = 'admin'"))[0].id;
  // 1:1 means MAPPING, not global count equality: the login-probe
  // identities this suite (and any post-cutover admin:create) creates
  // legitimately live in users beyond admin_users — the gate proves
  // admin_users ⊆ canonical admins with zero missing/duplicates
  // (exactly §AN.14's audit rule; extras are audited, not forbidden).
  const byEmail = new Map(users.map((u) => [String(u.email).toLowerCase(), u]));
  const dupEmails = users.filter((u, i) => users.findIndex((x) => String(x.email).toLowerCase() === String(u.email).toLowerCase()) !== i);
  const missingAdmins = adminUsersBefore.filter((a) => !byEmail.has(String(a.email).toLowerCase()));
  ok(missingAdmins.length === 0 && dupEmails.length === 0,
    `every admin_users row maps 1:1 to a canonical users row (${adminUsersBefore.length} mapped; ${users.length - adminUsersBefore.length} canonical-only)`);
  let allHashes = true; let allStamp = true; let allRoles = true; let hashMatch = true;
  for (const a of adminUsersBefore) {
    const u = byEmail.get(String(a.email).toLowerCase());
    if (!u) { allHashes = false; continue; }
    if (u.password_hash !== a.password_hash) hashMatch = false;
    if (!/^\$2[aby]\$\d{2}\$/.test(u.password_hash) || !u.password_changed_at) allStamp = false;
    const roles = await q('SELECT is_primary FROM user_roles WHERE user_id = ? AND role_id = ?', [u.id, adminRoleId]);
    if (roles.length !== 1 || Number(roles[0].is_primary) !== 1) allRoles = false;
  }
  ok(hashMatch, 'every copied password_hash is VERBATIM (bcrypt never re-hashed)');
  ok(allStamp, 'every canonical admin identity has a valid bcrypt hash + stamped password_changed_at');
  ok(allRoles, 'every canonical admin identity has exactly one primary admin role');
  ok(users.every((u) => u.created_at !== null), 'created_at preserved (audit continuity)');

  const orphans = await q('SELECT COUNT(*) AS n FROM user_roles ur LEFT JOIN users u ON u.id = ur.user_id WHERE u.id IS NULL');
  ok(Number(orphans[0].n) === 0, 'no orphan user_roles rows');
  const nonAdminUsers = await q(
    "SELECT COUNT(*) AS n FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE r.code <> 'admin'",
  );
  ok(Number(nonAdminUsers[0].n) === 0, 'no student/teacher/guardian roles granted during copy');
}

// ============================================================
// [B] LOGIN — users-canonical, generic errors, no enumeration
// ============================================================
console.log('\n[B] LOGIN — canonical users source');
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.log('  (SKIP: set C4_TEST_ADMIN_EMAIL/C4_TEST_ADMIN_PASSWORD for live login checks)');
} else {
  const jar = {};
  const badEmail = await api('POST', '/api/auth/login', { body: { email: 'no-such-admin@x.test', password: 'whatever-123' } });
  ok(badEmail.status === 401 && badEmail.json?.message === 'Invalid email or password.', 'unknown email → SAME generic 401');

  const badPw = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: 'definitely-wrong-123' } });
  ok(badPw.status === 401 && badPw.json?.message === 'Invalid email or password.', 'wrong password → SAME generic 401');
  ok(badEmail.json?.message === badPw.json?.message, 'unknown-email and wrong-password errors are INDISTINGUISHABLE (no enumeration)');

  const good = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } , jar });
  ok(good.status === 200 && good.json?.data?.user?.id > 0, 'valid login → 200 (credentials verify against the COPIED users hash)');
  ok(typeof good.json?.data?.user?.id === 'number' && good.json?.data?.user?.email === ADMIN_EMAIL, 'session identity resolves from canonical users');

  const setCookie = good.setCookie || '';
  ok(setCookie.includes('HttpOnly'), 'cookie keeps HttpOnly');
  ok(/SameSite=Lax/i.test(setCookie), 'cookie keeps SameSite=Lax');
  ok(!setCookie.includes('password'), 'no credential material in Set-Cookie');

  // Canonical subject proof: token sub must be a users.id, NOT the admin_users.id.
  const cookieToken = (jar.cookie || '').split(';')[0]?.split('=')[1] || '';
  const payload = cookieToken ? decodeTokenPayload(cookieToken) : null;
  const usersRow = payload ? (await q('SELECT id, email FROM users WHERE id = ?', [payload.sub]))[0] : null;
  ok(payload && usersRow && usersRow.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    'token sub = canonical users.id (resolves to the users row, not admin_users)');

  // roles claim + pwdAt claim
  const roleRows = await q(
    'SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? ORDER BY ur.is_primary DESC',
    [payload.sub],
  );
  ok(Array.isArray(payload.roles) && payload.roles.includes('admin') && payload.roles.length === roleRows.length,
    'roles claim = resolved canonical role codes');
  const stampRow = (await q('SELECT password_changed_at FROM users WHERE id = ?', [payload.sub]))[0];
  // The copied legacy admins are stamped at the copy; the pwdAt claim
  // mirrors the live stamp. A null stamp (never-changed) must surface
  // as pwdAt:null — also valid, so this check is stamp-aware.
  const stampMs = stampRow.password_changed_at ? new Date(stampRow.password_changed_at).getTime() : null;
  ok(
    stampMs === null
      ? payload.pwdAt === null
      : typeof payload.pwdAt === 'number' && Math.abs(payload.pwdAt - stampMs) < 1000,
    'pwdAt claim = users.password_changed_at (epoch ms; null when never changed)',
  );
  ok(!('password' in payload) && !('password_hash' in payload) && !JSON.stringify(payload).includes('$2'),
    'token payload carries NO credential material');
}

// ============================================================
// [C] SESSION — claims enforced; tampered/legacy tokens rejected
// ============================================================
console.log('\n[C] SESSION — claim enforcement + legacy-token rejection');
{
  // Tampered signature must be rejected (verifySessionToken path).
  const jarT = {};
  const lg = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, jar: jarT });
  const token = (jarT.cookie || '').split(';')[0]?.split('=')[1] || '';
  const forged = `${token.slice(0, -3)}xyz`;
  const meForged = await api('GET', '/api/auth/me', { headers: { Cookie: `greenleaf_admin_session=${forged}` } });
  ok(meForged.status === 401, 'tampered token signature → 401');

  // Hand-forged correctly-signed token WITHOUT the cutover claims
  // must be rejected (legacy pre-cutover token simulation), even
  // though its sub is a valid canonical id and signature is valid.
  if (token) {
    const p = decodeTokenPayload(token);
    const legacyPayload = { sub: p.sub, email: p.email, name: p.name, iat: Date.now(), exp: Date.now() + 3_600_000 };
    const body = Buffer.from(JSON.stringify(legacyPayload)).toString('base64url');
    const sig = createHmac('sha256', process.env.AUTH_SECRET).update(body).digest('base64url');
    const meLegacy = await api('GET', '/api/auth/me', { headers: { Cookie: `greenleaf_admin_session=${body}.${sig}` } });
    ok(meLegacy.status === 401, 'validly-signed LEGACY token (no roles/pwdAt claims) → 401');
  } else {
    ok(false, 'legacy-token check skipped (no login)');
  }

  // Unknown canonical id in a validly-signed token → fail closed.
  if (token) {
    const p = decodeTokenPayload(token);
    const ghost = { ...p, sub: 4294967290, iat: Date.now(), exp: Date.now() + 3_600_000 };
    const body = Buffer.from(JSON.stringify(ghost)).toString('base64url');
    const sig = createHmac('sha256', process.env.AUTH_SECRET).update(body).digest('base64url');
    const meGhost = await api('GET', '/api/auth/me', { headers: { Cookie: `greenleaf_admin_session=${body}.${sig}` } });
    ok(meGhost.status === 401, 'validly-signed token with UNKNOWN canonical id → 401 (fail closed)');
  }
}

// ============================================================
// [D] pwdAt INVALIDATION — stamp change kills existing sessions
// ============================================================
console.log('\n[D] pwdAt invalidation (no session store needed)');
{
  const jarD = {};
  const lg = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, jar: jarD });
  ok(lg.status === 200, 'login for invalidation test');
  const meBefore = await api('GET', '/api/auth/me', { jar: jarD });
  ok(meBefore.status === 200, 'session valid before stamp change');

  const sub = decodeTokenPayload((jarD.cookie || '').split('=')[1]).sub;
  // Simulate a password change: bump password_changed_at by 1s.
  await conn.query('UPDATE users SET password_changed_at = DATE_ADD(password_changed_at, INTERVAL 1 SECOND) WHERE id = ?', [sub]);
  const meAfter = await api('GET', '/api/auth/me', { jar: jarD });
  ok(meAfter.status === 401, 'session INVALID after password_changed_at change (pwdAt mismatch → 401)');

  // Re-login mints a session carrying the new pwdAt → valid again.
  const jarD2 = {};
  const relg = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, jar: jarD2 });
  const meRelg = await api('GET', '/api/auth/me', { jar: jarD2 });
  ok(relg.status === 200 && meRelg.status === 200, 'fresh login after stamp change is VALID (new pwdAt matches)');
  ok(!('password_changed_at' in (meRelg.json?.data?.user ?? {})), '/me response exposes no password_changed_at field');
  ok(!('password_hash' in (meRelg.json?.data?.user ?? {})), '/me response exposes no password_hash field');
}

// ============================================================
// [E] CSRF — Origin/Referer baseline (§AN.9 exact rule)
// ============================================================
console.log('\n[E] CSRF Origin/Referer baseline');
{
  const jarC = {};
  const lg = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, jar: jarC });
  ok(lg.status === 200, 'login (no Origin/Referer → allowed for non-browser consumers)');
  const cookie = jarC.cookie;

  const cross = await api('PUT', '/api/admin/settings', {
    jar: { cookie }, headers: { Origin: 'https://evil.example' }, body: { seo: {} },
  });
  ok(cross.status === 403, 'cross-site Origin on authenticated state-changing request → 403');
  ok(/not allowed/i.test(cross.json?.message || ''), '403 message is generic (no origin probing)');

  const crossRef = await api('PUT', '/api/admin/settings', {
    jar: { cookie }, headers: { Referer: 'https://evil.example/admin' }, body: { seo: {} },
  });
  ok(crossRef.status === 403, 'cross-site Referer (no Origin) → 403');

  const adminUrl = process.env.ADMIN_URL || 'http://localhost:5174';
  const sameOrigin = await api('GET', '/api/admin/settings', {
    jar: { cookie }, headers: { Origin: adminUrl },
  });
  ok(sameOrigin.status === 200, 'same-allowlist Origin (ADMIN_URL) on admin GET → 200');

  const safeCross = await api('GET', '/api/admin/settings', {
    jar: { cookie }, headers: { Origin: 'https://evil.example' },
  });
  ok(safeCross.status === 200, 'safe method (GET) with foreign Origin → allowed (reads are not the CSRF vector)');

  // Public state-changing endpoint (POST /api/contact) must NOT be
  // blocked by the guard (it is mounted on /api/auth + /api/admin only).
  const contact = await api('POST', '/api/contact', {
    headers: { Origin: 'https://evil.example' },
    body: { name: 'C4 Probe', email: 'c4-probe@example.test', subject: 'C4 CSRF baseline', message: 'probe message body' },
  });
  ok(contact.status === 201 || contact.status === 400, 'public POST /api/contact unaffected by the guard (400 validation / 201 accepted)');

  // Cleanup the probe message if created.
  if (contact.status === 201 && contact.json?.data?.id) {
    await conn.query('DELETE FROM contact_messages WHERE id = ?', [contact.json.data.id]);
  }
}

// ============================================================
// [F] ADMIN — adminAuth + protected endpoints + real CMS mutation
// ============================================================
console.log('\n[F] ADMIN compatibility (cookie session, adminAuth, CMS CRUD)');
{
  const me = await api('GET', '/api/auth/me', { jar: {} });
  ok(me.status === 401, '/me without session → 401 (unchanged)');

  const lo = await api('POST', '/api/auth/logout');
  ok(lo.status === 200, 'logout idempotent without session');

  const jarF = {};
  await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, jar: jarF });

  const gate = await api('GET', '/api/admin/news');
  ok(gate.status === 401, 'adminAuth gate unchanged (no cookie → 401)');

  const list = await api('GET', '/api/admin/news?limit=1', { jar: jarF });
  ok(list.status === 200, 'protected admin endpoint with cookie session → 200');

  // REAL CMS mutation round-trip: create → verify → delete (own probe).
  const stamp = Date.now();
  const created = await api('POST', '/api/admin/news', {
    jar: jarF,
    body: { title: `C4 cutover probe ${stamp}`, slug: `c4-probe-${stamp}`, type: 'NEWS', content: 'C4 verification probe — safe to delete.', status: 'DRAFT' },
  });
  ok(created.status === 201 || created.status === 200, `CMS create works post-cutover (${created.status})`);
  if (created.status === 201 || created.status === 200) {
    // The news module uses the bare-item envelope (§20.11 deviation):
    // POST returns the item itself, so its id sits at the top level.
    const id = created.json?.id ?? created.json?.data?.id ?? created.json?.data?.item?.id ?? created.json?.data?.news?.id;
    const del = await api('DELETE', `/api/admin/news/${id}`, { jar: jarF });
    ok(del.status === 200 || del.status === 204, 'CMS delete works post-cutover (probe cleaned up)');
    ok(del.status !== 200 || del.json?.success === true, 'news delete carries the standard success envelope');
  }

  // ADMIN_TOKEN transition path (deprecated, still configured) must
  // keep working for scripts — and must NOT be weakened.
  const bearerToken = process.env.ADMIN_TOKEN;
  if (bearerToken) {
    const bearer = await api('GET', '/api/admin/navigation', { headers: { Authorization: `Bearer ${bearerToken}` } });
    ok(bearer.status === 200, 'deprecated ADMIN_TOKEN script path still functional (§AN.14 keeps it)');
    const bearerBad = await api('GET', '/api/admin/navigation', { headers: { Authorization: 'Bearer wrong-token-value' } });
    ok(bearerBad.status === 401, 'wrong Bearer token → 401 (no bypass)');
  }
}

// ============================================================
// [G] SECURITY — admin_users untouched; no new public surface
// ============================================================
console.log('\n[G] Security — admin_users untouched, no leakage, no new surface');
{
  const adminUsersAfter = await q('SELECT id, email, password_hash, name, is_active, created_at, updated_at FROM admin_users ORDER BY id');
  ok(JSON.stringify(adminUsersAfter) === JSON.stringify(adminUsersBefore),
    'admin_users rows byte-identical through the entire suite (never modified)');

  const users404 = await api('GET', '/api/users');
  ok(users404.status === 404, 'GET /api/users → 404 (C4 added no public identity surface)');
  const adminUsers404 = await api('GET', '/api/admin/users');
  ok(adminUsers404.status === 404, 'GET /api/admin/users → 404 (C6 scope, correctly unmounted)');

  // Every login failure path returned the SAME message — asserted in [B];
  // additionally confirm the inactive-account path would be generic too
  // (probe: deactivated identity must NOT be able to log in).
  const probeEmail = `c4-inactive-probe-${Date.now()}@greenleaf.test`;
  const { createUser } = await import('../server/src/services/identityService.js');
  const probe = await createUser({ email: probeEmail, name: 'C4 Inactive', roles: ['student'] }, { password: 'probe-password-123' });
  await conn.query('UPDATE users SET is_active = 0 WHERE id = ?', [probe.id]);
  const probeLogin = await api('POST', '/api/auth/login', { body: { email: probeEmail, password: 'probe-password-123' } });
  ok(probeLogin.status === 401 && probeLogin.json?.message === 'Invalid email or password.',
    'deactivated canonical identity → SAME generic 401 (no active-status disclosure)');
  // Even an ADMIN-role identity that is deactivated would be denied —
  // cover the boundary directly by activating a student-role probe:
  await conn.query('UPDATE users SET is_active = 1 WHERE id = ?', [probe.id]);
  const studentLogin = await api('POST', '/api/auth/login', { body: { email: probeEmail, password: 'probe-password-123' } });
  ok(studentLogin.status === 401, 'active NON-ADMIN canonical identity cannot obtain an admin session (role boundary at login)');
  await conn.query('DELETE FROM users WHERE id = ?', [probe.id]); // user_roles CASCADE
}

// ============================================================
// [H] ROLLBACK SAFETY — failed gate must not activate cutover
// ============================================================
console.log('\n[H] Rollback safety');
{
  // Structural proof: the gate is a separate process whose failure
  // (non-zero exit) is the documented trigger to NOT cut over.
  const { execFileSync } = await import('node:child_process');
  // Simulate a CONFLICT: temporarily desync one copied row's name.
  const victim = (await q('SELECT u.id, u.name FROM users u JOIN admin_users a ON LOWER(a.email) = LOWER(u.email) LIMIT 1'))[0];
  const originalName = victim.name;
  await conn.query('UPDATE users SET name = CONCAT(name, " DESYNC") WHERE id = ?', [victim.id]);
  let gateFailed = false;
  try {
    execFileSync('node', ['src/scripts/migrateAdminUsersToUsers.js', '--verify-only'], { cwd: resolve('server'), encoding: 'utf8', timeout: 60_000 });
  } catch (e) {
    gateFailed = /VERIFIED\s*: NO/.test(String(e.stdout)) || e.status !== 0;
  }
  ok(gateFailed, 'desynced row → verification gate FAILS (VERIFIED=NO, non-zero exit)');
  // Restore.
  await conn.query('UPDATE users SET name = ? WHERE id = ?', [originalName, victim.id]);
  let gateRestored = false;
  try {
    const out = execFileSync('node', ['src/scripts/migrateAdminUsersToUsers.js', '--verify-only'], { cwd: resolve('server'), encoding: 'utf8', timeout: 60_000 });
    gateRestored = /VERIFIED\s*: YES/.test(out);
  } catch { gateRestored = false; }
  ok(gateRestored, 'after restoring the row, the gate passes again (deterministic, repairable)');

  // The legacy table remains intact and untouched — rollback of the
  // CODE (git checkout of the pre-C4 auth files) restores the old
  // authentication source against an unchanged admin_users.
  const adminCount = (await q('SELECT COUNT(*) AS n FROM admin_users'))[0].n;
  ok(adminCount === adminUsersBefore.length, `admin_users still holds all ${adminUsersBefore.length} identities (rollback path intact)`);
}

// ============================================================
// RESULT
// ============================================================
console.log(`\n${'═'.repeat(40)}`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(40)}`);
await conn.end();
process.exit(fail === 0 ? 0 : 1);
