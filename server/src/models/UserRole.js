// ------------------------------------------------------------
// UserRole model — data access for user_roles (Phase C.2 identity)
//
// Junction rows (user ↔ role) + the primary-role flag. Multi-row
// writes (primary swap + insert) are orchestrated by the service
// inside one transaction using a supplied connection; all
// single-statement helpers here use the shared pool.
// ------------------------------------------------------------

import pool from '../config/db.js';

const COLUMNS = ['id', 'user_id', 'role_id', 'is_primary', 'created_at', 'updated_at']
  .map((c) => `\`${c}\``)
  .join(', ');

function toJs(row) {
  if (!row) return null;
  return { ...row, is_primary: row.is_primary === 1 };
}

/** All role rows for one user, primary first. */
export async function findByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`user_roles\` WHERE \`user_id\` = ? ORDER BY \`is_primary\` DESC, \`id\` ASC`,
    [userId],
  );
  return rows.map(toJs);
}

/** One assignment row (service duplicate guard). */
export async function findByUserAndRole(userId, roleId) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`user_roles\` WHERE \`user_id\` = ? AND \`role_id\` = ? LIMIT 1`,
    [userId, roleId],
  );
  return toJs(rows[0]);
}

/** Count assignments (diagnostics / verify). */
export async function countByUserId(userId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM `user_roles` WHERE `user_id` = ?',
    [userId],
  );
  return rows[0].n;
}

/**
 * Resolved role CODES for one canonical user id, primary first.
 * Phase C.4 (§AN.7): the login path reads this to populate the
 * session `roles` claim and enforce the admin-role boundary.
 * Read-only join user_roles → roles (no permissions here — C7).
 */
export async function findRoleCodesByUserId(userId) {
  const [rows] = await pool.query(
    'SELECT `r`.`code` FROM `user_roles` `ur`'
      + ' JOIN `roles` `r` ON `r`.`id` = `ur`.`role_id`'
      + ' WHERE `ur`.`user_id` = ? AND `r`.`is_active` = 1'
      + ' ORDER BY `ur`.`is_primary` DESC, `ur`.`id` ASC',
    [userId],
  );
  return rows.map((row) => row.code);
}

/**
 * Resolved ACTIVE role membership ({ id, code }) for one canonical
 * user id, primary first. Phase C.7: requireRole/requirePermission
 * resolve the caller's roles LIVE through this join — permission
 * keys are looked up per role_id through the §AN.5 short-TTL cache
 * (identityService.getRolePermissions).
 */
export async function findRoleMembershipByUserId(userId) {
  const [rows] = await pool.query(
    'SELECT `r`.`id`, `r`.`code` FROM `user_roles` `ur`'
      + ' JOIN `roles` `r` ON `r`.`id` = `ur`.`role_id`'
      + ' WHERE `ur`.`user_id` = ? AND `r`.`is_active` = 1'
      + ' ORDER BY `ur`.`is_primary` DESC, `ur`.`id` ASC',
    [userId],
  );
  return rows.map((row) => ({ id: row.id, code: row.code }));
}

// ---- transaction helpers (service supplies the connection) ----

/** Insert one assignment row on the given connection. */
export async function insertWith(conn, { userId, roleId, isPrimary }) {
  const [result] = await conn.query(
    'INSERT INTO `user_roles` (`user_id`, `role_id`, `is_primary`) VALUES (?, ?, ?)',
    [userId, roleId, isPrimary ? 1 : 0],
  );
  return result.insertId;
}

/** Clear the primary flag on the given connection. */
export async function clearPrimaryWith(conn, userId) {
  await conn.query(
    'UPDATE `user_roles` SET `is_primary` = 0 WHERE `user_id` = ? AND `is_primary` = 1',
    [userId],
  );
}
