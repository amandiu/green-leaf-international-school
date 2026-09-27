// ------------------------------------------------------------
// Download model — data access for downloads (Phase B.6)
//
// All SQL lives here; business rules live in the service. Every
// query is parameterized; column/table names are fixed literals,
// never client input. LIMIT/OFFSET are integer-clamped by the
// caller and interpolated as integers only (never strings).
// ------------------------------------------------------------

import pool from '../config/db.js';

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = [
  'id', 'title', 'description', 'category', 'file',
  'original_filename', 'file_ext', 'file_bytes',
  'status', 'sort_order', 'created_at', 'updated_at',
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
 * category filter (service validates it first). Integer-clamped
 * LIMIT/OFFSET only.
 */
export async function findPublished({ category, limit, offset } = {}) {
  const clauses = ["`status` = 'PUBLISHED'"];
  const params = [];
  if (category) {
    clauses.push('`category` = ?');
    params.push(category);
  }
  let sql = `SELECT ${COLUMNS} FROM \`downloads\` WHERE ${clauses.join(' AND ')} ORDER BY \`sort_order\` ASC, \`id\` DESC`;
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
    "SELECT DISTINCT `category` FROM `downloads` WHERE `status` = 'PUBLISHED' ORDER BY `category` ASC",
  );
  return rows.map((r) => r.category);
}

/** Admin list: all statuses, optional filters, admin-friendly order. */
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
    `SELECT ${COLUMNS} FROM \`downloads\` WHERE ${clauses.join(' AND ')}
     ORDER BY \`sort_order\` ASC, \`id\` DESC`,
    params,
  );
  return rows.map(shape);
}

/** Admin detail by id (or undefined). */
export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`downloads\` WHERE \`id\` = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? shape(rows[0]) : undefined;
}

/** Count how many rows reference a managed file (shared-file safety). */
export async function countFile(filePath, excludeId = null) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM `downloads` WHERE `file` = ?' + (excludeId ? ' AND `id` != ?' : ''),
    excludeId ? [filePath, excludeId] : [filePath],
  );
  return rows[0].n;
}

/** Insert a new download row. Returns the new id. */
export async function insert(item) {
  const [result] = await pool.query(
    `INSERT INTO \`downloads\`
       (\`title\`, \`description\`, \`category\`, \`file\`, \`original_filename\`, \`file_ext\`, \`file_bytes\`, \`status\`, \`sort_order\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.title,
      item.description ?? null,
      item.category,
      item.file,
      item.original_filename ?? null,
      item.file_ext ?? null,
      item.file_bytes ?? null,
      item.status,
      item.sort_order ?? 0,
    ],
  );
  return result.insertId;
}

/** Update editable fields. Returns affected rows. */
export async function update(id, item) {
  const [result] = await pool.query(
    `UPDATE \`downloads\`
     SET \`title\` = ?, \`description\` = ?, \`category\` = ?, \`file\` = ?,
         \`original_filename\` = ?, \`file_ext\` = ?, \`file_bytes\` = ?, \`sort_order\` = ?
     WHERE \`id\` = ?`,
    [
      item.title,
      item.description ?? null,
      item.category,
      item.file,
      item.original_filename ?? null,
      item.file_ext ?? null,
      item.file_bytes ?? null,
      item.sort_order ?? 0,
      id,
    ],
  );
  return result.affectedRows;
}

/** Set the publication status. Returns affected rows. */
export async function updateStatus(id, status) {
  const [result] = await pool.query(
    'UPDATE `downloads` SET `status` = ? WHERE `id` = ?',
    [status, id],
  );
  return result.affectedRows;
}

/** Hard delete by id. Returns affected rows. */
export async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM `downloads` WHERE `id` = ?',
    [id],
  );
  return result.affectedRows;
}
