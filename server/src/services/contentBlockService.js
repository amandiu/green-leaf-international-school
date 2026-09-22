// ------------------------------------------------------------
// Content blocks service (Phase D)
//
// THE single runtime merge point for reusable content blocks:
//
//   MySQL content_blocks (DB values win)
//   + shared/content/contentBlocks.js (fallback for missing rows)
//   → effective blocks object keyed by block_key
//
// Mirrors the Phase A/B service patterns:
//   - getPublicContentBlocks() NEVER throws on DB downtime — the
//     pure fallback content is served so public pages keep
//     rendering (graceful degradation).
//   - Writes validate against the per-type schema before any
//     write; responses return the merged effective view.
//
// REFERENCE ARCHITECTURE:
//   • Blocks are referenced by their stable block_key.
//   • The home 'admissionsCta' section stores a REFERENCE
//     ({ __block: 'admissions-primary-cta' }) in page_sections —
//     never a copy of the block content.
//   • Usage ("Used in") is DERIVED from those references at read
//     time — never stored manually.
//   • Deleting a referenced block is blocked with a useful error
//     (the admin must remove the references first).
// ------------------------------------------------------------

import {
  findAll, findByKey, insert, update, remove,
} from '../models/ContentBlock.js';
import {
  findByPage, findPageSection, upsertSection,
} from '../models/PageSection.js';
import {
  validateBlockPayload, validateBlockKey,
} from '../validators/contentBlockValidation.js';
import { notFound, badRequest, conflict } from '../utils/errors.js';
import {
  CONTENT_BLOCK_KEYS,
  defaultContentBlocks,
} from '../../../shared/content/contentBlocks.js';

export { CONTENT_BLOCK_KEYS };

/** Known home-section references: section key → block key. */
const HOME_SECTION_BLOCK_REFS = Object.freeze({
  admissionsCta: 'admissions-primary-cta',
});

/** Human labels for usage lists. */
const HOME_LABEL = 'Homepage';

/** Pure fallback content (fresh copy each call — never shared refs). */
function fallbackBlocks() {
  return defaultContentBlocks();
}

/** Merge one DB row over its fallback content (shallow merge). */
function mergeBlock(fallback, dbContent, isActive) {
  if (typeof dbContent !== 'object' || dbContent === null) return fallback;
  const merged = { ...fallback, ...dbContent };
  return { ...merged, isActive };
}

/**
 * Effective blocks: fallback overlaid with DB rows. Unknown DB
 * keys are ignored (allow-list). DB down → whole fallback object.
 */
async function getEffectiveBlocksStrict() {
  const effective = fallbackBlocks();
  const rows = await findAll();
  for (const row of rows) {
    if (!CONTENT_BLOCK_KEYS.includes(row.block_key)) continue;
    if (!(row.block_key in effective)) continue;
    effective[row.block_key] = mergeBlock(
      effective[row.block_key],
      row.content,
      row.is_active === 1,
    );
  }
  return effective;
}

/**
 * Public/admin read: all effective blocks keyed by block_key.
 * Never throws for DB downtime — defaults are served instead.
 */
export async function getEffectiveBlocks() {
  try {
    return await getEffectiveBlocksStrict();
  } catch (err) {
    console.error('Content blocks: database unavailable, using defaults:', err.message);
    return fallbackBlocks();
  }
}

/**
 * Usage map: block_key → [{ page, sectionKey, label }] derived
 * from the actual page_sections references (source of truth).
 * Also returns rows needing migration (legacy copied content).
 */
async function getUsageStrict() {
  const usage = {};
  for (const key of CONTENT_BLOCK_KEYS) usage[key] = [];

  const rows = await findByPage('home');
  for (const row of rows) {
    const blockKey = HOME_SECTION_BLOCK_REFS[row.section_key];
    if (!blockKey) continue;
    const isReference = typeof row.content === 'object' && row.content !== null && '__block' in row.content;
    usage[blockKey]?.push({
      page: 'home',
      sectionKey: row.section_key,
      label: HOME_LABEL,
      reference: isReference,
    });
  }
  return usage;
}

/**
 * Detect a legacy home.admissionsCta row that still holds the old
 * copied CTA JSON (not a reference). Returns true if migration
 * is needed. The legacy copy was identical to the retired default
 * (verified during the Phase D audit), so it is safely replaceable
 * by the reference; is_active is preserved.
 */
async function legacyHomeCtaNeedsMigration() {
  try {
    const row = await findPageSection('home', 'admissionsCta');
    if (!row) return false;
    const c = row.content;
    const isReference = typeof c === 'object' && c !== null && '__block' in c;
    if (isReference) return false;
    // Any non-reference row is legacy copied content → migrate.
    return true;
  } catch {
    return false; // DB down → leave everything as-is (fallbacks serve)
  }
}

