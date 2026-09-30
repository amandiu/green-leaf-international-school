#!/usr/bin/env node
// ------------------------------------------------------------
// Phase D.4 — least-privilege defaults verification suite
// Run from repo root:  node scripts/test-d4-least-privilege.mjs
//
// Requires: server on :5000 (or D4_TEST_BASE) + MariaDB up.
// Verifies the authoritative D4 contract — MASTER_PLAN Phase D
// item 4 ("Apply least-privilege defaults; all existing admin
// routes keep working", exit: "two admins with different roles
// demonstrably see different permissions") + SYSTEM_DESIGN §2/§Y.8
// ("default DENY") + §AN.4/§AN.5 (catalog-bound roles, code-
// whitelisted permissions, empty role_permissions, admin → *):
//   [A] creation defaults — roles are EXPLICIT (missing/null/
//       empty/unknown → 400); new users receive NO implicit
//       permissions (role_permissions stays empty; the audited
//       USER_CREATE meta carries role codes only)
//   [C] unknown/forged roles cannot exist or authorize: HTTP
//       whitelist 400, DB FK integrity, non-admin login → 401
//   [D] a live session whose identity has NO active roles is
//       denied everywhere (default deny, gate + service layers)
//   [E] missing/unknown permission keys deny (no client-facing
//       permission surface exists at all)
//   [F/I] permission enforcement + grant/revoke liveness within
//       the approved §AN.5 cache semantics (≤30s TTL)
//   [J] THE PHASE D EXIT CRITERION: two admins with different
//       roles demonstrably see different permissions — and a
//       role-scoped admin cannot grant itself privileges
//   [X] cleanup: probes removed, catalogs restored byte-identical
//
// Convention (C5/C7 suites): live HTTP + live DB, ✔/✖ checks,
// "RESULT: n passed, n failed" line, non-zero exit on failure.
// ------------------------------------------------------------

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

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
const BASE = process.env.D4_TEST_BASE || 'http://127.0.0.1:5000';

// timezone:'Z' mirrors the server pool (config/db.js).
const conn = await mysql.createConnection({ ...DB, multipleStatements: false, timezone: 'Z' });
const q = async (sql, params) => (await conn.query(sql, params))[0];

// ------------------------------------------------------------
// Harness (C5/C7 convention)
// ------------------------------------------------------------

let pass = 0;
let fail = 0;
function ok(cond, label) {
  if (cond) { pass += 1; console.log(`  ✔ ${label}`); }
  else { fail += 1; console.log(`  ✖ ${label}`); }
}

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

// Server-side identity services (imported AFTER .env load) — the
// SAME primitives the C2/C7/D3 suites use for probe identity setup.
const { createUser } = await import('../server/src/services/identityService.js');
const { recordAdminMutation } = await import('../server/src/services/auditLogService.js');

// Janitor: a previous crashed run may have left probe identities
// behind. role_permissions is restored from the snapshot in [X]
// regardless of how a previous run ended.
{
  const stale = await q("SELECT id FROM users WHERE email LIKE 'd4-%'");
  if (stale.length > 0) {
    await conn.query("DELETE FROM users WHERE email LIKE 'd4-%'");
    console.log(`  (janitor: removed ${stale.length} stale probe identity/ies)`);
  }
}

// Baselines (restored byte-identical in [X]).
const usersCountBefore = Number((await q('SELECT COUNT(*) AS n FROM users'))[0].n);
const rpBefore = await q('SELECT role_id, permission_key FROM role_permissions ORDER BY role_id, permission_key');
const adminUsersBefore = await q('SELECT id, email, password_hash, name, is_active, created_at, updated_at FROM admin_users ORDER BY id');

const STAMP = Date.now().toString(36);
const ADMIN_EMAIL = `d4-admin-${STAMP}@greenleaf.test`;
const STAFF_EMAIL = `d4-staff-${STAMP}@greenleaf.test`;
const ROLELESS_EMAIL = `d4-roleless-${STAMP}@greenleaf.test`;
const PASSWORD = 'D4Probe-pass-123';

const auditBaselineId = Number((await q('SELECT COALESCE(MAX(id), 0) AS m FROM audit_logs'))[0].m);

