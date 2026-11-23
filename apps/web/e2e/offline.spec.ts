import { expect, test } from '@playwright/test';
import { buildExport } from './helpers';

test('après la première visite, l’app fonctionne hors ligne (T3.16)', async ({ page, context }) => {
  await page.goto('/');
  // Attend que le service worker ait fini de précacher et contrôle la page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Récupérer ton export Garmin/ })).toBeVisible();

  // Le parcours complet marche sans réseau, worker de traitement compris.
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: await buildExport(),
  });
  await expect(page.getByText('activité(s) prête(s)')).toBeVisible({ timeout: 30_000 });

  // Les pages d'information aussi.
  await page.goto('/#/faq');
  await expect(page.getByRole('heading', { name: 'Questions fréquentes' })).toBeVisible();
});

test('le manifeste et les icônes sont servis (installabilité)', async ({ request }) => {
  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
    display: string;
    icons: { src: string; sizes: string }[];
  };
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
  for (const icon of manifest.icons) {
    const res = await request.get(`/${icon.src}`);
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toBe('image/png');
  }
});
