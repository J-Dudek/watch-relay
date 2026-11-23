import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '.idea/**',
      '**/.angular/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '.lighthouseci/**',
      'lighthouserc*.cjs', // configuration CommonJS imposée par lhci, non typée
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: { allowDefaultProject: ['*.mjs', 'scripts/*.mjs'] } },
    },
    rules: {
      // T2.5 : aucune donnée de fichier injectée en HTML brut
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Interdit (T2.5).' },
        { property: 'outerHTML', message: 'Interdit (T2.5).' },
        { property: 'insertAdjacentHTML', message: 'Interdit (T2.5).' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Identifier[name=/^bypassSecurityTrust/]',
          message: 'Interdit (T2.5).',
        },
      ],
    },
  },
  {
    files: ['apps/web/e2e/**/*.ts', 'apps/web/playwright.config.ts'],
    languageOptions: {
      parserOptions: { projectService: false, project: './apps/web/tsconfig.e2e.json' },
    },
  },
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node, parserOptions: { projectService: false } },
  },
);
