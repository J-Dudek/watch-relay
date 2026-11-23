export type ActivityFormat = 'fit' | 'tcx';

export type RejectReason =
  | 'TOO_SMALL'
  | 'TOO_LARGE'
  | 'TOO_MANY_POINTS'
  | 'UNSUPPORTED_SPORT'
  | 'DUPLICATE'
  | 'CORRUPTED'
  | 'OUT_OF_RANGE';

/** Plateforme de destination de l'import. */
export type Target = 'coros' | 'garmin';

export interface ActivityMeta {
  /** Nom du sport en minuscules, ex. `running`. */
  readonly sport: string;
  readonly subSport?: string;
  /** Début de l'activité, en millisecondes epoch UTC. */
  readonly startTime: number;
  readonly durationS?: number;
  readonly distanceM?: number;
  readonly device?: string;
  /** Nombre de points d'enregistrement (FIT : messages `record` ; TCX : `Trackpoint`). */
  readonly points?: number;
}

/** Fichier d'activité identifié, prêt à passer dans les règles. */
export interface Candidate {
  /** Identifiant interne stable (jamais utilisé comme chemin d'écriture). */
  readonly id: string;
  readonly format: ActivityFormat;
  readonly size: number;
  readonly meta: ActivityMeta;
}

export interface Rejection {
  readonly candidate: Candidate;
  readonly reason: RejectReason;
  /** Détail lisible (ex. nom du sport non supporté). */
  readonly detail?: string;
}

/** Règle appliquée fichier par fichier. */
export interface FileRule {
  readonly id: string;
  check(candidate: Candidate): Rejection | null;
}

/** Règle appliquée sur l'ensemble des fichiers restants (ex. dédoublonnage). */
export interface SetRule {
  readonly id: string;
  check(candidates: readonly Candidate[]): Rejection[];
}

export interface PipelineResult {
  readonly kept: Candidate[];
  readonly rejected: Rejection[];
}
