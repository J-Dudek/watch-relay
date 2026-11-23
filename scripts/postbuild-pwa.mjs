#!/usr/bin/env node
// Après le post-build de sécurité : génère `sw.js` (service worker) avec la liste exacte des
// fichiers du build à précacher. La version est le hash de leur contenu : un nouveau build = un
// nouveau cache. Aucune dépendance, aucune requête réseau externe.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = process.argv[2] ?? 'apps/web/dist/web/browser';
const EXCLUDED = new Set(['sw.js', '_headers', 'Caddyfile.snippet']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(dist)
  .map((p) => relative(dist, p).split(sep).join('/'))
  .filter((p) => !EXCLUDED.has(p))
  .sort();

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);

const sw = `// Généré par scripts/postbuild-pwa.mjs — ne pas modifier.
const CACHE = 'watch-relay-${version}';
const PRECACHE = ${JSON.stringify(['./', ...files], null, 2)};

self.addEventListener('install', (event) => {
  // Pas de skipWaiting : la nouvelle version s'active quand tous les onglets sont fermés,
  // pour ne jamais mélanger des fichiers de deux builds pendant un traitement.
  // cache: 'reload' contourne le cache HTTP : on ne précache jamais un fichier périmé.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('watch-relay-') && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit =
        (await cache.match(request, { ignoreSearch: true })) ??
        (request.mode === 'navigate' ? await cache.match('./') : undefined);
      return hit ?? fetch(request);
    }),
  );
});
`;
writeFileSync(join(dist, 'sw.js'), sw);
console.log(`✓ sw.js généré (${files.length} fichiers, version ${version})`);
