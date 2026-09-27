// ------------------------------------------------------------
// GalleryItem model — data access for gallery_items (Phase B.2)
//
// All SQL lives here; business rules live in the service. Every
// query is parameterized; column/table names are fixed literals,
// never client input. LIMIT/OFFSET are integer-clamped by the
// caller and interpolated as integers only (never strings).
// ------------------------------------------------------------

import pool from '../config/db.js';

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = [
  'id', 'title', 'caption', 'image', 'category', 'status',
  'sort_order', 'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

/** Safe JSON representation of a TIMESTAMP (or null). */
function iso(value) {
  return value instanceof Date ? value.toISOString() : (value ?? null);
}

/** Shape a DB row for API output (dates → ISO strings). */
function shape(row) {
  if (!row) return row;
  return {
    ...row,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

/**
 * Public list: PUBLISHED items in display order (sort_order ASC,
 * newest id DESC as the deterministic tie-breaker). Optional
 * category filter. Integer-clamped LIMIT/OFFSET only.
 */
export async function findPublished({ category, limit, offset } = {}) {
  const clauses = ["`status` = 'PUBLISHED'"];
  const params = [];
  if (category) {
    clauses.push('`category` = ?');
    params.push(category);
  }
  let sql = `SELECT ${COLUMNS} FROM \`gallery_items\` WHERE ${clauses.join(' AND ')} ORDER BY \`sort_order\` ASC, \`id\` DESC`;
  if (Number.isInteger(limit)) {
    sql += ` LIMIT ${Math.max(1, Math.min(100, limit))}`;
    if (Number.isInteger(offset) && offset > 0) {
      sql += ` OFFSET ${Math.max(0, Math.min(5000, offset))}`;
    }
  }
  const [rows] = await pool.query(sql, params);
  return rows.map(shape);
}

/**
 * Distinct categories that currently have PUBLISHED items
 * (powers the public category filter — empty categories are
 * never advertised).
 */
export async function findPublishedCategories() {
  const [rows] = await pool.query(
    "SELECT DISTINCT `category` FROM `gallery_items` WHERE `status` = 'PUBLISHED' ORDER BY `category` ASC",
  );
  return rows.map((r) => r.category);
}

/**
 * Admin list: all statuses, optional filters, admin-friendly
 * ordering (category, then display order).
 */
export async function findAllAdmin({ status, category } = {}) {
  const clauses = ['1=1'];
  const params = [];
  if (status) {
    clauses.push('`status` = ?');
    params.push(status);
  }
  if (category) {
    clauses.push('`category` = ?');
    params.push(category);
  }
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`gallery_items\` WHERE ${clauses.join(' AND ')}
     ORDER BY \`sort_order\` ASC, \`id\` DESC`,
    params,
  );
  return rows.map(shape);
}

/** Admin detail by id (or undefined). */
export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`gallery_items\` WHERE \`id\` = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? shape(rows[0]) : undefined;
}

/** Count how many rows reference an image path (shared-file safety). */
export async function countImage(imagePath, excludeId = null) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM `gallery_items` WHERE `image` = ?' + (excludeId ? ' AND `id` != ?' : ''),
    excludeId ? [imagePath, excludeId] : [imagePath],
  );
  return rows[0].n;
}

/**
 * Insert a new gallery item. Status/publish semantics are owned by
 * the service. Returns the new row id.
 */
export async function insert(item) {
  const [result] = await pool.query(
    `INSERT INTO \`gallery_items\`
       (\`title\`, \`caption\`, \`image\`, \`category\`, \`status\`, \`sort_order\`)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      item.title,
      item.caption ?? null,
      item.image,
      item.category,
      item.status,
      item.sort_order ?? 0,
    ],
  );
  return result.insertId;
}

/** Update editable fields. Returns affected rows. */
export async function update(id, item) {
  const [result] = await pool.query(
    `UPDATE \`gallery_items\`
     SET \`title\` = ?, \`caption\` = ?, \`image\` = ?, \`category\` = ?, \`sort_order\` = ?
     WHERE \`id\` = ?`,
    [
      item.title,
      item.caption ?? null,
      item.image,
      item.category,
      item.sort_order ?? 0,
      id,
    ],
  );
  return result.affectedRows;
}

/** Set the publication status. Returns affected rows. */
export async function updateStatus(id, status) {
  const [result] = await pool.query(
    'UPDATE `gallery_items` SET `status` = ? WHERE `id` = ?',
    [status, id],
  );
  return result.affectedRows;
}

/** Hard delete by id. Returns affected rows. */
export async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM `gallery_items` WHERE `id` = ?',
    [id],
  );
  return result.affectedRows;
}
