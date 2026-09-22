// ------------------------------------------------------------
// NewsItem model — data access for news_items (Phase E)
//
// All SQL lives here; business rules live in the service. Every
// query is parameterized; column/table names are fixed literals,
// never client input.
// ------------------------------------------------------------

import pool from '../config/db.js';

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = [
  'id', 'title', 'slug', 'type', 'status', 'excerpt', 'content', 'image',
  'published_at', 'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

/** Safe JSON representation of a DATETIME (or null). */
function iso(value) {
  return value instanceof Date ? value.toISOString() : (value ?? null);
}

/** Shape a DB row for API output (dates → ISO strings). */
function shape(row) {
  if (!row) return row;
  return {
    ...row,
    published_at: iso(row.published_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

/** Public list: PUBLISHED items, newest first. */
export async function findPublished({ limit, offset, type } = {}) {
  const clauses = ["`status` = 'PUBLISHED'"];
  const params = [];
  if (type) {
    clauses.push('`type` = ?');
    params.push(type);
  }
  let sql = `SELECT ${COLUMNS} FROM \`news_items\` WHERE ${clauses.join(' AND ')} ORDER BY \`published_at\` DESC, \`id\` DESC`;
  if (Number.isInteger(limit)) {
    // Integers only — clamped, never string-interpolated from input.
    sql += ` LIMIT ${Math.max(1, Math.min(50, limit))}`;
    if (Number.isInteger(offset) && offset > 0) {
      sql += ` OFFSET ${Math.max(0, Math.min(5000, offset))}`;
    }
  }
  const [rows] = await pool.query(sql, params);
  return rows.map(shape);
}

/** Public detail: one PUBLISHED item by slug (or undefined). */
export async function findPublishedBySlug(slug) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`news_items\` WHERE \`slug\` = ? AND \`status\` = 'PUBLISHED' LIMIT 1`,
    [slug],
  );
  return rows[0] ? shape(rows[0]) : undefined;
}

/** Admin list: all statuses, optional filter, newest-updated first. */
export async function findAllAdmin({ status, type } = {}) {
  const clauses = ['1=1'];
  const params = [];
  if (status) {
    clauses.push('`status` = ?');
    params.push(status);
  }
  if (type) {
    clauses.push('`type` = ?');
    params.push(type);
  }
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`news_items\` WHERE ${clauses.join(' AND ')} ORDER BY \`updated_at\` DESC, \`id\` DESC`,
    params,
  );
  return rows.map(shape);
}

/** Admin detail by id. */
export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`news_items\` WHERE \`id\` = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? shape(rows[0]) : undefined;
}

/** Count rows for a slug (excluding one id) — slug uniqueness. */
export async function countSlug(slug, excludeId = null) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM `news_items` WHERE `slug` = ?' + (excludeId ? ' AND `id` != ?' : ''),
    excludeId ? [slug, excludeId] : [slug],
  );
  return rows[0].n;
}

/** Insert a new news item. Returns the row id. */
export async function insert(item) {
  const [result] = await pool.query(
    `INSERT INTO \`news_items\`
       (\`title\`, \`slug\`, \`type\`, \`status\`, \`excerpt\`, \`content\`, \`image\`, \`published_at\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.title, item.slug, item.type, item.status,
      item.excerpt ?? null, item.content ?? null, item.image ?? null,
      item.published_at ?? null,
    ],
  );
  return result.insertId;
}

/** Update an existing news item. Returns affected rows. */
export async function update(id, item) {
  const [result] = await pool.query(
    `UPDATE \`news_items\`
     SET \`title\` = ?, \`slug\` = ?, \`type\` = ?, \`excerpt\` = ?, \`content\` = ?, \`image\` = ?
     WHERE \`id\` = ?`,
    [item.title, item.slug, item.type, item.excerpt ?? null, item.content ?? null, item.image ?? null, id],
  );
  return result.affectedRows;
}

/** Set status (+ publish/unpublish timestamp handling). Returns affected rows. */
export async function updateStatus(id, status, publishedAt) {
  const [result] = await pool.query(
    'UPDATE `news_items` SET `status` = ?, `published_at` = ? WHERE `id` = ?',
    [status, publishedAt, id],
  );
  return result.affectedRows;
}

/** Hard delete by id. Returns affected rows. */
export async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM `news_items` WHERE `id` = ?',
    [id],
  );
  return result.affectedRows;
}

/** Count all items (admin list meta). */
export async function countAll() {
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM `news_items`');
  return rows[0].n;
}
