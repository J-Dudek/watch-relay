import { describe, expect, it } from 'vitest';
import {
  GARMIN_MAX_FIT_SIZE,
  GARMIN_MAX_TCX_SIZE,
  PROFILES,
  createMemorySink,
  parseFit,
  parseTcx,
  processArchive,
  runPipeline,
} from '../src/index.js';
import { cand } from './helpers.js';
import { blobBytes, makeFit, makeZip } from './fixtures.js';

describe('profil de destination Garmin', () => {
  const rules = PROFILES.garmin.fileRules({});
  const run = (...c: Parameters<typeof cand>[]) =>
    runPipeline(
      c.map((x, i) => cand({ id: `f${String(i)}`, ...x[0] })),
      rules,
      [],
    );

  it('rejette un FIT > 50 Mo et un TCX > 25 Mo, selon le format', () => {
    const { kept, rejected } = run(
      [{ format: 'fit', size: GARMIN_MAX_FIT_SIZE + 1 }],
      [{ format: 'fit', size: GARMIN_MAX_FIT_SIZE }],
      [{ format: 'tcx', size: GARMIN_MAX_TCX_SIZE + 1 }],
      [{ format: 'tcx', size: GARMIN_MAX_TCX_SIZE }],
    );
    expect(rejected.map((r) => r.reason)).toEqual(['TOO_LARGE', 'TOO_LARGE']);
    expect(kept).toHaveLength(2);
  });

  it('rejette 99 999 points ou plus, accepte 99 998', () => {
    const { kept, rejected } = run(
      [{ meta: { sport: 'running', startTime: 1, points: 99_999 } }],
      [{ meta: { sport: 'running', startTime: 2, points: 99_998 } }],
    );
    expect(rejected.map((r) => r.reason)).toEqual(['TOO_MANY_POINTS']);
    expect(kept).toHaveLength(1);
  });

  it('n’impose ni taille minimale ni liste de sports (contrairement à COROS)', () => {
    const { kept } = run([{ size: 500, meta: { sport: 'golf', startTime: 1 } }]);
    expect(kept).toHaveLength(1);
    const coros = runPipeline(
      [cand({ size: 500, meta: { sport: 'golf', startTime: 1 } })],
      PROFILES.coros.fileRules({}),
      [],
    );
    expect(coros.rejected.map((r) => r.reason)).toEqual(['TOO_SMALL']);
  });
});

describe('comptage des points', () => {
  it('TCX : compte les Trackpoint', () => {
    const tp = '<Trackpoint><Time>2023-05-14T07:32:10Z</Time></Trackpoint>'.repeat(5);
    const xml =
      '<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2023-05-14T07:32:10Z</Id>' +
      `<Lap StartTime="2023-05-14T07:32:10Z"><Track>${tp}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    expect(parseTcx(new TextEncoder().encode(xml)).points).toBe(5);
  });

  it('FIT : renvoie un nombre de points', () => {
    expect(parseFit(makeFit()).points).toBeTypeOf('number');
  });
});

describe('processArchive vers Garmin', () => {
  it('garde tous les sports et petits fichiers, nomme les archives garmin-import', async () => {
    const zip = await makeZip([
      ['run.fit', makeFit({ sport: 'running', start: new Date(Date.UTC(2022, 0, 1, 8)) })],
      ['golf.fit', makeFit({ sport: 'golf', start: new Date(Date.UTC(2022, 0, 2, 8)) })],
    ]);
    const sink = createMemorySink();
    const { report, archives } = await processArchive(zip, sink, { target: 'garmin' });
    expect(report.kept).toBe(2);
    expect(report.rejected).toHaveLength(0);
    expect(archives[0]?.name).toBe('garmin-import-01-2022-01_2022-01.zip');
    expect((await blobBytes(archives[0]?.blob as Blob)).length).toBeGreaterThan(0);
  });

  it('vers COROS (défaut) : mêmes fichiers, golf et fichiers trop petits écartés', async () => {
    const zip = await makeZip([
      ['run.fit', makeFit({ sport: 'running', start: new Date(Date.UTC(2022, 0, 1, 8)) })],
      ['golf.fit', makeFit({ sport: 'golf', start: new Date(Date.UTC(2022, 0, 2, 8)) })],
    ]);
    const { report } = await processArchive(zip, createMemorySink());
    expect(report.kept).toBe(0); // les FIT synthétiques de moins de 20 Ko sont TOO_SMALL pour COROS
    expect(report.rejectedByReason.TOO_SMALL).toBe(2);
  });
});
