// ------------------------------------------------------------
// Page sections service (Phase B)
//
// THE single runtime merge point for page content:
//
//   MySQL page_sections            (DB values win)
//   + shared/content/homeContent.js (fallback per section)
//   → effective page content object
//
// Mirrors the Phase A siteSettingsService pattern:
//   - getHomePageContent() NEVER throws on DB downtime — the
//     pure fallback content is served so the public Homepage
//     keeps rendering (graceful degradation).
//   - updateHomeSection() validates against the per-section
//     schema before any write; the service returns the merged
//     effective content so admin UIs show server truth.
// ------------------------------------------------------------

import { findByPage, findPageSection, upsertSection } from '../models/PageSection.js';
import { validateHomeSection } from '../validators/pageSectionValidation.js';
import { notFound } from '../utils/errors.js';
import {
  HOME_SECTION_KEYS,
  HOME_ADMISSIONS_CTA_BLOCK_KEY,
  defaultHomeContent,
} from '../../../shared/content/homeContent.js';
import { getEffectiveBlocks } from './contentBlockService.js';
import { defaultContentBlocks } from '../../../shared/content/contentBlocks.js';

export { HOME_SECTION_KEYS };

/** Section sort_order mirrors the seed; used on first write only. */
const SECTION_SORT_ORDER = Object.freeze({
  hero: 10,
  newsPreview: 20,
  lifeAtSchool: 30,
  videoShowcase: 40,
  admissionsCta: 50,
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

/** Pure fallback content (fresh copy each call — never shared references). */
function fallbackHomeContent() {
  return defaultHomeContent();
}

/** Merge one DB row over the fallback section (shallow — schema shapes are flat). */
function mergeSection(fallback, dbContent, isActive) {
  if (typeof dbContent !== 'object' || dbContent === null) return fallback;
  const merged = { ...fallback, ...dbContent };
  merged.isActive = isActive;
  return merged;
}

/**
 * Effective home content: fallback overlaid with DB sections.
 * Missing section → that section only falls back (per-section
 * fallback requirement). DB down → whole fallback object.
 *
 * Phase D: a section whose content is a REFERENCE
 * ({ __block: '<key>' }) resolves against the effective reusable
 * content blocks — the referenced block is the single source of
 * truth; nothing is copied into page_sections. An inactive or
 * missing referenced block resolves to null (the consumer hides
 * that section — never crashes).
 */
async function getHomePageContentStrict() {
  const effective = fallbackHomeContent();
  const rows = await findByPage('home');
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
      row.section_key === 'newsPreview'
        ? stripLegacyNewsItems(content)
        : content,
      row.is_active === 1,
    );
  }
  // A missing admissionsCta row falls back to the block default.
  if (effective.admissionsCta && typeof effective.admissionsCta === 'object'
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
 * Homepage keeps working.
 */
export async function getHomePageContent() {
  try {
    return await getHomePageContentStrict();
  } catch (err) {
    console.error('Page sections: database unavailable, using default home content:', err.message);
    return fallbackHomeContent();
  }
}

/**
 * Update one home section from an already-keyed payload. Validates
 * the payload server-side, upserts it, then returns the merged
 * effective content for the whole page.
 *
 * Phase D: 'admissionsCta' no longer accepts inline CTA content —
 * its content lives in the reusable block. Writing it updates the
 * section's reference/visibility (and migrates legacy copies).
 */
export async function updateHomeSection(sectionKey, input) {
  if (!HOME_SECTION_KEYS.includes(sectionKey)) {
    throw notFound(`Unknown home section "${sectionKey}"`);
  }

  if (sectionKey === 'admissionsCta') {
    const wantsObject = typeof input === 'object' && input !== null && !Array.isArray(input);
    const isActive = wantsObject && typeof input.isActive === 'boolean' ? input.isActive : true;
    const existing = await findPageSection('home', 'admissionsCta');
    await upsertSection(
      'home',
      'admissionsCta',
      { __block: HOME_ADMISSIONS_CTA_BLOCK_KEY },
      isActive,
      existing?.sort_order ?? SECTION_SORT_ORDER.admissionsCta ?? 0,
    );
    return getHomePageContentStrict();
  }

  const clean = validateHomeSection(sectionKey, input);

  const existing = await findPageSection('home', sectionKey);
  await upsertSection(
    'home',
    sectionKey,
    clean,
    clean.isActive,
    existing?.sort_order ?? SECTION_SORT_ORDER[sectionKey] ?? 0,
  );

  // Return the effective view so admin UI shows merged truth.
  return getHomePageContentStrict();
}
