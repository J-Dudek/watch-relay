import { ParseError } from './fit.js';
import type { ActivityMeta } from './types.js';

/**
 * Lecture et conversion de GPX en TCX (COROS n'importe que FIT et TCX).
 *
 * Comme pour le TCX, aucun parseur XML : balayage par `indexOf` (temps linéaire, pas d'expression
 * régulière à retour arrière sur le contenu non fiable) et refus de toute déclaration `<!DOCTYPE` ou
 * `<!ENTITY` (XXE, « billion laughs »). Tout ce qui est écrit dans le TCX est soit un nombre validé,
 * soit une date normalisée, soit du texte échappé.
 */

export const MAX_GPX_BYTES = 50 * 1024 * 1024;
const MAX_POINTS = 500_000;
const DTD = /<!\s*(DOCTYPE|ENTITY)/i;
const COORD = /^-?\d{1,3}(?:\.\d{1,15})?$/;
const EARTH_RADIUS_M = 6_371_000;

interface Point {
  readonly lat: string;
  readonly lon: string;
  readonly time: number;
  readonly ele?: string;
  readonly hr?: number;
  readonly cad?: number;
}

export interface ParsedGpx {
  readonly segments: readonly (readonly Point[])[];
  readonly sport: string;
  readonly name?: string;
  readonly meta: ActivityMeta;
}

function attr(tag: string, name: string): string | undefined {
  // `lat="…"` ou `lat='…'` ; la balise est courte (déjà délimitée), pas de risque de retour arrière.
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return m?.[1] ?? m?.[2];
}

function textOf(inner: string, tag: string): string | undefined {
  const open = inner.indexOf(`<${tag}>`);
  if (open === -1) return undefined;
  const close = inner.indexOf('</', open);
  return close === -1 ? undefined : inner.slice(open + tag.length + 2, close).trim();
}

/** Valeur d'un élément éventuellement préfixé (`gpxtpx:hr`, `ns3:hr`, `hr`). */
function extValue(inner: string, local: string): number | undefined {
  const re = new RegExp(`<(?:[A-Za-z0-9_]{1,20}:)?${local}>\\s*(\\d{1,3}(?:\\.\\d+)?)\\s*</`);
  const m = re.exec(inner);
  return m?.[1] === undefined ? undefined : Number(m[1]);
}

/** Sport déduit du contenu (`<type>`), sinon d'un indice (nom de fichier Strava : `…-Run.gpx`). */
export function gpxSport(type: string | undefined, hint: string | undefined): string {
  const t = (type ?? '').toLowerCase();
  const h = (hint ?? '').toLowerCase().replace(/\.gpx$/, '');
  const pick = (s: string): string | undefined => {
    if (/(^|[^a-z])(running|run|trail_?running)([^a-z]|$)/.test(s)) return 'running';
    if (/(^|[^a-z])(cycling|biking|bike|ride|virtualride|e_?bike)([^a-z]|$)/.test(s))
      return 'cycling';
    if (/(^|[^a-z])(hiking|hike)([^a-z]|$)/.test(s)) return 'hiking';
    if (/(^|[^a-z])(walking|walk)([^a-z]|$)/.test(s)) return 'walking';
    if (/(^|[^a-z])(swimming|swim)([^a-z]|$)/.test(s)) return 'swimming';
    return undefined;
  };
  // Les codes numériques de Strava (`<type>9</type>`) ne sont pas interprétés : valeurs non vérifiées.
  return pick(t) ?? pick(h.split('-').pop() ?? h) ?? 'generic';
}

export function parseGpx(bytes: Uint8Array, hint?: string): ParsedGpx {
  if (bytes.byteLength > MAX_GPX_BYTES) throw new ParseError('GPX trop volumineux');
  const text = new TextDecoder('utf-8').decode(bytes);
  if (DTD.test(text.slice(0, 65_536))) throw new ParseError('GPX avec DTD refusé');

  const trkStart = text.indexOf('<trk>') === -1 ? text.indexOf('<trk ') : text.indexOf('<trk>');
  if (trkStart === -1) throw new ParseError('GPX sans trace');

  const segments: Point[][] = [];
  let total = 0;
  let segPos = text.indexOf('<trkseg', trkStart);
  while (segPos !== -1) {
    const segEnd = text.indexOf('</trkseg>', segPos);
    const limit = segEnd === -1 ? text.length : segEnd;
    const points: Point[] = [];
    let p = text.indexOf('<trkpt', segPos);
    while (p !== -1 && p < limit) {
      const tagEnd = text.indexOf('>', p);
      if (tagEnd === -1) break;
      const tag = text.slice(p, tagEnd);
      const selfClosing = tag.endsWith('/');
      let inner = '';
      let next = tagEnd + 1;
      if (!selfClosing) {
        const close = text.indexOf('</trkpt>', tagEnd);
        if (close === -1) break;
        inner = text.slice(tagEnd + 1, close);
        next = close + 8;
      }
      const lat = attr(tag, 'lat');
      const lon = attr(tag, 'lon');
      const time = Date.parse(textOf(inner, 'time') ?? '');
      if (
        lat !== undefined &&
        lon !== undefined &&
        COORD.test(lat) &&
        COORD.test(lon) &&
        Math.abs(Number(lat)) <= 90 &&
        Math.abs(Number(lon)) <= 180 &&
        Number.isFinite(time)
      ) {
        const ele = textOf(inner, 'ele');
        const hr = extValue(inner, 'hr');
        const cad = extValue(inner, 'cad');
        points.push({
          lat,
          lon,
          time,
          ...(ele !== undefined && /^-?\d{1,5}(?:\.\d+)?$/.test(ele) ? { ele } : {}),
          ...(hr !== undefined && hr > 0 && hr < 255 ? { hr } : {}),
          ...(cad !== undefined && cad >= 0 && cad < 255 ? { cad } : {}),
        });
        if (++total > MAX_POINTS) throw new ParseError('GPX : trop de points');
      }
      p = text.indexOf('<trkpt', next);
    }
    if (points.length > 0) segments.push(points);
    segPos = segEnd === -1 ? -1 : text.indexOf('<trkseg', segEnd);
  }

  const first = segments[0]?.[0];
  const lastSeg = segments.at(-1);
  const last = lastSeg?.at(-1);
  if (!first || !last) throw new ParseError('GPX sans trace horodatée');

  const typeMatch = /<type>([^<]{0,40})<\/type>/.exec(text.slice(trkStart, trkStart + 4096));
  const sport = gpxSport(typeMatch?.[1], hint);
  const nameRaw = /<name>([^<]{0,200})<\/name>/.exec(text.slice(trkStart, trkStart + 4096))?.[1];
  const name = nameRaw === undefined ? undefined : xmlUnescape(nameRaw.trim());

  return {
    segments,
    sport,
    ...(name ? { name } : {}),
    meta: {
      sport,
      startTime: first.time,
      durationS: Math.max(0, (last.time - first.time) / 1000),
      points: total,
    },
  };
}

