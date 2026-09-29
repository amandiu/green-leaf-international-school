// ------------------------------------------------------------
// Phase C.6 — admin user management verification suite
// Run from repo root:  node scripts/test-admin-user-management.mjs
//
// Requires: server on :5000 (or C6_TEST_BASE) + MariaDB up.
// Verifies: /api/admin/users surface (list/create/status/roles/
// reset-token), admin-role authorization (live, fail-closed 403),
// safe projections (no credential fields), duplicate-email 409,
// primary-role contract, reset issuance security (hash-only
// storage, 60-min expiry, one-live-token, consumption round-trip),
// invalid input, unexpected fields, admin_users immutability,
// C4 session behavior, C5 password/reset regression, C2/C3
// boundaries, CMS round-trip, and full cleanup.
//
// The admin session comes from a throwaway probe identity created
// through the C2 service (no real credentials are read or needed).
// ------------------------------------------------------------

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

// mysql2 lives in server/node_modules — resolve from the server
// package base, not the repo root.
const require = createRequire(pathToFileURL(resolve('server', 'package.json')));
const mysql = require('mysql2/promise');

// Load server/.env manually (scripts run outside the server package).
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
const BASE = process.env.C6_TEST_BASE || 'http://127.0.0.1:5000';
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:5174';

let pass = 0;
let fail = 0;
function ok(cond, label) {
  if (cond) { pass += 1; console.log(`  ✔ ${label}`); }
  else { fail += 1; console.log(`  ✖ ${label}`); }
}

/** fetch with cookie handling (mirrors the admin SPA's cookie flow). */
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
    jar.cookie = setCookie.split(';')[0];
    jar.fullSetCookie = setCookie;
  }
  return { status: res.status, json, text, setCookie, headers: res.headers };
}

// timezone:'Z' mirrors the server pool (config/db.js).
const conn = await mysql.createConnection({ ...DB, multipleStatements: false, timezone: 'Z' });
const q = async (sql, params) => (await conn.query(sql, params))[0];

const { createUser } = await import('../server/src/services/identityService.js');
const { consumeResetToken } = await import('../server/src/services/passwordResetService.js');

// Janitor: clean probe identities from any earlier interrupted run.
{
  const stale = await q("SELECT id, email FROM users WHERE email LIKE 'c6-admin-probe-%' OR email LIKE 'c6-target-probe-%' OR email LIKE 'c6-nonadmin-probe-%'");
  if (stale.length > 0) {
    await conn.query("DELETE FROM users WHERE email LIKE 'c6-admin-probe-%' OR email LIKE 'c6-target-probe-%' OR email LIKE 'c6-nonadmin-probe-%'");
    console.log(`  (janitor: removed ${stale.length} probe identity/ies left by an earlier interrupted run)`);
  }
}

// Snapshots for the untouched-table assertions.
const adminUsersBefore = await q('SELECT id, email, password_hash, name, is_active, created_at, updated_at FROM admin_users ORDER BY id');
const usersCountBefore = (await q('SELECT COUNT(*) AS n FROM users'))[0].n;
const rpCountBefore = (await q('SELECT COUNT(*) AS n FROM role_permissions'))[0].n;
const resetsBefore = (await q('SELECT COUNT(*) AS n FROM password_resets'))[0].n;

const STAMP = Date.now();
const ADMIN_EMAIL = `c6-admin-probe-${STAMP}@greenleaf.test`;
const NONADMIN_EMAIL = `c6-nonadmin-probe-${STAMP}@greenleaf.test`;
const TARGET_EMAIL = `c6-target-probe-${STAMP}@greenleaf.test`;
const PROBE_PASSWORD = 'C6Probe-pass-123';

// ============================================================
// [A] SCHEMA BASELINE (C6 requires NO new tables — §AN.17)
// ============================================================
console.log('\n[A] Schema baseline — C6 adds nothing');
{
  const tables = (await q(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name IN ('users','user_roles','roles','role_permissions','password_resets')",
    [DB.database],
  ))[0];
  ok(Number(tables.n) === 5, 'all five identity tables exist (no C6 tables added)');
  const tracked = (await q("SELECT COUNT(*) AS n FROM schema_migrations WHERE name LIKE '0%'"))[0];
  ok(Number(tracked.n) >= 17, 'migration chain intact (17 applied)');
  const catalog = await q('SELECT code FROM roles ORDER BY id');
  ok(JSON.stringify(catalog.map((r) => r.code)) === JSON.stringify(['admin', 'student', 'teacher', 'guardian']),
    'role catalog unchanged (4 seeded codes)');
}

