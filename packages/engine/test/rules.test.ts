import { describe, expect, it } from 'vitest';
import {
  createDuplicateRule,
  createPeriodRule,
  createSizeRules,
  createSportRule,
} from '../src/index.js';
import { cand } from './helpers.js';

describe('règles de taille', () => {
  const [small, large] = createSizeRules();
  it('rejette < 20 Ko', () => {
    expect(small?.check(cand({ size: 20 * 1024 - 1 }))?.reason).toBe('TOO_SMALL');
    expect(small?.check(cand({ size: 20 * 1024 }))).toBeNull();
  });
  it('rejette > 200 Mo', () => {
    const max = 200 * 1024 * 1024;
    expect(large?.check(cand({ size: max + 1 }))?.reason).toBe('TOO_LARGE');
    expect(large?.check(cand({ size: max }))).toBeNull();
  });
});

describe('règle de sport', () => {
  const rule = createSportRule(new Set(['running', 'cycling']));
  it.each(['running', 'cycling'])('accepte %s', (sport) => {
    expect(rule.check(cand({ sport }))).toBeNull();
  });
  it.each(['golf', 'e_biking', 'unknown'])('rejette %s avec son nom', (sport) => {
    const r = rule.check(cand({ sport }));
    expect(r?.reason).toBe('UNSUPPORTED_SPORT');
    expect(r?.detail).toBe(sport);
  });
});

describe('règle de période', () => {
  const rule = createPeriodRule({ from: 1000, to: 2000 });
  it('bornes incluses', () => {
    expect(rule.check(cand({ startTime: 1000 }))).toBeNull();
    expect(rule.check(cand({ startTime: 2000 }))).toBeNull();
    expect(rule.check(cand({ startTime: 999 }))?.reason).toBe('OUT_OF_RANGE');
    expect(rule.check(cand({ startTime: 2001 }))?.reason).toBe('OUT_OF_RANGE');
  });
  it('refuse des bornes non finies (NaN rendrait la règle inopérante)', () => {
    expect(() => createPeriodRule({ from: Number.NaN })).toThrow(RangeError);
    expect(() => createPeriodRule({ to: Infinity })).toThrow(RangeError);
  });
  it('bornes optionnelles', () => {
    expect(createPeriodRule({}).check(cand())).toBeNull();
  });
});

describe('dédoublonnage', () => {
  const rule = createDuplicateRule();
  it('garde le plus gros fichier à ± 2 s, même sport', () => {
    const r = rule.check([
      cand({ id: 'a', size: 100, startTime: 10_000 }),
      cand({ id: 'b', size: 300, startTime: 11_500 }),
      cand({ id: 'c', size: 200, startTime: 10_800 }),
    ]);
    expect(r.map((x) => x.candidate.id).sort()).toEqual(['a', 'c']);
    expect(r.every((x) => x.reason === 'DUPLICATE' && x.detail === 'b')).toBe(true);
  });
  it('ne chaîne pas : A, B à +2 s et C à +4 s ne forment pas un seul groupe', () => {
    const r = rule.check([
      cand({ id: 'a', size: 100, startTime: 10_000 }),
      cand({ id: 'b', size: 100, startTime: 12_000 }),
      cand({ id: 'c', size: 100, startTime: 14_000 }),
    ]);
    expect(r.map((x) => x.candidate.id)).not.toContain('c');
  });
  it('un sport « generic » rejoint l’activité de même instant (même séance en TCX, GPX, FIT)', () => {
    const r = rule.check([
      cand({
        id: 'tcx',
        size: 300,
        startTime: 10_000,
        meta: { sport: 'running', startTime: 10_000 },
      }),
      cand({
        id: 'gpx',
        size: 500,
        startTime: 10_500,
        meta: { sport: 'generic', startTime: 10_500 },
      }),
    ]);
    expect(r.map((x) => x.candidate.id)).toEqual(['tcx']); // le plus gros (gpx) est gardé
  });
  it('deux sports distincts au même instant restent deux activités', () => {
    const r = rule.check([
      cand({ id: 'a', size: 300, meta: { sport: 'running', startTime: 10_000 } }),
      cand({ id: 'b', size: 300, meta: { sport: 'cycling', startTime: 10_000 } }),
    ]);
    expect(r).toEqual([]);
  });
  it('ne confond pas deux sports ni deux instants éloignés', () => {
    expect(
      rule.check([
        cand({ id: 'a', sport: 'running', startTime: 10_000 }),
        cand({ id: 'b', sport: 'cycling', startTime: 10_000 }),
        cand({ id: 'c', sport: 'running', startTime: 12_001 }),
      ]),
    ).toEqual([]);
  });
  it('à égalité de taille, garde le premier id', () => {
    const r = rule.check([cand({ id: 'z', startTime: 1 }), cand({ id: 'a', startTime: 1 })]);
    expect(r.map((x) => x.candidate.id)).toEqual(['z']);
  });
});
