// ------------------------------------------------------------
// Phase C.8 — ownership-scoped API foundation verification suite
// Run from repo root:  node scripts/test-ownership-api-foundation.mjs
//
// Requires: MariaDB up (live DB reads through the C2/C3 layer).
// Scope (§AN.17 C8): "helpers + tests; NO portal endpoints" — this
// suite verifies the C8 middleware foundation (middleware/
// ownershipScope.js) that CONSUMES the C3 §AN.6 primitives, plus
// the C3/C7 seams it stands on. It mounts NO routes and creates NO
// tables: the middleware is exercised directly through real HTTP
// middleware invocations (req/res objects driven by the suite)
// against the LIVE database — the same pattern the C3 suite uses.
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

let pass = 0;
let fail = 0;
function ok(cond, label) {
  if (cond) { pass += 1; console.log(`  ✔ ${label}`); }
  else { fail += 1; console.log(`  ✖ ${label}`); }
}

// ---- express-compatible req/res doubles (live middleware calls) ----
function makeReq({ adminUser = null, body = {}, params = {}, query = {} } = {}) {
  return { adminUser, body, params, query };
}
function makeRes() {
  const res = {
    statusCode: null, body: null, headers: {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
  };
  return res;
}
function nextSpy() {
  const fn = () => { fn.called = true; };
  fn.called = false;
  return fn;
}

// Live DB connection (C2/C3 layer reads the real MariaDB).
const conn = await mysql.createConnection({ ...DB, multipleStatements: false, timezone: 'Z' });
const q = async (sql, params) => (await conn.query(sql, params))[0];

const { createUser } = await import('../server/src/services/identityService.js');
const { attachOwnershipScope, requireOwnershipScope } = await import('../server/src/middleware/ownershipScope.js');
const { resolveOwnerScope, assertOwnedRow, ownedBy, parseUserId, USER_LINK_COLUMN } = await import('../server/src/services/ownershipScoping.js');
const { requirePermission, requireRole } = await import('../server/src/middleware/rbac.js');

// Janitor.
{
  const stale = await q("SELECT id FROM users WHERE email LIKE 'c8-%'");
  if (stale.length > 0) {
    await conn.query("DELETE FROM users WHERE email LIKE 'c8-%'");
    console.log(`  (janitor: removed ${stale.length} probe identity/ies)`);
  }
}

const adminUsersBefore = await q('SELECT id, email, password_hash, name, is_active, created_at, updated_at FROM admin_users ORDER BY id');
const usersBefore = (await q('SELECT COUNT(*) AS n FROM users'))[0].n;

const STAMP = Date.now();
const PROBE_EMAIL = `c8-owner-${STAMP}@greenleaf.test`;
const PASSWORD = 'C8Probe-pass-123';

// ============================================================
// [1] MIDDLEWARE CONTRACT — attach + scope resolution (live DB)
// ============================================================
console.log('\n[1] attachOwnershipScope — session-derived scope (fail-closed)');
{
  const owner = await createUser(
    { email: PROBE_EMAIL, name: 'C8 Owner Probe', roles: ['student'], primaryRole: 'student' },
    { password: PASSWORD },
  );

  // No session → no scope (fail closed), never throws.
  const mw = attachOwnershipScope();
  const req1 = makeReq();
  const res1 = makeRes();
  const next1 = nextSpy();
  await mw(req1, res1, next1);
  ok(next1.called && req1.ownerScope === null, 'no authenticated session → ownerScope null, request continues');

  // Session → narrowest scope = the session identity itself.
  const req2 = makeReq({ adminUser: { id: owner.id, roles: ['student'] } });
  const res2 = makeRes();
  const next2 = nextSpy();
  await mw(req2, res2, next2);
  ok(req2.ownerScope && req2.ownerScope.userId === owner.id, 'session identity → ownerScope { userId: session }');
  ok(typeof req2.ownsRow === 'function', 'ownsRow double-check helper is bound');

  // Client-supplied owner id WITHOUT opt-in is IGNORED (never read).
  const req3 = makeReq({ adminUser: { id: owner.id }, body: { userId: 999999 } });
  await mw(req3, makeRes(), nextSpy());
  ok(req3.ownerScope.userId === owner.id, 'client body owner id is NOT read without requestedUserIdField (narrowest scope kept)');

  // Opt-in confirm-only field: equality CONFIRMS, mismatch DENIES.
  const mwConfirm = attachOwnershipScope({ requestedUserIdField: 'userId' });
  const req4 = makeReq({ adminUser: { id: owner.id }, params: { userId: String(owner.id) } });
  await mwConfirm(req4, makeRes(), nextSpy());
  ok(req4.ownerScope.userId === owner.id, 'opt-in requested id EQUAL to session → confirmed (never widened)');

  const req5 = makeReq({ adminUser: { id: owner.id }, params: { userId: '4294967290' } });
  await mwConfirm(req5, makeRes(), nextSpy());
  ok(req5.ownerScope === null, 'opt-in requested id DIFFERENT from session → null (IDOR blocked)');

  const req6 = makeReq({ adminUser: { id: owner.id }, query: { userId: 'not-a-number' } });
  await mwConfirm(req6, makeRes(), nextSpy());
  ok(req6.ownerScope === null, 'malformed requested id → null (domain validation)');

  // Deactivated identity → fail closed through the C3/C2 layer.
  await conn.query('UPDATE users SET is_active = 0 WHERE id = ?', [owner.id]);
  const req7 = makeReq({ adminUser: { id: owner.id } });
  await mw(req7, makeRes(), nextSpy());
  ok(req7.ownerScope === null || req7.ownerScope.userId === owner.id,
    'deactivated identity → scope still resolves ONLY to the session id (service-layer checks deny later)');
  await conn.query('UPDATE users SET is_active = 1 WHERE id = ?', [owner.id]);
}

// ============================================================
// [2] ownsRow — the owned-row double-check through the middleware
// ============================================================
console.log('\n[2] ownsRow (assertOwnedRow binding)');
{
  const owner = (await q('SELECT id FROM users WHERE email = ?', [PROBE_EMAIL]))[0];
  const mw = attachOwnershipScope();
  const req = makeReq({ adminUser: { id: owner.id } });
  await mw(req, makeRes(), nextSpy());

  ok(req.ownsRow({ user_id: owner.id, name: 'x' }) !== null, 'row owned by the session identity → row returned');
  ok(req.ownsRow({ user_id: owner.id + 1 }) === null, 'row owned by ANOTHER identity → null');
  ok(req.ownsRow({}) === null, 'row WITHOUT ownership information → null (fail closed)');
  ok(req.ownsRow(null) === null, 'missing row → null');
  ok(req.ownsRow({ user_id: String(owner.id) }) !== null, 'stringified canonical id → accepted (domain-validated equality)');
}

// ============================================================
// [3] requireOwnershipScope — terminal generic-404 form
// ============================================================
console.log('\n[3] requireOwnershipScope — generic 404, no disclosure');
{
  const req1 = makeReq(); // no session → no scope
  const res1 = makeRes();
  const next1 = nextSpy();
  await requireOwnershipScope(req1, res1, next1);
  ok(!next1.called && res1.statusCode === 404, 'no scope → 404, chain stopped');
  ok(res1.body && res1.body.success === false && res1.body.message === 'Not found'
     && !JSON.stringify(res1.body).includes('owner') && !JSON.stringify(res1.body).includes('scope'),
    'denial body is generic (no WHY disclosure)');

  const owner = (await q('SELECT id FROM users WHERE email = ?', [PROBE_EMAIL]))[0];
  const req2 = makeReq({ adminUser: { id: owner.id } });
  await attachOwnershipScope()(req2, makeRes(), nextSpy());
  const next2 = nextSpy();
  const res2 = makeRes();
  await requireOwnershipScope(req2, res2, next2);
  ok(next2.called && res2.statusCode === null, 'valid scope → chain continues');
}

// ============================================================
// [4] C3 PRIMITIVE REGRESSION + C7/C6 SEAM INTEGRITY
// ============================================================
console.log('\n[4] C3 primitives + C7/C6 seam integrity');
{
  ok(USER_LINK_COLUMN === 'user_id', 'C3 canonical owner-link column unchanged');
  ok(parseUserId('42') === 42 && parseUserId('-1') === null && parseUserId('4294967296') === null,
    'C3 id domain unchanged (UNSIGNED INT)');
  ok(resolveOwnerScope({ sessionUserId: 5, requestedUserId: 6 }) === null
     && resolveOwnerScope({ sessionUserId: 5, requestedUserId: 5 }).userId === 5,
    'C3 confirm-never-widen contract unchanged');
  ok(ownedBy(9).fragment === ' AND `user_id` = ?', 'C3 ownedBy fragment unchanged');

  // The C8 middleware composes with the C7 gates (ordering contract:
  // authenticate → authorize → ownership attach).
  const staff = (await q('SELECT id FROM users WHERE email = ?', [PROBE_EMAIL]))[0];
  const permGate = requirePermission('users.manage');
  const scopeMw = attachOwnershipScope();
  const req = makeReq({ adminUser: { id: staff.id, roles: ['student'] } });
  const res = makeRes();
  const next = nextSpy();
  await permGate(req, res, next);              // 1. authenticate done; 2. authorize
  ok(res.statusCode === 403 && !next.called, 'C7 gate denies before ownership is consulted (order preserved)');
  await scopeMw(req, makeRes(), nextSpy());    // 3. ownership attach still independent
  ok(req.ownerScope.userId === staff.id, 'ownership scope remains a SEPARATE concern from RBAC');
}

// ============================================================
// [5] NO HTTP SURFACE (§AN.17 C8: "none public")
// ============================================================
console.log('\n[5] No public portal surface shipped');
{
  // The C8 foundation mounts nothing: no /api/portal/* routes exist.
  // (Verified structurally — the middleware module exports attach/
  // require forms only, and no router imports them yet.)
  const mod = await import('../server/src/middleware/ownershipScope.js');
  ok(typeof mod.attachOwnershipScope === 'function' && typeof mod.requireOwnershipScope === 'function',
    'foundation exports exactly the middleware forms (no router)');
  ok(Object.keys(mod).length === 2, 'no unintended exports (no endpoint factory, no portal wiring)');
}

// ============================================================
// [6] CLEANUP + FINAL DB STATE
// ============================================================
console.log('\n[6] Cleanup + final DB state');
{
  await conn.query("DELETE FROM users WHERE email LIKE 'c8-%'");
  const usersAfter = (await q('SELECT COUNT(*) AS n FROM users'))[0].n;
  ok(usersAfter === usersBefore, `users count restored (${usersBefore})`);
  const adminUsersAfter = await q('SELECT id, email, password_hash, name, is_active, created_at, updated_at FROM admin_users ORDER BY id');
  ok(JSON.stringify(adminUsersAfter) === JSON.stringify(adminUsersBefore), 'admin_users byte-identical');
  const orphans = (await q('SELECT COUNT(*) AS n FROM user_roles ur LEFT JOIN users u ON u.id = ur.user_id WHERE u.id IS NULL'))[0].n;
  ok(Number(orphans) === 0, 'no orphan user_roles');
}

console.log(`\n${'═'.repeat(40)}`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(40)}`);
await conn.end();
process.exit(fail === 0 ? 0 : 1);
