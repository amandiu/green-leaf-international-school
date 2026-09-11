// ------------------------------------------------------------
// Navigation service
//
// Orchestration over the NavigationItem model. HTTP concerns live
// in the controller; SQL lives in the model.
// ------------------------------------------------------------

import {
  findAllOrdered,
  findActiveOrdered,
  findById,
  findChildren,
  buildTree,
  createItem,
  updateItem,
  deleteItem,
  slugExists,
  countChildren,
  NAVIGATION_TYPES,
} from '../models/NavigationItem.js';
import { validateNavigationInput } from '../validators/navigationValidation.js';
import { badRequest, notFound, conflict } from '../utils/errors.js';

export { NAVIGATION_TYPES };

/**
 * Public navigation tree (Phase 3.2 contract):
 * - only ACTIVE rows are queried
 * - an inactive (or missing) parent hides its entire subtree —
 *   active children of an inactive parent are NOT exposed as
 *   orphaned top-level items
 * - ordered by sort_order at every level
 * Returns plain JS objects with boolean flags.
 */
export async function getPublicNavigation() {
  return buildTree(await findActiveOrdered(), {
    onlyActive: true,
    dropOrphans: true,
  });
}

/** Full tree including inactive items (admin-facing view). */
export async function getNavigationTree() {
  return buildTree(await findAllOrdered());
}

/** Active-only tree — exactly what the public Navbar will consume. */
export async function getActiveNavigationTree() {
  return buildTree(await findActiveOrdered());
}

/** Single item by id (null when missing). */
export async function getNavigationItem(id) {
  return findById(id);
}

/** Children of a given item id; null parent = main menu rows. */
export async function getNavigationChildren(parentId = null) {
  return findChildren(parentId);
}

// ------------------------------------------------------------
// Admin management operations (Phase 3.3)
//
// Hierarchy rules enforced here (NOT in the controller):
//   - max depth = 2 (main menu → submenu; no sub-submenus)
//   - a parent must be a top-level DROPDOWN item
//   - no self-parent, no circular parent chains
//   - a parent with children cannot become INTERNAL/EXTERNAL
//   - deleting a parent with children is rejected
// ------------------------------------------------------------

/** Complete tree (active AND inactive) for the admin UI. */
export async function getAdminNavigation() {
  return buildTree(await findAllOrdered());
}

/**
 * Validate the requested parent for create/update:
 * - must exist
 * - must be top-level (parent_id IS NULL) — max depth 2
 * - must be a DROPDOWN type
 * Returns the parent row.
 */
async function requireValidParent(parentId) {
  const parent = await findById(parentId);
  if (!parent) {
    throw badRequest(`parent_id ${parentId} does not exist`);
  }
  if (parent.parent_id !== null) {
    throw badRequest('Submenus cannot contain further submenus (max depth is 2 levels)');
  }
  if (parent.type !== NAVIGATION_TYPES.DROPDOWN) {
    throw badRequest(
      `Parent "${parent.title}" is not a dropdown menu; only DROPDOWN items can contain submenus`,
    );
  }
  return parent;
}

/** Enforce slug uniqueness (null slug = dropdown without slug). */
async function requireUniqueSlug(slug, excludeId = null) {
  if (slug === null || slug === undefined) return;
  if (await slugExists(slug, excludeId)) {
    throw conflict(`The slug "${slug}" is already used by another menu item`);
  }
}

/** Create a main menu or submenu item from a validated payload. */
export async function createNavigationItem(input) {
  const clean = validateNavigationInput(input);

  if (clean.parent_id !== null && clean.parent_id !== undefined) {
    await requireValidParent(clean.parent_id);
  }
  await requireUniqueSlug(clean.slug);

  return createItem(clean);
}

/** Update an existing item; validates hierarchy/cycles before saving. */
export async function updateNavigationItem(id, input) {
  const current = await findById(id);
  if (!current) throw notFound('Navigation item not found');

  const clean = validateNavigationInput(
    { ...input, _currentType: input.type === undefined ? current.type : undefined },
    { partial: true },
  );

  // ---- parent / hierarchy validation ----
  if (clean.parent_id !== undefined) {
    if (clean.parent_id === id) {
      throw badRequest('An item cannot be its own parent');
    }
    if (clean.parent_id !== null) {
      const parent = await requireValidParent(clean.parent_id);
      // Cycle guard: walk the new parent's ancestor chain.
      let cursor = parent;
      while (cursor) {
        if (cursor.id === id) {
          throw badRequest('This change would create a circular menu hierarchy');
        }
        cursor = cursor.parent_id === null ? null : await findById(cursor.parent_id);
      }
    }
    // Moving an item that has children under a parent would make
    // its children level-2 submenus of a submenu — depth 3.
    if (clean.parent_id !== null && (await countChildren(id)) > 0) {
      throw badRequest(
        'This menu has submenu items; reassign or delete them before nesting it under another menu',
      );
    }
  }

  // ---- type change conflicts ----
  if (clean.type !== undefined && clean.type !== current.type) {
    const childCount = await countChildren(id);
    if (childCount > 0 && clean.type !== NAVIGATION_TYPES.DROPDOWN) {
      throw conflict(
        `This menu has ${childCount} submenu item(s). ` +
        'Reassign or delete them before changing its type away from DROPDOWN.',
      );
    }
  }

  await requireUniqueSlug(clean.slug, id);

  const updated = await updateItem(id, clean);
  if (!updated) throw notFound('Navigation item not found');
  return updated;
}

/** Delete an item; parents with children are rejected, never cascaded. */
export async function deleteNavigationItem(id) {
  const current = await findById(id);
  if (!current) throw notFound('Navigation item not found');

  const childCount = await countChildren(id);
  if (childCount > 0) {
    throw conflict(
      `Cannot delete this menu because it has ${childCount} submenu item(s). ` +
      'Delete or reassign them first.',
    );
  }

  return deleteItem(id);
}
