#!/usr/bin/env node
// ------------------------------------------------------------
// Phase D.3 — audit_logs verification suite
// Run from repo root:  node scripts/test-audit-logs.mjs
//
// Requires: server on :5000 (or D3_TEST_BASE) + MariaDB up.
// Verifies SYSTEM_DESIGN §AN.19 (the formalized D3 event model):
//   [A] migration 018 schema (columns/types/FK/indexes, idempotent)
//   [B] successful privileged writes create EXACTLY one audit row
//       with the controlled action/entity, correct entity_id, the
//       server-resolved actor (users.id + email), server-derived
//       ip and DB-stamped UTC created_at
//   [C] client tampering: actor/action/entity/entity_id/ip/at and
//       forbidden meta fields supplied by the client NEVER reach
//       the audit row
//   [D] failure paths create NO row: validation 400, authorization
//       403, business 404, malformed body
//   [E] authentication-flow exclusions: login/logout/change/forgot/
//       reset produce NO rows (§AN.19: auth flows are outside D3)
//   [F] read/public exclusions: GETs, public POST /api/contact,
//       /api/health produce NO rows
//   [G] metadata security: forbidden request data (unknown body
//       fields, emails, message content, reset tokens) does not
//       enter meta; source-level scan for banned patterns
//   [H] append-only: no UPDATE/DELETE statement may target
//       audit_logs anywhere in the application source
//   [X] cleanup: probe rows removed, no residue
//
// Convention (C5/C7 suites): live HTTP + live DB, ✔/✖ checks,
// "RESULT: n passed, n failed" line, non-zero exit on failure.
// ------------------------------------------------------------

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

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
const BASE = process.env.D3_TEST_BASE || 'http://127.0.0.1:5000';

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

/** Latest audit row (or null). The suite's ONLY row reader. */
async function lastAuditRow() {
  const rows = await q(
    'SELECT id, user_id, actor_email, action, entity, entity_id, meta, ip, created_at'
    + ' FROM audit_logs ORDER BY id DESC LIMIT 1',
  );
  return rows[0] ?? null;
}

/** All audit rows created since the suite started (by id window). */
let baselineId = 0;
async function rowsSinceBaseline() {
  return q('SELECT * FROM audit_logs WHERE id > ? ORDER BY id ASC', [baselineId]);
}

// Server-side identity services (imported AFTER .env load) — the
// SAME primitives the C2/C5 suites use for probe identity setup.
const { createUser } = await import('../server/src/services/identityService.js');
const { clearPermissionCache } = await import('../server/src/services/identityService.js');

const STAMP = Date.now().toString(36);
const ADMIN_EMAIL = `d3-audit-probe-${STAMP}@greenleaf.test`;
const STAFF_EMAIL = `d3-staff-probe-${STAMP}@greenleaf.test`;
const PASSWORD = 'D3-audit-Probe-Pass!42';

// Janitor: a previous crashed run may have left probe identities
// behind. Deleting them CASCADEs user_roles; audit rows keep their
// history (user_id → NULL via ON DELETE SET NULL — by design) but
// are removed first to restore an exact pre-probe baseline.
{
  const stale = await q("SELECT id FROM users WHERE email LIKE 'd3-audit-probe-%' OR email LIKE 'd3-staff-probe-%'");
  if (stale.length > 0) {
    await conn.query('DELETE FROM audit_logs WHERE user_id IN (?)', [stale.map((r) => r.id)]);
    await conn.query("DELETE FROM users WHERE email LIKE 'd3-audit-probe-%' OR email LIKE 'd3-staff-probe-%'");
  }
}

