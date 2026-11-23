import { describe, expect, it } from 'vitest';
import {
  MAX_FIT_ANALYZE_BYTES,
  analyzeFile,
  createBatchFitRule,
  makeIdAllocator,
  createMemorySink,
  parseTcx,
  processArchive,
  scanArchive,
  LimitError,
  type ScanEvent,
} from '../src/index.js';
import { cand } from './helpers.js';
import { makeFit, makeZip } from './fixtures.js';

// Corrections issues de la revue de sécurité indépendante (T2.22) : un test par défaut.

async function drain(blob: Blob, signal?: AbortSignal): Promise<ScanEvent[]> {
  const out: ScanEvent[] = [];
  for await (const e of scanArchive(blob, undefined, signal)) out.push(e);
  return out;
}

describe('ReDoS TCX', () => {
  it('64 Ko d’espaces après <Id> sont traités en temps borné', () => {
    const evil = new TextEncoder().encode(
      '<TrainingCenterDatabase><Activity Sport="Running"><Id>' + ' '.repeat(65_000),
    );
    const t = performance.now();
    expect(() => parseTcx(evil)).toThrow();
    expect(performance.now() - t).toBeLessThan(500);
  });

  it('un sport hostile est nettoyé', () => {
    const xml =
      '<TrainingCenterDatabase><Activity Sport="&lt;img onerror=x&gt;"><Id>2023-05-14T07:32:10Z</Id></Activity></TrainingCenterDatabase>';
    expect(parseTcx(new TextEncoder().encode(xml)).sport).not.toMatch(/[<>=&;]/);
  });
});

describe('répertoire central ZIP', () => {
  it('un ZIP déclarant des millions d’entrées est refusé avant toute allocation', async () => {
    // EOCD seul : 3 M d'entrées déclarées, répertoire central de 3 M × 54 o.
    const eocd = new Uint8Array(22);
    const v = new DataView(eocd.buffer);
    v.setUint32(0, 0x06054b50, true);
    v.setUint16(8, 0xffff, true);
    v.setUint16(10, 0xffff, true);
    v.setUint32(12, 3_000_000 * 54, true);
    const bomb = new Blob([new Uint8Array(1000), eocd]);
    await expect(drain(bomb)).rejects.toMatchObject({ code: 'TOO_MANY_ENTRIES' });
  });
});

describe('identifiants d’entrées', () => {
  it('« a », « a », « a#2 » donnent trois identifiants distincts, de façon déterministe', () => {
    const run = (): string[] => {
      const idFor = makeIdAllocator();
      return ['a', 'a', 'a#2', 'a#2'].map(idFor);
    };
    const ids = run();
    expect(new Set(ids).size).toBe(4);
    expect(run()).toEqual(ids); // les deux passes doivent produire les mêmes ids
  });
});

describe('fichier plus gros qu’un lot', () => {
  it('la règle écarte tout fichier qui ne tient dans aucun lot', () => {
    const rule = createBatchFitRule(10_000);
    expect(rule.check(cand({ size: 20_000 }))?.reason).toBe('TOO_LARGE');
    expect(rule.check(cand({ size: 5_000 }))).toBeNull();
  });

  it('processArchive : maxBatchSize réduit → TOO_LARGE, le reste est traité', async () => {
    const zip = await makeZip([
      ['small.fit', makeFit({ start: new Date(Date.UTC(2022, 0, 1, 8)) })],
      ['big.fit', makeFit({ start: new Date(Date.UTC(2022, 0, 2, 8)), minSize: 40_000 })],
    ]);
    const { report } = await processArchive(zip, createMemorySink(), {
      minFileSize: 0,
      maxBatchSize: 5_000,
    });
    expect(report.rejectedByReason.TOO_LARGE).toBeGreaterThan(0);
    expect(report.kept).toBe(1);
  });
});

describe('FIT surdimensionné', () => {
  it('un FIT au-delà du plafond d’analyse est refusé sans être décodé', () => {
    const out = analyzeFile('x', 'fit', new Uint8Array(MAX_FIT_ANALYZE_BYTES + 1));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rejection.reason).toBe('TOO_LARGE');
  });
});

describe('annulation', () => {
  it('un signal déjà annulé interrompt le parcours', async () => {
    const zip = await makeZip([['a.fit', makeFit({ minSize: 40_000 })]]);
    const controller = new AbortController();
    controller.abort();
    await expect(drain(zip, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('LimitError reste distinct de l’annulation', () => {
    expect(new LimitError('TOO_DEEP', 'x')).not.toHaveProperty('name', 'AbortError');
  });
});
