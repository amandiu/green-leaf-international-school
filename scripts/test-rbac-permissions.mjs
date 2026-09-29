// ------------------------------------------------------------
// Phase C.7 — RBAC / permission enforcement verification suite
// Run from repo root:  node scripts/test-rbac-permissions.mjs
//
// Requires: server on :5000 (or C7_TEST_BASE) + MariaDB up.
// Verifies: the §AN.5 permission model — catalog integrity, the
// admin → * wildcard, LIVE resolution (grant/revoke take effect
// within the approved 30s cache TTL), 401 vs 403 semantics,
// non-admin CMS denial, privilege-escalation attempts, and the
// C2/C3/C4/C5/C6 regression boundaries.
//
// Live non-admin authenticated identity: the C4 login issues
// sessions ONLY to admin-role identities (login boundary — §AN.14;
// portal logins are Phase N). To exercise a valid session whose
// live roles are NON-admin, the staff probe logs in while holding
// the admin role and the admin membership is then revoked in the
// DB — exactly the C6-suite revocation pattern. The stateless
// session stays cryptographically valid; requirePermission's live
// resolution now yields only the student role.
// ------------------------------------------------------------

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

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
const BASE = process.env.C7_TEST_BASE || 'http://127.0.0.1:5000';

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
  return { status: res.status, json, text, setCookie };
}

const conn = await mysql.createConnection({ ...DB, multipleStatements: false, timezone: 'Z' });
const q = async (sql, params) => (await conn.query(sql, params))[0];

const { createUser } = await import('../server/src/services/identityService.js');
const { PERMISSION_KEYS, ROLE_CODES } = await import('../server/src/validators/identityValidation.js');

// Janitor for earlier interrupted runs.
{
  const stale = await q("SELECT id FROM users WHERE email LIKE 'c7-%'");
  if (stale.length > 0) {
    await conn.query("DELETE FROM users WHERE email LIKE 'c7-%'");
    console.log(`  (janitor: removed ${stale.length} probe identity/ies)`);
  }
}

const adminUsersBefore = await q('SELECT id, email, password_hash, name, is_active, created_at, updated_at FROM admin_users ORDER BY id');
const usersBefore = (await q('SELECT COUNT(*) AS n FROM users'))[0].n;
const rpBefore = await q('SELECT role_id, permission_key FROM role_permissions ORDER BY role_id, permission_key');
const STAMP = Date.now();
const ADMIN_EMAIL = `c7-admin-${STAMP}@greenleaf.test`;
const STAFF_EMAIL = `c7-staff-${STAMP}@greenleaf.test`;
const PASSWORD = 'C7Probe-pass-123';

// ============================================================
// [A/B/C] CATALOGS + role_permissions INTEGRITY
// ============================================================
console.log('\n[A/B/C] Catalogs + role_permissions integrity');
{
  // Baseline visibility: the approved C7 end-state is an EMPTY
  // role_permissions (§AN.17 C7 row: DB "none" — no seeds). If a
  // previous CRASHED run left probe grants behind, name them here
  // so the operator can judge (the [X] restore is snapshot-faithful,
  // not clairvoyant).
  if (rpBefore.length > 0) {
    console.log(`  (note: role_permissions already holds ${rpBefore.length} row(s) BEFORE this run: ${JSON.stringify(rpBefore)})`);
  }
  ok(ROLE_CODES.length === 4 && ROLE_CODES.includes('admin'), '§AN.4 role catalog intact (4 codes, admin present)');
  ok(PERMISSION_KEYS.includes('users.manage') && PERMISSION_KEYS.includes('content.write') && PERMISSION_KEYS.includes('content.read'),
    '§AN.5 whitelist carries the required keys');
  ok(PERMISSION_KEYS.every((k) => /^[a-z]+\.[a-z]+$/.test(k)), 'whitelist keys follow the code convention');
  const catalog = await q('SELECT code, is_active FROM roles');
  ok(catalog.length === 4, 'role catalog table unchanged (4 rows)');
  const dupes = await q('SELECT role_id, permission_key, COUNT(*) AS n FROM role_permissions GROUP BY role_id, permission_key HAVING n > 1');
  ok(dupes.length === 0, 'no duplicate role-permission pairs');
  const orphans = await q('SELECT COUNT(*) AS n FROM role_permissions rp LEFT JOIN roles r ON r.id = rp.role_id WHERE r.id IS NULL');
  ok(Number(orphans[0].n) === 0, 'no orphan role_permissions rows');
}

