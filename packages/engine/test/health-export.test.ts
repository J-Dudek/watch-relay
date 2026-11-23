import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';
import {
  HealthCollector,
  MAX_ROWS_PER_CATEGORY,
  createMemorySink,
  flattenJson,
  healthCategory,
  isHealthJsonPath,
  processArchive,
  scanArchive,
  type ScanEvent,
} from '../src/index.js';
import { makeFit, makeZip } from './fixtures.js';

// Les JSON ci-dessous imitent l'allure des exports Garmin (non validée sur un vrai export) : l'extraction
// ne suppose aucun champ, elle aplatit ce qu'elle trouve.
const SLEEP = JSON.stringify([
  {
    calendarDate: '2023-05-01',
    deepSleepSeconds: 5400,
    remSleepSeconds: 4200,
    sleepScores: { overall: { value: 81 } },
  },
  {
    calendarDate: '2023-05-02',
    deepSleepSeconds: 6000,
    remSleepSeconds: 3900,
    sleepScores: { overall: { value: 77 } },
  },
]);
const UDS = JSON.stringify([
  { calendarDate: '2023-05-01', totalSteps: 9123, restingHeartRate: 52 },
]);

describe('catégories', () => {
  it.each([
    ['x/2023_sleepData.json', 'sommeil'],
    ['x/hrvStatus.json', 'vfc'],
    ['x/UDSFile_2023.json', 'activite-quotidienne'],
    ['x/restingHeartRate.json', 'frequence-cardiaque'],
    ['x/wellnessStress.json', 'stress'],
    ['x/wellness.json', 'autre'],
  ])('%s → %s', (path, category) => {
    expect(healthCategory(path)).toBe(category);
  });

  it('seuls les JSON de santé sont candidats', () => {
    expect(isHealthJsonPath('a/DI-Connect-Wellness/x.json')).toBe(true);
    expect(isHealthJsonPath('a/DI-Connect-Wellness/x.fit')).toBe(false);
    expect(isHealthJsonPath('a/profile.json')).toBe(false);
  });
});

describe('flattenJson', () => {
  it('aplatit les objets imbriqués avec « . » et ignore les tableaux d’objets', () => {
    const rows = flattenJson([
      {
        a: 1,
        b: { c: 'x', d: { e: true } },
        timeline: [{ t: 1 }, { t: 2 }],
        tags: [1, 2, 3],
        n: null,
      },
    ]);
    expect(rows).toEqual([{ a: 1, 'b.c': 'x', 'b.d.e': true, tags: '1|2|3', n: null }]);
  });

  it('accepte un objet seul et ignore les éléments qui ne sont pas des objets', () => {
    expect(flattenJson({ k: 1 })).toEqual([{ k: 1 }]);
    expect(flattenJson([1, 'x', null, { k: 2 }])).toEqual([{ k: 2 }]);
    expect(flattenJson('texte')).toEqual([]);
  });
});

describe('HealthCollector', () => {
  const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

  it('produit un CSV par catégorie : BOM, « ; », colonnes de date d’abord', () => {
    const c = new HealthCollector();
    c.add('a/2023_sleepData.json', bytes(SLEEP));
    c.add('a/UDSFile_2023.json', bytes(UDS));
    const files = Object.fromEntries(c.toCsvFiles().map((f) => [f.name, f.content]));
    expect(Object.keys(files).sort()).toEqual([
      'sante-activite-quotidienne.csv',
      'sante-sommeil.csv',
    ]);
    const sleep = files['sante-sommeil.csv'] ?? '';
    expect(sleep.charCodeAt(0)).toBe(0xfeff);
    const lines = sleep.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe(
      'calendarDate;deepSleepSeconds;remSleepSeconds;sleepScores.overall.value',
    );
    expect(lines[1]).toBe('2023-05-01;5400;4200;81');
    expect(c.stats()).toMatchObject({ files: 2, rows: 3, truncated: false });
  });

  it('fusionne les fichiers d’une catégorie (union des colonnes)', () => {
    const c = new HealthCollector();
    c.add('a/1_sleepData.json', bytes('[{"calendarDate":"d1","x":1}]'));
    c.add('a/2_sleepData.json', bytes('[{"calendarDate":"d2","y":2}]'));
    const csv = c.toCsvFiles()[0]?.content ?? '';
    expect(csv.slice(1).trim().split('\r\n')).toEqual(['calendarDate;x;y', 'd1;1;', 'd2;;2']);
  });

  it('neutralise les formules et échappe les séparateurs (injection CSV)', () => {
    const c = new HealthCollector();
    c.add(
      'a/x_sleepData.json',
      bytes('[{"calendarDate":"d","note":"=HYPERLINK(\\"http://evil\\")","t":"a;b"}]'),
    );
    const row = (c.toCsvFiles()[0]?.content ?? '').trim().split('\r\n')[1] ?? '';
    expect(row).toContain("'=HYPERLINK");
    expect(row).toContain('"a;b"');
  });

  it('un JSON invalide ou vide est compté, sans exception', () => {
    const c = new HealthCollector();
    c.add('a/x_sleepData.json', bytes('{pas du json'));
    c.add('a/y_sleepData.json', bytes('[]'));
    expect(c.stats()).toMatchObject({ files: 0, unreadable: 2, rows: 0 });
    expect(c.hasData).toBe(false);
  });

  it('plafonne le nombre de lignes par catégorie et le signale', () => {
    const c = new HealthCollector();
    const rows = Array.from({ length: MAX_ROWS_PER_CATEGORY + 5 }, (_, i) => ({
      calendarDate: String(i),
    }));
    c.add('a/x_sleepData.json', bytes(JSON.stringify(rows)));
    expect(c.stats().rows).toBe(MAX_ROWS_PER_CATEGORY);
    expect(c.stats().truncated).toBe(true);
  });
});

