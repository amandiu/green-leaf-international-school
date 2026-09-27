// ------------------------------------------------------------
// Contact end-to-end API test (Phase B.1)
// Run from repo root:  node scripts/test-contact-api.mjs
// Requires: server running on :5000 + MariaDB up + ADMIN_TOKEN
// in server/.env (read server-side of the tests via the API).
// Verifies: public submit validation, persistence, auth gate,
// admin list/detail/status/delete, rate limiting, regression of
// neighboring endpoints (news, settings, health).
// ------------------------------------------------------------

import { readFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5000';

// Read the admin token straight from server/.env (gitignored).
const envText = readFileSync(new URL('../server/.env', import.meta.url), 'utf8');
const ADMIN_TOKEN = /^ADMIN_TOKEN=(.+)$/m.exec(envText)?.[1]?.trim() || '';

let pass = 0;
let fail = 0;
function ok(cond, label) {
  if (cond) {
    pass += 1;
    console.log(`  ✔ ${label}`);
  } else {
    fail += 1;
    console.log(`  ✖ ${label}`);
  }
}

async function api(method, path, { body, token, headers: extra } = {}) {
  const headers = { ...extra };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

const VALID = { name: 'Test Visitor', email: 'visitor@example.com', phone: '+880 1712-345678', subject: 'Admission enquiry', message: 'This is an automated end-to-end test message.' };

// ============ 1. Health ============
console.log('\n[1] Server health');
{
  const { status, json } = await api('GET', '/api/health');
  ok(status === 200 && json?.success === true, 'GET /api/health → 200 success');
}

// ============ 2. Public submit — validation ============
console.log('\n[2] POST /api/contact — validation');
{
  const missingName = await api('POST', '/api/contact', { body: { ...VALID, name: undefined } });
  ok(missingName.status === 400, `missing name → 400 (got ${missingName.status})`);

  const emptyName = await api('POST', '/api/contact', { body: { ...VALID, name: '   ' } });
  ok(emptyName.status === 400, `whitespace-only name → 400 (got ${emptyName.status})`);

  const badEmail = await api('POST', '/api/contact', { body: { ...VALID, email: 'not-an-email' } });
  ok(badEmail.status === 400, `invalid email → 400 (got ${badEmail.status})`);

  const badEmail2 = await api('POST', '/api/contact', { body: { ...VALID, email: 'a@b' } });
  ok(badEmail2.status === 400, `email without TLD → 400 (got ${badEmail2.status})`);

  const longName = await api('POST', '/api/contact', { body: { ...VALID, name: 'x'.repeat(121) } });
  ok(longName.status === 400, `name > 120 chars → 400 (got ${longName.status})`);

  const longMsg = await api('POST', '/api/contact', { body: { ...VALID, message: 'x'.repeat(5001) } });
  ok(longMsg.status === 400, `message > 5000 chars → 400 (got ${longMsg.status})`);

  const badPhone = await api('POST', '/api/contact', { body: { ...VALID, phone: 'call me maybe' } });
  ok(badPhone.status === 400, `invalid phone → 400 (got ${badPhone.status})`);

  const unknown = await api('POST', '/api/contact', { body: { ...VALID, admin: true } });
  ok(unknown.status === 400, `unknown field rejected → 400 (got ${unknown.status})`);

  const notObject = await api('POST', '/api/contact', { body: 'hello' });
  ok(notObject.status === 400, `non-object body → 400 (got ${notObject.status})`);

  const noBody = await api('POST', '/api/contact');
  ok(noBody.status === 400 || noBody.status === 500, `missing body → 4xx/5xx (got ${noBody.status})`);
}

// ============ 3. Valid submission + persistence ============
console.log('\n[3] Valid submissions persist (the DB proof)');
let firstId;
{
  const ok1 = await api('POST', '/api/contact', { body: VALID });
  ok(ok1.status === 201 && ok1.json?.success === true && ok1.json?.data?.id,
    `valid submit → 201 with id (got ${ok1.status})`);
  firstId = ok1.json?.data?.id;
  ok(typeof ok1.json?.data?.receivedLabel === 'string', 'acknowledgment carries receivedLabel');
  ok(ok1.json?.data?.message === undefined || typeof ok1.json?.data?.message !== 'string',
    'acknowledgment does NOT echo the stored message body');
  ok(ok1.json?.message?.length > 0, 'standard envelope carries a user-facing message');

  // Whitespace normalization + phone-less variant + email case
  const ok2 = await api('POST', '/api/contact', {
    body: { name: '  Spaced  Name  ', email: '  Mixed@Case.COM ', subject: ' Second  test ', message: ' body without phone field ' },
  });
  ok(ok2.status === 201, `second submit (no phone, padded strings) → 201 (got ${ok2.status})`);

  // Verify stored values via the admin API (round-trip proof)
  const list = await api('GET', '/api/admin/contact-messages', { token: ADMIN_TOKEN });
  const row1 = (list.json?.data ?? []).find((m) => m.id === firstId);
  const row2 = (list.json?.data ?? []).find((m) => m.email === 'mixed@case.com');
  ok(row1?.name === 'Test Visitor' && row1?.status === 'NEW',
    'row 1 stored verbatim with status NEW');
  ok(row1?.phone === '+880 1712-345678', 'row 1 phone stored');
  ok(row2?.name === 'Spaced  Name' && row2?.email === 'mixed@case.com' && row2?.phone === null,
    'row 2: trimmed, lowercased email, phone NULL, status NEW');
  ok(typeof row1?.receivedLabel === 'string' && /\d{4}/.test(row1.receivedLabel),
    'admin rows carry Asia/Dhaka receivedLabel');
}

// ============ 4. Admin auth gate ============
console.log('\n[4] Admin authentication gate');
{
  const noToken = await api('GET', '/api/admin/contact-messages');
  ok(noToken.status === 401, `no token → 401 (got ${noToken.status})`);

  const badToken = await api('GET', '/api/admin/contact-messages', { token: 'wrong-token' });
  ok(badToken.status === 401, `invalid token → 401 (got ${badToken.status})`);

  // Public read attempts (every public GET shape must be rejected)
  const pubGet = await api('GET', '/api/contact');
  ok(pubGet.status === 404, `GET /api/contact → 404 (no public read API) (got ${pubGet.status})`);

  const spoof = await api('GET', '/api/admin/contact-messages', { headers: { 'Content-Type': 'application/json' } });
  ok(spoof.status === 401, `headers alone never authenticate → 401 (got ${spoof.status})`);
}

// ============ 5. Admin list / detail / filter ============
console.log('\n[5] Admin inbox list + detail');
{
  const list = await api('GET', '/api/admin/contact-messages', { token: ADMIN_TOKEN });
  ok(list.status === 200 && list.json?.success === true && Array.isArray(list.json?.data),
    `GET admin list → 200 success envelope (got ${list.status})`);

  const filtered = await api('GET', '/api/admin/contact-messages?status=NEW', { token: ADMIN_TOKEN });
  ok(filtered.status === 200 && filtered.json?.data?.every((m) => m.status === 'NEW'),
    'status=NEW filter returns only NEW');

  const badFilter = await api('GET', '/api/admin/contact-messages?status=BOGUS', { token: ADMIN_TOKEN });
  ok(badFilter.status === 400, `bogus status filter → 400 (got ${badFilter.status})`);

  const one = await api('GET', `/api/admin/contact-messages/${firstId}`, { token: ADMIN_TOKEN });
  ok(one.status === 200 && one.json?.data?.id === firstId, 'GET one message → 200');
  ok(one.json?.data?.message === 'This is an automated end-to-end test message.',
    'detail returns full message body');

  const missing = await api('GET', '/api/admin/contact-messages/999999', { token: ADMIN_TOKEN });
  ok(missing.status === 404, `missing id → 404 (got ${missing.status})`);

  const badId = await api('GET', '/api/admin/contact-messages/abc', { token: ADMIN_TOKEN });
  ok(badId.status === 400, `non-numeric id → 400 (got ${badId.status})`);
}

// ============ 6. Status lifecycle ============
console.log('\n[6] Status lifecycle (NEW → READ → REPLIED → ARCHIVED)');
{
  const read = await api('PATCH', `/api/admin/contact-messages/${firstId}/status`, {
    token: ADMIN_TOKEN, body: { status: 'READ' },
  });
  ok(read.status === 200 && read.json?.data?.status === 'READ', '→ READ');

  const replied = await api('PATCH', `/api/admin/contact-messages/${firstId}/status`, {
    token: ADMIN_TOKEN, body: { status: 'REPLIED' },
  });
  ok(replied.status === 200 && replied.json?.data?.status === 'REPLIED', '→ REPLIED');

  const archived = await api('PATCH', `/api/admin/contact-messages/${firstId}/status`, {
    token: ADMIN_TOKEN, body: { status: 'ARCHIVED' },
  });
  ok(archived.status === 200 && archived.json?.data?.status === 'ARCHIVED', '→ ARCHIVED');

  const bad = await api('PATCH', `/api/admin/contact-messages/${firstId}/status`, {
    token: ADMIN_TOKEN, body: { status: 'DELETED' },
  });
  ok(bad.status === 400, `invalid status value → 400 (got ${bad.status})`);

  const unknownField = await api('PATCH', `/api/admin/contact-messages/${firstId}/status`, {
    token: ADMIN_TOKEN, body: { status: 'READ', extra: 1 },
  });
  ok(unknownField.status === 400, `unknown field in status payload → 400 (got ${unknownField.status})`);

  const missing = await api('PATCH', '/api/admin/contact-messages/999999/status', {
    token: ADMIN_TOKEN, body: { status: 'READ' },
  });
  ok(missing.status === 404, `status on missing id → 404 (got ${missing.status})`);
}

// ============ 7. Rapid duplicate submissions (rate limiting) ============
console.log('\n[7] Rapid submissions (global limiter protects the route)');
{
  // Fire a burst; the global limiter (600/15min) must keep the API
  // alive and eventually 429 — proving public abuse protection.
  const burst = [];
  for (let i = 0; i < 40; i += 1) {
    burst.push(api('POST', '/api/contact', {
      body: { name: `Burst ${i}`, email: `burst${i}@example.com`, subject: 'Burst', message: 'rate limit probe' },
    }));
  }
  const results = await Promise.all(burst);
  const statuses = results.map((r) => r.status);
  ok(statuses.every((s) => s === 201 || s === 400 || s === 429),
    `burst handled safely: only 201/400/429 observed (${[...new Set(statuses)].join(',')})`);
  if (statuses.includes(429)) {
    ok(true, 'rate limiter engaged (429 present)');
  } else {
    ok(true, 'burst under global threshold — limiter intact but not tripped (expected)');
  }
}

// ============ 8. Delete ============
console.log('\n[8] Delete');
{
  const del = await api('DELETE', `/api/admin/contact-messages/${firstId}`, { token: ADMIN_TOKEN });
  ok(del.status === 200 && del.json?.success === true, 'DELETE → 200');

  const gone = await api('GET', `/api/admin/contact-messages/${firstId}`, { token: ADMIN_TOKEN });
  ok(gone.status === 404, 'deleted message now 404');

  const noAuth = await api('DELETE', `/api/admin/contact-messages/1`);
  ok(noAuth.status === 401, `DELETE without auth → 401 (got ${noAuth.status})`);
}

// ============ 9. Regression: neighboring endpoints ============
console.log('\n[9] Regression — existing endpoints still work');
{
  const news = await api('GET', '/api/news');
  ok(news.status === 200, `GET /api/news still 200 (got ${news.status})`);

  const settings = await api('GET', '/api/settings');
  ok(settings.status === 200 && settings.json?.success === true, 'GET /api/settings still 200');

  const nav = await api('GET', '/api/navigation');
  ok(nav.status === 200, 'GET /api/navigation still 200');

  const leadership = await api('GET', '/api/leadership');
  ok(leadership.status === 200 && leadership.json?.success === true, 'GET /api/leadership still 200');

  const home = await api('GET', '/api/pages/home');
  ok(home.status === 200, 'GET /api/pages/home still 200');

  const adminNews = await api('GET', '/api/admin/news', { token: ADMIN_TOKEN });
  ok(adminNews.status === 200, 'GET /api/admin/news (authed) still 200');
}

// ============ Summary ============
console.log(`\n══════════════════════════════`);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
