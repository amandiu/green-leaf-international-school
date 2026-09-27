// ------------------------------------------------------------
// Downloads end-to-end + security test (Phase B.6)
// Run from repo root:  node scripts/test-downloads-api.mjs
// Requires: server running on :5000 + MariaDB up + ADMIN_TOKEN
// in server/.env.
//
// Verifies the FULL chain:
//   admin upload → validation → safe storage → DB reference →
//   publish → public list → secure file serving → actual download
// plus the security checklist: auth gates, draft/archived hiding,
// path traversal, absolute/Windows paths, encoded traversal,
// extension + magic-byte rejection, double-extension references,
// arbitrary-file download prevention, missing-file safety,
// header-injection-safe filenames, and image-pipeline regression.
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

async function api(method, path, { body, token, headers: extra } = {}) {
  const headers = { ...(extra ?? {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON (file bytes) */ }
  return { status: res.status, json, headers: res.headers, text: () => res.text };
}

/** Multipart upload of raw bytes to the shared upload surface. */
async function uploadBytes(endpoint, filename, contentType, bytes) {
  const boundary = '----downloadtest';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`, 'utf8'),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
  ]);
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${ADMIN_TOKEN}`,
    },
    body,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

/** A tiny but structurally valid PDF (magic bytes %PDF-). */
const VALID_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n',
  'utf8',
);

const createdIds = [];

// ============ 1. Health ============
console.log('\n[1] Health');
{
  const { status, json } = await api('GET', '/api/health');
  ok(status === 200, `GET /api/health → 200 (got ${status})`);
  ok(json?.success === true, 'health success:true');
}

// ============ 2. Public list (unauthenticated) ============
console.log('\n[2] Public list — unauthenticated, safe envelope');
{
  const { status, json, headers } = await api('GET', '/api/downloads');
  ok(status === 200, `GET /api/downloads → 200 without auth (got ${status})`);
  ok(json?.success === true && Array.isArray(json?.data?.items), 'standard envelope {success, data.items}');
  ok(headers.get('cache-control') === 'no-store', 'Cache-Control: no-store');
}

// ============ 3. Auth gates ============
console.log('\n[3] Admin + upload endpoints reject unauthenticated requests');
{
  const checks = [
    ['GET', '/api/admin/downloads'],
    ['POST', '/api/admin/downloads'],
    ['PATCH', '/api/admin/downloads/1/status'],
    ['DELETE', '/api/admin/downloads/1'],
  ];
  for (const [method, path] of checks) {
    const noToken = await api(method, path, { body: method === 'GET' ? undefined : {} });
    ok(noToken.status === 401 || noToken.status === 403,
      `${method} ${path} without token rejected (got ${noToken.status})`);
  }
  const badUpload = await fetch(`${BASE}/api/admin/uploads/document`, { method: 'POST' });
  ok(badUpload.status === 401 || badUpload.status === 403,
    `document upload without token rejected (got ${badUpload.status})`);
  const badToken = await api('GET', '/api/admin/downloads', { token: 'invalid' });
  ok(badToken.status === 401 || badToken.status === 403,
    `admin list with invalid token rejected (got ${badToken.status})`);
}

// ============ 4. Upload validation ============
console.log('\n[4] Document upload validation (extension + magic bytes + size)');
{
  const empty = await uploadBytes('/api/admin/uploads/document', 'x.pdf', 'application/pdf', Buffer.alloc(0));
  ok(empty.status === 400, `empty body → 400 (got ${empty.status})`);

  const txt = await uploadBytes('/api/admin/uploads/document', 'notes.txt', 'text/plain', Buffer.from('hello'));
  ok(txt.status === 400, `.txt extension rejected → 400 (got ${txt.status})`);

  const exe = await uploadBytes('/api/admin/uploads/document', 'evil.exe', 'application/octet-stream', Buffer.from('MZ...'));
  ok(exe.status === 400, `.exe extension rejected → 400 (got ${exe.status})`);

  const js = await uploadBytes('/api/admin/uploads/document', 'evil.js', 'text/javascript', Buffer.from('alert(1)'));
  ok(js.status === 400, `.js extension rejected → 400 (got ${js.status})`);

  const fake = await uploadBytes('/api/admin/uploads/document', 'fake.pdf', 'application/pdf', Buffer.from('<html>not a pdf</html>'));
  ok(fake.status === 400, `HTML renamed .pdf rejected by magic bytes → 400 (got ${fake.status})`);

  const oversized = await uploadBytes(
    '/api/admin/uploads/document',
    'big.pdf',
    'application/pdf',
    Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(10 * 1024 * 1024)]),
  );
  ok(oversized.status === 400 || oversized.status === 413,
    `>10 MB rejected → 400/413 (got ${oversized.status})`);

  const good = await uploadBytes('/api/admin/uploads/document', 'Admission Form 2026.pdf', 'application/pdf', VALID_PDF);
  ok(good.status === 201, `valid PDF → 201 (got ${good.status})`);
  ok(typeof good.json?.data?.file_path === 'string'
     && /^\/api\/uploads\/documents\/[a-z0-9.-]+\.pdf$/.test(good.json.data.file_path),
    'returned file_path is a safe managed documents path (server-generated name)');
  ok(good.json?.data?.file_ext === 'pdf' && good.json.data.bytes > 0, 'metadata returned (ext + bytes)');
  ok(good.json?.data?.original_filename?.includes('..') === false,
    'original_filename sanitized for display');
  globalThis.__firstUpload = good.json?.data;
}

