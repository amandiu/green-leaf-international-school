// ------------------------------------------------------------
// Gallery end-to-end API test (Phase B.2)
// Run from repo root:  node scripts/test-gallery-api.mjs
// Requires: server running on :5000 + MariaDB up + ADMIN_TOKEN
// in server/.env (read server-side of the tests via the API).
// Verifies: auth gate, upload round-trip through the EXISTING
// pipeline, CRUD, metadata validation, publish lifecycle,
// public/private separation, orphan-safe image cleanup, and
// regression of neighboring endpoints (news, contact, settings).
// ------------------------------------------------------------

import { readFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5000';

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

async function api(method, path, { body, token, raw, headers: extra } = {}) {
  const headers = { ...extra };
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

/** Upload a real (known-good) 1x1 PNG through the EXISTING pipeline. */
async function uploadTestImage() {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  const boundary = '----gallerytest';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`, 'utf8'),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
  ]);
  const res = await fetch(`${BASE}/api/admin/uploads/image`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${ADMIN_TOKEN}`,
    },
    body,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, path: json?.data?.image_path };
}

const VALID = {
  title: 'Test Sports Day',
  caption: 'An automated verification photo',
  category: 'Sports',
};

// ============ 1. Health + cleanup leftovers ============
console.log('\n[1] Health + cleanup leftover test rows');
{
  const { status } = await api('GET', '/api/health');
  ok(status === 200, `GET /api/health → 200 (got ${status})`);

  const list = await api('GET', '/api/admin/gallery', { token: ADMIN_TOKEN });
  const rows = (list.json?.data ?? []).filter((r) => r.title.startsWith('Test ') || r.title === 'Renamed Item');
  for (const row of rows) {
    await api('DELETE', `/api/admin/gallery/${row.id}`, { token: ADMIN_TOKEN });
  }
  ok(true, `removed ${rows.length} leftover test row(s)`);
}

// ============ 2. Admin auth gate ============
console.log('\n[2] Admin authentication gate');
{
  const noToken = await api('GET', '/api/admin/gallery');
  ok(noToken.status === 401, `no token → 401 (got ${noToken.status})`);
  const badToken = await api('POST', '/api/admin/gallery', { token: 'wrong', body: VALID });
  ok(badToken.status === 401, `invalid token create → 401 (got ${badToken.status})`);
  const delNoAuth = await api('DELETE', '/api/admin/gallery/1');
  ok(delNoAuth.status === 401, `delete without auth → 401 (got ${delNoAuth.status})`);
}

// ============ 3. Creation validation ============
console.log('\n[3] POST /api/admin/gallery — validation');
{
  const noTitle = await api('POST', '/api/admin/gallery', { token: ADMIN_TOKEN, body: { ...VALID, title: undefined } });
  ok(noTitle.status === 400, `missing title → 400 (got ${noTitle.status})`);

  const noImage = await api('POST', '/api/admin/gallery', { token: ADMIN_TOKEN, body: { ...VALID, image: undefined } });
  ok(noImage.status === 400, `missing image → 400 (got ${noImage.status})`);

  const badImage = await api('POST', '/api/admin/gallery', {
    token: ADMIN_TOKEN,
    body: { ...VALID, image: '/etc/passwd' },
  });
  ok(badImage.status === 400, `arbitrary filesystem path rejected → 400 (got ${badImage.status})`);

  const traversal = await api('POST', '/api/admin/gallery', {
    token: ADMIN_TOKEN,
    body: { ...VALID, image: '/api/uploads/images/../../secret.webp' },
  });
  ok(traversal.status === 400, `path traversal rejected → 400 (got ${traversal.status})`);

  const absUrl = await api('POST', '/api/admin/gallery', {
    token: ADMIN_TOKEN,
    body: { ...VALID, image: 'https://evil.example.com/x.webp' },
  });
  ok(absUrl.status === 400, `absolute URL image rejected → 400 (got ${absUrl.status})`);

  const badCategory = await api('POST', '/api/admin/gallery', {
    token: ADMIN_TOKEN,
    body: { ...VALID, category: 'Not A Category' },
  });
  ok(badCategory.status === 400, `unknown category rejected → 400 (got ${badCategory.status})`);

  const badSort = await api('POST', '/api/admin/gallery', {
    token: ADMIN_TOKEN,
    body: { ...VALID, sort_order: -3 },
  });
  ok(badSort.status === 400, `negative sort_order rejected → 400 (got ${badSort.status})`);

  const unknown = await api('POST', '/api/admin/gallery', {
    token: ADMIN_TOKEN,
    body: { ...VALID, hack: true },
  });
  ok(unknown.status === 400, `unknown field rejected → 400 (got ${unknown.status})`);

  const longTitle = await api('POST', '/api/admin/gallery', {
    token: ADMIN_TOKEN,
    body: { ...VALID, title: 'x'.repeat(151) },
  });
  ok(longTitle.status === 400, `title > 150 chars rejected → 400 (got ${longTitle.status})`);
}

