import { expect, test } from '@playwright/test';
import { blobBytes, gzip, makeFit, makeGpx, makeZip } from '../../../packages/engine/test/fixtures';

// Strava : source uniquement. L'export contient des fichiers .gz et un activities.csv.
const CSV =
  'Activity ID,Activity Date,Activity Name,Activity Type,Filename\n' +
  '1,"Jun 1, 2021, 8:00:00 AM",Footing,Run,activities/1.gpx.gz\n' +
  '2,"Jun 2, 2021, 8:00:00 AM",Saisie manuelle,Ride,\n' +
  '3,"Jun 3, 2021, 8:00:00 AM",Vélo,Ride,activities/3.fit.gz\n';

async function stravaExport(): Promise<Buffer> {
  const zip = await makeZip([
    ['activities.csv', CSV],
    ['activities/1.gpx.gz', await gzip(makeGpx(1500))],
    [
      'activities/3.fit.gz',
      await gzip(
        makeFit({ sport: 'cycling', start: new Date(Date.UTC(2021, 5, 3, 8)), minSize: 40_000 }),
      ),
    ],
  ]);
  return Buffer.from(await blobBytes(zip));
}

test('Strava → COROS : guide, intitulés et étapes suivent le couple choisi', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Depuis').selectOption('strava');
  await expect(page.getByLabel('Vers')).toHaveValue('coros');
  await expect(page.getByLabel('Vers').locator('option[value=strava]')).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Migration Strava → COROS' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Récupérer ton export Strava/ })).toBeVisible();
  await expect(page.locator('.j6n-stepper')).toContainText('Export Strava');
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await expect(page.getByText('Choisir le ZIP de l’export Strava')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /données de santé/ })).toHaveCount(0);
});

test('Strava → COROS : .gz décompressés, sport du CSV, activité manuelle signalée', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Depuis').selectOption('strava');
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'strava-export.zip',
    mimeType: 'application/zip',
    buffer: await stravaExport(),
  });
  await expect(page.locator('.summary')).toContainText('2', { timeout: 30_000 });
  await expect(page.getByText(/1 activité\(s\) Strava sans fichier/)).toBeVisible();
  await expect(page.getByText(/1 activité\(s\) GPX convertie\(s\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText(/coros-import-01-2021-06_2021-06\.zip/)).toBeVisible();
});

test('Strava → Garmin et retour à une source Garmin', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Depuis').selectOption('strava');
  await page.getByLabel('Vers').selectOption('garmin');
  await expect(page.getByRole('heading', { name: 'Migration Strava → Garmin' })).toBeVisible();
  await page.getByLabel('Depuis').selectOption('garmin');
  await expect(page.getByLabel('Vers')).toHaveValue('coros');
});

test('en anglais : titre et libellés suivent la langue', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Depuis').selectOption('strava');
  await page.getByLabel('Langue').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Strava → COROS migration' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Get your Strava export/ })).toBeVisible();
});

test('Strava : 0 violation d’accessibilité', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('Depuis').selectOption('strava');
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
});