/**
 * Migrate the legacy copied admissionsCta section to the
 * reference shape. Preserves is_active. Runs lazily on first
 * admin read — never on the public path.
 */
async function migrateLegacyHomeCta() {
  const row = await findPageSection('home', 'admissionsCta');
  const isActive = row ? row.is_active === 1 : true;
  await upsertSection('home', 'admissionsCta', { __block: 'admissions-primary-cta' }, isActive, 50);
}

/**
 * Admin read: effective blocks (with admin metadata: name, type,
 * updatedAt) + derived usage. Performs the one-time legacy
 * reference migration so the Content Center always shows
 * truthful reference state. On DB downtime the shared defaults
 * are listed (no updatedAt) so the editor still works offline.
 */
export async function getAdminBlocks() {
  let usage;
  try {
    if (await legacyHomeCtaNeedsMigration()) {
      await migrateLegacyHomeCta();
    }
    usage = await getUsageStrict();
  } catch (err) {
    console.error('Content blocks: usage unavailable:', err.message);
    usage = Object.fromEntries(CONTENT_BLOCK_KEYS.map((k) => [k, []]));
  }

  let rows = [];
  try {
    rows = await findAll();
  } catch (err) {
    console.error('Content blocks: database unavailable, listing defaults:', err.message);
  }
  const rowsByKey = new Map(rows.map((r) => [r.block_key, r]));

  const blocks = {};
  for (const key of CONTENT_BLOCK_KEYS) {
    const fallback = fallbackBlocks()[key];
    const row = rowsByKey.get(key);
    const content = row && typeof row.content === 'object' && row.content !== null
      ? { ...fallback, ...row.content }
      : fallback;
    blocks[key] = {
      name: row?.name ?? (key === 'admissions-primary-cta' ? 'Admissions Primary CTA' : key),
      blockType: row?.block_type ?? 'CTA',
      content,
      isActive: row ? row.is_active === 1 : true,
      updatedAt: row?.updated_at ?? null,
    };
  }
  return { blocks, usage };
}

/**
 * Update the CTA content of a block (creates the DB row on first
 * save). Validates the payload server-side; returns the merged
 * effective blocks for the whole surface.
 */
export async function updateBlock(blockKey, input) {
  if (!CONTENT_BLOCK_KEYS.includes(blockKey)) {
    throw notFound(`Unknown content block "${blockKey}"`);
  }
  const clean = validateBlockPayload(input);

  const existing = await findByKey(blockKey);
  if (existing) {
    await update(blockKey, clean.name, clean.content, existing.is_active === 1);
  } else {
    await insert(blockKey, clean.name, clean.content, true);
  }
  return getEffectiveBlocksStrict();
}

/**
 * Set a block's active flag without touching content.
 */
export async function setBlockActive(blockKey, isActive) {
  if (!CONTENT_BLOCK_KEYS.includes(blockKey)) {
    throw notFound(`Unknown content block "${blockKey}"`);
  }
  if (typeof isActive !== 'boolean') {
    throw badRequest('isActive must be a boolean');
  }

  const existing = await findByKey(blockKey);
  if (existing) {
    await update(blockKey, existing.name, existing.content, isActive);
  } else {
    // No DB row yet: materialize defaults with the requested flag.
    const defaults = fallbackBlocks()[blockKey];
    await insert(
      blockKey,
      blockKey === 'admissions-primary-cta' ? 'Admissions Primary CTA' : blockKey,
      defaults,
      isActive,
    );
  }
  return getEffectiveBlocksStrict();
}

/**
 * Delete a block. BLOCKED while the block is referenced by any
 * page section — the admin must remove the references first.
 * Deleting the canonical seeded block is also refused (it would
 * be re-seeded and is the shared source for its consumers).
 */
export async function deleteBlock(blockKey) {
  if (!CONTENT_BLOCK_KEYS.includes(blockKey)) {
    throw notFound(`Unknown content block "${blockKey}"`);
  }

  const usage = await getUsageStrict();
  const refs = usage[blockKey] ?? [];
  if (refs.length > 0) {
    const labels = refs.map((r) => r.label).join(', ');
    throw conflict(
      `This content block is currently used by: ${labels}. Remove the references first.`,
    );
  }

  // Canonical block has built-in consumers; deletion is refused.
  throw conflict(
    'This content block cannot be deleted because it has built-in consumers. Deactivate it instead.',
  );
}
