import type { FileRule } from '../types.js';

/** Garmin Connect refuse les fichiers de 99 999 points ou plus (doc officielle d'import manuel). */
export const GARMIN_MAX_POINTS = 99_998;

export function createPointsRule(max: number = GARMIN_MAX_POINTS): FileRule {
  return {
    id: 'too-many-points',
    check: (candidate) =>
      (candidate.meta.points ?? 0) > max
        ? { candidate, reason: 'TOO_MANY_POINTS', detail: String(candidate.meta.points) }
        : null,
  };
}
