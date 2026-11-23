#!/usr/bin/env node
// Après `ng build` : injecte la CSP en <meta> (filet de sécurité si l'hébergeur ne permet pas
// de poser les en-têtes, T2.9) et génère `_headers` (Netlify) ; `--caddy` ajoute `Caddyfile.snippet`.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HASHED_ASSET, NO_CACHE_PATHS, buildCsp, buildHeaders } from '../security/headers.mjs';

const dist = process.argv[2] ?? 'apps/web/dist/web/browser';
const indexPath = join(dist, 'index.html');
let html = readFileSync(indexPath, 'utf8');

if (/<(style|script)(?![^>]*\bsrc=)[^>]*>/i.test(html)) {
  console.error('✗ index.html contient du <style> ou <script> inline : incompatible avec la CSP.');
  process.exit(1);
}
if (/\son[a-z]+=/i.test(html)) {
  console.error('✗ index.html contient un gestionnaire d’événement inline.');
  process.exit(1);
}

const meta = `<meta http-equiv="Content-Security-Policy" content="${buildCsp({ meta: true })}">`;
if (!html.includes('http-equiv="Content-Security-Policy"')) {
  const next = html.replace(/(<meta charset="utf-8"\s*\/?>)/i, `$1\n    ${meta}`);
  if (next === html) {
    console.error('✗ Impossible d’injecter la CSP : balise <meta charset> introuvable.');
    process.exit(1);
  }
  html = next;
  writeFileSync(indexPath, html);
}

const headers = buildHeaders();
const lines = Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`);
const noCacheBlocks = NO_CACHE_PATHS.map((p) => `${p}\n  Cache-Control: no-cache\n`).join('\n');
// `_headers` ne sait pas cibler les fichiers au hash : ils restent revalidables (sûr) ;
// le Caddyfile, lui, les marque immuables.
writeFileSync(join(dist, '_headers'), `/*\n${lines.join('\n')}\n\n${noCacheBlocks}`);
// Reverse proxy Caddy (hébergement alternatif) : seulement sur demande, pour ne pas publier ce fichier.
if (process.argv.includes('--caddy'))
  writeFileSync(
    join(dist, 'Caddyfile.snippet'),
    `header {\n${Object.entries(headers)
      .map(([k, v]) => `\t${k} "${v}"`)
      .join('\n')}\n}\n\n` +
      `@revalidate path ${NO_CACHE_PATHS.join(' ')}\nheader @revalidate Cache-Control "no-cache"\n\n` +
      `@hashed path_regexp hashed ${HASHED_ASSET.source}\nheader @hashed Cache-Control "public, max-age=31536000, immutable"\n`,
  );
console.log(`✓ CSP injectée (meta) et _headers générés dans ${dist}`);