// ============================================================
// [D/E/F] PERMISSION ASSIGNMENT / RESOLUTION (service level)
// ============================================================
console.log('\n[D/E/F] Permission assignment → cache resolution');
{
  const studentRole = (await q("SELECT id FROM roles WHERE code = 'student'"))[0];
  await conn.query(
    'INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?) ON DUPLICATE KEY UPDATE permission_key = permission_key',
    [studentRole.id, 'content.read'],
  );
  const staffProbe = await createUser(
    { email: STAFF_EMAIL, name: 'C7 Staff Probe', roles: ['admin', 'student'], primaryRole: 'admin' },
    { password: PASSWORD },
  );
  ok(staffProbe?.id > 0, 'staff probe created (admin role for the C4 login boundary; student for the permission test)');
  const { getRolePermissions, clearPermissionCache } = await import('../server/src/services/identityService.js');
  clearPermissionCache();
  const keys = await getRolePermissions(studentRole.id);
  ok(keys.includes('content.read'), 'getRolePermissions resolves the seeded row through the cache');
}

// ============================================================
// [G/I/J/K] GATE SEMANTICS over HTTP
// ============================================================
console.log('\n[G/I/J/K] requirePermission semantics (live HTTP)');
const staffJar = {};
const adminJar = {};
{
  await createUser(
    { email: ADMIN_EMAIL, name: 'C7 Admin Probe', roles: ['admin'], primaryRole: 'admin' },
    { password: PASSWORD },
  );
  const aLg = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: PASSWORD }, jar: adminJar });
  const sLg = await api('POST', '/api/auth/login', { body: { email: STAFF_EMAIL, password: PASSWORD }, jar: staffJar });
  ok(aLg.status === 200 && sLg.status === 200, 'both probe identities log in (admin-role boundary satisfied at login)');

  // Revoke the staff probe's ADMIN membership → its live roles are
  // now [student] only. The stateless session remains valid.
  const staff = (await q('SELECT id FROM users WHERE email = ?', [STAFF_EMAIL]))[0];
  await conn.query("DELETE ur FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.code = 'admin'", [staff.id]);

  const unauth = await api('GET', '/api/admin/users');
  ok(unauth.status === 401, 'unauthenticated → 401 (adminAuth gate FIRST)');

  const staffUsers = await api('GET', '/api/admin/users', { jar: { cookie: staffJar.cookie } });
  ok(staffUsers.status === 403, `non-admin live roles on the users.manage surface → 403 (got ${staffUsers.status})`);
  ok(staffUsers.json?.message && !JSON.stringify(staffUsers.json).includes('users.manage'), '403 message is generic (no permission-name leak)');

  const staffInbox = await api('GET', '/api/admin/contact-messages', { jar: { cookie: staffJar.cookie } });
  ok(staffInbox.status === 200, `staff WITH content.read reads the contact inbox → 200 (got ${staffInbox.status})`);

  const staffWrite = await api('PATCH', '/api/admin/contact-messages/999999/status', {
    jar: { cookie: staffJar.cookie }, body: { status: 'READ' },
  });
  ok(staffWrite.status === 403, `staff WITHOUT content.write on a write route → 403 (got ${staffWrite.status})`);

  const adminUsers = await api('GET', '/api/admin/users', { jar: { cookie: adminJar.cookie } });
  ok(adminUsers.status === 200, 'admin (wildcard) on users.manage surface → 200');
  const adminNews = await api('GET', '/api/admin/news?limit=1', { jar: { cookie: adminJar.cookie } });
  ok(adminNews.status === 200, 'admin (wildcard) on content router → 200');
}

