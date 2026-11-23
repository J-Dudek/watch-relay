import type { Candidate, Rejection, SetRule } from '../types.js';

export const DUPLICATE_TOLERANCE_MS = 2000;

/**
 * Même activité présente plusieurs fois (ex. un export Polar qui contient la même séance en TCX, GPX et
 * FIT) : débuts à ± tolérance, on garde le plus gros fichier (T1.12).
 *
 * - La comparaison se fait avec le PREMIER fichier du groupe (pas de chaînage).
 * - Un sport « generic » (GPX sans type, par exemple) est compatible avec tous les autres : il rejoint
 *   la même activité.
 * - Deux sports distincts au même instant restent deux activités (ex. multisport).
 */
export function createDuplicateRule(toleranceMs: number = DUPLICATE_TOLERANCE_MS): SetRule {
  return {
    id: 'duplicate',
    check(candidates) {
      const sorted = [...candidates].sort(
        (a, b) => a.meta.startTime - b.meta.startTime || a.id.localeCompare(b.id),
      );
      const rejected: Rejection[] = [];

      const flush = (group: Candidate[]): void => {
        if (group.length < 2) return;
        const keeper = group.reduce((best, c) => (c.size > best.size ? c : best));
        for (const c of group) {
          if (c !== keeper) rejected.push({ candidate: c, reason: 'DUPLICATE', detail: keeper.id });
        }
      };

      const flushCluster = (cluster: Candidate[]): void => {
        const specific = new Set(cluster.map((c) => c.meta.sport).filter((s) => s !== 'generic'));
        if (specific.size <= 1) {
          flush(cluster);
          return;
        }
        for (const sport of specific) flush(cluster.filter((c) => c.meta.sport === sport));
        flush(cluster.filter((c) => c.meta.sport === 'generic'));
      };

      let cluster: Candidate[] = [];
      for (const c of sorted) {
        const first = cluster[0];
        if (first !== undefined && c.meta.startTime - first.meta.startTime > toleranceMs) {
          flushCluster(cluster);
          cluster = [];
        }
        cluster.push(c);
      }
      flushCluster(cluster);
      return rejected;
    },
  };
}
