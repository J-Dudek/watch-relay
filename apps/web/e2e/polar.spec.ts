import { expect, test } from '@playwright/test';
import { blobBytes, makeZip } from '../../../packages/engine/test/fixtures';

// Polar : source uniquement (Polar Flow n'importe pas d'historique d'activités).
const tcx = (id: string, sport: string): string =>
  `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="${sport}"><Id>${id}</Id>` +
  `<Lap StartTime="${id}"><Track><Trackpoint><Time>${id}</Time></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;

const gpx = (time: string): string =>
  `<?xml version="1.0"?><gpx creator="Polar"><trk><trkseg>` +
  `<trkpt lat="43.5" lon="-1.3"><time>${time}</time></trkpt><trkpt lat="43.501" lon="-1.3"><time>2020-03-01T10:05:00Z</time></trkpt>` +
  `</trkseg></trk></gpx>`;

test('Polar → COROS : guide, intitulés et étapes suivent le couple choisi', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Depuis').selectOption('polar');
  await expect(page.getByLabel('Vers')).toHaveValue('coros');
  await expect(page.getByRole('heading', { name: 'Migration Polar → COROS' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Récupérer tes séances Polar/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Polar Flow' })).toHaveAttribute(
    'href',
    'https://flow.polar.com',
  );
  await expect(page.locator('.j6n-stepper')).toContainText('Export Polar');
  await expect(page.locator('.j6n-stepper')).toContainText('Import COROS');

  // L'extraction santé est propre aux exports Garmin.
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await expect(page.getByText('Choisir le ZIP de séances Polar')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /données de santé/ })).toHaveCount(0);
});

test('Polar → Garmin : destination modifiable, la source ne peut pas être aussi destination', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Depuis').selectOption('polar');
  await page.getByLabel('Vers').selectOption('garmin');
  await expect(page.getByRole('heading', { name: 'Migration Polar → Garmin' })).toBeVisible();

  // Revenir à une source Garmin : « Garmin » n'est plus une destination valide → COROS.
  await page.getByLabel('Depuis').selectOption('garmin');
  await expect(page.getByLabel('Vers')).toHaveValue('coros');
});

test('Polar → Garmin : une séance exportée en plusieurs formats n’est comptée qu’une fois', async ({
  page,
}) => {
  const id = '2020-03-01T10:00:00Z';
  const zip = await makeZip([
    ['polar/Run_2020-03-01.tcx', tcx(id, 'Running')],
    ['polar/Run_2020-03-01.gpx', gpx(id)], // même séance, GPX sans type de sport
  ]);
  await page.goto('/');
  await page.getByLabel('Depuis').selectOption('polar');
  await page.getByLabel('Vers').selectOption('garmin');
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'polar.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(await blobBytes(zip)),
  });
  await expect(page.locator('.summary')).toContainText('1', { timeout: 30_000 });
  await expect(page.locator('.summary')).toContainText('1 écartée(s)');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText(/garmin-import-01-2020-03_2020-03\.zip/)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '4. Importer dans Garmin Connect' }),
  ).toBeVisible();
});

test('en anglais : titre et libellés suivent la langue', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Depuis').selectOption('polar');
  await page.getByLabel('Langue').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Polar → COROS migration' })).toBeVisible();
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('polar');
  await expect(page.getByLabel('To', { exact: true })).toHaveValue('coros');
  await expect(page.getByRole('heading', { name: /Get your Polar sessions/ })).toBeVisible();
});

test('Polar : 0 violation d’accessibilité', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('Depuis').selectOption('polar');
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
});

test('Polar : l’export global JSON est converti en TCX et signalé', async ({ page }) => {
  const t0 = Date.UTC(2020, 2, 1, 10, 0, 0);
  const iso = (i: number): string => new Date(t0 + i * 1000).toISOString().replace('Z', '');
  const session = {
    name: 'Footing',
    startTime: iso(0),
    exercises: [
      {
        startTime: iso(0),
        timezoneOffset: 60,
        duration: 'PT400.0S',
        distance: 1200,
        kiloCalories: 90,
        sport: 'RUNNING',
        heartRate: { avg: 140, max: 171 },
        samples: {
          recordedRoute: Array.from({ length: 400 }, (_, i) => ({
            dateTime: iso(i),
            latitude: 43.5 + i * 0.0001,
            longitude: -1.3,
            altitude: 20,
          })),
          heartRate: Array.from({ length: 400 }, (_, i) => ({
            dateTime: iso(i),
            value: 100 + (i % 60),
          })),
        },
      },
    ],
  };
  const zip = await makeZip([
    ['polar/training-session-2020-03-01-1.json', JSON.stringify(session)],
    ['polar/account-data.json', '{"name":"x"}'],
  ]);

  await page.goto('/');
  await page.getByLabel('Depuis').selectOption('polar');
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'polar-export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(await blobBytes(zip)),
  });
  await expect(page.locator('.summary')).toContainText('1', { timeout: 30_000 });
  await expect(
    page.getByText(/1 séance\(s\) Polar \(JSON de l’export global\) convertie\(s\)/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText(/coros-import-01-2020-03_2020-03\.zip/)).toBeVisible();
});
