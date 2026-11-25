import { NotActivityError, parseFit, ParseError } from './fit.js';
import { convertTrack, type ConvertedFormat } from './fit-writer.js';
import { gpxToTrack, MAX_GPX_BYTES, parseGpx } from './gpx.js';
import { parseTcx } from './tcx.js';
import type { ActivityFormat, Candidate, Rejection } from './types.js';

export type AnalyzeOutcome =
  | {
      readonly ok: true;
      readonly candidate: Candidate;
      /** Octets réellement écrits dans l'archive quand ils diffèrent de la source (GPX converti). */
      readonly output?: Uint8Array;
    }
  | { readonly ok: false; readonly rejection: Rejection }
  /** Fichier valide mais qui n'est pas une activité (santé, réglages…) : ni importé, ni en erreur. */
  | {
      readonly ok: false;
      readonly skipped: { readonly kind: 'health' | 'other'; readonly note: string };
    };

/**
 * Analyse un fichier en isolant toute erreur (T1.8) : un fichier qui plante le parseur
 * devient un rejet `CORRUPTED` et n'interrompt jamais le lot.
 * NB : un vrai timeout dur suppose de pouvoir tuer le worker (T1.21) ; ici on isole les erreurs.
 */
/**
 * Le décodeur FIT garde tous les messages en mémoire (~40 o par enregistrement) : un FIT valide de
 * 80 Mo a coûté ~3 Go à l'analyse. Au-delà de ce seuil on refuse d'analyser (aucun FIT d'activité réel
 * n'en approche : quelques Mo même pour 24 h à 1 Hz).
 */
export const MAX_FIT_ANALYZE_BYTES = 32 * 1024 * 1024;

export interface AnalyzeOptions {
  /** Convertit les GPX en TCX (destination COROS) ; sinon le GPX est conservé tel quel. */
  readonly convertGpx?: boolean;
  /** Format de la conversion (défaut : TCX). */
  readonly convertTo?: ConvertedFormat;
  /** Taille minimale de la destination, pour le repli FIT → TCX d'une courte activité. */
  readonly minSize?: number;
}

/** Nom de fichier d'origine (indice de sport pour les GPX Strava : `…-Run.gpx`). */
const baseName = (id: string): string => (id.split('/').pop() ?? id).replace(/#\d+$/, '');

export function analyzeFile(
  id: string,
  format: ActivityFormat,
  data: Uint8Array,
  options: AnalyzeOptions = {},
): AnalyzeOutcome {
  if (format === 'gpx' && data.byteLength > MAX_GPX_BYTES) {
    return {
      ok: false,
      rejection: {
        candidate: { id, format, size: data.byteLength, meta: { sport: 'unknown', startTime: 0 } },
        reason: 'TOO_LARGE',
        detail: 'GPX trop volumineux pour être converti en toute sécurité',
      },
    };
  }
  if (format === 'fit' && data.byteLength > MAX_FIT_ANALYZE_BYTES) {
    return {
      ok: false,
      rejection: {
        candidate: {
          id,
          format,
          size: data.byteLength,
          meta: { sport: 'unknown', startTime: 0 },
        },
        reason: 'TOO_LARGE',
        detail: 'FIT trop volumineux pour être analysé en toute sécurité',
      },
    };
  }
  try {
    if (format === 'gpx') {
      const parsed = parseGpx(data, baseName(id));
      if (!options.convertGpx) {
        return { ok: true, candidate: { id, format, size: data.byteLength, meta: parsed.meta } };
      }
      const converted = convertTrack(gpxToTrack(parsed), {
        format: options.convertTo ?? 'tcx',
        ...(options.minSize === undefined ? {} : { minSize: options.minSize }),
      });
      return {
        ok: true,
        candidate: {
          id,
          format: converted.format,
          convertedFrom: 'gpx',
          size: converted.bytes.byteLength,
          meta: parsed.meta,
        },
        output: converted.bytes,
      };
    }
    const meta = format === 'fit' ? parseFit(data) : parseTcx(data);
    return { ok: true, candidate: { id, format, size: data.byteLength, meta } };
  } catch (e) {
    if (e instanceof NotActivityError) {
      return { ok: false, skipped: { kind: e.kind, note: e.message } };
    }
    const detail = e instanceof ParseError ? e.message : 'erreur inattendue';
    const placeholder: Candidate = {
      id,
      format,
      size: data.byteLength,
      meta: { sport: 'unknown', startTime: 0 },
    };
    return { ok: false, rejection: { candidate: placeholder, reason: 'CORRUPTED', detail } };
  }
}
