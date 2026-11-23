import { parseFit, ParseError } from './fit.js';
import { parseTcx } from './tcx.js';
import type { ActivityFormat, Candidate, Rejection } from './types.js';

export type AnalyzeOutcome =
  | { readonly ok: true; readonly candidate: Candidate }
  | { readonly ok: false; readonly rejection: Rejection };

/**
 * Analyse un fichier en isolant toute erreur (T1.8) : un fichier qui plante le parseur
 * devient un rejet `CORRUPTED` et n'interrompt jamais le lot.
 * NB : un vrai timeout dur suppose de pouvoir tuer le worker (T1.21) ; ici on isole les erreurs.
 */
export function analyzeFile(id: string, format: ActivityFormat, data: Uint8Array): AnalyzeOutcome {
  try {
    const meta = format === 'fit' ? parseFit(data) : parseTcx(data);
    return { ok: true, candidate: { id, format, size: data.byteLength, meta } };
  } catch (e) {
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
