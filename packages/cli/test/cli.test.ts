import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { blobBytes, makeFit, makeGpx, makeZip, gzip } from '../../engine/test/fixtures';
import { parseCli } from '../src/args';
import { EXIT, runCli } from '../src/run';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'watch-relay-cli-test-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function capture(): {
  out: string[];
  err: string[];
  io: { out: (s: string) => void; err: (s: string) => void };
} {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      out: (s) => out.push(s),
      err: (s) => err.push(s),
    },
  };
}

const day = (d: number): Date => new Date(Date.UTC(2022, 0, d, 8));
async function garminExport(): Promise<string> {
  const fit = (sport: string, d: number): Uint8Array =>
    makeFit({ sport, start: day(d), minSize: 40_000 });
  const zip = await makeZip([
    ['run.fit', fit('running', 1)],
    ['run-copy.fit', fit('running', 1)],
    ['golf.fit', fit('golf', 4)],
    ['bike.fit', fit('cycling', 3)],
  ]);
  const path = join(dir, 'export.zip');
  await writeFile(path, await blobBytes(zip));
  return path;
}

describe('parseCli', () => {
  it('valeurs par défaut : garmin → coros, dossier watch-relay-out', () => {
    const r = parseCli(['export.zip']);
    expect(r).toMatchObject({
      kind: 'run',
      options: { source: 'garmin', target: 'coros', out: 'watch-relay-out', dryRun: false },
    });
  });
  it('--from coros : la destination par défaut devient garmin', () => {
    expect(parseCli(['x.zip', '--from', 'coros'])).toMatchObject({
      options: { target: 'garmin' },
    });
  });
  it.each([
    [['x.zip', '--to', 'strava'], /--to/],
    [['x.zip', '--from', 'coros', '--to', 'coros'], /différer/],
    [['x.zip', '--from', 'nope'], /--from/],
    [['x.zip', '--since', '2022-13-40'], /--since/],
    [['x.zip', '--since', '2022-02-01', '--until', '2022-01-01'], /précéder/],
    [['x.zip', '--reclassify', 'golf'], /sport=sport/],
    [['x.zip', '--reclassify', 'golf=curling'], /accepté/],
    [['x.zip', '--from', 'strava', '--health'], /--health/],
    [[], /archive/],
    [['a.zip', 'b.zip'], /Une seule/],
    [['x.zip', '--inconnue'], /./],
  ])('refuse %j', (argv, message) => {
    const r = parseCli(argv);
    expect(r.kind).toBe('error');
    expect(r.kind === 'error' && r.message).toMatch(message);
  });
  it('--until est inclusif (fin de journée)', () => {
    const r = parseCli(['x.zip', '--since', '2022-01-02', '--until', '2022-01-03']);
    expect(r.kind === 'run' && r.options.period).toEqual({
      from: Date.UTC(2022, 0, 2),
      to: Date.UTC(2022, 0, 4) - 1,
    });
  });
});

