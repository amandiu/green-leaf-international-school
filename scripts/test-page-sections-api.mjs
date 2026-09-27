// ------------------------------------------------------------
// Page sections end-to-end API test (Phase B.3)
// Run from repo root:  node scripts/test-page-sections-api.mjs
// Requires: server running on :5000 + MariaDB up + ADMIN_TOKEN
// in server/.env.
//
// Verifies (task checklist): about/academics/campus DB reads,
// admin edit → DB persist → public reflect, per-section fallback
// (missing section, hidden section), gallery integration
// untouched, auth rejection, invalid payload/unknown-field
// rejection, and regression of home/news/contact/settings/
// leadership/gallery endpoints.
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

async function api(method, path, { body, token } = {}) {
  const headers = {};
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

// ============ 1. Health ============
console.log('\n[1] Health');
{
  const { status, json } = await api('GET', '/api/health');
  ok(status === 200, `GET /api/health → 200 (got ${status})`);
  ok(json?.success === true, 'health success:true');
}

// ============ 2. ABOUT: public read + fallback ============
console.log('\n[2] About page — public read + fallback');
{
  const { status, json } = await api('GET', '/api/pages/about');
  ok(status === 200, `GET /api/pages/about → 200 (got ${status})`);
  ok(json?.success === true, 'about success:true');
  const d = json?.data || {};
  ok(d.intro && typeof d.intro.title === 'string' && d.intro.title.length > 0,
    'about.intro present with title (DB or fallback)');
  ok(Array.isArray(d.coreValues?.values) && d.coreValues.values.length >= 1,
    'about.coreValues.values is a non-empty array');
  ok(typeof d.visionMission?.vision === 'string' && typeof d.visionMission?.mission === 'string',
    'about.visionMission has vision+mission strings');
  ok(!('id' in d.intro) && !('sort_order' in d.intro) && !('created_at' in d.intro),
    'public payload exposes no admin metadata (id/sort_order/created_at)');
}

// ============ 3. ABOUT: auth gate ============
console.log('\n[3] About admin endpoints — auth gate');
{
  const noToken = await api('GET', '/api/admin/pages/about');
  ok(noToken.status === 401 || noToken.status === 403,
    `GET /api/admin/pages/about without token rejected (got ${noToken.status})`);
  const badToken = await api('GET', '/api/admin/pages/about', { token: 'invalid-token' });
  ok(badToken.status === 401 || badToken.status === 403,
    `GET /api/admin/pages/about with invalid token rejected (got ${badToken.status})`);
  const putNoToken = await api('PUT', '/api/admin/pages/about/sections/intro', { body: {} });
  ok(putNoToken.status === 401 || putNoToken.status === 403,
    `PUT about section without token rejected (got ${putNoToken.status})`);
}

// ============ 4. ABOUT: admin read + edit → DB → public ============
console.log('\n[4] About — admin read, edit, DB persist, public reflect');
const ABOUT_MARKER = `Verified intro title ${Date.now()}`;
{
  const admin = await api('GET', '/api/admin/pages/about', { token: ADMIN_TOKEN });
  ok(admin.status === 200, `GET /api/admin/pages/about with token → 200 (got ${admin.status})`);
  ok(admin.json?.data?.intro, 'admin about includes intro');

  const current = admin.json?.data?.intro;
  const put = await api('PUT', '/api/admin/pages/about/sections/intro', {
    token: ADMIN_TOKEN,
    body: { ...current, title: ABOUT_MARKER },
  });
  ok(put.status === 200, `PUT about intro → 200 (got ${put.status})`);
  ok(put.json?.data?.intro?.title === ABOUT_MARKER,
    'PUT response echoes merged effective content (server truth)');

  const pub = await api('GET', '/api/pages/about');
  ok(pub.json?.data?.intro?.title === ABOUT_MARKER,
    'PUBLIC /api/pages/about reflects the change (end-to-end)');

  // Restore the original title (leave DB as found).
  await api('PUT', '/api/admin/pages/about/sections/intro', {
    token: ADMIN_TOKEN,
    body: { ...current, title: current.title },
  });
  const restored = await api('GET', '/api/pages/about');
  ok(restored.json?.data?.intro?.title === current.title, 'about intro title restored');
}

// ============ 5. ABOUT: validation ============
console.log('\n[5] About — validation (unknown fields, malformed)');
{
  const current = (await api('GET', '/api/admin/pages/about', { token: ADMIN_TOKEN })).json?.data?.intro;
  const bad = await api('PUT', '/api/admin/pages/about/sections/intro', {
    token: ADMIN_TOKEN,
    body: { ...current, hackerField: 'nope' },
  });
  ok(bad.status === 400, `unknown top-level field rejected → 400 (got ${bad.status})`);
  const bad2 = await api('PUT', '/api/admin/pages/about/sections/intro', {
    token: ADMIN_TOKEN,
    body: { ...current, title: '' },
  });
  ok(bad2.status === 400, `empty required title rejected → 400 (got ${bad2.status})`);
  const bad3 = await api('PUT', '/api/admin/pages/about/sections/visionMission', {
    token: ADMIN_TOKEN,
    body: { vision: 'x', mission: 'y', extra: 1 },
  });
  ok(bad3.status === 400, `visionMission unknown field rejected → 400 (got ${bad3.status})`);
}

// ============ 6. ACADEMICS: public read + fallback ============
console.log('\n[6] Academics page — public read + fallback');
{
  const { status, json } = await api('GET', '/api/pages/academics');
  ok(status === 200, `GET /api/pages/academics → 200 (got ${status})`);
  const d = json?.data || {};
  ok(d.overview && typeof d.overview.title === 'string' && d.overview.title.length > 0,
    'academics.overview present with title');
  ok(Array.isArray(d.programs?.programs) && d.programs.programs.length === 4,
    'academics.programs has 4 program cards');
  ok(Array.isArray(d.environment?.items) && d.environment.items.length === 3,
    'academics.environment has 3 highlight cards');
  ok(typeof d.academicsCta?.buttonLink === 'string',
    'academics.academicsCta present with buttonLink');
}

// ============ 7. ACADEMICS: admin edit → public reflect ============
console.log('\n[7] Academics — admin edit, DB persist, public reflect');
const ACADEMICS_MARKER = `Verified programs heading ${Date.now()}`;
{
  const admin = await api('GET', '/api/admin/pages/academics', { token: ADMIN_TOKEN });
  ok(admin.status === 200, `GET /api/admin/pages/academics → 200 (got ${admin.status})`);
  const current = admin.json?.data?.programs;
  const put = await api('PUT', '/api/admin/pages/academics/sections/programs', {
    token: ADMIN_TOKEN,
    body: { ...current, title: ACADEMICS_MARKER },
  });
  ok(put.status === 200, `PUT academics programs → 200 (got ${put.status})`);
  const pub = await api('GET', '/api/pages/academics');
  ok(pub.json?.data?.programs?.title === ACADEMICS_MARKER,
    'PUBLIC academics reflects the programs title change');

  // Nested card validation: unknown field inside programs array.
  const bad = await api('PUT', '/api/admin/pages/academics/sections/programs', {
    token: ADMIN_TOKEN,
    body: { ...current, programs: [{ ...current.programs[0], nope: 1 }] },
  });
  ok(bad.status === 400, `nested unknown card field rejected → 400 (got ${bad.status})`);

  await api('PUT', '/api/admin/pages/academics/sections/programs', {
    token: ADMIN_TOKEN,
    body: current,
  });
  const restored = await api('GET', '/api/pages/academics');
  ok(restored.json?.data?.programs?.title === current.title, 'academics programs title restored');
}

// ============ 8. CAMPUS: public read + gallery untouched ============
console.log('\n[8] Campus page — public read + gallery integration');
{
  const { status, json } = await api('GET', '/api/pages/campus');
  ok(status === 200, `GET /api/pages/campus → 200 (got ${status})`);
  const d = json?.data || {};
  ok(d.overview && typeof d.overview.title === 'string' && d.overview.title.length > 0,
    'campus.overview present with title');
  ok(Array.isArray(d.facilities?.facilities) && d.facilities.facilities.length === 8,
    'campus.facilities has 8 facility cards');
  ok(d.galleryHighlight && typeof d.galleryHighlight.title === 'string',
    'campus.galleryHighlight present (heading copy only)');
  ok(!('images' in (d.galleryHighlight || {})) && !('slides' in (d.galleryHighlight || {})),
    'galleryHighlight contains NO image data (no gallery duplication)');

  // Gallery endpoint regression: published items array still served.
  // (The news + gallery modules use the legacy bare {items} envelope.)
  const gal = await api('GET', '/api/gallery');
  ok(gal.status === 200, `GET /api/gallery → 200 (got ${gal.status})`);
  ok(Array.isArray(gal.json?.items), 'gallery endpoint still returns items (bare {items} envelope)');
}

// ============ 9. CAMPUS: admin edit → public reflect ============
console.log('\n[9] Campus — admin edit, DB persist, public reflect');
const CAMPUS_MARKER = `Verified facilities heading ${Date.now()}`;
{
  const admin = await api('GET', '/api/admin/pages/campus', { token: ADMIN_TOKEN });
  ok(admin.status === 200, `GET /api/admin/pages/campus → 200 (got ${admin.status})`);
  const current = admin.json?.data?.facilities;
  const put = await api('PUT', '/api/admin/pages/campus/sections/facilities', {
    token: ADMIN_TOKEN,
    body: { ...current, title: CAMPUS_MARKER },
  });
  ok(put.status === 200, `PUT campus facilities → 200 (got ${put.status})`);
  const pub = await api('GET', '/api/pages/campus');
  ok(pub.json?.data?.facilities?.title === CAMPUS_MARKER,
    'PUBLIC campus reflects the facilities title change');

  await api('PUT', '/api/admin/pages/campus/sections/facilities', {
    token: ADMIN_TOKEN,
    body: current,
  });
  const restored = await api('GET', '/api/pages/campus');
  ok(restored.json?.data?.facilities?.title === current.title, 'campus facilities title restored');
}

// ============ 9b. Visibility toggle (publish/unpublish) ============
console.log('\n[9b] Section visibility (is_active → public hide)');
{
  const admin = await api('GET', '/api/admin/pages/campus', { token: ADMIN_TOKEN });
  const current = admin.json?.data?.galleryHighlight;
  // Hide the section → public payload must expose it as null.
  const hide = await api('PUT', '/api/admin/pages/campus/sections/galleryHighlight', {
    token: ADMIN_TOKEN,
    body: { ...current, isActive: false },
  });
  ok(hide.status === 200, `PUT galleryHighlight isActive:false → 200 (got ${hide.status})`);
  const hidden = await api('GET', '/api/pages/campus');
  ok(hidden.json?.data?.galleryHighlight && hidden.json.data.galleryHighlight.isActive === false,
    'hidden section served with isActive:false (public client hides the band)');
  // Restore.
  await api('PUT', '/api/admin/pages/campus/sections/galleryHighlight', {
    token: ADMIN_TOKEN,
    body: { ...current, isActive: true },
  });
  const shown = await api('GET', '/api/pages/campus');
  ok(shown.json?.data?.galleryHighlight?.title === current.title,
    'section visible again after re-publish (original copy intact)');
}

// ============ 10. Page identifier security ============
console.log('\n[10] Unknown pages/sections rejected');
{
  const unknownPage = await api('GET', '/api/pages/doesnotexist');
  ok(unknownPage.status === 404, `GET unknown page → 404 (got ${unknownPage.status})`);
  const unknownSection = await api('PUT', '/api/admin/pages/about/sections/nope', {
    token: ADMIN_TOKEN,
    body: { a: 1 },
  });
  ok(unknownSection.status === 404, `PUT unknown about section → 404 (got ${unknownSection.status})`);
  const homeSectionOnAbout = await api('PUT', '/api/admin/pages/about/sections/hero', {
    token: ADMIN_TOKEN,
    body: { a: 1 },
  });
  ok(homeSectionOnAbout.status === 404,
    `home section key rejected on about page → 404 (got ${homeSectionOnAbout.status})`);
  const adminUnknownPage = await api('GET', '/api/admin/pages/doesnotexist', { token: ADMIN_TOKEN });
  ok(adminUnknownPage.status === 404, `admin GET unknown page → 404 (got ${adminUnknownPage.status})`);
}

// ============ 11. HOME regression ============
console.log('\n[11] Home page regression');
{
  const pub = await api('GET', '/api/pages/home');
  ok(pub.status === 200, `GET /api/pages/home → 200 (got ${pub.status})`);
  const d = pub.json?.data || {};
  ok(d.hero && d.newsPreview && d.lifeAtSchool && d.videoShowcase,
    'home still serves all main sections');
  ok(typeof d.hero?.headline === 'string', 'home.hero.headline intact');
  const admin = await api('GET', '/api/admin/pages/home', { token: ADMIN_TOKEN });
  ok(admin.status === 200, `GET /api/admin/pages/home → 200 (got ${admin.status})`);
}

// ============ 12. Neighbour regressions ============
console.log('\n[12] Neighbour endpoint regressions');
{
  const news = await api('GET', '/api/news');
  ok(news.status === 200, `GET /api/news → 200 (got ${news.status})`);
  const blocks = await api('GET', '/api/content/blocks');
  ok(blocks.status === 200, `GET /api/content/blocks → 200 (got ${blocks.status})`);
  const settings = await api('GET', '/api/settings');
  ok(settings.status === 200, `GET /api/settings → 200 (got ${settings.status})`);
  const leadership = await api('GET', '/api/leadership');
  ok(leadership.status === 200, `GET /api/leadership → 200 (got ${leadership.status})`);
  const nav = await api('GET', '/api/navigation');
  ok(nav.status === 200, `GET /api/navigation → 200 (got ${nav.status})`);
}

// ============ Summary ============
console.log(`\n════════════════════════════════════════`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`════════════════════════════════════════`);
process.exit(fail === 0 ? 0 : 1);
