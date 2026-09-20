// ------------------------------------------------------------
// LeadershipMessage model — data access for leadership_messages
//
// Public reads + admin write operations. All SQL lives here;
// business rules live in the service (same split as
// NavigationItem model / navigationService).
// ------------------------------------------------------------

import pool from '../config/db.js';

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = [
  'id', 'section_id', 'role', 'name', 'title', 'message', 'image_url',
  'image_alt', 'sort_order', 'is_active', 'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

/** Public-safe projection: never exposes admin-only bookkeeping. */
const PUBLIC_COLUMNS = [
  'id', 'role', 'name', 'title', 'message', 'image_url', 'image_alt',
  'sort_order',
].map((c) => `\`${c}\``).join(', ');

/**
 * Convert DB TINYINT(1) flags to real booleans for JS consumers.
 * Only rewrites the flag when the column is actually selected —
 * public projections omit is_active and must not gain a false one.
 */
function toJs(row) {
  if (!row) return null;
  const out = { ...row };
  if ('is_active' in out) out.is_active = out.is_active === 1;
  return out;
}

/**
 * All rows of one section (active + inactive), display order — admin view.
 */
export async function findAllOrdered(sectionId) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`leadership_messages\`
     WHERE \`section_id\` = ?
     ORDER BY \`sort_order\` ASC, \`id\` ASC`,
    [sectionId],
  );
  return rows.map(toJs);
}

/** Only active rows, ordered — exactly the public homepage query. */
export async function findActiveOrdered(sectionId) {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM \`leadership_messages\`
     WHERE \`section_id\` = ? AND \`is_active\` = 1
     ORDER BY \`sort_order\` ASC, \`id\` ASC`,
    [sectionId],
  );
  return rows.map(toJs);
}

/** Single row by id, or null. */
export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`leadership_messages\` WHERE \`id\` = ? LIMIT 1`,
    [id],
  );
  return toJs(rows[0]);
}

/** Create one record; returns the full created row. */
export async function createItem({
  section_id, role, name = null, title = null, message = null, image_url = null,
  image_alt = null, sort_order = 0, is_active = true,
}) {
  const [result] = await pool.query(
    `INSERT INTO \`leadership_messages\`
       (\`section_id\`, \`role\`, \`name\`, \`title\`, \`message\`, \`image_url\`,
        \`image_alt\`, \`sort_order\`, \`is_active\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [section_id, role, name, title, message, image_url, image_alt,
      sort_order, is_active ? 1 : 0],
  );
  return findById(result.insertId);
}

/** Update by id (only provided fields); returns the updated row. */
export async function updateItem(id, fields) {
  const allowed = [
    'role', 'name', 'title', 'message', 'image_url', 'image_alt',
    'sort_order', 'is_active',
  ];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`\`${key}\` = ?`);
      const raw = fields[key];
      values.push(key === 'is_active' ? (raw ? 1 : 0) : raw);
    }
  }
  if (sets.length === 0) return findById(id);
  values.push(id);
  await pool.query(
    `UPDATE \`leadership_messages\` SET ${sets.join(', ')} WHERE \`id\` = ?`,
    values,
  );
  return findById(id);
}

/** Delete by id. Returns true when a row was removed. */
export async function deleteItem(id) {
  const [result] = await pool.query(
    'DELETE FROM `leadership_messages` WHERE `id` = ?',
    [id],
  );
  return result.affectedRows > 0;
}

/**
 * Atomically reassign display positions from a validated
 * [ { id, sort_order } ] list. Runs inside a transaction so the
 * order can never end up half-applied.
 */
export async function reorderItems(orders) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const { id, sort_order } of orders) {
      await conn.query(
        'UPDATE `leadership_messages` SET `sort_order` = ? WHERE `id` = ?',
        [sort_order, id],
       );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
