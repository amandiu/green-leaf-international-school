// ------------------------------------------------------------
// Database migration & seed runner (Phase 3.1)
//
// Usage (from server/):
//   npm run db:migrate     # apply pending migrations (idempotent)
//   npm run db:seed        # apply pending seeds (idempotent)
//   npm run db:verify      # check table structure, constraints, data
//
// Migrations run in filename order inside a transaction and are
// tracked in the schema_migrations table, so they are only ever
// applied once per database. Raw SQL files live in ../sql/.
// ------------------------------------------------------------

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import 'dotenv/config';

const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const MIGRATIONS_DIR = join(ROOT, 'sql', 'migrations');
const SEEDS_DIR = join(ROOT, 'sql', 'seeds');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'greenleaf_school';

const CONNECT_TIMEOUT_MS = 10_000;

function log(msg) { console.log(`  ${msg}`); }

/** Open a bootstrap connection WITHOUT a database selected. */
async function bootstrapConnect() {
  return mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: false,
    connectTimeout: CONNECT_TIMEOUT_MS,
  });
}

async function ensureDatabaseExists() {
  const conn = await bootstrapConnect();
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    log(`✔ database "${DB_NAME}" is present`);
  } finally {
    await conn.end();
  }
}

/** Open a connection WITH the database selected. */
async function connect() {
  return mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: false,
    connectTimeout: CONNECT_TIMEOUT_MS,
  });
}

function readSqlFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort() // 001_..., 002_... → deterministic order
    .map((file) => ({
      name: file.replace(/\.sql$/i, ''),
      file: join(dir, file),
    }));
}

function applyPlaceholder(sql) {
  // Only one placeholder is supported today: the database name
  // inside migration 001. Never substitutes user-supplied values.
  return sql.replaceAll('{{DATABASE_NAME}}', DB_NAME);
}

/**
 * Generic runner: tracks applied scripts in `trackerTable`,
 * wraps each script in a transaction, skips already-applied ones.
 */
async function runScripts({ dir, trackerTable, label }) {
  const scripts = readSqlFiles(dir);
  if (scripts.length === 0) {
    log(`no ${label} files found in ${dir}`);
    return;
  }

  const conn = await connect();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS \`${trackerTable}\` (
      \`name\`       VARCHAR(191) NOT NULL,
      \`applied_at\` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const [appliedRows] = await conn.query(
      `SELECT \`name\` FROM \`${trackerTable}\``,
    );
    const applied = new Set(appliedRows.map((r) => r.name));

    let ran = 0;
    for (const script of scripts) {
      if (applied.has(script.name)) {
        log(`= ${script.name} (already applied, skipping)`);
        continue;
      }
      const raw = readFileSync(script.file, 'utf8');
      const sql = applyPlaceholder(raw);
      await conn.beginTransaction();
      try {
        // Each .sql file is executed as one statement batch on a
        // DEDICATED multipleStatements connection. The content comes
        // only from our own tracked repo files — never user input —
        // so the application pool's multi-statement ban is preserved.
        const dedicated = await mysql.createConnection({
          host: DB_HOST,
          port: DB_PORT,
          user: DB_USER,
          password: DB_PASSWORD,
          database: DB_NAME,
          multipleStatements: true,
          connectTimeout: CONNECT_TIMEOUT_MS,
        });
        try {
          await dedicated.query(sql);
        } finally {
          await dedicated.end();
        }
        await conn.query(
          `INSERT INTO \`${trackerTable}\` (\`name\`) VALUES (?)`,
          [script.name],
        );
        await conn.commit();
        ran += 1;
        log(`✔ ${script.name} applied`);
      } catch (err) {
        await conn.rollback();
        throw new Error(`${label} "${script.name}" failed: ${err.message}`);
      }
    }
    log(`${label}: ${ran} applied, ${scripts.length - ran} skipped`);
  } finally {
    await conn.end();
  }
}

