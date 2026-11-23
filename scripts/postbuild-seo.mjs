#!/usr/bin/env node
// Après le post-build de sécurité : pages HTML par route (métadonnées propres), sitemap.xml,
// robots.txt, _redirects Netlify, 404.html, noindex hors production, Canonical de security.txt.
// URL du site : SITE_URL, sinon `URL` fourni par Netlify. Sans URL, pas de sitemap ni de canonical
// (une URL absolue est obligatoire) : le build le signale et continue.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROUTES,
  buildRedirects,
  buildRobots,
  buildSitemap,
  isProduction,
  render404,
  renderPage,
  resolveSiteUrl,
} from './seo.mjs';

const dist = process.argv[2] ?? 'apps/web/dist/web/browser';
const siteUrl = resolveSiteUrl(process.env);
const production = isProduction(process.env);

const indexPath = join(dist, 'index.html');
const indexHtml = readFileSync(indexPath, 'utf8');
for (const route of ROUTES) {
  writeFileSync(join(dist, route.file), renderPage(indexHtml, route, { siteUrl, production }));
}

writeFileSync(join(dist, 'robots.txt'), buildRobots({ siteUrl, production }));
writeFileSync(join(dist, '_redirects'), buildRedirects());
writeFileSync(
  join(dist, '404.html'),
  render404(readdirSync(dist).find((f) => /^styles-.*\.css$/.test(f))),
);

if (!production)
  appendFileSync(join(dist, '_headers'), '\n/*\n  X-Robots-Tag: noindex, nofollow\n');

let lastmod = new Date().toISOString().slice(0, 10);
try {
  lastmod = execFileSync('git', ['log', '-1', '--format=%cI'], { encoding: 'utf8' }).slice(0, 10);
} catch {
  /* pas de dépôt git (archive) : date du build */
}

if (siteUrl && production) {
  writeFileSync(join(dist, 'sitemap.xml'), buildSitemap(siteUrl, lastmod));
  const sec = join(dist, '.well-known/security.txt');
  // Lecture directe (pas de vérification d'existence préalable : course entre le test et l'usage).
  try {
    if (!readFileSync(sec, 'utf8').includes('Canonical:')) {
      appendFileSync(sec, `Canonical: ${siteUrl}/.well-known/security.txt\n`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  console.log(`✓ SEO : ${String(ROUTES.length)} pages, sitemap.xml, robots.txt (${siteUrl})`);
} else if (!siteUrl) {
  console.warn(
    '⚠ SEO : SITE_URL (ou URL Netlify) absent : pas de sitemap.xml ni de canonical (URL absolue requise).',
  );
} else {
  console.log('✓ SEO : contexte hors production, site marqué noindex (pas de sitemap)');
}
