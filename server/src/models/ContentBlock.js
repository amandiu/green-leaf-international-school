// ------------------------------------------------------------
// ContentBlock model — data access for content_blocks (Phase D)
//
// One row per reusable block (block_key UNIQUE). All SQL lives
// here; business rules live in the service. `content` is a JSON
// column — the same normalize handling as PageSection applies
// (MariaDB returns LONGTEXT strings; MySQL parses natively).
// Every query is parameterized; column/table names are fixed
// literals, never client input.
// ------------------------------------------------------------

import pool from '../config/db.js';

/**
 * Normalize a content row: parse string JSON once so the service
 * always sees a plain object (see PageSection.normalizeRow).
 */
function normalizeRow(row) {
  if (row && typeof row.content === 'string') {
    try {
      return { ...row, content: JSON.parse(row.content) };
    } catch {
      // Malformed JSON never crashes the site — the service's
      // fallback covers the invalid row.
      return { ...row, content: null };
    }
  }
  return row;
}

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = [
  'id', 'block_key', 'name', 'block_type', 'content', 'is_active',
  'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

/** Every block row, newest-updated last for a stable list. */
export async function findAll() {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`content_blocks\` ORDER BY \`block_key\` ASC`,
  );
  return rows.map(normalizeRow);
}

/** One block row by key (or undefined). */
export async function findByKey(blockKey) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`content_blocks\` WHERE \`block_key\` = ? LIMIT 1`,
    [blockKey],
  );
  return rows[0] ? normalizeRow(rows[0]) : undefined;
}

/** Insert a new block. Returns the row id. */
export async function insert(blockKey, name, blockType, content, isActive) {
  const [result] = await pool.query(
    `INSERT INTO \`content_blocks\` (\`block_key\`, \`name\`, \`block_type\`, \`content\`, \`is_active\`)
     VALUES (?, ?, ?, ?, ?)`,
    [blockKey, name, blockType, JSON.stringify(content), isActive ? 1 : 0],
  );
  return result.insertId;
}

/**
 * Update name/content/active for an existing block. Returns the
 * number of affected rows (0 = key not found).
 */
export async function update(blockKey, name, content, isActive) {
  const [result] = await pool.query(
    `UPDATE \`content_blocks\`
     SET \`name\` = ?, \`content\` = ?, \`is_active\` = ?
     WHERE \`block_key\` = ?`,
    [name, JSON.stringify(content), isActive ? 1 : 0, blockKey],
  );
  return result.affectedRows;
}

/** Delete a block by key. Returns affected rows (0 = not found). */
export async function remove(blockKey) {
  const [result] = await pool.query(
    `DELETE FROM \`content_blocks\` WHERE \`block_key\` = ?`,
    [blockKey],
  );
  return result.affectedRows;
}
