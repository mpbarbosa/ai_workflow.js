import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '.workflow_core/**',
      '.workflow_fspec/**',
      'docs/api/html/**',
      'coverage/**',
      'node_modules/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    files: ['test/**/*.test.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
