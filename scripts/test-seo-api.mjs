// ------------------------------------------------------------
// SEO verification (Phase B.7)
// Run from repo root:  node scripts/test-seo-api.mjs
//
// Env: server running on :5000 (override with SEO_TEST_BASE) +
// MariaDB up + ADMIN_TOKEN in server/.env (for the news leak tests).
//
// Verifies: robots.txt validity/allowlist, sitemap.xml validity
// (no API/admin URLs, no duplicates, origin-resolved, published
// news only), JSON-LD builder guarantees (verified-data-only,
// script-escape safety), repo-level wiring (every indexable page
// uses the ONE usePageSeo mechanism; no competing title writes),
// and draft/archived/nonexistent news leak prevention.
// ------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';

const BASE = process.env.SEO_TEST_BASE || 'http://127.0.0.1:5000';
const envText = existsSync('server/.env')
  ? readFileSync('server/.env', 'utf8')
  : '';
const ADMIN_TOKEN = /^ADMIN_TOKEN=(.+)$/m.exec(envText)?.[1]?.trim() || '';

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
  // Read the body ONCE (as text); JSON endpoints parse from it.
  // (Reading text() after json() would consume the stream twice.)
  const text = await res.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON (robots/sitemap) */ }
  return { status: res.status, json, text, headers: res.headers };
}

// ============ 1. robots.txt ============
console.log('\n[1] robots.txt');
const robots = await api('GET', '/robots.txt');
ok(robots.status === 200, `GET /robots.txt → 200 (got ${robots.status})`);
ok((robots.headers.get('content-type') || '').includes('text/plain'), 'Content-Type is text/plain');
ok(/^\s*User-agent:\s*\*\s*$/im.test(robots.text), 'has "User-agent: *"');
ok(/Disallow:\s*\/admin/im.test(robots.text), 'disallows /admin');
ok(/Disallow:\s*\/api/im.test(robots.text), 'disallows /api');
ok(/Sitemap:\s*\S+\/sitemap\.xml/im.test(robots.text), 'declares the sitemap URL');

