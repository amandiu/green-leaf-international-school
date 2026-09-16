// ------------------------------------------------------------
// Leadership message service
//
// Orchestration over the LeadershipMessage model. HTTP concerns
// live in the controllers; SQL lives in the model. Business
// rules enforced here (NOT in the controller):
//   - role is unique (public cells are keyed by role)
//   - record must exist for update/delete
//   - image files are unlinked only when no other record
//     references them (shared-file safety)
// ------------------------------------------------------------

import {
  findAllOrdered,
  findActiveOrdered,
  findById,
  createItem,
  updateItem,
  deleteItem,
} from '../models/LeadershipMessage.js';
import { validateLeadershipInput } from '../validators/leadershipValidation.js';
import { badRequest, notFound, conflict } from '../utils/errors.js';
import { deleteUploadedImage } from '../utils/imageUpload.js';

/** Public homepage data: active records in display order. */
export async function getPublicLeadershipMessages() {
  return findActiveOrdered();
}

/** Complete list (active AND inactive) for the admin UI. */
export async function getAdminLeadershipMessages() {
  return findAllOrdered();
}

/** Single record by id (admin edit form fetch). */
export async function getLeadershipMessage(id) {
  return findById(id);
}

/** Create a leadership record from a validated payload. */
export async function createLeadershipMessage(input) {
  const clean = validateLeadershipInput(input);
  await requireUniqueRole(clean.role, null);
  return createItem(clean);
}

/** Update an existing record; validates fields before saving. */
export async function updateLeadershipMessage(id, input) {
  const current = await findById(id);
  if (!current) throw notFound('Leadership message not found');

  const clean = validateLeadershipInput(input, { partial: true });

  if (clean.role !== undefined && clean.role !== current.role) {
    await requireUniqueRole(clean.role, id);
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

/** Enforce unique role (excluding one id on updates). */
async function requireUniqueRole(role, excludeId) {
  const rows = await findAllOrdered();
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
    const rows = await findAllOrdered();
    const stillReferenced = rows.some((r) => r.image_url === oldImageUrl);
    if (stillReferenced) return;
    await deleteUploadedImage(oldImageUrl);
  } catch (err) {
    console.error('Leadership image cleanup skipped:', err.message);
  }
}