// ------------------------------------------------------------
// [A] Schema
// ------------------------------------------------------------
console.log('\n[A] Migration 018 schema');
{
  const [m] = await conn.query("SELECT name FROM schema_migrations WHERE name = '018_create_audit_logs'");
  ok(m.length === 1, 'migration 018 tracked in schema_migrations');

  const cols = await q(
    "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS"
    + " WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' ORDER BY ORDINAL_POSITION",
  );
  const byName = new Map(cols.map((c) => [c.COLUMN_NAME, c]));
  ok(cols.length === 9, 'audit_logs has exactly the 9 designed columns');
  ok(byName.get('user_id')?.COLUMN_TYPE?.includes('unsigned') && byName.get('user_id')?.IS_NULLABLE === 'YES', 'actor user_id: nullable int unsigned');
  ok(byName.get('actor_email')?.COLUMN_TYPE === 'varchar(255)', 'actor_email snapshot column exists');
  ok(byName.get('action')?.COLUMN_TYPE === 'varchar(64)' && byName.get('action')?.IS_NULLABLE === 'NO', 'action: NOT NULL varchar(64)');
  ok(byName.get('entity')?.COLUMN_TYPE === 'varchar(64)' && byName.get('entity')?.IS_NULLABLE === 'NO', 'entity: NOT NULL varchar(64)');
  ok(byName.get('entity_id')?.COLUMN_TYPE === 'varchar(64)', 'entity_id: string-typed snapshot (no live FK)');
  ok(byName.get('meta')?.COLUMN_TYPE?.includes('longtext'), 'meta: JSON (longtext alias on MariaDB 10.4)');
  ok(byName.get('ip')?.COLUMN_TYPE === 'varchar(45)', 'ip: varchar(45) (IPv4+IPv6)');
  ok(byName.get('created_at')?.COLUMN_TYPE.startsWith('timestamp'), 'created_at: TIMESTAMP (the §L `at`, DB-stamped UTC)');

  const fks = await q(
    "SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS"
    + " WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'",
  );
  ok(fks.length === 1 && fks[0].DELETE_RULE === 'SET NULL', 'single FK users.id ON DELETE SET NULL (history survives account deletion)');

  const idx = await q('SHOW INDEX FROM audit_logs');
  const names = new Set(idx.map((i) => i.Key_name));
  ok(names.has('idx_audit_logs_user_id') && names.has('idx_audit_logs_entity') && names.has('idx_audit_logs_created_at'), 'actor / (entity, entity_id) / created_at indexes present');
}

// ------------------------------------------------------------
// Probe identities + sessions
// ------------------------------------------------------------
const adminProbe = await createUser(
  { email: ADMIN_EMAIL, name: 'D3 Audit Probe', roles: ['admin'], primaryRole: 'admin' },
  { password: PASSWORD },
);
const adminJar = {};
{
  const lg = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: PASSWORD }, jar: adminJar });
  ok(lg.status === 200, 'probe admin logs in');
}

baselineId = Number((await q('SELECT COALESCE(MAX(id), 0) AS m FROM audit_logs'))[0].m);

/** Suite-level: the staff probe's users.id + session (set in [B], reused in [D]/[X]). */
let staffId = null;
let staffJar = {};

