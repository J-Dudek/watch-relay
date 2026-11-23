#!/usr/bin/env node
// Serveur statique de prévisualisation du build de production, avec les en-têtes de sécurité.
// Sert à tester ce qui sera réellement livré (e2e, audit local). Aucune dépendance.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { buildHeaders, cacheControlFor } from '../security/headers.mjs';
import { ROUTES } from './seo.mjs';

const root = resolve(process.argv[2] ?? 'apps/web/dist/web/browser');
const port = Number(process.env.PORT ?? 4300);
// `upgrade-insecure-requests` casserait le test en http local ; il reste dans les vrais en-têtes.
const headers = buildHeaders({ upgradeInsecure: false });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { ...headers, 'Content-Type': 'text/plain' }).end('Bad request');
    return;
  }
  // Pages de l'app (/faq…) : servies par leur fichier HTML sans changer l'URL (comme `_redirects`).
  const route = ROUTES.find((r) => r.path === pathname.replace(/(?<=.)\/+$/, ''));
  let file = normalize(join(root, route ? route.file : pathname));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    const notFound = join(root, '404.html');
    res.writeHead(404, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
    if (existsSync(notFound)) createReadStream(notFound).pipe(res);
    else res.end('Not found');
    return;
  }
  res.writeHead(200, {
    ...headers,
    'Cache-Control': cacheControlFor(route ? route.path : pathname === '' ? '/' : pathname),
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(res);
})
  .on('error', (err) => {
    console.error('Erreur du serveur :', err.message);
    process.exitCode = 1;
  })
  .listen(port, () => {
    console.log(`Prévisualisation : http://localhost:${String(port)} (${root})`);
  });
