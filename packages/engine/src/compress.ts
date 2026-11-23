import type { Candidate } from './types.js';

/**
 * Taille compressée d'un contenu (deflate brut, comme dans un ZIP). Sans `CompressionStream`
 * (très vieux navigateur), on renvoie la taille brute : estimation prudente, jamais optimiste.
 */
export async function deflatedSize(bytes: Uint8Array): Promise<number> {
  if (typeof CompressionStream === 'undefined') return bytes.byteLength;
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  const reader = stream.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return total;
    total += value.byteLength;
  }
}

/** Au-delà de ce volume brut échantillonné par catégorie de fichier, on cesse de mesurer. */
const SAMPLE_CAP_BYTES = 32 * 1024 * 1024;
/** Marge sur le taux mesuré : la variabilité entre fichiers et le niveau de compression de zip.js. */
const SAFETY_MARGIN = 1.1;

/**
 * Estime la taille de chaque fichier DANS l'archive. Un ZIP COROS est limité en taille compressée :
 * découper d'après la taille brute produisait deux à trois fois trop d'archives (un export de 87 Mo
 * compressés donnait 3 archives). Les fichiers d'un même type (FIT, TCX, GPX converti) se compressent de
 * façon voisine : on mesure un échantillon par type pendant l'analyse, puis on applique le taux.
 */
export class ZipSizeEstimator {
  private readonly groups = new Map<string, { raw: number; compressed: number; seen: number }>();

  static groupOf(c: Pick<Candidate, 'format' | 'convertedFrom'>): string {
    return c.convertedFrom ? `${c.convertedFrom}>${c.format}` : c.format;
  }

  /** Observe un fichier (un sur trois, dans la limite du plafond d'échantillonnage). */
  async observe(group: string, bytes: Uint8Array): Promise<void> {
    const g = this.groups.get(group) ?? { raw: 0, compressed: 0, seen: 0 };
    this.groups.set(group, g);
    g.seen++;
    if (g.raw >= SAMPLE_CAP_BYTES || (g.seen - 1) % 3 !== 0) return;
    g.raw += bytes.byteLength;
    g.compressed += await deflatedSize(bytes);
  }

  /** Taux de compression mesuré (1 si aucun échantillon : estimation prudente). */
  ratio(group: string): number {
    const g = this.groups.get(group);
    return g && g.raw > 0 ? Math.min(1, g.compressed / g.raw) : 1;
  }

  /** Taille estimée du fichier dans l'archive, hors surcoût d'entrée (ajouté par le découpage). */
  estimate(c: Candidate): number {
    return Math.ceil(c.size * Math.min(1, this.ratio(ZipSizeEstimator.groupOf(c)) * SAFETY_MARGIN));
  }
}
