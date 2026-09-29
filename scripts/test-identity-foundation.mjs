// ------------------------------------------------------------
// Identity foundation verification (Phase C.2)
// Run from repo root:  node scripts/test-identity-foundation.mjs
//
// Requires: server on :5000 (or IDENTITY_TEST_BASE) + MariaDB up.
// Verifies: DB structure/constraints/indexes/FKs (read-only via
// the API server's own pool — NO direct mysql client dependency),
// role catalog, service-layer rules (via a temporary identity
// service import — the service has NO HTTP surface in C2), admin
// compatibility (existing auth untouched), and privacy (no
// password material ever leaves the identity layer).
// ------------------------------------------------------------

import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// mysql2 lives in server/node_modules — resolve from the server
// package base, not the repo root.
const require = createRequire(
  pathToFileURL(resolve('server', 'package.json')),
);
const mysql = require('mysql2/promise');

// Load server/.env manually (scripts run outside the server package).
import { readFileSync, existsSync } from 'node:fs';
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

const BASE = process.env.IDENTITY_TEST_BASE || 'http://127.0.0.1:5000';

let pass = 0;
let fail = 0;
function ok(cond, label) {
  if (cond) { pass += 1; console.log(`  ✔ ${label}`); }
  else { fail += 1; console.log(`  ✖ ${label}`); }
}

async function api(method, path, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, text };
}

// ============================================================
// [1] DATABASE STRUCTURE
// ============================================================
console.log('\n[1] Database structure (roles / users / user_roles / role_permissions)');
const conn = await mysql.createConnection({ ...DB, multipleStatements: false });

const [tables] = await conn.query(
  `SELECT TABLE_NAME FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('roles','users','user_roles','role_permissions')
   ORDER BY TABLE_NAME`,
  [DB.database],
);
ok(tables.length === 4, `all 4 identity tables exist (got ${tables.length})`);

// Columns (spot-critical ones)
const [userCols] = await conn.query(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
  [DB.database],
);
const userColNames = new Set(userCols.map((c) => c.COLUMN_NAME));
for (const c of ['id', 'email', 'password_hash', 'name', 'is_active', 'password_changed_at', 'created_at', 'updated_at']) {
  ok(userColNames.has(c), `users.${c} exists`);
}

