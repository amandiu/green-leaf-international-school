// ------------------------------------------------------------
// Secure image upload — security & compatibility test suite
// (shared image-upload phase)
//
// Run from repo root:  node scripts/test-image-upload.mjs
// Requires: server running on :5000 + ADMIN_TOKEN in server/.env
//
// NON-DESTRUCTIVE BY DESIGN (per the image-upload task §27):
//   - Test files are HARMLESS: tiny sharp-generated images and
//     text/HTML/fake-magic byte buffers. NO real malware is used
//     or created; nothing downloaded; nothing executed.
//   - Deletes ONLY the exact files it uploaded (fs unlink of the
//     returned managed paths). Touches no database rows, no
//     leadership records, no settings, no legacy assets.
//   - NOTE: the final rate-limit test intentionally exhausts the
//     dedicated upload bucket for localhost (30 uploads / 15 min).
//     Wait ~15 minutes (or restart the dev server) afterwards
//     before manually uploading images from the Admin UI.
// ------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createRequire } from 'node:module';

const BASE = 'http://127.0.0.1:5000';
const require = createRequire(new URL('../server/package.json', import.meta.url));
const sharp = require('sharp');

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

/** Multipart upload against the centralized endpoint. */
async function upload(buffer, { token = ADMIN_TOKEN, filename = 'test.png', contentType } = {}) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: contentType || 'application/octet-stream' });
  form.append('image', blob, filename);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${BASE}/api/admin/uploads/image`, { method: 'POST', headers, body: form });
  } catch {
    return { status: 0, json: null };
  }
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

async function api(method, path, { token, rawBody, contentType } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (contentType) headers['Content-Type'] = contentType;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: rawBody === undefined ? undefined : rawBody,
    });
  } catch {
    return { status: 0, json: null, res: null };
  }
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json, res };
}

/** Raw binary GET (the JSON helper consumes the body; this doesn't). */
async function fetchBinary(path) {
  try {
    const res = await fetch(`${BASE}${path}`);
    const body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, body, contentType: res.headers.get('content-type') || '' };
  } catch {
    return { status: 0, body: Buffer.alloc(0), contentType: '' };
  }
}

/** Files this script created on the server (cleaned up at the end). */
const createdPaths = [];
function recordCreated(imagePath) {
  if (typeof imagePath === 'string' && imagePath.startsWith('/api/uploads/')) {
    createdPaths.push(imagePath);
  }
}

const SAFE_NAME_RE = /^\/api\/uploads\/(leadership|images)\/[a-z0-9]+-[0-9a-f]{24}\.webp$/;
const WEBP_MAGIC = (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP';

// ============ fixtures (all harmless) ============
const FLAT = { width: 64, height: 48, channels: 3, background: { r: 34, g: 139, b: 34 } };
const PNG = await sharp({ create: FLAT }).png().toBuffer();
const JPEG = await sharp({ create: FLAT }).jpeg({ quality: 90 }).toBuffer();
const WEBP = await sharp({ create: FLAT }).webp().toBuffer();
// JPEG carrying a recognizable fake-EXIF marker (no real camera/GPS data).
const JPEG_WITH_MARKER = await sharp({ create: FLAT })
  .withMetadata({ exif: { IFD0: { Copyright: 'PHASEMARK' } } })
  .jpeg().toBuffer();
const PNG_B64 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const HTML = Buffer.from('<html><script>alert("x")</script></html>');
const EXELIKE = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.alloc(64, 0)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const GIF = Buffer.from('GIF89a' + 'x'.repeat(32));
const TRUNCATED_PNG = PNG.slice(0, 12); // magic bytes only, unusable image
const OVERSIZED = Buffer.concat([PNG_B64, Buffer.alloc(10 * 1024 * 1024 + 1, 0)]);
const WIDE = await sharp({ create: { ...FLAT, width: 6500, height: 40 } }).jpeg().toBuffer();

if (!ADMIN_TOKEN) {
  console.error('ADMIN_TOKEN missing in server/.env — cannot run authenticated tests.');
  process.exit(1);
}

// ============ 1. auth gate ============
console.log('\n[1] Authentication gate');
{
  const anon = await upload(PNG, { token: '' });
  ok(anon.status === 401, `unauthenticated upload → 401 (got ${anon.status})`);
  const bad = await upload(PNG, { token: 'wrong-token-value' });
  ok(bad.status === 401, `wrong Bearer token → 401 (got ${bad.status})`);
  const wrongCt = await api('POST', '/api/admin/uploads/image', {
    token: ADMIN_TOKEN, rawBody: 'x', contentType: 'text/plain',
  });
  ok(wrongCt.status === 400, `non-multipart body → 400 (got ${wrongCt.status})`);
}

// ============ 2. valid formats ============
console.log('\n[2] Valid JPG / PNG / WebP uploads');
let storedForRoundTrip = null;
{
  for (const [name, buf] of [['JPEG', JPEG], ['PNG', PNG], ['WebP', WEBP], ['base64 PNG', PNG_B64]]) {
    const r = await upload(buf, { filename: `valid.${name.toLowerCase()}` });
    const p = r.json?.data?.image_path || '';
    ok(r.status === 201 && SAFE_NAME_RE.test(p),
      `valid ${name} → 201 with server-generated .webp path (got ${r.status} ${p})`);
    if (name === 'PNG') storedForRoundTrip = p;
    recordCreated(p);
  }
}

// ============ 3. rejected content ============
console.log('\n[3] Malicious/fake/unsupported content rejection');
{
  const cases = [
    ['HTML renamed .jpg', HTML, 'fake.html.jpg'],
    ['exe-magic renamed .jpg', EXELIKE, 'fake.exe.jpg'],
    ['SVG (script) as .svg', SVG, 'payload.svg'],
    ['SVG renamed .jpg', SVG, 'payload.svg.jpg'],
    ['GIF', GIF, 'anim.gif'],
    ['truncated PNG', TRUNCATED_PNG, 'broken.png'],
    ['missing part (wrong field)', Buffer.alloc(0), ''],
  ];
  for (const [label, buf, fname] of cases) {
    if (label.startsWith('missing part')) {
      const form = new FormData();
      form.append('notimage', new Blob([PNG]), 'a.png');
      let status = 0;
      try {
        const res = await fetch(`${BASE}/api/admin/uploads/image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
          body: form,
        });
        status = res.status;
      } catch { /* network */ }
      ok(status === 400, `missing "image" part → 400 (got ${status})`);
      continue;
    }
    const r = await upload(buf, { filename: fname });
    ok(r.status === 400 && !!r.json?.message,
      `${label} → 400 "${r.json?.message || ''}" (got ${r.status})`);
  }
}

