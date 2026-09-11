// ------------------------------------------------------------
// Navigation service (Phase 3.1 — foundation only)
//
// Thin orchestration over the NavigationItem model. No HTTP
// routes are wired in this phase; the navigation API and the
// admin management UI arrive in later phases.
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