// ------------------------------------------------------------
// Probe identities
// ------------------------------------------------------------
const adminProbe = await createUser(
  { email: ADMIN_EMAIL, name: 'D4 Admin Probe', roles: ['admin'], primaryRole: 'admin' },
  { password: PASSWORD },
);
const staffProbe = await createUser(
  // admin role ONLY to satisfy the C4 login boundary (the D3/C7
  // pattern); it is stripped immediately after login so the live
  // roles become [student].
  { email: STAFF_EMAIL, name: 'D4 Staff Probe', roles: ['admin', 'student'], primaryRole: 'admin' },
  { password: PASSWORD },
);
// A student-only identity: proves the login boundary (no session
// without the admin role) — never expected to authenticate.
await createUser(
  { email: ROLELESS_EMAIL, name: 'D4 Roleless Probe', roles: ['student'], primaryRole: 'student' },
  { password: PASSWORD },
);

const adminJar = {};
const staffJar = {};
{
  const aLg = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: PASSWORD }, jar: adminJar });
  const sLg = await api('POST', '/api/auth/login', { body: { email: STAFF_EMAIL, password: PASSWORD }, jar: staffJar });
  ok(aLg.status === 200 && sLg.status === 200, 'both admin-role probes log in (C4 boundary satisfied)');
}

// The staff probe's live roles become [student] ONLY.
const staffId = staffProbe.id;
await conn.query(
  "DELETE ur FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.code = 'admin'",
  [staffId],
);

// ------------------------------------------------------------
// [A] Creation defaults — explicit roles, NO implicit privileges
// ------------------------------------------------------------
console.log('\n[A] New-user defaults (least privilege at creation)');
{
  // Missing / null / empty roles → 400 (the server NEVER invents a
  // default role — §AN.4: every user gets ≥1 EXPLICIT role).
  const noRoles = await api('POST', '/api/admin/users', {
    jar: { cookie: adminJar.cookie }, body: { email: `d4-x-a-${STAMP}@greenleaf.test`, name: 'no roles' },
  });
  ok(noRoles.status === 400, `missing roles → 400 (no implicit default role; got ${noRoles.status})`);
  ok(/non-empty array/.test(noRoles.json?.message || ''), 'missing roles → the explicit "non-empty array" contract message');

  const nullRoles = await api('POST', '/api/admin/users', {
    jar: { cookie: adminJar.cookie }, body: { email: `d4-x-b-${STAMP}@greenleaf.test`, roles: null },
  });
  ok(nullRoles.status === 400, `null roles → 400 (got ${nullRoles.status})`);

  const emptyRoles = await api('POST', '/api/admin/users', {
    jar: { cookie: adminJar.cookie }, body: { email: `d4-x-c-${STAMP}@greenleaf.test`, roles: [] },
  });
  ok(emptyRoles.status === 400, `empty roles array → 400 (got ${emptyRoles.status})`);

  // Permissions: NO mechanism grants any permission at creation —
  // permissions derive ONLY from role_permissions rows (§AN.5).
  const rp = await q('SELECT COUNT(*) AS n FROM role_permissions');
  ok(Number(rp[0].n) === rpBefore.length, `creation grants no permission rows (role_permissions still ${rpBefore.length} rows)`);
  const permColumns = await q(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'",
  );
  ok(!permColumns.some((c) => /permission/i.test(c.COLUMN_NAME)), 'no per-user permission storage exists (§AN.5: role-derived only)');

  // The audited USER_CREATE meta carries role CODES only — no
  // permission material exists to leak (§AN.19 + D4 defaults).
  const beforeAudit = Number((await q('SELECT COALESCE(MAX(id), 0) AS m FROM audit_logs'))[0].m);
  const probeCreate = await api('POST', '/api/admin/users', {
    jar: { cookie: adminJar.cookie },
    body: { email: `d4-x-d-${STAMP}@greenleaf.test`, name: 'meta probe', roles: ['student'], password: PASSWORD },
  });
  ok(probeCreate.status === 201, 'explicit-role creation succeeds (student role)');
  const auditRow = (await q('SELECT meta FROM audit_logs WHERE id > ? ORDER BY id DESC LIMIT 1', [beforeAudit]))[0];
  const meta = auditRow?.meta ? JSON.parse(auditRow.meta) : null;
  ok(meta && meta.roles === 'student' && Object.keys(meta).length === 1,
    'USER_CREATE audit meta = assigned role codes ONLY (no implicit permission fields)');
  ok(!JSON.stringify(probeCreate.json).toLowerCase().includes('permission'),
    'created-user projection carries NO permission fields');
  // remove the meta probe + its audit rows (restore the baseline)
  const createdId = probeCreate.json?.data?.user?.id;
  await conn.query('DELETE FROM audit_logs WHERE id > ?', [beforeAudit]);
  await conn.query('DELETE FROM users WHERE id = ?', [createdId]);
  void recordAdminMutation; // imported to prove the seam exists; unused here
}

