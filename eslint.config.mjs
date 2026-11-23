import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const RESTRICTED_PROPERTIES = [
  { property: 'innerHTML', message: 'Interdit (T2.5).' },
  { property: 'outerHTML', message: 'Interdit (T2.5).' },
  { property: 'insertAdjacentHTML', message: 'Interdit (T2.5).' },
];
const NETWORK_MESSAGE =
  'Interdit : aucune donnée ne doit quitter le navigateur (promesse du projet).';

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
      'no-restricted-properties': ['error', ...RESTRICTED_PROPERTIES],
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
    // Code livré : ni requête réseau, ni cookie, ni écriture HTML directe.
    files: ['apps/web/src/**/*.ts', 'packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport'].map((name) => ({
          name,
          message: NETWORK_MESSAGE,
        })),
      ],
      'no-restricted-properties': [
        'error',
        ...RESTRICTED_PROPERTIES,
        { object: 'navigator', property: 'sendBeacon', message: NETWORK_MESSAGE },
        { object: 'document', property: 'cookie', message: 'Aucun cookie (promesse du projet).' },
        { object: 'document', property: 'write', message: 'Interdit (T2.5).' },
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
