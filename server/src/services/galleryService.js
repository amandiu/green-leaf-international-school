// ------------------------------------------------------------
// Gallery service (Phase B.2)
//
// Business rules for the public gallery and the admin management.
// HTTP concerns live in the controllers; SQL lives in the model.
//
// Public path (GET /api/gallery): PUBLISHED items only, display
// order, optional category filter. Unpublished items are NEVER
// served — no drafts, no archived rows, no admin metadata.
//
// Image pipeline: uploads happen through the EXISTING centralized
// endpoint (POST /api/admin/uploads/image → utils/imageUpload.js +
// imageSanitizer.js). This service stores/validates the safe path
// the pipeline returns — it never touches raw image bytes itself.
//
// Orphan-safe image cleanup (news pattern): when a row is deleted
// or its image replaced, the managed file is unlinked ONLY after
// confirming no OTHER gallery row still references it. Legacy
// site assets (/Activity/…) resolve to null → never touched.
// Deletion failures never fail the request — the row change is
// what matters.
// ------------------------------------------------------------

import {
  findPublished, findPublishedCategories, findAllAdmin, findById,
  countImage, insert, update, updateStatus, remove,
} from '../models/GalleryItem.js';
import {
  validateGalleryPayload,
  validateGalleryStatusPayload,
  validateGalleryStatus,
  validateGalleryCategory,
} from '../validators/galleryValidation.js';
import { notFound } from '../utils/errors.js';
import { deleteGenericImage } from '../utils/imageUpload.js';
import pool from '../config/db.js';

/**
 * Orphan-safe cleanup: delete a managed image file only when no
 * other gallery row AND no news row still reference it (both
 * tables draw from the same managed images directory). Legacy
 * paths (/Activity/…) resolve to null in the managed-path resolver
 * and are never touched. Failures are logged, never thrown — the
 * DB change is the source of truth.
 */
async function cleanupGalleryImageIfUnused(oldImage, replacementImage) {
  if (!oldImage || oldImage === replacementImage) return;
  if (!String(oldImage).startsWith('/api/uploads/images/')) return;
  try {
    const [galleryRows] = await pool
      .query('SELECT `id` FROM `gallery_items` WHERE `image` = ? LIMIT 1', [oldImage]);
    if (galleryRows.length > 0) return; // still referenced by another gallery row
    const [newsRows] = await pool
      .query('SELECT `id` FROM `news_items` WHERE `image` = ? LIMIT 1', [oldImage]);
    if (newsRows.length > 0) return; // still referenced by a news item
    await deleteGenericImage(oldImage);
  } catch (err) {
    console.error('Gallery image cleanup failed:', err?.message || err);
  }
}

/**
 * Public list of PUBLISHED items in display order, with an
 * optional validated category filter. Rows are projected to the
 * safe public shape — admin-only metadata (status, sort_order,
 * timestamps) never leaves the server.
 */
export async function getPublicGallery({ category, limit, offset } = {}) {
  if (category) validateGalleryCategory(category);
  const items = await findPublished({ category, limit, offset });
  return items.map(({ status, sort_order, created_at, updated_at, ...publicItem }) => publicItem);
}

/** Distinct categories that currently have PUBLISHED items. */
export async function getPublicGalleryCategories() {
  return findPublishedCategories();
}

/** Admin list (all statuses), optional validated filters. */
export async function getAdminGallery({ status, category } = {}) {
  if (status) validateGalleryStatus(status);
  if (category) validateGalleryCategory(category);
  return findAllAdmin({ status, category });
}

/** Admin detail by id. */
export async function getAdminGalleryItem(id) {
  const item = await findById(id);
  if (!item) throw notFound(`Gallery item ${id} not found`);
  return item;
}

/**
 * Create a gallery item. Defaults to DRAFT — publishing goes
 * through the status endpoint (never client-supplied on create).
 */
export async function createGalleryItem(input) {
  const clean = validateGalleryPayload(input);
  const id = await insert({
    ...clean,
    caption: clean.caption ?? null,
    sort_order: clean.sort_order ?? 0,
    status: 'DRAFT',
  });
  return getAdminGalleryItem(id);
}

/**
 * Update editable metadata. Image replacement triggers the
 * orphan-safe cleanup of the previous managed file.
 */
export async function updateGalleryItem(id, input) {
  const existing = await findById(id);
  if (!existing) throw notFound(`Gallery item ${id} not found`);

  const clean = validateGalleryPayload(input, { partial: true });
  const nextImage = clean.image !== undefined ? clean.image : existing.image;

  await update(id, {
    title: clean.title ?? existing.title,
    caption: clean.caption !== undefined ? clean.caption : existing.caption,
    image: nextImage,
    category: clean.category ?? existing.category,
    sort_order: clean.sort_order !== undefined ? clean.sort_order : existing.sort_order,
  });

  await cleanupGalleryImageIfUnused(existing.image, nextImage);
  return getAdminGalleryItem(id);
}

/**
 * Publication transition (DRAFT ↔ PUBLISHED, ARCHIVED keeps data).
 */
export async function setGalleryItemStatus(id, input) {
  const existing = await findById(id);
  if (!existing) throw notFound(`Gallery item ${id} not found`);

  const { status } = validateGalleryStatusPayload(input);
  await updateStatus(id, status);
  return getAdminGalleryItem(id);
}

/**
 * Delete a gallery item, then orphan-safe cleanup of its image.
 * Hard delete is safe: no other table references gallery rows.
 */
export async function deleteGalleryItem(id) {
  const existing = await findById(id);
  if (!existing) throw notFound(`Gallery item ${id} not found`);
  await remove(id);
  await cleanupGalleryImageIfUnused(existing.image, null);
  return { deleted: existing.id };
}
