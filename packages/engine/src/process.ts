import { TextReader, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js';
import { analyzeFile } from './analyze.js';
import { ZipSizeEstimator } from './compress.js';
import { convertTrack } from './fit-writer.js';
import { gpxToTrack, parseGpx } from './gpx.js';
import { parsePolarSession } from './polar.js';
import { applySportHints, parseStravaCsv } from './strava.js';
import { HealthCollector, type HealthExportStats } from './health-export.js';
import { isHealthPath } from './health.js';
import { archiveName, entryName } from './naming.js';
import { runPipeline } from './pipeline.js';
import { MAX_ARCHIVE_SIZE, splitIntoBatches } from './batching.js';
import { buildReport, type IgnoredEntry, type Report } from './report.js';
import { DEFAULT_LIMITS, type ScanLimits } from './limits.js';
import { patchFitSport } from './fit-patch.js';
import { createDuplicateRule } from './rules/duplicate.js';
import { DEFAULT_SUPPORTED_SPORTS } from './sports.js';
import { createPeriodRule, type Period } from './rules/period.js';
import { PROFILES } from './profiles.js';
import { createBatchFitRule, MIN_FILE_SIZE } from './rules/size.js';
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
  /**
   * Taille maximale réelle d'une archive produite (défaut : limite dure de la destination). Si une archive
   * la dépasse (estimation trop optimiste), le traitement recommence avec un découpage prudent.
   */
  readonly maxArchiveSize?: number;
  /** Remplace l'estimation de la taille compressée d'un fichier (tests, réglages). */
  readonly estimateZipSize?: (candidate: Candidate) => number;
  /** Seuils de taille par fichier (défaut : règles COROS 20 Ko – 200 Mo). */
  readonly minFileSize?: number;
  readonly maxFileSize?: number;
  /**
   * Extrait aussi les données de santé (JSON) en CSV, dans une archive à part (non importable). Désactivé
   * par défaut : ces données sont sensibles et ne sont lues que sur demande explicite.
   */
  readonly healthExport?: boolean;
  /**
   * Lit aussi les JSON de séance de l'export global de Polar Flow et les convertit en TCX. Désactivé par
   * défaut : tous les JSON d'un export doivent alors être lus pour reconnaître les séances.
   */
  readonly polarSessions?: boolean;
  /**
   * Lit `activities.csv` de l'export Strava pour retrouver le sport des activités dont le fichier ne
   * l'indique pas, et compter les activités sans fichier. Les `.gz` de l'export sont toujours décompressés.
   */
  readonly stravaMetadata?: boolean;
  /**
   * Reclassement de sport : `{ golf: 'walking' }` fait traiter les activités « golf » comme des « walking »
   * au lieu de les écarter. Seuls les sports acceptés par la destination sont admis comme cible. Pour un FIT
   * d'origine, les octets du sport sont corrigés sur place (CRC recalculé) ; pour un GPX ou une séance Polar,
   * le sport est écrit dans le fichier converti ; un TCX d'origine n'est pas modifié.
   */
  readonly sportMap?: Readonly<Record<string, string>>;
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

/** Une archive produite dépasse la limite dure : l'estimation de taille était trop optimiste. */
class OversizeError extends Error {}

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
  const minSize = options.minFileSize ?? MIN_FILE_SIZE;
  const acceptedSports = options.supportedSports ?? DEFAULT_SUPPORTED_SPORTS;
  const sportMap = new Map(
    Object.entries(options.sportMap ?? {}).filter(
      ([from, to]) => from !== to && acceptedSports.has(to),
    ),
  );
  const mapSport = (sport: string): string => sportMap.get(sport) ?? sport;
  /** Activités reclassées (identifiant → sport d'origine) et FIT d'origine dont les octets sont corrigés. */
  const reclassFrom = new Map<string, string>();
  const patchedFit = new Set<string>();
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
    let strava: ReturnType<typeof parseStravaCsv> | undefined;

    const collector = options.healthExport ? new HealthCollector() : undefined;
    const estimator = new ZipSizeEstimator();

    for await (const event of scanArchive(input, limits, signal, {
      collectHealth: collector !== undefined,
      collectSessions: options.polarSessions === true,
      collectStrava: options.stravaMetadata === true,
    })) {
      throwIfAborted(signal);
      const id = idFor(event.path);
      if (event.kind === 'csv') {
        strava = parseStravaCsv(event.data);
        ignored.push({ path: event.path, note: 'pas une activité' });
      } else if (event.kind === 'json') {
        let exercises: ReturnType<typeof parsePolarSession>;
        try {
          exercises = parsePolarSession(event.data);
        } catch (e) {
          rejections.push({
            candidate: {
              id,
              format: 'tcx',
              size: event.data.byteLength,
              meta: { sport: 'unknown', startTime: 0 },
            },
            reason: 'CORRUPTED',
            detail: e instanceof Error ? e.message : 'JSON Polar illisible',
          });
          processed++;
          continue;
        }
        if (exercises === null) {
          ignored.push({ path: event.path, note: 'pas une activité' });
          continue;
        }
        for (const [i, ex] of exercises.entries()) {
          const polarSport = mapSport(ex.meta.sport);
          const track =
            polarSport === ex.track.sport ? ex.track : { ...ex.track, sport: polarSport };
          const converted = convertTrack(track, { format: profile.convertTo, minSize });
          const candidate: Candidate = {
            id: `${id}~${String(i)}`,
            format: converted.format,
            convertedFrom: 'polar-json',
            exerciseIndex: i,
            size: converted.bytes.byteLength,
            meta: polarSport === ex.meta.sport ? ex.meta : { ...ex.meta, sport: polarSport },
          };
          if (polarSport !== ex.meta.sport) reclassFrom.set(candidate.id, ex.meta.sport);
          candidates.push(candidate);
          await estimator.observe(ZipSizeEstimator.groupOf(candidate), converted.bytes);
          processed++;
          onProgress?.({ phase: 'analyze', processed, bytesRead });
        }
        bytesRead += event.data.byteLength;
      } else if (event.kind === 'health') {
        collector?.add(event.path, event.data);
        ignored.push({ path: event.path, note: 'données de santé', kind: 'health' });
      } else if (event.kind === 'activity') {
        const outcome = analyzeFile(id, event.format, event.data, {
          convertGpx: profile.convertGpx,
          convertTo: profile.convertTo,
          minSize,
          mapSport,
        });
        if (outcome.ok) {
          let candidate = outcome.candidate;
          let bytes = outcome.output ?? event.data;
          if (outcome.reclassifiedFrom !== undefined) {
            reclassFrom.set(candidate.id, outcome.reclassifiedFrom);
          } else if (candidate.convertedFrom === undefined && sportMap.has(candidate.meta.sport)) {
            const to = mapSport(candidate.meta.sport);
            let ok = true;
            if (candidate.format === 'fit') {
              try {
                bytes = patchFitSport(event.data, to);
              } catch {
                ok = false; // structure inattendue : le fichier reste tel quel (écarté s'il est non supporté)
              }
            }
            if (ok) {
              reclassFrom.set(candidate.id, candidate.meta.sport);
              if (candidate.format === 'fit') patchedFit.add(candidate.id);
              candidate = { ...candidate, meta: { ...candidate.meta, sport: to } };
            }
          }
          candidates.push(candidate);
          // Mesure (sur un échantillon) le taux de compression de ce type de fichier.
          await estimator.observe(ZipSizeEstimator.groupOf(candidate), bytes);
        } else if ('skipped' in outcome) {
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
    const { kept, rejected } = runPipeline(
      strava ? applySportHints(candidates, strava.sports) : candidates,
      fileRules,
      [createDuplicateRule()],
    );
    const reclassCounts = new Map<string, number>();
    for (const c of kept) {
      const from = reclassFrom.get(c.id);
      if (from === undefined) continue;
      const key = `${from}\u0000${c.meta.sport}`;
      reclassCounts.set(key, (reclassCounts.get(key) ?? 0) + 1);
    }
    const reclassified = [...reclassCounts.entries()].map(([key, count]) => {
      const [from = '', to = ''] = key.split('\u0000');
      return { from, to, count };
    });
    const report = {
      ...buildReport(kept, [...rejections, ...rejected], ignored),
      ...(reclassified.length > 0 ? { reclassified } : {}),
      ...(strava && strava.withoutFile > 0 ? { stravaWithoutFile: strava.withoutFile } : {}),
    };

    // Passe 2 : écriture des seuls fichiers retenus. Les lots sont remplis d'après la taille
    // COMPRESSÉE estimée ; si une archive réelle dépasse la limite dure (estimation trop optimiste),
    // on la jette et on recommence avec la taille brute, toujours prudente.
    const hardLimit = options.maxArchiveSize ?? MAX_ARCHIVE_SIZE;
    const byId = new Map(kept.map((c) => [c.id, c]));

    const writeActivityArchives = async (
      sizeOf: (c: Candidate) => number,
    ): Promise<OutputArchive[]> => {
      const batches = splitIntoBatches(kept, maxBatch, sizeOf);
      const batchOf = new Map<string, number>();
      for (const [i, b] of batches.entries()) for (const c of b.items) batchOf.set(c.id, i);

      const mine: ArchiveTarget[] = [];
      const writers: ZipWriter<unknown>[] = [];
      const takenNames = batches.map(() => new Set<string>());
      const counts = batches.map(() => 0);
      const names = batches.map((b, i) => archiveName(b, i, profile.archivePrefix));
      for (const name of names) {
        const target = await sink.open(name);
        targets.push(target);
        mine.push(target);
        writers.push(new ZipWriter(target.writable));
      }

      let written = 0;
      const idFor2 = makeIdAllocator();
      if (kept.length > 0) {
        for await (const event of scanArchive(input, limits, signal, {
          collectSessions: options.polarSessions === true,
        })) {
          throwIfAborted(signal);
          const id = idFor2(event.path);
          if (event.kind === 'json') {
            // JSON Polar : chaque séance retenue est reconvertie (même taille qu'en passe 1).
            let exercises: ReturnType<typeof parsePolarSession>;
            try {
              exercises = parsePolarSession(event.data);
            } catch {
              continue;
            }
            for (const [i, ex] of (exercises ?? []).entries()) {
              const candidate = byId.get(`${id}~${String(i)}`);
              const index = batchOf.get(`${id}~${String(i)}`);
              if (!candidate || index === undefined) continue;
              const converted = convertTrack(
                candidate.meta.sport === ex.track.sport
                  ? ex.track
                  : { ...ex.track, sport: candidate.meta.sport },
                { format: profile.convertTo, minSize },
              );
              const output = converted.bytes;
              if (output.byteLength !== candidate.size || converted.format !== candidate.format) {
                throw new Error('Le fichier source a changé pendant le traitement.');
              }
              await (writers[index] as ZipWriter<unknown>).add(
                entryName(candidate, takenNames[index] as Set<string>),
                new Uint8ArrayReader(output),
              );
              counts[index] = (counts[index] ?? 0) + 1;
              written++;
              onProgress?.({ phase: 'write', processed: written, bytesRead, total: kept.length });
            }
            continue;
          }
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
            // Le sport du candidat peut venir d'`activities.csv` (Strava) : c'est lui qui est écrit.
            const converted = convertTrack(
              gpxToTrack({
                ...parseGpx(event.data, event.path.slice(slash + 1)),
                sport: candidate.meta.sport,
              }),
              { format: profile.convertTo, minSize },
            );
            if (converted.format !== candidate.format) {
              throw new Error('Le fichier source a changé pendant le traitement.');
            }
            output = converted.bytes;
          }
          if (patchedFit.has(id)) output = patchFitSport(event.data, candidate.meta.sport);
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

      const out: OutputArchive[] = [];
      for (const [i, writer] of writers.entries()) {
        await writer.close();
        const blob = await (mine[i] as ArchiveTarget).close();
        out.push({ name: names[i] as string, blob, fileCount: counts[i] ?? 0 });
      }
      if (sizeOf !== rawSize && out.some((a) => a.blob.size > hardLimit)) {
        await Promise.allSettled(mine.map((t) => t.discard()));
        throw new OversizeError();
      }
      return out;
    };

    const rawSize = (c: Candidate): number => c.size;
    let archives: OutputArchive[];
    try {
      archives = await writeActivityArchives(
        options.estimateZipSize ?? ((c) => estimator.estimate(c)),
      );
    } catch (e) {
      if (!(e instanceof OversizeError)) throw e;
      archives = await writeActivityArchives(rawSize);
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