describe('runCli', () => {
  it('--help et --version : code 0', async () => {
    const a = capture();
    expect(await runCli(['--help'], a.io)).toBe(EXIT.ok);
    expect(a.out.join('')).toContain('Usage');
    const b = capture();
    expect(await runCli(['--version'], b.io)).toBe(EXIT.ok);
    expect(b.out.join('')).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('usage incorrect : code 2 et aide', async () => {
    const c = capture();
    expect(await runCli(['--to', 'strava', 'x.zip'], c.io)).toBe(EXIT.usage);
    expect(c.err.join('')).toContain('Erreur');
  });

  it('fichier introuvable : code 2', async () => {
    const c = capture();
    expect(await runCli([join(dir, 'absent.zip')], c.io)).toBe(EXIT.usage);
  });

  it('traite un export : archives écrites, rapport avec sports non pris en charge et doublons', async () => {
    const out = join(dir, 'sortie');
    const c = capture();
    const code = await runCli([await garminExport(), '--out', out], c.io);
    expect(code).toBe(EXIT.ok);
    const text = c.out.join('');
    expect(text).toContain('2 activité(s) prête(s)');
    expect(text).toMatch(/Sports non pris en charge \(1\)/);
    expect(text).toContain('golf (1)');
    expect(text).toContain('--reclassify');
    expect(text).toMatch(/Doublons \(1\)/);
    expect(text).toMatch(/conservé :/);
    const files = await readdir(out);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^coros-import-01-2022-01_2022-01\.zip$/);
  });

  it('--reclassify : le sport est importé et signalé', async () => {
    const c = capture();
    const code = await runCli(
      [await garminExport(), '--out', join(dir, 's'), '--reclassify', 'golf=walking'],
      c.io,
    );
    expect(code).toBe(EXIT.ok);
    const text = c.out.join('');
    expect(text).toContain('3 activité(s) prête(s)');
    expect(text).toContain('golf → walking (1)');
  });

  it('--dry-run : rien n’est écrit dans le dossier de sortie', async () => {
    const out = join(dir, 'jamais');
    const c = capture();
    expect(await runCli([await garminExport(), '--out', out, '--dry-run'], c.io)).toBe(EXIT.ok);
    expect(c.out.join('')).toContain('simulation');
    await expect(readdir(out)).rejects.toThrow();
  });

  it('--json : rapport complet exploitable par un script', async () => {
    const c = capture();
    await runCli([await garminExport(), '--out', join(dir, 's'), '--json'], c.io);
    const json = JSON.parse(c.out.join('')) as {
      report: { kept: number; rejected: { reason: string; detail?: string }[] };
      archives: { name: string; path: string }[];
    };
    expect(json.report.kept).toBe(2);
    expect(json.report.rejected.map((r) => r.reason).sort()).toEqual([
      'DUPLICATE',
      'UNSUPPORTED_SPORT',
    ]);
    expect(json.archives[0]?.path).toContain('coros-import-01');
  });

  it('--report : CSV détaillé écrit', async () => {
    const csv = join(dir, 'rapport.csv');
    const c = capture();
    await runCli([await garminExport(), '--out', join(dir, 's'), '--report', csv], c.io);
    const text = await readFile(csv, 'utf8');
    expect(text).toContain('UNSUPPORTED_SPORT');
    expect(text).toContain('DUPLICATE');
  });

  it('--since / --until filtrent par période', async () => {
    const c = capture();
    await runCli(
      [
        await garminExport(),
        '--out',
        join(dir, 's'),
        '--since',
        '2022-01-03',
        '--until',
        '2022-01-03',
      ],
      c.io,
    );
    expect(c.out.join('')).toContain('1 activité(s) prête(s)');
    expect(c.out.join('')).toContain('Hors de la période choisie');
  });

  it('aucune activité importable : code 3', async () => {
    const path = join(dir, 'vide.zip');
    await writeFile(path, await blobBytes(await makeZip([['notes.txt', 'rien']])));
    const c = capture();
    expect(await runCli([path, '--out', join(dir, 's')], c.io)).toBe(EXIT.nothing);
    expect(c.out.join('')).toContain('Aucune activité importable');
  });

  it('archive illisible : code 1 avec un message, sans trace de pile', async () => {
    const path = join(dir, 'faux.zip');
    await writeFile(path, 'ceci n’est pas un zip');
    const c = capture();
    expect(await runCli([path, '--out', join(dir, 's')], c.io)).toBe(EXIT.failure);
    expect(c.err.join('')).toMatch(/^Erreur : /);
    expect(c.err.join('')).not.toContain('    at ');
  });

  it('export Strava : .gz décompressés, activités sans fichier signalées', async () => {
    const zip = await makeZip([
      [
        'activities.csv',
        'Activity ID,Activity Type,Filename\n1,Hike,activities/1.gpx.gz\n2,Ride,\n',
      ],
      ['activities/1.gpx.gz', await gzip(makeGpx(2500))],
    ]);
    const path = join(dir, 'strava.zip');
    await writeFile(path, await blobBytes(zip));
    const c = capture();
    const code = await runCli([path, '--from', 'strava', '--out', join(dir, 's')], c.io);
    expect(code).toBe(EXIT.ok);
    const text = c.out.join('');
    expect(text).toContain('1 activité(s) prête(s)');
    expect(text).toContain('1 activité(s) Strava sans fichier');
    expect(text).toContain('hiking');
  });

  it('interruption : code 130 et aucun fichier laissé', async () => {
    const controller = new AbortController();
    controller.abort();
    const out = join(dir, 's');
    const c = capture();
    expect(
      await runCli([await garminExport(), '--out', out], { ...c.io, signal: controller.signal }),
    ).toBe(EXIT.interrupted);
    const left = await readdir(out).catch(() => []);
    expect(left).toEqual([]);
  });
});
