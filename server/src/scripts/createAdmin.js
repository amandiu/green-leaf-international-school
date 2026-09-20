// ------------------------------------------------------------
// One-time (repeatable) admin account creation — AUTH PHASE
//
// Usage:  cd server && npm run admin:create
//
// Interactive prompts for Email / Password / Name, hashes the
// password with bcrypt, and stores ONLY the hash in MySQL
// (admin_users.password_hash). Nothing is logged or committed.
//
// Also supports non-interactive CI-style usage:
//   node src/scripts/createAdmin.js --email a@b.c --password ... --name ...
// (values are consumed immediately, never written to disk)
// ------------------------------------------------------------

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import 'dotenv/config';
import '../config/db.js';
import pool from '../config/db.js';
import { createAdminAccount, adminCount } from '../services/adminAuthService.js';
import { closePool } from '../config/db.js';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  console.log('\nGreen Leaf — create an admin account');
  console.log('  (password is hashed with bcrypt; only the hash is stored)\n');

  let email = arg('email');
  let password = arg('password');
  let name = arg('name');

  const interactive = email === undefined && password === undefined;

  if (interactive) {
    const rl = readline.createInterface({ input, output });
    email = (await rl.question('Email: ')).trim();
    // Masking is not portable in Node without extra deps; the
    // password is never echoed, logged, or persisted anywhere.
    password = await rl.question('Password (min 8 chars): ', );
    name = await rl.question('Name (optional): ');
    rl.close();
  }

  try {
    const existing = await adminCount();
    if (existing > 0) {
      console.log(`  note: ${existing} admin account(s) already exist — this will ADD another.`);
    }

    const user = await createAdminAccount({ email, password, name });
    console.log(`\n✔ Admin account created for ${user.email}${user.name ? ` (${user.name})` : ''}`);
    console.log('  Log in at the Admin Panel with this email + password.');
  } catch (err) {
    console.error(`\n✖ ${err.message || 'Failed to create admin account'}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
