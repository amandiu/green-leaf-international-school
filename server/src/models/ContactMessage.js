// ------------------------------------------------------------
// ContactMessage model — data access for contact_messages (Phase B.1)
//
// All SQL lives here; business rules live in the service. Every
// query is parameterized; column/table names are fixed literals,
// never client input. Reading rows is an ADMIN-only capability —
// the public API path never calls this model (only insert()).
// ------------------------------------------------------------

import pool from '../config/db.js';

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = [
  'id', 'name', 'email', 'phone', 'subject', 'message',
  'status', 'created_at', 'updated_at',
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
 * Admin list with optional status filter, newest first.
 * Status is validated by the service before reaching this query.
 */
export async function findAll({ status } = {}) {
  const clauses = ['1=1'];
  const params = [];
  if (status) {
    clauses.push('`status` = ?');
    params.push(status);
  }
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`contact_messages\`
     WHERE ${clauses.join(' AND ')}
     ORDER BY \`created_at\` DESC, \`id\` DESC`,
    params,
  );
  return rows.map(shape);
}

/** Admin detail by id (or undefined). */
export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`contact_messages\` WHERE \`id\` = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? shape(rows[0]) : undefined;
}

/**
 * Insert a submitted message. Every value is a bound parameter —
 * the caller (service) has already validated/normalized the shape.
 * Returns the new row id.
 */
export async function insert(message) {
  const [result] = await pool.query(
    `INSERT INTO \`contact_messages\`
       (\`name\`, \`email\`, \`phone\`, \`subject\`, \`message\`, \`status\`)
     VALUES (?, ?, ?, ?, ?, 'NEW')`,
    [
      message.name,
      message.email,
      message.phone ?? null,
      message.subject,
      message.message,
    ],
  );
  return result.insertId;
}

/**
 * Set the inbox status (admin action). Returns affected rows.
 * Status is validated by the service before reaching this query.
 */
export async function updateStatus(id, status) {
  const [result] = await pool.query(
    'UPDATE `contact_messages` SET `status` = ? WHERE `id` = ?',
    [status, id],
  );
  return result.affectedRows;
}

/** Hard delete by id (admin action). Returns affected rows. */
export async function remove(id) {
  const [result] = await pool.query(
    'DELETE FROM `contact_messages` WHERE `id` = ?',
    [id],
  );
  return result.affectedRows;
}
