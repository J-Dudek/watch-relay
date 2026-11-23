import { describe, expect, it } from 'vitest';
import { analyzeFile, createSportRule, parseFit, parseTcx } from '../src/index.js';
import { makeFit } from './fixtures.js';

describe('parseFit', () => {
  it('extrait sport, date, durée, distance, appareil', () => {
    const meta = parseFit(
      makeFit({ sport: 'cycling', start: new Date(Date.UTC(2021, 0, 2, 3, 4, 5)) }),
    );
    expect(meta).toMatchObject({
      sport: 'cycling',
      startTime: Date.UTC(2021, 0, 2, 3, 4, 5),
      durationS: 3600,
      distanceM: 10_000,
    });
    expect(meta.device).toContain('development');
  });
  it('rejette un fichier tronqué (CRC)', () => {
    const fit = makeFit();
    expect(() => parseFit(fit.subarray(0, fit.length - 10))).toThrow(/FIT/);
  });
  it('rejette un octet altéré (CRC)', () => {
    const fit = makeFit().slice();
    fit[20] = (fit[20] ?? 0) ^ 0xff;
    expect(() => parseFit(fit)).toThrow();
  });
});

describe('parseTcx', () => {
  const tcx = (extra = '') =>
    new TextEncoder().encode(
      `<?xml version="1.0"?>${extra}<TrainingCenterDatabase><Activities><Activity Sport="Biking"><Id>2020-05-01T10:00:00Z</Id></Activity></Activities></TrainingCenterDatabase>`,
    );
  it('extrait sport et date', () => {
    expect(parseTcx(tcx())).toMatchObject({
      sport: 'cycling',
      startTime: Date.UTC(2020, 4, 1, 10),
    });
  });
  it('neutralise XXE et billion laughs', () => {
    const xxe = '<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]>';
    const laughs = '<!DOCTYPE l [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]>';
    expect(() => parseTcx(tcx(xxe))).toThrow();
    expect(() => parseTcx(tcx(laughs))).toThrow();
  });
  it('rejette un TCX incomplet', () => {
    expect(() => parseTcx(new TextEncoder().encode('<TrainingCenterDatabase/>'))).toThrow();
  });
});

describe('analyzeFile', () => {
  it('un fichier corrompu devient un rejet CORRUPTED, sans exception', () => {
    const r = analyzeFile('x', 'fit', new Uint8Array(100));
    expect(r.ok).toBe(false);
    if (!r.ok && 'rejection' in r) expect(r.rejection.reason).toBe('CORRUPTED');
  });
  it('un fichier valide donne un candidat', () => {
    const r = analyzeFile('x', 'fit', makeFit());
    expect(r.ok && r.candidate.meta.sport).toBe('running');
  });
});

describe('noms de sports composés', () => {
  it.each([
    ['alpineSkiing', 'alpine_skiing'],
    ['crossCountrySkiing', 'cross_country_skiing'],
    ['fitnessEquipment', 'fitness_equipment'],
    ['standUpPaddleboarding', 'stand_up_paddleboarding'],
    ['running', 'running'],
  ])('%s → %s (la liste des sports COROS est en snake_case)', (fit, expected) => {
    expect(parseFit(makeFit({ sport: fit })).sport).toBe(expected);
  });

  it('un ski alpin n’est plus écarté comme sport inconnu', () => {
    const rule = createSportRule();
    const meta = parseFit(makeFit({ sport: 'alpineSkiing' }));
    expect(rule.check({ id: 'x', format: 'fit', size: 50_000, meta })).toBeNull();
  });
});
