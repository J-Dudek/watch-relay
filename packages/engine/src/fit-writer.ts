import { Encoder, Profile } from '@garmin/fitsdk';
import type { Mesg } from '@garmin/fitsdk';
import { haversine, trackToTcx, type TrackData } from './tcx-writer.js';

/**
 * Écriture d'un FIT d'activité à partir d'une trace neutre (GPX, JSON Polar). Contrairement au TCX, qui ne
 * connaît que Running, Biking et Other, le FIT conserve le sport (marche, randonnée, natation, ski…).
 * Le fichier est produit avec l'encodeur officiel de Garmin ; il est relu (CRC, session) par `parseFit`.
 */

const mesgNum = (name: string): number => Profile.MesgNum[name] as number;
const SEMICIRCLES_PER_DEGREE = 2 ** 31 / 180;

/** Sports du moteur que le FIT sait nommer ; tout autre nom devient `generic`. */
const FIT_SPORTS = new Set([
  'running',
  'cycling',
  'swimming',
  'walking',
  'hiking',
  'training',
  'rowing',
  'cross_country_skiing',
  'alpine_skiing',
  'snowboarding',
  'fitness_equipment',
  'generic',
]);

/** `cross_country_skiing` → `crossCountrySkiing` (le SDK nomme les énumérations en camelCase). */
const camel = (s: string): string => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
export const fitSportName = (sport: string): string =>
  camel(FIT_SPORTS.has(sport) ? sport : 'generic');

const semicircles = (deg: string): number => Math.round(Number(deg) * SEMICIRCLES_PER_DEGREE);

export function trackToFit(track: TrackData): Uint8Array {
  const enc = new Encoder();
  const start = new Date(track.startTime);
  const sport = fitSportName(track.sport);

  enc.onMesg(mesgNum('FILE_ID'), <Mesg>{
    type: 'activity',
    manufacturer: 'development',
    product: 0,
    timeCreated: start,
    serialNumber: 1,
  });

  let distance = 0;
  let prev: { lat: string; lon: string } | undefined;
  let hrSum = 0;
  let hrCount = 0;
  let hrMax = 0;
  let lastTime = track.startTime;
  for (const segment of track.segments) {
    for (const p of segment) {
      if (p.dist !== undefined) distance = p.dist;
      else if (p.lat !== undefined && p.lon !== undefined && prev) {
        distance += haversine(prev, { lat: p.lat, lon: p.lon });
      }
      if (p.lat !== undefined && p.lon !== undefined) prev = { lat: p.lat, lon: p.lon };
      if (p.hr !== undefined) {
        hrSum += p.hr;
        hrCount++;
        hrMax = Math.max(hrMax, p.hr);
      }
      lastTime = Math.max(lastTime, p.time);
      enc.onMesg(mesgNum('RECORD'), <Mesg>{
        timestamp: new Date(p.time),
        ...(p.lat !== undefined && p.lon !== undefined
          ? { positionLat: semicircles(p.lat), positionLong: semicircles(p.lon) }
          : {}),
        ...(p.ele === undefined ? {} : { altitude: Number(p.ele) }),
        distance: Math.round(distance * 100) / 100,
        ...(p.hr === undefined ? {} : { heartRate: Math.round(p.hr) }),
        ...(p.cad === undefined ? {} : { cadence: Math.round(p.cad) }),
      });
    }
  }

  const end = new Date(Math.max(lastTime, track.startTime + track.durationS * 1000));
  const total = track.distanceM ?? distance;
  const avg = track.avgHr ?? (hrCount > 0 ? hrSum / hrCount : undefined);
  const max = track.maxHr ?? (hrCount > 0 ? hrMax : undefined);
  const totals = {
    startTime: start,
    totalElapsedTime: track.durationS,
    totalTimerTime: track.durationS,
    totalDistance: Math.round(total * 100) / 100,
    ...(track.calories === undefined
      ? {}
      : { totalCalories: Math.max(0, Math.round(track.calories)) }),
    ...(avg === undefined ? {} : { avgHeartRate: Math.round(avg) }),
    ...(max === undefined ? {} : { maxHeartRate: Math.round(max) }),
  };
  enc.onMesg(mesgNum('LAP'), <Mesg>{ timestamp: end, ...totals, sport });
  enc.onMesg(mesgNum('SESSION'), <Mesg>{
    timestamp: end,
    ...totals,
    sport,
    subSport: 'generic',
    firstLapIndex: 0,
    numLaps: 1,
  });
  enc.onMesg(mesgNum('ACTIVITY'), <Mesg>{
    timestamp: end,
    totalTimerTime: track.durationS,
    numSessions: 1,
    type: 'manual',
    event: 'activity',
    eventType: 'stop',
  });
  return enc.close();
}

export type ConvertedFormat = 'fit' | 'tcx';

export interface ConvertOptions {
  /** Format voulu ; `fit` retombe sur le TCX si le FIT serait plus petit que `minSize` (et le TCX non). */
  readonly format: ConvertedFormat;
  /** Taille minimale acceptée par la destination (COROS : 20 Ko, un fichier plus petit est refusé). */
  readonly minSize?: number;
}

export interface Converted {
  readonly format: ConvertedFormat;
  readonly bytes: Uint8Array;
}

/**
 * Convertit une trace dans le format voulu. Un FIT est bien plus compact qu'un TCX : une courte activité
 * peut passer sous la taille minimale de COROS en FIT et au-dessus en TCX. Dans ce cas on garde le TCX
 * (le sport est alors réduit à Running, Biking ou Other) plutôt que d'écarter l'activité.
 * Déterministe : la même trace donne toujours le même résultat (les deux passes de traitement concordent).
 */
export function convertTrack(track: TrackData, options: ConvertOptions): Converted {
  const tcx = (): Converted => ({
    format: 'tcx',
    bytes: new TextEncoder().encode(trackToTcx(track)),
  });
  if (options.format === 'tcx') return tcx();
  const fit = trackToFit(track);
  if (options.minSize !== undefined && fit.byteLength < options.minSize) {
    const alt = tcx();
    if (alt.bytes.byteLength >= options.minSize) return alt;
  }
  return { format: 'fit', bytes: fit };
}
