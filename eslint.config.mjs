import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['node_modules/**', '**/node_modules/**', '**/dist/**', '**/ios/**', '**/android/**', '**/.expo/**', 'HealthLoop_Codex_Kit/**', 'supabase/functions/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', fetch: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', AbortController: 'readonly', Headers: 'readonly', Response: 'readonly', Request: 'readonly', __dirname: 'readonly', module: 'readonly', require: 'readonly' } }, rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
  { files: ['apps/mobile/plugins/*.js'], rules: { '@typescript-eslint/no-require-imports': 'off' } }
);
