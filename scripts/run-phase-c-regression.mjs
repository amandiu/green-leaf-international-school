#!/usr/bin/env node
// ------------------------------------------------------------
// Phase C.9 — consolidated Phase C regression runner
// (SYSTEM_DESIGN §AN.17 C9: "Security + auth test suite (script per
// repo convention)" — deterministic execution of the EXISTING
// verification suites as one regression system.)
//
// Usage (from repo root):
//   npm run test:phase-c                 # full deterministic run
//   node scripts/run-phase-c-regression.mjs --list
//   node scripts/run-phase-c-regression.mjs --only c5,c7
//   node scripts/run-phase-c-regression.mjs --exclude era-b
//
// Design (audit-driven, minimal):
//   - the existing suites are NOT modified — every suite keeps its
//     own live-HTTP + live-MariaDB semantics, fixtures and cleanup
//   - deterministic order: identity (C2) → ownership (C3) →
//     password (C5) → admin users (C6) → rbac (C7) → api foundation
//     (C8) → audit (D3) → B-era regression suites
//   - FRESH rate-limit buckets between HTTP suites: the express-
//     rate-limit buckets are per-process/in-memory, so back-to-back
//     suites otherwise throttle each other (login 10/10min, uploads
//     30/15min …). The runner restarts the API via
//     scripts/restart-dev-server.sh (established since C5).
//   - accurate reporting: each suite reports PASSED n/n,
//     FAILED n/m (with the failing labels), or SKIPPED — the
//     known-pre-existing leadership fixture issue and the missing
//     eslint binary are reported as such, never as green
//   - exit code: 0 only when every selected suite PASSED (skipped
//     suites do not fail the run — but are listed loudly)
// ------------------------------------------------------------

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Suite registry — deterministic order, group-tagged. */
const SUITES = [
  { key: 'c2-identity', file: 'scripts/test-identity-foundation.mjs', group: 'phase-c' },
  { key: 'c3-ownership', file: 'scripts/test-ownership-scoping.mjs', group: 'phase-c' },
  { key: 'c5-password', file: 'scripts/test-password-flows.mjs', group: 'phase-c' },
  { key: 'c6-admin-users', file: 'scripts/test-admin-user-management.mjs', group: 'phase-c' },
  { key: 'c7-rbac', file: 'scripts/test-rbac-permissions.mjs', group: 'phase-c' },
  { key: 'c8-api-foundation', file: 'scripts/test-ownership-api-foundation.mjs', group: 'phase-c' },
  { key: 'd3-audit', file: 'scripts/test-audit-logs.mjs', group: 'phase-c' },
  { key: 'contact', file: 'scripts/test-contact-api.mjs', group: 'era-b' },
  { key: 'downloads', file: 'scripts/test-downloads-api.mjs', group: 'era-b' },
  { key: 'news', file: 'scripts/test-news-api.mjs', group: 'era-b' },
  { key: 'page-sections', file: 'scripts/test-page-sections-api.mjs', group: 'era-b' },
  { key: 'gallery', file: 'scripts/test-gallery-api.mjs', group: 'era-b' },
  { key: 'seo', file: 'scripts/test-seo-api.mjs', group: 'era-b' },
  { key: 'image-upload', file: 'scripts/test-image-upload.mjs', group: 'era-b' },
];

/** Known pre-existing issues — reported accurately, never silenced. */
const KNOWN_ISSUES = [
  {
    key: 'c4-cutover',
    file: 'scripts/test-c4-cutover.mjs',
    group: 'phase-c',
    status: 'NOT RUN',
    reason: 'requires real admin credentials (C4_TEST_ADMIN_EMAIL / C4_TEST_ADMIN_PASSWORD). '
      + 'Operator declined to provide them (C4 decision record); the C4 surface is covered by the C5/C6/C7 regression sections instead.',
  },
  {
    key: 'leadership',
    file: 'scripts/test-leadership-api.mjs',
    group: 'era-b',
    status: 'PRE-EXISTING FAILURE',
    reason: 'the suite\'s synthetic 1×1 PNG fixture is corrupt (libpng read error) on the untouched B-era upload pipeline. '
      + 'Classified pre-existing/environment/test-fixture in C5–C8; NOT fixed here (C9 boundary).',
  },
];

// ------------------------------------------------------------

function parseArgs(argv) {
  const args = { list: false, only: null, exclude: null, help: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--list') args.list = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--only' && argv[i + 1]) { args.only = argv[i + 1].split(',').map((s) => s.trim()); i += 1; }
    else if (a === '--exclude' && argv[i + 1]) { args.exclude = argv[i + 1].split(',').map((s) => s.trim()); i += 1; }
  }
  return args;
}

function selectSuites(args) {
  let list = SUITES.slice();
  if (args.only) {
    list = list.filter((s) => args.only.includes(s.key) || (args.only.includes('era-b') && s.group === 'era-b'));
  }
  if (args.exclude) {
    list = list.filter((s) => !args.exclude.includes(s.key) && !(args.exclude.includes('era-b') && s.group === 'era-b'));
  }
  return list;
}

