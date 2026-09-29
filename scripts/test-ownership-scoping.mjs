// ------------------------------------------------------------
// Ownership-scoping helpers verification (Phase C.3)
// Run from repo root:  node scripts/test-ownership-scoping.mjs
//
// Requires: server on :5000 (or OWNERSHIP_TEST_BASE) + MariaDB up.
// Verifies: the C3 linking seam ONLY — canonical users.id
// conventions + §AN.6 scoping helper behavior (unit patterns +
// live-DB round-trips through the C2 identity tables) + the C3/C4
// boundary (no authentication behavior, no new HTTP surface, no
// admin change). NO new tables; NO auth path changes; probe rows
// are created through the C2 service and hard-deleted afterwards.
// ------------------------------------------------------------

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

// mysql2 lives in server/node_modules — resolve from the server
// package base, not the repo root.
const require = createRequire(
  pathToFileURL(resolve('server', 'package.json')),
);
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

const BASE = process.env.OWNERSHIP_TEST_BASE || 'http://127.0.0.1:5000';

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
// [1] UNIT PATTERNS — parseUserId / requireUserId (no DB)
// ============================================================
console.log('\n[1] Canonical users.id convention (parseUserId / requireUserId)');
const scope = await import('../server/src/services/ownershipScoping.js');
const {
  parseUserId, requireUserId, requireExistingUser, resolveOwnerScope,
  assertOwnedRow, ownedBy, listUserRoleCodes, USER_LINK_COLUMN,
} = scope;

ok(USER_LINK_COLUMN === 'user_id', 'canonical owner-link column is user_id (§AN.6)');

ok(parseUserId(1) === 1, 'parseUserId accepts a positive integer');
ok(parseUserId('42') === 42, 'parseUserId accepts a numeric string');
ok(parseUserId(4294967295) === 4294967295, 'parseUserId accepts the UNSIGNED INT maximum');
ok(parseUserId(0) === null, 'parseUserId rejects 0');
ok(parseUserId(-5) === null, 'parseUserId rejects negatives');
ok(parseUserId(1.5) === null, 'parseUserId rejects non-integers');
ok(parseUserId('4294967296') === null, 'parseUserId rejects values above the UNSIGNED INT domain');
ok(parseUserId('12abc') === null, 'parseUserId rejects mixed alphanumeric strings');
ok(parseUserId(' 12') === null, 'parseUserId rejects whitespace-padded strings');
ok(parseUserId('') === null, 'parseUserId rejects empty strings');
ok(parseUserId(null) === null, 'parseUserId rejects null');
ok(parseUserId(undefined) === null, 'parseUserId rejects undefined');
ok(parseUserId({ id: 1 }) === null, 'parseUserId rejects objects');
ok(parseUserId(NaN) === null, 'parseUserId rejects NaN');

try { requireUserId('nope'); ok(false, 'requireUserId throws 400 on invalid input'); }
catch (err) { ok(err?.status === 400, 'requireUserId throws the established 400 on invalid input'); }
try { requireUserId('7'); ok(true, 'requireUserId returns the id for valid input'); }
catch { ok(false, 'requireUserId returns the id for valid input'); }

// ============================================================
// [2] UNIT PATTERNS — resolveOwnerScope (§AN.6 contract)
// ============================================================
console.log('\n[2] resolveOwnerScope — requested id can confirm, never widen');
ok(
  JSON.stringify(resolveOwnerScope({ sessionUserId: 11 }))
    === JSON.stringify({ userId: 11 }),
  'session id alone → scope narrows to the session identity',
);
ok(
  JSON.stringify(resolveOwnerScope({ sessionUserId: 11, requestedUserId: 11 }))
    === JSON.stringify({ userId: 11 }),
  'requested id EQUAL to session → honored (confirm, not widen)',
);
ok(resolveOwnerScope({ sessionUserId: 11, requestedUserId: 12 }) === null,
  'requested id ≠ session → null (never widens)');
ok(resolveOwnerScope({ sessionUserId: 11, requestedUserId: '11' })?.userId === 11,
  'requested id as numeric string still canonically compares');
ok(resolveOwnerScope({ sessionUserId: 11, requestedUserId: 'abc' }) === null,
  'malformed requested id → null (fail-closed)');
ok(resolveOwnerScope({ sessionUserId: null }) === null,
  'missing session identity → null (unauthenticated = no scope)');
ok(resolveOwnerScope({}) === null,
  'no arguments → null (missing ownership info never means unrestricted)');
ok(resolveOwnerScope() === null,
  'undefined options object → null');

// ============================================================
// [3] UNIT PATTERNS — assertOwnedRow (fail-closed row check)
// ============================================================
console.log('\n[3] assertOwnedRow — a row must PROVE ownership');
const ownedRow = { id: 3, user_id: 11, title: 'x' };
ok(assertOwnedRow(ownedRow, 11) === ownedRow, 'row owned by the session identity → returned');
ok(assertOwnedRow(ownedRow, '11') === ownedRow, 'string session id compares canonically');
ok(assertOwnedRow({ ...ownedRow, user_id: 12 }, 11) === null, 'mismatched owner → null');
ok(assertOwnedRow({ id: 3, title: 'no owner key' }, 11) === null,
  'row WITHOUT ownership information → null (never treated as owned)');
