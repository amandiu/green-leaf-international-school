// ------------------------------------------------------------
// Sitemap XML assembly (Phase B.7) — pure functions, no I/O.
//
// Extracted from routes/seoRoutes.js so the edge cases are unit
// testable (scripts/test-seo-api.mjs imports this file directly).
//
// Origin rule: when NO site URL can be resolved (no SITE_URL /
// CLIENT_URL env, no config fallback), the sitemap is served as
// an EMPTY urlset. Relative <loc> values are invalid per the
// sitemap protocol (https://www.sitemaps.org), and inventing an
// origin is worse than serving none — mirrors the client rule
// that canonical/og:url tags are simply omitted without an
// origin. Never hardcode localhost.
// ------------------------------------------------------------

/** XML-escape one text node or attribute value. */
export function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Sitemap <url> entry from { loc, lastmod?, changefreq?, priority? }. */
export function sitemapUrlXml({ loc, lastmod, changefreq, priority }) {
  const parts = [`    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${xmlEscape(lastmod)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${xmlEscape(changefreq)}</changefreq>`);
  if (priority) parts.push(`    <priority>${xmlEscape(priority)}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

/**
 * Assemble the full sitemap document from { loc, ... } entries
 * (loc is a site-relative path, e.g. "/about") and the resolved
 * origin. With a null/empty origin the result is a valid EMPTY
 * urlset — never relative <loc> values, never a fake origin.
 */
export function buildSitemapXml(entries, siteUrl) {
  const urls = siteUrl
    ? entries
        .map((entry) => sitemapUrlXml({ ...entry, loc: `${siteUrl}${entry.loc}` }))
        .join('\n')
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
