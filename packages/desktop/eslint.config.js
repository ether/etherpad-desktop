// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: ['out/**', 'dist/**', 'release/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: { react: { version: '19' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Derived local-edit state from a store prop is a legitimate pattern;
      // downgrade to warn rather than error until we refactor to key-based reset.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  prettier,
];
