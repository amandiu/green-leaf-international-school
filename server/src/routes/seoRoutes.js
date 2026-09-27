// ------------------------------------------------------------
// SEO routes (Phase B.7): robots.txt + sitemap.xml
//
// robots.txt  — static text; Disallow list from the shared
//               SEO_DISALLOWED_PATHS inventory; Sitemap: line only
//               when a real origin resolves (never localhost
//               hardcoded — resolved via shared getSiteUrl()).
// sitemap.xml — static indexable routes from shared SEO_ROUTES +
//               PUBLISHED news detail URLs from the DB
//               (findPublishedNewsSlugs — PUBLISHED rows only, so
//               draft/archived/unknown slugs can never appear).
//
// No auth, no mutation, no user input — both endpoints answer
// from fixed config + DB reads only. Errors fall back to the
// static-route-only sitemap so the file never 500s.
// ------------------------------------------------------------

import { Router } from 'express';
import { getSiteUrl, SEO_ROUTES, SEO_DISALLOWED_PATHS } from '../../../shared/config/seoConfig.js';
import { findPublishedNewsSlugs } from '../models/NewsItem.js';
import pool from '../config/db.js';

const router = Router();

/** robots.txt — plain text, always 200. */
router.get('/robots.txt', (req, res) => {
  const siteUrl = getSiteUrl();
  const lines = ['User-agent: *'];
  for (const path of SEO_DISALLOWED_PATHS) {
    lines.push(`Disallow: ${path}`);
  }
  lines.push('');
  if (siteUrl) {
    lines.push(`Sitemap: ${siteUrl}/sitemap.xml`);
  }
  lines.push('');
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(lines.join('\n'));
});

/** XML-escape one text node or attribute value. */
function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Published news detail URLs. PUBLISHED-only via the model query.
 * Bounded (max 5000) and hard-capped: the sitemap protocol limit
 * is 50,000 entries / 50MB — a school site is nowhere near that,
 * and the cap keeps a runaway content backlog from ever breaking
 * the endpoint. DB failure → empty list (static routes remain).
 */
const MAX_NEWS_URLS = 5000;
async function publishedNewsSitemapEntries() {
  try {
    const slugs = await findPublishedNewsSlugs({ max: MAX_NEWS_URLS });
    const now = new Date().toISOString();
    return slugs.map((slug) => ({
      loc: `/news/${encodeURIComponent(slug)}`,
      lastmod: now,
      changefreq: 'weekly',
      priority: '0.6',
    }));
  } catch (err) {
    console.error('Sitemap: failed to load published news slugs:', err?.message || err);
    return [];
  }
}

/** Sitemap <url> entry from { loc, lastmod?, changefreq?, priority? }. */
function sitemapUrlXml({ loc, lastmod, changefreq, priority }) {
  const parts = [`    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${xmlEscape(lastmod)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${xmlEscape(changefreq)}</changefreq>`);
  if (priority) parts.push(`    <priority>${xmlEscape(priority)}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

/** GET /sitemap.xml — valid XML, one canonical URL per resource. */
router.get('/sitemap.xml', async (req, res) => {
  const siteUrl = getSiteUrl();
  const entries = SEO_ROUTES.map((route) => ({
    loc: route.path,
    lastmod: null,
    changefreq: route.changefreq,
    priority: route.priority,
  })).concat(await publishedNewsSitemapEntries());

  if (!siteUrl) {
    // No origin configured — serve the static-routes-only sitemap
    // rather than relative <loc> values (invalid for crawlers).
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.status(200);
    const urls = entries.map(sitemapUrlXml).join('\n');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    );
    return;
  }

  const urls = entries
    .map((entry) => sitemapUrlXml({ ...entry, loc: `${siteUrl}${entry.loc}` }))
    .join('\n');
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.status(200).send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9\">\n${urls}\n</urlset>\n`,
  );
});

export default router;