// ============ 4. size & dimension limits ============
console.log('\n[4] Size / dimension limits');
{
  const big = await upload(OVERSIZED, { filename: 'big.png' });
  ok(big.status === 413 || big.status === 400,
    `>10 MB upload rejected → 413/400 (got ${big.status} "${big.json?.message || ''}")`);
  const wide = await upload(WIDE, { filename: 'wide.jpg' });
  ok(wide.status === 400 && /dimension|maximum/i.test(wide.json?.message || ''),
    `6500px-wide image rejected (dimensions) → 400 (got ${wide.status})`);
}

// ============ 5. stored bytes ============
console.log('\n[5] Stored image is sanitized server output');
{
  const get = await fetchBinary(storedForRoundTrip);
  ok(get.status === 200, `GET stored image → 200 (got ${get.status})`);
  ok(get.contentType.includes('webp') || WEBP_MAGIC(get.body),
    'stored bytes are WebP (server re-encoded, original bytes discarded)');
  const marker = await upload(JPEG_WITH_MARKER, { filename: 'exif.jpg' });
  recordCreated(marker.json?.data?.image_path);
  let storedMarker = null;
  if (marker.json?.data?.image_path) {
    const mget = await fetchBinary(marker.json.data.image_path);
    storedMarker = mget.status === 200 ? mget.body : null;
  }
  ok(storedMarker !== null && !storedMarker.includes('PHASEMARK'),
    'EXIF-style metadata marker stripped from stored output');
}

