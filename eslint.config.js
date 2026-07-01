// ESLint flat config minimale. Obiettivo: prendere i bug che rompono un job
// schedulato non presidiato (no-undef, variabili/impostazioni inutilizzate,
// codice irraggiungibile) senza pesantezza. Solo i .mjs eseguibili; i .ts
// (config Checkly) li valida Checkly stesso.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', '**/*.ts'] },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
