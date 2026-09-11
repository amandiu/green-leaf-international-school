// ------------------------------------------------------------
// NavigationItem model — data access for navigation_items
//
// Public reads (Phase 3.2) + admin write operations (Phase 3.3).
// All SQL lives here; business rules live in the service.
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

// ------------------------------------------------------------
// Write operations (Phase 3.3 — admin management)
// ------------------------------------------------------------

/** True when the slug is already taken (optionally excluding one id). */
export async function slugExists(slug, excludeId = null) {
  const sql = excludeId
    ? 'SELECT `id` FROM `navigation_items` WHERE `slug` = ? AND `id` <> ? LIMIT 1'
    : 'SELECT `id` FROM `navigation_items` WHERE `slug` = ? LIMIT 1';
  const [rows] = await pool.query(sql, excludeId ? [slug, excludeId] : [slug]);
  return rows.length > 0;
}

/** Number of direct children of an item. */
export async function countChildren(id) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM `navigation_items` WHERE `parent_id` = ?',
    [id],
  );
  return rows[0].n;
}

/** Create one navigation item; returns the full created row. */
export async function createItem({
  parent_id = null, title, slug, url = null, type, sort_order = 0,
  is_active = true, open_new_tab = false, icon = null,
}) {
  const [result] = await pool.query(
    `INSERT INTO \`navigation_items\`
       (\`parent_id\`, \`title\`, \`slug\`, \`url\`, \`type\`,
        \`sort_order\`, \`is_active\`, \`open_new_tab\`, \`icon\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      parent_id, title, slug, url, type, sort_order,
      is_active ? 1 : 0, open_new_tab ? 1 : 0, icon,
    ],
  );
  return findById(result.insertId);
}

/** Update an item by id (only provided fields); returns the updated row. */
export async function updateItem(id, fields) {
  const allowed = [
    'parent_id', 'title', 'slug', 'url', 'type', 'sort_order',
    'is_active', 'open_new_tab', 'icon',
  ];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`\`${key}\` = ?`);
      const raw = fields[key];
      values.push(
        key === 'is_active' || key === 'open_new_tab' ? (raw ? 1 : 0) : raw,
      );
    }
  }
  if (sets.length === 0) return findById(id);
  values.push(id);
  await pool.query(
    `UPDATE \`navigation_items\` SET ${sets.join(', ')} WHERE \`id\` = ?`,
    values,
  );
  return findById(id);
}

/** Delete an item by id. Returns true when a row was removed. */
export async function deleteItem(id) {
  const [result] = await pool.query(
    'DELETE FROM `navigation_items` WHERE `id` = ?',
    [id],
  );
  return result.affectedRows > 0;
}