// ============================================================
// [B] PROBE IDENTITIES + AUTH BASELINE
// ============================================================
console.log('\n[B] Probe identities + authentication baseline');
const adminProbe = await createUser(
  { email: ADMIN_EMAIL, name: 'C6 Admin Probe', roles: ['admin'], primaryRole: 'admin' },
  { password: PROBE_PASSWORD },
);
const nonAdminProbe = await createUser(
  { email: NONADMIN_EMAIL, name: 'C6 Non-Admin Probe', roles: ['student'], primaryRole: 'student' },
  { password: PROBE_PASSWORD },
);
ok(adminProbe?.id > 0 && nonAdminProbe?.id > 0, 'probe identities created through the C2 service');

const adminJar = {};
const nonAdminJar = {};
const adminLogin = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: PROBE_PASSWORD }, jar: adminJar });
const nonAdminLogin = await api('POST', '/api/auth/login', { body: { email: NONADMIN_EMAIL, password: PROBE_PASSWORD }, jar: nonAdminJar });
ok(adminLogin.status === 200, 'admin probe login works (C4 path)');
ok(nonAdminLogin.status === 401, 'non-admin identity CANNOT obtain an admin session (C4 role boundary)');

// ============================================================
// [C] UNAUTHORIZED ACCESS (fail-closed, live authorization)
// ============================================================
console.log('\n[C] Unauthorized access');
{
  const noAuth = await api('GET', '/api/admin/users');
  ok(noAuth.status === 401, 'GET /api/admin/users without session → 401 (adminAuth gate)');

  const postNoAuth = await api('POST', '/api/admin/users', { body: { email: 'x@x.test', password: 'password123', roles: ['student'] } });
  ok(postNoAuth.status === 401, 'POST without session → 401');

  const badBearer = await api('GET', '/api/admin/users', { headers: { Authorization: 'Bearer wrong-token' } });
  ok(badBearer.status === 401, 'wrong Bearer → 401 (no bypass)');

  // CSRF: the origin rule is observable only on an AUTHENTICATED
  // request (the C4 suite's exact pattern) — a safe-method GET with
  // a foreign Origin passes the guard, then adminAuth decides.
  const cross = await api('GET', '/api/admin/users', { jar: { cookie: adminJar.cookie }, headers: { Origin: 'https://evil.example' } });
  ok(cross.status === 200, 'safe method (GET) with foreign Origin → allowed (C4 exact rule)');

  const crossPost = await api('POST', '/api/admin/users', {
    headers: { Origin: 'https://evil.example' },
    body: { email: 'x@x.test', password: 'password123', roles: ['student'] },
  });
  ok(crossPost.status === 403, 'state-changing POST with cross-site Origin → 403 (originGuard)');
}

// ============================================================
// [D] AUTHORIZED ACCESS (admin session)
// ============================================================
console.log('\n[D] Authorized access');
{
  const list = await api('GET', '/api/admin/users', { jar: { cookie: adminJar.cookie } });
  ok(list.status === 200 && list.json?.success === true, 'GET /api/admin/users with admin session → 200');
  ok(Array.isArray(list.json?.data?.users) && typeof list.json?.data?.total === 'number', 'canonical envelope { success, data: { users, total } }');
  ok(list.json.data.users.some((u) => u.email === ADMIN_EMAIL), 'admin probe visible in the list');
}