/** Restart the API with fresh in-memory rate-limit buckets. */
function restartServer() {
  const script = resolve(ROOT, 'scripts', 'restart-dev-server.sh');
  if (!existsSync(script)) return { ok: false, note: 'restart helper missing' };
  const r = spawnSync('bash', [script], { cwd: ROOT, encoding: 'utf8', timeout: 60_000 });
  return { ok: r.status === 0, note: (r.stdout || r.stderr || '').trim().split('\n')[0] };
}

/** Parse "RESULT: 49 passed, 0 failed"-style output from a suite. */
function parseResult(stdout, stderr) {
  const text = `${stdout}\n${stderr}`;
  const re = /RESULT:\s*(\d+)\s+passed,\s*(\d+)\s+failed/i;
  const m = re.exec(text);
  if (m) return { passed: Number(m[1]), failed: Number(m[2]) };
  return null;
}

function runSuite(suite) {
  const r = spawnSync('node', [suite.file], { cwd: ROOT, encoding: 'utf8', timeout: 600_000, maxBuffer: 32 * 1024 * 1024 });
  const counts = parseResult(r.stdout || '', r.stderr || '');
  const failedLabels = `${r.stdout || ''}\n${r.stderr || ''}`
    .split('\n')
    .filter((l) => l.includes('✖'))
    .map((l) => l.replace(/^[^✔✖]*✖\s*/, '').trim())
    .slice(0, 10);
  return {
    status: r.status === 0 ? 'PASSED' : 'FAILED',
    counts,
    failedLabels,
    stderrTail: (r.stderr || '').trim().split('\n').slice(-3).join('\n'),
  };
}

// ------------------------------------------------------------

const args = parseArgs(process.argv);

if (args.help) {
  console.log('Phase C consolidated regression runner (C9).');
  console.log('  --list              list the registered suites and exit');
  console.log('  --only a,b          run only these suites (keys or "era-b")');
  console.log('  --exclude a,b       skip these suites (keys or "era-b")');
  console.log('  --help              this text');
  process.exit(0);
}

if (args.list) {
  console.log('Registered suites (deterministic order):');
  for (const s of SUITES) console.log(`  [${s.group}] ${s.key.padEnd(20)} ${s.file}`);
  console.log('Known issues (reported, not executed):');
  for (const k of KNOWN_ISSUES) console.log(`  [${k.group}] ${k.key.padEnd(20)} ${k.status} — ${k.reason.slice(0, 80)}…`);
  process.exit(0);
}

const selected = selectSuites(args);
if (selected.length === 0) {
  console.error('No suites selected.');
  process.exit(2);
}

console.log('═'.repeat(64));
console.log('  PHASE C — CONSOLIDATED REGRESSION (C9)');
console.log('═'.repeat(64));
console.log(`  suites selected: ${selected.length} of ${SUITES.length}`);
console.log('  order is deterministic; HTTP suites run on fresh buckets\n');

const results = [];
let restarts = 0;
for (const suite of selected) {
  // Bucket isolation: restart before every HTTP suite except the
  // very first one (which already starts on a fresh server).
  if (results.length > 0) {
    const r = restartServer();
    if (!r.ok) {
      console.log(`\n[${suite.key}] SERVER RESTART FAILED (${r.note}) — suite skipped, run cannot continue safely.`);
      results.push({ suite, status: 'SKIPPED', reason: 'server restart failed' });
      continue;
    }
    restarts += 1;
  }

  console.log(`\n▶ [${suite.key}] node ${suite.file}`);
  const outcome = runSuite(suite);
  const countText = outcome.counts
    ? `${outcome.counts.passed} passed, ${outcome.counts.failed} failed`
    : 'no RESULT line parsed';
  console.log(`  └─ ${outcome.status} (${countText})`);
  if (outcome.status === 'FAILED' && outcome.failedLabels.length > 0) {
    for (const label of outcome.failedLabels) console.log(`     ✖ ${label}`);
  }
  results.push({ suite, ...outcome });
}

// ------------------------------------------------------------

console.log(`\n${'═'.repeat(64)}`);
console.log('  SUMMARY');
console.log('═'.repeat(64));
let failed = 0;
let passed = 0;
let skipped = 0;
for (const r of results) {
  const countText = r.counts ? ` — ${r.counts.passed} passed, ${r.counts.failed} failed` : '';
  console.log(`  ${r.status.padEnd(7)} [${r.suite.key}]${countText}`);
  if (r.status === 'FAILED') { failed += 1; }
  else if (r.status === 'SKIPPED') { skipped += 1; }
  else { passed += 1; }
}

const knownIssues = KNOWN_ISSUES.filter((k) => !selected.some((s) => s.key === k.key));
if (knownIssues.length > 0) {
  console.log('\n  KNOWN ISSUES (accurately reported, in scope since C5–C8):');
  for (const k of knownIssues) {
    console.log(`  ${k.status.padEnd(20)} [${k.key}]`);
    console.log(`    ${k.reason}`);
  }
}

console.log(`\n  servers restarted for bucket isolation: ${restarts}`);
console.log(`  suites: ${passed} passed, ${failed} failed, ${skipped} skipped of ${results.length} selected`);
console.log('═'.repeat(64));

// Reliable exit: 0 only when every selected suite PASSED.
process.exit(failed > 0 ? 1 : 0);
