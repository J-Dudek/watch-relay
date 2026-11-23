import type { Candidate, Rejection, SetRule } from '../types.js';

export const DUPLICATE_TOLERANCE_MS = 2000;

/** Même sport, débuts à ± tolérance : on garde le plus gros fichier (T1.12). */
export function createDuplicateRule(toleranceMs: number = DUPLICATE_TOLERANCE_MS): SetRule {
  return {
    id: 'duplicate',
    check(candidates) {
      const sorted = [...candidates].sort(
        (a, b) =>
          a.meta.sport.localeCompare(b.meta.sport) ||
          a.meta.startTime - b.meta.startTime ||
          a.id.localeCompare(b.id),
      );
      const rejected: Rejection[] = [];
      let group: Candidate[] = [];

      const flush = (): void => {
        if (group.length < 2) return;
        const keeper = group.reduce((best, c) => (c.size > best.size ? c : best));
        for (const c of group) {
          if (c !== keeper) rejected.push({ candidate: c, reason: 'DUPLICATE', detail: keeper.id });
        }
      };

      for (const c of sorted) {
        // Comparé au PREMIER du groupe : pas de chaînage (A, B à +2 s, C à +4 s : C n'est pas un doublon de A).
        const first = group[0];
        const sameCluster =
          first !== undefined &&
          first.meta.sport === c.meta.sport &&
          c.meta.startTime - first.meta.startTime <= toleranceMs;
        if (!sameCluster) {
          flush();
          group = [];
        }
        group.push(c);
      }
      flush();
      return rejected;
    },
  };
}
