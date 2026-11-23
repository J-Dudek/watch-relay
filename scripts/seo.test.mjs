import assert from 'node:assert/strict';
import { test } from 'node:test';
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

const INDEX = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>x</title><meta name="description" content="y"></head><body><app-root></app-root><noscript>js</noscript></body></html>`;

test('resolveSiteUrl : SITE_URL prioritaire, URL Netlify en repli, valeurs invalides ignorées', () => {
  assert.equal(resolveSiteUrl({ SITE_URL: 'https://a.fr/', URL: 'https://b.fr' }), 'https://a.fr');
  assert.equal(resolveSiteUrl({ URL: 'https://b.fr' }), 'https://b.fr');
  assert.equal(resolveSiteUrl({ SITE_URL: 'a.fr' }), null);
  assert.equal(resolveSiteUrl({ SITE_URL: 'javascript:alert(1)' }), null);
  assert.equal(resolveSiteUrl({}), null);
});

test('isProduction : seuls les contextes Netlify autres que production sont exclus', () => {
  assert.equal(isProduction({}), true);
  assert.equal(isProduction({ CONTEXT: 'production' }), true);
  assert.equal(isProduction({ CONTEXT: 'deploy-preview' }), false);
  assert.equal(isProduction({ CONTEXT: 'branch-deploy' }), false);
});

test('sitemap : une URL absolue par page, lastmod, XML bien formé', () => {
  const xml = buildSitemap('https://x.fr', '2026-11-23');
  for (const r of ROUTES) assert.ok(xml.includes(`<loc>https://x.fr${r.path}</loc>`), r.path);
  assert.equal((xml.match(/<url>/g) ?? []).length, ROUTES.length);
  assert.ok(xml.includes('<lastmod>2026-11-23</lastmod>'));
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
});

test('robots : production autorise et cite le sitemap ; hors production interdit tout', () => {
  assert.match(
    buildRobots({ siteUrl: 'https://x.fr', production: true }),
    /Sitemap: https:\/\/x\.fr\/sitemap\.xml/,
  );
  assert.doesNotMatch(buildRobots({ siteUrl: null, production: true }), /Sitemap/);
  assert.match(buildRobots({ siteUrl: 'https://x.fr', production: false }), /Disallow: \//);
});

test('redirections : une règle 200 par page, pas pour l’accueil', () => {
  const r = buildRedirects();
  assert.match(r, /^\/faq {2}\/faq\.html {2}200$/m);
  assert.doesNotMatch(r, /index\.html/);
});

test('renderPage : titre, description, canonical, OG et JSON-LD (accueil seulement)', () => {
  const opts = { siteUrl: 'https://x.fr', production: true };
  const home = renderPage(INDEX, ROUTES[0], opts);
  assert.ok(home.includes(`<title>${ROUTES[0].title.replace(/&/g, '&amp;')}</title>`));
  assert.ok(home.includes('<link rel="canonical" href="https://x.fr/">'));
  assert.ok(home.includes('property="og:image" content="https://x.fr/og-image.png"'));
  assert.ok(home.includes('application/ld+json'));
  const faq = renderPage(INDEX, ROUTES[1], opts);
  assert.ok(faq.includes('<link rel="canonical" href="https://x.fr/faq">'));
  assert.ok(!faq.includes('application/ld+json'));
  assert.ok(faq.includes('<noscript><h1>'));
});

test('renderPage : sans URL, ni canonical ni OG ; hors production, noindex', () => {
  const none = renderPage(INDEX, ROUTES[0], { siteUrl: null, production: true });
  assert.ok(!none.includes('canonical') && !none.includes('og:'));
  const preview = renderPage(INDEX, ROUTES[0], { siteUrl: 'https://x.fr', production: false });
  assert.ok(preview.includes('name="robots" content="noindex, nofollow"'));
});

test('renderPage : le JSON-LD n’ouvre jamais de balise (échappement de <)', () => {
  const html = renderPage(INDEX, ROUTES[0], { siteUrl: 'https://x.fr', production: true });
  const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
  assert.ok(!block.includes('<'));
  assert.doesNotThrow(() => JSON.parse(block));
});

test('404 : noindex et lien de retour', () => {
  const html = render404('styles-ABC.css');
  assert.ok(
    html.includes('noindex') && html.includes('href="/"') && html.includes('/styles-ABC.css'),
  );
});
