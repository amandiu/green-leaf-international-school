// ------------------------------------------------------------
// Leadership message + section service
//
// Orchestration over the LeadershipSection / LeadershipMessage
// models. HTTP concerns live in the controllers; SQL lives in
// the models. Business rules enforced here (NOT in the controller):
//   - role is unique within a section (public cells are keyed by role)
//   - record must exist for update/delete/status/reorder
//   - image files are unlinked only when no other record
//     references them (shared-file safety)
//   - section copy validated before save
// ------------------------------------------------------------

import {
  findAllOrdered,
  findActiveOrdered,
  findById,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
} from '../models/LeadershipMessage.js';
import {
  findFirstSection,
  findFirstPublicSection,
  createIfMissing as createSectionIfMissing,
  updateFirstSection,
} from '../models/LeadershipSection.js';
import {
  validateLeadershipInput,
  validateSectionInput,
  validateReorderInput,
} from '../validators/leadershipValidation.js';
import { badRequest, notFound, conflict } from '../utils/errors.js';
import { deleteUploadedImage } from '../utils/imageUpload.js';

// ------------------------------------------------------------
// Section
// ------------------------------------------------------------

/**
 * The single section this phase operates on — created on first
 * use so a fresh database works without manual seeding.
 */
async function requireSection() {
  let section = await findFirstSection();
  if (!section) {
    section = await createSectionIfMissing({
      eyebrow: 'Leadership Message',
      title: 'Messages from Our Leadership',
      description:
        'Words of guidance and inspiration from the leaders of Green Leaf International School & College.',
    });
  }
  return section;
}

/** Admin view of the section settings. */
export async function getLeadershipSection() {
  return requireSection();
}

/** Update the section copy/active flag from a validated payload. */
export async function updateLeadershipSection(input) {
  await requireSection();
  const clean = validateSectionInput(input);
  const updated = await updateFirstSection(clean);
  if (!updated) throw notFound('Leadership section not found');
  return updated;
}

// ------------------------------------------------------------
// Messages
// ------------------------------------------------------------

/** Public homepage data: active records of the section in display order. */
export async function getPublicLeadershipMessages() {
  const section = await requireSection();
  return findActiveOrdered(section.id);
}

/** Complete list (active AND inactive) for the admin UI. */
export async function getAdminLeadershipMessages() {
  const section = await requireSection();
  return findAllOrdered(section.id);
}

/** Single record by id (admin edit form fetch). */
export async function getLeadershipMessage(id) {
  const message = await findById(id);
  if (!message) throw notFound('Leadership message not found');
  return message;
}

/** Create a leadership record from a validated payload. */
export async function createLeadershipMessage(input) {
  const section = await requireSection();
  const clean = validateLeadershipInput(input);
  await requireUniqueRole(clean.role, section.id, null);
  return createItem({ ...clean, section_id: section.id });
}

/** Update an existing record; validates fields before saving. */
export async function updateLeadershipMessage(id, input) {
  const current = await findById(id);
  if (!current) throw notFound('Leadership message not found');

  const clean = validateLeadershipInput(input, { partial: true });

  if (clean.role !== undefined && clean.role !== current.role) {
    await requireUniqueRole(clean.role, current.section_id, id);
  }

  const updated = await updateItem(id, clean);
  if (!updated) throw notFound('Leadership message not found');

  // ---- safe image cleanup on replace/clear ----
  // Unlink the previous file only when it changed AND no other
  // record still references it.
  if (
    clean.image_url !== undefined
    && clean.image_url !== current.image_url
    && current.image_url
  ) {
    await cleanupImageIfUnused(current.image_url, updated.image_url);
  }

  return updated;
}

/**
 * Activate/deactivate without touching other fields
 * (PATCH /:id/status).
 */
export async function setLeadershipMessageStatus(id, input) {
  const current = await findById(id);
  if (!current) throw notFound('Leadership message not found');

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Request body must be a JSON object');
  }
  if (typeof input.is_active !== 'boolean') {
    throw badRequest('is_active must be a boolean');
  }

  return updateItem(id, { is_active: input.is_active });
}

/**
 * Reassign display positions atomically (PATCH /reorder).
 * Body: { order: [ { id, sort_order }, ... ] }
 */
export async function reorderLeadershipMessages(input) {
  const section = await requireSection();
  const orders = validateReorderInput(input);

  // Every id must belong to this section — reordering must never
  // silently move (or fail half-way on) a foreign record.
  const existing = await findAllOrdered(section.id);
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const entry of orders) {
    if (!byId.has(entry.id)) {
      throw badRequest(`Leadership message ${entry.id} does not exist in this section`);
    }
  }

  await reorderItems(orders);

  // Return the fresh admin list so the UI can re-render sorted.
  return findAllOrdered(section.id);
}

/** Delete a record; cleans up its image when nothing else uses it. */
export async function deleteLeadershipMessage(id) {
  const current = await findById(id);
  if (!current) throw notFound('Leadership message not found');

  const deleted = await deleteItem(id);
  if (current.image_url) {
    await cleanupImageIfUnused(current.image_url, null);
  }
  return deleted;
}

/** Combined public payload for GET /api/leadership. */
export async function getPublicLeadership() {
  const section = await requireSection();

  // Inactive section → expose nothing (the homepage hides the
  // whole block instead of rendering a broken empty layout).
  if (!section.is_active) {
    return { section: null, messages: [] };
  }

  const messages = await findActiveOrdered(section.id);
  return {
    section: {
      eyebrow: section.eyebrow,
      title: section.title,
      description: section.description,
    },
    messages,
  };
}

/** Enforce unique role within a section (excluding one id on updates). */
async function requireUniqueRole(role, sectionId, excludeId) {
  const rows = await findAllOrdered(sectionId);
  const taken = rows.some(
    (r) => r.role.toLowerCase() === role.toLowerCase() && r.id !== excludeId,
  );
  if (taken) {
    throw conflict(`A leadership record for the role "${role}" already exists`);
  }
}

/**
 * Delete an image file from disk only when no OTHER leadership
 * record references it. Never deletes the replacement image,
 * never throws on filesystem failure (DB truth already saved).
 */
async function cleanupImageIfUnused(oldImageUrl, replacementImageUrl) {
  if (oldImageUrl === replacementImageUrl) return;
  try {
    // Shared-file safety: skip deletion when another record
    // still points at the same image file.
    const rows = await findAllOrdered((await requireSection()).id);
    const stillReferenced = rows.some((r) => r.image_url === oldImageUrl);
    if (stillReferenced) return;
    await deleteUploadedImage(oldImageUrl);
  } catch (err) {
    console.error('Leadership image cleanup skipped:', err.message);
  }
}
