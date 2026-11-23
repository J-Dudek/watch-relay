import { TextReader, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js';
import { analyzeFile } from './analyze.js';
import { gpxToTcx, parseGpx } from './gpx.js';
import { HealthCollector, type HealthExportStats } from './health-export.js';
import { isHealthPath } from './health.js';
import { archiveName, entryName } from './naming.js';
import { runPipeline } from './pipeline.js';
import { splitIntoBatches } from './batching.js';
import { buildReport, type IgnoredEntry, type Report } from './report.js';
import { DEFAULT_LIMITS, type ScanLimits } from './limits.js';
import { createDuplicateRule } from './rules/duplicate.js';
import { createPeriodRule, type Period } from './rules/period.js';
import { PROFILES } from './profiles.js';
import { createBatchFitRule } from './rules/size.js';
import { scanArchive } from './scan.js';
import type { ArchiveSink, ArchiveTarget } from './sink.js';
import type { Candidate, FileRule, Rejection, Target } from './types.js';

export interface ProcessProgress {
  readonly phase: 'analyze' | 'write';
  /** Entrées d'activité traitées dans la phase courante. */
  readonly processed: number;
  readonly bytesRead: number;
  /** Nombre de fichiers à écrire (connu à partir de la phase d'écriture). */
  readonly total?: number;
}

export interface ProcessOptions {
  /** Plateforme de destination (défaut : `coros`). */
  readonly target?: Target;
  readonly limits?: ScanLimits;
  readonly supportedSports?: ReadonlySet<string>;
  readonly period?: Period;
  readonly maxBatchSize?: number;
  /** Seuils de taille par fichier (défaut : règles COROS 20 Ko – 200 Mo). */
  readonly minFileSize?: number;
  readonly maxFileSize?: number;
  /**
   * Extrait aussi les données de santé (JSON) en CSV, dans une archive à part (non importable). Désactivé
   * par défaut : ces données sont sensibles et ne sont lues que sur demande explicite.
   */
  readonly healthExport?: boolean;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: ProcessProgress) => void;
}

export interface OutputArchive {
  /** `health` : archive de CSV de santé, hors du circuit d'import. */
  readonly kind?: 'health';
  readonly name: string;
  readonly blob: Blob;
  readonly fileCount: number;
}

export interface ProcessResult {
  readonly report: Report;
  readonly archives: OutputArchive[];
}

/** Identifiant unique et déterministe d'une entrée (identique aux deux passes). */
export function makeIdAllocator(): (path: string) => string {
  const seen = new Map<string, number>();
  const used = new Set<string>();
  return (path) => {
    // Garantit l'unicité même si un vrai nom d'entrée ressemble à un id généré (« a », « a », « a#2 »).
    let n = seen.get(path) ?? 0;
    let id: string;
    do {
      n++;
      id = n === 1 ? path : `${path}#${String(n)}`;
    } while (used.has(id));
    seen.set(path, n);
    used.add(id);
    return id;
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
  const profile = PROFILES[options.target ?? 'coros'];
  const maxBatch = options.maxBatchSize ?? profile.maxBatchSize;
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

    const collector = options.healthExport ? new HealthCollector() : undefined;

    for await (const event of scanArchive(input, limits, signal, {
      collectHealth: collector !== undefined,
    })) {
      throwIfAborted(signal);
      const id = idFor(event.path);
      if (event.kind === 'health') {
        collector?.add(event.path, event.data);
        ignored.push({ path: event.path, note: 'données de santé', kind: 'health' });
      } else if (event.kind === 'activity') {
        const outcome = analyzeFile(id, event.format, event.data, {
          convertGpx: profile.convertGpx,
        });
        if (outcome.ok) candidates.push(outcome.candidate);
        else if ('skipped' in outcome) {
          ignored.push({
            path: event.path,
            note: outcome.skipped.note,
            kind: outcome.skipped.kind,
          });
        } else rejections.push(outcome.rejection);
        processed++;
        bytesRead += event.data.byteLength;
        onProgress?.({ phase: 'analyze', processed, bytesRead });
      } else {
        ignored.push({
          path: event.path,
          note: event.note,
          ...(isHealthPath(event.path) ? { kind: 'health' as const } : {}),
        });
      }
    }

    const fileRules: FileRule[] = [
      ...profile.fileRules(options),
      createBatchFitRule(maxBatch),
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
    const names = batches.map((b, i) => archiveName(b, i, profile.archivePrefix));
    for (const name of names) {
      const target = await sink.open(name);
      targets.push(target);
      writers.push(new ZipWriter(target.writable));
    }

    let written = 0;
    const idFor2 = makeIdAllocator();
    if (kept.length > 0) {
      for await (const event of scanArchive(input, limits, signal)) {
        throwIfAborted(signal);
        const id = idFor2(event.path);
        if (event.kind !== 'activity') continue;
        const candidate = byId.get(id);
        const index = batchOf.get(id);
        if (!candidate || index === undefined) continue;
        // Le fichier source ne doit pas avoir changé entre les deux passes (un GPX converti est
        // reconverti : sa taille de sortie doit être identique à celle de la passe 1).
        let output = event.data;
        const sourceFormat = candidate.convertedFrom ?? candidate.format;
        if (candidate.convertedFrom === 'gpx' && event.format === 'gpx') {
          const slash = event.path.lastIndexOf('/');
          output = new TextEncoder().encode(
            gpxToTcx(parseGpx(event.data, event.path.slice(slash + 1))),
          );
        }
        if (output.byteLength !== candidate.size || event.format !== sourceFormat) {
          throw new Error('Le fichier source a changé pendant le traitement.');
        }
        const taken = takenNames[index] as Set<string>;
        await (writers[index] as ZipWriter<unknown>).add(
          entryName(candidate, taken),
          new Uint8ArrayReader(output),
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
    // Archive de santé : après les lots d'activités, hors du circuit d'import.
    let healthExport: HealthExportStats | undefined;
    if (collector?.hasData) {
      healthExport = collector.stats();
      const target = await sink.open('garmin-sante.zip');
      targets.push(target);
      const writer = new ZipWriter(target.writable);
      const csvFiles = collector.toCsvFiles();
      for (const file of csvFiles) {
        await writer.add(file.name, new TextReader(file.content));
      }
      await writer.close();
      archives.push({
        kind: 'health',
        name: 'garmin-sante.zip',
        blob: await target.close(),
        fileCount: csvFiles.length,
      });
    }
    done = true;
    return { report: healthExport ? { ...report, healthExport } : report, archives };
  } finally {
    if (!done) await Promise.allSettled(targets.map((t) => t.discard())); // T1.23
  }
}
