import { expect, test } from '@playwright/test';

// Le build des tests est produit avec SITE_URL=https://watch-relay.example (cf. playwright.config.ts).
const SITE = 'https://watch-relay.example';
const PAGES = [
  { path: '/', title: /Migration Garmin ⇄ COROS/ },
  { path: '/faq', title: /^FAQ — / },
  { path: '/privacy', title: /^Confidentialité — / },
  { path: '/legal', title: /^Mentions légales — / },
];

test('chaque page a une vraie URL, un titre, une description et un canonical propres', async ({
  request,
}) => {
  const titles = new Set<string>();
  for (const p of PAGES) {
    const res = await request.get(p.path);
    expect(res.status(), p.path).toBe(200);
    const html = await res.text();
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
    expect(title, p.path).toMatch(p.title);
    titles.add(title);
    expect(html).toContain(`<link rel="canonical" href="${SITE}${p.path}">`);
    expect(html).toMatch(/<meta name="description" content="[^"]{50,200}"/);
    expect(html).toContain(`property="og:url" content="${SITE}${p.path}"`);
    expect(html).toContain(`property="og:image" content="${SITE}/og-image.png"`);
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('<noscript><h1>'); // contenu lisible sans JavaScript
  }
  expect(titles.size, 'titres uniques').toBe(PAGES.length);
});

test('sitemap.xml liste toutes les pages en URL absolues', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('xml');
  const xml = await res.text();
  for (const p of PAGES) expect(xml).toContain(`<loc>${SITE}${p.path}</loc>`);
  expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
});

test('robots.txt autorise l’exploration et cite le sitemap', async ({ request }) => {
  const txt = await (await request.get('/robots.txt')).text();
  expect(txt).toContain('Allow: /');
  expect(txt).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  expect(txt).not.toContain('Disallow: /\n');
});

test('JSON-LD de l’accueil : WebApplication valide', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const raw = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
  const data = JSON.parse(raw) as Record<string, unknown>;
  expect(data['@type']).toBe('WebApplication');
  expect(data['url']).toBe(`${SITE}/`);
  expect(data['isAccessibleForFree']).toBe(true);
});

test('une adresse inconnue renvoie une vraie 404 (pas de soft-404) en noindex', async ({
  request,
}) => {
  const res = await request.get('/nimporte-quoi');
  expect(res.status()).toBe(404);
  expect(await res.text()).toContain('noindex');
});

test('security.txt reçoit son Canonical', async ({ request }) => {
  const txt = await (await request.get('/.well-known/security.txt')).text();
  expect(txt).toContain(`Canonical: ${SITE}/.well-known/security.txt`);
});

test('navigation interne sans rechargement : URL et titre suivent la page', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    (window as unknown as { __marker: number }).__marker = 1;
  });
  await page.getByRole('link', { name: 'FAQ' }).click();
  await expect(page).toHaveURL(/\/faq$/);
  await expect(page).toHaveTitle(/^FAQ — /);
  await expect(page.getByRole('heading', { name: 'Questions fréquentes' })).toBeVisible();
  // Pas de rechargement : la variable posée dans la page est toujours là.
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /Récupérer ton export Garmin/ })).toBeVisible();
});

test('les anciens liens /#/faq sont ramenés à /faq', async ({ page }) => {
  await page.goto('/#/faq');
  await expect(page).toHaveURL(/\/faq$/);
  await expect(page.getByRole('heading', { name: 'Questions fréquentes' })).toBeVisible();
});

test('la langue change aussi le titre de la page', async ({ page }) => {
  await page.goto('/faq');
  await page.getByRole('combobox', { name: 'Langue' }).selectOption('en');
  await expect(page).toHaveTitle(/^FAQ — Garmin ⇄ COROS migration/);
});