/** Structural + data verification used by `npm run db:verify`. */
async function verify() {
  const conn = await connect();
  const failures = [];
  const check = (ok, msg) => {
    log(`${ok ? '✔' : '✖'} ${msg}`);
    if (!ok) failures.push(msg);
  };
  try {
    // 1. Table exists
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'navigation_items'`,
      [DB_NAME],
    );
    check(tables.length === 1, 'table navigation_items exists');

    // 2. Engine / charset
    const [tableInfo] = await conn.query(
      `SELECT ENGINE, TABLE_COLLATION FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'navigation_items'`,
      [DB_NAME],
    );
    check(
      /innoDB/i.test(tableInfo[0]?.ENGINE || ''),
      `engine is InnoDB (got: ${tableInfo[0]?.ENGINE})`,
    );
    check(
      String(tableInfo[0]?.TABLE_COLLATION || '').startsWith('utf8mb4'),
      `charset utf8mb4 (got: ${tableInfo[0]?.TABLE_COLLATION})`,
    );

    // 3. Expected columns present
    const [columns] = await conn.query(
      `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'navigation_items'
       ORDER BY ORDINAL_POSITION`,
      [DB_NAME],
    );
    const colMap = new Map(columns.map((c) => [c.COLUMN_NAME, c]));
    for (const name of [
      'id', 'parent_id', 'title', 'slug', 'url', 'type', 'sort_order',
      'is_active', 'open_new_tab', 'icon', 'created_at', 'updated_at',
    ]) {
      check(colMap.has(name), `column ${name} exists`);
    }
    check(
      colMap.get('parent_id')?.IS_NULLABLE === 'YES',
      'parent_id is nullable (NULL = main menu)',
    );
    check(
      colMap.get('title')?.IS_NULLABLE === 'NO',
      'title is NOT NULL',
    );
    check(
      String(colMap.get('type')?.COLUMN_TYPE || '').includes('INTERNAL')
        && String(colMap.get('type')?.COLUMN_TYPE || '').includes('EXTERNAL')
        && String(colMap.get('type')?.COLUMN_TYPE || '').includes('DROPDOWN'),
      'type enum supports INTERNAL / EXTERNAL / DROPDOWN',
    );
    check(
      colMap.get('is_active')?.COLUMN_DEFAULT !== null
        && ['1', "b'1'"].includes(String(colMap.get('is_active')?.COLUMN_DEFAULT)),
      'is_active defaults to active (1)',
    );
    check(
      colMap.get('open_new_tab')?.COLUMN_DEFAULT !== null
        && ['0', "b'0'"].includes(String(colMap.get('open_new_tab')?.COLUMN_DEFAULT)),
      'open_new_tab defaults to 0',
    );

    // 4. Foreign key with RESTRICT
    const [fks] = await conn.query(
      `SELECT CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE, REFERENCED_TABLE_NAME
       FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'navigation_items'`,
      [DB_NAME],
    );
    const parentFk = fks.find((f) => f.REFERENCED_TABLE_NAME === 'navigation_items');
    check(!!parentFk, 'self-referencing FK on parent_id exists');
    check(
      parentFk?.DELETE_RULE === 'RESTRICT',
      `FK ON DELETE RESTRICT (got: ${parentFk?.DELETE_RULE})`,
    );

    // 5. Indexes (PK + slug unique + parent/sort composite)
    const [indexes] = await conn.query(`SHOW INDEX FROM \`navigation_items\``);
    const indexNames = new Set(indexes.map((i) => i.Key_name));
    check(indexNames.has('PRIMARY'), 'PRIMARY key index exists');
    check(
      indexes.some((i) => i.Column_name === 'slug' && i.Non_unique === 0),
      'slug has a UNIQUE index',
    );
    check(
      indexes.some(
        (i) => i.Key_name === 'idx_navigation_items_parent_sort'
          && i.Column_name === 'parent_id' && i.Seq_in_index === 1,
      ) && indexes.some(
        (i) => i.Key_name === 'idx_navigation_items_parent_sort'
          && i.Column_name === 'sort_order' && i.Seq_in_index === 2,
      ),
      'composite index (parent_id, sort_order) exists',
    );

    // 6. CHECK constraints on title + type
    const [checks] = await conn.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'navigation_items'
         AND CONSTRAINT_TYPE = 'CHECK'`,
      [DB_NAME],
    );
    const checkNames = new Set(checks.map((c) => c.CONSTRAINT_NAME));
    check(
      checkNames.has('chk_navigation_items_title'),
      'CHECK constraint on non-empty title exists',
    );
    check(
      checkNames.has('chk_navigation_items_type'),
      'CHECK constraint on supported type values exists',
    );

    // 7. Seed data: exactly the 7 verified main-menu items, ordered
    const [rows] = await conn.query(
      `SELECT title, slug, url, type, sort_order, is_active, parent_id
       FROM \`navigation_items\` ORDER BY sort_order ASC`,
    );
    const expected = [
      ['Home', 'home', '/', 'INTERNAL', 10],
      ['About', 'about', '/about', 'INTERNAL', 20],
      ['Academics', 'academics', '/academics', 'INTERNAL', 30],
      ['Admissions', 'admissions', '/admissions', 'INTERNAL', 40],
      ['Campus', 'campus', '/campus', 'INTERNAL', 50],
      ['News', 'news', '/news', 'INTERNAL', 60],
      ['Contact', 'contact', '/contact', 'INTERNAL', 70],
    ];
    check(rows.length === 7, `7 main-menu rows present (got: ${rows.length})`);
    let seedOk = rows.length === expected.length;
    for (let i = 0; i < Math.min(rows.length, expected.length); i += 1) {
      const r = rows[i];
      const e = expected[i];
      const match = r.title === e[0] && r.slug === e[1] && r.url === e[2]
        && r.type === e[3] && r.sort_order === e[4] && r.parent_id === null;
      if (!match) {
        seedOk = false;
        check(false, `row ${i + 1} matches seed spec (got: ${JSON.stringify(r)})`);
      }
    }
    if (seedOk) check(true, 'seed rows match verified routes & order');

    // 8. Sorting works (ORDER BY sort_order returns Home → Contact)
    check(
      rows.length > 0 && rows[0].title === 'Home' && rows[rows.length - 1].title === 'Contact',
      'ORDER BY sort_order yields deterministic Home → Contact order',
    );
  } finally {
    await conn.end();
  }

  if (failures.length > 0) {
    console.error(`\n✖ verification FAILED (${failures.length} problem(s))`);
    process.exitCode = 1;
  } else {
    console.log('\n✔ verification PASSED — database foundation is ready');
  }
}