// ------------------------------------------------------------
// [C] Unknown / forged roles cannot exist or authorize
// ------------------------------------------------------------
console.log('\n[C] Unknown / forged roles (fail closed)');
{
  const forged = await api('POST', '/api/admin/users', {
    jar: { cookie: adminJar.cookie },
    body: { email: `d4-x-e-${STAMP}@greenleaf.test`, roles: ['superadmin'], password: PASSWORD },
  });
  ok(forged.status === 400 && /role must be one of/.test(forged.json?.message || ''),
    `forged role "superadmin" → 400 catalog whitelist (got ${forged.status})`);

  // DB integrity: even bypassing every API layer, an unknown role
  // row cannot exist (FK to the seeded catalog).
  let fkErr = null;
  try {
    await conn.query(
      'INSERT INTO user_roles (user_id, role_id, is_primary) VALUES (?, 999999, 1)',
      [staffId],
    );
  } catch (err) { fkErr = err; }
  ok(fkErr !== null, `direct-DB unknown role is impossible (FK integrity: ${fkErr?.code ?? 'no error'})`);

  // A non-admin identity CANNOT obtain a session (C4 login
  // boundary) — a forged/stolen student identity stays locked out.
  const rolelessLogin = await api('POST', '/api/auth/login', {
    body: { email: ROLELESS_EMAIL, password: PASSWORD },
  });
  ok(rolelessLogin.status === 401, `non-admin identity login → 401 (no session without the admin role; got ${rolelessLogin.status})`);
}

// ------------------------------------------------------------
// [D] Missing role on a LIVE session → denied everywhere
// ------------------------------------------------------------
console.log('\n[D] Live session with ZERO active roles (default deny)');
{
  const allRoles = await q('SELECT COUNT(*) AS n FROM user_roles WHERE user_id = ?', [staffId]);
  ok(Number(allRoles[0].n) === 1, 'staff probe now holds exactly the student role');

  await conn.query('DELETE FROM user_roles WHERE user_id = ?', [staffId]);
  const denied = await api('GET', '/api/admin/users', { jar: { cookie: staffJar.cookie } });
  ok(denied.status === 403, `role-less live session on the users surface → 403 (got ${denied.status})`);
  ok(!JSON.stringify(denied.json).includes('role') && !JSON.stringify(denied.json).includes('users.manage'),
    '403 message is generic (no role/permission detail leak)');

  // Restore the student role (non-primary is fine; identity still
  // active) for the permission tests below.
  await conn.query(
    "INSERT INTO user_roles (user_id, role_id, is_primary) VALUES (?, (SELECT id FROM roles WHERE code = 'student'), 0)",
    [staffId],
  );
}

