import { expect, test } from '@playwright/test';
import { buildExport } from './helpers';

test('les pages FAQ, confidentialité et mentions légales sont accessibles (T3.13)', async ({
  page,
}) => {
  await page.goto('/');
  const footer = page.getByRole('navigation', { name: 'Informations' });

  await footer.getByRole('link', { name: 'FAQ' }).click();
  await expect(page.getByRole('heading', { name: 'Questions fréquentes' })).toBeVisible();
  await expect(page.getByText('Mes données sont-elles envoyées quelque part ?')).toBeVisible();

  await footer.getByRole('link', { name: 'Confidentialité' }).click();
  await expect(page.getByRole('heading', { name: 'Politique de confidentialité' })).toBeVisible();

  await footer.getByRole('link', { name: 'Mentions légales' }).click();
  await expect(page.getByRole('heading', { name: 'Mentions légales' })).toBeVisible();
  await expect(page.getByText('non affilié').first()).toBeVisible();

  await page.getByRole('link', { name: /Retour à l’outil/ }).click();
  await expect(page.getByRole('heading', { name: /Récupérer ton export Garmin/ })).toBeVisible();
});

test('un lien direct ouvre la page et suit la langue', async ({ page }) => {
  await page.goto('/#/faq');
  await expect(page.getByRole('heading', { name: 'Questions fréquentes' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();
});

test('consulter une page ne perd pas l’analyse terminée', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: await buildExport(),
  });
  await expect(page.getByText('activité(s) prête(s)')).toBeVisible({ timeout: 30_000 });

  await page
    .getByRole('navigation', { name: 'Informations' })
    .getByRole('link', { name: 'FAQ' })
    .click();
  await page.getByRole('link', { name: /Retour à l’outil/ }).click();
  await expect(page.getByText('activité(s) prête(s)')).toBeVisible();
});