// ============================================================
// [N/O] CACHE TTL + grant/revoke LIVENESS
// ============================================================
console.log('\n[N/O] Cache TTL + grant/revoke liveness (≤ approved 30s)');
{
  const studentRole = (await q("SELECT id FROM roles WHERE code = 'student'"))[0];

  await conn.query('DELETE FROM role_permissions WHERE role_id = ? AND permission_key = ?', [studentRole.id, 'content.read']);
  let deniedAt = -1;
  for (let waited = 0; waited <= 35_000; waited += 5_000) {
    const r = await api('GET', '/api/admin/contact-messages', { jar: { cookie: staffJar.cookie } });
    if (r.status === 403) { deniedAt = waited; break; }
    if (waited < 35_000) await new Promise((res) => setTimeout(res, 5_000));
  }
  ok(deniedAt >= 0, `revoked permission denies access within the approved cache semantics (~${deniedAt / 1000}s; TTL 30s)`);

  await conn.query('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)', [studentRole.id, 'content.read']);
  let regainedAt = -1;
  for (let waited = 0; waited <= 35_000; waited += 5_000) {
    const r = await api('GET', '/api/admin/contact-messages', { jar: { cookie: staffJar.cookie } });
    if (r.status === 200) { regainedAt = waited; break; }
    if (waited < 35_000) await new Promise((res) => setTimeout(res, 5_000));
  }
  ok(regainedAt >= 0, `granted permission restores access within the approved cache semantics (~${regainedAt / 1000}s)`);
}

// ============================================================
// [L/M] ROLE REMOVAL / RESTORATION
// ============================================================
console.log('\n[L/M] Role removal → permission disappears; restore → returns');
{
  const staff = (await q('SELECT id FROM users WHERE email = ?', [STAFF_EMAIL]))[0];
  await conn.query("DELETE ur FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.code = 'student'", [staff.id]);
  let denied = false;
  for (let waited = 0; waited <= 35_000; waited += 5_000) {
    const r = await api('GET', '/api/admin/contact-messages', { jar: { cookie: staffJar.cookie } });
    if (r.status === 403) { denied = true; break; }
    if (waited < 35_000) await new Promise((res) => setTimeout(res, 5_000));
  }
  ok(denied, 'role removed → inherited permission disappears (live resolution)');

  await conn.query("INSERT INTO user_roles (user_id, role_id, is_primary) VALUES (?, (SELECT id FROM roles WHERE code = 'student'), 1)", [staff.id]);
  let restored = false;
  for (let waited = 0; waited <= 35_000; waited += 5_000) {
    const r = await api('GET', '/api/admin/contact-messages', { jar: { cookie: staffJar.cookie } });
    if (r.status === 200) { restored = true; break; }
    if (waited < 35_000) await new Promise((res) => setTimeout(res, 5_000));
  }
  ok(restored, 'role restored → permission returns (same approved semantics)');
}

// ============================================================
// [P/Q] PRIVILEGE ESCALATION + IDOR ATTEMPTS (+ deactivation)
// ============================================================
console.log('\n[P/Q] Privilege escalation + IDOR + fail-closed identity');
{
  const escalate = await api('POST', '/api/admin/users', {
    jar: { cookie: staffJar.cookie },
    body: { email: `c7-escalated-${STAMP}@greenleaf.test`, roles: ['admin'], password: 'Escalate-123' },
  });
  ok(escalate.status === 403, 'non-admin authenticated identity cannot create an admin identity (403)');

  const selfRole = await api('POST', '/api/admin/users/999999/roles', {
    jar: { cookie: staffJar.cookie }, body: { role: 'admin', makePrimary: true },
  });
  ok(selfRole.status === 403, 'non-admin cannot assign roles (403)');

  // No client-supplied identity/role/permission input is honored —
  // the gates derive everything from the session subject + DB.
  const staffInbox = await api('GET', '/api/admin/contact-messages', {
    jar: { cookie: staffJar.cookie },
    headers: { 'X-User-Id': '1', 'X-Role': 'admin', 'X-Permission': '*' },
  });
  ok(staffInbox.status === 200, 'client-supplied identity headers are IGNORED (unchanged, legitimate read)');
  const staffUsers = await api('GET', '/api/admin/users', { jar: { cookie: staffJar.cookie }, headers: { 'X-Role': 'admin' } });
  ok(staffUsers.status === 403, 'X-Role header grants nothing (403 persists)');

  // Deactivated identity → fail closed (identity check is NOT cached).
  const staff = (await q('SELECT id FROM users WHERE email = ?', [STAFF_EMAIL]))[0];
  await conn.query('UPDATE users SET is_active = 0 WHERE id = ?', [staff.id]);
  const deactivated = await api('GET', '/api/admin/contact-messages', { jar: { cookie: staffJar.cookie } });
  ok(deactivated.status === 403, 'deactivated identity → 403 (fail closed, immediately)');
  await conn.query('UPDATE users SET is_active = 1 WHERE id = ?', [staff.id]);
}

