import { ParseError } from './fit.js';
import { DEFAULT_SUPPORTED_SPORTS } from './sports.js';
import type { TrackData, TrackPoint } from './tcx-writer.js';
import type { ActivityMeta } from './types.js';

/**
 * Séances de l'export global de Polar Flow (un JSON par séance, avec `exercises[]`) converties en traces
 * pour l'écriture TCX.
 *
 * Schéma tiré d'un convertisseur communautaire écrit sur de vrais exports (`startTime`, `duration` ISO 8601,
 * `distance`, `kiloCalories`, `heartRate.{avg,max}`, `samples.{recordedRoute,heartRate,cadence}`) : il
 * n'a PAS été validé sur un export récent. L'analyse est donc défensive (types vérifiés champ par champ) et
 * un JSON qui n'a pas la forme attendue est ignoré ou signalé, jamais converti de travers.
 */

export interface PolarExercise {
  readonly track: TrackData;
  readonly meta: ActivityMeta;
}

const MAX_POINTS = 500_000;
/** Un échantillon de fréquence cardiaque s'applique à un point s'il est antérieur de moins de 10 s. */
const HR_WINDOW_MS = 10_000;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** `PT1H2M3.5S`, `PT3612.125S`… en secondes. */
export function parseIsoDuration(value: unknown): number {
  const s = str(value);
  if (s === undefined) return 0;
  const m =
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      s,
    );
  if (!m) return 0;
  const [d, h, min, sec] = [m[1], m[2], m[3], m[4]].map((x) => (x === undefined ? 0 : Number(x)));
  return (d ?? 0) * 86400 + (h ?? 0) * 3600 + (min ?? 0) * 60 + (sec ?? 0);
}

/**
 * Horodatage Polar → millisecondes UTC. Les dates sans fuseau (« 2019-05-18T07:34:56.000 ») sont locales à la
 * séance : on retranche `timezoneOffset` (minutes à l'est d'UTC) quand il est fourni, sinon on les prend en UTC.
 */
export function parsePolarTime(value: unknown, offsetMinutes = 0): number | undefined {
  const s = str(value);
  if (s === undefined || s.length > 40) return undefined;
  const t = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)
    ? Date.parse(s)
    : Date.parse(`${s}Z`) - offsetMinutes * 60_000;
  return Number.isFinite(t) ? t : undefined;
}

/** Sport Polar (`RUNNING`, `OTHER_INDOOR`…) → sport du moteur ; inconnu → `generic`. */
export function polarSport(raw: unknown): string {
  const s = (str(raw) ?? '').toLowerCase();
  if (s.includes('run')) return 'running';
  if (s.includes('swim')) return 'swimming';
  if (s.includes('hik')) return 'hiking';
  if (s.includes('walk')) return 'walking';
  if (s.includes('cycl') || s.includes('bik') || s.includes('spinning')) return 'cycling';
  return DEFAULT_SUPPORTED_SPORTS.has(s) ? s : 'generic';
}

interface Sample {
  readonly time: number;
  readonly value: number;
}

