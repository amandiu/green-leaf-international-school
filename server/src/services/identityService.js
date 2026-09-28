// ------------------------------------------------------------
// Identity service (Phase C.2 — identity foundation)
//
// Business rules for the canonical identity foundation:
//   - email is normalized (trim + lowercase) by the validator
//   - password hashing uses the ESTABLISHED bcrypt configuration
//     (cost 12, same as adminAuthService) — but C2 has NO login
//     path: users are created ONLY through this service (tests/
//     future admin UI), and the existing admin login keeps
//     reading admin_users until the C4 cutover (§AN.14)
//   - every user gets ≥1 role; exactly ONE primary (swap + insert
//     in ONE transaction — a failed insert must not leave the
//     user role-less or double-primary)
//   - role codes are validated against the seeded catalog; the
//     service re-checks existence/is_active in the DB (the
//     validator whitelist alone cannot see a deactivated catalog)
//   - permission cache: per-process, short TTL (§AN.5)
//   - safe projections only — password_hash never leaves models
// ------------------------------------------------------------

import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import * as userModel from '../models/User.js';
import * as roleModel from '../models/Role.js';
import * as userRoleModel from '../models/UserRole.js';
import * as rolePermissionModel from '../models/RolePermission.js';
import { validateUserPayload, ROLE_CODES, PERMISSION_KEYS } from '../validators/identityValidation.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';

const BCRYPT_ROUNDS = 12; // established project configuration

// ------------------------------------------------------------
// Role catalog (read-only in C2)
// ------------------------------------------------------------

/** All catalog roles. */
export async function listRoles() {
  return roleModel.findAll();
}

/** Resolve one catalog role by code; 404 when missing/inactive. */
export async function requireRoleByCode(code) {
  const role = await roleModel.findByCode(code);
  if (!role || !role.is_active) {
    throw notFound(`Role "${code}" is not available`);
  }
  return role;
}

// ------------------------------------------------------------
// User creation (foundation-level; NO authentication path yet)
// ------------------------------------------------------------

/**
 * Create a user with its role assignments in ONE transaction.
 * Password is REQUIRED (identity rows always carry a credential
 * — callers may pass a random one; portal issuance flows decide
 * their own UX in later phases).
 */
export async function createUser(input, { password } = {}) {
  const clean = validateUserPayload(input);

  if (typeof password !== 'string' || password.length < 8) {
    throw badRequest('Password must be at least 8 characters');
  }

  if (await userModel.emailExists(clean.email)) {
    throw conflict('An account with this email already exists');
  }

  // Resolve every requested role in the catalog FIRST (404-safe:
  // nothing is written unless all roles exist and are active).
  const roleRows = [];
  for (const code of clean.roles) {
    roleRows.push(await requireRoleByCode(code));
  }
  const roleByCode = new Map(roleRows.map((r) => [r.code, r]));
  const primaryRoleId = roleByCode.get(clean.primaryRole).id;

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Re-check uniqueness INSIDE the transaction (two concurrent
    // creations otherwise race past the pre-check; the UNIQUE key
    // backstops anyway → map ER_DUP_ENTRY to a safe 409).
    const dup = await conn.query(
      'SELECT `id` FROM `users` WHERE `email` = ? LIMIT 1',
      [clean.email],
    );
    if (dup[0].length > 0) {
      throw conflict('An account with this email already exists');
    }

    const userId = await insertUserWith(conn, {
      email: clean.email,
      password_hash,
      name: clean.name,
    });

    for (const role of roleRows) {
      await userRoleModel.insertWith(conn, {
        userId,
        roleId: role.id,
        isPrimary: role.id === primaryRoleId,
      });
    }

    await conn.commit();
    return getSafeUser(userId);
  } catch (err) {
    await conn.rollback();
    if (err?.code === 'ER_DUP_ENTRY') {
      throw conflict('An account with this email already exists');
    }
    throw err;
  } finally {
    conn.release();
  }
}

/** Insert inside the caller's transaction (shared by future flows). */
async function insertUserWith(conn, { email, password_hash, name }) {
  const [result] = await conn.query(
    'INSERT INTO `users` (`email`, `password_hash`, `name`, `is_active`) VALUES (?, ?, ?, ?)',
    [email, password_hash, name, 1],
  );
  return result.insertId;
}

/** Safe user projection: user + role codes (primary first). */
export async function getSafeUser(userId) {
  const user = await userModel.findSafeById(userId);
  if (!user) return null;
  // Join assignments → catalog in ONE query (no N+1 lookups);
  // ordered primary-first so roles[0] is the deterministic default.
  const [rows] = await pool.query(
    'SELECT `r`.`code` FROM `user_roles` `ur` JOIN `roles` `r` ON `r`.`id` = `ur`.`role_id`'
      + ' WHERE `ur`.`user_id` = ? ORDER BY `ur`.`is_primary` DESC, `ur`.`id` ASC',
    [userId],
  );
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.is_active,
    roles: rows.map((r) => r.code),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

/**
 * Assign a role to an existing user (foundation-level rule check;
 * used by tests + the C6 admin user-management UI later).
 * Becoming primary is explicit — flipping the existing primary
 * happens in the same transaction as the insert.
 */
export async function assignRole(userId, roleCode, { makePrimary = false } = {}) {
  if (typeof roleCode !== 'string') throw badRequest('role must be a string code');
  const role = await requireRoleByCode(roleCode);

  const user = await userModel.findSafeById(userId);
  if (!user) throw notFound('User not found');

  const existing = await userRoleModel.findByUserAndRole(userId, role.id);
  if (existing) throw conflict(`User already has the "${roleCode}" role`);

  if (makePrimary) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await userRoleModel.clearPrimaryWith(conn, userId);
      await userRoleModel.insertWith(conn, {
        userId,
        roleId: role.id,
        isPrimary: true,
      });
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } else {
    // A user's FIRST role is primary by construction; additional
    // non-primary assignments keep the existing primary.
    const count = await userRoleModel.countByUserId(userId);
    await userRoleModel.insertWith(pool, {
      userId,
      roleId: role.id,
      isPrimary: count === 0,
    });
  }

  return getSafeUser(userId);
}

// ------------------------------------------------------------
// Permission cache (§AN.5 — short TTL, per process)
// C2: read-only support for future requirePermission (C7).
// ------------------------------------------------------------

const CACHE_TTL_MS = 30_000;
const cache = new Map(); // roleId → { keys, at }

/** Permission keys for one role (cached; empty when unmapped). */
export async function getRolePermissions(roleId) {
  const hit = cache.get(roleId);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.keys;
  const keys = await rolePermissionModel.findKeysByRoleId(roleId);
  cache.set(roleId, { keys, at: now });
  return keys;
}

/** Clear the permission cache (future admin flows / tests). */
export function clearPermissionCache() {
  cache.clear();
}

// ------------------------------------------------------------
// Exposed for diagnostics/tests (whitelists live in the validator)
// ------------------------------------------------------------
export { ROLE_CODES, PERMISSION_KEYS };
