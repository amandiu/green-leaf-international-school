// ------------------------------------------------------------
// Page sections service (Phase B + B.3)
//
// THE single runtime merge point for page content:
//
//   MySQL page_sections                     (DB values win)
//   + shared/content/<page>Content.js       (fallback per section)
//   → effective page content object
//
// Mirrors the Phase A siteSettingsService pattern:
//   - getPageContent() NEVER throws on DB downtime — the pure
//     fallback content is served so the public page keeps
//     rendering (graceful degradation).
//   - updatePageSection() validates against the per-section
//     schema before any write; the service returns the merged
//     effective content so admin UIs show server truth.
//
// Phase B.3: the same engine now drives 'about' | 'academics' |
// 'campus' alongside 'home'. Page identifiers follow the existing
// convention (lowercase route slugs). The block-reference pattern
// ({ __block }) from Phase D keeps working for ANY page.
// ------------------------------------------------------------

import { findByPage, findPageSection, upsertSection } from '../models/PageSection.js';
import { validatePageSection } from '../validators/pageSectionValidation.js';
import { notFound } from '../utils/errors.js';
import {
  HOME_SECTION_KEYS,
  HOME_ADMISSIONS_CTA_BLOCK_KEY,
  defaultHomeContent,
} from '../../../shared/content/homeContent.js';
import {
  ABOUT_SECTION_KEYS,
  defaultAboutContent,
} from '../../../shared/content/aboutContent.js';
import {
  ACADEMICS_SECTION_KEYS,
  defaultAcademicsContent,
} from '../../../shared/content/academicsContent.js';
import {
  CAMPUS_SECTION_KEYS,
  defaultCampusContent,
} from '../../../shared/content/campusContent.js';
import { getEffectiveBlocks } from './contentBlockService.js';

export { HOME_SECTION_KEYS };
export { ABOUT_SECTION_KEYS, ACADEMICS_SECTION_KEYS, CAMPUS_SECTION_KEYS };

/** All page identifiers with a validated section schema. */
export const PAGE_SECTION_KEYS = Object.freeze({
  home: HOME_SECTION_KEYS,
  about: ABOUT_SECTION_KEYS,
  academics: ACADEMICS_SECTION_KEYS,
  campus: CAMPUS_SECTION_KEYS,
});

/** Per-page fallback factories (fresh copy each call — never shared references). */
const PAGE_FALLBACKS = Object.freeze({
  home: defaultHomeContent,
  about: defaultAboutContent,
  academics: defaultAcademicsContent,
  campus: defaultCampusContent,
});

/** Section sort_order mirrors the page layout; used on first write only. */
const SECTION_SORT_ORDER = Object.freeze({
  home: { hero: 10, newsPreview: 20, lifeAtSchool: 30, videoShowcase: 40, admissionsCta: 50 },
  about: { intro: 10, coreValues: 20, visionMission: 30 },
  academics: { overview: 10, programs: 20, environment: 30, academicsCta: 40 },
  campus: { overview: 10, facilities: 20, galleryHighlight: 30 },
});

/**
 * Phase E: strip legacy news item fields from the newsPreview
 * heading copy. Items live ONLY in the central news table now —
 * a legacy `items` array in page_sections is never merged into
 * the public payload again (it is also stripped on the next
 * admin save of the section).
 */
function stripLegacyNewsItems(content) {
  if (typeof content !== 'object' || content === null) return content;
  const { items, category, date, color, ...rest } = content;
  return rest;
}

/** Merge one DB row over the fallback section (shallow — schema shapes are flat). */
function mergeSection(fallback, dbContent, isActive) {
  if (typeof dbContent !== 'object' || dbContent === null) return fallback;
  const merged = { ...fallback, ...dbContent };
  merged.isActive = isActive;
  return merged;
}

/**
 * Effective page content: fallback overlaid with DB sections.
 * Missing section → that section only falls back (per-section
 * fallback requirement). DB down → whole fallback object.
 *
 * Phase D pattern (works for every page): a section whose content
 * is a REFERENCE ({ __block: '<key>' }) resolves against the
 * effective reusable content blocks — the referenced block is the
 * single source of truth; nothing is copied into page_sections.
 * An inactive or missing referenced block resolves to null (the
 * consumer hides that section — never crashes).
 */