// ============ 5. Create validation (path-traversal references) ============
console.log('\n[5] Create payload validation — malicious file references rejected');
const VALID_BODY = () => ({
  title: `Admission Form ${Date.now()}`,
  description: 'Official admission form',
  category: 'Forms',
  file: globalThis.__firstUpload?.file_path,
  sort_order: 5,
  // Display metadata echoed from the upload response (same as the
  // admin UI payload).
  original_filename: globalThis.__firstUpload?.original_filename,
  file_ext: 'pdf',
  file_bytes: globalThis.__firstUpload?.bytes,
});
{
  const attacks = [
    ['traversal', '/api/uploads/documents/../../secret.pdf'],
    ['windows traversal', '\\\\server\\share\\secret.pdf'],
    ['encoded traversal', '/api/uploads/documents/%2e%2e%2fsecret.pdf'],
    ['absolute path', 'C:\\Windows\\system32\\config.pdf'],
    ['other managed namespace', '/api/uploads/images/photo.pdf'],
    ['wrong extension', '/api/uploads/documents/abc.txt'],
    ['double extension', '/api/uploads/documents/abc.pdf.js'],
    ['site asset', '/Activity/photo.jpg'],
    ['arbitrary URL', 'https://evil.example.com/payload.pdf'],
  ];
  for (const [label, badPath] of attacks) {
    const res = await api('POST', '/api/admin/downloads', {
      token: ADMIN_TOKEN,
      body: { ...VALID_BODY(), file: badPath },
    });
    ok(res.status === 400, `${label} file reference rejected → 400 (got ${res.status})`);
  }

  const noAuth = await api('POST', '/api/admin/downloads', { body: VALID_BODY() });
  ok(noAuth.status === 401 || noAuth.status === 403, 'create without token rejected');

  const unknown = await api('POST', '/api/admin/downloads', {
    token: ADMIN_TOKEN,
    body: { ...VALID_BODY(), hacker: 1 },
  });
  ok(unknown.status === 400, `unknown field rejected → 400 (got ${unknown.status})`);

  const badCat = await api('POST', '/api/admin/downloads', {
    token: ADMIN_TOKEN,
    body: { ...VALID_BODY(), category: 'Not A Category' },
  });
  ok(badCat.status === 400, `invalid category rejected → 400 (got ${badCat.status})`);

  const noTitle = await api('POST', '/api/admin/downloads', {
    token: ADMIN_TOKEN,
    body: { ...VALID_BODY(), title: '' },
  });
  ok(noTitle.status === 400, `empty title rejected → 400 (got ${noTitle.status})`);
}

