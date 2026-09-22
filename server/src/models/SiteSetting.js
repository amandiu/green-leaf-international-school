// ------------------------------------------------------------
// SiteSetting model — data access for site_settings (Phase A)
//
// One row per setting (setting_key UNIQUE). All SQL lives here;
// business rules live in the service. Null values are stored as
// SQL NULL and surface as JS null (social links use this).
// ------------------------------------------------------------

import pool from '../config/db.js';

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = [
  'id', 'setting_key', 'setting_value', 'setting_group',
  'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

/** Every setting row (no values are interpreted here). */
export async function findAll() {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`site_settings\` ORDER BY \`setting_key\` ASC`,
  );
  return rows;
}

/**
 * Upsert one setting. Parameterized only — the column list is a
 * fixed literal, never client input.
 * Returns the row id.
 */
export async function upsert(key, value, group) {
  const [result] = await pool.query(
    `INSERT INTO \`site_settings\` (\`setting_key\`, \`setting_value\`, \`setting_group\`)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       \`setting_value\` = VALUES(\`setting_value\`),
       \`setting_group\` = VALUES(\`setting_group\`)`,
    [key, value, group],
  );
  return result.insertId;
}

/** Upsert many settings in one transaction (all-or-nothing). */
export async function upsertMany(entries) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const entry of entries) {
      await conn.query(
        `INSERT INTO \`site_settings\` (\`setting_key\`, \`setting_value\`, \`setting_group\`)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           \`setting_value\` = VALUES(\`setting_value\`),
           \`setting_group\` = VALUES(\`setting_group\`)`,
        [entry.key, entry.value, entry.group],
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
