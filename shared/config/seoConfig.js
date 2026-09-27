// ═══════════════════════════════════════════════════════════════
// SEO CONFIG — canonical public-route inventory + site URL
// (Phase B.7)
// ═══════════════════════════════════════════════════════════════
//
// ONE source of truth for every indexable public route. Consumers:
//
//   server/src/routes/seoRoutes.js  → robots.txt + /sitemap.xml
//   client/src/hooks/usePageSeo.jsx → per-page canonical URLs
//
// SITE URL resolution (the actual public origin):
//   1. SITE_URL env var (production origin) — takes precedence
//   2. CLIENT_URL env var (dev convenience, http://localhost:5173)
//   3. siteConfig.seo.siteUrl fallback (null → client renders no
//      canonical tags; server serves robots/sitemap WITHOUT a
//      Sitemap: line)
//
// Never hardcode localhost into sitemap/robots — resolve it.
// ═══════════════════════════════════════════════════════════════

import { siteConfig } from './siteConfig.js';

/**
 * The canonical public origin. Resolution order:
 * SITE_URL → CLIENT_URL → siteConfig fallback (may be null).
 * Origin only — never carries a path or trailing slash.
 *
 * Isomorphic: runs on the server (env vars readable) AND in the
 * browser (no `process` — guarded, config fallback only).
 */
function envValue(key) {
  try {
    return typeof process !== 'undefined' ? process.env?.[key] : undefined;
  } catch {
    return undefined;
  }
}

export function getSiteUrl() {
  const raw = envValue('SITE_URL') || envValue('CLIENT_URL') || siteConfig.seo.siteUrl;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Canonical paths of indexable public pages — verified against
 * client/src/App.jsx (Phase B.7 route audit). No query strings,
 * no trailing slashes, one canonical URL per resource.
 */
export const SEO_ROUTES = Object.freeze([
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/about', priority: '0.8', changefreq: 'monthly' },
  { path: '/academics', priority: '0.8', changefreq: 'monthly' },
  { path: '/admissions', priority: '0.8', changefreq: 'monthly' },
  { path: '/campus', priority: '0.8', changefreq: 'monthly' },
  { path: '/news', priority: '0.8', changefreq: 'daily' },
  { path: '/contact', priority: '0.8', changefreq: 'monthly' },
  { path: '/gallery', priority: '0.7', changefreq: 'weekly' },
  { path: '/teachers', priority: '0.7', changefreq: 'monthly' },
  { path: '/downloads', priority: '0.7', changefreq: 'weekly' },
]);

/** Non-indexable app areas (robots.txt Disallow list). */
export const SEO_DISALLOWED_PATHS = Object.freeze([
  '/admin',
  '/api',
  '/login',
  '/dashboard',
]);

/** Build one canonical URL (null when no site URL is configured). */
export function buildCanonicalUrl(path) {
  const siteUrl = getSiteUrl();
  if (!siteUrl) return null;
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
