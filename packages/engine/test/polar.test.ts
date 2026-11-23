import fc from 'fast-check';
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';
import {
  ParseError,
  createMemorySink,
  parseIsoDuration,
  parsePolarSession,
  parsePolarTime,
  parseTcx,
  polarSport,
  processArchive,
  trackToTcx,
} from '../src/index.js';
import { makeZip } from './fixtures.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

// Forme inspirée d'un convertisseur communautaire écrit sur de vrais exports Polar (non validée sur un
// export récent) : les tests fixent le comportement du lecteur, pas la vérité du format Polar.
function session(opts: { points?: number; sport?: string; extra?: object } = {}): object {
  const n = opts.points ?? 60;
  const t0 = Date.UTC(2020, 2, 1, 10, 0, 0);
  const iso = (i: number): string => new Date(t0 + i * 1000).toISOString().replace('Z', '');
  return {
    name: 'Footing',
    startTime: iso(0),
    duration: `PT${String(n)}.0S`,
    distance: n * 3,
    kiloCalories: 420,
    exercises: [
      {
        startTime: iso(0),
        timezoneOffset: 60,
        duration: `PT${String(n)}.0S`,
        distance: n * 3,
        kiloCalories: 420,
        sport: opts.sport ?? 'RUNNING',
        heartRate: { avg: 140, max: 171 },
        samples: {
          recordedRoute: Array.from({ length: n }, (_, i) => ({
            dateTime: iso(i),
            latitude: 43.5 + i * 0.0001,
            longitude: -1.3,
            altitude: 20 + (i % 5),
          })),
          heartRate: Array.from({ length: n }, (_, i) => ({
            dateTime: iso(i),
            value: 100 + (i % 60),
          })),
        },
      },
    ],
    ...(opts.extra ?? {}),
  };
}
const json = (o: object): Uint8Array => enc(JSON.stringify(o));

describe('durée et date', () => {
  it.each([
    ['PT3612.125S', 3612.125],
    ['PT1H2M3.5S', 3723.5],
    ['PT45M', 2700],
    ['P1DT1H', 90000],
    ['n’importe quoi', 0],
  ])('%s → %s s', (input, seconds) => {
    expect(parseIsoDuration(input)).toBe(seconds);
  });
  it('un nombre ou une absence donne 0', () => {
    expect(parseIsoDuration(12)).toBe(0);
    expect(parseIsoDuration(undefined)).toBe(0);
  });

  it('avec fuseau : pris tel quel ; sans fuseau : local à la séance (décalage retranché)', () => {
    expect(parsePolarTime('2020-03-01T10:00:00Z')).toBe(Date.UTC(2020, 2, 1, 10));
    expect(parsePolarTime('2020-03-01T10:00:00+01:00')).toBe(Date.UTC(2020, 2, 1, 9));
    expect(parsePolarTime('2020-03-01T10:00:00.000', 60)).toBe(Date.UTC(2020, 2, 1, 9));
    expect(parsePolarTime('2020-03-01T10:00:00.000')).toBe(Date.UTC(2020, 2, 1, 10));
    expect(parsePolarTime('pas une date')).toBeUndefined();
    expect(parsePolarTime(42)).toBeUndefined();
  });
});

describe('sport', () => {
  it.each([
    ['RUNNING', 'running'],
    ['TRAIL_RUNNING', 'running'],
    ['ROAD_BIKING', 'cycling'],
    ['INDOOR_CYCLING', 'cycling'],
    ['SWIMMING', 'swimming'],
    ['WALKING', 'walking'],
    ['HIKING', 'hiking'],
    ['OTHER_INDOOR', 'generic'],
    ['ROWING', 'rowing'],
    [undefined, 'generic'],
  ])('%s → %s', (raw, expected) => {
    expect(polarSport(raw)).toBe(expected);
  });
});

