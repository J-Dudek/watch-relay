import { ZIP_BASE_OVERHEAD, ZIP_ENTRY_OVERHEAD } from '../batching.js';
import type { FileRule } from '../types.js';

export const MIN_FILE_SIZE = 20 * 1024; // < 20 Ko : rejeté comme vide par COROS
export const MAX_FILE_SIZE = 200 * 1024 * 1024; // > 200 Mo : échec d'import

export function createSizeRules(
  min: number = MIN_FILE_SIZE,
  max: number = MAX_FILE_SIZE,
): FileRule[] {
  return [
    {
      id: 'too-small',
      check: (candidate) =>
        candidate.size < min
          ? { candidate, reason: 'TOO_SMALL', detail: `${String(candidate.size)} o` }
          : null,
    },
    {
      id: 'too-large',
      check: (candidate) =>
        candidate.size > max
          ? { candidate, reason: 'TOO_LARGE', detail: `${String(candidate.size)} o` }
          : null,
    },
  ];
}

/**
 * Un fichier qui ne tient dans aucun lot ne doit jamais faire échouer tout le traitement :
 * il est écarté en `TOO_LARGE` (ex. COROS accepte 200 Mo par fichier mais les lots font 180 Mo).
 */
export function createBatchFitRule(maxBatchSize: number): FileRule {
  return {
    id: 'fits-in-batch',
    check: (candidate) =>
      ZIP_BASE_OVERHEAD + ZIP_ENTRY_OVERHEAD + candidate.size > maxBatchSize
        ? {
            candidate,
            reason: 'TOO_LARGE',
            detail: `${String(candidate.size)} o (plus que la taille d'un lot)`,
          }
        : null,
  };
}