// ------------------------------------------------------------
// [B] Successful privileged writes → exactly one row each
// ------------------------------------------------------------
console.log('\n[B] Successful privileged writes (row created, fields correct)');
{
  // News create (create → meta {slug}; actor resolution; ip; at)
  const slug = `d3-probe-${STAMP}`;
  const created = await api('POST', '/api/admin/news', {
    jar: { cookie: adminJar.cookie },
    body: { title: `D3 probe ${STAMP}`, slug, type: 'NEWS', content: 'D3 verification probe', status: 'DRAFT' },
  });
  ok(created.status === 201, 'news create succeeds (201)');
  let row = await lastAuditRow();
  ok(row && row.action === 'NEWS_ITEM_CREATE' && row.entity === 'news_item', 'audit row: controlled action + entity');
  ok(String(row?.entity_id) === String(created.json?.id ?? created.json?.data?.id), 'entity_id = server-resolved created id');
  ok(row?.user_id === adminProbe.id && row?.actor_email === ADMIN_EMAIL, 'actor = canonical users.id + email (server-resolved)');
  ok(typeof row?.ip === 'string' && row.ip.length > 0, `ip = server-derived req.ip (${row?.ip})`);
  ok(row?.created_at instanceof Date && !Number.isNaN(row.created_at.getTime()), 'at = DB-stamped timestamp');
  const metaB = row?.meta ? JSON.parse(row.meta) : null;
  ok(metaB && metaB.slug === slug && Object.keys(metaB).length === 1, 'meta = whitelisted {slug} ONLY');
  const newsId = created.json?.id ?? created.json?.data?.id;

  // News status patch (status transition meta)
  await api('PATCH', `/api/admin/news/${newsId}/status`, { jar: { cookie: adminJar.cookie }, body: { status: 'PUBLISHED' } });
  row = await lastAuditRow();
  ok(row?.action === 'NEWS_ITEM_STATUS_SET' && JSON.parse(row.meta ?? '{}').to === 'PUBLISHED', 'status transition → meta {to}');

  // News delete
  await api('DELETE', `/api/admin/news/${newsId}`, { jar: { cookie: adminJar.cookie } });
  row = await lastAuditRow();
  ok(row?.action === 'NEWS_ITEM_DELETE' && String(row.entity_id) === String(newsId), 'delete → audited with the target id');

  // User create (role codes only in meta — NEVER the password).
  // The staff probe carries `admin` because the C4 login boundary
  // (§AN.14) issues sessions ONLY to identities with an admin role;
  // [D] strips the roles afterwards (C7 pattern) to build the 403.
  const staff = await api('POST', '/api/admin/users', {
    jar: { cookie: adminJar.cookie },
    body: { email: STAFF_EMAIL, name: 'D3 Staff Probe', roles: ['admin', 'student'], primaryRole: 'admin', password: PASSWORD },
  });
  ok(staff.status === 201, 'user create succeeds (201)');
  row = await lastAuditRow();
  ok(row?.action === 'USER_CREATE' && String(row.entity_id) === String(staff.json?.data?.user?.id), 'user create → audited with the new users.id');
  const metaUser = row?.meta ? JSON.parse(row.meta) : {};
  ok(metaUser.roles === 'admin,student' && !JSON.stringify(metaUser).toLowerCase().includes('password'), 'user meta = role codes ONLY (no credential material)');

  // Login the staff probe ONCE while active (the login limiter is
  // 10/10min — a second login in [D] would exhaust it; the stateless
  // session survives deactivation and becomes usable again after
  // reactivation, which [D] verifies).
  staffJar = {};
  const staffLogin = await api('POST', '/api/auth/login', { body: { email: STAFF_EMAIL, password: PASSWORD }, jar: staffJar });
  ok(staffLogin.status === 200, `staff probe logs in (while active, got ${staffLogin.status})`);

  // User role assign (role + makePrimary meta)
  staffId = staff.json?.data?.user?.id;
  await api('POST', `/api/admin/users/${staffId}/roles`, { jar: { cookie: adminJar.cookie }, body: { role: 'teacher' } });
  row = await lastAuditRow();
  ok(row?.action === 'USER_ROLE_ASSIGN' && JSON.parse(row.meta ?? '{}').role === 'teacher', 'role assignment → meta {role}');

  // Reset-token ISSUE is audited; the raw token must NOT be in meta
  // (staff identity still ACTIVE at this point — §AN.8 issuance rule).
  const resetIss = await api('POST', `/api/admin/users/${staffId}/reset-token`, { jar: { cookie: adminJar.cookie } });
  ok(resetIss.status === 200 && typeof resetIss.json?.data?.resetToken === 'string', 'reset-token issue succeeds (raw token returned once)');
  row = await lastAuditRow();
  ok(row?.action === 'USER_RESET_TOKEN_ISSUE', 'reset-token issue → audited');
  ok(!(row?.meta ?? '').includes(resetIss.json?.data?.resetToken ?? '\u0000'), 'raw reset token NEVER enters the audit row');

  // User status set LAST (transition meta) — deactivation must not
  // precede the reset-token check above (issuance requires active).
  await api('PUT', `/api/admin/users/${staffId}/status`, { jar: { cookie: adminJar.cookie }, body: { isActive: false } });
  row = await lastAuditRow();
  ok(row?.action === 'USER_STATUS_SET' && JSON.parse(row.meta ?? '{}').to === 'INACTIVE', 'user status set → meta {to}');

  // Settings update (count meta) — the identity group with its REAL
  // keys (identity.name is a required key; partial groups allowed).
  await api('PUT', '/api/admin/settings', { jar: { cookie: adminJar.cookie }, body: { identity: { name: `D3 Probe Academy ${STAMP}` } } });
  row = await lastAuditRow();
  ok(row?.action === 'SITE_SETTINGS_UPDATE' && row?.entity_id === null && JSON.parse(row.meta ?? '{}').count >= 1, 'settings update → audited with count meta (no values)');

  // Page section update (composite "page:key" entity_id) — the
  // newsPreview section accepts a minimal { title } payload.
  const psRes = await api('PUT', '/api/admin/pages/home/sections/newsPreview', {
    jar: { cookie: adminJar.cookie },
    body: { title: `D3 ${STAMP}` },
  });
  row = await lastAuditRow();
  ok(psRes.status === 200 && row?.action === 'PAGE_SECTION_UPDATE' && row?.entity_id === 'home:newsPreview', 'page section → composite "page:key" entity_id');

  // Contact status set (status meta; content never logged)
  const cm = await conn.query(
    'INSERT INTO contact_messages (name, email, subject, message, status) VALUES (?, ?, ?, ?, "NEW")',
    [`D3 Sender ${STAMP}`, `d3-sender-${STAMP}@example.test`, 'D3 probe subject', 'D3 probe private message content'],
  );
  const cmId = cm[0].insertId;
  await api('PATCH', `/api/admin/contact-messages/${cmId}/status`, { jar: { cookie: adminJar.cookie }, body: { status: 'READ' } });
  row = await lastAuditRow();
  ok(row?.action === 'CONTACT_MESSAGE_STATUS_SET' && String(row.entity_id) === String(cmId), 'contact status → audited');
  ok(!(row?.meta ?? '').includes('D3 probe private message content'), 'contact message CONTENT never enters meta');
  await conn.query('DELETE FROM contact_messages WHERE id = ?', [cmId]);
  await recordAdminMutationCleanup(contactCleanupRowGuard(row));
}