async function main() {
  const command = process.argv[2] || 'migrate';
  console.log(`Green Leaf DB runner → "${command}"`);
  console.log(`  host=${DB_HOST}:${DB_PORT} db=${DB_NAME} user=${DB_USER}`);

  try {
    if (command === 'migrate') {
      await ensureDatabaseExists();
      await runScripts({
        dir: MIGRATIONS_DIR,
        trackerTable: 'schema_migrations',
        label: 'migration',
      });
    } else if (command === 'seed') {
      await runScripts({
        dir: SEEDS_DIR,
        trackerTable: 'schema_seeds',
        label: 'seed',
      });
    } else if (command === 'verify') {
      await verify();
    } else if (command === 'setup') {
      await ensureDatabaseExists();
      await runScripts({
        dir: MIGRATIONS_DIR,
        trackerTable: 'schema_migrations',
        label: 'migration',
      });
      await runScripts({
        dir: SEEDS_DIR,
        trackerTable: 'schema_seeds',
        label: 'seed',
      });
    } else {
      console.error(`Unknown command "${command}". Use: migrate | seed | verify | setup`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`\n✖ ${err.message}`);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('  → Check DB_USER / DB_PASSWORD in server/.env');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('  → MySQL/MariaDB is not running. Start it (e.g. XAMPP → MySQL) and retry.');
    }
    process.exitCode = 1;
  }
}

main();
