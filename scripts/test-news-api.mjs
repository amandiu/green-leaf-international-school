// ------------------------------------------------------------
// News/Events end-to-end API test (Phase B item 4)
// Run from repo root:  node scripts/test-news-api.mjs
// Requires: server running on :5000 + MariaDB up + ADMIN_TOKEN
// in server/.env.
//
// Verifies: public news list + type filtering (?type=), invalid
// type rejection, upcoming-events view (?upcoming=true — future
// only, chronological, missing dates excluded), admin create/
// edit/publish lifecycle for event-type items, end-to-end
// admin→DB→public propagation, Cache-Control headers, and
// regression of neighboring endpoints.
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

async function api(method, path, { body, token, rawHeaders } = {}) {
  const headers = { ...(rawHeaders ?? {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json, headers: res.headers };
}

const day = (offsetDays) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

// ============ 1. Health ============
console.log('\n[1] Health');
{
  const { status, json } = await api('GET', '/api/health');
  ok(status === 200, `GET /api/health → 200 (got ${status})`);
  ok(json?.success === true, 'health success:true');
}

// ============ 2. Public news default list ============
console.log('\n[2] Public news — default list');
{
  const { status, json, headers } = await api('GET', '/api/news');
  ok(status === 200, `GET /api/news → 200 (got ${status})`);
  ok(Array.isArray(json?.items), 'response carries an items array (bare envelope)');
  ok(headers.get('cache-control') === 'no-store', 'Cache-Control: no-store (no stale public caching)');
}

// ============ 3. Type filter validation ============
console.log('\n[3] Type filter — invalid type rejected');
{
  const bad = await api('GET', '/api/news?type=bogus');
  ok(bad.status === 400, `GET /api/news?type=bogus → 400 (got ${bad.status})`);
  const bad2 = await api('GET', '/api/news?type=');
  ok(bad2.status === 200, `GET /api/news?type= (empty) → treated as no filter, 200 (got ${bad2.status})`);
}

// ============ 4. Seed test items (news + events) ============
console.log('\n[4] Seed test items via admin API');
const created = [];
async function seed(title, type, content) {
  const res = await api('POST', '/api/admin/news', {
    token: ADMIN_TOKEN,
    body: {
      title,
      type,
      status: 'PUBLISHED',
      excerpt: `Verification item: ${title}`,
      content,
    },
  });
  ok(res.status === 201, `POST ${type} "${title}" → 201 (got ${res.status})`);
  created.push(res.json?.id ?? res.json?.item?.id);
  return res.json;
}

console.log('\n[5] Admin create — validation + event date persistence');
{
  const bad = await api('POST', '/api/admin/news', {
    token: ADMIN_TOKEN,
    body: { title: 'X', type: 'NEWS', hacker: 1 },
  });
  ok(bad.status === 400, `unknown field rejected → 400 (got ${bad.status})`);
}

const newsItem = await seed(`Verification news ${Date.now()}`, 'NEWS', 'Regular news body.');
const futureEvent = await seed(
  `Verification future event ${Date.now()}`,
  'EVENT',
  `Event Date: ${day(7)}\n\nAnnual verification ceremony.`,
);
const pastEvent = await seed(
  `Verification past event ${Date.now()}`,
  'EVENT',
  `Event Date: ${day(-7)}\n\nAlready happened.`,
);
const tbaEvent = await seed(`Verification TBA event ${Date.now()}`, 'EVENT', 'Date to be announced.');

console.log('\n[6] Type filtering — ?type= returns only matching items');
{
  const news = await api('GET', '/api/news?type=NEWS&limit=50');
  ok(news.status === 200, `GET ?type=NEWS → 200 (got ${news.status})`);
  const newsItems = news.json?.items ?? [];
  ok(newsItems.every((i) => i.type === 'NEWS'), 'every item is type NEWS');
  ok(newsItems.some((i) => i.id === newsItem.id), 'seeded NEWS item present');

  const events = await api('GET', '/api/news?type=EVENT&limit=50');
  ok(events.status === 200, `GET ?type=EVENT → 200 (got ${events.status})`);
  const eventItems = events.json?.items ?? [];
  ok(eventItems.every((i) => i.type === 'EVENT'), 'every item is type EVENT');
  ok(eventItems.some((i) => i.id === futureEvent.id), 'seeded EVENT item present');
  ok(eventItems.every((i) => i.content === undefined),
    'list omits content bodies (detail-only)');
}

console.log('\n[7] Upcoming events — future only, chronological');
{
  const up = await api('GET', '/api/news?upcoming=true');
  ok(up.status === 200, `GET ?upcoming=true → 200 (got ${up.status})`);
  const items = up.json?.items ?? [];
  ok(items.every((i) => i.type === 'EVENT'), 'upcoming view serves EVENT items only');
  ok(items.some((i) => i.id === futureEvent.id), 'future event present in upcoming view');
  ok(!items.some((i) => i.id === pastEvent.id), 'past event excluded');
  ok(!items.some((i) => i.id === tbaEvent.id), 'event without a date excluded (safe handling)');
  ok(items.every((i) => typeof i.eventDate === 'string'), 'every upcoming item carries derived eventDate');
  const ts = items.map((i) => new Date(i.eventDate).getTime());
  ok(ts.every((t, idx) => idx === 0 || t >= ts[idx - 1]), 'upcoming events sorted chronologically');

  // Unpublished events never appear: create a draft future event.
  const draft = await api('POST', '/api/admin/news', {
    token: ADMIN_TOKEN,
    body: {
      title: `Verification draft event ${Date.now()}`,
      type: 'EVENT',
      status: 'DRAFT',
      content: `Event Date: ${day(14)}\n\nSecret draft.`,
    },
  });
  created.push(draft.json?.id);
  ok(draft.status === 201, 'draft future event created');
  const up2 = await api('GET', '/api/news?upcoming=true');
  ok(!(up2.json?.items ?? []).some((i) => i.id === draft.json?.id),
    'unpublished event NOT in public upcoming view');
}

console.log('\n[8] Admin lifecycle — publish/unpublish + end-to-end');
{
  // Unpublish the future event → disappears from both views.
  const unp = await api('PATCH', `/api/admin/news/${futureEvent.id}/status`, {
    token: ADMIN_TOKEN,
    body: { status: 'DRAFT' },
  });
  ok(unp.status === 200, `PATCH status DRAFT → 200 (got ${unp.status})`);
  const pubList = await api('GET', '/api/news?type=EVENT&limit=50');
  ok(!(pubList.json?.items ?? []).some((i) => i.id === futureEvent.id),
    'unpublished event gone from public list');

  // Edit fields (PUT) + republish via the status endpoint (the
  // project's lifecycle: publish stamping lives ONLY in PATCH
  // /status — PUT never mutates status).
  const put = await api('PUT', `/api/admin/news/${futureEvent.id}`, {
    token: ADMIN_TOKEN,
    body: { title: `${futureEvent.title} UPDATED` },
  });
  ok(put.status === 200, `PUT field edit → 200 (got ${put.status})`);
  const republish = await api('PATCH', `/api/admin/news/${futureEvent.id}/status`, {
    token: ADMIN_TOKEN,
    body: { status: 'PUBLISHED' },
  });
  ok(republish.status === 200, `PATCH status PUBLISHED → 200 (got ${republish.status})`);
  const pubList2 = await api('GET', '/api/news?type=EVENT&limit=50');
  ok((pubList2.json?.items ?? []).some((i) => i.id === futureEvent.id && i.title.endsWith('UPDATED')),
    'public list reflects admin edit end-to-end');

  // Auth gate on admin endpoints.
  const unauth = await api('GET', '/api/admin/news');
  ok(unauth.status === 401 || unauth.status === 403,
    `admin list without token rejected (got ${unauth.status})`);
}

console.log('\n[9] Detail endpoint regression');
{
  const detail = await api('GET', `/api/news/${futureEvent.slug}`);
  ok(detail.status === 200, `GET /api/news/:slug → 200 (got ${detail.status})`);
  ok(typeof detail.json?.content === 'string' && detail.json.content.includes('Event Date:'),
    'detail page keeps the full content (event date line intact)');
  const missing = await api('GET', '/api/news/does-not-exist-xyz');
  ok(missing.status === 404, `unknown slug → 404 (got ${missing.status})`);
}

console.log('\n[10] Cleanup test items');
{
  for (const id of created.filter(Boolean)) {
    const del = await api('DELETE', `/api/admin/news/${id}`, { token: ADMIN_TOKEN });
    ok(del.status === 200, `DELETE item ${id} → 200 (got ${del.status})`);
  }
}

console.log('\n[11] Neighbour endpoint regressions');
{
  const checks = [
    ['/api/pages/home', 200],
    ['/api/pages/about', 200],
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
  const adminNews = await api('GET', '/api/admin/news', { token: ADMIN_TOKEN });
  ok(adminNews.status === 200, `GET /api/admin/news (authed) → 200 (got ${adminNews.status})`);
}

// ============ Summary ============
console.log(`\n════════════════════════════════════════`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`════════════════════════════════════════`);
process.exit(fail === 0 ? 0 : 1);
