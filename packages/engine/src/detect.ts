import type { ActivityFormat } from './types.js';

const FIT_SIGNATURE = [0x2e, 0x46, 0x49, 0x54]; // ".FIT"

/** Header FIT : taille (12 ou 14) en octet 0, ".FIT" aux octets 8 à 11. */
function isFit(b: Uint8Array): boolean {
  const headerSize = b[0];
  if (b.length < 12 || (headerSize !== 12 && headerSize !== 14)) return false;
  return FIT_SIGNATURE.every((byte, i) => b[8 + i] === byte);
}

function isTcx(b: Uint8Array): boolean {
  let i = 0;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3; // BOM UTF-8
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d)) i++;
  const head = new TextDecoder('utf-8').decode(b.subarray(i, i + 512));
  return (
    /^<\?xml[\s\S]*?<TrainingCenterDatabase[\s>]/.test(head) ||
    head.startsWith('<TrainingCenterDatabase')
  );
}

/**
 * Détecte le type d'un fichier d'après son contenu (T1.3), jamais son extension.
 * Reçoit au moins les 512 premiers octets.
 */
export function detectFormat(head: Uint8Array): ActivityFormat | null {
  if (isFit(head)) return 'fit';
  if (isTcx(head)) return 'tcx';
  return null;
}
