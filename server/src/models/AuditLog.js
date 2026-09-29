// ------------------------------------------------------------
// AuditLog model — data access for audit_logs (Phase D.3)
//
// INSERT-ONLY data access (§AN.19: the audit trail is append-only
// by application contract — no UPDATE/DELETE paths exist here or
// anywhere in the application; retention is Phase Q, §Y.12).
//
// All SQL lives here; policy lives in the service. Every query is
// parameterized; column names are fixed literals.
// ------------------------------------------------------------

import pool from '../config/db.js';

/**
 * Append one audit row. Accepts the EXACT §L field set — no more:
 *   { userId, actorEmail, action, entity, entityId, meta, ip }
 * `at` is intentionally NOT accepted: created_at is stamped by the
 * database (UTC DEFAULT CURRENT_TIMESTAMP), mirroring every other
 * table — the client (and this model's callers) can never supply
 * the audit timestamp (§AN.19 field contract).
 *
 * Returns the inserted row id. Throws only on DB errors (the
 * service layer decides the failure policy).
 */
export async function insert({ userId, actorEmail, action, entity, entityId, meta, ip }) {
  const [result] = await pool.query(
    'INSERT INTO `audit_logs` (`user_id`, `actor_email`, `action`, `entity`, `entity_id`, `meta`, `ip`)'
      + ' VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      userId ?? null,
      actorEmail ?? null,
      action,
      entity,
      entityId ?? null,
      meta === undefined || meta === null ? null : JSON.stringify(meta),
      ip ?? null,
    ],
  );
  return result.insertId;
}

/**
 * Count all audit rows (D3 suite baseline/cleanup verification).
 * Counts only — never exposes row contents (no read API exists).
 */
export async function countAll() {
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM `audit_logs`');
  return rows[0].n;
}
