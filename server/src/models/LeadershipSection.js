// ------------------------------------------------------------
// LeadershipSection model — data access for leadership_sections
//
// Single-section phase: the homepage renders the first section.
// The schema is multi-section ready, but all queries below
// intentionally operate on the lowest-id section so the admin
// panel and public API stay deterministic.
//
// All SQL lives here; business rules live in the service (same
// split as NavigationItem model / navigationService).
// ------------------------------------------------------------

import pool from '../config/db.js';

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = [
  'id', 'eyebrow', 'title', 'description', 'is_active', 'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

/** Public-safe projection. */
const PUBLIC_COLUMNS = [
  'id', 'eyebrow', 'title', 'description',
].map((c) => `\`${c}\``).join(', ');

/** Convert DB TINYINT(1) flags to real booleans for JS consumers. */
function toJs(row) {
  if (!row) return null;
  return { ...row, is_active: row.is_active === 1 };
}

/**
 * The single section used this phase — lowest id.
 * Returns the full row (active + inactive) for the admin view.
 */
export async function findFirstSection() {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`leadership_sections\` ORDER BY \`id\` ASC LIMIT 1`,
  );
  return toJs(rows[0]);
}

/** Public-safe projection of the section (or null). */
export async function findFirstPublicSection() {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM \`leadership_sections\` ORDER BY \`id\` ASC LIMIT 1`,
  );
  return rows[0] || null;
}

/** Create the section row when none exists (idempotent bootstrap). */
export async function createIfMissing({ eyebrow = null, title = null, description = null }) {
  const [result] = await pool.query(
    'INSERT INTO `leadership_sections` (`eyebrow`, `title`, `description`, `is_active`) SELECT ?, ?, ?, 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `leadership_sections`)',
    [eyebrow, title, description],
  );
  if (result.affectedRows > 0) return findFirstSection();
  return findFirstSection();
}

/** Update the first section (only provided fields). */
export async function updateFirstSection(fields) {
  const allowed = ['eyebrow', 'title', 'description', 'is_active'];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`\`${key}\` = ?`);
      values.push(key === 'is_active' ? (fields[key] ? 1 : 0) : fields[key]);
    }
  }
  const section = await findFirstSection();
  if (!section || sets.length === 0) return section;
  await pool.query(
    `UPDATE \`leadership_sections\` SET ${sets.join(', ')} WHERE \`id\` = ?`,
    [...values, section.id],
  );
  return findFirstSection();
}