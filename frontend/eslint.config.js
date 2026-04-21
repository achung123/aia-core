import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import noEquityInPlayer from './eslint-rules/no-equity-in-player.js';

export default [
  // typescript-eslint recommended (flat config)
  ...tsPlugin.configs['flat/recommended'],

  // React + React Hooks for TS/TSX files
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooksPlugin.configs['recommended-latest'].rules,
      'react/react-in-jsx-scope': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // T-032 — layer 3 of the equity gate. Scoped to files that render the
  // player POV; any named import of `fetchEquity`, `useEquityQuery`, or
  // `calculateEquity` trips the rule at lint time.
  {
    files: ['src/pages/TableView.tsx', 'src/player/**/*.{ts,tsx}'],
    plugins: {
      'aia-core': { rules: { 'no-equity-in-player': noEquityInPlayer } },
    },
    rules: {
      'aia-core/no-equity-in-player': 'error',
    },
  },
];
