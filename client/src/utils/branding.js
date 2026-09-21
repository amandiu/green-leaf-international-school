// ═══════════════════════════════════════════════════════════════
// BRANDING RUNTIME — keeps <head> metadata in sync with siteConfig
// ═══════════════════════════════════════════════════════════════
//
// Vite's index.html is static, so the browser title, favicon and
// Open Graph tags are applied from the central config at startup
// (client/src/main.jsx). Change siteConfig → the tab and metadata
// follow. No helmet/react-helmet dependency needed.
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
 * Apply the central branding config to the document <head>:
 * title, favicon and Open Graph tags. Safe to call more than once.
 * `titleOverride` lets a page set a contextual title that still
 * ends with the organization name.
 */
export function applyBranding({ titleOverride } = {}) {
  const { identity, branding, seo } = siteConfig;

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