// ============ 6. filename & traversal ============
console.log('\n[6] Filename safety / path traversal');
{
  const trav = await upload(PNG, { filename: '../../evil.jpg' });
  const p = trav.json?.data?.image_path || '';
  ok(trav.status === 201 && !p.includes('..') && !p.includes('evil'),
    'path-traversal filename neutralized: original name never used for storage');
  recordCreated(p);
  const route = await api('GET', '/api/uploads/images/..%2f..%2f..%2fserver.js');
  ok(route.status === 400 || route.status === 404,
    `GET /api/uploads/images/../server.js blocked (got ${route.status})`);
}

// ============ 7. leadership endpoint still works ============
console.log('\n[7] Leadership upload path (backward compatibility)');
{
  const r = await fetch(`${BASE}/api/admin/leadership-messages/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: (() => { const f = new FormData(); f.append('image', new Blob([PNG], { type: 'image/png' }), 'p.png'); return f; })(),
  });
  const json = await r.json().catch(() => null);
  const p = json?.data?.image_url || '';
  ok(r.status === 201 && /^\/api\/uploads\/leadership\/[a-z0-9]+-[0-9a-f]{24}\.webp$/.test(p),
    `leadership upload → 201 sanitized .webp (got ${r.status} ${p})`);
  recordCreated(p);
  const pub = await fetchBinary(p);
  ok(pub.status === 200, 'stored leadership image publicly served → 200');

  // Existing real content untouched: first real record's image still serves.
  const list = await api('GET', '/api/leadership-messages');
  const real = (list.json?.data || []).find((m) => m.image_url);
  if (real) {
    const realGet = await fetchBinary(real.image_url);
    ok(realGet.status === 200, `existing real leadership image serves → 200 (${real.image_url})`);
  } else {
    console.log('  – no existing leadership records with images; existing-content check skipped');
  }
}

// ============ 8. rate limiting (LAST — exhausts the bucket) ============
console.log('\n[8] Dedicated upload rate limit (runs last by design)');
{
  let got429 = false;
  let saw201 = false;
  for (let i = 0; i < 20 && !got429; i += 1) {
    const r = await upload(PNG_B64, { filename: 'rate.png' });
    if (r.status === 201) {
      saw201 = true;
      recordCreated(r.json?.data?.image_path);
    }
    if (r.status === 429) got429 = true;
  }
  ok(got429, 'sustained uploads → 429 rate limited');
  if (saw201) {
    ok(true, 'valid uploads within limit still succeed (201)');
  } else {
    // The bucket may already be drained by earlier sections of this
    // run (or a previous run inside the same 15-minute window).
    // Within-limit success is then evidenced by the 201s recorded
    // in section [2]; only the 429 assertion is enforced here.
    console.log('  – bucket pre-exhausted by earlier requests in this window; within-limit 201s were proven in section [2]');
  }
}

// ============ cleanup: remove ONLY files this script created ============
console.log('\n[9] Cleanup of test artifacts');
{
  let removed = 0;
  for (const p of createdPaths) {
    // Map /api/uploads/<dir>/<file> → server/src/uploads/<dir>/<file>.
    const rel = p.replace('/api/uploads/', '');
    if (!/^(images|leadership)\/[A-Za-z0-9._-]+$/.test(rel)) continue; // safety
    try {
      await unlink(resolve(process.cwd(), 'server', 'src', 'uploads', ...rel.split('/')));
      removed += 1;
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        fail += 1;
        console.log(`  ✖ could not remove ${p}: ${err?.message}`);
      }
    }
  }
  ok(true, `removed ${removed}/${createdPaths.length} uploaded test files (only files created by this script)`);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
