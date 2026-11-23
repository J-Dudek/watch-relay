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

  // Toutes les répétitions sont bornées et sans ambiguïté (pas de `\s*` autour d'un groupe qui
  // accepte aussi des espaces) : temps linéaire, même sur 64 Ko d'espaces (ReDoS, revue T2.22).
  const sportRaw = /<Activity\s[^>]{0,500}?\bSport="([^"]{1,40})"/.exec(text)?.[1];
  const timeRaw =
    /<Id>([^<]{1,80})<\/Id>/.exec(text)?.[1]?.trim() ??
    /<Lap\s[^>]{0,500}?\bStartTime="([^"]{1,40})"/.exec(text)?.[1];
  if (!sportRaw || !timeRaw) throw new ParseError('TCX incomplet');

  const startTime = Date.parse(timeRaw);
  if (Number.isNaN(startTime)) throw new ParseError('Date TCX invalide');
  return {
    sport: SPORTS[sportRaw.toLowerCase()] ?? cleanSport(sportRaw),
    startTime,
    points: countTrackpoints(bytes),
  };
}

/** Compte les `<Trackpoint` sans construire de grande chaîne : balayage des octets. */
function countTrackpoints(bytes: Uint8Array): number {
  const needle = new TextEncoder().encode('<Trackpoint');
  let count = 0;
  const last = bytes.length - needle.length;
  for (let i = 0; i <= last; i++) {
    if (bytes[i] !== 0x3c) continue; // '<'
    let j = 1;
    while (j < needle.length && bytes[i + j] === needle[j]) j++;
    if (j === needle.length) count++;
  }
  return count;
}

/** Le sport vient d'un fichier non fiable : on ne garde que lettres, chiffres, `_`, `-` et espaces. */
function cleanSport(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_ -]/gu, '')
    .trim();
  return cleaned === '' ? 'unknown' : cleaned;
}
