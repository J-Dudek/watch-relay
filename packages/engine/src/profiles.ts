import { MAX_BATCH_SIZE } from './batching.js';
import { createPointsRule } from './rules/points.js';
import { createSizeRules } from './rules/size.js';
import { createSportRule } from './rules/sport.js';
import type { FileRule, Target } from './types.js';

/** Garmin Connect, import manuel : FIT ≤ 50 Mo, GPX/TCX ≤ 25 Mo (support Garmin). */
export const GARMIN_MAX_FIT_SIZE = 50 * 1024 * 1024;
export const GARMIN_MAX_TCX_SIZE = 25 * 1024 * 1024;

export interface ProfileOverrides {
  readonly minFileSize?: number;
  readonly maxFileSize?: number;
  readonly supportedSports?: ReadonlySet<string>;
}

export interface TargetProfile {
  readonly id: Target;
  /** Préfixe des archives générées, ex. `coros-import-01-….zip`. */
  readonly archivePrefix: string;
  readonly maxBatchSize: number;
  /** Convertir les GPX en TCX (COROS n'importe que FIT et TCX ; Garmin accepte le GPX). */
  readonly convertGpx: boolean;
  fileRules(overrides: ProfileOverrides): FileRule[];
}

/**
 * Chaque plateforme a ses contraintes : une destination = un profil (règles + découpage + noms).
 * Garmin n'impose ni taille minimale ni liste de sports documentées, mais des tailles maximales
 * par format et un nombre de points ; le ZIP produit n'est qu'un véhicule de téléchargement
 * (Garmin n'importe pas de ZIP : l'utilisateur le décompresse).
 */
export const PROFILES: Record<Target, TargetProfile> = {
  coros: {
    id: 'coros',
    archivePrefix: 'coros-import',
    maxBatchSize: MAX_BATCH_SIZE,
    convertGpx: true,
    fileRules: (o) => [
      ...createSizeRules(o.minFileSize, o.maxFileSize),
      createSportRule(o.supportedSports),
    ],
  },
  garmin: {
    id: 'garmin',
    archivePrefix: 'garmin-import',
    maxBatchSize: MAX_BATCH_SIZE,
    convertGpx: false,
    fileRules: (o) => [
      {
        id: 'too-large-garmin',
        check: (candidate) => {
          const max =
            o.maxFileSize ??
            (candidate.format === 'fit' ? GARMIN_MAX_FIT_SIZE : GARMIN_MAX_TCX_SIZE);
          return candidate.size > max
            ? { candidate, reason: 'TOO_LARGE', detail: `${String(candidate.size)} o` }
            : null;
        },
      },
      createPointsRule(),
    ],
  },
};
