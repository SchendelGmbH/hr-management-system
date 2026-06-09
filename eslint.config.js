import globals from 'globals';
import path from 'path';
import { fileURLToPath } from 'url';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import nextPlugin from '@next/eslint-plugin-next';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'scripts/**'],
  },
  // JavaScript files
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        console: 'readonly',
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      import: importPlugin,
    },
    rules: {
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: 'readonly',
        JSX: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        AbortController: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Promise: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        Array: 'readonly',
        Object: 'readonly',
        String: 'readonly',
        Number: 'readonly',
        Date: 'readonly',
        JSON: 'readonly',
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      import: importPlugin,
      '@typescript-eslint': tseslint,
      '@next/next': nextPlugin,
    },
    rules: {
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-anonymous-default-export': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-module-boundary-types': 'off',
      '@next/next/no-img-element': 'warn',
    },
  },
];