async function getPageContentStrict(page) {
  const effective = PAGE_FALLBACKS[page]();
  const rows = await findByPage(page);
  for (const row of rows) {
    if (!(row.section_key in effective)) continue; // unknown section → ignore
    const content = row.content;
    if (typeof content === 'object' && content !== null && '__block' in content) {
      // Reference section: resolve from the reusable blocks.
      // Row hidden or block inactive/missing → null (the public
      // page hides the section; it never crashes).
      const blockKey = content.__block;
      const blocks = await getEffectiveBlocks();
      const block = blocks[blockKey];
      const rowVisible = row.is_active === 1;
      effective[row.section_key] = rowVisible && block && block.isActive !== false
        ? { ...block, isActive: true }
        : null;
      continue;
    }
    effective[row.section_key] = mergeSection(
      effective[row.section_key],
      page === 'home' && row.section_key === 'newsPreview'
        ? stripLegacyNewsItems(content)
        : content,
      row.is_active === 1,
    );
  }
  // A missing home admissionsCta row falls back to the block default.
  if (page === 'home' && effective.admissionsCta && typeof effective.admissionsCta === 'object'
      && '__block' in effective.admissionsCta) {
    const block = (await getEffectiveBlocks())[HOME_ADMISSIONS_CTA_BLOCK_KEY];
    effective.admissionsCta = block && block.isActive !== false
      ? { ...block, isActive: true }
      : null;
  }
  return effective;
}

/**
 * Public/admin read. Never throws for DB downtime: on database
 * failure the pure default content is served so the public
 * page keeps working.
 */
export async function getPageContent(page) {
  try {
    return await getPageContentStrict(page);
  } catch (err) {
    console.error(`Page sections: database unavailable, using default ${page} content:`, err.message);
    return PAGE_FALLBACKS[page]();
  }
}

/**
 * Back-compat export: the original Phase B home-only reader.
 */
export async function getHomePageContent() {
  return getPageContent('home');
}

/**
 * Update one page section from an already-keyed payload. Validates
 * the payload server-side, upserts it, then returns the merged
 * effective content for the whole page.
 *
 * Phase D (home only): 'admissionsCta' no longer accepts inline
 * CTA content — its content lives in the reusable block. Writing
 * it updates the section's reference/visibility.
 */
export async function updatePageSection(page, sectionKey, input) {
  const pageKeys = PAGE_SECTION_KEYS[page];
  if (!pageKeys) {
    throw notFound(`Unknown page "${page}"`);
  }
  if (!pageKeys.includes(sectionKey)) {
    throw notFound(`Unknown ${page} section "${sectionKey}"`);
  }

  if (page === 'home' && sectionKey === 'admissionsCta') {
    const wantsObject = typeof input === 'object' && input !== null && !Array.isArray(input);
    const isActive = wantsObject && typeof input.isActive === 'boolean' ? input.isActive : true;
    const existing = await findPageSection('home', 'admissionsCta');
    await upsertSection(
      'home',
      'admissionsCta',
      { __block: HOME_ADMISSIONS_CTA_BLOCK_KEY },
      isActive,
      existing?.sort_order ?? SECTION_SORT_ORDER.home.admissionsCta ?? 0,
    );
    return getPageContentStrict('home');
  }

  const clean = validatePageSection(page, sectionKey, input);

  const existing = await findPageSection(page, sectionKey);
  await upsertSection(
    page,
    sectionKey,
    clean,
    clean.isActive,
    existing?.sort_order ?? SECTION_SORT_ORDER[page]?.[sectionKey] ?? 0,
  );

  // Return the effective view so admin UI shows merged truth.
  return getPageContentStrict(page);
}

/**
 * Back-compat export: the original Phase B home-only writer.
 */
export async function updateHomeSection(sectionKey, input) {
  return updatePageSection('home', sectionKey, input);
}
