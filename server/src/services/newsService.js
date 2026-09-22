// ------------------------------------------------------------
// News service (Phase E)
//
// THE single runtime source for News/Notices. News is a dynamic
// entity — deliberately NOT a reusable content block (Phase D
// blocks are static shared copy; news items are created/removed
// over time). All consumers (Homepage preview, Navbar ticker,
// News page/detail) read the same published rows via the API.
//
// Slug safety (§11): the service generates a URL-safe slug from
// the title, guarantees uniqueness with -2/-3 suffixes, and never
// silently changes an existing item's slug on update (only when
// the admin explicitly edits the slug field).
//
// Dates (§12): rows store UTC (pool runs timezone 'Z'); every
// served item also carries a preformatted `dateLabel` fixed to
// Asia/Dhaka so all consumers show identical, predictable dates
// regardless of the viewer's device timezone.
// ------------------------------------------------------------

import {
  findPublished, findPublishedBySlug, findAllAdmin, findById,
  countSlug, insert, update, updateStatus, remove,
} from '../models/NewsItem.js';
import {
  validateNewsPayload, validateStatusPayload,
  validateType, validateStatus,
} from '../validators/newsValidation.js';
import { notFound } from '../utils/errors.js';

/** Fallback for the homepage preview heading (never throws). */
const DEFAULT_NEWS_PREVIEW = Object.freeze({
  eyebrow: 'Recent Updates',
  title: 'Recent News & Notices',
  description:
    'Stay updated with the latest news, notices, events, and announcements from {{identity.shortName}}.',
});

/**
 * URL-safe slug from a title (also used to sanitize admin-typed
 * slugs). Collisions are resolved by `uniqueSlug`, never here.
 */
export function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
    .replace(/-+$/g, '');
}

/**
 * Asia/Dhaka-stable label, e.g. "12 Mar 2026". Pinned timezone —
 * every viewer sees the same date for the same item.
 */
export function dhakaDateLabel(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** Attach the Dhaka-stable label to a raw row. */
function withDateLabel(item) {
  return { ...item, dateLabel: dhakaDateLabel(item.published_at) };
}

/**
 * Public list of PUBLISHED items (newest first). `content` is
 * omitted from lists (detail endpoint only). No item rows from
 * any other source are merged — this is the only item source.
 */
export async function getPublicNews({ limit, offset, type } = {}) {
  const items = await findPublished({ limit, offset, type });
  return items.map(({ content, ...item }) => withDateLabel(item));
}

/** Public detail by slug (PUBLISHED only). */
export async function getPublicNewsBySlug(slug) {
  const item = await findPublishedBySlug(slug);
  if (!item) return undefined;
  return withDateLabel(item);
}

/** Admin list (all statuses) with date labels. */
export async function getAdminNews({ status, type } = {}) {
  if (status) validateStatus(status);
  if (type) validateType(type);
  const items = await findAllAdmin({ status, type });
  return items.map(withDateLabel);
}

/** Admin detail by id. */
export async function getAdminNewsById(id) {
  const item = await findById(id);
  if (!item) throw notFound(`News item ${id} not found`);
  return withDateLabel(item);
}

/** Generate a unique slug (numeric suffixes on collision). */
async function uniqueSlug(desired, excludeId = null) {
  let base = slugify(desired || 'news') || 'news';
  let candidate = base;
  let n = 2;
  // Bounded loop — slug space is huge; 200 attempts is paranoia.
  for (let i = 0; i < 200 && (await countSlug(candidate, excludeId)) > 0; i += 1) {
    const suffix = `-${n}`;
    candidate = base.slice(0, 200 - suffix.length) + suffix;
    n += 1;
  }
  return candidate;
}

/**
 * Create a news item. Defaults to DRAFT; publishing goes through
 * the status endpoint so published_at is always server-stamped
 * (never client-supplied).
 */
export async function createNewsItem(input) {
  const clean = validateNewsPayload(input);
  const slug = await uniqueSlug(clean.slug ?? slugify(clean.title));
  const status = clean.status ?? 'DRAFT';
  const published_at = status === 'PUBLISHED' ? new Date() : null;
  const id = await insert({
    title: clean.title,
    slug,
    type: clean.type,
    status,
    excerpt: clean.excerpt ?? null,
    content: clean.content ?? null,
    image: clean.image ?? null,
    published_at,
  });
  return getAdminNewsById(id);
}

/**
 * Update editable fields. The slug only changes when explicitly
 * provided in the payload (never silently regenerated from the
 * title — existing URLs keep working, §11).
 */
export async function updateNewsItem(id, input) {
  const existing = await findById(id);
  if (!existing) throw notFound(`News item ${id} not found`);

  const clean = validateNewsPayload(input, { partial: true });
  let slug = existing.slug;
  if (clean.slug !== undefined && clean.slug !== existing.slug) {
    slug = await uniqueSlug(clean.slug, id);
  }

  await update(id, {
    title: clean.title ?? existing.title,
    slug,
    type: clean.type ?? existing.type,
    excerpt: clean.excerpt !== undefined ? clean.excerpt : existing.excerpt,
    content: clean.content !== undefined ? clean.content : existing.content,
    image: clean.image !== undefined ? clean.image : existing.image,
  });
  return getAdminNewsById(id);
}

/**
 * Status transition. → PUBLISHED stamps published_at (UTC, now)
 * only on first publish; back to DRAFT keeps the original date;
 * ARCHIVED keeps everything (soft state, no data loss — §17).
 */
export async function setNewsStatus(id, input) {
  const existing = await findById(id);
  if (!existing) throw notFound(`News item ${id} not found`);

  const { status } = validateStatusPayload(input);
  let publishedAt = existing.published_at ? new Date(existing.published_at) : null;
  if (status === 'PUBLISHED' && !publishedAt) publishedAt = new Date();
  await updateStatus(id, status, publishedAt);
  return getAdminNewsById(id);
}

/**
 * Delete a news item. No other table references news rows by id
 * (all consumers query the central list), so hard delete cannot
 * create broken references (§17).
 */
export async function deleteNewsItem(id) {
  const existing = await findById(id);
  if (!existing) throw notFound(`News item ${id} not found`);
  await remove(id);
  return { deleted: existing.slug };
}

/**
 * Public homepage news-preview payload: PUBLISHED items + the
 * admin-editable section heading (from `page_sections.newsPreview`
 * when present). Legacy copied `items` arrays inside that section
 * JSON are retired (Phase E): the resolver strips them so the
 * central news source below is the ONLY item source (§5).
 */
export async function getNewsPreviewData({ limit = 3 } = {}) {
  const newsLimit = Number.isInteger(limit) ? Math.max(1, Math.min(12, limit)) : 3;
  const items = await getPublicNews({ limit: newsLimit });
  return { items, heading: DEFAULT_NEWS_PREVIEW };
}
