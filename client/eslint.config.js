// ESLint 9 flat config — public React 18 + Vite SPA.
// The lint script exists but ESLint was never installed locally; this
// config + local devDeps make `npm run lint` work per the remediation.
//
// Scope: client source + Vite config files. Never lints build output,
// node_modules, uploads, logs or env files (see ignore block).

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'src/uploads/**',
      '**/*.log',
      '.env*',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2024,
        process: 'readonly',
      },
      // eslint-plugin-react's JSX variable-usage marks JSX identifiers as
      // real references — without it, core ESLint reports every JSX-used
      // import (React, Link, …) as unused (parser-only JSX support).
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // JSX variable usage + React-in-JSX convention (no-undef for JSX
      // members comes from these; core ESLint does not do JSX scoping).
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',

      // Correctness rules kept at error — do not weaken to go green.
      // ignoreRestSiblings supports the established destructure-and-
      // forward idiom used across the SPA components.
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        args: 'after-used',
        ignoreRestSiblings: true,
      }],
      'no-eval': 'error',
      'no-new-func': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-undef': 'error',

      // React 18 hook correctness.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Vite/Tailwind/PostCSS config files run in the Node config context.
    files: ['vite.config.js', 'postcss.config.js', 'tailwind.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