// ============ 4. Upload through the EXISTING pipeline + create ============
console.log('\n[4] Upload via existing pipeline → create → persistence');
let itemId;
let imagePath;
{
  const up = await uploadTestImage();
  ok(up.status === 201 && /^\/api\/uploads\/images\/[A-Za-z0-9._-]+$/.test(up.path || ''),
    `existing pipeline upload → 201 safe path (got ${up.status})`);
  imagePath = up.path;

  const served = await fetch(`${BASE}${imagePath}`);
  ok(served.status === 200, 'uploaded image served via /api/uploads/images');

  // Invalid content must still be rejected by the existing pipeline
  const bad = await fetch(`${BASE}/api/admin/uploads/image`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=----x`, Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: Buffer.from('------x\r\nContent-Disposition: form-data; name="image"; filename="e.txt"\r\nContent-Type: text/plain\r\n\r\nnot an image\r\n------x--\r\n'),
  });
  ok(bad.status === 400, `non-image content rejected by pipeline → 400 (got ${bad.status})`);

  const created = await api('POST', '/api/admin/gallery', {
    token: ADMIN_TOKEN,
    body: { ...VALID, image: imagePath, sort_order: 5 },
  });
  ok(created.status === 201 && created.json?.data?.id, `create → 201 with id (got ${created.status})`);
  itemId = created.json?.data?.id;
  ok(created.json?.data?.status === 'DRAFT', 'new item is DRAFT (never client-supplied)');
  ok(created.json?.data?.image === imagePath, 'safe upload path stored as the image reference');
}

// ============ 5. Public/private separation ============
console.log('\n[5] Unpublished items invisible publicly');
{
  const pub = await api('GET', '/api/gallery');
  ok(pub.status === 200 && pub.json?.success === true, 'GET /api/gallery → 200');
  ok(!pub.json?.items?.some((i) => i.id === itemId), 'DRAFT item NOT in public API');

  const pubNoAuth = await api('GET', '/api/admin/gallery');
  ok(pubNoAuth.status === 401, 'public user cannot read admin listing (401)');
}

// ============ 6. Publish → public visibility → unpublish ============
console.log('\n[6] Publish lifecycle');
{
  const pub = await api('PATCH', `/api/admin/gallery/${itemId}/status`, {
    token: ADMIN_TOKEN, body: { status: 'PUBLISHED' },
  });
  ok(pub.status === 200 && pub.json?.data?.status === 'PUBLISHED', 'PATCH status → PUBLISHED');

  let publicList = await api('GET', '/api/gallery');
  const visible = publicList.json?.items?.find((i) => i.id === itemId);
  ok(!!visible, 'PUBLISHED item now in public API');
  ok(visible?.image === imagePath && visible?.title === 'Test Sports Day',
    'public row carries safe image path + title');
  ok(!('status' in (visible ?? {})), 'public rows do not leak the status field');

  const categories = await api('GET', '/api/gallery/categories');
  ok(categories.json?.data?.categories?.includes('Sports'),
    'categories endpoint lists Sports (has published items)');

  const filtered = await api('GET', '/api/gallery?category=Sports');
  ok(filtered.json?.items?.every((i) => i.category === 'Sports'), 'category filter works');

  const badFilter = await api('GET', '/api/gallery?category=Bogus');
  ok(badFilter.status === 400, `bogus category filter → 400 (got ${badFilter.status})`);

  const unpub = await api('PATCH', `/api/admin/gallery/${itemId}/status`, {
    token: ADMIN_TOKEN, body: { status: 'DRAFT' },
  });
  ok(unpub.status === 200 && unpub.json?.data?.status === 'DRAFT', 'unpublish → DRAFT');

  publicList = await api('GET', '/api/gallery');
  ok(!publicList.json?.items?.some((i) => i.id === itemId), 'unpublished item gone from public API');
}

// ============ 7. Edit metadata ============
console.log('\n[7] Edit metadata');
{
  const edit = await api('PUT', `/api/admin/gallery/${itemId}`, {
    token: ADMIN_TOKEN,
    body: { title: 'Renamed Item', caption: 'Updated caption', sort_order: 2 },
  });
  ok(edit.status === 200 && edit.json?.data?.title === 'Renamed Item', 'PUT metadata → 200');
  ok(edit.json?.data?.sort_order === 2, 'sort_order updated');

  const partial = await api('PUT', `/api/admin/gallery/${itemId}`, {
    token: ADMIN_TOKEN, body: { caption: 'Only caption changed' },
  });
  ok(partial.status === 200 && partial.json?.data?.caption === 'Only caption changed'
    && partial.json?.data?.title === 'Renamed Item', 'partial PUT preserves other fields');
}

// ============ 8. Admin detail / listing / bad ids ============
console.log('\n[8] Admin detail + listing');
{
  const one = await api('GET', `/api/admin/gallery/${itemId}`, { token: ADMIN_TOKEN });
  ok(one.status === 200 && one.json?.data?.id === itemId, 'GET one → 200');

  const missing = await api('GET', '/api/admin/gallery/999999', { token: ADMIN_TOKEN });
  ok(missing.status === 404, `missing id → 404 (got ${missing.status})`);

  const badId = await api('GET', '/api/admin/gallery/abc', { token: ADMIN_TOKEN });
  ok(badId.status === 400, `non-numeric id → 400 (got ${badId.status})`);

  const all = await api('GET', '/api/admin/gallery', { token: ADMIN_TOKEN });
  ok(all.status === 200 && Array.isArray(all.json?.data), 'admin listing → 200');
  ok(all.json?.data?.some((i) => i.id === itemId), 'admin listing includes the test row (all statuses)');
}

// ============ 9. Delete + orphan-safe image cleanup ============
console.log('\n[9] Delete + shared-file-safe image cleanup');
{
  // Second row sharing the SAME image — file must survive the first delete
  const second = await api('POST', '/api/admin/gallery', {
    token: ADMIN_TOKEN,
    body: { title: 'Test Shared Image', image: imagePath, category: 'Other' },
  });
  ok(second.status === 201, `second row with same image → 201 (got ${second.status})`);

  const del1 = await api('DELETE', `/api/admin/gallery/${itemId}`, { token: ADMIN_TOKEN });
  ok(del1.status === 200, 'delete first row → 200');

  const fileStillThere = await fetch(`${BASE}${imagePath}`);
  ok(fileStillThere.status === 200, 'image file KEPT (still referenced by second row)');

  const gone = await api('GET', `/api/admin/gallery/${itemId}`, { token: ADMIN_TOKEN });
  ok(gone.status === 404, 'deleted row now 404');

  const del2 = await api('DELETE', `/api/admin/gallery/${second.json.data.id}`, { token: ADMIN_TOKEN });
  ok(del2.status === 200, 'delete second row → 200');

  // Allow the async cleanup a beat, then check the file is gone
  await new Promise((r) => setTimeout(r, 300));
  const fileGone = await fetch(`${BASE}${imagePath}`);
  ok(fileGone.status === 404, 'image file REMOVED after last reference deleted (404)');
}

// ============ 10. Regression: neighbors ============
console.log('\n[10] Regression — existing endpoints still work');
{
  const news = await api('GET', '/api/news');
  ok(news.status === 200, 'GET /api/news still 200');

  const contact = await api('POST', '/api/contact', {
    body: { name: 'Gallery Regression', email: 'gallery-check@example.com', subject: 'regression', message: 'contact still works after gallery phase' },
  });
  ok(contact.status === 201, `POST /api/contact still 201 (got ${contact.status})`);

  const settings = await api('GET', '/api/settings');
  ok(settings.status === 200, 'GET /api/settings still 200');

  const leadership = await api('GET', '/api/leadership');
  ok(leadership.status === 200, 'GET /api/leadership still 200');

  const home = await api('GET', '/api/pages/home');
  ok(home.status === 200, 'GET /api/pages/home still 200');

  // News image upload through the same pipeline still works
  const newsImg = await uploadTestImage();
  ok(newsImg.status === 201, 'existing upload endpoint intact for news/other CMS');
  // And a news item can reference it (proves cross-module shared files exist)
  const newsItem = await api('POST', '/api/admin/news', {
    token: ADMIN_TOKEN,
    body: { title: 'Gallery Regression Post', type: 'NEWS', image: newsImg.path },
  });
  ok(newsItem.status === 201, 'news create with uploaded image → 201');
  // Note: the news module returns the bare row (its {items}/{error}
  // envelope deviation — MASTER_PLAN §20.11), so the id sits at the
  // top level, not under data.
  const delNews = await api('DELETE', `/api/admin/news/${newsItem.json?.id}`, { token: ADMIN_TOKEN });
  ok(delNews.status === 200, 'regression news item cleaned up');
}

// ============ Summary ============
console.log(`\n══════════════════════════════`);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
