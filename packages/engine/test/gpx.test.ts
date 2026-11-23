import fc from 'fast-check';
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';
import {
  ParseError,
  analyzeFile,
  createMemorySink,
  gpxSport,
  gpxToTcx,
  parseGpx,
  parseTcx,
  processArchive,
} from '../src/index.js';
import { makeZip } from './fixtures.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** GPX « à la Strava » : extensions `gpxtpx:hr`, sans `<type>`. */
function gpx(opts: { type?: string; points?: string[]; name?: string } = {}): string {
  const pts = opts.points ?? [
    '<trkpt lat="43.5000000" lon="-1.3000000"><ele>23.9</ele><time>2016-05-06T15:41:25Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>120</gpxtpx:hr><gpxtpx:cad>80</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions></trkpt>',
    '<trkpt lat="43.5010000" lon="-1.3000000"><ele>24.1</ele><time>2016-05-06T15:41:35Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>',
    '<trkpt lat="43.5020000" lon="-1.3000000"><ele>24.5</ele><time>2016-05-06T15:41:45Z</time></trkpt>',
  ];
  return (
    '<?xml version="1.0" encoding="UTF-8"?><gpx creator="StravaGPX" version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">' +
    '<metadata><time>2016-05-06T15:41:25Z</time></metadata>' +
    `<trk><name>${opts.name ?? 'Sortie'}</name>${opts.type ? `<type>${opts.type}</type>` : ''}<trkseg>${pts.join('')}</trkseg></trk></gpx>`
  );
}

describe('parseGpx', () => {
  it('extrait début, durée, points, fréquence cardiaque', () => {
    const p = parseGpx(enc(gpx({ type: 'running' })));
    expect(p.meta).toMatchObject({
      sport: 'running',
      startTime: Date.UTC(2016, 4, 6, 15, 41, 25),
      durationS: 20,
      points: 3,
    });
    expect(p.segments[0]?.[0]).toMatchObject({ hr: 120, cad: 80, ele: '23.9' });
  });

  it('comprend les préfixes d’espace de noms variables (ns3:hr)', () => {
    const p = parseGpx(
      enc(
        gpx({
          points: [
            '<trkpt lat="1" lon="2"><time>2020-01-01T00:00:00Z</time><extensions><ns3:TrackPointExtension><ns3:hr>99</ns3:hr></ns3:TrackPointExtension></extensions></trkpt>',
          ],
        }),
      ),
    );
    expect(p.segments[0]?.[0]?.hr).toBe(99);
  });

  it('ignore les points invalides (coordonnées hors bornes, sans date) sans tout rejeter', () => {
    const p = parseGpx(
      enc(
        gpx({
          points: [
            '<trkpt lat="95" lon="2"><time>2020-01-01T00:00:00Z</time></trkpt>',
            '<trkpt lat="1" lon="2"></trkpt>',
            '<trkpt lat="abc" lon="2"><time>2020-01-01T00:00:00Z</time></trkpt>',
            '<trkpt lat="1" lon="2"><time>2020-01-01T00:00:00Z</time></trkpt>',
          ],
        }),
      ),
    );
    expect(p.meta.points).toBe(1);
  });

  it('plusieurs segments : conservés (pauses), pas fusionnés', () => {
    const seg = (t: string): string =>
      `<trkseg><trkpt lat="1" lon="2"><time>${t}</time></trkpt></trkseg>`;
    const p = parseGpx(
      enc(`<gpx><trk>${seg('2020-01-01T00:00:00Z')}${seg('2020-01-01T01:00:00Z')}</trk></gpx>`),
    );
    expect(p.segments).toHaveLength(2);
    expect(p.meta.durationS).toBe(3600);
  });

  it('refuse une trace sans point horodaté, un DTD et une entité', () => {
    expect(() => parseGpx(enc('<gpx><trk><trkseg></trkseg></trk></gpx>'))).toThrow(ParseError);
    expect(() => parseGpx(enc('<gpx><wpt lat="1" lon="2"/></gpx>'))).toThrow(ParseError);
    expect(() => parseGpx(enc('<!DOCTYPE gpx [<!ENTITY a "b">]><gpx><trk></trk></gpx>'))).toThrow(
      /DTD/,
    );
  });
});

describe('sport', () => {
  it.each([
    ['running', undefined, 'running'],
    ['Cycling', undefined, 'cycling'],
    [undefined, 'toto-Run.gpx', 'running'],
    [undefined, '2016_Ride.gpx', 'cycling'],
    [undefined, 'x-Hike.gpx', 'hiking'],
    [undefined, 'x-Walk.gpx', 'walking'],
    ['9', undefined, 'generic'], // code numérique Strava : non interprété
    [undefined, 'sortie.gpx', 'generic'],
  ])('type=%s fichier=%s → %s', (type, file, expected) => {
    expect(gpxSport(type, file)).toBe(expected);
  });

  it('le nom de fichier sert d’indice quand le GPX n’a pas de <type>', () => {
    expect(analyzeFile('a/b/2016_Run.gpx', 'gpx', enc(gpx()), { convertGpx: true })).toMatchObject({
      ok: true,
      candidate: { meta: { sport: 'running' } },
    });
  });
});