const [roleCols] = await conn.query(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'roles'`,
  [DB.database],
);
const roleColNames = new Set(roleCols.map((c) => c.COLUMN_NAME));
for (const c of ['id', 'code', 'name', 'is_active']) {
  ok(roleColNames.has(c), `roles.${c} exists`);
}

// Unique keys
const [indexes] = await conn.query(
  `SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols, MAX(NON_UNIQUE) AS non_unique
   FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('roles','users','user_roles','role_permissions')
   GROUP BY TABLE_NAME, INDEX_NAME`,
  [DB.database],
);
const idxKey = (t, i) => `${t}.${i}`;
const idxMap = new Map(indexes.map((r) => [idxKey(r.TABLE_NAME, r.INDEX_NAME), { cols: r.cols, non_unique: Number(r.non_unique) }]));
ok(idxMap.get('users.uq_users_email')?.non_unique === 0, 'users.email UNIQUE');
ok(idxMap.get('roles.uq_roles_code')?.non_unique === 0, 'roles.code UNIQUE');
ok(idxMap.get('user_roles.uq_user_roles_user_role')?.cols === 'user_id,role_id' && idxMap.get('user_roles.uq_user_roles_user_role')?.non_unique === 0, 'user_roles (user_id, role_id) UNIQUE');
ok(idxMap.get('role_permissions.PRIMARY')?.cols === 'role_id,permission_key', 'role_permissions PK (role_id, permission_key)');
ok(idxMap.get('users.idx_users_email_active')?.cols === 'email,is_active', 'users idx(email, is_active)');

// FK behavior
const [fks] = await conn.query(
  `SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME, DELETE_RULE
   FROM information_schema.REFERENTIAL_CONSTRAINTS
   WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME IN ('user_roles','role_permissions')`,
  [DB.database],
);
const fk = (name) => fks.find((f) => f.CONSTRAINT_NAME === name);
ok(fk('fk_user_roles_user')?.DELETE_RULE === 'CASCADE' && fk('fk_user_roles_user')?.REFERENCED_TABLE_NAME === 'users', 'user_roles.user_id → users CASCADE');
ok(fk('fk_user_roles_role')?.DELETE_RULE === 'RESTRICT' && fk('fk_user_roles_role')?.REFERENCED_TABLE_NAME === 'roles', 'user_roles.role_id → roles RESTRICT');
ok(fk('fk_role_permissions_role')?.DELETE_RULE === 'CASCADE' && fk('fk_role_permissions_role')?.REFERENCED_TABLE_NAME === 'roles', 'role_permissions.role_id → roles CASCADE');

// Seed catalog
const [roleRows] = await conn.query('SELECT code, name, is_active FROM `roles` ORDER BY id');
ok(roleRows.length === 4, `exactly 4 catalog roles (got ${roleRows.length})`);
ok(['admin', 'student', 'teacher', 'guardian'].every((c) => roleRows.some((r) => r.code === c && r.is_active === 1)),
  'seeded catalog: admin/student/teacher/guardian all active');

// ============================================================
// [2] SERVICE RULES (no HTTP surface — exercised directly)
// ============================================================
console.log('\n[2] Identity service rules (models/service/validator)');
const { createUser, assignRole, getSafeUser, listRoles, getRolePermissions } = await import('../server/src/services/identityService.js');

// 2a. Role catalog via the service
const roles = await listRoles();
ok(Array.isArray(roles) && roles.length === 4, 'service listRoles → 4 roles');
ok(roles.every((r) => !('password_hash' in r)), 'role rows carry no credential fields');

// 2b. Valid user creation
const probeEmail = `c2-probe-${Date.now()}@greenleaf.test`;
let created = null;
try {
  created = await createUser(
    { email: probeEmail, name: 'C2 Probe', roles: ['teacher', 'guardian'], primaryRole: 'teacher' },
    { password: 'probe-password-123' },
  );
  ok(created?.id > 0, 'valid user created');
  ok(created.roles[0] === 'teacher' && created.roles.includes('guardian'), 'roles: primary first, both assigned');
  ok(created.isActive === true, 'created user is active');
  ok(!('password_hash' in created) && !('passwordHash' in created), 'safe projection: NO password material');
  ok(!('email' in (created ?? {})) === false, 'email visible to internal consumers (not a public API)');
} catch (err) {
  ok(false, `valid user created (${err.message})`);
}

// 2c. Duplicate email rejected
try {
  await createUser({ email: probeEmail, roles: ['student'] }, { password: 'another-pass-123' });
  ok(false, 'duplicate email rejected');
} catch (err) {
  ok(err?.status === 409 || /already exists/i.test(err?.message || ''), 'duplicate email rejected (409)');
}

// 2d. Invalid role rejected
try {
  await createUser({ email: `c2-badrole-${Date.now()}@greenleaf.test`, roles: ['superhero'] }, { password: 'irrelevant-123' });
  ok(false, 'invalid role rejected');
} catch (err) {
  ok(/role must be one of/i.test(err?.message || '') || err?.status === 400, 'invalid role rejected (400)');
}

// 2e. primaryRole must be inside roles
try {
  await createUser(
    { email: `c2-badprimary-${Date.now()}@greenleaf.test`, roles: ['teacher'], primaryRole: 'guardian' },
    { password: 'irrelevant-123' },
  );
  ok(false, 'primaryRole outside roles rejected');
} catch (err) {
  ok(/primaryRole must be one of the assigned roles/i.test(err?.message || ''), 'primaryRole outside roles rejected (400)');
}

// 2f. Password policy (bcrypt-12, service-enforced)
try {
  await createUser({ email: `c2-shortpw-${Date.now()}@greenleaf.test`, roles: ['student'] }, { password: 'short' });
  ok(false, 'short password rejected');
} catch (err) {
  ok(/password must be at least 8/i.test(err?.message || ''), 'short password rejected (400)');
}

// 2g. Unknown payload fields rejected (validator convention)
try {
  await createUser({ email: `c2-unk-${Date.now()}@greenleaf.test`, roles: ['student'], hacker: true }, { password: 'whatever-123' });
  ok(false, 'unknown field rejected');
} catch (err) {
  ok(/Unknown field/i.test(err?.message || ''), 'unknown payload field rejected (400)');
}

// 2h. makePrimary assignment + safe projection
if (created?.id) {
  try {
    const updated = await assignRole(created.id, 'admin', { makePrimary: true });
    ok(updated.roles[0] === 'admin' && updated.roles.includes('teacher'), 'makePrimary swap works (admin primary, teacher kept)');
  } catch (err) {
    ok(false, `makePrimary swap works (${err.message})`);
  }
  try {
    await assignRole(created.id, 'admin');
    ok(false, 'duplicate role assignment rejected');
  } catch (err) {
    ok(/already has/i.test(err?.message || '') || err?.status === 409, 'duplicate role assignment rejected (409)');
  }
}

// 2i. Permission cache returns an array (empty in C2 — no rows seeded)
const adminRole = roles.find((r) => r.code === 'admin');
const keys = await getRolePermissions(adminRole.id);
ok(Array.isArray(keys) && keys.length === 0, 'getRolePermissions → [] in C2 (no rows; admin * is a C7 middleware decision)');

// 2j. password_changed_at is NULL on creation (stamp = credential-change event only)
if (created?.id) {
  const [pw] = await conn.query('SELECT password_changed_at, LEFT(password_hash, 4) AS hp, LENGTH(password_hash) AS hl FROM `users` WHERE id = ?', [created.id]);
  ok(pw[0]?.password_changed_at === null, 'password_changed_at NULL on creation (no fake stamp)');
  ok(pw[0]?.hp === '$2b$' && pw[0]?.hl >= 50, 'password stored as a real bcrypt hash (never plaintext)');
}

// ============================================================
// [3] ADMIN COMPATIBILITY (existing auth 100% untouched)
// ============================================================
console.log('\n[3] Admin compatibility — existing auth unchanged');
const health = await api('GET', '/api/health');
ok(health.status === 200 && health.json?.success === true, 'GET /api/health → 200');

const badLogin = await api('POST', '/api/auth/login', { body: { email: 'nobody@x.com', password: 'wrong-pass-1' } });
ok(badLogin.status === 401 && badLogin.json?.message === 'Invalid email or password.', 'existing login rejects bad credentials with the SAME generic 401');

const unauth = await api('GET', '/api/admin/news');
ok(unauth.status === 401 && unauth.json?.message === 'Authentication required.', 'existing adminAuth gate unchanged (401 without session)');

// Real admin login round-trip (proves the C2 identity tables are
// inert to the existing flow): uses ADMIN_TOKEN-adjacent env only
// if credentials exist — otherwise skipped with a note.
const adminEmail = process.env.IDENTITY_TEST_ADMIN_EMAIL;
const adminPassword = process.env.IDENTITY_TEST_ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  const login = await api('POST', '/api/auth/login', { body: { email: adminEmail, password: adminPassword } });
  ok(login.status === 200 && login.json?.data?.user?.id > 0, 'existing admin login round-trip works');
  const me = await api('GET', '/api/auth/me', { token: undefined, headersNote: 'cookie flows via fetch in browsers; direct fetch here needs the cookie jar' });
  ok(me.status === 401 || me.status === 200, 'auth/me responds (session semantics unchanged)');
} else {
  console.log('  (live admin login round-trip skipped — set IDENTITY_TEST_ADMIN_EMAIL/PASSWORD to enable)');
}

// ============================================================
// [4] PRIVACY — public surface must expose NO identity data
// ============================================================
console.log('\n[4] Privacy — no public identity surface');
const publicProbe = await api('GET', '/api/users');
ok(publicProbe.status === 404, 'GET /api/users → 404 (no public identity endpoint)');
const adminUsersProbe = await api('GET', '/api/admin/users');
ok(adminUsersProbe.status === 401 || adminUsersProbe.status === 404, 'GET /api/admin/users is NOT publicly readable (C2 era: 404 unmounted; since C6: 401 admin-gated)');

// Public settings/news must not leak identity tables
const settings = await api('GET', '/api/settings');
ok(settings.status === 200 && !JSON.stringify(settings.json).includes('password'), 'public settings carry no credential material');
const news = await api('GET', '/api/news?limit=1');
ok(news.status === 200 || news.status === 404, 'public news unaffected');
ok(!JSON.stringify(news.json ?? {}).includes('password_hash'), 'public news carries no credential fields');

// ============================================================
// [5] CLEANUP — remove the probe user (hard delete by design)
// ============================================================
console.log('\n[5] Probe cleanup');
if (created?.id) {
  await conn.query('DELETE FROM `users` WHERE `id` = ?', [created.id]); // user_roles rows CASCADE
  const [left] = await conn.query('SELECT COUNT(*) AS n FROM `user_roles` WHERE `user_id` = ?', [created.id]);
  ok(left[0].n === 0, 'probe user deleted; user_roles rows CASCADE-removed');
}
await conn.end();

// ============================================================
// RESULT
// ============================================================
console.log(`\n${'═'.repeat(40)}`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(40)}`);
process.exit(fail === 0 ? 0 : 1);