ok(assertOwnedRow({ id: 3, user_id: null }, 11) === null, 'null owner value → null');
ok(assertOwnedRow(null, 11) === null, 'missing row → null');
ok(assertOwnedRow(ownedRow, undefined) === null, 'missing session identity → null');
ok(assertOwnedRow(ownedRow, 11, { ownerKey: 'owner_id' }) === null,
  'custom ownerKey mismatch → null');
const ownerKeyedRow = { id: 3, owner_id: 11 };
ok(assertOwnedRow(ownerKeyedRow, 11, { ownerKey: 'owner_id' }) === ownerKeyedRow,
  'custom ownerKey match → returned');

// ============================================================
// [4] UNIT PATTERNS — ownedBy (parameterized fragment builder)
// ============================================================
console.log('\n[4] ownedBy — parameterized WHERE scoping');
const frag = ownedBy(11);
ok(frag.fragment === ' AND `user_id` = ?', 'fragment embeds the canonical column with a placeholder');
ok(Array.isArray(frag.params) && frag.params.length === 1 && frag.params[0] === 11,
  'value is ALWAYS a bound parameter (never interpolated)');
const frag2 = ownedBy(11, { column: 'owner_id' });
ok(frag2.fragment === ' AND `owner_id` = ?' && frag2.params[0] === 11,
  'custom column composes the same way');
try { ownedBy(11, { column: 'user_id; DROP TABLE users' }); ok(false, 'hostile column rejected'); }
catch (err) { ok(err?.status === 400, 'hostile column identifier rejected with 400 BEFORE any query'); }
try { ownedBy('abc'); ok(false, 'invalid id rejected'); }
catch (err) { ok(err?.status === 400, 'invalid id rejected with 400'); }