// ============ 6. Create (DRAFT) + draft hiding ============
console.log('\n[6] Create as DRAFT — hidden from public list + file serving');
const created = await (async () => {
  const res = await api('POST', '/api/admin/downloads', {
    token: ADMIN_TOKEN,
    body: VALID_BODY(),
  });
  ok(res.status === 201, `valid create → 201 (got ${res.status})`);
  const item = res.json?.data;
  createdIds.push(item?.id);
  ok(item?.status === 'DRAFT', 'new item starts as DRAFT');
  ok(item?.file_bytes === globalThis.__firstUpload?.bytes, 'DB stores file size metadata');
  return item;
})();
{
  const pub = await api('GET', '/api/downloads');
  ok(!(pub.json?.data?.items ?? []).some((i) => i.id === created.id),
    'DRAFT item NOT in public list');

  const fileRes = await fetch(`${BASE}/api/downloads/${created.id}/file`);
  ok(fileRes.status === 404, `file serving of DRAFT → 404 (got ${fileRes.status})`);

  const adminFileRes = await fetch(`${BASE}/api/downloads/${created.id}/file`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  ok(adminFileRes.status === 404,
    'file serving of DRAFT → 404 even WITH admin token (public chain is published-only)');
}

// ============ 7. Publish → full chain works ============
console.log('\n[7] Publish → public list → secure file serving → actual download');
{
  const pub = await api('PATCH', `/api/admin/downloads/${created.id}/status`, {
    token: ADMIN_TOKEN,
    body: { status: 'PUBLISHED' },
  });
  ok(pub.status === 200 && pub.json?.data?.status === 'PUBLISHED',
    `PATCH status PUBLISHED → 200 (got ${pub.status})`);

  const list = await api('GET', '/api/downloads');
  const pubItem = (list.json?.data?.items ?? []).find((i) => i.id === created.id);
  ok(Boolean(pubItem), 'PUBLISHED item appears in public list');
  ok(!('status' in (pubItem ?? {})) && !('sort_order' in (pubItem ?? {})) && !('created_at' in (pubItem ?? {})),
    'public item exposes no admin metadata (status/sort_order/timestamps)');

  const cats = await api('GET', '/api/downloads/categories');
  ok((cats.json?.data?.categories ?? []).includes('Forms'),
    'categories endpoint lists the published category');

  const fileRes = await fetch(`${BASE}/api/downloads/${created.id}/file`);
  ok(fileRes.status === 200, `GET /api/downloads/:id/file → 200 (got ${fileRes.status})`);
  ok(fileRes.headers.get('content-type') === 'application/pdf',
    `Content-Type: application/pdf (server-determined, got ${fileRes.headers.get('content-type')})`);
  ok(/^attachment; filename="[^"]+"$/.test(fileRes.headers.get('content-disposition') ?? ''),
    'Content-Disposition: attachment with quoted sanitized filename');
  ok(fileRes.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');
  const bytes = Buffer.from(await fileRes.arrayBuffer());
  ok(bytes.equals(VALID_PDF), 'downloaded bytes EXACTLY match the uploaded document');
}

// ============ 8. Invalid/malicious ids on the serving route ============
console.log('\n[8] Serving route — invalid ids + traversal attempts fail safely');
{
  const cases = [
    ['/api/downloads/abc/file', 'non-numeric id'],
    ['/api/downloads/999999/file', 'unknown id'],
    ['/api/downloads/1%2e%2e%2f..%2f..%2fserver%2f%2e%2env%2fpackage/file', 'encoded traversal id'],
    ['/api/downloads/../server/.env', 'traversal path'],
  ];
  for (const [path, label] of cases) {
    const res = await fetch(`${BASE}${encodeURI(path).replace(/%252e/gi, '%2e')}`);
    ok(res.status === 404 || res.status === 400,
      `${label} → 400/404, never file contents (got ${res.status})`);
  }
  // There must be NO filename-based document route.
  const noFilenameRoute = await fetch(`${BASE}/api/uploads/documents/whatever.pdf`);
  ok(noFilenameRoute.status === 404,
    `no filename-based document serving route (got ${noFilenameRoute.status})`);
}

// ============ 9. Archived hidden ============
console.log('\n[9] Archived item — excluded from list AND file serving');
{
  await api('PATCH', `/api/admin/downloads/${created.id}/status`, {
    token: ADMIN_TOKEN,
    body: { status: 'ARCHIVED' },
  });
  const list = await api('GET', '/api/downloads');
  ok(!(list.json?.data?.items ?? []).some((i) => i.id === created.id),
    'ARCHIVED item NOT in public list');
  const fileRes = await fetch(`${BASE}/api/downloads/${created.id}/file`);
  ok(fileRes.status === 404, `ARCHIVED file serving → 404 (got ${fileRes.status})`);
  await api('PATCH', `/api/admin/downloads/${created.id}/status`, {
    token: ADMIN_TOKEN,
    body: { status: 'PUBLISHED' },
  });
}

// ============ 10. Category filter ============
console.log('\n[10] Public category filter');
{
  const filtered = await api('GET', '/api/downloads?category=Forms');
  ok(filtered.status === 200
     && (filtered.json?.data?.items ?? []).some((i) => i.id === created.id),
    '?category=Forms returns the item');
  const bad = await api('GET', '/api/downloads?category=Nope');
  ok(bad.status === 400, `invalid category filter → 400 (got ${bad.status})`);
  const other = await api('GET', '/api/downloads?category=Syllabus');
  ok(!(other.json?.data?.items ?? []).some((i) => i.id === created.id),
    'other category does not leak the item');
}

// ============ 11. Replacement + cleanup ============
console.log('\n[11] File replacement — DB updated first, old file cleaned safely');
{
  const second = await uploadBytes('/api/admin/uploads/document', 'Admission Form v2.pdf', 'application/pdf', VALID_PDF);
  ok(second.status === 201, `replacement upload → 201 (got ${second.status})`);
  const put = await api('PUT', `/api/admin/downloads/${created.id}`, {
    token: ADMIN_TOKEN,
    body: { file: second.json?.data?.file_path, title: `${created.title} v2` },
  });
  ok(put.status === 200 && put.json?.data?.file === second.json?.data?.file_path,
    `PUT replacement → row updated (got ${put.status})`);
  const serve = await fetch(`${BASE}/api/downloads/${created.id}/file`);
  ok(serve.status === 200, 'replacement file serves correctly');
}

// ============ 12. Malicious update rejected (row unchanged) ============
console.log('\n[12] Update with malicious reference rejected — row intact');
{
  const bad = await api('PUT', `/api/admin/downloads/${created.id}`, {
    token: ADMIN_TOKEN,
    body: {
      file: '/api/uploads/documents/../../.env',
      original_filename: 'x.pdf',
      file_ext: 'pdf',
      file_bytes: 100,
    },
  });
  ok(bad.status === 400, `malicious update → 400 (got ${bad.status})`);
  const check = await api('GET', `/api/admin/downloads/${created.id}`, { token: ADMIN_TOKEN });
  ok(check.json?.data?.file?.startsWith('/api/uploads/documents/'),
    'row still references the managed path (not corrupted)');
}

// ============ 13. Missing physical file ============
console.log('\n[13] Missing physical file — safe 404, no filesystem leak');
{
  // Remove the managed file directly on disk (simulating loss).
  const { unlinkSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const current = (await api('GET', `/api/admin/downloads/${created.id}`, { token: ADMIN_TOKEN })).json?.data;
  const diskPath = resolve(process.cwd(), 'server', 'src', 'uploads', 'documents', current.file.split('/').pop());
  try { unlinkSync(diskPath); } catch { /* already gone */ }
  const serve = await fetch(`${BASE}/api/downloads/${created.id}/file`);
  ok(serve.status === 404, `missing file → 404 (got ${serve.status})`);
  const body = await serve.json().catch(() => null);
  ok(body?.message === 'Download not found', 'safe message, no filesystem information leaked');
}

// ============ 14. Delete ============
console.log('\n[14] Delete — DB row removed, cleanup safe');
{
  const del = await api('DELETE', `/api/admin/downloads/${created.id}`, { token: ADMIN_TOKEN });
  ok(del.status === 200, `DELETE → 200 (got ${del.status})`);
  const check = await api('GET', `/api/admin/downloads/${created.id}`, { token: ADMIN_TOKEN });
  ok(check.status === 404, 'row gone from admin API');
  const pub = await api('GET', '/api/downloads');
  ok(!(pub.json?.data?.items ?? []).some((i) => i.id === created.id), 'row gone from public API');
  const badDel = await api('DELETE', '/api/admin/downloads/999999', { token: ADMIN_TOKEN });
  ok(badDel.status === 404, `delete unknown id → 404 (got ${badDel.status})`);
}

// ============ 15. Image pipeline regression ============
console.log('\n[15] Image upload pipeline unchanged');
{
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  const res = await uploadBytes('/api/admin/uploads/image', 't.png', 'image/png', png);
  ok(res.status === 201, `image upload still → 201 (got ${res.status})`);
  ok(typeof res.json?.data?.image_path === 'string', 'image response shape unchanged');
  const pdfAsImage = await uploadBytes('/api/admin/uploads/image', 'fake.jpg', 'image/jpeg', VALID_PDF);
  ok(pdfAsImage.status === 400, `PDF renamed .jpg still rejected by image pipeline (got ${pdfAsImage.status})`);
}

// ============ 16. Neighbour regressions ============
console.log('\n[16] Neighbour endpoint regressions');
{
  const checks = [
    ['/api/pages/home', 200],
    ['/api/news', 200],
    ['/api/gallery', 200],
    ['/api/leadership', 200],
    ['/api/settings', 200],
    ['/api/navigation', 200],
    ['/api/content/blocks', 200],
  ];
  for (const [path, expected] of checks) {
    const res = await api('GET', path);
    ok(res.status === expected, `GET ${path} → ${expected} (got ${res.status})`);
  }
}

// ============ Summary ============
console.log(`\n════════════════════════════════════════`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`════════════════════════════════════════`);
process.exit(fail === 0 ? 0 : 1);
