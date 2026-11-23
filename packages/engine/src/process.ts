import { Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js';
import { analyzeFile } from './analyze.js';
import { archiveName, entryName } from './naming.js';
import { runPipeline } from './pipeline.js';
import { splitIntoBatches, MAX_BATCH_SIZE } from './batching.js';
import { buildReport, type IgnoredEntry, type Report } from './report.js';
import { DEFAULT_LIMITS, type ScanLimits } from './limits.js';
import { createDuplicateRule } from './rules/duplicate.js';
import { createPeriodRule, type Period } from './rules/period.js';
import { createSizeRules } from './rules/size.js';
import { createSportRule } from './rules/sport.js';
import { scanArchive } from './scan.js';
import type { ArchiveSink, ArchiveTarget } from './sink.js';
import type { Candidate, FileRule, Rejection } from './types.js';

export interface ProcessProgress {
  readonly phase: 'analyze' | 'write';
  /** Entrées d'activité traitées dans la phase courante. */
  readonly processed: number;
  readonly bytesRead: number;
  /** Nombre de fichiers à écrire (connu à partir de la phase d'écriture). */
  readonly total?: number;
}

export interface ProcessOptions {
  readonly limits?: ScanLimits;
  readonly supportedSports?: ReadonlySet<string>;
  readonly period?: Period;
  readonly maxBatchSize?: number;
  /** Seuils de taille par fichier (défaut : règles COROS 20 Ko – 200 Mo). */
  readonly minFileSize?: number;
  readonly maxFileSize?: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: ProcessProgress) => void;
}

export interface OutputArchive {
  readonly name: string;
  readonly blob: Blob;
  readonly fileCount: number;
}

export interface ProcessResult {
  readonly report: Report;
  readonly archives: OutputArchive[];
}

/** Identifiant unique et déterministe d'une entrée (identique aux deux passes). */
function makeIdAllocator(): (path: string) => string {
  const seen = new Map<string, number>();
  return (path) => {
    const n = (seen.get(path) ?? 0) + 1;
    seen.set(path, n);
    return n === 1 ? path : `${path}#${String(n)}`;
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('Traitement annulé', 'AbortError');
}

/**
 * Traitement complet : analyse puis écriture (T1.15 à T1.19, T1.21 à T1.23).
 * Deux passes sur l'archive source pour ne jamais garder les fichiers en mémoire :
 * la 1re collecte les métadonnées, la 2de n'écrit que les fichiers retenus.
 */
export async function processArchive(
  input: Blob,
  sink: ArchiveSink,
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const { signal, onProgress } = options;
  const limits = options.limits ?? DEFAULT_LIMITS;
  const maxBatch = options.maxBatchSize ?? MAX_BATCH_SIZE;
  const targets: ArchiveTarget[] = [];
  let done = false;

  try {
    // Passe 1 : analyse.
    const candidates: Candidate[] = [];
    const rejections: Rejection[] = [];
    const ignored: IgnoredEntry[] = [];
    let processed = 0;
    let bytesRead = 0;
    const idFor = makeIdAllocator();

    for await (const event of scanArchive(input, limits)) {
      throwIfAborted(signal);
      const id = idFor(event.path);
      if (event.kind === 'activity') {
        const outcome = analyzeFile(id, event.format, event.data);
        if (outcome.ok) candidates.push(outcome.candidate);
        else rejections.push(outcome.rejection);
        processed++;
        bytesRead += event.data.byteLength;
        onProgress?.({ phase: 'analyze', processed, bytesRead });
      } else {
        ignored.push({ path: event.path, note: event.note });
      }
    }

    const fileRules: FileRule[] = [
      ...createSizeRules(options.minFileSize, options.maxFileSize),
      createSportRule(options.supportedSports),
      ...(options.period ? [createPeriodRule(options.period)] : []),
    ];
    const { kept, rejected } = runPipeline(candidates, fileRules, [createDuplicateRule()]);
    const report = buildReport(kept, [...rejections, ...rejected], ignored);

    // Passe 2 : écriture des seuls fichiers retenus.
    const batches = splitIntoBatches(kept, maxBatch);
    const batchOf = new Map<string, number>();
    for (const [i, b] of batches.entries()) for (const c of b.items) batchOf.set(c.id, i);
    const byId = new Map(kept.map((c) => [c.id, c]));

    const writers: ZipWriter<unknown>[] = [];
    const takenNames = batches.map(() => new Set<string>());
    const counts = batches.map(() => 0);
    const names = batches.map((b, i) => archiveName(b, i));
    for (const name of names) {
      const target = await sink.open(name);
      targets.push(target);
      writers.push(new ZipWriter(target.writable));
    }

    let written = 0;
    const idFor2 = makeIdAllocator();
    if (kept.length > 0) {
      for await (const event of scanArchive(input, limits)) {
        throwIfAborted(signal);
        const id = idFor2(event.path);
        if (event.kind !== 'activity') continue;
        const candidate = byId.get(id);
        const index = batchOf.get(id);
        if (!candidate || index === undefined) continue;
        const taken = takenNames[index] as Set<string>;
        await (writers[index] as ZipWriter<unknown>).add(
          entryName(candidate, taken),
          new Uint8ArrayReader(event.data),
        );
        counts[index] = (counts[index] ?? 0) + 1;
        written++;
        onProgress?.({ phase: 'write', processed: written, bytesRead, total: kept.length });
      }
    }

    const archives: OutputArchive[] = [];
    for (const [i, writer] of writers.entries()) {
      await writer.close();
      const blob = await (targets[i] as ArchiveTarget).close();
      archives.push({ name: names[i] as string, blob, fileCount: counts[i] ?? 0 });
    }
    done = true;
    return { report, archives };
  } finally {
    if (!done) await Promise.allSettled(targets.map((t) => t.discard())); // T1.23
  }
}