// ------------------------------------------------------------
// [E] Missing / unknown permission keys → default deny
// ------------------------------------------------------------
console.log('\n[E] Missing + unknown permissions (default deny)');
{
  // The student role maps ZERO permission keys (role_permissions is
  // empty by design — §AN.5/§AN.17), so every gated action denies.
  const inbox = await api('GET', '/api/admin/contact-messages', { jar: { cookie: staffJar.cookie } });
  ok(inbox.status === 403, `student role with NO mapped permissions on content.read → 403 (got ${inbox.status})`);

  const write = await api('PATCH', '/api/admin/contact-messages/999999/status', {
    jar: { cookie: staffJar.cookie }, body: { status: 'READ' },
  });
  ok(write.status === 403, `student role on a content.write route → 403 (got ${write.status})`);

  // No client-facing surface can grant a permission key at all:
  // permission management is deliberately NOT an API (§AN.5 defers
  // it; unknown keys fail closed in the gate whitelist).
  const grantAttempt = await api('POST', '/api/admin/roles/permissions', {
    jar: { cookie: adminJar.cookie }, body: { role: 'student', permission: '*' },
  });
  ok(grantAttempt.status === 404, `permission-grant attempt → 404 (no such surface exists; got ${grantAttempt.status})`);
}

// ------------------------------------------------------------
// [F/I] Permission enforcement + grant/revoke liveness (≤30s TTL)
// ------------------------------------------------------------
console.log('\n[F/I] Grant → allowed; revoke → denied (approved cache semantics)');
const studentRole = (await q("SELECT id FROM roles WHERE code = 'student'"))[0];
{
  await conn.query('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)', [studentRole.id, 'content.read']);
  let allowedAt = -1;
  for (let waited = 0; waited <= 35_000; waited += 5_000) {
    const r = await api('GET', '/api/admin/contact-messages', { jar: { cookie: staffJar.cookie } });
    if (r.status === 200) { allowedAt = waited; break; }
    if (waited < 35_000) await new Promise((res) => setTimeout(res, 5_000));
  }
  ok(allowedAt >= 0, `granted content.read allows the inbox within the approved TTL (~${allowedAt / 1000}s)`);

  // The SAME role-scoped identity still lacks content.write —
  // one granted key never becomes broad access.
  const stillDenied = await api('PATCH', '/api/admin/contact-messages/999999/status', {
    jar: { cookie: staffJar.cookie }, body: { status: 'READ' },
  });
  ok(stillDenied.status === 403, `granted content.read does NOT leak into content.write → 403 (got ${stillDenied.status})`);

  await conn.query('DELETE FROM role_permissions WHERE role_id = ? AND permission_key = ?', [studentRole.id, 'content.read']);
  let deniedAt = -1;
  for (let waited = 0; waited <= 35_000; waited += 5_000) {
    const r = await api('GET', '/api/admin/contact-messages', { jar: { cookie: staffJar.cookie } });
    if (r.status === 403) { deniedAt = waited; break; }
    if (waited < 35_000) await new Promise((res) => setTimeout(res, 5_000));
  }
  ok(deniedAt >= 0, `revoked content.read denies within the approved TTL (~${deniedAt / 1000}s)`);
}