// ============================================================
// [E] USER LISTING + [F] SAFE PROJECTION
// ============================================================
console.log('\n[E/F] Listing + safe projection');
{
  const list = await api('GET', '/api/admin/users', { jar: { cookie: adminJar.cookie } });
  const users = list.json?.data?.users ?? [];
  ok(users.length >= 4, `list includes the 3 real admins + probes (got: ${users.length})`);
  const leaked = users.filter((u) => 'password_hash' in u || 'password_changed_at' in u || 'passwordHash' in u);
  ok(leaked.length === 0, 'NO password_hash / password_changed_at in any row (safe projection)');
  ok(!JSON.stringify(list.json).includes('$2'), 'no bcrypt material anywhere in the response');
  const sample = users.find((u) => u.email === ADMIN_EMAIL);
  ok(sample.roles?.[0] === 'admin', 'roles resolved with primary FIRST');
  const hasAllCols = users.every((u) => 'id' in u && 'email' in u && 'name' in u && 'is_active' in u && 'roles' in u);
  ok(hasAllCols, 'rows carry the approved fields (id, email, name, is_active, roles)');
}

// ============================================================
// [G] USER CREATION + [H] DUPLICATE EMAIL
// ============================================================
console.log('\n[G/H] Creation + duplicate email');
{
  const created = await api('POST', '/api/admin/users', {
    jar: { cookie: adminJar.cookie },
    body: { email: TARGET_EMAIL, name: 'C6 Target Probe', roles: ['student', 'guardian'], primaryRole: 'guardian', password: 'Target-pass-123' },
  });
  ok(created.status === 201 && created.json?.data?.user?.id > 0, 'create → 201 with the safe user projection');
  ok(created.json?.data?.user?.roles?.join(',') === 'guardian,student', 'created roles resolved primary-first (guardian primary)');
  ok(!('password_hash' in (created.json?.data?.user ?? {})), 'creation response exposes no credential fields');

  const dup = await api('POST', '/api/admin/users', {
    jar: { cookie: adminJar.cookie },
    body: { email: TARGET_EMAIL, roles: ['student'], password: 'Other-pass-123' },
  });
  ok(dup.status === 409, 'duplicate email → 409 (C2 service conflict)');

  const upper = await api('POST', '/api/admin/users', {
    jar: { cookie: adminJar.cookie },
    body: { email: TARGET_EMAIL.toUpperCase(), roles: ['student'], password: 'Other-pass-123' },
  });
  ok(upper.status === 409, 'case-variant duplicate → 409 (email normalization)');

  const targetRow = (await q('SELECT id, is_active FROM users WHERE email = ?', [TARGET_EMAIL]))[0];
  ok(targetRow && targetRow.is_active === 1, 'created identity is ACTIVE by default');
  const hashRow = (await q('SELECT password_hash FROM users WHERE email = ?', [TARGET_EMAIL]))[0];
  ok(/^\$2[aby]\$12\$/.test(hashRow.password_hash), 'stored hash is bcrypt cost 12 (established config; no plaintext)');
}

// ============================================================
// [I/J] ACTIVATION / DEACTIVATION + SESSION BEHAVIOR
// ============================================================
console.log('\n[I/J] Lifecycle + session behavior');
{
  const target = (await q('SELECT id FROM users WHERE email = ?', [TARGET_EMAIL]))[0];

  const badBody = await api('PUT', `/api/admin/users/${target.id}/status`, {
    jar: { cookie: adminJar.cookie }, body: { isActive: 'yes' },
  });
  ok(badBody.status === 400, 'non-boolean isActive → 400');

  const deact = await api('PUT', `/api/admin/users/${target.id}/status`, {
    jar: { cookie: adminJar.cookie }, body: { isActive: false },
  });
  ok(deact.status === 200, 'deactivate → 200');
  const rowAfter = (await q('SELECT is_active FROM users WHERE id = ?', [target.id]))[0];
  ok(Number(rowAfter.is_active) === 0, 'users.is_active = 0 in DB');

  const deactivatedLogin = await api('POST', '/api/auth/login', { body: { email: TARGET_EMAIL, password: 'Target-pass-123' } });
  ok(deactivatedLogin.status === 401, 'deactivated identity cannot log in (generic 401)');

  const react = await api('PUT', `/api/admin/users/${target.id}/status`, {
    jar: { cookie: adminJar.cookie }, body: { isActive: true },
  });
  ok(react.status === 200, 're-activate → 200');
  const rowBack = (await q('SELECT is_active FROM users WHERE id = ?', [target.id]))[0];
  ok(Number(rowBack.is_active) === 1, 'users.is_active back to 1');

  const missing = await api('PUT', '/api/admin/users/4294967290/status', {
    jar: { cookie: adminJar.cookie }, body: { isActive: false },
  });
  ok(missing.status === 404, 'unknown id → 404 (fail-closed)');
}

