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
  NAVIGATION_TYPES,
} from '../models/NavigationItem.js';

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