// ============================================================
// [5] SOURCE BOUNDARY — no authentication in the helpers
// ============================================================
console.log('\n[5] C3/C4 boundary — helpers never authenticate');
const source = readFileSync('server/src/services/ownershipScoping.js', 'utf8');
// Precise scans: no imports/call-sites of authentication or
// authorization modules (mentions in prose comments are fine —
// CODE references are what would break the C3 boundary).
ok(!/from\s+['"][^'"]*(sessionAuth|sessionToken|cookieSession|deprecatedAdminToken)/.test(source),
  'no imports from session/token modules (authentication stays in middleware — C4)');
ok(!/verifySessionToken\s*\(|createSessionToken\s*\(/.test(source),
  'no session verify/issue call sites');
ok(!/req\.cookies|SESSION_COOKIE_NAME|headers\.authorization/.test(source),
  'no cookie/credential-header access (session identity is passed IN, never read here)');
ok(!/ADMIN_TOKEN/.test(source), 'no admin-token transition logic');
ok(!/(function\s+require(Role|Permission))|(import\s*\{[^}]*(requireRole|requirePermission))/.test(source),
  'no authorization gate definitions or imports (C7 concern — helpers only narrow)');
ok(!/(['"`])password_hash\1/.test(source),
  'no credential column in any SQL string (safe projection only)');

// ============================================================
// [6] LIVE DB — canonical id resolution through the C2 tables
// ============================================================
console.log('\n[6] Live DB — requireExistingUser / listUserRoleCodes (C2 tables reused)');
const conn = await mysql.createConnection({ ...DB, multipleStatements: false });
const { createUser } = await import('../server/src/services/identityService.js');

const probeEmail = `c3-probe-${Date.now()}@greenleaf.test`;
let probe = null;
try {
  probe = await createUser(
    { email: probeEmail, name: 'C3 Probe', roles: ['student', 'guardian'], primaryRole: 'student' },
    { password: 'probe-password-123' },
  );
  ok(probe?.id > 0, 'probe identity created via the C2 service (canonical users.id exists)');
} catch (err) {
  ok(false, `probe identity created via the C2 service (${err.message})`);
}

if (probe?.id) {
  // Active resolution
  try {
    const resolved = await requireExistingUser(probe.id);
    ok(resolved.id === probe.id && resolved.email === probeEmail,
      'requireExistingUser resolves an ACTIVE canonical id');
    ok(!('password_hash' in resolved) && !('passwordHash' in resolved),
      'resolved identity carries NO credential material');
  } catch (err) {
    ok(false, `requireExistingUser resolves an ACTIVE canonical id (${err.message})`);
  }

  // Deactivated resolution → fail-closed 404
  await conn.query('UPDATE `users` SET `is_active` = 0 WHERE `id` = ?', [probe.id]);
  try {
    await requireExistingUser(probe.id);
    ok(false, 'DEACTIVATED identity → fail-closed 404');
  } catch (err) {
    ok(err?.status === 404, 'DEACTIVATED identity → fail-closed 404 (ownership scope cannot resolve through it)');
  }
  await conn.query('UPDATE `users` SET `is_active` = 1 WHERE `id` = ?', [probe.id]);

  // Missing identity → fail-closed 404
  try {
    await requireExistingUser(4294967295);
    ok(false, 'missing identity → fail-closed 404');
  } catch (err) {
    ok(err?.status === 404, 'missing identity → fail-closed 404');
  }

  // Role codes (canonical join through user_roles → roles)
  try {
    const codes = await listUserRoleCodes(probe.id);
    ok(codes[0] === 'student' && codes.includes('guardian'),
      'listUserRoleCodes returns primary-first role codes for the canonical id');
  } catch (err) {
    ok(false, `listUserRoleCodes returns role codes (${err.message})`);
  }

  // Real composed parameterized query using the ownedBy fragment
  // (canonical id bound as a parameter end-to-end against users).
  const composed = ownedBy(probe.id, { column: 'id' });
  const [rows] = await conn.query(
    'SELECT `id`, `email` FROM `users` WHERE 1=1' + composed.fragment,
    composed.params,
  );
  ok(rows.length === 1 && rows[0].id === probe.id && rows[0].email === probeEmail,
    'ownedBy fragment composes a real parameterized query that matches ONLY the owner row');
  const [rows2] = await conn.query(
    'SELECT `id` FROM `users` WHERE 1=1' + ownedBy(4294967294, { column: 'id' }).fragment,
    [4294967294],
  );
  ok(rows2.length === 0, 'a different owner id matches NO rows (narrowing is real)');
}

// ============================================================
// [7] REGRESSION — admin auth + session + HTTP surface unchanged
// ============================================================
console.log('\n[7] Regression — existing auth untouched, no new identity HTTP surface');
const health = await api('GET', '/api/health');
ok(health.status === 200 && health.json?.success === true, 'GET /api/health → 200');

const badLogin = await api('POST', '/api/auth/login', { body: { email: 'nobody@x.com', password: 'wrong-pass-1' } });
ok(badLogin.status === 401 && badLogin.json?.message === 'Invalid email or password.',
  'existing login rejects bad credentials with the SAME generic 401 (no auth change)');

const me = await api('GET', '/api/auth/me');
ok(me.status === 401, 'GET /api/auth/me without session → 401 (session semantics unchanged)');

const logout = await api('POST', '/api/auth/logout');
ok(logout.status === 200, 'POST /api/auth/logout idempotent (unchanged)');

const adminGate = await api('GET', '/api/admin/news');
ok(adminGate.status === 401, 'existing adminAuth gate unchanged (401 without session)');

const users404 = await api('GET', '/api/users');
ok(users404.status === 404, 'GET /api/users → 404 (C3 added NO public identity surface)');
const adminUsers404 = await api('GET', '/api/admin/users');
ok(adminUsers404.status === 401 || adminUsers404.status === 404, 'GET /api/admin/users is NOT publicly readable (C3 adds no surface; since C6 it is admin-gated 401)');

const publicNews = await api('GET', '/api/news?limit=1');
ok(publicNews.status === 200 || publicNews.status === 404, 'public news unaffected');

// ============================================================
// [8] CLEANUP — remove the probe identity (hard delete by design)
// ============================================================
console.log('\n[8] Probe cleanup');
if (probe?.id) {
  await conn.query('DELETE FROM `users` WHERE `id` = ?', [probe.id]); // user_roles rows CASCADE
  const [left] = await conn.query('SELECT COUNT(*) AS n FROM `user_roles` WHERE `user_id` = ?', [probe.id]);
  ok(left[0].n === 0, 'probe identity deleted; user_roles rows CASCADE-removed');
}
const [counts] = await conn.query(
  'SELECT (SELECT COUNT(*) FROM `users`) AS u, (SELECT COUNT(*) FROM `admin_users`) AS a',
);
ok(counts[0].a >= 1, `admin_users untouched (${counts[0].a} rows remain)`);
// Phase C.4 note: users now legitimately holds the COPIED canonical
// admins (approved §AN.14 copy) — an empty-users assertion would be
// wrong after the cutover. The invariant this check guards is probe
// RESIDUE: every remaining canonical identity must be a canonical
// admin (the C3 probe used a student role — any leftover would show).
const [residue] = await conn.query(
  'SELECT COUNT(*) AS n FROM `users` `u` WHERE NOT EXISTS ('
    + 'SELECT 1 FROM `user_roles` `ur` JOIN `roles` `r` ON `r`.`id` = `ur`.`role_id`'
    + ' WHERE `ur`.`user_id` = `u`.`id` AND `r`.`code` = "admin")',
);
ok(residue[0].n === 0, `probe removed; users holds only canonical admins (${counts[0].u} rows, C4 copy present)`);
await conn.end();

// ============================================================
// RESULT
// ============================================================
console.log(`\n${'═'.repeat(40)}`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(40)}`);
process.exit(fail === 0 ? 0 : 1);
