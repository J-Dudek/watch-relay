import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { openAsBlob, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  ArchiveError,
  LimitError,
  processArchive,
  reportToCsv,
  type ProcessProgress,
} from '@watch-relay/engine';
import { parseCli, USAGE, type CliOptions } from './args.js';
import { createFileSink } from './file-sink.js';
import { formatReport } from './format.js';

export const VERSION = '0.1.0';

export const EXIT = { ok: 0, failure: 1, usage: 2, nothing: 3, interrupted: 130 } as const;

export interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  /** Affichage de la progression (terminal interactif seulement). */
  readonly progress?: (text: string) => void;
  readonly signal?: AbortSignal;
}

const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

/** Point d'entrée testable : renvoie le code de sortie, n'appelle jamais `process.exit`. */
export async function runCli(argv: readonly string[], io: Io): Promise<number> {
  const parsed = parseCli(argv);
  if (parsed.kind === 'help') {
    io.out(`${USAGE}\n`);
    return EXIT.ok;
  }
  if (parsed.kind === 'version') {
    io.out(`${VERSION}\n`);
    return EXIT.ok;
  }
  if (parsed.kind === 'error') {
    io.err(`Erreur : ${parsed.message}\n\n${USAGE}\n`);
    return EXIT.usage;
  }
  return execute(parsed.options, io);
}

async function execute(o: CliOptions, io: Io): Promise<number> {
  let size: number;
  try {
    size = statSync(resolve(o.input)).size;
  } catch {
    io.err(`Erreur : fichier introuvable : ${o.input}\n`);
    return EXIT.usage;
  }

  // Simulation : les archives sont écrites dans un dossier temporaire puis supprimées (tailles réelles).
  const outDir = o.dryRun ? await mkdtemp(join(tmpdir(), 'watch-relay-')) : resolve(o.out);
  const started = performance.now();
  try {
    const file = await openAsBlob(resolve(o.input), { type: 'application/zip' });
    let last = '';
    const { report, archives } = await processArchive(file, createFileSink(outDir), {
      target: o.target,
      ...(o.period ? { period: o.period } : {}),
      ...(o.source === 'polar' ? { polarSessions: true } : {}),
      ...(o.source === 'strava' ? { stravaMetadata: true } : {}),
      ...(o.health ? { healthExport: true } : {}),
      ...(Object.keys(o.sportMap).length > 0 ? { sportMap: o.sportMap } : {}),
      ...(io.signal ? { signal: io.signal } : {}),
      onProgress: (p: ProcessProgress) => {
        const line = `${p.phase === 'analyze' ? 'Analyse' : 'Écriture'} : ${String(p.processed)} fichier(s)`;
        if (line !== last) io.progress?.(line);
        last = line;
      },
    });
    const seconds = (performance.now() - started) / 1000;
    const withPaths = archives.map((a) => ({ ...a, path: join(outDir, a.name) }));

    if (o.reportCsv) await writeFile(resolve(o.reportCsv), reportToCsv(report), 'utf8');

    if (o.json) {
      io.out(
        JSON.stringify(
          {
            source: o.source,
            target: o.target,
            dryRun: o.dryRun,
            report,
            archives: withPaths.map((a) => ({
              name: a.name,
              kind: a.kind ?? 'activities',
              fileCount: a.fileCount,
              size: a.blob.size,
              ...(o.dryRun ? {} : { path: a.path }),
            })),
          },
          null,
          2,
        ) + '\n',
      );
    } else {
      io.out(
        formatReport({
          report,
          archives: withPaths,
          source: o.source,
          target: o.target,
          inputBytes: size,
          seconds,
          verbose: o.verbose,
          dryRun: o.dryRun,
        }),
      );
      if (!o.dryRun && withPaths.length > 0) io.out(`Écrites dans ${outDir}\n`);
    }
    return report.kept === 0 && !report.healthExport ? EXIT.nothing : EXIT.ok;
  } catch (e) {
    if (isAbort(e)) {
      io.err('Interrompu.\n');
      return EXIT.interrupted;
    }
    if (e instanceof LimitError || e instanceof ArchiveError) {
      io.err(`Erreur : ${e.message}\n`);
    } else {
      io.err(`Erreur : ${e instanceof Error ? e.message : String(e)}\n`);
    }
    return EXIT.failure;
  } finally {
    if (o.dryRun) await rm(outDir, { recursive: true, force: true });
  }
}
