// ------------------------------------------------------------
// Database connection (Phase 3.1)
// MySQL-compatible (MySQL 8+ / MariaDB 10.4+) via mysql2/promise.
//
// Credentials come from environment variables only — never
// hardcoded. The local-dev fallbacks match a default XAMPP
// setup (root, no password) so `npm run db:*` works out of the
// box; production MUST set real DB_* values in the environment.
// ------------------------------------------------------------

import mysql from 'mysql2/promise';

export const DB_NAME = process.env.DB_NAME || 'greenleaf_school';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  // Safety: application queries must never execute SQL batches.
  // (Migration/seed scripts open their own dedicated connections
  // with multipleStatements enabled.)
  multipleStatements: false,
  namedPlaceholders: true,
});

export default pool;

/** Gracefully close all pool connections (used by scripts/tests). */
export async function closePool() {
  await pool.end();
}
