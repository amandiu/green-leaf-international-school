#!/usr/bin/env node
// ------------------------------------------------------------
// SMTP diagnostic (REAL EMAIL DELIVERY task, §8/§9)
// Run from repo root:  node scripts/diagnose-smtp.mjs
//
// SAFE by design:
//   - prints only configured/missing + non-secret values (host,
//     port, TLS mode, sender when configured — never passwords)
//   - sends NO email: exercises DNS → TCP → TLS → AUTH via
//     nodemailer's transport.verify() using the SAME config as
//     the real send path (mailService.verifySmtpTransport)
//   - never prints SMTP_PASSWORD / App Password / API keys
//
// Exit codes: 0 = transport verified (auth passed), 1 = failure
// (the failing STAGE and raw error code are reported so problems
// like ENOTFOUND / ECONNREFUSED / 535 auth / TLS handshake are
// identifiable — §16 fail-clearly).
// ------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const require = createRequire(pathToFileURL(resolve('server', 'package.json')));

for (const line of readFileSync('server/.env', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const show = (label, value, secret = false) => {
  if (secret) console.log(`${label}: ${value ? 'configured' : 'MISSING'}`);
  else console.log(`${label}: ${value === '' ? 'MISSING' : value}`);
};

console.log('--- Mail configuration (server/.env as loaded by dotenv) ---');
show('NODE_ENV      ', process.env.NODE_ENV || '(unset)');
show('SMTP_HOST     ', process.env.SMTP_HOST || '');
show('SMTP_PORT     ', process.env.SMTP_PORT || '(default 587)');
show('SMTP_SECURE   ', process.env.SMTP_SECURE === 'true' ? 'true (implicit TLS, port 465)' : 'false (STARTTLS, port 587)');
show('SMTP_USER     ', process.env.SMTP_USER || '');
show('SMTP_PASSWORD ', process.env.SMTP_PASSWORD, true);
show('MAIL_FROM     ', process.env.MAIL_FROM || '(falls back to SMTP_USER, then site name)');
show('MAIL_DEV_SHOW_CODE', process.env.MAIL_DEV_SHOW_CODE === 'true' ? 'true (DEV ONLY — code visible in console)' : 'not set');

const { isMailConfigured, verifySmtpTransport } = await import(
  pathToFileURL(resolve('server/src/services/mailService.js'))
);

console.log('\n--- Real email mode ---');
console.log('isMailConfigured():', isMailConfigured());
if (!isMailConfigured()) {
  console.log('\nRESULT: REAL EMAIL DELIVERY IS NOT ACTIVE.');
  console.log('The app is in development-preview mode (SMTP_HOST empty):');
  console.log('password-reset emails are printed to the SERVER CONSOLE, never sent.');
  console.log('\nTo enable real delivery, set in server/.env (Gmail example):');
  console.log('  SMTP_HOST=smtp.gmail.com');
  console.log('  SMTP_PORT=587');
  console.log('  SMTP_SECURE=false');
  console.log('  SMTP_USER=<your real Gmail address>');
  console.log('  SMTP_PASSWORD=<16-char Gmail APP PASSWORD — never the login password>');
  console.log('  MAIL_FROM=<the same Gmail address>');
  console.log('Then restart the server and re-run: node scripts/diagnose-smtp.mjs');
  process.exit(1);
}

console.log('\n--- Transport verification (NO email is sent) ---');
console.log('Stage order: config → dns → connection → tls → auth');
const result = await verifySmtpTransport();
if (result.ok) {
  console.log(`OK — reached stage "${result.stage}"`);
  console.log('DNS resolved, TCP connected, TLS negotiated, AUTH verified.');
  console.log('The SMTP transport is ready for real delivery.');
  process.exit(0);
}
console.log(`FAILED at stage "${result.stage}":`, result.error);
console.log('\nFix hints by stage:');
console.log('  dns         → check SMTP_HOST spelling / network DNS');
console.log('  connection  → ECONNREFUSED/ETIMEDOUT: wrong port, firewall, or provider block');
console.log('  tls         → port/TLS mismatch: 587 + SMTP_SECURE=false, 465 + SMTP_SECURE=true');
console.log('  auth        → 535: wrong SMTP_USER or SMTP_PASSWORD (Gmail needs a 16-char');
console.log('                App Password with 2-Step Verification enabled — NOT the login password)');
process.exit(1);
