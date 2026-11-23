#!/usr/bin/env node
// T4.3 : bloque les .fit stagés hors de fixtures/.
import { execFileSync } from 'node:child_process';

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=AM'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);
const bad = staged.filter((f) => /\.fit$/i.test(f) && !f.startsWith('fixtures/'));

if (bad.length > 0) {
  console.error(`✗ Fichiers .fit hors fixtures/ (T4.3) :\n${bad.join('\n')}`);
  process.exit(1);
}
