import { expect, test } from '@playwright/test';
import { blobBytes, makeZip } from '../../../packages/engine/test/fixtures';

// GPX (ex. activités Strava importées dans Garmin) : COROS n'accepte que FIT et TCX → conversion.
function gpxFile(): string {
  const pts = Array.from({ length: 400 }, (_, i) => {
    const t = new Date(Date.UTC(2016, 4, 6, 15, 0, 0) + i * 10_000).toISOString();
    return `<trkpt lat="${(43.5 + i * 0.0001).toFixed(7)}" lon="-1.3000000"><ele>24</ele><time>${t}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${String(100 + (i % 50))}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx creator="StravaGPX" version="1.1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><name>Sortie</name><trkseg>${pts}</trkseg></trk></gpx>`;
}

test('les GPX sont convertis en TCX et signalés', async ({ page }) => {
  const zip = await makeZip([['export/2016-05-06_Run.gpx', gpxFile()]]);
  await page.goto('/');
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(await blobBytes(zip)),
  });
  await expect(page.locator('.summary')).toContainText('1', { timeout: 30_000 });
  await expect(page.getByText(/1 activité\(s\) GPX convertie\(s\) en TCX/)).toBeVisible();

  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText(/coros-import-01-2016-05_2016-05\.zip/)).toBeVisible();
  await expect(page.getByText(/1 activité\(s\)/)).toBeVisible();
});
