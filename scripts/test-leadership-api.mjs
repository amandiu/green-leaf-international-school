// ------------------------------------------------------------
// Leadership end-to-end API test (leadership database phase)
// Run from repo root:  node scripts/test-leadership-api.mjs
// Requires: server running on :5000 + MariaDB up + ADMIN_TOKEN
// in server/.env (read server-side of the tests via the API).
// Verifies: auth gate, section API, CRUD, validation, status,
// reorder, public payloads, image upload round-trip.
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

async function api(method, path, { body, token, raw } = {}) {
  const headers = {};
  if (body !== undefined && !raw) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: raw ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

// ============ 1. Health ============
console.log('\n[1] Server health');
{
  const { status, json } = await api('GET', '/api/health');
  ok(status === 200 && json?.success === true, 'GET /api/health → 200 success');
}

// ============ 0. Cleanup leftovers from earlier runs ============
console.log('\n[0] Cleanup leftover test records (idempotent)');
{
  const list = await api('GET', '/api/admin/leadership-messages', { token: ADMIN_TOKEN });
  const rows = list.json?.data || [];
  for (const row of rows) {
    await api('DELETE', `/api/admin/leadership-messages/${row.id}`, { token: ADMIN_TOKEN });
  }
  ok(true, `removed ${rows.length} pre-existing record(s)`);
}

// ============ 2. Admin auth gate ============
console.log('\n[2] Admin authentication gate');
{
  const noToken = await api('GET', '/api/admin/leadership-messages');
  ok(noToken.status === 401, `no token → rejected 401 (got ${noToken.status})`);

  const badToken = await api('GET', '/api/admin/leadership-messages', { token: 'wrong-token' });
  ok(badToken.status === 401, `invalid token → rejected 401 (got ${badToken.status})`);

  const goodToken = await api('GET', '/api/admin/leadership-messages', { token: ADMIN_TOKEN });
  ok(goodToken.status === 200 && goodToken.json?.success === true,
    `valid token → allowed (got ${goodToken.status})`);

  const sectionNoAuth = await api('GET', '/api/admin/leadership-section');
  ok(sectionNoAuth.status === 401, 'section endpoint also gated (401 without token)');
}

// ============ 3. Section API ============
console.log('\n[3] Leadership section (admin + public)');
let originalSection;
{
  const got = await api('GET', '/api/admin/leadership-section', { token: ADMIN_TOKEN });
  ok(got.status === 200 && got.json?.data?.id, 'GET admin section → 200 with row');
  originalSection = got.json.data;

  const upd = await api('PUT', '/api/admin/leadership-section', {
    token: ADMIN_TOKEN,
    body: {
      eyebrow: originalSection.eyebrow,
      title: originalSection.title,
      description: originalSection.description,
      is_active: originalSection.is_active,
    },
  });
  ok(upd.status === 200 && upd.json?.data?.id, 'PUT section (unchanged values) → 200');

  const bad = await api('PUT', '/api/admin/leadership-section', {
    token: ADMIN_TOKEN,
    body: { title: 'x'.repeat(300) },
  });
  ok(bad.status === 400, `section title > 255 chars rejected (got ${bad.status})`);

  const empty = await api('PUT', '/api/admin/leadership-section', {
    token: ADMIN_TOKEN, body: {},
  });
  ok(empty.status === 400, `empty section payload rejected (got ${empty.status})`);
}

// ============ 4. CRUD ============
console.log('\n[4] Message CRUD');
let principalId;
let chairmanId;
{
  const created = await api('POST', '/api/admin/leadership-messages', {
    token: ADMIN_TOKEN,
    body: { role: 'Principal', name: null, title: null, message: null, sort_order: 10, is_active: true },
  });
  ok(created.status === 201 && created.json?.data?.role === 'Principal',
    `create Principal → 201 (got ${created.status})`);
  principalId = created.json?.data?.id;

  const dup = await api('POST', '/api/admin/leadership-messages', {
    token: ADMIN_TOKEN, body: { role: 'principal' },
  });
  ok(dup.status === 409, `duplicate role (case-insensitive) rejected 409 (got ${dup.status})`);

  const badSort = await api('POST', '/api/admin/leadership-messages', {
    token: ADMIN_TOKEN, body: { role: 'Vice Principal', sort_order: -5 },
  });
  ok(badSort.status === 400, `negative sort_order rejected 400 (got ${badSort.status})`);

  const noRole = await api('POST', '/api/admin/leadership-messages', {
    token: ADMIN_TOKEN, body: { name: 'x' },
  });
  ok(noRole.status === 400, `missing role rejected 400 (got ${noRole.status})`);

  const chairman = await api('POST', '/api/admin/leadership-messages', {
    token: ADMIN_TOKEN,
    body: { role: 'Chairman', sort_order: 20, is_active: true },
  });
  chairmanId = chairman.json?.data?.id;
  ok(chairman.status === 201, `create Chairman → 201 (got ${chairman.status})`);

  const one = await api('GET', `/api/admin/leadership-messages/${principalId}`, { token: ADMIN_TOKEN });
  ok(one.status === 200 && one.json?.data?.id === principalId, 'GET one message → 200');

  const missing = await api('GET', '/api/admin/leadership-messages/999999', { token: ADMIN_TOKEN });
  ok(missing.status === 404, `GET missing id → 404 (got ${missing.status})`);

  const badId = await api('PUT', '/api/admin/leadership-messages/abc', {
    token: ADMIN_TOKEN, body: { name: 'x' },
  });
  ok(badId.status === 400, `non-numeric id rejected 400 (got ${badId.status})`);
}

// ============ 5. End-to-end content test (the DB proof) ============
console.log('\n[5] ADMIN → MySQL → API content round-trip');
{
  const upd = await api('PUT', `/api/admin/leadership-messages/${principalId}`, {
    token: ADMIN_TOKEN,
    body: { name: 'Test Principal', message: 'This is a database integration test.' },
  });
  ok(upd.status === 200 && upd.json?.data?.name === 'Test Principal',
    'admin PUT name/message → 200');

  const pub = await api('GET', '/api/leadership');
  const msg = pub.json?.data?.messages?.find((m) => m.id === principalId);
  ok(pub.json?.data?.messages?.length === 2, 'public /api/leadership returns 2 active messages');
  ok(msg?.name === 'Test Principal' && msg?.message === 'This is a database integration test.',
    'public API reflects the admin change');

  const adminList = await api('GET', '/api/admin/leadership-messages', { token: ADMIN_TOKEN });
  ok(!adminList.json?.data?.[0]?.section_id === false || adminList.json?.data?.[0]?.section_id,
    'admin rows carry section_id');
  ok(pub.json?.data?.messages?.every((m) => !('is_active' in m) && !('section_id' in m)),
    'public rows leak neither is_active nor section_id');
}

// ============ 6. Status active/inactive ============
console.log('\n[6] Active/inactive');
{
  const off = await api('PATCH', `/api/admin/leadership-messages/${principalId}/status`, {
    token: ADMIN_TOKEN, body: { is_active: false },
  });
  ok(off.status === 200 && off.json?.data?.is_active === false, 'PATCH status false → 200');

  let pub = await api('GET', '/api/leadership');
  ok(!pub.json?.data?.messages?.some((m) => m.id === principalId),
    'inactive principal absent from public API');

  const on = await api('PATCH', `/api/admin/leadership-messages/${principalId}/status`, {
    token: ADMIN_TOKEN, body: { is_active: true },
  });
  ok(on.status === 200 && on.json?.data?.is_active === true, 'PATCH status true → 200');

  pub = await api('GET', '/api/leadership');
  ok(pub.json?.data?.messages?.some((m) => m.id === principalId),
    're-activated principal present again');

  const bad = await api('PATCH', `/api/admin/leadership-messages/${principalId}/status`, {
    token: ADMIN_TOKEN, body: { is_active: 'yes' },
  });
  ok(bad.status === 400, `non-boolean is_active rejected 400 (got ${bad.status})`);
}

// ============ 7. Sort order / reorder ============
console.log('\n[7] Sort order + reorder');
{
  let pub = await api('GET', '/api/leadership');
  ok(pub.json?.data?.messages?.[0]?.id === principalId,
    'Principal (10) before Chairman (20) initially');

  const reorder = await api('PATCH', '/api/admin/leadership-messages/reorder', {
    token: ADMIN_TOKEN,
    body: { order: [{ id: principalId, sort_order: 20 }, { id: chairmanId, sort_order: 5 }] },
  });
  ok(reorder.status === 200, `PATCH reorder → 200 (got ${reorder.status})`);

  pub = await api('GET', '/api/leadership');
  ok(pub.json?.data?.messages?.[0]?.id === chairmanId,
    'Chairman (5) now appears before Principal (20)');

  const bad = await api('PATCH', '/api/admin/leadership-messages/reorder', {
    token: ADMIN_TOKEN, body: { order: [{ id: 424242, sort_order: 1 }] },
  });
  ok(bad.status === 400, `reorder with foreign id rejected 400 (got ${bad.status})`);

  // restore: principal 10, chairman 20
  await api('PATCH', '/api/admin/leadership-messages/reorder', {
    token: ADMIN_TOKEN,
    body: { order: [{ id: principalId, sort_order: 10 }, { id: chairmanId, sort_order: 20 }] },
  });
}

// ============ 8. Section active/inactive ============
console.log('\n[8] Section active/inactive');
{
  const off = await api('PUT', '/api/admin/leadership-section', {
    token: ADMIN_TOKEN, body: { is_active: false },
  });
  ok(off.status === 200 && off.json?.data?.is_active === false, 'section deactivated');

  let pub = await api('GET', '/api/leadership');
  ok(pub.json?.data?.section === null && pub.json?.data?.messages?.length === 0,
    'inactive section → { section: null, messages: [] }');

  const on = await api('PUT', '/api/admin/leadership-section', {
    token: ADMIN_TOKEN, body: { is_active: true },
  });
  ok(on.status === 200 && on.json?.data?.is_active === true, 'section re-activated');

  pub = await api('GET', '/api/leadership');
  ok(pub.json?.data?.section !== null, 'section content exposed again');
}

// ============ 9. Image upload round-trip ============
console.log('\n[9] Image upload (real bytes → DB → public API)');
{
  // Minimal valid 1x1 PNG
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
    + '0000000d49444154789c6260000000060005'
    + '27de41ba0000000049454e44ae426082', 'hex',
  );

  const boundary = '----greenleaftest';
  const parts = [];
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="portrait.png"\r\nContent-Type: image/png\r\n\r\n`);
  const head = Buffer.from(parts[0], 'utf8');
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([head, png, tail]);

  const up = await fetch(`${BASE}/api/admin/leadership-messages/image`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${ADMIN_TOKEN}`,
    },
    body,
  });
  const upJson = await up.json().catch(() => null);
  ok(up.status === 201 && /^\/api\/uploads\/leadership\/[A-Za-z0-9._-]+$/.test(upJson?.data?.image_url || ''),
    `upload PNG → 201 with safe image_url (got ${up.status})`);
  const imageUrl = upJson?.data?.image_url;

  const imgRes = await fetch(`${BASE}${imageUrl}`);
  ok(imgRes.status === 200, 'uploaded image served via /api/uploads');

  const withImage = await api('PUT', `/api/admin/leadership-messages/${chairmanId}`, {
    token: ADMIN_TOKEN, body: { image_url: imageUrl, image_alt: 'Test portrait' },
  });
  ok(withImage.status === 200 && withImage.json?.data?.image_url === imageUrl,
    'record updated with image_url');

  const pub = await api('GET', '/api/leadership');
  const msg = pub.json?.data?.messages?.find((m) => m.id === chairmanId);
  ok(msg?.image_url === imageUrl && msg?.image_alt === 'Test portrait',
    'public API returns image_url + image_alt');

  const traversal = await api('PUT', `/api/admin/leadership-messages/${chairmanId}`, {
    token: ADMIN_TOKEN, body: { image_url: '/api/uploads/leadership/../../secret.txt' },
  });
  ok(traversal.status === 400, `path traversal image_url rejected 400 (got ${traversal.status})`);

  const fake = await api('PUT', `/api/admin/leadership-messages/${chairmanId}`, {
    token: ADMIN_TOKEN, body: { image_url: 'http://localhost:5000/evil.png' },
  });
  ok(fake.status === 400, `absolute URL image_url rejected 400 (got ${fake.status})`);

  // cleanup image + clear reference
  await api('PUT', `/api/admin/leadership-messages/${chairmanId}`, {
    token: ADMIN_TOKEN, body: { image_url: null, image_alt: null },
  });
  const imgGone = await fetch(`${BASE}${imageUrl}`);
  ok(imgGone.status === 404, 'cleared image file removed from disk (404)');
}

