// ------------------------------------------------------------
// Role model — data access for roles (Phase C.2 identity)
//
// All SQL lives here; business rules live in the service. Every
// query is parameterized; column names are fixed literals.
// The catalog is seeded (seed 006) and read-mostly.
// ------------------------------------------------------------

import pool from '../config/db.js';

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = ['id', 'code', 'name', 'is_active', 'created_at', 'updated_at']
  .map((c) => `\`${c}\``)
  .join(', ');

/** Safe catalog row (no secrets exist here, but keep the shape explicit). */
function shape(row) {
  if (!row) return null;
  return { ...row, is_active: row.is_active === 1 };
}

/** All roles, catalog order. */
export async function findAll() {
  const [rows] = await pool.query(`SELECT ${COLUMNS} FROM \`roles\` ORDER BY \`id\` ASC`);
  return rows.map(shape);
}

/** One role by exact code (service normalizes case). */
export async function findByCode(code) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`roles\` WHERE \`code\` = ? LIMIT 1`,
    [code],
  );
  return shape(rows[0]);
}

/** Count roles (dbRun verify / health checks). */
export async function countRoles() {
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM `roles`');
  return rows[0].n;
}
