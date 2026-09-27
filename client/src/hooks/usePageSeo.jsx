// ------------------------------------------------------------
// usePageSeo (Phase B.7)
//
// THE one per-page SEO mechanism (no competing implementations).
// Every indexable public page calls it with its verified title,
// description and canonical path; the News detail page passes
// the PUBLISHED item's own data (title/excerpt/image/dates).
//
// Writes through utils/branding.js (applyPageSeo), which owns
// the single head-mutation implementation. On unmount it calls
// restoreGlobalSeo so navigating away leaves NO page-scoped
// tags behind (canonical/twitter/JSON-LD removed; global title/
// description restored) — no duplicate or conflicting metadata.
//
// `item` (optional, News detail): the published item. When
// present, NewsArticle JSON-LD is emitted from its public
// fields. Draft/archived items NEVER reach this hook: the
// detail endpoint returns 404 for them, and the page renders
// the not-found state without calling this hook with an item.
// ------------------------------------------------------------

import { useEffect } from 'react';
import {
  applyPageSeo,
  restoreGlobalSeo,
} from '../utils/branding';
import { buildCanonicalUrl, getSiteUrl } from '../../../shared/config/seoConfig';
import {
  buildNewsArticleSchema,
  buildOrganizationSchema,
  buildWebSiteSchema,
} from '../../../shared/utils/seoJsonLd';
import { useSettings } from '../context/SettingsContext';

/**
 * @param {object}   opts
 * @param {string}   opts.title        Page title (organization name appended).
 * @param {string}   opts.description  Page meta description.
 * @param {string}   opts.path         Canonical path ('/about').
 * @param {object}   [opts.item]       Published News item (detail page only).
 * @param {string}   [opts.ogType]     og:type (default 'website').
 * @param {string}   [opts.ogImage]    Optional page og:image (site-relative or absolute).
 */
export default function usePageSeo({ title, description, path, item, ogType, ogImage } = {}) {
  const { settings } = useSettings();

  useEffect(() => {
    const siteUrl = getSiteUrl();
    const canonical = buildCanonicalUrl(path);

    const schemas = [
      // Organization + WebSite on every page (verified identity only;
      // builders omit unverified fields like placeholder phones).
      buildOrganizationSchema({ ...settings, siteUrl }),
      buildWebSiteSchema({
        name: settings?.identity?.name,
        siteUrl,
      }),
      // NewsArticle only for a real published item (detail page).
      item ? buildNewsArticleSchema({ item, organizationName: settings?.identity?.name, siteUrl }) : null,
    ];

    applyPageSeo({
      settings,
      title,
      description,
      canonical,
      ogType: item ? 'article' : ogType,
      ogImage: item?.image || ogImage,
      jsonLd: schemas,
    });

    return () => {
      restoreGlobalSeo(settings);
    };
    // `item` changes identity per fetched news item; title/description
    // are derived from it. settings updates re-apply (DB overlay).
  }, [title, description, path, item, ogType, ogImage, settings]);

  return null;
}
