import { BlobReader, ZipReader, type FileEntry } from '@zip.js/zip.js';
import { detectFormat } from './detect.js';
import { DEFAULT_LIMITS, LimitError, type ScanLimits } from './limits.js';
import type { ActivityFormat } from './types.js';

export type ScanEvent =
  | {
      readonly kind: 'activity';
      readonly path: string;
      readonly format: ActivityFormat;
      readonly data: Uint8Array;
    }
  | { readonly kind: 'ignored'; readonly path: string; readonly note: string }
  | { readonly kind: 'error'; readonly path: string; readonly note: string };

const HEAD_BYTES = 512;
/** Marge pour que de minuscules entrées très compressibles ne déclenchent pas le ratio. */
const RATIO_FLOOR = 64 * 1024;

class EntryAbort extends Error {}

interface State {
  readonly limits: ScanLimits;
  totalBytes: number;
  entries: number;
  /** Erreur de limite levée dans un flux (zip.js peut l'envelopper). */
  fatal?: LimitError;
}

const isZip = (b: Uint8Array): boolean =>
  b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/**
 * Extrait une entrée en flux en comptant les octets réellement produits :
 * les tailles déclarées dans l'en-tête ZIP ne sont jamais crues (T2.1).
 */
async function extract(entry: FileEntry, maxBytes: number, state: State): Promise<Blob> {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let written = 0;
  const ratioCap = Math.max(RATIO_FLOOR, entry.compressedSize * state.limits.maxRatio);
  const sink = new WritableStream<Uint8Array<ArrayBuffer>>({
    write(chunk) {
      written += chunk.byteLength;
      state.totalBytes += chunk.byteLength;
      if (state.totalBytes > state.limits.maxTotalUncompressed) {
        state.fatal = new LimitError(
          'TOTAL_TOO_LARGE',
          'Le contenu décompressé dépasse la limite autorisée.',
        );
        throw state.fatal;
      }
      if (written > maxBytes || written > ratioCap) throw new EntryAbort();
      chunks.push(chunk);
    },
  });
  try {
    await entry.getData(sink);
  } catch (e) {
    if (state.fatal) throw state.fatal;
    throw e;
  }
  return new Blob(chunks);
}

async function* walk(
  blob: Blob,
  prefix: string,
  depth: number,
  state: State,
): AsyncGenerator<ScanEvent> {
  if (depth > state.limits.maxDepth) {
    throw new LimitError('TOO_DEEP', 'Archives imbriquées trop profondément.');
  }
  const reader = new ZipReader(new BlobReader(blob));
  try {
    for (const entry of await reader.getEntries({
      // Les noms ne servent qu'à l'affichage, jamais de chemin d'écriture (T2.2) :
      // on traite le contenu même si le nom est hostile (`../`).
      filenameValidation: 'tolerant',
    })) {
      const path = prefix + entry.filename; // affichage uniquement, jamais utilisé pour écrire
      if (entry.directory) continue;
      if (++state.entries > state.limits.maxEntries) {
        throw new LimitError('TOO_MANY_ENTRIES', "Trop de fichiers dans l'archive.");
      }
      const { limits } = state;
      const cap = Math.max(limits.maxFileSize, limits.maxNestedZipSize);
      let data: Blob;
      try {
        if (entry.uncompressedSize > cap) throw new EntryAbort();
        data = await extract(entry, cap, state);
      } catch (e) {
        if (e instanceof LimitError) throw e;
        yield {
          kind: 'ignored',
          path,
          note: e instanceof EntryAbort ? 'trop volumineux ou ratio suspect' : 'illisible',
        };
        continue;
      }

      const head = new Uint8Array(await data.slice(0, HEAD_BYTES).arrayBuffer());
      if (isZip(head)) {
        if (data.size > limits.maxNestedZipSize) {
          yield { kind: 'ignored', path, note: 'archive imbriquée trop volumineuse' };
          continue;
        }
        try {
          yield* walk(data, `${path}!/`, depth + 1, state);
        } catch (e) {
          if (e instanceof LimitError) throw e;
          yield { kind: 'error', path, note: 'archive imbriquée illisible' };
        }
        continue;
      }

      const format = detectFormat(head);
      if (!format) yield { kind: 'ignored', path, note: 'pas une activité' };
      else if (data.size > limits.maxFileSize) yield { kind: 'ignored', path, note: 'TOO_LARGE' };
      else yield { kind: 'activity', path, format, data: new Uint8Array(await data.arrayBuffer()) };
    }
  } finally {
    await reader.close();
  }
}

/**
 * Parcourt récursivement une archive (T1.1, T1.2) et émet les fichiers d'activité détectés
 * par leur contenu. Lève `LimitError` si une limite de sécurité est franchie.
 */
export function scanArchive(
  input: Blob,
  limits: ScanLimits = DEFAULT_LIMITS,
): AsyncGenerator<ScanEvent> {
  if (input.size > limits.maxInputSize) {
    throw new LimitError('INPUT_TOO_LARGE', 'Le fichier déposé est trop volumineux.');
  }
  return walk(input, '', 1, { limits, totalBytes: 0, entries: 0 });
}