// ============================================================
// [R] C6 INTEGRATION
// ============================================================
console.log('\n[R] C6 integration (requirePermission + preserved service check)');
{
  const admin = (await q('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]))[0];
  await conn.query("DELETE ur FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.code = 'admin'", [admin.id]);
  const revokedAdmin = await api('GET', '/api/admin/users', { jar: { cookie: adminJar.cookie } });
  ok(revokedAdmin.status === 403, 'admin-role revoked → 403 (coarse gate AND C6 service check agree)');
  await conn.query("INSERT INTO user_roles (user_id, role_id, is_primary) VALUES (?, (SELECT id FROM roles WHERE code = 'admin'), 1)", [admin.id]);
  const restoredAdmin = await api('GET', '/api/admin/users', { jar: { cookie: adminJar.cookie } });
  ok(restoredAdmin.status === 200, 'admin-role restored → 200 (C6 behavior preserved)');
}

// ============================================================
// [S/T/U/V] C4/C5/C2/C3 REGRESSION
// ============================================================
console.log('\n[S/T/U/V] C4/C5/C2/C3 regression');
{
  const bad = await api('POST', '/api/auth/login', { body: { email: 'nobody@x.test', password: 'wrong-123' } });
  ok(bad.status === 401 && bad.json?.message === 'Invalid email or password.', 'C4 generic login 401 unchanged');

  const me = await api('GET', '/api/auth/me', { jar: { cookie: adminJar.cookie } });
  ok(me.status === 200 && me.json?.data?.user?.email === ADMIN_EMAIL, 'C4 /me unchanged');
  ok(!JSON.stringify(me.json).includes('password_hash') && !JSON.stringify(me.json).includes('password_changed_at'), 'C4 /me projection credential-free');

  // C5: re-arm the staff probe with its admin role, log in, change
  // the password, verify the session dies (pwdAt invalidation).
  const staff = (await q('SELECT id FROM users WHERE email = ?', [STAFF_EMAIL]))[0];
  await conn.query("INSERT IGNORE INTO user_roles (user_id, role_id, is_primary) SELECT ?, id, 0 FROM roles WHERE code = 'admin'", [staff.id]);
  const tJar = {};
  const tLogin = await api('POST', '/api/auth/login', { body: { email: STAFF_EMAIL, password: PASSWORD }, jar: tJar });
  ok(tLogin.status === 200, 'staff re-armed and logged in for the C5 check');
  const changed = await api('POST', '/api/auth/change-password', {
    jar: { cookie: tJar.cookie },
    body: { currentPassword: PASSWORD, newPassword: 'C7-NewPass-456' },
  });
  ok(changed.status === 200, 'C5 change-password functional');
  const meAfter = await api('GET', '/api/auth/me', { jar: { cookie: tJar.cookie } });
  ok(meAfter.status === 401, 'C5 pwdAt invalidation functional (session died at the stamp)');

  const { USER_LINK_COLUMN, parseUserId } = await import('../server/src/services/ownershipScoping.js');
  ok(USER_LINK_COLUMN === 'user_id' && parseUserId('9') === 9, 'C3 helpers intact');
}

// ============================================================
// [W] CMS REGRESSION — §AN.17 acceptance: existing routes pass
// ============================================================
console.log('\n[W] CMS regression (admin wildcard passes every gate)');
{
  const created = await api('POST', '/api/admin/news', {
    jar: { cookie: adminJar.cookie },
    body: { title: `C7 probe ${STAMP}`, slug: `c7-probe-${STAMP}`, type: 'NEWS', content: 'C7 verification probe — deleted by the suite.', status: 'DRAFT' },
  });
  ok(created.status === 201 || created.status === 200, 'news CRUD passes the content.write gate (admin)');
  const id = created.json?.id ?? created.json?.data?.id;
  if (id) {
    const del = await api('DELETE', `/api/admin/news/${id}`, { jar: { cookie: adminJar.cookie } });
    ok(del.status === 200 || del.status === 204, 'news delete passes (probe cleaned)');
  }
  const settings = await api('GET', '/api/admin/settings', { jar: { cookie: adminJar.cookie } });
  ok(settings.status === 200, 'settings router passes');
  const nav = await api('GET', '/api/admin/navigation', { jar: { cookie: adminJar.cookie } });
  ok(nav.status === 200, 'navigation router passes');
  const uploads = await api('POST', '/api/admin/uploads/image', { jar: { cookie: adminJar.cookie }, body: {} });
  ok([400, 422].includes(uploads.status), 'uploads router reachable (validation-level response, not 403)');
  const pages = await api('GET', '/api/admin/pages/home', { jar: { cookie: adminJar.cookie } });
  ok(pages.status === 200, 'page-sections admin router passes');
  const blocks = await api('GET', '/api/admin/content/blocks', { jar: { cookie: adminJar.cookie } });
  ok(blocks.status === 200, 'content-blocks admin router passes');
  const downloads = await api('GET', '/api/admin/downloads?limit=1', { jar: { cookie: adminJar.cookie } });
  ok(downloads.status === 200, 'downloads admin router passes');
  const gallery = await api('GET', '/api/admin/gallery?limit=1', { jar: { cookie: adminJar.cookie } });
  ok(gallery.status === 200, 'gallery admin router passes');
  const leadership = await api('GET', '/api/admin/leadership-messages', { jar: { cookie: adminJar.cookie } });
  ok(leadership.status === 200, 'leadership admin router passes');

  // Deprecated ADMIN_TOKEN script path (§AN.14.4) still passes the
  // permission gates: a Bearer call authorizes as a legacy script
  // consumer without a canonical identity.
  if (process.env.ADMIN_TOKEN) {
    const bearerNav = await api('GET', '/api/admin/navigation', { headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` } });
    ok(bearerNav.status === 200, 'ADMIN_TOKEN Bearer path passes the C7 gates (legacy script consumer)');
  }
}

// ============================================================
// [X] CLEANUP + FINAL STATE
// ============================================================
console.log('\n[X] Cleanup + final state');
{
  await conn.query("DELETE FROM users WHERE email LIKE 'c7-%'");
  const usersAfter = (await q('SELECT COUNT(*) AS n FROM users'))[0].n;
  ok(usersAfter === usersBefore, `users count restored (${usersBefore})`);

  await conn.query('DELETE FROM role_permissions');
  for (const row of rpBefore) {
    await conn.query('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)', [row.role_id, row.permission_key]);
  }
  const rpAfter = await q('SELECT role_id, permission_key FROM role_permissions ORDER BY role_id, permission_key');
  ok(JSON.stringify(rpAfter) === JSON.stringify(rpBefore), `role_permissions restored byte-identical (${rpBefore.length} rows — empty table per the C6 handoff)`);

  const adminUsersAfter = await q('SELECT id, email, password_hash, name, is_active, created_at, updated_at FROM admin_users ORDER BY id');
  ok(JSON.stringify(adminUsersAfter) === JSON.stringify(adminUsersBefore), 'admin_users byte-identical');

  const orphanRoles = (await q('SELECT COUNT(*) AS n FROM user_roles ur LEFT JOIN users u ON u.id = ur.user_id WHERE u.id IS NULL'))[0].n;
  ok(Number(orphanRoles) === 0, 'no orphan user_roles');
}

console.log(`\n${'═'.repeat(40)}`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(40)}`);
await conn.end();
process.exit(fail === 0 ? 0 : 1);
