import { expect, test } from '@playwright/test';
import { makeFit, makeZip, blobBytes } from '../../../packages/engine/test/fixtures';

const day = (d: number): Date => new Date(Date.UTC(2022, 0, d, 8));

async function buildExport(): Promise<Buffer> {
  const fit = (sport: string, d: number): Uint8Array =>
    makeFit({ sport, start: day(d), minSize: 40_000 });
  const inner = await makeZip([
    ['run1.fit', fit('running', 1)],
    ['run1-copy.fit', fit('running', 1)],
    ['golf.fit', fit('golf', 4)],
    ['wellness.json', '{}'],
  ]);
  const outer = await makeZip([
    ['DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_0.zip', await blobBytes(inner)],
    ['bike.fit', fit('cycling', 3)],
  ]);
  return Buffer.from(await blobBytes(outer));
}

test('parcours nominal sans aucune requête sortante (T2.11)', async ({ page }) => {
  const origin = 'http://localhost:4200';
  const external: string[] = [];
  const suspicious: string[] = [];
  let processing = false;
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    if (!url.startsWith(origin)) external.push(url);
    // Pendant le traitement, seul le chargement du code du worker (GET same-origin) est toléré.
    if (processing && (req.method() !== 'GET' || req.postData() !== null))
      suspicious.push(`${req.method()} ${url}`);
  });

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
