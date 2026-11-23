import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS, LimitError, scanArchive, type ScanEvent } from '../src/index.js';
import { blobBytes, makeFit, makeZip, makeZipWithRawName } from './fixtures.js';

async function collect(blob: Blob, limits = DEFAULT_LIMITS): Promise<ScanEvent[]> {
  const out: ScanEvent[] = [];
  for await (const e of scanArchive(blob, limits)) out.push(e);
  return out;
}

describe('scanArchive', () => {
  it('trouve les FIT dans des ZIP imbriqués et ignore le reste', async () => {
    const inner = await makeZip([
      ['a.fit', makeFit()],
      ['sleep.json', '{"x":1}'],
    ]);
    const outer = await makeZip([
      ['DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_0.zip', await blobBytes(inner)],
      ['readme.txt', 'hello'],
    ]);
    const events = await collect(outer);
    expect(events.filter((e) => e.kind === 'activity')).toHaveLength(1);
    expect(
      events
        .filter((e) => e.kind === 'ignored')
        .map((e) => e.path)
        .sort(),
    ).toEqual([
      'DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_0.zip!/sleep.json',
      'readme.txt',
    ]);
  });

  it('détecte par contenu : un .fit renommé en .txt est trouvé, un faux .fit est ignoré', async () => {
    const zip = await makeZip([
      ['notes.txt', makeFit()],
      ['fake.fit', 'not a fit file'],
    ]);
    const events = await collect(zip);
    expect(events.find((e) => e.kind === 'activity')?.path).toBe('notes.txt');
    expect(events.find((e) => e.path === 'fake.fit')?.kind).toBe('ignored');
  });

  it('zip slip : le chemin est conservé comme libellé, le contenu est traité', async () => {
    const zip = await makeZipWithRawName('../../evil.fit', makeFit());
    const [e] = await collect(zip);
    expect(e).toMatchObject({ kind: 'activity', path: '../../evil.fit' });
  });

  it('refuse une profondeur > 3', async () => {
    let blob = await makeZip([['a.fit', makeFit()]]);
    for (let i = 0; i < 3; i++) blob = await makeZip([['n.zip', await blobBytes(blob)]]);
    await expect(collect(blob)).rejects.toMatchObject({ code: 'TOO_DEEP' });
  });

  it('accepte exactement 3 niveaux', async () => {
    let blob = await makeZip([['a.fit', makeFit()]]);
    for (let i = 0; i < 2; i++) blob = await makeZip([['n.zip', await blobBytes(blob)]]);
    expect((await collect(blob)).filter((e) => e.kind === 'activity')).toHaveLength(1);
  });

  it('zip bomb : ratio de compression excessif → entrée ignorée, lot non interrompu', async () => {
    const zip = await makeZip([
      ['bomb.bin', new Uint8Array(50 * 1024 * 1024)],
      ['ok.fit', makeFit()],
    ]);
    const events = await collect(zip);
    expect(events.find((e) => e.path === 'bomb.bin')).toMatchObject({ kind: 'ignored' });
    expect(events.some((e) => e.kind === 'activity')).toBe(true);
  });

  it('total décompressé max → LimitError', async () => {
    const zip = await makeZip([
      ['a.fit', makeFit()],
      ['b.fit', makeFit()],
    ]);
    await expect(
      collect(zip, { ...DEFAULT_LIMITS, maxTotalUncompressed: 100 }),
    ).rejects.toMatchObject({
      code: 'TOTAL_TOO_LARGE',
    });
  });

  it('nombre d’entrées max → LimitError', async () => {
    const zip = await makeZip([
      ['a.txt', 'a'],
      ['b.txt', 'b'],
      ['c.txt', 'c'],
    ]);
    await expect(collect(zip, { ...DEFAULT_LIMITS, maxEntries: 2 })).rejects.toBeInstanceOf(
      LimitError,
    );
  });

  it('taille d’entrée max → LimitError immédiat', () => {
    expect(() =>
      scanArchive(new Blob([new Uint8Array(10)]), { ...DEFAULT_LIMITS, maxInputSize: 5 }),
    ).toThrow(LimitError);
  });

  it('archive imbriquée illisible → erreur non fatale', async () => {
    const bad = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5]);
    const events = await collect(
      await makeZip([
        ['bad.zip', bad],
        ['ok.fit', makeFit()],
      ]),
    );
    expect(events.find((e) => e.path === 'bad.zip')?.kind).toBe('error');
    expect(events.some((e) => e.kind === 'activity')).toBe(true);
  });
});
