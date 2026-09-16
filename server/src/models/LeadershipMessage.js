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
  'id', 'role', 'name', 'title', 'message', 'image_url',
  'sort_order', 'is_active', 'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

/** Public-safe projection: never exposes admin-only bookkeeping. */
const PUBLIC_COLUMNS = [
  'id', 'role', 'name', 'title', 'message', 'image_url', 'sort_order',
].map((c) => `\`${c}\``).join(', ');

/** Convert DB TINYINT(1) flags to real booleans for JS consumers. */
function toJs(row) {
  if (!row) return null;
  return { ...row, is_active: row.is_active === 1 };
}

/** All rows (active + inactive), display order — admin view. */
export async function findAllOrdered() {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`leadership_messages\`
     ORDER BY \`sort_order\` ASC, \`id\` ASC`,
  );
  return rows.map(toJs);
}

/** Only active rows, ordered — exactly the public homepage query. */
export async function findActiveOrdered() {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM \`leadership_messages\`
     WHERE \`is_active\` = 1
     ORDER BY \`sort_order\` ASC, \`id\` ASC`,
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
  role, name = null, title = null, message = null, image_url = null,
  sort_order = 0, is_active = true,
}) {
  const [result] = await pool.query(
    `INSERT INTO \`leadership_messages\`
       (\`role\`, \`name\`, \`title\`, \`message\`, \`image_url\`,
        \`sort_order\`, \`is_active\`)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [role, name, title, message, image_url, sort_order, is_active ? 1 : 0],
  );
  return findById(result.insertId);
}

/** Update by id (only provided fields); returns the updated row. */
export async function updateItem(id, fields) {
  const allowed = [
    'role', 'name', 'title', 'message', 'image_url',
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