describe('parsePolarSession', () => {
  it('convertit une séance : sport, début UTC (décalage retranché), durée, points, fréquence cardiaque', () => {
    const [ex] = parsePolarSession(json(session())) ?? [];
    expect(ex?.meta).toMatchObject({
      sport: 'running',
      startTime: Date.UTC(2020, 2, 1, 9, 0, 0), // 10:00 local, décalage de +60 min
      durationS: 60,
      points: 60,
    });
    const p = ex?.track.segments[0]?.[10];
    expect(p?.hr).toBe(110); // échantillon de même horodatage
    expect(p?.ele).toBe('20');
    expect(ex?.track).toMatchObject({ calories: 420, avgHr: 140, maxHr: 171, name: 'Footing' });
  });

  it('plusieurs séances (multisport) : une trace par séance', () => {
    const s = session() as { exercises: object[] };
    s.exercises.push({ ...s.exercises[0], sport: 'CYCLING', startTime: '2020-03-01T11:00:00.000' });
    expect(parsePolarSession(json(s))?.map((e) => e.meta.sport)).toEqual(['running', 'cycling']);
  });

  it('sans GPS (salle) : points issus de la fréquence cardiaque, sans position', () => {
    const s = session() as { exercises: { samples: { recordedRoute?: unknown } }[] };
    delete s.exercises[0]?.samples.recordedRoute;
    const [ex] = parsePolarSession(json(s)) ?? [];
    expect(ex?.meta.points).toBe(60);
    expect(ex?.track.segments[0]?.[0]?.lat).toBeUndefined();
    expect(trackToTcx(ex?.track as never)).not.toContain('<Position>');
  });

  it('un JSON qui n’est pas une séance Polar est ignoré (null), pas converti', () => {
    expect(parsePolarSession(json({ foo: 1 }))).toBeNull();
    expect(parsePolarSession(json([{ calendarDate: '2020-01-01' }]))).toBeNull();
    expect(parsePolarSession(json({ exercises: [] }))).toBeNull();
    expect(parsePolarSession(enc('[1,2,3]'))).toBeNull();
  });

  it('une séance illisible ou sans date de début lève ParseError', () => {
    expect(() => parsePolarSession(enc('{"exercises": [ {'))).toThrow(ParseError);
    const s = session() as { startTime?: string; exercises: { startTime?: string }[] };
    delete s.startTime;
    delete s.exercises[0]?.startTime;
    expect(() => parsePolarSession(json(s))).toThrow(ParseError);
  });

  it('des types inattendus ne font ni planter ni halluciner (valeurs ignorées)', () => {
    const [ex] =
      parsePolarSession(
        json({
          startTime: '2020-03-01T10:00:00.000',
          exercises: [
            {
              sport: 42,
              duration: {},
              distance: 'long',
              heartRate: 'élevé',
              samples: {
                recordedRoute: [
                  null,
                  'x',
                  { latitude: 'a' },
                  { dateTime: 'x', latitude: 1, longitude: 2 },
                ],
                heartRate: 'oui',
              },
            },
          ],
        }),
      ) ?? [];
    expect(ex?.meta).toMatchObject({ sport: 'generic', durationS: 0, points: 0 });
  });

  it('le TCX produit est relisible par notre parseur', () => {
    const [ex] = parsePolarSession(json(session())) ?? [];
    const tcx = trackToTcx(ex?.track as never);
    expect(parseTcx(enc(tcx))).toMatchObject({
      sport: 'running',
      startTime: Date.UTC(2020, 2, 1, 9),
      points: 60,
    });
    expect(tcx).toContain('<Calories>420</Calories>');
    expect(tcx).toContain('<AverageHeartRateBpm><Value>140</Value></AverageHeartRateBpm>');
  });

  it('fuzzing : seulement null, un résultat ou ParseError', () => {
    const base = JSON.stringify(session({ points: 8 }));
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.nat({ max: base.length - 1 }), fc.integer({ min: 32, max: 126 })), {
          minLength: 1,
          maxLength: 8,
        }),
        (edits) => {
          const chars = base.split('');
          for (const [i, v] of edits) chars[i] = String.fromCharCode(v);
          try {
            const r = parsePolarSession(enc(chars.join('')));
            if (r) for (const e of r) trackToTcx(e.track);
          } catch (e) {
            expect(e).toBeInstanceOf(ParseError);
          }
        },
      ),
      { numRuns: 3_000 },
    );
  });
});

describe('traitement de l’export global', () => {
  async function names(blob: Blob): Promise<Map<string, string>> {
    const reader = new ZipReader(new BlobReader(blob));
    const out = new Map<string, string>();
    for (const e of await reader.getEntries()) {
      out.set(
        e.filename,
        await (e as { getData: (w: TextWriter) => Promise<string> }).getData(new TextWriter()),
      );
    }
    await reader.close();
    return out;
  }

  const files = async (): Promise<Blob> =>
    makeZip([
      ['polar/training-session-2020-03-01-1-abc.json', JSON.stringify(session({ points: 400 }))],
      ['polar/account-data.json', '{"name":"x"}'],
    ]);

  it('avec polarSessions : les séances deviennent des TCX, les autres JSON sont ignorés', async () => {
    const { report, archives } = await processArchive(await files(), createMemorySink(), {
      polarSessions: true,
    });
    expect(report.kept).toBe(1);
    expect(report.convertedPolar).toBe(1);
    expect(report.bySport).toEqual({ running: 1 });
    expect(report.ignored.map((i) => i.path)).toEqual(['polar/account-data.json']);
    const [entry] = [...(await names(archives[0]?.blob as Blob))];
    expect(entry?.[0]).toBe('2020-03-01T09-00-00_running.tcx');
    expect(parseTcx(enc(entry?.[1] ?? '')).points).toBe(400);
  });

  it('sans polarSessions : les JSON sont ignorés (rien n’est converti)', async () => {
    const { report, archives } = await processArchive(await files(), createMemorySink());
    expect(report.kept).toBe(0);
    expect(report.convertedPolar).toBe(0);
    expect(archives).toHaveLength(0);
  });

  it('une séance Polar illisible est un rejet CORRUPTED, sans arrêter le lot', async () => {
    const zip = await makeZip([
      ['a/training-session-ok.json', JSON.stringify(session({ points: 400 }))],
      ['a/training-session-cassee.json', '{"exercises": [ {'],
    ]);
    const { report } = await processArchive(zip, createMemorySink(), { polarSessions: true });
    expect(report.kept).toBe(1);
    expect(report.rejectedByReason.CORRUPTED).toBe(1);
  });

  it('deux séances dans un JSON donnent deux fichiers distincts', async () => {
    const s = session({ points: 400 }) as { exercises: object[] };
    s.exercises.push({ ...s.exercises[0], sport: 'CYCLING', startTime: '2020-03-01T14:00:00.000' });
    const zip = await makeZip([['a/training-session-multi.json', JSON.stringify(s)]]);
    const { report, archives } = await processArchive(zip, createMemorySink(), {
      polarSessions: true,
    });
    expect(report.kept).toBe(2);
    expect([...(await names(archives[0]?.blob as Blob))].map(([n]) => n).sort()).toEqual([
      '2020-03-01T09-00-00_running.tcx',
      '2020-03-01T13-00-00_cycling.tcx',
    ]);
  });
});
