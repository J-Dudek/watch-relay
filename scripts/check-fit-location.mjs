#!/usr/bin/env node
// T4.3 : bloque les fichiers de données d'activité (.fit, .tcx, .gpx, .zip) hors de fixtures/.
// Par défaut : fichiers stagés (hook pre-commit). Avec `--all` : tout le dépôt suivi (CI).
import { execFileSync } from 'node:child_process';

const all = process.argv.includes('--all');
const args = all ? ['ls-files'] : ['diff', '--cached', '--name-only', '--diff-filter=AM'];
const files = execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
const bad = files.filter((f) => /\.(fit|tcx|gpx|zip)$/i.test(f) && !f.startsWith('fixtures/'));

if (bad.length > 0) {
  console.error(`✗ Fichiers de données d'activité hors fixtures/ (T4.3) :\n${bad.join('\n')}`);
  process.exit(1);
}