// ============ 10. Legacy public endpoint ============
console.log('\n[10] Legacy public messages endpoint');
{
  const { status, json } = await api('GET', '/api/leadership-messages');
  ok(status === 200 && Array.isArray(json?.data) && json.data.length === 2,
    'GET /api/leadership-messages → active rows ordered');
}

// ============ 11. Delete + restore original state ============
console.log('\n[11] Delete + state restoration');
{
  const del = await api('DELETE', `/api/admin/leadership-messages/${chairmanId}`, { token: ADMIN_TOKEN });
  ok(del.status === 200, 'delete Chairman → 200');

  const gone = await api('GET', `/api/admin/leadership-messages/${chairmanId}`, { token: ADMIN_TOKEN });
  ok(gone.status === 404, 'deleted record now 404');

  // Restore Principal to verified-neutral state and remove it too
  await api('PUT', `/api/admin/leadership-messages/${principalId}`, {
    token: ADMIN_TOKEN,
    body: { name: null, message: null },
  });
  const del2 = await api('DELETE', `/api/admin/leadership-messages/${principalId}`, { token: ADMIN_TOKEN });
  ok(del2.status === 200, 'delete test Principal → 200');

  const pub = await api('GET', '/api/leadership');
  ok(pub.json?.data?.messages?.length === 0, 'public API back to empty (no fabricated data)');

  const sec = await api('GET', '/api/admin/leadership-section', { token: ADMIN_TOKEN });
  ok(
    sec.json?.data?.eyebrow === originalSection.eyebrow
    && sec.json?.data?.title === originalSection.title
    && sec.json?.data?.description === originalSection.description
    && sec.json?.data?.is_active === true,
    'section settings restored to original',
  );
}

// ============ Summary ============
console.log(`\n══════════════════════════════`);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
