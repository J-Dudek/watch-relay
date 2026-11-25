import fc from 'fast-check';
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';
import {
  applySportHints,
  createMemorySink,
  parseCsv,
  parseStravaCsv,
  processArchive,
  stravaSport,
  type Candidate,
} from '../src/index.js';
import { gzip, makeFit, makeGpx, makeZip } from './fixtures.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('parseCsv', () => {
  it('guillemets, virgules, guillemets doublés et sauts de ligne dans un champ', () => {
    const rows = parseCsv('a,b,c\r\n"x, y","il a dit ""oui""","l1\nl2"\n1,2,3\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'il a dit "oui"', 'l1\nl2'],
      ['1', '2', '3'],
    ]);
  });
  it('ignore le BOM et les lignes vides, plafonne le nombre de lignes', () => {
    expect(parseCsv('﻿a,b\n\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\n'.repeat(50), 10)).toHaveLength(10);
  });
  it('ne lève jamais (fuzz)', () => {
    fc.assert(fc.property(fc.string({ maxLength: 400 }), (s) => Array.isArray(parseCsv(s))));
  });
});

describe('stravaSport', () => {
  it.each([
    ['Run', 'running'],
    ['Trail Run', 'running'],
    ['Virtual Ride', 'cycling'],
    ['Mountain Bike Ride', 'cycling'],
    ['Course à pied', 'running'],
    ['Randonnée', 'hiking'],
    ['Weight Training', 'training'],
    ['Alpine Ski', 'alpine_skiing'],
  ])('%s → %s', (type, sport) => {
    expect(stravaSport(type)).toBe(sport);
  });
  it('un type inconnu n’est pas deviné', () => {
    expect(stravaSport('Kitesurf')).toBeUndefined();
    expect(stravaSport('')).toBeUndefined();
  });
});

const CSV_EN =
  'Activity ID,Activity Date,Activity Name,Activity Type,Filename\n' +
  '1,"Jun 1, 2021, 8:00:00 AM","Sortie, du matin",Run,activities/1.gpx.gz\n' +
  '2,"Jun 2, 2021, 8:00:00 AM",Manuel,Ride,\n' +
  '3,"Jun 3, 2021, 8:00:00 AM",Vélo,Ride,activities/3.fit.gz\n';

describe('parseStravaCsv', () => {
  it('en-têtes anglais : sports par nom de fichier, activités sans fichier comptées', () => {
    const m = parseStravaCsv(enc(CSV_EN));
    expect(Object.fromEntries(m.sports)).toEqual({ '1.gpx.gz': 'running', '3.fit.gz': 'cycling' });
    expect(m).toMatchObject({ withoutFile: 1, rows: 3 });
  });
  it('en-têtes localisés ou inconnus : colonnes retrouvées par leur contenu', () => {
    const csv =
      'ID,Date,Nom,Type,Fichier\n9,x,y,Course à pied,activities/9.fit.gz\n8,x,y,Vélo,activities/8.fit.gz\n';
    expect(Object.fromEntries(parseStravaCsv(enc(csv)).sports)).toEqual({
      '9.fit.gz': 'running',
      '8.fit.gz': 'cycling',
    });
  });
  it('CSV illisible ou vide : métadonnées vides, jamais d’erreur', () => {
    expect(parseStravaCsv(enc('')).sports.size).toBe(0);
    expect(parseStravaCsv(enc('rien\nd utile')).sports.size).toBe(0);
    expect(parseStravaCsv(new Uint8Array([0xff, 0xfe, 0x00])).rows).toBeGreaterThanOrEqual(0);
  });
});

describe('applySportHints', () => {
  const base = (over: Partial<Candidate>): Candidate => ({
    id: 'activities/1.gpx.gz',
    format: 'tcx',
    convertedFrom: 'gpx',
    size: 1000,
    meta: { sport: 'generic', startTime: 0 },
    ...over,
  });
  const hints = new Map([['1.gpx.gz', 'running']]);
  it('remplace un sport générique ; la taille du TCX suit le libellé (Other → Running)', () => {
    const [c] = applySportHints([base({})], hints);
    expect(c?.meta.sport).toBe('running');
    expect(c?.size).toBe(1000 + 'Running'.length - 'Other'.length);
  });
  it('n’écrase jamais un sport lu dans le fichier', () => {
    const [c] = applySportHints([base({ meta: { sport: 'cycling', startTime: 0 } })], hints);
    expect(c?.meta.sport).toBe('cycling');
  });
  it('apparie aussi les identifiants suffixés (#2) et ignore les inconnus', () => {
    expect(applySportHints([base({ id: 'x!/activities/1.gpx.gz#2' })], hints)[0]?.meta.sport).toBe(
      'running',
    );
    expect(applySportHints([base({ id: 'activities/2.gpx.gz' })], hints)[0]?.meta.sport).toBe(
      'generic',
    );
  });
});

async function names(blob: Blob): Promise<string[]> {
  const r = new ZipReader(new BlobReader(blob));
  const out = (await r.getEntries()).map((e) => e.filename);
  await r.close();
  return out;
}

describe('export Strava de bout en bout', () => {
  const fit = makeFit({
    sport: 'cycling',
    minSize: 25_000,
    start: new Date(Date.UTC(2021, 5, 3, 8)),
  });
  async function archive(): Promise<Blob> {
    return makeZip([
      ['activities.csv', CSV_EN],
      ['activities/1.gpx.gz', await gzip(makeGpx(1500))],
      ['activities/3.fit.gz', await gzip(fit)],
      ['media/photo.jpg', 'pas une activité'],
    ]);
  }

  it('vers COROS : .gz décompressés, GPX converti en TCX avec le sport du CSV, activité manuelle signalée', async () => {
    const result = await processArchive(await archive(), createMemorySink(), {
      stravaMetadata: true,
      minFileSize: 0,
    });
    expect(result.report).toMatchObject({
      kept: 2,
      convertedGpx: 1,
      stravaWithoutFile: 1,
      bySport: { running: 1, cycling: 1 },
    });
    const files = await names(result.archives[0]?.blob as Blob);
    expect(files.sort()).toEqual([
      '2021-06-01T08-00-00_running.tcx',
      '2021-06-03T08-00-00_cycling.fit',
    ]);
    const r = new ZipReader(new BlobReader(result.archives[0]?.blob as Blob));
    const tcx = (await r.getEntries()).find((e) => e.filename.endsWith('.tcx'));
    expect(
      await (tcx as { getData: (w: TextWriter) => Promise<string> }).getData(new TextWriter()),
    ).toContain('Sport="Running"');
    await r.close();
  });

  it('sans l’option : les .gz sont décompressés mais le sport reste celui du fichier (generic → Other)', async () => {
    const result = await processArchive(await archive(), createMemorySink(), { minFileSize: 0 });
    expect(result.report.stravaWithoutFile).toBeUndefined();
    expect(result.report.bySport).toMatchObject({ generic: 1 });
  });

  it('vers Garmin : le GPX est conservé tel quel', async () => {
    const result = await processArchive(await archive(), createMemorySink(), {
      target: 'garmin',
      stravaMetadata: true,
    });
    expect(result.report.kept).toBe(2);
    expect(result.report.convertedGpx).toBe(0);
    expect((await names(result.archives[0]?.blob as Blob)).some((n) => n.endsWith('.gpx'))).toBe(
      true,
    );
  });
});