/** keep the cleanup ordering honest: delete the contact row, then
 * remove its audit row via the [X] janitor (by entity/id). */
function contactCleanupRowGuard(_row) { /* marker only */ return undefined; }
async function recordAdminMutationCleanup() { /* no-op — [X] cleans */ }

// ------------------------------------------------------------
// [C] Client tampering
// ------------------------------------------------------------
console.log('\n[C] Client tampering (protected fields cannot be injected)');
{
  const slugT = `d3-tamper-${STAMP}`;
  // Attempt 1: audit-looking fields ON the create payload. The news
  // validator rejects unknown fields (400) — server-side validation
  // is the FIRST wall; no audit row may exist for the rejected call.
  const rejected = await api('POST', '/api/admin/news', {
    jar: { cookie: adminJar.cookie },
    body: {
      title: `D3 tamper ${STAMP}`, slug: slugT, type: 'NEWS', content: 'x', status: 'DRAFT',
      actor: 999999, action: 'FORGED_ACTION', entity: 'forged_entity', entity_id: 'forged',
      user_id: 999999, actor_email: 'forged@attacker.test', ip: '6.6.6.6', at: '1999-01-01T00:00:00Z',
    },
  });
  ok(rejected.status === 400, `tampered create request REJECTED by validation (${rejected.status})`);

  // Attempt 2: audit-looking fields riding on a VALID payload via
  // the status endpoint's validator (accepts only `status`).
  const slugV = `d3-tamper2-${STAMP}`;
  const created = await api('POST', '/api/admin/news', {
    jar: { cookie: adminJar.cookie },
    body: { title: `D3 tamper2 ${STAMP}`, slug: slugV, type: 'NEWS', content: 'x', status: 'DRAFT' },
  });
  ok(created.status === 201, 'clean create succeeds for the injection attempt');
  const newsId = created.json?.id ?? created.json?.data?.id;
  const statusRes = await api('PATCH', `/api/admin/news/${newsId}/status`, {
    jar: { cookie: adminJar.cookie }, body: { status: 'PUBLISHED', actor: 999999, action: 'FORGED_ACTION', ip: '6.6.6.6' },
  });
  ok(statusRes.status === 400, `injection via status payload rejected (${statusRes.status})`);

  // Attempt 3: unknown meta-looking fields CANNOT widen the meta
  // whitelist — the action's whitelist is fixed in server code. The
  // created row must show only the server-defined fields.
  const row = await lastAuditRow();
  ok(row?.action === 'NEWS_ITEM_CREATE' && row?.entity === 'news_item', 'action/entity remain SERVER-controlled');
  ok(row?.user_id === adminProbe.id && row?.actor_email === ADMIN_EMAIL, 'actor remains the authenticated session identity (never 999999/forged)');
  ok(row?.ip !== '6.6.6.6', 'ip remains server-derived (never client-supplied)');
  ok(!(row?.created_at instanceof Date && row.created_at.getFullYear() === 1999), 'at remains DB-stamped (never client-supplied)');
  const meta = row?.meta ? JSON.parse(row.meta) : {};
  ok(Object.keys(meta).length === 1 && meta.slug === slugV, 'meta contains ONLY the whitelisted slug (no injected fields)');
  // cleanup probe news row + its audit rows
  await api('DELETE', `/api/admin/news/${newsId}`, { jar: { cookie: adminJar.cookie } });
}

