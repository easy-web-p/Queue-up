import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // TypeScript sources were previously not linted at all: the block above matches
  // only .js/.jsx, so every .ts/.tsx file — the whole campus feature set, the
  // services and the Redux slices — was skipped entirely.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Staged, not waived. Turning TypeScript linting on surfaced ~50 explicit
      // `any`s; the ones that were hiding real problems are fixed (Firestore
      // timestamps now have a type, which immediately caught a Timestamp being
      // rendered straight into JSX). What remains is mostly `catch (err: any)` and
      // untyped selectors, and the codebase still runs with `strict: false`, so
      // failing the build on them would most likely get this rule deleted instead of
      // the types written. Kept visible as warnings until strict mode lands.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
])