// ============ 2. sitemap.xml — validity + hygiene ============
console.log('\n[2] sitemap.xml');
const sitemap = await api('GET', '/sitemap.xml');
ok(sitemap.status === 200, `GET /sitemap.xml → 200 (got ${sitemap.status})`);
ok((sitemap.headers.get('content-type') || '').includes('xml'), 'Content-Type is XML');
ok(sitemap.text.startsWith('<?xml'), 'XML declaration present');
ok(sitemap.text.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'), 'sitemap namespace present');
const locs = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
ok(locs.length >= 10, `has the static route inventory (got ${locs.length} URLs)`);
ok(locs.length > 0, 'sitemap parsed successfully (non-empty body)');
for (const required of ['/', '/about', '/academics', '/admissions', '/campus', '/news', '/contact', '/gallery', '/teachers', '/downloads']) {
  ok(locs.some((loc) => loc === `${new URL(BASE).origin.replace('127.0.0.1', 'localhost')}${required}`
    || loc.endsWith(required)), `sitemap contains ${required}`);
}
ok(locs.every((loc) => /^https?:\/\//.test(loc)), 'every <loc> is an absolute URL (origin-resolved, not relative)');
ok(!locs.some((loc) => /\/api(\/|\b)/.test(new URL(loc).pathname)), 'no /api URLs in sitemap');
ok(!locs.some((loc) => /\/admin|\/login|\/dashboard/.test(new URL(loc).pathname)), 'no admin/login URLs in sitemap');
ok(new Set(locs).size === locs.length, 'no duplicate URLs (Step 17)');
ok(!locs.some((loc) => loc.includes('?')), 'no query-string URLs in sitemap');

// ============ 3. JSON-LD builders — verified data only ============
console.log('\n[3] JSON-LD builders (shared/utils/seoJsonLd.js)');
const { buildOrganizationSchema, buildWebSiteSchema, buildNewsArticleSchema, toJsonLdScriptContent }
  = await import('../shared/utils/seoJsonLd.js');
const org = buildOrganizationSchema({
  identity: { name: 'Green Leaf', description: 'Quality education.' },
  branding: { ogImage: '/logo.jpg' },
  contact: { phone: '[Phone Number]' },           // placeholder → must be OMITTED
  social: { facebook: 'https://www.facebook.com/x', instagram: null },
  location: { address: '526-A Rd 12-B, Adabor, Dhaka 1207' },
  siteUrl: 'https://example.org',
});
ok(org['@type'] === 'EducationalOrganization', 'Organization schema type');
ok(org.name === 'Green Leaf', 'name from verified identity');
ok(!('telephone' in org), 'placeholder phone OMITTED (no invented data)');
ok(org.address?.streetAddress === '526-A Rd 12-B, Adabor, Dhaka 1207', 'verified address only');
ok(Array.isArray(org.sameAs) && org.sameAs.length === 1, 'sameAs only verified social links');
ok(!('geo' in org) && !('openingHours' in org) && !('aggregateRating' in org), 'no invented geo/hours/ratings');
const ws = buildWebSiteSchema({ name: 'Green Leaf', siteUrl: 'https://example.org' });
ok(ws['@type'] === 'WebSite' && ws.url === 'https://example.org', 'WebSite schema');
const na = buildNewsArticleSchema({
  item: { title: 'T & <x>', slug: 't', excerpt: 'E', image: '/i.webp', published_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z' },
  organizationName: 'Green Leaf', siteUrl: 'https://example.org',
});
ok(na && na['@type'] === 'NewsArticle' && na.headline === 'T & <x>', 'NewsArticle from published item fields');
ok(na.mainEntityOfPage === 'https://example.org/news/t', 'canonical mainEntityOfPage');
ok(buildNewsArticleSchema({ item: null }) === null, 'null item → no schema');
ok(!buildNewsArticleSchema({ item: { title: '   ' } }), 'blank title → no schema');
ok(toJsonLdScriptContent({ a: '<script>' }).includes('\\u003c'), 'JSON-LD escapes "<" (no script-tag escape)');

// ============ 4. getSiteUrl resolution ============
console.log('\n[4] Site URL resolution (shared/config/seoConfig.js)');
const { getSiteUrl } = await import('../shared/config/seoConfig.js');
const prevSite = process.env.SITE_URL; const prevClient = process.env.CLIENT_URL;
process.env.SITE_URL = 'https://prod.example.org/';
ok(getSiteUrl() === 'https://prod.example.org', 'SITE_URL wins + trailing slash stripped');
delete process.env.SITE_URL;
process.env.CLIENT_URL = 'http://localhost:5173';
ok(getSiteUrl() === 'http://localhost:5173', 'CLIENT_URL is the dev fallback');
process.env.CLIENT_URL = 'not a url';
ok(getSiteUrl() === null, 'malformed URL → null (no fake origin)');
if (prevSite !== undefined) process.env.SITE_URL = prevSite; else delete process.env.SITE_URL;
if (prevClient !== undefined) process.env.CLIENT_URL = prevClient; else delete process.env.CLIENT_URL;

// ============ 5. News SEO leak tests (draft/archived/nonexistent) ============
console.log('\n[5] Draft/archived news never reach public surfaces');
if (!ADMIN_TOKEN) {
  console.log('  (skipped — ADMIN_TOKEN not configured)');
} else {
  // Idempotency: remove any probe leftovers from an earlier run
  // (admin list is the { items } envelope; find by exact title).
  try {
    const adminList = await api('GET', '/api/admin/news', { token: ADMIN_TOKEN });
    const leftovers = (adminList.json?.items || []).filter((i) => i.title === 'SEO Leak Probe');
    for (const item of leftovers) {
      await api('DELETE', `/api/admin/news/${item.id}`, { token: ADMIN_TOKEN });
    }
    if (leftovers.length > 0) console.log(`  (removed ${leftovers.length} leftover probe item(s))`);
  } catch { /* best effort */ }

  // NOTE: the news controller deviates from the standard envelope
  // (MASTER PLAN §20.11) — it returns the BARE item / { items }.
  const mk = await api('POST', '/api/admin/news', {
    token: ADMIN_TOKEN,
    body: { title: 'SEO Leak Probe', type: 'NEWS', excerpt: 'probe excerpt', content: 'probe content' },
  });
  const id = mk.json?.id ?? mk.json?.data?.id;
  const slug = mk.json?.slug ?? mk.json?.data?.slug;
  if (mk.status !== 201 || !id) {
    console.log(`  (probe create failed: ${mk.status} ${JSON.stringify(mk.json)?.slice(0, 200)})`);
  }
  ok(mk.status === 201 && Boolean(id && slug), 'probe item created (DRAFT)');
  if (id && slug) {
    const pubDetail = await api('GET', `/api/news/${slug}`);
  ok(pubDetail.status === 404, 'DRAFT detail endpoint → 404 (metadata source is published-only)');
  let sm = await api('GET', '/sitemap.xml');
  ok(!sm.text.includes(encodeURIComponent(slug)) && !sm.text.includes(slug), 'DRAFT slug NOT in sitemap');
  const pub = await api('PATCH', `/api/admin/news/${id}/status`, { token: ADMIN_TOKEN, body: { status: 'PUBLISHED' } });
  ok(pub.status === 200, 'probe published');
  sm = await api('GET', '/sitemap.xml');
  ok(sm.text.includes(slug), 'PUBLISHED slug IS in sitemap');
  await api('PATCH', `/api/admin/news/${id}/status`, { token: ADMIN_TOKEN, body: { status: 'ARCHIVED' } });
  sm = await api('GET', '/sitemap.xml');
  ok(!sm.text.includes(slug), 'ARCHIVED slug NOT in sitemap');
  const detail = await api('GET', `/api/news/${slug}`);
  ok(detail.status === 404, 'ARCHIVED detail endpoint → 404 (no metadata leak)');
  await api('DELETE', `/api/admin/news/${id}`, { token: ADMIN_TOKEN });
  sm = await api('GET', '/sitemap.xml');
  ok(!sm.text.includes(slug), 'deleted slug gone from sitemap');
  const missing = await api('GET', '/api/news/definitely-not-a-real-slug-xyz');
  ok(missing.status === 404, 'nonexistent slug → 404 (neutral metadata path)');
  }
}

// ============ 6. Repo wiring — ONE SEO mechanism ============
console.log('\n[6] Repo wiring (single mechanism, per-page coverage)');
const { execSync } = await import('node:child_process');
const pageSeoCallers = execSync(
  'grep -rl "usePageSeo(" client/src/Pages | sort', { encoding: 'utf8' },
).trim().split('\n');
const indexable = ['Home.jsx', 'About.jsx', 'Academics.jsx', 'Admissions.jsx', 'Campus.jsx',
  'News.jsx', 'Contact.jsx', 'Gallery.jsx', 'TeachersStaff.jsx', 'Downloads.jsx', 'NewsDetail.jsx'];
for (const f of indexable) {
  ok(pageSeoCallers.some((p) => p.endsWith(f)), `${f} uses usePageSeo`);
}
ok(pageSeoCallers.length === indexable.length,
  `no page missed + no extra callers (got ${pageSeoCallers.length})`);
const docTitleWrites = execSync(
  'grep -rn "document.title" client/src --include="*.jsx" --include="*.js"', { encoding: 'utf8' },
).trim().split('\n').filter((l) => !l.includes('branding.js'));
ok(docTitleWrites.length === 0, `no competing document.title writes (found ${docTitleWrites.length})`);
ok(existsSync('shared/config/seoConfig.js') && existsSync('shared/utils/seoJsonLd.js'),
  'shared SEO config + JSON-LD builders exist');

// ============ result ============
console.log(`\n${'═'.repeat(40)}`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(40)}`);
process.exit(fail === 0 ? 0 : 1);
