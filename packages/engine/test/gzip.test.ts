import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIMITS,
  GzipInvalidError,
  GzipTooLargeError,
  gunzip,
  isGzip,
  scanArchive,
  type ScanEvent,
} from '../src/index.js';
import { gzip, makeFit, makeGpx, makeZip } from './fixtures.js';

async function collect(blob: Blob, limits = DEFAULT_LIMITS): Promise<ScanEvent[]> {
  const out: ScanEvent[] = [];
  for await (const e of scanArchive(blob, limits)) out.push(e);
  return out;
}

const budget = {
  maxBytes: 1024 * 1024,
  maxRatio: 100,
  ratioFloor: 64 * 1024,
  onBytes: () => undefined,
};
const blobOf = (b: Uint8Array): Blob => new Blob([b as Uint8Array<ArrayBuffer>]);

describe('isGzip', () => {
  it('reconnaît les octets magiques, pas l’extension', async () => {
    expect(isGzip(await gzip('abc'))).toBe(true);
    expect(isGzip(new Uint8Array([0x50, 0x4b, 3, 4]))).toBe(false);
    expect(isGzip(new Uint8Array([0x1f, 0x8b]))).toBe(false);
  });
});

describe('gunzip', () => {
  it('aller-retour', async () => {
    const out = await gunzip(blobOf(await gzip('bonjour')), budget);
    expect(await out.text()).toBe('bonjour');
  });

  it('refuse une bombe : ratio dépassé', async () => {
    const bomb = await gzip(new Uint8Array(20 * 1024 * 1024));
    await expect(gunzip(blobOf(bomb), { ...budget, maxBytes: 64 * 1024 * 1024 })).rejects.toThrow(
      GzipTooLargeError,
    );
  });

  it('refuse un contenu au-delà du plafond de taille', async () => {
    const big = new Uint8Array(300_000).map((_, i) => (i * 2654435761) % 251);
    await expect(gunzip(blobOf(await gzip(big)), { ...budget, maxBytes: 100_000 })).rejects.toThrow(
      GzipTooLargeError,
    );
  });

  it('flux tronqué ou corrompu : GzipInvalidError', async () => {
    const good = await gzip(makeGpx(500));
    await expect(gunzip(blobOf(good.subarray(0, good.length - 20)), budget)).rejects.toThrow(
      GzipInvalidError,
    );
    const bad = good.slice();
    const at = Math.floor(bad.length / 2);
    bad[at] = (bad[at] ?? 0) ^ 0xff;
    await expect(gunzip(blobOf(bad), budget)).rejects.toThrow(GzipInvalidError);
  });

  it('relaie l’erreur de la limite globale', async () => {
    const boom = new Error('limite');
    await expect(
      gunzip(blobOf(await gzip('x'.repeat(1000))), {
        ...budget,
        onBytes: () => {
          throw boom;
        },
      }),
    ).rejects.toBe(boom);
  });

  it('ne plante jamais autrement que par une erreur typée (fuzz)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 300 }), async (bytes) => {
        try {
          await gunzip(blobOf(bytes), budget);
        } catch (e) {
          expect(e instanceof GzipInvalidError || e instanceof GzipTooLargeError).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('scanArchive avec des .gz', () => {
  it('décompresse un FIT et un GPX gzippés, reconnus par leur contenu', async () => {
    const zip = await makeZip([
      ['activities/1.fit.gz', await gzip(makeFit())],
      ['activities/2.gpx.gz', await gzip(makeGpx())],
      ['activities/3.bin', await gzip(makeFit())],
    ]);
    const events = await collect(zip);
    expect(events.flatMap((e) => (e.kind === 'activity' ? [e.format] : []))).toEqual([
      'fit',
      'gpx',
      'fit',
    ]);
    expect(events.find((e) => e.kind === 'activity')?.path).toBe('activities/1.fit.gz');
  });

  it('un gzip qui ne contient pas d’activité est ignoré', async () => {
    const events = await collect(await makeZip([['n.txt.gz', await gzip('juste du texte')]]));
    expect(events).toEqual([{ kind: 'ignored', path: 'n.txt.gz', note: 'pas une activité' }]);
  });

  it('gzip corrompu : ignoré sans interrompre le lot', async () => {
    const good = await gzip(makeFit());
    const bad = good.slice(0, good.length - 12);
    const events = await collect(
      await makeZip([
        ['a.fit.gz', bad],
        ['b.fit.gz', good],
      ]),
    );
    expect(events.find((e) => e.path === 'a.fit.gz')).toMatchObject({
      kind: 'ignored',
      note: 'illisible',
    });
    expect(events.find((e) => e.path === 'b.fit.gz')?.kind).toBe('activity');
  });

  it('bombe gzip : ignorée ; gzip dans un gzip : ignoré', async () => {
    const zip = await makeZip([
      ['bomb.gpx.gz', await gzip(new Uint8Array(30 * 1024 * 1024))],
      ['twice.fit.gz', await gzip(await gzip(makeFit()))],
    ]);
    const events = await collect(zip);
    expect(events.find((e) => e.path === 'bomb.gpx.gz')).toMatchObject({
      kind: 'ignored',
      note: 'trop volumineux ou ratio suspect',
    });
    expect(events.find((e) => e.path === 'twice.fit.gz')).toMatchObject({ kind: 'ignored' });
  });

  it('la limite globale décompressée s’applique aussi au gzip', async () => {
    const zip = await makeZip([['a.fit.gz', await gzip(makeFit({ minSize: 60_000 }))]]);
    await expect(
      collect(zip, { ...DEFAULT_LIMITS, maxTotalUncompressed: 1000 }),
    ).rejects.toMatchObject({ code: 'TOTAL_TOO_LARGE' });
  });
});
