/**
 * Décompression gzip bornée (exports Strava : `activities/123.fit.gz`). Comme pour les ZIP, les tailles
 * déclarées ne sont jamais crues : les octets réellement produits sont comptés, avec un plafond de ratio,
 * un plafond par fichier et un plafond global (via `onBytes`).
 */

/** Octets magiques d'un flux gzip (RFC 1952) : 1f 8b, méthode deflate (08). */
export const isGzip = (b: Uint8Array): boolean =>
  b.length >= 3 && b[0] === 0x1f && b[1] === 0x8b && b[2] === 0x08;

export interface GunzipBudget {
  /** Octets décompressés max pour ce fichier. */
  readonly maxBytes: number;
  /** Ratio décompressé / compressé max. */
  readonly maxRatio: number;
  /** Marge pour que de minuscules fichiers très compressibles ne déclenchent pas le ratio. */
  readonly ratioFloor: number;
  /** Appelé à chaque bloc produit ; peut lever (limite globale, annulation) : l'erreur est relayée. */
  readonly onBytes: (n: number) => void;
}

/** Contenu gzip qui dépasse le plafond de taille ou de ratio. */
export class GzipTooLargeError extends Error {}
/** Contenu gzip tronqué, corrompu ou de CRC invalide. */
export class GzipInvalidError extends Error {}

/**
 * Décompresse un gzip en flux. Lève `GzipTooLargeError` (bombe), `GzipInvalidError` (flux illisible) ;
 * toute erreur lancée par `onBytes` (limite globale, annulation) est relayée telle quelle.
 */
export async function gunzip(data: Blob, budget: GunzipBudget): Promise<Blob> {
  const ratioCap = Math.max(budget.ratioFloor, data.size * budget.maxRatio);
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let written = 0;
  let stop: Error | undefined;
  const sink = new WritableStream<Uint8Array<ArrayBuffer>>({
    write(chunk) {
      try {
        written += chunk.byteLength;
        budget.onBytes(chunk.byteLength);
        if (written > budget.maxBytes || written > ratioCap) throw new GzipTooLargeError();
      } catch (e) {
        stop = e as Error;
        throw e;
      }
      chunks.push(chunk);
    },
  });
  try {
    await data.stream().pipeThrough(new DecompressionStream('gzip')).pipeTo(sink);
  } catch (e) {
    if (stop) throw stop;
    throw new GzipInvalidError(e instanceof Error ? e.message : 'gzip illisible');
  }
  return new Blob(chunks);
}