// ------------------------------------------------------------
// [J] PHASE D EXIT CRITERION — two admins demonstrably differ
// ------------------------------------------------------------
console.log('\n[J] Exit criterion: different roles → demonstrably different permissions');
{
  // Re-grant so the role-scoped admin holds EXACTLY content.read.
  await conn.query('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)', [studentRole.id, 'content.read']);
  let ready = false;
  for (let waited = 0; waited <= 35_000 && !ready; waited += 5_000) {
    const r = await api('GET', '/api/admin/contact-messages', { jar: { cookie: staffJar.cookie } });
    ready = r.status === 200;
    if (!ready && waited < 35_000) await new Promise((res) => setTimeout(res, 5_000));
  }
  ok(ready, 'role-scoped admin prepared (student role + content.read only)');

  // Role-scoped admin: inbox YES (content.read), users surface NO
  // (users.manage), status write NO (content.write).
  const staffInbox = await api('GET', '/api/admin/contact-messages', { jar: { cookie: staffJar.cookie } });
  const staffUsers = await api('GET', '/api/admin/users', { jar: { cookie: staffJar.cookie } });
  const staffWrite = await api('PATCH', '/api/admin/contact-messages/999999/status', {
    jar: { cookie: staffJar.cookie }, body: { status: 'READ' },
  });
  ok(staffInbox.status === 200 && staffUsers.status === 403 && staffWrite.status === 403,
    `role-scoped admin: inbox 200 / users 403 / write 403 (got ${staffInbox.status}/${staffUsers.status}/${staffWrite.status})`);

  // Full admin (§AN.5 wildcard): the same surfaces all pass.
  const adminUsers = await api('GET', '/api/admin/users', { jar: { cookie: adminJar.cookie } });
  const adminInbox = await api('GET', '/api/admin/contact-messages', { jar: { cookie: adminJar.cookie } });
  const adminNews = await api('GET', '/api/admin/news?limit=1', { jar: { cookie: adminJar.cookie } });
  ok(adminUsers.status === 200 && adminInbox.status === 200 && adminNews.status === 200,
    `full admin (wildcard): users/inbox/news all 200 (got ${adminUsers.status}/${adminInbox.status}/${adminNews.status})`);
  ok(adminUsers.status !== staffUsers.status && adminInbox.status !== (staffInbox.status === 200 ? -1 : staffInbox.status),
    'the two admins demonstrably see DIFFERENT permissions on the same surfaces');

  // Escalation negative: the role-scoped admin cannot grant itself
  // more privileges (no users.manage → the assignment surface 403s
  // BEFORE any service logic runs).
  const selfEscalation = await api('POST', `/api/admin/users/${staffId}/roles`, {
    jar: { cookie: staffJar.cookie }, body: { role: 'admin', makePrimary: true },
  });
  ok(selfEscalation.status === 403, `role-scoped admin self-granting "admin" → 403 (got ${selfEscalation.status})`);
  const rolesAfter = await q('SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?', [staffId]);
  ok(!rolesAfter.some((r) => r.code === 'admin'), 'no privilege row was created by the denied escalation attempt');

  // All existing admin routes keep working (full admin sweep — the
  // D4 "keep working" clause; D3/C7 own the exhaustive versions).
  const surfaces = [
    ['GET', '/api/admin/navigation'],
    ['GET', '/api/admin/settings'],
    ['GET', '/api/admin/pages/home'],
    ['GET', '/api/admin/content/blocks'],
    ['GET', '/api/admin/downloads?limit=1'],
    ['GET', '/api/admin/gallery?limit=1'],
  ];
  let allPass = true;
  for (const [m, p] of surfaces) {
    const r = await api(m, p, { jar: { cookie: adminJar.cookie } });
    if (r.status !== 200) { allPass = false; console.log(`    (${m} ${p} → ${r.status})`); }
  }
  ok(allPass, 'all existing admin surfaces keep working as admin (least privilege did NOT break C7 routing)');
}

// ------------------------------------------------------------
// [X] Cleanup + byte-identical restore
// ------------------------------------------------------------
console.log('\n[X] Cleanup + restored state');
{
  await conn.query('DELETE FROM role_permissions');
  for (const row of rpBefore) {
    await conn.query('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)', [row.role_id, row.permission_key]);
  }
  const rpAfter = await q('SELECT role_id, permission_key FROM role_permissions ORDER BY role_id, permission_key');
  ok(JSON.stringify(rpAfter) === JSON.stringify(rpBefore), `role_permissions restored byte-identical (${rpBefore.length} rows)`);

  await conn.query('DELETE FROM audit_logs WHERE id > ?', [auditBaselineId]);
  await conn.query("DELETE FROM users WHERE email LIKE 'd4-%'");

  const usersCountAfter = Number((await q('SELECT COUNT(*) AS n FROM users'))[0].n);
  ok(usersCountAfter === usersCountBefore, `users count restored (${usersCountBefore})`);
  const catalog = await q('SELECT code, is_active FROM roles ORDER BY id');
  ok(catalog.length === 4, 'role catalog intact (4 seeded codes)');
  const adminUsersAfter = await q('SELECT id, email, password_hash, name, is_active, created_at, updated_at FROM admin_users ORDER BY id');
  ok(JSON.stringify(adminUsersAfter) === JSON.stringify(adminUsersBefore), 'admin_users byte-identical (untouched)');
  const residue = await q("SELECT COUNT(*) AS n FROM users WHERE email LIKE 'd4-%'");
  ok(Number(residue[0].n) === 0, 'no probe identities remain');
}

await conn.end();
console.log(`\n${'═'.repeat(40)}`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(40)}`);
process.exit(fail === 0 ? 0 : 1);
