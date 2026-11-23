import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Batch } from '../src/index.js';
import { archiveName, entryName, splitIntoBatches } from '../src/index.js';
import { cand } from './helpers.js';

describe('splitIntoBatches', () => {
  it('découpe dans l’ordre chronologique sans dépasser la limite', () => {
    const items = [3, 1, 2].map((n) => cand({ id: `c${String(n)}`, size: 3900, startTime: n }));
    const batches = splitIntoBatches(items, 10_000);
    expect(batches.map((b) => b.items.map((c) => c.id))).toEqual([['c1', 'c2'], ['c3']]);
  });
  it('lève une erreur pour un fichier trop gros', () => {
    expect(() => splitIntoBatches([cand({ size: 20_000 })], 10_000)).toThrow(RangeError);
  });
  it('liste vide → aucun lot', () => {
    expect(splitIntoBatches([])).toEqual([]);
  });

  it('propriété : aucun lot > limite, aucun fichier perdu ni dupliqué (T4.6)', () => {
    const limit = 100_000;
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 90_000 }), { maxLength: 200 }), (sizes) => {
        const items = sizes.map((size, i) => cand({ id: `f${String(i)}`, size, startTime: i }));
        const batches = splitIntoBatches(items, limit);
        expect(batches.every((b) => b.estimatedSize <= limit)).toBe(true);
        const ids = batches.flatMap((b) => b.items.map((c) => c.id));
        expect(ids).toEqual(items.map((c) => c.id));
      }),
      { numRuns: 1000 },
    );
  });
});

describe('nommage', () => {
  it('nom d’entrée normalisé en UTC', () => {
    expect(entryName(cand(), new Set())).toBe('2023-05-14T07-32-10_running.fit');
  });
  it('assainit le sport (pas de chemin ni de contrôle)', () => {
    const name = entryName(cand({ sport: '../../evil\u0000/x' }), new Set());
    expect(name).toBe('2023-05-14T07-32-10_evil_x.fit');
    expect(name).toMatch(/^[A-Za-z0-9_.-]+$/);
    expect(name).not.toContain('..');
    expect(entryName(cand({ sport: '///' }), new Set())).toContain('_unknown.');
  });
  it('garantit l’unicité', () => {
    const taken = new Set<string>();
    expect(entryName(cand(), taken)).toBe('2023-05-14T07-32-10_running.fit');
    expect(entryName(cand(), taken)).toBe('2023-05-14T07-32-10_running-2.fit');
  });
  it('nom d’archive généré, sans chemin d’entrée', () => {
    const items = [
      cand({ id: 'C:\\secret\\x', startTime: Date.UTC(2019, 2, 1) }),
      cand({ id: 'b', startTime: Date.UTC(2021, 6, 1) }),
    ];
    const [batch] = splitIntoBatches(items);
    expect(archiveName(batch as Batch, 0)).toBe('coros-import-01-2019-03_2021-07.zip');
  });
});