// ============================================================
// [K/L] ROLE ASSIGNMENT + PRIMARY-ROLE BEHAVIOR
// ============================================================
console.log('\n[K/L] Role assignment + primary contract');
{
  const target = (await q('SELECT id FROM users WHERE email = ?', [TARGET_EMAIL]))[0];

  const badRole = await api('POST', `/api/admin/users/${target.id}/roles`, {
    jar: { cookie: adminJar.cookie }, body: { role: 'superuser' },
  });
  ok(badRole.status === 400, 'role outside the catalog → 400');

  const dupRole = await api('POST', `/api/admin/users/${target.id}/roles`, {
    jar: { cookie: adminJar.cookie }, body: { role: 'student' },
  });
  ok(dupRole.status === 409, 'duplicate role assignment → 409 (C2 rule)');

  const addTeacher = await api('POST', `/api/admin/users/${target.id}/roles`, {
    jar: { cookie: adminJar.cookie }, body: { role: 'teacher', makePrimary: true },
  });
  ok(addTeacher.status === 200 && addTeacher.json?.data?.user?.roles?.[0] === 'teacher', 'assign teacher + makePrimary → primary swaps (C2 contract)');

  const dbRoles = await q(
    'SELECT r.code, ur.is_primary FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? ORDER BY ur.is_primary DESC',
    [target.id],
  );
  const primaries = dbRoles.filter((r) => Number(r.is_primary) === 1);
  ok(primaries.length === 1 && primaries[0].code === 'teacher', 'exactly ONE primary role in DB after the swap');
}

// ============================================================
// [M/N] RESET ISSUANCE + TOKEN SECURITY
// ============================================================
console.log('\n[M/N] Admin-issued reset + token security');
{
  const target = (await q('SELECT id FROM users WHERE email = ?', [TARGET_EMAIL]))[0];

  const ghost = await api('POST', '/api/admin/users/4294967290/reset-token', { jar: { cookie: adminJar.cookie } });
  ok(ghost.status === 404, 'reset issuance for unknown id → 404');

  const issued = await api('POST', `/api/admin/users/${target.id}/reset-token`, { jar: { cookie: adminJar.cookie } });
  ok(issued.status === 200 && typeof issued.json?.data?.resetToken === 'string', 'reset issuance → 200 with the raw token (admin-issued §AN.8)');
  ok(issued.json?.data?.expiresInMinutes === 60, '60-minute expiry communicated');
  ok(issued.json?.data?.user?.id === target.id, 'issuance identifies the target user');

  // Hash-only storage + TTL.
  const expectedHash = createHash('sha256').update(issued.json.data.resetToken, 'utf8').digest('hex');
  const tokenRow = (await q('SELECT token_hash, expires_at, used_at FROM password_resets WHERE user_id = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1', [target.id]))[0];
  ok(tokenRow.token_hash === expectedHash, 'stored value = SHA-256(raw token) — hash-only');
  const driftMin = (new Date(tokenRow.expires_at).getTime() - (Date.now() + 60 * 60 * 1000)) / 60000;
  ok(driftMin > -2 && driftMin < 2, `expires_at ≈ now + 60 min (drift: ${driftMin.toFixed(1)} min)`);

  // One-live-token rule: second issuance invalidates the first.
  const second = await api('POST', `/api/admin/users/${target.id}/reset-token`, { jar: { cookie: adminJar.cookie } });
  const liveRows = await q('SELECT COUNT(*) AS n FROM password_resets WHERE user_id = ? AND used_at IS NULL', [target.id]);
  ok(Number(liveRows[0].n) === 1, 'second issuance leaves exactly ONE live token (C5 invalidation rule)');

  // Grant the admin role through the C6 endpoint ITSELF (dogfood)
  // so the round-trip below can use the public login path — the C4
  // login issues sessions ONLY to admin-role identities until the
  // portal phases (Phase N) add role-aware login surfaces.
  await api('POST', `/api/admin/users/${target.id}/roles`, { jar: { cookie: adminJar.cookie }, body: { role: 'admin' } });

  // The issued token WORKS through the C5 public confirm endpoint.
  const reset = await api('POST', '/api/auth/reset-password', { body: { token: second.json.data.resetToken, newPassword: 'Target-NewPass-456' } });
  ok(reset.status === 200, 'issued token consumable through the C5 reset flow');
  const newLogin = await api('POST', '/api/auth/login', { body: { email: TARGET_EMAIL, password: 'Target-NewPass-456' } });
  ok(newLogin.status === 200, 'login with the admin-issued reset password works (public path, admin-role identity)');

  // Raw token never in list responses.
  const list = await api('GET', '/api/admin/users', { jar: { cookie: adminJar.cookie } });
  ok(!JSON.stringify(list.json).includes(second.json.data.resetToken), 'raw token never appears in list responses');
  ok(!JSON.stringify(list.json).includes(expectedHash), 'token hashes never appear in list responses');
}

