import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';
import { createMemorySink, parseFit, processArchive } from '../src/index.js';
import { makeGpx, makeZip } from './fixtures.js';

async function entries(blob: Blob): Promise<{ name: string; bytes: Uint8Array }[]> {
  const r = new ZipReader(new BlobReader(blob));
  const out = [];
  for (const e of await r.getEntries()) {
    if (e.directory) continue;
    out.push({ name: e.filename, bytes: await e.getData(new Uint8ArrayWriter()) });
  }
  await r.close();
  return out;
}

describe('conversion GPX pour COROS', () => {
  it('une randonnée GPX devient un FIT hiking (le TCX l’aurait réduite à « Autre »)', async () => {
    const zip = await makeZip([['activities/Sortie-Hike.gpx', makeGpx(2500)]]);
    const { report, archives } = await processArchive(zip, createMemorySink());
    expect(report).toMatchObject({ kept: 1, convertedGpx: 1, bySport: { hiking: 1 } });
    const [file] = await entries(archives[0]?.blob as Blob);
    expect(file?.name).toMatch(/_hiking\.fit$/);
    expect(parseFit(file?.bytes as Uint8Array)).toMatchObject({ sport: 'hiking', points: 2500 });
  });

  it('une marche devient un FIT walking', async () => {
    const zip = await makeZip([['Matin-Walk.gpx', makeGpx(2500)]]);
    const { archives } = await processArchive(zip, createMemorySink());
    const [file] = await entries(archives[0]?.blob as Blob);
    expect(parseFit(file?.bytes as Uint8Array).sport).toBe('walking');
  });

  it('une courte activité dont le FIT passerait sous 20 Ko reste en TCX plutôt que d’être écartée', async () => {
    const zip = await makeZip([['court-Hike.gpx', makeGpx(220)]]);
    const { report, archives } = await processArchive(zip, createMemorySink());
    expect(report.kept).toBe(1);
    const [file] = await entries(archives[0]?.blob as Blob);
    expect(file?.name).toMatch(/\.tcx$/);
  });

  it('vers Garmin : le GPX reste inchangé', async () => {
    const zip = await makeZip([['a-Hike.gpx', makeGpx(2500)]]);
    const { report, archives } = await processArchive(zip, createMemorySink(), {
      target: 'garmin',
    });
    expect(report.convertedGpx).toBe(0);
    const [file] = await entries(archives[0]?.blob as Blob);
    expect(file?.name).toMatch(/\.gpx$/);
  });
});
