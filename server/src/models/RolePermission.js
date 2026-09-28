// ------------------------------------------------------------
// RolePermission model — data access for role_permissions (Phase C.2)
//
// Read-only in C2 (§AN.13: the table is written by migrations/
// seeds only until permission enforcement lands in C7). The
// service caches results per process with a short TTL (§AN.5).
// ------------------------------------------------------------

import pool from '../config/db.js';

/**
 * All permission keys attached to the given role (by id).
 * Empty array for a role with no explicit keys (the admin role's
 * '*' default is a middleware decision, not a stored row).
 */
export async function findKeysByRoleId(roleId) {
  const [rows] = await pool.query(
    'SELECT `permission_key` FROM `role_permissions` WHERE `role_id` = ?',
    [roleId],
  );
  return rows.map((r) => r.permission_key);
}

/** Count mapped keys (diagnostics). */
export async function countAll() {
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM `role_permissions`');
  return rows[0].n;
}