// ============================================================
// [O] TRANSACTION ROLLBACK (failed creation leaves nothing)
// ============================================================
console.log('\n[O] Transaction rollback / pre-resolution safety');
{
  // (1) Whitelist rejection: unknown role code → 400 BEFORE any
  // write (validator convention).
  const badCreate = await api('POST', '/api/admin/users', {
    jar: { cookie: adminJar.cookie },
    body: { email: `c6-rollback-${STAMP}@greenleaf.test`, roles: ['student', 'nonexistent-role'], password: 'Rollback-pass-123' },
  });
  ok(badCreate.status === 400, 'creation with a non-catalog role → 400 (validator whitelist)');

  // (2) Service-level rejection: a whitelisted role that is
  // INACTIVE in the catalog → 404 from the C2 pre-transaction
  // resolution (roles are resolved before any insert).
  const rollbackEmail = `c6-rollback-${STAMP}@greenleaf.test`;
  try {
    await conn.query("UPDATE roles SET is_active = 0 WHERE code = 'guardian'");
    const deactivatedRole = await api('POST', '/api/admin/users', {
      jar: { cookie: adminJar.cookie },
      body: { email: rollbackEmail, roles: ['guardian'], password: 'Rollback-pass-123' },
    });
    ok(deactivatedRole.status === 404, 'creation with a deactivated catalog role → 404 (pre-transaction resolution)');
  } finally {
    await conn.query("UPDATE roles SET is_active = 1 WHERE code = 'guardian'");
  }
  const catalogRestored = (await q("SELECT is_active FROM roles WHERE code = 'guardian'"))[0];
  ok(Number(catalogRestored.is_active) === 1, 'role catalog restored after the rollback probe');

  const leftover = await q('SELECT COUNT(*) AS n FROM users WHERE email = ?', [rollbackEmail]);
  ok(Number(leftover[0].n) === 0, 'failed creation left NO user row');
  const leftoverRoles = await q(
    'SELECT COUNT(*) AS n FROM user_roles ur LEFT JOIN users u ON u.id = ur.user_id WHERE u.id IS NULL',
  );
  ok(Number(leftoverRoles[0].n) === 0, 'no orphan user_roles rows');
}

// ============================================================
// [P/Q] INVALID INPUT + UNEXPECTED FIELDS
// ============================================================
console.log('\n[P/Q] Validation');
{
  const cases = [
    [{}, 'empty body'],
    [{ email: 'not-an-email', roles: ['student'], password: 'password123' }, 'malformed email'],
    [{ email: `c6-valid-${STAMP}@greenleaf.test`, roles: [], password: 'password123' }, 'empty roles'],
    [{ email: `c6-valid-${STAMP}@greenleaf.test`, roles: ['student'], password: 'short' }, 'weak password'],
    [{ email: `c6-valid-${STAMP}@greenleaf.test`, roles: ['student'], password: 'password123', extra: 1 }, 'unexpected field'],
  ];
  for (const [body, label] of cases) {
    const r = await api('POST', '/api/admin/users', { jar: { cookie: adminJar.cookie }, body });
    ok(r.status === 400, `${label} → 400`);
    ok(!JSON.stringify(r.json).includes('password123') && !JSON.stringify(r.json).includes('short'), `${label} error leaks no credential values`);
  }
  const badId = await api('POST', '/api/admin/users/abc/roles', {
    jar: { cookie: adminJar.cookie }, body: { role: 'student' },
  });
  ok(badId.status === 400, 'non-numeric user id → 400');
  const bigId = await api('POST', '/api/admin/users/99999999999/roles', {
    jar: { cookie: adminJar.cookie }, body: { role: 'student' },
  });
  ok(bigId.status === 400, 'id outside the UNSIGNED INT domain → 400');
}

