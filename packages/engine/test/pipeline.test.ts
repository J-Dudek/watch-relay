import { describe, expect, it } from 'vitest';
import {
  createDuplicateRule,
  createSizeRules,
  createSportRule,
  runPipeline,
} from '../src/index.js';
import { cand } from './helpers.js';

describe('runPipeline', () => {
  it('applique règles fichier puis règles d’ensemble, résultat chronologique', () => {
    const { kept, rejected } = runPipeline(
      [
        cand({ id: 'late', startTime: 5_000_000 }),
        cand({ id: 'tiny', size: 10 }),
        cand({ id: 'golf', sport: 'golf' }),
        cand({ id: 'early', startTime: 1_000_000 }),
        cand({ id: 'dup', startTime: 1_000_500, size: 1 + 20 * 1024 }),
      ],
      [...createSizeRules(), createSportRule(new Set(['running']))],
      [createDuplicateRule()],
    );
    expect(kept.map((c) => c.id)).toEqual(['early', 'late']);
    expect(Object.fromEntries(rejected.map((r) => [r.candidate.id, r.reason]))).toEqual({
      tiny: 'TOO_SMALL',
      golf: 'UNSUPPORTED_SPORT',
      dup: 'DUPLICATE',
    });
  });
});
