// ------------------------------------------------------------
// PHASE 5C — safe runtime SMTP configuration diagnostic
// Run from repo root: node server/scripts/phase5c-smtp-diag.mjs
//
// SAFE BY DESIGN:
//   - prints only configured/missing + non-secret values
//   - masks any email address (a***@gmail.com)
//   - NEVER prints SMTP_PASSWORD / App Password / OAuth token
//   - does NOT send any email
// ------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const require = createRequire(pathToFileURL(resolve('server', 'package.json')));

// --- load server/.env into the process (dotenv-style) -----------------
for (const line of readFileSync('server/.env', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const maskEmail = (v) => {
  if (!v) return 'UNSET';
  const at = v.indexOf('@');
  if (at <= 1) return v.slice(0, 2) + '***@' + v.slice(at + 1);
  return v.slice(0, 1) + '***@' + v.slice(at + 1);
};

console.log('--- PHASE 5C SAFE CONFIGURATION (server/.env values, no secrets) ---');
console.log('NODE_ENV                 :', process.env.NODE_ENV || '(unset)');
console.log('SMTP_HOST                :', process.env.SMTP_HOST || 'MISSING');
console.log('SMTP_PORT                :', process.env.SMTP_PORT || '(default 587)');
console.log('SMTP_SECURE              :', process.env.SMTP_SECURE === 'true' ? 'true (implicit TLS, 465)' : 'false (STARTTLS, 587)');
console.log('SMTP_USER                :', maskEmail(process.env.SMTP_USER || ''));
console.log('SMTP_PASSWORD            :', process.env.SMTP_PASSWORD ? 'CONFIGURED' : 'MISSING');
console.log('MAIL_FROM                :', maskEmail(process.env.MAIL_FROM || ''));
console.log('MAIL_DEV_SHOW_CODE       :', process.env.MAIL_DEV_SHOW_CODE === 'true' ? 'true (dev only — code visible in console)' : 'not set');

// --- build the SAME transport the app would build -------------------
const { createTransport } = await import('nodemailer');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const auth = SMTP_USER !== '' ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined;

const t = createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth,
});

console.log('\n--- TRANSPORTER STATE (what the real send path uses) ---');
console.log('auth present             :', auth ? 'YES' : 'NO');
console.log('auth.user configured     :', Boolean(auth && auth.user));
console.log('auth.pass configured     :', Boolean(auth && auth.pass));
console.log('host                     :', t.host);
console.log('port                     :', t.port);
console.log('secure                   :', t.secure);

console.log('\n--- transporter.verify() (NO email sent) ---');
try {
  await t.verify();
  console.log('RESULT: PASSED — DNS, TCP, TLS/STARTTLS, and name resolution OK.');
  console.log('  NOTE: verify() does NOT send AUTH LOGIN / MAIL FROM; it proves');
  console.log('  the session can be established, not that a message is accepted.');
} catch (err) {
  console.log('RESULT: FAILED —', err.code || err.message);
  process.exitCode = 1;
}

// --- simulate a real send with a throwaway subject (NO recipient) ----
console.log('\n--- ONE THROWAWAY SEND (no password, no recipient) ---');
try {
  const info = await t.sendMail({
    from: process.env.MAIL_FROM || SMTP_USER || 'test@greenleaf.local',
    to: 'example-receiver@greenleaf.local',
    subject: '[Phase 5C diagnostic] does real SMTP accept a message here',
    text: 'This is a diagnostic message only. No credentials or data are included.',
  });
  console.log('RESULT: ACCEPTED by provider');
  console.log('  messageId   :', info.messageId);
  console.log('  accepted    :', (info.accepted || []).join(','));
  console.log('  rejected    :', (info.rejected || []).join(',') || 'none');
  console.log('  response    :', info.response || '(raw provider response not parsed)');
} catch (err) {
  // redact auth material for the log
  const redacted = String(err.message || err).replace(/[\s\S]*?(?:[\w-]{20,})(?:[A-Za-z0-9+/=]{20,})[\s\S]*?/g, '[auth-material-redacted]');
  console.log('RESULT: REJECTED');
  console.log('  code        :', err.code || '(none)');
  console.log('  response    :', err.response ? String(err.response).slice(0, 200) : '(none)');
  console.log('  message     :', redacted);
  process.exitCode = 1;
}
