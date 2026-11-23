import { describe, expect, it } from 'vitest';
import {
  ZipSizeEstimator,
  createMemorySink,
  deflatedSize,
  processArchive,
  splitIntoBatches,
} from '../src/index.js';
import { cand } from './helpers.js';
import { makeZip } from './fixtures.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** TCX valide, compressible (points variés) ou non (`noise` aléatoire en commentaire). */
function tcx(day: number, opts: { noise?: boolean } = {}): string {
  // Points variés (heure, fréquence cardiaque) : taux de compression réaliste (~8:1), sous la limite
  // de ratio anti zip-bomb (100:1) qu'un contenu strictement répétitif dépasserait.
  const base = Date.UTC(2022, 0, day, 8);
  let filler = Array.from(
    { length: 2_000 },
    (_, i) =>
      `<Trackpoint><Time>${new Date(base + i * 1000).toISOString()}</Time><HeartRateBpm><Value>${String(100 + ((i * 7) % 61))}</Value></HeartRateBpm></Trackpoint>`,
  ).join('');
  if (opts.noise) {
    let seed = day * 7919;
    const rnd = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648);
    filler = Array.from({ length: 25_000 }, () => rnd().toString(16).padStart(8, '0')).join('');
  }
  return (
    `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Running">` +
    `<Id>2022-01-${String(day).padStart(2, '0')}T08:00:00Z</Id><Lap StartTime="2022-01-${String(day).padStart(2, '0')}T08:00:00Z">` +
    `<Track>${opts.noise ? `<!--${filler}-->` : filler}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`
  );
}

describe('estimation de la taille compressée', () => {
  it('deflatedSize : un contenu répétitif se compresse fortement', async () => {
    const data = enc('abcdef'.repeat(50_000));
    expect(await deflatedSize(data)).toBeLessThan(data.byteLength / 50);
  });

  it('sans échantillon, l’estimation reste prudente (taille brute)', () => {
    expect(new ZipSizeEstimator().estimate(cand({ size: 1000 }))).toBe(1000);
  });

  it('avec échantillon, l’estimation suit le taux mesuré, avec une marge', async () => {
    const est = new ZipSizeEstimator();
    const data = enc('x'.repeat(200_000));
    await est.observe('tcx', data);
    const c = cand({ format: 'tcx', size: 200_000 });
    expect(est.estimate(c)).toBeLessThan(5_000);
    expect(est.estimate(c)).toBeGreaterThan(await deflatedSize(data)); // marge de sécurité
  });
});

describe('découpage selon la taille estimée', () => {
  it('sizeOf remplace la taille brute dans le calcul des lots', () => {
    const items = [1, 2, 3, 4].map((d) =>
      cand({ id: `f${String(d)}`, size: 10_000, startTime: d }),
    );
    expect(splitIntoBatches(items, 12_000)).toHaveLength(4);
    expect(splitIntoBatches(items, 12_000, () => 100)).toHaveLength(1);
  });
});

describe('remplissage des archives', () => {
  async function build(count: number, noise = false): Promise<Blob> {
    return makeZip(
      Array.from({ length: count }, (_, i) => [`a${String(i)}.tcx`, tcx(i + 1, { noise })]),
    );
  }

  it('moins d’archives que le découpage sur la taille brute, toutes sous la limite', async () => {
    const zip = await build(24);
    const limit = 1_000_000;
    const raw = await processArchive(zip, createMemorySink(), {
      maxBatchSize: limit,
      estimateZipSize: (c) => c.size,
    });
    const est = await processArchive(zip, createMemorySink(), { maxBatchSize: limit });
    expect(est.report.kept).toBe(24);
    expect(est.archives.length).toBeLessThan(raw.archives.length);
    expect(est.archives.length).toBe(1);
    for (const a of est.archives) expect(a.blob.size).toBeLessThanOrEqual(limit);
    expect(est.archives.reduce((n, a) => n + a.fileCount, 0)).toBe(24);
  });

  it('estimation trop optimiste : l’archive trop grosse est refaite en découpage prudent', async () => {
    const zip = await build(24, true);
    const hard = 1_500_000;
    const { archives, report } = await processArchive(zip, createMemorySink(), {
      maxBatchSize: 1_000_000,
      maxArchiveSize: hard,
      estimateZipSize: () => 1, // estimation absurde : tout tiendrait dans une seule archive
    });
    expect(report.kept).toBe(24);
    expect(archives.length).toBeGreaterThan(1);
    for (const a of archives) expect(a.blob.size).toBeLessThanOrEqual(hard);
    expect(archives.reduce((n, a) => n + a.fileCount, 0)).toBe(24);
  });
});
