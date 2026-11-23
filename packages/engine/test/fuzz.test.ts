import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ArchiveError,
  DEFAULT_LIMITS,
  LimitError,
  NotActivityError,
  ParseError,
  analyzeFile,
  parseFit,
  parseTcx,
  scanArchive,
} from '../src/index.js';
import { blobBytes, makeFit, makeZip } from './fixtures.js';

// T2.4 : fuzzing des parseurs FIT/TCX et du lecteur ZIP. Propriété commune : sur n'importe quelle
// entrée, on obtient un résultat ou une erreur typée (`ParseError` / `LimitError`) — jamais une
// exception inattendue, jamais un blocage.

const RUNS = 10_000;
const MAX_MS = 2_000;

/** CRC-16 du format FIT. */
function fitCrc(bytes: Uint8Array): number {
  const table = [
    0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401,
    0x5000, 0x9c01, 0x8801, 0x4400,
  ] as const;
  let crc = 0;
  for (const byte of bytes) {
    let tmp = table[crc & 0xf] ?? 0;
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ (table[byte & 0xf] ?? 0);
    tmp = table[crc & 0xf] ?? 0;
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ (table[(byte >> 4) & 0xf] ?? 0);
  }
  return crc;
}

/** Réécrit les CRC d'en-tête et de fichier pour que les mutations atteignent le décodeur. */
function fixCrc(fit: Uint8Array): Uint8Array {
  const out = fit.slice();
  const view = new DataView(out.buffer);
  if (out.length >= 16 && out[0] === 14) view.setUint16(12, fitCrc(out.subarray(0, 12)), true);
  if (out.length >= 2)
    view.setUint16(out.length - 2, fitCrc(out.subarray(0, out.length - 2)), true);
  return out;
}

const VALID_FIT = makeFit();
const VALID_TCX = new TextEncoder().encode(
  '<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Running">' +
    '<Id>2023-05-14T07:32:10Z</Id><Lap StartTime="2023-05-14T07:32:10Z"></Lap></Activity>' +
    '</Activities></TrainingCenterDatabase>',
);

const mutations = (len: number) =>
  fc.array(fc.tuple(fc.nat({ max: len - 1 }), fc.integer({ min: 0, max: 255 })), {
    minLength: 1,
    maxLength: 8,
  });

function mutate(base: Uint8Array, edits: [number, number][], cut?: number): Uint8Array {
  const out = base.slice();
  for (const [i, v] of edits) out[i] = v;
  return cut === undefined ? out : out.subarray(0, Math.max(0, cut));
}

function timed<T>(fn: () => T): T {
  const t = performance.now();
  const r = fn();
  expect(performance.now() - t).toBeLessThan(MAX_MS);
  return r;
}

function expectMetaOrParseError(fn: () => unknown): void {
  try {
    timed(fn);
  } catch (e) {
    // Un FIT muté peut devenir un fichier valide d'un autre type (santé, réglages) : erreur typée aussi.
    expect(e instanceof ParseError || e instanceof NotActivityError).toBe(true);
  }
}

describe('fuzz FIT', () => {
  it('octets aléatoires : résultat ou ParseError', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 512 }), (bytes) => {
        expectMetaOrParseError(() => parseFit(bytes));
      }),
      { numRuns: RUNS },
    );
  });

  it('FIT valide muté (CRC recalculés pour atteindre le décodeur) : jamais d’exception inattendue', () => {
    fc.assert(
      fc.property(
        mutations(VALID_FIT.length),
        fc.option(fc.nat({ max: VALID_FIT.length })),
        (edits, cut) => {
          const mutated = fixCrc(mutate(VALID_FIT, edits, cut ?? undefined));
          expectMetaOrParseError(() => parseFit(mutated));
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('FIT valide tronqué à toute longueur', () => {
    for (let len = 0; len < VALID_FIT.length; len++) {
      expectMetaOrParseError(() => parseFit(VALID_FIT.subarray(0, len)));
    }
  });

  it('analyzeFile ne lève jamais et classe en CORRUPTED', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: 256 }),
        fc.constantFrom('fit', 'tcx'),
        (bytes, format) => {
          const out = timed(() => analyzeFile('x', format, bytes));
          if (!out.ok && 'rejection' in out) expect(out.rejection.reason).toBe('CORRUPTED');
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe('fuzz TCX', () => {
  it('texte aléatoire : résultat ou ParseError', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (s) => {
        expectMetaOrParseError(() => parseTcx(new TextEncoder().encode(s)));
      }),
      { numRuns: RUNS },
    );
  });

  it('TCX valide muté', () => {
    fc.assert(
      fc.property(mutations(VALID_TCX.length), (edits) => {
        expectMetaOrParseError(() => parseTcx(mutate(VALID_TCX, edits)));
      }),
      { numRuns: RUNS },
    );
  });

  it('entrées pathologiques : très longue ligne, balises imbriquées, DTD', () => {
    const big = (s: string, n: number) => new TextEncoder().encode(s.repeat(n));
    for (const input of [
      big('<Activity Sport="', 200_000),
      big('<Id>', 200_000),
      big('<a>', 300_000),
      big('<Lap StartTime="', 100_000),
      new TextEncoder().encode('<!DOCTYPE x [<!ENTITY a "' + 'a'.repeat(1000) + '">]><x>&a;</x>'),
    ]) {
      expectMetaOrParseError(() => parseTcx(input));
    }
  });
});

describe('fuzz lecteur ZIP', () => {
  async function drain(blob: Blob): Promise<void> {
    try {
      for await (const event of scanArchive(blob, DEFAULT_LIMITS)) expect(event.kind).toBeTruthy();
    } catch (e) {
      expect(e instanceof LimitError || e instanceof ArchiveError).toBe(true);
    }
  }

  it('ZIP valide muté ou tronqué : se termine sans exception inattendue', async () => {
    const zip = await blobBytes(
      await makeZip([
        ['a.fit', makeFit()],
        ['notes.txt', 'hello'],
      ]),
    );
    await fc.assert(
      fc.asyncProperty(
        mutations(zip.length),
        fc.option(fc.nat({ max: zip.length })),
        async (edits, cut) => {
          await drain(new Blob([mutate(zip, edits, cut ?? undefined) as Uint8Array<ArrayBuffer>]));
        },
      ),
      { numRuns: 1_000 },
    );
  }, 120_000);

  it('octets aléatoires', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 2048 }), async (bytes) => {
        await drain(new Blob([bytes]));
      }),
      { numRuns: 1_000 },
    );
  }, 120_000);
});
