// ------------------------------------------------------------
// Phase C.4 — admin_users → users canonical identity copy
// (SYSTEM_DESIGN §AN.14: one-time, NON-DESTRUCTIVE, idempotent,
// with a mandatory 1:1 verification gate BEFORE the auth cutover.)
//
// Usage (from server/):
//   npm run identity:migrate-admins               # copy + verify
//   npm run identity:migrate-admins -- --verify-only   # gate only
//
// What it does
//   For EVERY admin_users row, establish the exact canonical users
//   identity: verbatim email / bcrypt password_hash (NO re-hash,
//   NO plaintext) / name / is_active, created_at PRESERVED for
//   audit continuity, password_changed_at STAMPED with the copy
//   time (§AN.13 — this is what invalidates pre-cutover legacy
//   sessions), plus exactly ONE user_roles row: the seeded `admin`
//   catalog role with is_primary = 1 (§AN.14.2).
//
// What it NEVER does
//   - never UPDATEs or DELETEs admin_users (read-only legacy table)
//   - never UPDATEs or DELETEs users rows (conflicts ABORT — no
//     silent merge, no overwrite)
//   - never stores or logs plaintext passwords
//
// Verification gate (runs after copy, and standalone with
// --verify-only): SOURCE COUNT / TARGET COUNT / MISSING /
// DUPLICATE / CONFLICT / INVALID / EXTRA are reported and the
// process exits non-zero unless the copy is exactly 1:1. The C4
// authentication cutover must not be activated unless this gate
// passes.
// ------------------------------------------------------------

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { closePool } from '../config/db.js';

const VERIFY_ONLY = process.argv.includes('--verify-only');

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

let problems = 0;
function fail(msg) { problems += 1; console.log(`  ✖ ${msg}`); }
function pass(msg) { console.log(`  ✔ ${msg}`); } // eslint-disable-line no-unused-vars -- reserved success-logger for future copy-gate steps

async function main() {
  console.log(`\nGreen Leaf — admin_users → users canonical copy${VERIFY_ONLY ? ' (VERIFY ONLY)' : ''}\n`);

  // ---- Read source + target ------------------------------------
  const [admins] = await pool.query(
    'SELECT `id`, `email`, `password_hash`, `name`, `is_active`, `created_at`'
      + ' FROM `admin_users` ORDER BY `id` ASC',
  );
  const [users] = await pool.query(
    'SELECT `id`, `email`, `password_hash`, `name`, `is_active`, `password_changed_at`, `created_at`'
      + ' FROM `users` ORDER BY `id` ASC',
  );
  const [adminRoleRows] = await pool.query(
    'SELECT `id`, `is_active` FROM `roles` WHERE `code` = ? LIMIT 1',
    ['admin'],
  );

  if (adminRoleRows.length === 0 || adminRoleRows[0].is_active !== 1) {
    fail('the seeded `admin` catalog role is missing/inactive — cannot copy');
    await reportAndExit(admins, users, []);
  }

  // Duplicate emails WITHIN the source (defensive; the unique key
  // makes this impossible, but the gate must not assume).
  const srcEmails = admins.map((a) => String(a.email).toLowerCase());
  const srcDupes = srcEmails.filter((e, i) => srcEmails.indexOf(e) !== i);
  if (srcDupes.length > 0) fail(`duplicate emails inside admin_users: ${srcDupes.join(', ')}`);

  const adminRoleId = adminRoleRows[0].id;
  const userByEmail = new Map(users.map((u) => [String(u.email).toLowerCase(), u]));

  // ---- Per-source-row classification ---------------------------
  const pending = [];   // rows to insert
  const copied = [];    // admin_id → user_id mapping (verified or newly inserted)
  const conflicts = []; // existing users row does NOT match the source identity
  const invalid = [];   // copied rows failing hash/role/password_changed_at checks

  for (const admin of admins) {
    const email = String(admin.email).toLowerCase();
    const existing = userByEmail.get(email);

    if (!existing) {
      if (!BCRYPT_HASH_RE.test(admin.password_hash)) {
        invalid.push(`${email}: source hash is not a valid bcrypt hash`);
        continue;
      }
      pending.push({ admin, email });
      continue;
    }

    // Already present → must match EXACTLY (idempotent rerun) or conflict.
    const mismatch = [];
    if (existing.password_hash !== admin.password_hash) mismatch.push('password_hash differs');
    if (Number(existing.is_active) !== Number(admin.is_active)) mismatch.push('is_active differs');
    const existingName = existing.name === null ? null : String(existing.name);
    const sourceName = admin.name === null ? null : String(admin.name);
    if (existingName !== sourceName) mismatch.push('name differs');
    if (existing.password_changed_at === null) mismatch.push('password_changed_at not stamped');

    let roleProblem = null;
    if (mismatch.length === 0) {
      const [roleRows] = await pool.query(
        'SELECT `is_primary` FROM `user_roles` WHERE `user_id` = ? AND `role_id` = ?',
        [existing.id, adminRoleId],
      );
      if (roleRows.length !== 1 || roleRows[0].is_primary !== 1) {
        roleProblem = 'admin role missing or not exactly-one-primary';
      }
    }
    if (mismatch.length > 0 || roleProblem) {
      conflicts.push(`${email}: ${[...mismatch, roleProblem].filter(Boolean).join('; ')}`);
    } else {
      copied.push({ adminId: admin.id, userId: existing.id, email, preExisting: true });
    }
  }

  // ---- Perform the copy (single transaction; INSERT-only) ------
  if (!VERIFY_ONLY && pending.length > 0) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const { admin, email } of pending) {
        const [result] = await conn.query(
          'INSERT INTO `users` (`email`, `password_hash`, `name`, `is_active`,'
            + ' `password_changed_at`, `created_at`)'
            + ' VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), ?)',
          [String(admin.email), admin.password_hash, admin.name, admin.is_active ? 1 : 0, admin.created_at],
        );
        await conn.query(
          'INSERT INTO `user_roles` (`user_id`, `role_id`, `is_primary`) VALUES (?, ?, 1)',
          [result.insertId, adminRoleId],
        );
        copied.push({ adminId: admin.id, userId: result.insertId, email, preExisting: false });
        console.log(`  + copied admin_users#${admin.id} → users#${result.insertId} (${email})`);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      fail(`copy transaction rolled back: ${err.code || ''} ${err.message}`);
    } finally {
      conn.release();
    }
  } else if (pending.length > 0) {
    console.log(`  (verify-only: ${pending.length} row(s) still uncopied)`);
  }

  await reportAndExit(admins, users, copied, { conflicts, invalid, adminRoleId });
}