describe('gpxToTcx', () => {
  const tcx = gpxToTcx(parseGpx(enc(gpx({ type: 'running', name: 'A &lt;b&gt; &amp; "c"' }))));

  it('produit un TCX relisible par notre propre parseur', () => {
    expect(parseTcx(enc(tcx))).toMatchObject({
      sport: 'running',
      startTime: Date.UTC(2016, 4, 6, 15, 41, 25),
      points: 3,
    });
  });

  it('respecte la structure du schéma : Lap, Calories, Intensity, TriggerMethod, Trackpoint', () => {
    for (const t of [
      '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenter/v2">',
      '<Activity Sport="Running"><Id>2016-05-06T15:41:25.000Z</Id>',
      '<TotalTimeSeconds>20.0</TotalTimeSeconds>',
      '<Calories>0</Calories>',
      '<Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod>',
      '<HeartRateBpm><Value>120</Value></HeartRateBpm><Cadence>80</Cadence>',
      '<AverageHeartRateBpm><Value>130</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>140</Value></MaximumHeartRateBpm>',
    ]) {
      expect(tcx, t).toContain(t);
    }
    // Les distances cumulées croissent (≈ 111 m par millième de degré de latitude).
    const d = [...tcx.matchAll(/<Trackpoint>.*?<DistanceMeters>([\d.]+)<\/DistanceMeters>/g)].map(
      (m) => Number(m[1]),
    );
    expect(d[0]).toBe(0);
    expect(d[1]).toBeGreaterThan(100);
    expect(d[1]).toBeLessThan(125);
    expect(d[2]).toBeGreaterThan(d[1] ?? 0);
  });

  it('échappe le texte de l’utilisateur (aucun balisage injecté depuis le nom)', () => {
    expect(tcx).toContain('<Notes>A &#60;b&#62; &#38; &#34;c&#34;</Notes>');
    expect(tcx).not.toContain('<b>');
  });

  it('un sport sans équivalent TCX devient Other', () => {
    expect(gpxToTcx(parseGpx(enc(gpx({ type: 'hiking' }))))).toContain('Sport="Other"');
    expect(gpxToTcx(parseGpx(enc(gpx({ type: 'cycling' }))))).toContain('Sport="Biking"');
  });
});

describe('robustesse', () => {
  it('un GPX de 64 Ko d’espaces ou de balises ouvertes est traité en temps borné', () => {
    for (const evil of [
      '<gpx><trk><trkseg><trkpt lat="1" lon="2">' + ' '.repeat(65_000),
      '<gpx><trk>' + '<trkseg><trkpt '.repeat(5_000),
      '<gpx><trk><trkseg>' + '<trkpt lat="1" lon="2"><time>'.repeat(5_000),
    ]) {
      const t = performance.now();
      expect(() => parseGpx(enc(evil))).toThrow(ParseError);
      expect(performance.now() - t).toBeLessThan(500);
    }
  });

  it('fuzzing : jamais d’exception autre que ParseError', () => {
    const base = enc(gpx({ type: 'running' }));
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.nat({ max: base.length - 1 }), fc.integer({ min: 0, max: 255 })), {
          minLength: 1,
          maxLength: 10,
        }),
        (edits) => {
          const mutated = base.slice();
          for (const [i, v] of edits) mutated[i] = v;
          try {
            gpxToTcx(parseGpx(mutated));
          } catch (e) {
            expect(e).toBeInstanceOf(ParseError);
          }
        },
      ),
      { numRuns: 3_000 },
    );
  });
});

describe('traitement', () => {
  async function entries(blob: Blob): Promise<Map<string, string>> {
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

  // GPX assez gros pour passer la règle COROS (≥ 20 Ko après conversion).
  const bigPoints = Array.from(
    { length: 400 },
    (_, i) =>
      `<trkpt lat="${(43.5 + i * 0.0001).toFixed(7)}" lon="-1.3000000"><ele>24</ele><time>2016-05-06T${String(15 + Math.floor(i / 360)).padStart(2, '0')}:${String(Math.floor(i / 6) % 60).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${String(100 + (i % 50))}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`,
  );

  it('vers COROS : le GPX devient un .tcx nommé comme les autres, compté dans le rapport', async () => {
    const zip = await makeZip([['export/2016-05-06_Run.gpx', gpx({ points: bigPoints })]]);
    const { report, archives } = await processArchive(zip, createMemorySink());
    expect(report.kept).toBe(1);
    expect(report.bySport).toEqual({ running: 1 });
    const files = await entries(archives[0]?.blob as Blob);
    const [name, content] = [...files][0] ?? [];
    expect(name).toBe('2016-05-06T15-00-00_running.tcx');
    expect(content).toContain('<Activity Sport="Running">');
    expect(parseTcx(enc(content ?? '')).points).toBe(400);
  });

  it('vers Garmin : le GPX est conservé tel quel (Garmin l’accepte)', async () => {
    const source = gpx({ points: bigPoints, type: 'running' });
    const zip = await makeZip([['x/a.gpx', source]]);
    const { archives } = await processArchive(zip, createMemorySink(), {
      target: 'garmin',
      minFileSize: 0,
    });
    const files = await entries(archives[0]?.blob as Blob);
    const [name, content] = [...files][0] ?? [];
    expect(name).toMatch(/_running\.gpx$/);
    expect(content).toBe(source);
  });

  it('un GPX corrompu est un rejet CORRUPTED, sans arrêter le lot', async () => {
    const zip = await makeZip([
      ['ok.gpx', gpx({ points: bigPoints })],
      [
        'mauvais.gpx',
        '<?xml version="1.0"?><gpx><trk><trkseg><trkpt></trkpt></trkseg></trk></gpx>',
      ],
    ]);
    const { report } = await processArchive(zip, createMemorySink());
    expect(report.kept).toBe(1);
    expect(report.rejectedByReason.CORRUPTED).toBe(1);
  });
});
