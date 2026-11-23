export interface ScanLimits {
  /** Taille max de l'archive déposée (T2.3). */
  readonly maxInputSize: number;
  /** Octets décompressés cumulés max, ZIP imbriqués compris (T2.1). */
  readonly maxTotalUncompressed: number;
  /** Ratio décompressé/compressé max par entrée (T2.1). */
  readonly maxRatio: number;
  /** Nombre d'entrées max, ZIP imbriqués compris (T2.1). */
  readonly maxEntries: number;
  /** Profondeur max de ZIP imbriqués (l'archive déposée = 1). */
  readonly maxDepth: number;
  /** Taille max d'un fichier d'activité lu en mémoire. */
  readonly maxFileSize: number;
  /** Taille max d'un ZIP imbriqué extrait. */
  readonly maxNestedZipSize: number;
}

const GB = 1024 ** 3;
const MB = 1024 ** 2;

export const DEFAULT_LIMITS: ScanLimits = {
  maxInputSize: 10 * GB,
  maxTotalUncompressed: 20 * GB,
  maxRatio: 100,
  maxEntries: 100_000,
  maxDepth: 3,
  maxFileSize: 200 * MB,
  maxNestedZipSize: 2 * GB,
};

export type LimitCode = 'INPUT_TOO_LARGE' | 'TOTAL_TOO_LARGE' | 'TOO_MANY_ENTRIES' | 'TOO_DEEP';

/** Limite de sécurité dépassée : le traitement s'arrête proprement. */
export class LimitError extends Error {
  readonly code: LimitCode;
  constructor(code: LimitCode, message: string) {
    super(message);
    this.name = 'LimitError';
    this.code = code;
  }
}