// ============================================================
// [R] IDOR / CLIENT-SUPPLIED ID — authorization is LIVE server-side
// ============================================================
console.log('\n[R] Live authorization (no claim-trust IDOR)');
{
  // A non-admin CANNOT reach the surface even with a crafted role
  // claim — because the check resolves the DB, not the token.
  // Simulate the stale-claim scenario: temporarily strip the admin
  // probe's role in DB, then use its still-valid session.
  const adminId = adminProbe.id;
  await conn.query("UPDATE user_roles ur JOIN roles r ON r.id = ur.role_id SET ur.is_primary = ur.is_primary WHERE ur.user_id = ?", [adminId]); // no-op keepalive
  await conn.query('DELETE ur FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.code = ?', [adminId, 'admin']);
  const stripped = await api('GET', '/api/admin/users', { jar: { cookie: adminJar.cookie } });
  ok(stripped.status === 403, 'valid session whose admin role was REVOKED → 403 (live check, not the stale claim)');

  // Restore the role (back through the C2 service contract shape).
  await conn.query('INSERT INTO user_roles (user_id, role_id, is_primary) VALUES (?, (SELECT id FROM roles WHERE code = ?), 1)', [adminId, 'admin']);
  const restored = await api('GET', '/api/admin/users', { jar: { cookie: adminJar.cookie } });
  ok(restored.status === 200, 'role restored → authorized again');

  // Deactivated admin → 403 despite a valid session.
  await conn.query('UPDATE users SET is_active = 0 WHERE id = ?', [adminId]);
  const deactivated = await api('GET', '/api/admin/users', { jar: { cookie: adminJar.cookie } });
  ok(deactivated.status === 403, 'deactivated admin identity → 403 (fail-closed)');
  await conn.query('UPDATE users SET is_active = 1 WHERE id = ?', [adminId]);
}

// ============================================================
// [S] C4 SESSION BEHAVIOR + [T] C5 REGRESSION
// ============================================================
console.log('\n[S/T] C4 session + C5 password/reset regression');
{
  const me = await api('GET', '/api/auth/me', { jar: { cookie: adminJar.cookie } });
  ok(me.status === 200 && me.json?.data?.user?.email === ADMIN_EMAIL, '/me unchanged (canonical users row)');
  ok(!('password_hash' in (me.json?.data?.user ?? {})), '/me projection still credential-free');

  const badLogin = await api('POST', '/api/auth/login', { body: { email: 'no-such@x.test', password: 'whatever-123' } });
  ok(badLogin.status === 401 && badLogin.json?.message === 'Invalid email or password.', 'generic login 401 unchanged');

  // C5 change-password still works + invalidates sessions. The
  // target's current password is the one the [M/N] admin-issued
  // reset set (Target-NewPass-456).
  const tJar = {};
  const tLogin = await api('POST', '/api/auth/login', { body: { email: TARGET_EMAIL, password: 'Target-NewPass-456' }, jar: tJar });
  ok(tLogin.status === 200, 'target login before the C5 regression (admin-role identity)');
  const changed = await api('POST', '/api/auth/change-password', {
    jar: { cookie: tJar.cookie },
    body: { currentPassword: 'Target-NewPass-456', newPassword: 'Target-NewPass-789' },
  });
  ok(changed.status === 200, 'C5 change-password still functional');
  const meAfter = await api('GET', '/api/auth/me', { jar: { cookie: tJar.cookie } });
  ok(meAfter.status === 401, 'C5 pwdAt invalidation still functional (session died at the stamp)');

  // C5 forgot-password stays a generic sink (no token leak).
  const forgot = await api('POST', '/api/auth/forgot-password', { body: { email: TARGET_EMAIL } });
  const forgotUnknown = await api('POST', '/api/auth/forgot-password', { body: { email: `nobody-${STAMP}@x.test` } });
  ok(forgot.status === 200 && JSON.stringify(forgot.json) === JSON.stringify(forgotUnknown.json), 'C5 generic forgot-password behavior intact (byte-identical)');

  const rpCount = (await q('SELECT COUNT(*) AS n FROM role_permissions'))[0].n;
  ok(Number(rpCount) === rpCountBefore, 'role_permissions still EMPTY (C7 NOT implemented)');
}

