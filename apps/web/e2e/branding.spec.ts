import { expect, test } from '@playwright/test';

test('logo dans l’en-tête et signature J6N avec lien sécurisé', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'watch-relay' })).toBeVisible();
  const sig = page.getByRole('link', { name: 'J6N', exact: true });
  await expect(sig).toHaveAttribute('href', 'https://me.byj6n.fr');
  await expect(sig).toHaveAttribute('target', '_blank');
  await expect(sig).toHaveAttribute('rel', /noopener/);
});

test('la signature suit la langue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByText('Made by')).toBeVisible();
});

test('favicon et icônes sont servis', async ({ request }) => {
  for (const [path, type] of [
    ['/favicon.ico', /image\/(x-icon|vnd\.microsoft\.icon)/],
    ['/icons/favicon-32.png', /image\/png/],
    ['/icons/apple-touch-icon.png', /image\/png/],
    ['/icons/logo-256.png', /image\/png/],
  ] as const) {
    const res = await request.get(path);
    expect(res.ok(), path).toBe(true);
    expect(res.headers()['content-type'], path).toMatch(type);
  }
});