describe('scan et traitement', () => {
  async function exportWithHealth(): Promise<Blob> {
    return makeZip([
      ['run.fit', makeFit({ minSize: 40_000 })],
      ['DI_CONNECT/DI-Connect-Wellness/2023_sleepData.json', SLEEP],
      ['DI_CONNECT/DI-Connect-Aggregator/UDSFile_2023.json', UDS],
      ['DI_CONNECT/DI-Connect-User/profile.json', '{"name":"x"}'],
    ]);
  }

  it('sans option, le contenu de la santé n’est jamais fourni', async () => {
    const events: ScanEvent[] = [];
    for await (const e of scanArchive(await exportWithHealth())) events.push(e);
    expect(events.some((e) => e.kind === 'health')).toBe(false);
  });

  it('avec collectHealth, seuls les JSON de santé sont fournis (pas le profil)', async () => {
    const paths: string[] = [];
    for await (const e of scanArchive(await exportWithHealth(), undefined, undefined, {
      collectHealth: true,
    })) {
      if (e.kind === 'health') paths.push(e.path);
    }
    expect(paths.sort()).toEqual([
      'DI_CONNECT/DI-Connect-Aggregator/UDSFile_2023.json',
      'DI_CONNECT/DI-Connect-Wellness/2023_sleepData.json',
    ]);
  });

  it('healthExport : archive de CSV à part, hors du circuit d’import', async () => {
    const { report, archives } = await processArchive(
      await exportWithHealth(),
      createMemorySink(),
      {
        healthExport: true,
      },
    );
    expect(report.kept).toBe(1);
    expect(report.health).toBe(2);
    expect(report.healthExport).toMatchObject({ files: 2, rows: 3 });

    const health = archives.filter((a) => a.kind === 'health');
    expect(health).toHaveLength(1);
    expect(health[0]?.name).toBe('garmin-sante.zip');
    expect(archives.filter((a) => a.kind !== 'health')).toHaveLength(1);

    const reader = new ZipReader(new BlobReader(health[0]?.blob as Blob));
    const names = (await reader.getEntries()).map((e) => e.filename).sort();
    expect(names).toEqual(['sante-activite-quotidienne.csv', 'sante-sommeil.csv']);
    const sleep = (await reader.getEntries()).find((e) => e.filename === 'sante-sommeil.csv');
    const text = await (sleep as { getData: (w: TextWriter) => Promise<string> }).getData(
      new TextWriter(),
    );
    expect(text).toContain('2023-05-01;5400;4200;81');
    await reader.close();
  });

  it('sans healthExport : aucune archive de santé, mais les fichiers sont comptés', async () => {
    const { report, archives } = await processArchive(await exportWithHealth(), createMemorySink());
    expect(archives.some((a) => a.kind === 'health')).toBe(false);
    expect(report.healthExport).toBeUndefined();
    expect(report.health).toBe(2);
  });

  it('un export sans activité mais avec de la santé produit quand même l’archive de santé', async () => {
    const zip = await makeZip([['DI_CONNECT/DI-Connect-Wellness/2023_sleepData.json', SLEEP]]);
    const { report, archives } = await processArchive(zip, createMemorySink(), {
      healthExport: true,
    });
    expect(report.kept).toBe(0);
    expect(archives.map((a) => a.kind)).toEqual(['health']);
  });
});
