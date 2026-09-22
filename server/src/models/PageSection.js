// ------------------------------------------------------------
// PageSection model — data access for page_sections (Phase B)
//
// One row per page section (page + section_key UNIQUE). All SQL
// lives here; business rules live in the service. `content` is a
// JSON column — mysql2 parses it to a JS object automatically.
// Every query is parameterized; column/table names are fixed
// literals, never client input.
// ------------------------------------------------------------

import pool from '../config/db.js';

/**
 * Normalize a content row: MariaDB reports JSON columns as
 * LONGTEXT, so mysql2 hands the payload back as a STRING — parse
 * it once here so the service always sees a plain object.
 * (MySQL reports real JSON and mysql2 parses it natively; both
 * shapes are handled.)
 */
function normalizeRow(row) {
  if (row && typeof row.content === 'string') {
    try {
      return { ...row, content: JSON.parse(row.content) };
    } catch {
      // Malformed JSON never crashes the site — the service's
      // per-section fallback covers the invalid row.
      return { ...row, content: null };
    }
  }
  return row;
}

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = [
  'id', 'page', 'section_key', 'sort_order', 'content', 'is_active',
  'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

/** Every section row for one page, in display order. */
export async function findByPage(page) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`page_sections\` WHERE \`page\` = ? ORDER BY \`sort_order\` ASC, \`id\` ASC`,
    [page],
  );
  return rows.map(normalizeRow);
}

/** One section row by page + key (or undefined). */
export async function findPageSection(page, sectionKey) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`page_sections\` WHERE \`page\` = ? AND \`section_key\` = ? LIMIT 1`,
    [page, sectionKey],
  );
  return rows[0] ? normalizeRow(rows[0]) : undefined;
}

/**
 * Upsert one section's content + active flag. Parameterized only —
 * the column list is a fixed literal. Returns the row id.
 */
export async function upsertSection(page, sectionKey, content, isActive, sortOrder = 0) {
  const [result] = await pool.query(
    `INSERT INTO \`page_sections\` (\`page\`, \`section_key\`, \`sort_order\`, \`content\`, \`is_active\`)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       \`content\` = VALUES(\`content\`),
       \`is_active\` = VALUES(\`is_active\`)`,
    [page, sectionKey, sortOrder, JSON.stringify(content), isActive ? 1 : 0],
  );
  return result.insertId;
}
