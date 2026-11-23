import { BlobReader, ZipReader, type FileEntry } from '@zip.js/zip.js';
import { detectFormat } from './detect.js';
import { isHealthJsonPath } from './health-export.js';
import { ArchiveError, DEFAULT_LIMITS, LimitError, type ScanLimits } from './limits.js';
import type { ActivityFormat } from './types.js';

export type ScanEvent =
  | {
      readonly kind: 'activity';
      readonly path: string;
      readonly format: ActivityFormat;
      readonly data: Uint8Array;
    }
  /** JSON de séance (si `collectSessions`) : contenu fourni pour la conversion (export global Polar). */
  | { readonly kind: 'json'; readonly path: string; readonly data: Uint8Array }
  /** JSON de santé (si `collectHealth`) : contenu fourni pour l'extraction CSV. */
  | { readonly kind: 'health'; readonly path: string; readonly data: Uint8Array }
  | { readonly kind: 'ignored'; readonly path: string; readonly note: string }
  | { readonly kind: 'error'; readonly path: string; readonly note: string };

const HEAD_BYTES = 512;
/** Marge pour que de minuscules entrées très compressibles ne déclenchent pas le ratio. */
const RATIO_FLOOR = 64 * 1024;

class EntryAbort extends Error {}
/** Activité plus grosse que `maxFileSize` (reconnue dès les premiers octets). */
class EntryTooLarge extends Error {}
/** Contenu ni ZIP ni activité (reconnu dès les premiers octets : on n'en lit pas davantage). */
class EntryOther extends Error {}

const abortError = (): DOMException => new DOMException('Traitement annulé', 'AbortError');
const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

/** Longueur maximale d'un chemin d'affichage (les noms d'entrée peuvent faire 64 Ko). */
const MAX_PATH = 512;
/** Taille maximale admise du répertoire central, par entrée autorisée (nom moyen ≤ ~200 o). */
export const CENTRAL_DIRECTORY_BYTES_PER_ENTRY = 256;

export interface ScanOptions {
  /** Fournit aussi le contenu des JSON de santé (événements `health`), pour l'extraction CSV. */
  readonly collectHealth?: boolean;
  /** Fournit le contenu de tous les JSON (événements `json`) : séances de l'export global Polar. */
  readonly collectSessions?: boolean;
}