function samplesOf(list: unknown[], offset: number): Sample[] {
  const out: Sample[] = [];
  for (const item of list) {
    if (!isObj(item)) continue;
    const time = parsePolarTime(item['dateTime'], offset);
    const value = num(item['value']);
    if (time !== undefined && value !== undefined) out.push({ time, value });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Dernier échantillon antérieur (ou égal) à `t`, dans la fenêtre ; `cursor` avance : listes triées. */
function valueAt(samples: readonly Sample[], cursor: { i: number }, t: number): number | undefined {
  while (cursor.i + 1 < samples.length && (samples[cursor.i + 1] as Sample).time <= t) cursor.i++;
  const s = samples[cursor.i];
  return s !== undefined && s.time <= t && t - s.time <= HR_WINDOW_MS ? s.value : undefined;
}

function exerciseToTrack(ex: Json, session: Json, index: number): PolarExercise {
  const offset = num(ex['timezoneOffset']) ?? num(session['timezoneOffset']) ?? 0;
  const startTime = parsePolarTime(ex['startTime'] ?? session['startTime'], offset);
  if (startTime === undefined)
    throw new ParseError(`Séance Polar ${String(index)} sans date de début`);

  const samples = isObj(ex['samples']) ? ex['samples'] : {};
  const hr = samplesOf(asArr(samples['heartRate']), offset);
  const cad = samplesOf(asArr(samples['cadence']), offset);
  const hrCursor = { i: 0 };
  const cadCursor = { i: 0 };

  const points: TrackPoint[] = [];
  for (const item of asArr(samples['recordedRoute'])) {
    if (!isObj(item)) continue;
    const time = parsePolarTime(item['dateTime'], offset);
    const lat = num(item['latitude']);
    const lon = num(item['longitude']);
    if (
      time === undefined ||
      lat === undefined ||
      lon === undefined ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      continue;
    }
    const ele = num(item['altitude']);
    const dist = num(item['distance']);
    const h = valueAt(hr, hrCursor, time);
    const c = valueAt(cad, cadCursor, time);
    points.push({
      time,
      lat: String(lat),
      lon: String(lon),
      ...(ele !== undefined ? { ele: String(ele) } : {}),
      ...(dist !== undefined && dist >= 0 ? { dist } : {}),
      ...(h !== undefined && h > 0 && h < 255 ? { hr: h } : {}),
      ...(c !== undefined && c >= 0 && c < 255 ? { cad: c } : {}),
    });
    if (points.length > MAX_POINTS) throw new ParseError('Séance Polar : trop de points');
  }
  if (points.length === 0) {
    // Séance sans trace GPS (salle, home-trainer) : points issus de la fréquence cardiaque seule.
    if (hr.length > MAX_POINTS) throw new ParseError('Séance Polar : trop de points');
    for (const s of hr) {
      if (s.value > 0 && s.value < 255) points.push({ time: s.time, hr: s.value });
    }
  }

  const sport = polarSport(ex['sport']);
  let durationS = parseIsoDuration(ex['duration']);
  const first = points[0];
  const last = points.at(-1);
  if (durationS <= 0 && first && last) durationS = Math.max(0, (last.time - first.time) / 1000);
  const distanceM = num(ex['distance']);
  const calories = num(ex['kiloCalories']);
  const heartRate = isObj(ex['heartRate']) ? ex['heartRate'] : {};
  const avgHr = num(heartRate['avg']);
  const maxHr = num(heartRate['max']);
  const name = str(session['name']);

  return {
    track: {
      sport,
      ...(name ? { name: name.slice(0, 200) } : {}),
      startTime,
      durationS,
      segments: points.length > 0 ? [points] : [],
      ...(distanceM !== undefined ? { distanceM } : {}),
      ...(calories !== undefined ? { calories } : {}),
      ...(avgHr !== undefined && avgHr > 0 ? { avgHr } : {}),
      ...(maxHr !== undefined && maxHr > 0 ? { maxHr } : {}),
    },
    meta: {
      sport,
      startTime,
      durationS,
      ...(distanceM !== undefined ? { distanceM } : {}),
      points: points.length,
    },
  };
}

/**
 * Lit un JSON de l'export Polar. `null` : ce n'est pas une séance Polar (autre JSON du compte) ;
 * `ParseError` : c'en est une mais elle est illisible.
 */
export function parsePolarSession(bytes: Uint8Array): PolarExercise[] | null {
  const text = new TextDecoder('utf-8').decode(bytes);
  if (!text.includes('"exercises"')) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ParseError('JSON Polar illisible');
  }
  if (!isObj(data)) return null;
  const exercises = asArr(data['exercises']).filter(isObj);
  if (exercises.length === 0) return null;
  return exercises.map((ex, i) => exerciseToTrack(ex, data, i));
}