// ============================================================
// [U/V/W] C2/C3 BOUNDARIES + CMS REGRESSION
// ============================================================
console.log('\n[U/V/W] C2/C3 boundaries + CMS regression');
{
  const { USER_LINK_COLUMN, parseUserId } = await import('../server/src/services/ownershipScoping.js');
  ok(USER_LINK_COLUMN === 'user_id' && parseUserId('7') === 7, 'C3 scoping helpers intact');

  const orphans = await q('SELECT COUNT(*) AS n FROM user_roles ur LEFT JOIN users u ON u.id = ur.user_id WHERE u.id IS NULL');
  ok(Number(orphans[0].n) === 0, 'no orphan user_roles');

  const adminUsersAfter = await q('SELECT id, email, password_hash, name, is_active, created_at, updated_at FROM admin_users ORDER BY id');
  ok(JSON.stringify(adminUsersAfter) === JSON.stringify(adminUsersBefore), 'admin_users byte-identical (never written)');

  // CMS round-trip through the admin session.
  const created = await api('POST', '/api/admin/news', {
    jar: { cookie: adminJar.cookie },
    body: { title: `C6 probe ${STAMP}`, slug: `c6-probe-${STAMP}`, type: 'NEWS', content: 'C6 verification probe — deleted by the suite.', status: 'DRAFT' },
  });
  ok(created.status === 201 || created.status === 200, 'CMS create still works');
  const id = created.json?.id ?? created.json?.data?.id;
  if (id) {
    const del = await api('DELETE', `/api/admin/news/${id}`, { jar: { cookie: adminJar.cookie } });
    ok(del.status === 200 || del.status === 204, 'CMS delete still works (probe cleaned)');
  }
}

// ============================================================
// [X] CLEANUP + FINAL STATE
// ============================================================
console.log('\n[X] Cleanup + final state');
{
  await conn.query("DELETE FROM users WHERE email LIKE 'c6-admin-probe-%' OR email LIKE 'c6-target-probe-%' OR email LIKE 'c6-nonadmin-probe-%'");
  const usersCountAfter = (await q('SELECT COUNT(*) AS n FROM users'))[0].n;
  ok(usersCountAfter === usersCountBefore, `users count restored (${usersCountBefore})`);

  const resetsAfter = (await q('SELECT COUNT(*) AS n FROM password_resets'))[0].n;
  ok(Number(resetsAfter) === resetsBefore, `password_resets restored (${resetsBefore})`);
  const liveResets = (await q('SELECT COUNT(*) AS n FROM password_resets WHERE used_at IS NULL AND expires_at > UTC_TIMESTAMP()'))[0].n;
  ok(Number(liveResets) === 0, 'no outstanding valid reset tokens remain');

  const probeNews = await q('SELECT COUNT(*) AS n FROM news_items WHERE slug = ?', [`c6-probe-${STAMP}`]);
  ok(Number(probeNews[0].n) === 0, 'no leftover probe CMS rows');

  const realAdmins = (await q(
    "SELECT COUNT(*) AS n FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE r.code = 'admin'",
  ))[0].n;
  ok(Number(realAdmins) === adminUsersBefore.length, `canonical admin count back to the pre-existing ${adminUsersBefore.length}`);
}

// ============================================================
// RESULT
// ============================================================
console.log(`\n${'═'.repeat(40)}`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(40)}`);
await conn.end();
process.exit(fail === 0 ? 0 : 1);