interface State {
  readonly limits: ScanLimits;
  readonly collectHealth: boolean;
  readonly collectSessions: boolean;
  readonly signal?: AbortSignal;
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
async function extract(
  entry: FileEntry,
  maxBytes: number,
  state: State,
  keepOther: boolean,
): Promise<Blob> {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let written = 0;
  let limit = maxBytes;
  let classified = false;
  let stop: Error | undefined;
  const ratioCap = Math.max(RATIO_FLOOR, entry.compressedSize * state.limits.maxRatio);
  const sink = new WritableStream<Uint8Array<ArrayBuffer>>({
    write(chunk) {
      if (state.signal?.aborted) throw abortError();
      written += chunk.byteLength;
      state.totalBytes += chunk.byteLength;
      if (state.totalBytes > state.limits.maxTotalUncompressed) {
        state.fatal = new LimitError(
          'TOTAL_TOO_LARGE',
          'Le contenu décompressé dépasse la limite autorisée.',
        );
        throw state.fatal;
      }
      if (written > ratioCap) throw (stop = new EntryAbort());
      chunks.push(chunk);
      // Dès les premiers octets, on connaît le type : on borne la mémoire selon celui-ci au lieu
      // de matérialiser jusqu'à 2 Go de contenu quelconque avant de l'identifier.
      if (!classified && written >= HEAD_BYTES) {
        classified = true;
        const head = new Uint8Array(HEAD_BYTES);
        let at = 0;
        for (const c of chunks) {
          if (at >= HEAD_BYTES) break;
          head.set(c.subarray(0, HEAD_BYTES - at), at);
          at += Math.min(c.byteLength, HEAD_BYTES - at);
        }
        if (isZip(head)) limit = state.limits.maxNestedZipSize;
        else if (detectFormat(head)) limit = state.limits.maxFileSize;
        else if (keepOther) limit = state.limits.maxHealthFileSize;
        else throw (stop = new EntryOther());
      }
      if (written > limit) {
        throw (stop = limit === state.limits.maxFileSize ? new EntryTooLarge() : new EntryAbort());
      }
    },
  });
  try {
    await entry.getData(sink);
  } catch (e) {
    if (state.fatal) throw state.fatal;
    if (state.signal?.aborted) throw abortError();
    throw stop ?? e;
  }
  return new Blob(chunks);
}

/**
 * Contrôle le répertoire central AVANT `getEntries()`, qui construit tous les objets d'entrée en
 * mémoire : un ZIP de 54 Mo déclarant 1 M d'entrées provoquait un « out of memory ». On lit
 * l'EOCD (et son équivalent zip64) et on refuse les nombres et tailles déraisonnables.
 */
async function checkCentralDirectory(blob: Blob, limits: ScanLimits): Promise<void> {
  const EOCD = 0x06054b50;
  const tail = new DataView(await blob.slice(Math.max(0, blob.size - 65_557)).arrayBuffer());
  let at = tail.byteLength - 22;
  while (at >= 0 && tail.getUint32(at, true) !== EOCD) at--;
  if (at < 0) return; // pas d'EOCD : zip.js signalera l'archive illisible
  let entries = tail.getUint16(at + 10, true);
  let size = tail.getUint32(at + 12, true);

  if (at >= 20 && tail.getUint32(at - 20, true) === 0x07064b50) {
    const offset = Number(tail.getBigUint64(at - 20 + 8, true));
    if (Number.isSafeInteger(offset) && offset + 56 <= blob.size) {
      const rec = new DataView(await blob.slice(offset, offset + 56).arrayBuffer());
      if (rec.getUint32(0, true) === 0x06064b50) {
        entries = Number(rec.getBigUint64(32, true));
        size = Number(rec.getBigUint64(40, true));
      }
    }
  }
  if (entries > limits.maxEntries || size > limits.maxEntries * CENTRAL_DIRECTORY_BYTES_PER_ENTRY) {
    throw new LimitError('TOO_MANY_ENTRIES', "Trop de fichiers dans l'archive.");
  }
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
  await checkCentralDirectory(blob, state.limits);
  const reader = new ZipReader(new BlobReader(blob));
  try {
    let entries: Awaited<ReturnType<typeof reader.getEntries>>;
    try {
      entries = await reader.getEntries({
        // Les noms ne servent qu'à l'affichage, jamais de chemin d'écriture (T2.2) :
        // on traite le contenu même si le nom est hostile (`../`).
        filenameValidation: 'tolerant',
      });
    } catch (e) {
      // Archive illisible : erreur typée (pas l'exception brute de la bibliothèque).
      throw e instanceof LimitError ? e : new ArchiveError();
    }
    for (const entry of entries) {
      // Affichage uniquement, jamais utilisé pour écrire ; borné (un nom d'entrée peut faire 64 Ko).
      const path = (prefix + entry.filename).slice(0, MAX_PATH);
      if (entry.directory) continue;
      if (++state.entries > state.limits.maxEntries) {
        throw new LimitError('TOO_MANY_ENTRIES', "Trop de fichiers dans l'archive.");
      }
      const { limits } = state;
      const cap = Math.max(limits.maxFileSize, limits.maxNestedZipSize);
      let data: Blob;
      try {
        if (entry.uncompressedSize > cap) throw new EntryAbort();
        const keepOther =
          (state.collectHealth && isHealthJsonPath(path)) ||
          (state.collectSessions && /\.json$/i.test(path));
        data = await extract(entry, cap, state, keepOther);
      } catch (e) {
        if (e instanceof LimitError || isAbort(e)) throw e;
        if (e instanceof EntryOther) {
          yield { kind: 'ignored', path, note: 'pas une activité' };
          continue;
        }
        if (e instanceof EntryTooLarge) {
          yield { kind: 'ignored', path, note: 'TOO_LARGE' };
          continue;
        }
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
          if (e instanceof LimitError || isAbort(e)) throw e;
          yield { kind: 'error', path, note: 'archive imbriquée illisible' };
        }
        continue;
      }

      const format = detectFormat(head);
      if (!format) {
        if (state.collectSessions && /\.json$/i.test(path)) {
          yield { kind: 'json', path, data: new Uint8Array(await data.arrayBuffer()) };
        } else if (state.collectHealth && isHealthJsonPath(path)) {
          yield { kind: 'health', path, data: new Uint8Array(await data.arrayBuffer()) };
        } else yield { kind: 'ignored', path, note: 'pas une activité' };
      } else if (data.size > limits.maxFileSize) yield { kind: 'ignored', path, note: 'TOO_LARGE' };
      else yield { kind: 'activity', path, format, data: new Uint8Array(await data.arrayBuffer()) };
    }
  } finally {
    await reader.close();
  }
}

/**
 * Parcourt récursivement une archive (T1.1, T1.2) et émet les fichiers d'activité détectés
 * par leur contenu. Lève `LimitError` si une limite de sécurité est franchie, `ArchiveError` si l'archive est illisible.
 */
export function scanArchive(
  input: Blob,
  limits: ScanLimits = DEFAULT_LIMITS,
  signal?: AbortSignal,
  options: ScanOptions = {},
): AsyncGenerator<ScanEvent> {
  if (input.size > limits.maxInputSize) {
    throw new LimitError('INPUT_TOO_LARGE', 'Le fichier déposé est trop volumineux.');
  }
  return walk(input, '', 1, {
    limits,
    collectHealth: options.collectHealth ?? false,
    collectSessions: options.collectSessions ?? false,
    ...(signal ? { signal } : {}),
    totalBytes: 0,
    entries: 0,
  });
}
