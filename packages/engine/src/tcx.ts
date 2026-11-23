import { ParseError } from './fit.js';
import type { ActivityMeta } from './types.js';

const SCAN_BYTES = 64 * 1024;
const SPORTS: Record<string, string> = { running: 'running', biking: 'cycling', other: 'generic' };

/**
 * Extraction minimale (T1.6). Aucun parseur XML : une déclaration `<!DOCTYPE` ou `<!ENTITY`
 * est refusée d'emblée, ce qui neutralise XXE et « billion laughs » par construction.
 */
export function parseTcx(bytes: Uint8Array): ActivityMeta {
  const text = new TextDecoder('utf-8').decode(bytes.subarray(0, SCAN_BYTES));
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(text)) throw new ParseError('TCX avec DTD refusé');

  const sportRaw = /<Activity\s[^>]*\bSport="([^"]{1,40})"/.exec(text)?.[1];
  const timeRaw =
    /<Id>\s*([^<]{1,40}?)\s*<\/Id>/.exec(text)?.[1] ??
    /<Lap\s[^>]*\bStartTime="([^"]{1,40})"/.exec(text)?.[1];
  if (!sportRaw || !timeRaw) throw new ParseError('TCX incomplet');

  const startTime = Date.parse(timeRaw);
  if (Number.isNaN(startTime)) throw new ParseError('Date TCX invalide');
  return { sport: SPORTS[sportRaw.toLowerCase()] ?? sportRaw.toLowerCase(), startTime };
}
