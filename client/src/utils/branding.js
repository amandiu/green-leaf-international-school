// ═══════════════════════════════════════════════════════════════
// BRANDING RUNTIME — keeps <head> metadata in sync with the
// EFFECTIVE site settings (Phase A)
// ═══════════════════════════════════════════════════════════════
//
// Vite's index.html is static, so the browser title, favicon and
// Open Graph tags are applied at runtime. Two callers:
//
//   1. main.jsx          → applyBranding() with siteConfig values
//                          (immediate, so first paint is never
//                          broken even before the settings API
//                          responds)
//   2. SettingsHeadSync  → applyBranding(effectiveSettings) when
//                          GET /api/settings succeeds, so DB values
//                          win for title/favicon/OG metadata.
//
// There is still exactly ONE branding configuration system:
// siteConfig.js remains the fallback; the DB overlay comes
// through the single SettingsContext.
// ═══════════════════════════════════════════════════════════════

import { siteConfig } from '../../../shared/config/siteConfig';
import { toJsonLdScriptContent } from '../../../shared/utils/seoJsonLd';

function setMeta(selector, attrName, value) {
  if (!value) return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    const [kind, key] = selector.replace(/^meta\[/, '').replace(/\]$/, '').split('=');
    el.setAttribute(kind, key.replace(/["']/g, ''));
    document.head.appendChild(el);
  }
  el.setAttribute(attrName, value);
}

/**
 * Apply branding to the document <head>: title, favicon and Open
 * Graph tags. Safe to call more than once — later calls with DB
 * settings simply overwrite the siteConfig values.
 *
 * `settings` (optional): an effective-settings object as served
 * by GET /api/settings (grouped: identity/branding/contact/
 * social/location/seo). Omitted → pure siteConfig fallback.
 * `titleOverride` lets a page set a contextual title that still
 * ends with the organization name.
 *
 * Phase B.7 page guard: when a page has mounted per-page SEO
 * (setPageSeoActive(true)), the GLOBAL branding sync must NOT
 * stomp its title/description/OG tags. React runs child effects
 * before parent effects, so without this guard SettingsHeadSync
 * (Layout level) would overwrite the page's metadata on mount.
 */
export function applyBranding({ settings, titleOverride } = {}) {
  const { identity, branding, seo } = {
    ...siteConfig,
    ...(settings || {}),
  };

  if (!isPageSeoActive()) {
    document.title = titleOverride
      ? `${titleOverride} — ${identity.name}`
      : seo.title;

    setMeta('meta[name="description"]', 'content', seo.description);
    setMeta('meta[property="og:title"]', 'content', seo.title);
    setMeta('meta[property="og:description"]', 'content', seo.description);
  }

  let favicon = document.head.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.setAttribute('rel', 'icon');
    document.head.appendChild(favicon);
  }
  favicon.setAttribute('href', branding.favicon);

  // Phase B.7 fix: og:type and og:image are page-OWNED tags too. A
  // News detail page sets og:type=article and its own og:image — the
  // global settings sync must not flip them back to website/logo.
  if (!isPageSeoActive()) {
    setMeta('meta[property="og:image"]', 'content', branding.ogImage);
    setMeta('meta[property="og:type"]', 'content', 'website');
  }
}

// ------------------------------------------------------------
// Per-page SEO (Phase B.7)
//
// One mechanism for every page (hook: usePageSeo). Manages the
// page-scoped tags that global branding deliberately does not:
// canonical link, og:url, twitter card, and JSON-LD scripts.
// ------------------------------------------------------------

/** Module-level flag: a page-level SEO effect currently owns the head. */
let pageSeoActive = false;

/** True while a page-level usePageSeo effect is mounted. */
export function isPageSeoActive() {
  return pageSeoActive;
}

/** Pages call this in their usePageSeo effect setup/cleanup. */
export function setPageSeoActive(active) {
  pageSeoActive = Boolean(active);
}

/** Remove a meta tag entirely (page-SEO cleanup — setMeta skips nulls). */
function removeMeta(selector) {
  document.head.querySelector(selector)?.remove();
}

/** Set a <link rel="..."> tag; value null removes it. Returns the element or null. */
function setLink(rel, value) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!value) {
    if (el) el.remove();
    return null;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', value);
  return el;
}

