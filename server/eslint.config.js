// ESLint 9 flat config — Express/Node backend (ESM, "type": "module").
// Replaces the broken setup (ESLint 9 with no config file). Scoped to
// server source + repo scripts; never lints runtime artifacts.
//
// Rules of engagement (MASTER_PLAN §25 / remediation scope):
//   - no rule weakened to hide a real problem
//   - the two LOW-severity stylistic relaxations (unused args, prop-type
//     policy) carry an explicit reason + escape hatch below
//   - anything else failing stays failing until fixed in source

import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    // Hard ignore list — runtime artifacts, build output, uploads, env.
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'src/uploads/**',
      'admin/dist/**',
      '**/*.log',
      '.env*',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
    rules: {
      // ---- Security-relevant correctness rules (keep at error) ----
      // ignoreRestSiblings supports the established safe-projection
      // idiom (`const { status, ...pub } = row` — the rest object is
      // the payload; the omitted keys are deliberately dropped).
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'no-eval': 'error',
      'no-new-func': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'object-shorthand': ['warn', 'properties'],
      'no-var': 'error',

      // Documented, deliberate relaxations (LOW, stylistic only):
      // `no-console` stays off — the established logging convention in
      // this service layer is console.error for server-side faults
      // (SYSTEM_DESIGN §AD); morgan covers HTTP request logging.
      'no-console': 'off',
    },
  },
  {
    // Repo-root verification scripts (node scripts/*.mjs) are plain ESM
    // Node scripts; keep recommended strictness, no extra globals.
    files: ['scripts/**'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
