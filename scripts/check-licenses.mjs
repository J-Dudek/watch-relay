// T2.17 : vérifie les licences des dépendances runtime (prod) — échoue sur une licence hors liste.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = /^(MIT|ISC|BSD-[23]-Clause|Apache-2\.0|0BSD|BlueOak-1\.0\.0|Python-2\.0|CC0-1\.0)$/;
// Licences ajoutées explicitement après examen (nom@version -> raison).
const EXCEPTIONS = {
  '@garmin/fitsdk':
    'Flexible and Interoperable Data Transfer (FIT) Protocol License — SDK officiel Garmin',
};

const tree = JSON.parse(
  execFileSync('npm', ['ls', '--omit=dev', '--all', '--json', '--long'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
);

const seen = new Map();
(function walk(deps) {
  for (const [name, node] of Object.entries(deps ?? {})) {
    if (name.startsWith('@watch-relay/')) {
      walk(node.dependencies);
      continue; // workspace local
    }
    if (node.path) {
      const pkg = JSON.parse(readFileSync(join(node.path, 'package.json'), 'utf8'));
      const lic = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'INCONNUE');
      seen.set(`${name}@${node.version}`, lic);
    }
    walk(node.dependencies);
  }
})(tree.dependencies);

let bad = 0;
for (const [id, lic] of [...seen].sort()) {
  const name = id.slice(0, id.lastIndexOf('@'));
  const ok = ALLOWED.test(lic) || name in EXCEPTIONS;
  if (!ok) bad++;
  console.log(
    `${ok ? '✓' : '✗'} ${id.padEnd(40)} ${lic}${name in EXCEPTIONS ? ' (exception documentée)' : ''}`,
  );
}
if (bad > 0) {
  console.error(`\n${bad} dépendance(s) avec une licence non autorisée.`);
  process.exit(1);
}
