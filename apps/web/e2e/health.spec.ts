import { expect, test } from '@playwright/test';
import { blobBytes, makeFit, makeFitOfType, makeZip } from '../../../packages/engine/test/fixtures';

// Un export Garmin contient aussi des données de santé : elles sont reconnues et signalées, pas
// comptées comme « fichiers illisibles ».
test('les données de santé sont signalées, pas traitées comme des fichiers corrompus', async ({
  page,
}) => {
  const zip = await makeZip([
    ['run.fit', makeFit({ minSize: 40_000, start: new Date(Date.UTC(2022, 0, 1, 8)) })],
    ['DI_CONNECT/DI-Connect-Wellness/UDSFile_2022.fit', makeFitOfType('monitoringDaily')],
    ['DI_CONNECT/DI-Connect-Wellness/2022_sleepData.json', '{"sleep":[]}'],
  ]);

  await page.goto('/');
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(await blobBytes(zip)),
  });

  await expect(page.locator('.summary')).toContainText('1', { timeout: 30_000 });
  await expect(page.getByText('2 fichier(s) de données de santé détecté(s)')).toBeVisible();
  await expect(page.getByText('Fichiers illisibles')).toHaveCount(0);
  await expect(page.locator('.summary')).toContainText('2 fichier(s) ignoré(s)');
});
