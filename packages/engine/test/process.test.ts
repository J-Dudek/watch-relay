import { describe, expect, it } from 'vitest';
import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import {
  createMemorySink,
  processArchive,
  type ArchiveSink,
  type OutputArchive,
} from '../src/index.js';
import { blobBytes, makeFit, makeZip } from './fixtures.js';

async function readZip(blob: Blob): Promise<Map<string, Uint8Array>> {
  const reader = new ZipReader(new BlobReader(blob));
  const out = new Map<string, Uint8Array>();
  for (const e of await reader.getEntries()) {
    if (!e.directory) out.set(e.filename, await e.getData(new Uint8ArrayWriter()));
  }
  await reader.close();
  return out;
}

/** Les FIT synthétiques font < 20 Ko : on abaisse le seuil, sauf dans le test dédié. */
const TINY_OK = { minFileSize: 0 } as const;

const day = (d: number): Date => new Date(Date.UTC(2022, 0, d, 8));

async function sample(): Promise<{ blob: Blob; fits: Record<string, Uint8Array> }> {
  const fits = {
    run1: makeFit({ sport: 'running', start: day(1) }),
    run2: makeFit({ sport: 'running', start: day(2) }),
    bike: makeFit({ sport: 'cycling', start: day(3) }),
    golf: makeFit({ sport: 'golf', start: day(4) }),
  };
  const inner = await makeZip([
    ['run1.fit', fits.run1],
    ['run1-copy.fit', fits.run1],
    ['golf.fit', fits.golf],
  ]);
  const blob = await makeZip([
    ['DI_CONNECT/UploadedFiles_0.zip', await blobBytes(inner)],
    ['run2.fit', fits.run2],
    ['bike.txt', fits.bike],
    ['broken.fit', new Uint8Array([14, 16, 0, 0, 0, 0, 0, 0, 0x2e, 0x46, 0x49, 0x54, 1, 2])],
    ['wellness.json', '{}'],
  ]);
  return { blob, fits };
}

describe('processArchive', () => {
  it('rejette TOO_SMALL avec les seuils par défaut (< 20 Ko)', async () => {
    const { blob } = await sample();
    const { report, archives } = await processArchive(blob, createMemorySink());
    expect(archives).toEqual([]);
    expect(report.rejectedByReason.TOO_SMALL).toBe(5);
  });

  it('produit des ZIP dont les FIT sont identiques octet pour octet (T4.5)', async () => {
    const { blob, fits } = await sample();
    const { report, archives } = await processArchive(blob, createMemorySink(), TINY_OK);
    expect(archives).toHaveLength(1);
    expect(archives[0]?.name).toBe('coros-import-01-2022-01_2022-01.zip');
    const files = await readZip((archives[0] as OutputArchive).blob);
    expect([...files.keys()].sort()).toEqual([
      '2022-01-01T08-00-00_running.fit',
      '2022-01-02T08-00-00_running.fit',
      '2022-01-03T08-00-00_cycling.fit',
    ]);
    expect(files.get('2022-01-01T08-00-00_running.fit')).toEqual(fits.run1);
    expect(files.get('2022-01-03T08-00-00_cycling.fit')).toEqual(fits.bike);

    expect(report.kept).toBe(3);
    expect(report.rejectedByReason).toEqual({ CORRUPTED: 1, UNSUPPORTED_SPORT: 1, DUPLICATE: 1 });
    expect(report.ignored.map((i) => i.path)).toEqual(['wellness.json']);
    expect(report.bySport).toEqual({ running: 2, cycling: 1 });
  });

  it('aucun chemin d’entrée dans les noms de sortie', async () => {
    const { blob } = await sample();
    const { archives } = await processArchive(blob, createMemorySink(), TINY_OK);
    const names = (await Promise.all(archives.map((a) => readZip(a.blob)))).flatMap((m) => [
      ...m.keys(),
    ]);
    expect([...names, ...archives.map((a) => a.name)].join('|')).not.toMatch(
      /DI_CONNECT|UploadedFiles|bike\.txt/,
    );
  });

  it('découpe en plusieurs archives selon la taille maximale', async () => {
    const { blob } = await sample();
    const { archives, report } = await processArchive(blob, createMemorySink(), {
      ...TINY_OK,
      maxBatchSize: 2500,
    });
    expect(archives.length).toBeGreaterThan(1);
    expect(archives.reduce((n, a) => n + a.fileCount, 0)).toBe(report.kept);
    expect(archives.every((a) => a.blob.size <= 2500 + 1000)).toBe(true);
  });

  it('filtre par période', async () => {
    const { blob } = await sample();
    const { report } = await processArchive(blob, createMemorySink(), {
      ...TINY_OK,
      period: { from: Date.UTC(2022, 0, 2) },
    });
    expect(report.kept).toBe(2);
    expect(report.rejectedByReason.OUT_OF_RANGE).toBe(2); // run1 et sa copie;
  });

  it('export sans activité : aucune archive, pas d’erreur', async () => {
    const blob = await makeZip([['notes.txt', 'rien']]);
    const { archives, report } = await processArchive(blob, createMemorySink());
    expect(archives).toEqual([]);
    expect(report.kept).toBe(0);
  });

  it('annulation : AbortError et sorties supprimées (T1.23)', async () => {
    const { blob } = await sample();
    const controller = new AbortController();
    let discarded = 0;
    const memory = createMemorySink();
    const sink: ArchiveSink = {
      async open(name) {
        const t = await memory.open(name);
        return {
          ...t,
          async discard() {
            discarded++;
            await t.discard();
          },
        };
      },
    };
    const promise = processArchive(blob, sink, {
      ...TINY_OK,
      signal: controller.signal,
      onProgress: (p) => {
        if (p.phase === 'write' && p.processed === 1) controller.abort();
      },
    });
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(discarded).toBeGreaterThan(0);
  });

  it('rapporte la progression', async () => {
    const { blob } = await sample();
    const phases = new Set<string>();
    await processArchive(blob, createMemorySink(), {
      ...TINY_OK,
      onProgress: (p) => phases.add(p.phase),
    });
    expect([...phases]).toEqual(['analyze', 'write']);
  });
});
