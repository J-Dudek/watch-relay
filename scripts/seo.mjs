// Fonctions pures du référencement (sitemap, robots, redirections, métadonnées par page).
// Testées dans seo.test.mjs ; utilisées par postbuild-seo.mjs.

export const SITE_NAME = 'Migration Garmin ⇄ COROS';

/** Pages indexables : une vraie URL chacune, servie par un fichier HTML dédié (métadonnées propres). */
export const ROUTES = [
  {
    path: '/',
    file: 'index.html',
    title: 'Migration Garmin ⇄ COROS – transfert d’activités, 100 % local',
    description:
      'Prépare ton historique d’activités Garmin pour COROS, ou l’inverse. Tout se passe dans ton navigateur : aucune donnée n’est envoyée, aucun compte requis.',
  },
  {
    path: '/faq',
    file: 'faq.html',
    title: `FAQ — ${SITE_NAME}`,
    description:
      'Mes données sont-elles envoyées ? Non. Réponses sur la confidentialité, les règles d’import de COROS et Garmin Connect, les limites de taille et l’import depuis un téléphone.',
  },
  {
    path: '/privacy',
    file: 'privacy.html',
    title: `Confidentialité — ${SITE_NAME}`,
    description:
      'Aucune donnée n’est envoyée : traitement 100 % dans ton navigateur, aucun cookie, aucun traceur, aucune ressource tierce.',
  },
  {
    path: '/legal',
    file: 'legal.html',
    title: `Mentions légales — ${SITE_NAME}`,
    description:
      'Éditeur, hébergement, non-affiliation à Garmin et COROS, responsabilité et composants tiers.',
  },
];

/** URL du site : SITE_URL (explicite) sinon `URL` fourni par Netlify. Sans schéma ou invalide → null. */
export function resolveSiteUrl(env) {
  const raw = (env.SITE_URL ?? env.URL ?? '').trim();
  if (!/^https?:\/\/[^\s/]+/i.test(raw)) return null;
  return raw.replace(/\/+$/, '');
}

/** Hors production (aperçus de déploiement, branches), le site ne doit pas être indexé. */
export function isProduction(env) {
  return !env.CONTEXT || env.CONTEXT === 'production';
}

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function absolute(siteUrl, path) {
  return `${siteUrl}${path === '/' ? '/' : path}`;
}

export function buildSitemap(siteUrl, lastmod) {
  const urls = ROUTES.map(
    (r) =>
      `  <url>\n    <loc>${esc(absolute(siteUrl, r.path))}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function buildRobots({ siteUrl, production }) {
  if (!production) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ''}`;
}

/** Netlify (`_redirects`) : chaque route est servie par son fichier, sans changer l'URL (200). */
export function buildRedirects() {
  return (
    ROUTES.filter((r) => r.path !== '/')
      .map((r) => `${r.path}  /${r.file}  200`)
      .join('\n') + '\n'
  );
}

export function jsonLdApplication(siteUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: absolute(siteUrl, '/'),
    description: ROUTES[0].description,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any (navigateur web)',
    browserRequirements: 'Navigateur récent avec JavaScript',
    inLanguage: ['fr', 'en'],
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    image: absolute(siteUrl, '/og-image.png'),
    author: { '@type': 'Person', name: 'J6N', url: 'https://me.byj6n.fr' },
  };
}

/**
 * Déduit la page HTML d'une route à partir de `index.html` : titre, description, canonical,
 * Open Graph / Twitter, JSON-LD (accueil) et contenu `<noscript>` explicite.
 */
export function renderPage(indexHtml, route, { siteUrl, production }) {
  let html = indexHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(route.title)}</title>`);
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    `$1${esc(route.description)}$2`,
  );

  const head = [];
  if (!production) head.push('<meta name="robots" content="noindex, nofollow">');
  if (siteUrl) {
    const url = absolute(siteUrl, route.path);
    head.push(
      `<link rel="canonical" href="${esc(url)}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
      `<meta property="og:locale" content="fr_FR">`,
      `<meta property="og:locale:alternate" content="en_US">`,
      `<meta property="og:title" content="${esc(route.title)}">`,
      `<meta property="og:description" content="${esc(route.description)}">`,
      `<meta property="og:url" content="${esc(url)}">`,
      `<meta property="og:image" content="${esc(absolute(siteUrl, '/og-image.png'))}">`,
      `<meta property="og:image:alt" content="Logo watch-relay">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${esc(route.title)}">`,
      `<meta name="twitter:description" content="${esc(route.description)}">`,
      `<meta name="twitter:image" content="${esc(absolute(siteUrl, '/og-image.png'))}">`,
    );
    if (route.path === '/') {
      // Bloc de données, non exécutable : n'entre pas dans le périmètre de `script-src`.
      const json = JSON.stringify(jsonLdApplication(siteUrl)).replace(/</g, '\\u003c');
      head.push(`<script type="application/ld+json">${json}</script>`);
    }
  }
  if (head.length > 0) html = html.replace('</head>', `    ${head.join('\n    ')}\n  </head>`);

  const links = ROUTES.filter((r) => r.path !== '/')
    .map((r) => `<a href="${r.path}">${esc(r.title.split(' — ')[0] ?? r.title)}</a>`)
    .join(' · ');
  html = html.replace(
    /<noscript>[\s\S]*?<\/noscript>/,
    `<noscript><h1>${esc(SITE_NAME)}</h1><p>${esc(route.description)} Cette application nécessite JavaScript.</p><p>${links}</p></noscript>`,
  );
  return html;
}

export function render404(stylesheet) {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <title>Page introuvable — ${esc(SITE_NAME)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    ${stylesheet ? `<link rel="stylesheet" href="/${esc(stylesheet)}">` : ''}
  </head>
  <body>
    <main class="j6n-container j6n-stack">
      <h1>Page introuvable</h1>
      <p>Cette adresse n’existe pas. <a href="/">Retour à l’outil</a></p>
    </main>
  </body>
</html>
`;
}
