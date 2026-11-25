import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';
import { createMemorySink, parseFit, processArchive } from '../src/index.js';
import { makeFit, makeGpx, makeZip } from './fixtures.js';

async function entries(blob: Blob): Promise<{ name: string; bytes: Uint8Array }[]> {
  const r = new ZipReader(new BlobReader(blob));
  const out = [];
  for (const e of await r.getEntries()) {
    if (!e.directory)
      out.push({ name: e.filename, bytes: await e.getData(new Uint8ArrayWriter()) });
  }
  await r.close();
  return out;
}

const golf = (): Uint8Array =>
  makeFit({ sport: 'golf', start: new Date(Date.UTC(2022, 0, 5, 9)), minSize: 40_000 });

describe('reclassement de sport', () => {
  it('sans reclassement : un sport non pris en charge est écarté', async () => {
    const zip = await makeZip([['golf.fit', golf()]]);
    const { report } = await processArchive(zip, createMemorySink());
    expect(report.kept).toBe(0);
    expect(report.rejectedByReason.UNSUPPORTED_SPORT).toBe(1);
    expect(report.reclassified).toBeUndefined();
  });

  it('FIT d’origine : sport corrigé sur place, fichier valide et de même taille', async () => {
    const original = golf();
    const zip = await makeZip([['golf.fit', original]]);
    const { report, archives } = await processArchive(zip, createMemorySink(), {
      sportMap: { golf: 'walking' },
    });
    expect(report).toMatchObject({ kept: 1, bySport: { walking: 1 } });
    expect(report.reclassified).toEqual([{ from: 'golf', to: 'walking', count: 1 }]);
    const [file] = await entries(archives[0]?.blob as Blob);
    expect(file?.name).toMatch(/_walking\.fit$/);
    expect(file?.bytes.length).toBe(original.length);
    expect(parseFit(file?.bytes as Uint8Array)).toMatchObject({ sport: 'walking', points: 2500 });
  });

  it('la cible doit être un sport accepté : sinon le reclassement est ignoré', async () => {
    const zip = await makeZip([['golf.fit', golf()]]);
    const { report } = await processArchive(zip, createMemorySink(), {
      sportMap: { golf: 'curling' },
    });
    expect(report.kept).toBe(0);
    expect(report.rejectedByReason.UNSUPPORTED_SPORT).toBe(1);
  });

  it('GPX : le sport reclassé est écrit dans le FIT converti', async () => {
    const zip = await makeZip([['sortie.gpx', makeGpx(2500)]]); // sport inconnu : generic
    const { report, archives } = await processArchive(zip, createMemorySink(), {
      sportMap: { generic: 'hiking' },
    });
    expect(report).toMatchObject({ kept: 1, convertedGpx: 1, bySport: { hiking: 1 } });
    expect(report.reclassified).toEqual([{ from: 'generic', to: 'hiking', count: 1 }]);
    const [file] = await entries(archives[0]?.blob as Blob);
    expect(parseFit(file?.bytes as Uint8Array).sport).toBe('hiking');
  });

  it('séance Polar : sport reclassé écrit dans le FIT converti', async () => {
    const t0 = Date.UTC(2020, 2, 1, 10);
    const iso = (i: number): string => new Date(t0 + i * 1000).toISOString().replace('Z', '');
    const session = {
      startTime: iso(0),
      exercises: [
        {
          startTime: iso(0),
          duration: 'PT2500.0S',
          distance: 1000,
          sport: 'OTHER_INDOOR',
          samples: {
            recordedRoute: Array.from({ length: 2500 }, (_, i) => ({
              dateTime: iso(i),
              latitude: 43.5 + i * 0.00001,
              longitude: -1.3,
              altitude: 20,
            })),
          },
        },
      ],
    };
    const zip = await makeZip([['polar/training-session-1.json', JSON.stringify(session)]]);
    const { report, archives } = await processArchive(zip, createMemorySink(), {
      polarSessions: true,
      sportMap: { generic: 'training' },
    });
    expect(report.reclassified).toEqual([{ from: 'generic', to: 'training', count: 1 }]);
    const [file] = await entries(archives[0]?.blob as Blob);
    expect(parseFit(file?.bytes as Uint8Array).sport).toBe('training');
  });

  it('plusieurs activités du même sport : un seul couple, avec son compte', async () => {
    const zip = await makeZip([
      [
        'a.fit',
        makeFit({ sport: 'golf', start: new Date(Date.UTC(2022, 0, 5, 9)), minSize: 40_000 }),
      ],
      [
        'b.fit',
        makeFit({ sport: 'golf', start: new Date(Date.UTC(2022, 0, 6, 9)), minSize: 40_000 }),
      ],
      [
        'c.fit',
        makeFit({ sport: 'running', start: new Date(Date.UTC(2022, 0, 7, 9)), minSize: 40_000 }),
      ],
    ]);
    const { report } = await processArchive(zip, createMemorySink(), {
      sportMap: { golf: 'walking' },
    });
    expect(report.kept).toBe(3);
    expect(report.reclassified).toEqual([{ from: 'golf', to: 'walking', count: 2 }]);
  });
});
