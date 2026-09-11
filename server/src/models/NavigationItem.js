// ------------------------------------------------------------
// NavigationItem model (Phase 3.1 — data access foundation)
//
// Read-only data access for the navigation_items table.
// The public Navbar API and admin write operations belong to
// later phases; this file only establishes the query layer and
// the two-level tree shape the dynamic Navbar will consume.
// ------------------------------------------------------------

import pool from '../config/db.js';

/** Supported navigation types (mirrors the DB enum). */
export const NAVIGATION_TYPES = Object.freeze({
  INTERNAL: 'INTERNAL',
  EXTERNAL: 'EXTERNAL',
  DROPDOWN: 'DROPDOWN',
});

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = [
  'id', 'parent_id', 'title', 'slug', 'url', 'type', 'sort_order',
  'is_active', 'open_new_tab', 'icon', 'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

/** Convert DB TINYINT(1) flags to real booleans for JS consumers. */
function toJs(row) {
  if (!row) return null;
  return {
    ...row,
    is_active: row.is_active === 1,
    open_new_tab: row.open_new_tab === 1,
  };
}

/** Main menu + submenu rows, deterministically ordered. */
export async function findAllOrdered() {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`navigation_items\` ORDER BY \`sort_order\` ASC, \`id\` ASC`,
  );
  return rows.map(toJs);
}

/** Only active rows, ordered — the query the future Navbar API uses. */
export async function findActiveOrdered() {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`navigation_items\`
     WHERE \`is_active\` = 1
     ORDER BY \`sort_order\` ASC, \`id\` ASC`,
  );
  return rows.map(toJs);
}

/** Single row by id, or null. */
export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`navigation_items\` WHERE \`id\` = ? LIMIT 1`,
    [id],
  );
  return toJs(rows[0]);
}

/** Immediate children of a parent (null → main menu), ordered. */
export async function findChildren(parentId) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`navigation_items\`
     WHERE \`parent_id\` ${parentId === null ? 'IS NULL' : '= ?'}
     ORDER BY \`sort_order\` ASC, \`id\` ASC`,
    parentId === null ? [] : [parentId],
  );
  return rows.map(toJs);
}

/**
 * Build the two-level tree the dynamic Navbar will consume:
 *   [{ ...item, children: [...] }, ...]
 * Parent items are flattened when they carry no children so the
 * Navbar can render a plain link instead of a dropdown.
 *
 * Options:
 *   onlyActive   — prune items whose ancestor chain is broken or
 *                  inactive, so an inactive parent hides its whole
 *                  subtree from the public API (children never leak
 *                  out as orphaned top-level items).
 *   dropOrphans  — same hiding for rows whose parent row is missing
 *                  entirely; without it orphans surface as roots
 *                  (the safe admin-view behavior).
 */
export function buildTree(rows, { onlyActive = false, dropOrphans = false } = {}) {
  const items = rows.map((r) => ({ ...r, children: [] }));
  const byId = new Map(items.map((item) => [item.id, item]));

  const roots = [];
  for (const item of items) {
    if (item.parent_id === null || !byId.has(item.parent_id)) {
      if (dropOrphans && item.parent_id !== null) continue; // hidden branch
      roots.push(item); // main menu (orphans surface as roots, never vanish)
    } else {
      byId.get(item.parent_id).children.push(item);
    }
  }

  if (!onlyActive) return roots;

  // Keep only items whose every ancestor exists and is active.
  const isReachable = (item) => {
    let current = item;
    const seen = new Set();
    while (current.parent_id !== null) {
      if (seen.has(current.id)) return false; // cycle guard
      seen.add(current.id);
      const parent = byId.get(current.parent_id);
      if (!parent || parent.is_active !== true) return false;
      current = parent;
    }
    return true;
  };
  const prune = (list) => list
    .filter((item) => isReachable(item))
    .map((item) => Object.assign(item, { children: prune(item.children) }));
  return prune(roots);
}
