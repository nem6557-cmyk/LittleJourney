// ESLint flat config (ESLint v9/v10). Replaces the legacy .eslintrc.json.
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier/flat');
const globals = require('globals');

module.exports = tseslint.config(
  {
    // Global ignores (replaces ignorePatterns)
    ignores: [
      'node_modules/',
      'dist/',
      '.expo/',
      'public/',
      'coverage/',
      '**/*.config.js',
      'eslint.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
        __DEV__: 'readonly',
      },
    },
    rules: {
      // Supabase joins, React Native bridge APIs, and Expo modules often surface
      // dynamic payloads. Type-checking still runs in CI; lint should flag
      // actionable production issues without drowning them in adapter casts.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Tests and mocks: relax rules that fire on jest globals / mocking patterns
    files: ['**/__tests__/**', '**/__mocks__/**', '**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
