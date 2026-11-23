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

test.describe('extraction des données de santé en CSV (opt-in)', () => {
  async function exportWithSleep() {
    return makeZip([
      ['run.fit', makeFit({ minSize: 40_000, start: new Date(Date.UTC(2022, 0, 1, 8)) })],
      [
        'DI_CONNECT/DI-Connect-Wellness/2022_sleepData.json',
        JSON.stringify([
          { calendarDate: '2022-01-01', deepSleepSeconds: 5400 },
          { calendarDate: '2022-01-02', deepSleepSeconds: 6000 },
        ]),
      ],
    ]);
  }

  test('désactivée par défaut : aucun CSV, la santé est seulement signalée', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
    await expect(
      page.getByRole('checkbox', { name: /Extraire aussi mes données de santé/ }),
    ).not.toBeChecked();
    await page.locator('input[type=file]').setInputFiles({
      name: 'export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(await blobBytes(await exportWithSleep())),
    });
    await expect(page.getByText('1 fichier(s) de données de santé détecté(s)')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByText('Tes données de santé (CSV)')).toHaveCount(0);
  });

  test('activée : archive de CSV à part, hors de la liste d’import', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
    await page.getByRole('checkbox', { name: /Extraire aussi mes données de santé/ }).check();
    await page.locator('input[type=file]').setInputFiles({
      name: 'export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(await blobBytes(await exportWithSleep())),
    });
    await expect(page.getByText(/Données de santé extraites : 2 ligne\(s\)/)).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByText('Tes données de santé (CSV)')).toBeVisible();
    await expect(page.getByText('garmin-sante.zip')).toBeVisible();
    await expect(page.getByText(/coros-import-01-2022-01_2022-01\.zip/)).toBeVisible();
    // Une seule case « Importé » : l'archive de santé n'entre pas dans le suivi d'import COROS.
    await expect(page.getByRole('checkbox', { name: 'Importé' })).toHaveCount(1);
    await expect(page.getByText('0 / 1 archive(s) importée(s)')).toBeVisible();

    const download = page.waitForEvent('download');
    await page
      .locator('li.file', { hasText: 'garmin-sante.zip' })
      .getByRole('button', { name: 'Télécharger' })
      .click();
    expect((await download).suggestedFilename()).toBe('garmin-sante.zip');
  });

  test('absente dans le sens COROS → Garmin', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Depuis').selectOption('coros'); // la destination passe à Garmin
    await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
    await expect(
      page.getByRole('checkbox', { name: /Extraire aussi mes données de santé/ }),
    ).toHaveCount(0);
  });
});