function haversine(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (Number(b.lat) - Number(a.lat)) * rad;
  const dLon = (Number(b.lon) - Number(a.lon)) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(Number(a.lat) * rad) * Math.cos(Number(b.lat) * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Entités XML prédéfinies et références numériques (le GPX est lu sans parseur XML). */
function xmlUnescape(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|lt|gt|amp|quot|apos);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'amp') return '&';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    const code = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return code > 0 && code < 0x110000 && !(code >= 0xd800 && code < 0xe000)
      ? String.fromCodePoint(code)
      : m;
  });
}

const xmlEscape = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

const TCX_SPORT: Record<string, string> = { running: 'Running', cycling: 'Biking' };

/** TCX conforme au schéma Garmin (le schéma ne connaît que Running, Biking et Other). */
export function gpxToTcx(parsed: ParsedGpx): string {
  const out: string[] = [];
  let distance = 0;
  let hrSum = 0;
  let hrCount = 0;
  let hrMax = 0;
  const tracks: string[] = [];
  let prev: Point | undefined;
  for (const segment of parsed.segments) {
    const pts: string[] = [];
    for (const p of segment) {
      if (prev) distance += haversine(prev, p);
      prev = p;
      if (p.hr !== undefined) {
        hrSum += p.hr;
        hrCount++;
        hrMax = Math.max(hrMax, p.hr);
      }
      pts.push(
        `<Trackpoint><Time>${new Date(p.time).toISOString()}</Time>` +
          `<Position><LatitudeDegrees>${p.lat}</LatitudeDegrees><LongitudeDegrees>${p.lon}</LongitudeDegrees></Position>` +
          (p.ele === undefined ? '' : `<AltitudeMeters>${p.ele}</AltitudeMeters>`) +
          `<DistanceMeters>${distance.toFixed(1)}</DistanceMeters>` +
          (p.hr === undefined
            ? ''
            : `<HeartRateBpm><Value>${String(Math.round(p.hr))}</Value></HeartRateBpm>`) +
          (p.cad === undefined ? '' : `<Cadence>${String(Math.round(p.cad))}</Cadence>`) +
          `</Trackpoint>`,
      );
    }
    tracks.push(`<Track>${pts.join('')}</Track>`);
  }

  const start = new Date(parsed.meta.startTime).toISOString();
  out.push(
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenter/v2">',
    `<Activities><Activity Sport="${TCX_SPORT[parsed.sport] ?? 'Other'}"><Id>${start}</Id>`,
    `<Lap StartTime="${start}"><TotalTimeSeconds>${(parsed.meta.durationS ?? 0).toFixed(1)}</TotalTimeSeconds>`,
    `<DistanceMeters>${distance.toFixed(1)}</DistanceMeters><Calories>0</Calories>`,
    hrCount > 0
      ? `<AverageHeartRateBpm><Value>${String(Math.round(hrSum / hrCount))}</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>${String(Math.round(hrMax))}</Value></MaximumHeartRateBpm>`
      : '',
    '<Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod>',
    tracks.join(''),
    '</Lap>',
    parsed.name ? `<Notes>${xmlEscape(parsed.name)}</Notes>` : '',
    '</Activity></Activities></TrainingCenterDatabase>',
  );
  return out.join('\n');
}

/** Distance totale (m), utile au rapport. */
export function gpxDistance(parsed: ParsedGpx): number {
  let d = 0;
  let prev: Point | undefined;
  for (const seg of parsed.segments)
    for (const p of seg) {
      if (prev) d += haversine(prev, p);
      prev = p;
    }
  return d;
}
