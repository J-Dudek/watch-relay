/**
 * Écriture d'un TCX conforme au schéma Garmin à partir d'une trace neutre. Partagé par les conversions
 * GPX → TCX et Polar (JSON) → TCX. Tout ce qui est écrit est un nombre, une date normalisée ou du texte échappé.
 */

export interface TrackPoint {
  readonly time: number;
  readonly lat?: string;
  readonly lon?: string;
  readonly ele?: string;
  /** Distance cumulée en mètres, si la source la fournit (sinon calculée depuis les positions). */
  readonly dist?: number;
  readonly hr?: number;
  readonly cad?: number;
}

export interface TrackData {
  /** Sport du moteur (`running`, `cycling`…) ; le TCX n'en connaît que trois (Running, Biking, Other). */
  readonly sport: string;
  readonly name?: string;
  readonly startTime: number;
  readonly durationS: number;
  readonly segments: readonly (readonly TrackPoint[])[];
  readonly distanceM?: number;
  readonly calories?: number;
  readonly avgHr?: number;
  readonly maxHr?: number;
}

const EARTH_RADIUS_M = 6_371_000;
const TCX_SPORT: Record<string, string> = { running: 'Running', cycling: 'Biking' };

export function haversine(
  a: { lat: string; lon: string },
  b: { lat: string; lon: string },
): number {
  const rad = Math.PI / 180;
  const dLat = (Number(b.lat) - Number(a.lat)) * rad;
  const dLon = (Number(b.lon) - Number(a.lon)) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(Number(a.lat) * rad) * Math.cos(Number(b.lat) * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const xmlEscape = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

export function trackToTcx(track: TrackData): string {
  let distance = 0;
  let hrSum = 0;
  let hrCount = 0;
  let hrMax = 0;
  let prev: { lat: string; lon: string } | undefined;
  const tracks: string[] = [];

  for (const segment of track.segments) {
    const pts: string[] = [];
    for (const p of segment) {
      if (p.dist !== undefined) distance = p.dist;
      else if (p.lat !== undefined && p.lon !== undefined) {
        if (prev) distance += haversine(prev, { lat: p.lat, lon: p.lon });
      }
      if (p.lat !== undefined && p.lon !== undefined) prev = { lat: p.lat, lon: p.lon };
      if (p.hr !== undefined) {
        hrSum += p.hr;
        hrCount++;
        hrMax = Math.max(hrMax, p.hr);
      }
      pts.push(
        `<Trackpoint><Time>${new Date(p.time).toISOString()}</Time>` +
          (p.lat !== undefined && p.lon !== undefined
            ? `<Position><LatitudeDegrees>${p.lat}</LatitudeDegrees><LongitudeDegrees>${p.lon}</LongitudeDegrees></Position>`
            : '') +
          (p.ele === undefined ? '' : `<AltitudeMeters>${p.ele}</AltitudeMeters>`) +
          `<DistanceMeters>${distance.toFixed(1)}</DistanceMeters>` +
          (p.hr === undefined
            ? ''
            : `<HeartRateBpm><Value>${String(Math.round(p.hr))}</Value></HeartRateBpm>`) +
          (p.cad === undefined ? '' : `<Cadence>${String(Math.round(p.cad))}</Cadence>`) +
          `</Trackpoint>`,
      );
    }
    if (pts.length > 0) tracks.push(`<Track>${pts.join('')}</Track>`);
  }

  const start = new Date(track.startTime).toISOString();
  const avg = track.avgHr ?? (hrCount > 0 ? hrSum / hrCount : undefined);
  const max = track.maxHr ?? (hrCount > 0 ? hrMax : undefined);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenter/v2">',
    `<Activities><Activity Sport="${TCX_SPORT[track.sport] ?? 'Other'}"><Id>${start}</Id>`,
    `<Lap StartTime="${start}"><TotalTimeSeconds>${track.durationS.toFixed(1)}</TotalTimeSeconds>`,
    `<DistanceMeters>${(track.distanceM ?? distance).toFixed(1)}</DistanceMeters><Calories>${String(Math.max(0, Math.round(track.calories ?? 0)))}</Calories>`,
    avg !== undefined && max !== undefined
      ? `<AverageHeartRateBpm><Value>${String(Math.round(avg))}</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>${String(Math.round(max))}</Value></MaximumHeartRateBpm>`
      : '',
    '<Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod>',
    tracks.join(''),
    '</Lap>',
    track.name ? `<Notes>${xmlEscape(track.name)}</Notes>` : '',
    '</Activity></Activities></TrainingCenterDatabase>',
  ].join('\n');
}
