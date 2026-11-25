import { expect, test } from '@playwright/test';
import { buildExport, watchViolations } from './helpers';

test('parcours nominal sans aucune requête sortante (T2.11)', async ({ page }) => {
  const origin = new URL(test.info().project.use.baseURL ?? '').origin;
  const external: string[] = [];
  const suspicious: string[] = [];
  let processing = false;
  // Au niveau du contexte : voit aussi les requêtes du service worker.
  page.context().on('request', (req) => {
    const url = req.url();
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    if (new URL(url).origin !== origin) external.push(url);
    // Pendant le traitement, seul le chargement du code du worker (GET same-origin) est toléré.
    if (processing && (req.method() !== 'GET' || req.postData() !== null))
      suspicious.push(`${req.method()} ${url}`);
  });

  const violations = watchViolations(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();

  processing = true;
  await page.locator('input[type=file]').setInputFiles({
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: await buildExport(),
  });

  await expect(page.getByText('activité(s) prête(s)')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.summary')).toContainText('2 activité(s) prête(s)');
  await expect(page.getByText('Doublons (1)')).toBeVisible();
  await expect(page.getByText('Sports non pris en charge (1)')).toBeVisible();
  processing = false;

  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('coros-import-01-2022-01_2022-01.zip')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Télécharger' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('coros-import-01-2022-01_2022-01.zip');

  expect(violations, 'violations CSP / Trusted Types').toEqual([]);
  expect(external, 'requêtes vers un autre domaine').toEqual([]);
  expect(suspicious, 'requêtes non-GET pendant le traitement').toEqual([]);
});

test('refuse un fichier qui n’est pas un ZIP', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await expect(page.getByRole('alert')).toContainText('n’est pas un ZIP');
});

test('le rapport liste les sports non pris en charge et les doublons', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: await buildExport(),
  });
  await expect(page.getByText('activité(s) prête(s)')).toBeVisible({ timeout: 30_000 });

  await page.getByText('Sports non pris en charge (1)').click();
  await expect(page.getByText('Sports concernés :')).toBeVisible();
  await expect(page.getByText('golf : 1')).toBeVisible();
  await expect(page.locator('.file-list code', { hasText: 'golf.fit' })).toBeVisible();

  await page.getByText('Doublons (1)').click();
  await expect(page.locator('.file-list code', { hasText: 'run1-copy.fit' })).toBeVisible();
  await expect(page.getByText(/conservé :/)).toBeVisible();
});
