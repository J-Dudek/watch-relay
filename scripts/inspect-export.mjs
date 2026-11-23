#!/usr/bin/env node
// Passe un VRAI export (Garmin ou COROS) dans le moteur, sous Node, et affiche un rapport anonyme :
// aucun nom de fichier ni donnée d'activité n'est affiché, uniquement des comptes, des tailles et des
// durées. Rien n'est envoyé ailleurs. Usage :
//   npm run inspect:export -- chemin/export.zip [--target coros|garmin] [--out dossier]
// --out écrit les ZIP générés sur disque, pour les importer à la main dans COROS / Garmin Connect (T0.3).
import { createWriteStream, mkdirSync, openAsBlob, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const input = args.find(
  (a, i) => !a.startsWith('--') && !['--target', '--out'].includes(args[i - 1]),
);
const target = flag('--target') ?? 'coros';
const outDir = flag('--out');

if (!input || !['coros', 'garmin'].includes(target)) {
  console.error(
    'Usage : npm run inspect:export -- export.zip [--target coros|garmin] [--out dossier]',
  );
  process.exit(2);
}

// Le moteur est du TypeScript : on le compile à la volée dans un dossier temporaire.
const bundle = join(tmpdir(), `watch-relay-engine-${String(process.pid)}.mjs`);
await build({
  entryPoints: [resolve('packages/engine/src/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundle,
  logLevel: 'silent',
});
const engine = await import(pathToFileURL(bundle).href);
rmSync(bundle, { force: true });

const file = await openAsBlob(resolve(input), { type: 'application/zip' });
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} Mo`;

/** Écrit sur disque si --out, sinon en mémoire. */
function makeSink() {
  if (!outDir) return engine.createMemorySink();
  mkdirSync(outDir, { recursive: true });
  return {
    open(name) {
      const path = join(resolve(outDir), name);
      const stream = createWriteStream(path);
      return Promise.resolve({
        writable: Writable.toWeb(stream),
        close: () => openAsBlob(path),
        discard: () => {
          rmSync(path, { force: true });
          return Promise.resolve();
        },
      });
    },
  };
}

let peakRss = 0;
const timer = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 100);
let lastLine = '';
const started = performance.now();

try {
  const { report, archives } = await engine.processArchive(file, makeSink(), {
    target,
    onProgress: (p) => {
      const line = `${p.phase} : ${String(p.processed)} fichier(s), ${mb(p.bytesRead)} lus`;
      if (line !== lastLine && process.stderr.isTTY) process.stderr.write(`\r${line}   `);
      lastLine = line;
    },
  });
  const seconds = (performance.now() - started) / 1000;
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  if (process.stderr.isTTY) process.stderr.write('\n');

  const sorted = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  const notes = {};
  for (const i of report.ignored) notes[i.note ?? 'ignoré'] = (notes[i.note ?? 'ignoré'] ?? 0) + 1;
  const total = report.kept + report.rejected.length;

  console.log(`\nExport : ${mb(statSync(resolve(input)).size)}  →  destination : ${target}`);
  console.log(`Durée : ${seconds.toFixed(1)} s   Pic mémoire (RSS) : ${mb(peakRss)}`);
  console.log(`\nActivités détectées : ${String(total)}   retenues : ${String(report.kept)}`);
  console.log('Écartées par motif :', JSON.stringify(report.rejectedByReason));
  console.log('Fichiers ignorés (non-activité, par catégorie) :', JSON.stringify(notes));
  console.log(`Données de santé reconnues (non transférées) : ${String(report.health)}`);
  console.log('Par sport :', JSON.stringify(Object.fromEntries(sorted(report.bySport))));
  console.log('Par année :', JSON.stringify(report.byYear));
  console.log('\nArchives générées :');
  for (const a of archives) {
    console.log(`  ${a.name}  ${String(a.fileCount)} activités  ${mb(a.blob.size)}`);
  }
  if (outDir)
    console.log(`\nÉcrites dans ${resolve(outDir)} — à importer à la main pour valider (T0.3).`);
} catch (e) {
  console.error(
    `\n✗ ${e?.name ?? 'Erreur'} : ${e?.message ?? e} ${e?.code ? `(code ${e.code})` : ''}`,
  );
  process.exitCode = 1;
} finally {
  clearInterval(timer);
}
