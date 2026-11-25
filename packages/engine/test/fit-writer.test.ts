import { describe, expect, it } from 'vitest';
import {
  convertTrack,
  fitSportName,
  gpxToTrack,
  parseFit,
  parseGpx,
  trackToFit,
  type TrackData,
} from '../src/index.js';
import { makeGpx } from './fixtures.js';

const track = (sport: string, points = 300): TrackData => ({
  sport,
  name: 'Sortie',
  startTime: Date.UTC(2021, 5, 1, 8),
  durationS: points - 1,
  segments: [
    Array.from({ length: points }, (_, i) => ({
      time: Date.UTC(2021, 5, 1, 8) + i * 1000,
      lat: (43.5 + i * 0.0001).toFixed(5),
      lon: '-1.30000',
      ele: String(20 + (i % 5)),
      hr: 100 + (i % 50),
      cad: 80,
    })),
  ],
});

describe('trackToFit', () => {
  it('produit un FIT valide (CRC) relu avec le bon sport, le bon début et le bon nombre de points', () => {
    const meta = parseFit(trackToFit(track('hiking')));
    expect(meta).toMatchObject({
      sport: 'hiking',
      startTime: Date.UTC(2021, 5, 1, 8),
      points: 300,
      durationS: 299,
    });
    expect(meta.distanceM).toBeGreaterThan(3000);
  });

  it.each(['walking', 'swimming', 'cross_country_skiing', 'alpine_skiing', 'rowing', 'running'])(
    'conserve le sport %s',
    (sport) => {
      expect(parseFit(trackToFit(track(sport))).sport).toBe(sport);
    },
  );

  it('un sport inconnu devient generic', () => {
    expect(fitSportName('golf')).toBe('generic');
    expect(parseFit(trackToFit(track('golf'))).sport).toBe('generic');
  });

  it('sans position (séance en salle) : valide aussi', () => {
    const t = track('training', 60);
    const noGps: TrackData = {
      ...t,
      segments: [
        (t.segments[0] ?? []).map((p) => ({
          time: p.time,
          ...(p.ele === undefined ? {} : { ele: p.ele }),
          ...(p.hr === undefined ? {} : { hr: p.hr }),
        })),
      ],
    };
    expect(parseFit(trackToFit(noGps)).points).toBe(60);
  });

  it('est déterministe (les deux passes de traitement doivent concorder)', () => {
    expect(trackToFit(track('hiking'))).toEqual(trackToFit(track('hiking')));
  });

  it('un GPX converti garde son sport déduit du nom', () => {
    const parsed = parseGpx(new TextEncoder().encode(makeGpx(200)), 'x-Hike.gpx');
    expect(parseFit(trackToFit(gpxToTrack(parsed))).sport).toBe('hiking');
  });
});

describe('convertTrack', () => {
  it('tcx demandé : TCX', () => {
    expect(convertTrack(track('hiking'), { format: 'tcx' }).format).toBe('tcx');
  });
  it('fit demandé : FIT, sans seuil', () => {
    expect(convertTrack(track('hiking'), { format: 'fit' }).format).toBe('fit');
  });
  it('FIT trop petit mais TCX assez grand : repli sur le TCX plutôt que d’écarter l’activité', () => {
    const t = track('hiking', 160);
    const fit = convertTrack(t, { format: 'fit' }).bytes.byteLength;
    const tcx = convertTrack(t, { format: 'tcx' }).bytes.byteLength;
    expect(fit).toBeLessThan(tcx);
    const min = Math.floor((fit + tcx) / 2);
    expect(convertTrack(t, { format: 'fit', minSize: min }).format).toBe('tcx');
    expect(convertTrack(track('hiking', 2000), { format: 'fit', minSize: 20_000 }).format).toBe(
      'fit',
    );
  });
  it('les deux trop petits : on garde le FIT (rejet de taille dans les deux cas)', () => {
    expect(convertTrack(track('hiking', 5), { format: 'fit', minSize: 20_000 }).format).toBe('fit');
  });
});