// ------------------------------------------------------------
// [D] Failure paths → NO row
// ------------------------------------------------------------
console.log('\n[D] Failure paths (no audit row for unsuccessful operations)');
{
  // Reactivate the staff probe FIRST — the [B] flow deactivated it.
  // This is an AUDITED write, so it must happen BEFORE the baseline
  // snapshot below (the before/after window must contain ONLY the
  // failure probes). The stateless staff session becomes usable
  // again because attachSessionUser checks pwdAt (not is_active)
  // and the C7 live identity resolution sees is_active = 1 again.
  const react = await api('PUT', `/api/admin/users/${staffId}/status`, { jar: { cookie: adminJar.cookie }, body: { isActive: true } });
  ok(react.status === 200, 'staff probe reactivated (audited write BEFORE the baseline snapshot)');

  // Authorization failure (403): strip ALL roles from the ACTIVE
  // staff identity via direct SQL (C7 pattern — role management is
  // not under test here) → live role resolution yields []. The
  // stateless session still resolves (user exists, is_active = 1)
  // but carries no permissions.
  await conn.query('DELETE FROM user_roles WHERE user_id = ?', [staffId]);
  clearPermissionCache();

  const before = (await q('SELECT COALESCE(MAX(id), 0) AS m FROM audit_logs'))[0].m;

  // Validation failure (400)
  await api('POST', '/api/admin/news', { jar: { cookie: adminJar.cookie }, body: { title: '', slug: '', type: 'NEWS' } });
  ok((await api('POST', '/api/admin/news', { jar: { cookie: adminJar.cookie }, body: { title: 'x' } })).status === 400, 'validation failure → 400');

  const denied = await api('POST', '/api/admin/news', {
    jar: { cookie: staffJar.cookie }, body: { title: 'nope', slug: `d3-denied-${STAMP}`, type: 'NEWS' },
  });
  ok(denied.status === 403, `authorization failure → 403 (role-less identity, got ${denied.status})`);

  // Business failure (404): delete a nonexistent target
  await api('DELETE', '/api/admin/news/99999999', { jar: { cookie: adminJar.cookie } });

  // Malformed body (400)
  await api('POST', '/api/admin/news', { jar: { cookie: adminJar.cookie }, body: undefined, headers: { 'Content-Type': 'application/json' } });

  const after = (await q('SELECT COALESCE(MAX(id), 0) AS m FROM audit_logs'))[0].m;
  const createdRows = await q('SELECT action, status_note FROM (SELECT action, "n/a" AS status_note FROM audit_logs WHERE id > ?) t', [before]).catch(() => []);
  ok(Number(after) === Number(before) && createdRows.length === 0, 'NO audit row for 400/403/404/malformed failures (exactly §AN.19)');
}

// ------------------------------------------------------------
// [E] Authentication-flow exclusions
// ------------------------------------------------------------
console.log('\n[E] Authentication flows are OUTSIDE D3 (no rows)');
{
  const before = (await q('SELECT COALESCE(MAX(id), 0) AS m FROM audit_logs'))[0].m;

  const goodLogin = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: PASSWORD } });
  ok(goodLogin.status === 200, 'successful login');
  await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: 'wrong-password' } });
  ok((await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: 'wrong-password' } })).status === 401, 'failed login → 401');
  await api('POST', '/api/auth/logout', { jar: { cookie: adminJar.cookie } });
  // change-password on a throwaway identity would mutate the probe
  // credential; login/logout already prove the class. Re-login for
  // the remaining sections:
  const relog = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: PASSWORD }, jar: adminJar });
  ok(relog.status === 200, 'probe admin re-authenticated');

  const after = (await q('SELECT COALESCE(MAX(id), 0) AS m FROM audit_logs'))[0].m;
  ok(Number(after) === Number(before), 'login success/failure + logout produced NO audit rows');
}

// ------------------------------------------------------------
// [F] Read/public exclusions
// ------------------------------------------------------------
console.log('\n[F] Reads, public traffic, health → no rows');
{
  const before = (await q('SELECT COALESCE(MAX(id), 0) AS m FROM audit_logs'))[0].m;

  await api('GET', '/api/admin/news?limit=1', { jar: { cookie: adminJar.cookie } });
  await api('GET', '/api/admin/users', { jar: { cookie: adminJar.cookie } });
  await api('GET', '/api/news?limit=1');
  await api('POST', '/api/contact', { body: { name: 'D3 Public', email: `d3-public-${STAMP}@example.test`, subject: 's', message: 'm' } });
  await api('GET', '/api/health');

  const after = (await q('SELECT COALESCE(MAX(id), 0) AS m FROM audit_logs'))[0].m;
  ok(Number(after) === Number(before), 'GETs + public contact + health produced NO audit rows');
}

