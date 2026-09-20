// ------------------------------------------------------------
// AdminUser model — data access for admin_users
//
// All SQL lives here. Password verification lives in the service
// (bcrypt compare against the hash this model fetches).
// ------------------------------------------------------------

import pool from '../config/db.js';

/** All columns, in table order — never SELECT * in app code. */
const COLUMNS = [
  'id', 'email', 'password_hash', 'name', 'is_active', 'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

/** Public-safe projection — password_hash must never leave the model. */
const SAFE_COLUMNS = [
  'id', 'email', 'name', 'is_active', 'created_at', 'updated_at',
].map((c) => `\`${c}\``).join(', ');

function toJs(row) {
  if (!row) return null;
  return { ...row, is_active: row.is_active === 1 };
}

/**
 * Fetch login data (including password_hash) by exact email.
 * Emails are stored lowercase — the service normalizes before calling.
 */
export async function findByEmailWithHash(email) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM \`admin_users\` WHERE \`email\` = ? LIMIT 1`,
    [email],
  );
  return rows[0] || null;
}

/** Safe profile by id (no password_hash) — for /api/auth/me. */
export async function findSafeById(id) {
  const [rows] = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM \`admin_users\` WHERE \`id\` = ? LIMIT 1`,
    [id],
  );
  return toJs(rows[0]);
}

/** True when the email is already registered (setup script guard). */
export async function emailExists(email) {
  const [rows] = await pool.query(
    'SELECT `id` FROM `admin_users` WHERE `email` = ? LIMIT 1',
    [email],
  );
  return rows.length > 0;
}

/** Count all admin accounts (setup script: first-admin bootstrap). */
export async function countAdmins() {
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM `admin_users`');
  return rows[0].n;
}

/** Create an admin account (password already hashed by the caller). */
export async function createAdmin({ email, password_hash, name = null, is_active = true }) {
  const [result] = await pool.query(
    'INSERT INTO `admin_users` (`email`, `password_hash`, `name`, `is_active`) VALUES (?, ?, ?, ?)',
    [email, password_hash, name, is_active ? 1 : 0],
  );
  return findSafeById(result.insertId);
}