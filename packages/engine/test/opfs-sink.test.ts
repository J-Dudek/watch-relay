import { describe, expect, it } from 'vitest';
import { clearDirectory, createOpfsSink, type DirectoryLike } from '../src/index.js';

function fakeDir(maxWrite = Infinity): { dir: DirectoryLike; files: Map<string, Uint8Array[]> } {
  const files = new Map<string, Uint8Array[]>();
  const dir: DirectoryLike = {
    getFileHandle(name) {
      files.set(name, []);
      const parts = files.get(name) as Uint8Array[];
      return Promise.resolve({
        createSyncAccessHandle: () =>
          Promise.resolve({
            write(buf: Uint8Array, opts?: { at: number }) {
              const n = Math.min(buf.byteLength, maxWrite);
              parts.push(new Uint8Array(buf.subarray(0, n)));
              expect(opts?.at).toBe(parts.slice(0, -1).reduce((s, p) => s + p.byteLength, 0));
              return n;
            },
            truncate() {},
            flush() {},
            close() {},
          }),
        getFile: () => Promise.resolve(new File(parts as BlobPart[], name)),
      });
    },
    removeEntry(name) {
      files.delete(name);
      return Promise.resolve();
    },
    keys: async function* () {
      await Promise.resolve();
      yield* [...files.keys()];
    },
  };
  return { dir, files };
}

describe('createOpfsSink', () => {
  it('écrit en flux, y compris quand le handle écrit par morceaux', async () => {
    const { dir } = fakeDir(3);
    const target = await createOpfsSink(dir).open('a.zip');
    const w = target.writable.getWriter();
    await w.write(new Uint8Array([1, 2, 3, 4, 5, 6, 7]));
    await w.write(new Uint8Array([8, 9]));
    await w.close();
    const file = await target.close();
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('échoue proprement si le disque est plein', async () => {
    const { dir } = fakeDir(0);
    const target = await createOpfsSink(dir).open('a.zip');
    await expect(target.writable.getWriter().write(new Uint8Array(4))).rejects.toThrow(/OPFS/);
  });

  it('discard supprime le fichier, clearDirectory vide tout (T1.23, T1.24)', async () => {
    const { dir, files } = fakeDir();
    const sink = createOpfsSink(dir);
    await (await sink.open('a.zip')).discard();
    expect(files.size).toBe(0);
    await sink.open('b.zip');
    await sink.open('c.zip');
    await clearDirectory(dir);
    expect(files.size).toBe(0);
  });
});