/** Absolute URL for an image path (null when impossible). */
export function absoluteImageUrl(image, siteUrl) {
  if (typeof image !== 'string' || image.trim() === '') return null;
  const trimmed = image.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (siteUrl && trimmed.startsWith('/')) return `${siteUrl}${trimmed}`;
  return null;
}

/**
 * Apply one page's complete metadata set. Tags NOT listed keep
 * their previous value; passing null for an optional tag removes
 * it (e.g. leaving a News detail removes its JSON-LD).
 */
export function applyPageSeo({
  settings,
  title,
  description,
  canonical,
  ogType = 'website',
  ogImage,
  twitterCard = 'summary_large_image',
  jsonLd,
} = {}) {
  const { identity, branding, seo } = {
    ...siteConfig,
    ...(settings || {}),
  };

  // Sanity: page SEO owns the head while mounted.
  setPageSeoActive(true);

  document.title = title
    ? (title.endsWith(`— ${identity.name}`) ? title : `${title} — ${identity.name}`)
    : seo.title;

  if (description) {
    setMeta('meta[name="description"]', 'content', description);
  }
  setMeta('meta[property="og:title"]', 'content', document.title);
  if (description) {
    setMeta('meta[property="og:description"]', 'content', description);
  }
  setMeta('meta[property="og:type"]', 'content', ogType);
  setLink('canonical', canonical || null);
  if (canonical) {
    setMeta('meta[property="og:url"]', 'content', canonical);
  } else {
    removeMeta('meta[property="og:url"]');
  }

  const socialImage = absoluteImageUrl(ogImage ?? branding.ogImage, getSiteUrlSafe());
  setMeta('meta[property="og:image"]', 'content', socialImage || branding.ogImage);

  if (twitterCard) {
    setMeta('meta[name="twitter:card"]', 'content', twitterCard);
    setMeta('meta[name="twitter:title"]', 'content', document.title);
    if (description) setMeta('meta[name="twitter:description"]', 'content', description);
    if (socialImage) setMeta('meta[name="twitter:image"]', 'content', socialImage);
  }

  applyJsonLd(jsonLd);
}

/**
 * Restore the GLOBAL metadata set (used when leaving a page that
 * had page-level SEO). Same tag set as applyBranding + removes
 * the page-scoped extras (canonical, og:url, twitter, JSON-LD).
 */
export function restoreGlobalSeo(settings) {
  const { branding, seo } = {
    ...siteConfig,
    ...(settings || {}),
  };
  setPageSeoActive(false);
  document.title = seo.title;
  setMeta('meta[name="description"]', 'content', seo.description);
  setMeta('meta[property="og:title"]', 'content', seo.title);
  setMeta('meta[property="og:description"]', 'content', seo.description);
  setMeta('meta[property="og:type"]', 'content', 'website');
  setMeta('meta[property="og:image"]', 'content', branding.ogImage);
  setLink('canonical', null);
  removeMeta('meta[property="og:url"]');
  removeMeta('meta[name="twitter:card"]');
  removeMeta('meta[name="twitter:title"]');
  removeMeta('meta[name="twitter:description"]');
  removeMeta('meta[name="twitter:image"]');
  applyJsonLd(null);
}

/**
 * Set (or clear) the page's JSON-LD scripts. `schemas` is an
 * array of builder outputs; null entries are skipped; null/
 * undefined clears all. One <script data-seo-page> element per
 * schema, all marked so cleanup only removes ours.
 */
export function applyJsonLd(schemas) {
  document.head
    .querySelectorAll('script[type="application/ld+json"][data-seo-page]')
    .forEach((el) => el.remove());
  if (!Array.isArray(schemas)) return;
  for (const schema of schemas) {
    if (!schema) continue;
    const el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.setAttribute('data-seo-page', 'true');
    // "<" escaped inside toJsonLdScriptContent — a title or excerpt
    // can never close the script tag from inside the payload.
    el.textContent = toJsonLdScriptContent(schema);
    document.head.appendChild(el);
  }
}

/** Site URL for the client (no process.env in the browser → config only). */
function getSiteUrlSafe() {
  try {
    // Lazy import avoided: siteConfig is already a static import.
    return siteConfig.seo.siteUrl || null;
  } catch {
    return null;
  }
}

export default applyBranding;
