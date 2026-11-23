#!/usr/bin/env node
// Après `ng build` : injecte la CSP en <meta> (filet de sécurité si l'hébergeur ne permet pas
// de poser les en-têtes, T2.9) et génère `_headers` et `Caddyfile.snippet` pour les poser en vrai.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCsp, buildHeaders } from '../security/headers.mjs';

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
writeFileSync(join(dist, '_headers'), `/*\n${lines.join('\n')}\n`);
writeFileSync(
  join(dist, 'Caddyfile.snippet'),
  `header {\n${Object.entries(headers)
    .map(([k, v]) => `\t${k} "${v}"`)
    .join('\n')}\n}\n`,
);
console.log(`✓ CSP injectée (meta), _headers et Caddyfile.snippet générés dans ${dist}`);
