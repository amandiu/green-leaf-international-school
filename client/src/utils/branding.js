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
 */
export function applyBranding({ settings, titleOverride } = {}) {
  const { identity, branding, seo } = {
    ...siteConfig,
    ...(settings || {}),
  };

  document.title = titleOverride
    ? `${titleOverride} — ${identity.name}`
    : seo.title;

  let favicon = document.head.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.setAttribute('rel', 'icon');
    document.head.appendChild(favicon);
  }
  favicon.setAttribute('href', branding.favicon);

  setMeta('meta[name="description"]', 'content', seo.description);
  setMeta('meta[property="og:title"]', 'content', seo.title);
  setMeta('meta[property="og:description"]', 'content', seo.description);
  setMeta('meta[property="og:image"]', 'content', branding.ogImage);
  setMeta('meta[property="og:type"]', 'content', 'website');
}

export default applyBranding;