/**
 * Mandatory 1:1 verification gate. Re-reads BOTH tables fresh and
 * asserts every source row exists canonically with the SAME hash,
 * active flag, stamped password_changed_at and exactly-one primary
 * admin role. Reports MISSING / DUPLICATE / CONFLICT / INVALID /
 * EXTRA and exits non-zero unless everything verifies.
 */
async function reportAndExit(admins, users, copied, ctx = {}) {
  console.log('\n1:1 VERIFICATION GATE');

  // Fresh reads — never trust in-memory state for the gate.
  const [freshAdmins] = await pool.query(
    'SELECT `id`, `email`, `password_hash`, `name`, `is_active` FROM `admin_users` ORDER BY `id` ASC',
  );
  const [freshUsers] = await pool.query(
    'SELECT `id`, `email`, `password_hash`, `is_active`, `password_changed_at` FROM `users` ORDER BY `id` ASC',
  );

  const missing = [];
  const duplicates = [];
  const conflicts = ctx.conflicts ?? [];
  const invalid = [...(ctx.invalid ?? [])];
  const userByEmail = new Map();
  for (const u of freshUsers) {
    const key = String(u.email).toLowerCase();
    if (userByEmail.has(key)) duplicates.push(`${key}: users#${userByEmail.get(key).id} and users#${u.id}`);
    else userByEmail.set(key, u);
  }

  for (const admin of freshAdmins) {
    const email = String(admin.email).toLowerCase();
    const user = userByEmail.get(email);
    if (!user) { missing.push(`${email} (admin_users#${admin.id})`); continue; }

    if (user.password_hash !== admin.password_hash) invalid.push(`${email}: password_hash does not match the source`);
    if (Number(user.is_active) !== Number(admin.is_active)) invalid.push(`${email}: is_active does not match the source`);
    if (user.password_changed_at === null) invalid.push(`${email}: password_changed_at is not stamped`);
    if (!BCRYPT_HASH_RE.test(user.password_hash)) invalid.push(`${email}: stored hash is not a valid bcrypt hash`);
  }

  // Mechanical bcrypt compatibility: a WRONG password must FAIL
  // against every copied hash (proves bcrypt can process the stored
  // hash — no plaintext is known or needed; hashes are verbatim).
  for (const admin of freshAdmins) {
    const user = userByEmail.get(String(admin.email).toLowerCase());
    if (!user) continue;
    const wrongAccepted = await bcrypt.compare(
      `definitely-not-the-password-${admin.id}`, user.password_hash,
    );
    if (wrongAccepted) invalid.push(`${admin.email}: bcrypt accepted a wrong password against the copied hash`);
  }

  // Role mapping: exactly one primary admin role per copied user.
  const adminRoleId = ctx.adminRoleId;
  if (adminRoleId) {
    for (const admin of freshAdmins) {
      const user = userByEmail.get(String(admin.email).toLowerCase());
      if (!user) continue;
      const [roleRows] = await pool.query(
        'SELECT `is_primary` FROM `user_roles` WHERE `user_id` = ? AND `role_id` = ?',
        [user.id, adminRoleId],
      );
      if (roleRows.length !== 1 || Number(roleRows[0].is_primary) !== 1) {
        invalid.push(`${admin.email}: admin role must exist exactly once with is_primary=1`);
      }
    }
  }

  // Orphan junction rows (FKs make this impossible; verify anyway).
  const [orphans] = await pool.query(
    'SELECT COUNT(*) AS n FROM `user_roles` `ur`'
      + ' LEFT JOIN `users` `u` ON `u`.`id` = `ur`.`user_id`'
      + ' LEFT JOIN `roles` `r` ON `r`.`id` = `ur`.`role_id`'
      + ' WHERE `u`.`id` IS NULL OR `r`.`id` IS NULL',
  );
  if (orphans[0].n !== 0) invalid.push(`${orphans[0].n} orphan user_roles row(s)`);

  // Canonical admins that are NOT in admin_users (post-cutover
  // admin:create accounts) — audited, not an error: the gate proves
  // admin_users ⊆ canonical admins, never the reverse.
  const [extraRows] = await pool.query(
    'SELECT COUNT(*) AS n FROM `users` `u`'
      + ' JOIN `user_roles` `ur` ON `ur`.`user_id` = `u`.`id`'
      + ' JOIN `roles` `r` ON `r`.`id` = `ur`.`role_id` AND `r`.`code` = "admin"'
      + ' WHERE LOWER(`u`.`email`) NOT IN (SELECT LOWER(`email`) FROM `admin_users`)',
  );

  const verified = missing.length === 0 && duplicates.length === 0
    && conflicts.length === 0 && invalid.length === 0 && problems === 0;

  console.log(`  SOURCE COUNT : ${freshAdmins.length} (admin_users — never modified)`);
  console.log(`  TARGET COUNT : ${freshUsers.length} (users)`);
  console.log(`  MAPPED 1:1   : ${copied.length} of ${freshAdmins.length}`);
  console.log(`  MISSING      : ${missing.length}${missing.length ? ` → ${missing.join('; ')}` : ''}`);
  console.log(`  DUPLICATE    : ${duplicates.length}${duplicates.length ? ` → ${duplicates.join('; ')}` : ''}`);
  console.log(`  CONFLICT     : ${conflicts.length}${conflicts.length ? ` → ${conflicts.join('; ')}` : ''}`);
  console.log(`  INVALID      : ${invalid.length}${invalid.length ? ` → ${invalid.join('; ')}` : ''}`);
  console.log(`  EXTRA CANON. : ${extraRows[0].n} (canonical admins beyond admin_users — post-cutover creations)`);
  for (const m of copied) {
    console.log(`  map: admin_users#${m.adminId} → users#${m.userId} (${m.email})${m.preExisting ? ' [already copied]' : ''}`);
  }
  console.log(`  VERIFIED     : ${verified ? 'YES' : 'NO'}`);
  console.log(
    verified
      ? '\n✔ Gate PASSED — the C4 authentication cutover may proceed.'
      : '\n✖ Gate FAILED — DO NOT activate users-based authentication.',
  );

  await closePool();
  process.exit(verified ? 0 : 1);
}

main().catch(async (err) => {
  console.error(`\n✖ migration script error: ${err.message}`);
  await closePool();
  process.exit(1);
});
