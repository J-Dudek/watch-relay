import { Decoder, Stream } from '@garmin/fitsdk';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ParseError, fitCrc, fitSportValue, parseFit, patchFitSport } from '../src/index.js';
import { makeFit, makeFitOfType } from './fixtures.js';

function messages(bytes: Uint8Array): Record<number, unknown[]> {
  const out: Record<number, unknown[]> = {};
  new Decoder(Stream.fromByteArray(bytes)).read({
    mesgListener: (num, mesg) => {
      (out[num] ??= []).push(mesg);
    },
  });
  return out;
}

describe('fitSportValue', () => {
  it.each([
    ['generic', 0],
    ['running', 1],
    ['cycling', 2],
    ['swimming', 5],
  ])('%s → %i', (sport, value) => {
    expect(fitSportValue(sport)).toBe(value);
  });
  it('un sport inconnu vaut generic', () => {
    expect(fitSportValue('golf')).toBe(0);
  });
  it('hiking, walking et ski de fond existent dans le profil', () => {
    for (const s of ['hiking', 'walking', 'cross_country_skiing', 'rowing']) {
      expect(fitSportValue(s)).toBeGreaterThan(0);
    }
  });
});

describe('patchFitSport', () => {
  const original = makeFit({ sport: 'golf', minSize: 2000 });

  it('change le sport, garde un FIT valide (CRC) de même taille', () => {
    const patched = patchFitSport(original, 'hiking');
    expect(patched.length).toBe(original.length);
    expect(new Decoder(Stream.fromByteArray(patched)).checkIntegrity()).toBe(true);
    expect(parseFit(original).sport).toBe('golf');
    expect(parseFit(patched).sport).toBe('hiking');
  });

  it('remet le sous-sport à generic et ne touche à aucun autre message', () => {
    const a = messages(original);
    const b = messages(patchFitSport(original, 'walking'));
    expect(Object.keys(b)).toEqual(Object.keys(a));
    expect(b[20]).toEqual(a[20]); // enregistrements identiques
    expect(b[0]).toEqual(a[0]); // file_id identique
    const session = b[18]?.[0] as Record<string, unknown>;
    const before = a[18]?.[0] as Record<string, unknown>;
    expect(session.subSport).toBe('generic');
    expect({ ...session, sport: undefined }).toEqual({ ...before, sport: undefined });
  });

  it('ne modifie pas le fichier d’origine', () => {
    const copy = original.slice();
    patchFitSport(original, 'running');
    expect(original).toEqual(copy);
  });

  it('un FIT sans session (autre type de fichier) est refusé', () => {
    expect(() => patchFitSport(makeFitOfType('settings'), 'running')).toThrow(ParseError);
  });

  it('structure inattendue ou tronquée : ParseError, jamais une autre exception (fuzz)', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 200 }), (bytes) => {
        try {
          patchFitSport(bytes, 'running');
        } catch (e) {
          expect(e).toBeInstanceOf(ParseError);
        }
      }),
      { numRuns: 500 },
    );
    expect(() => patchFitSport(original.slice(0, original.length - 5), 'running')).toThrow(
      ParseError,
    );
  });

  it('corruption d’octets dans un FIT valide : ParseError ou FIT bien formé, jamais de plantage', () => {
    fc.assert(
      fc.property(fc.nat(original.length - 1), fc.nat(255), (i, v) => {
        const mutated = original.slice();
        mutated[i] = v;
        try {
          const p = patchFitSport(mutated, 'running');
          expect(p.length).toBe(mutated.length);
        } catch (e) {
          expect(e).toBeInstanceOf(ParseError);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe('fitCrc', () => {
  it('concorde avec le CRC écrit par l’encodeur officiel', () => {
    const fit = makeFit();
    const crc = fitCrc(fit, 0, fit.length - 2);
    expect(fit[fit.length - 2]).toBe(crc & 0xff);
    expect(fit[fit.length - 1]).toBe(crc >> 8);
  });
});