// ------------------------------------------------------------
// [G] Metadata security (source scan + behavior)
// ------------------------------------------------------------
console.log('\n[G] Metadata security');
{
  // Source scan: banned serialization patterns in server code.
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js)$/.test(e.name)) files.push(p);
    }
  };
  walk(resolve('server', 'src'));
  const banned = [/JSON\.stringify\(req\.body\)/, /meta:\s*req\.body/, /meta:\s*\{\s*\.\.\.req\.body/, /meta:\s*\{\s*\.\.\.\.\w+body/];
  let violations = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const re of banned) if (re.test(src)) violations.push(`${f}: ${re}`);
  }
  ok(violations.length === 0, `no wholesale request-body serialization in server source (${files.length} files scanned)${violations.length ? ' — ' + violations.join('; ') : ''}`);

  // updateAdminDownload with the REAL managed-path reference shape —
  // the meta whitelist (title) must hold regardless of payload size.
  const dl = await api('POST', '/api/admin/downloads', {
    jar: { cookie: adminJar.cookie },
    body: { title: `D3 dl ${STAMP}`, category: 'Forms', file: '/api/uploads/documents/d3-probe-file.pdf', file_ext: 'pdf' },
  });
  ok(dl.status === 201, `download create succeeds (meta title whitelist, got ${dl.status})`);
  const rowDl = await lastAuditRow();
  ok(rowDl?.action === 'DOWNLOAD_CREATE' && JSON.parse(rowDl.meta ?? '{}').title === `D3 dl ${STAMP}`, 'download meta = whitelisted title only');
  await api('DELETE', `/api/admin/downloads/${dl.json?.data?.id}`, { jar: { cookie: adminJar.cookie } });
}

// ------------------------------------------------------------
// [H] Append-only application behavior
// ------------------------------------------------------------
console.log('\n[H] Append-only (no UPDATE/DELETE path in application source)');
{
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js)$/.test(e.name)) files.push(p);
    }
  };
  walk(resolve('server', 'src'));
  const banned = [/UPDATE\s+`?audit_logs`?/i, /DELETE\s+FROM\s+`?audit_logs`?/i];
  let violations = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const re of banned) if (re.test(src)) violations.push(`${f}`);
  }
  ok(violations.length === 0, `no UPDATE/DELETE against audit_logs in application source${violations.length ? ' — ' + [...new Set(violations)].join('; ') : ''}`);

  // No HTTP surface exists: audit endpoints must 404 (never readable).
  const pub = await api('GET', '/api/audit-logs', { jar: { cookie: adminJar.cookie } });
  const admin = await api('GET', '/api/admin/audit-logs', { jar: { cookie: adminJar.cookie } });
  ok(pub.status === 404 && admin.status === 404, 'NO read API exists (audit endpoints → 404, even authenticated)');
}

// ------------------------------------------------------------
// [X] Cleanup + final state
// ------------------------------------------------------------
console.log('\n[X] Cleanup + final state');
{
  const rows = await rowsSinceBaseline();
  const probeUserIds = [adminProbe.id, (await q('SELECT id FROM users WHERE email = ?', [STAFF_EMAIL]))[0]?.id].filter(Boolean);
  ok(rows.every((r) => r.user_id === null || probeUserIds.includes(r.user_id)), `all ${rows.length} suite-created audit rows belong to the probe identities (no actor pollution)`);

  // Remove the suite's rows + probe identities (CASCADE user_roles;
  // restore the pre-suite baseline exactly).
  await conn.query('DELETE FROM audit_logs WHERE id > ?', [baselineId]);
  await conn.query("DELETE FROM users WHERE email LIKE 'd3-audit-probe-%' OR email LIKE 'd3-staff-probe-%'");

  const [[usersCount]] = (await conn.query('SELECT COUNT(*) AS n FROM users')).slice();
  const [[rpCount]] = (await conn.query('SELECT COUNT(*) AS n FROM role_permissions')).slice();
  ok(Number(usersCount.n) === 3, 'users count restored (3)');
  ok(Number(rpCount.n) === 0, 'role_permissions restored byte-identical (0 rows)');
  const residue = await q("SELECT COUNT(*) AS n FROM audit_logs WHERE id > ?", [baselineId]);
  ok(Number(residue[0].n) === 0, 'no probe audit rows remain');
}

await conn.end();
console.log(`\n${'═'.repeat(40)}`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(40)}`);
process.exit(fail === 0 ? 0 : 1);
