// ------------------------------------------------------------
// Password policy (Phase C.5 — shared by ALL password mutations)
//
// The established project policy (identityService + the admin
// creation script): minimum 8 characters, bcrypt cost 12 at the
// hashing call sites. No separate policy is invented for C5 —
// change-password and reset-confirm enforce the SAME rule here
// so the convention cannot drift between flows.
//
// SECURITY: validation errors quote only the length RULE, never
// the submitted value; hashed output never leaves this module.
// ------------------------------------------------------------

import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12; // established project configuration

/**
 * Enforce the established password rule on a candidate value.
 * Returns the trimmed value; throws 400 on violation. The error
 * message quotes the RULE only — never the submitted value.
 */
export function validatePassword(candidate) {
  if (typeof candidate !== 'string' || candidate.trim() === '') {
    throw badRequest('Password is required');
  }
  if (candidate.length < 8) {
    throw badRequest('Password must be at least 8 characters');
  }
  if (candidate.length > 200) {
    throw badRequest('Password must be at most 200 characters');
  }
  return candidate;
}

/** Hash with the established bcrypt configuration (cost 12). */
export async function hashPassword(candidate) {
  return bcrypt.hash(candidate, BCRYPT_ROUNDS);
}

import { badRequest } from '../utils/errors.js';
