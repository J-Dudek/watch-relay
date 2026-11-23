import type { Candidate } from './types.js';

export const MAX_BATCH_SIZE = 180 * 1024 * 1024;
/** Surcoût ZIP par entrée (en-tête local + répertoire central + marge). */
export const ZIP_ENTRY_OVERHEAD = 512;
/** Surcoût fixe par archive (fin de répertoire central + marge). */
export const ZIP_BASE_OVERHEAD = 1024;

export interface Batch {
  readonly items: Candidate[];
  /** Taille estimée de l'archive, surcoûts inclus. */
  readonly estimatedSize: number;
}

/**
 * Découpe en lots ≤ maxSize en conservant l'ordre chronologique (T1.15).
 * Remplissage séquentiel : chaque lot couvre une période contiguë.
 * Lève une erreur si un fichier ne tient seul dans aucun lot (il devrait être TOO_LARGE).
 */
export function splitIntoBatches(
  candidates: readonly Candidate[],
  maxSize: number = MAX_BATCH_SIZE,
): Batch[] {
  const sorted = [...candidates].sort(
    (a, b) => a.meta.startTime - b.meta.startTime || a.id.localeCompare(b.id),
  );
  const batches: { items: Candidate[]; size: number }[] = [];
  let current = { items: [] as Candidate[], size: ZIP_BASE_OVERHEAD };

  for (const c of sorted) {
    const cost = c.size + ZIP_ENTRY_OVERHEAD;
    if (ZIP_BASE_OVERHEAD + cost > maxSize) {
      throw new RangeError(
        `Le fichier ${c.id} (${String(c.size)} o) dépasse la taille maximale d'un lot.`,
      );
    }
    if (current.items.length > 0 && current.size + cost > maxSize) {
      batches.push(current);
      current = { items: [], size: ZIP_BASE_OVERHEAD };
    }
    current.items.push(c);
    current.size += cost;
  }
  if (current.items.length > 0) batches.push(current);

  return batches.map((b) => ({ items: b.items, estimatedSize: b.size }));
}
