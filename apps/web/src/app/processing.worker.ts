/// <reference lib="webworker" />
import {
  clearDirectory,
  configureZipForWorker,
  createMemorySink,
  createOpfsSink,
  ArchiveError,
  LimitError,
  processArchive,
  WORK_DIR,
  type ArchiveSink,
  type DirectoryLike,
  type WorkerRequest,
  type WorkerResponse,
} from '@watch-relay/engine';

configureZipForWorker();

let controller: AbortController | null = null;

function post(message: WorkerResponse): void {
  postMessage(message);
}

/** OPFS si disponible (`createSyncAccessHandle` en worker), sinon repli mémoire (T1.16). */
async function openWorkDir(): Promise<DirectoryLike | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = (await root.getDirectoryHandle(WORK_DIR, {
      create: true,
    })) as unknown as DirectoryLike;
    await clearDirectory(dir); // T1.24 : pas de résidu entre sessions
    return dir;
  } catch {
    return null;
  }
}

async function start(
  file: File,
  options: Extract<WorkerRequest, { type: 'start' }>['options'],
): Promise<void> {
  controller = new AbortController();
  const dir = await openWorkDir();
  const sink: ArchiveSink = dir ? createOpfsSink(dir) : createMemorySink();
  let last = 0;
  try {
    const { report, archives } = await processArchive(file, sink, {
      signal: controller.signal,
      ...(options?.period ? { period: options.period } : {}),
      ...(options?.target ? { target: options.target } : {}),
      ...(options?.healthExport ? { healthExport: true } : {}),
      ...(options?.polarSessions ? { polarSessions: true } : {}),
      ...(options?.stravaMetadata ? { stravaMetadata: true } : {}),
      ...(options?.sportMap ? { sportMap: options.sportMap } : {}),
      onProgress(progress) {
        const now = performance.now();
        if (now - last < 250 && progress.processed !== progress.total) return;
        last = now;
        post({ type: 'progress', progress });
      },
    });
    post({
      type: 'result',
      report,
      storage: dir ? 'opfs' : 'memory',
      archives: archives.map((a) => ({
        ...(a.kind ? { kind: a.kind } : {}),
        name: a.name,
        size: a.blob.size,
        fileCount: a.fileCount,
        blob: a.blob,
      })),
    });
  } catch (e) {
    if (dir) await clearDirectory(dir);
    if (e instanceof DOMException && e.name === 'AbortError') {
      post({ type: 'error', code: 'ABORTED', message: 'Aborted' });
    } else if (e instanceof LimitError || e instanceof ArchiveError) {
      post({ type: 'error', code: e.code, message: e.message });
    } else {
      post({ type: 'error', code: 'UNKNOWN', message: 'Processing failed' });
    }
  } finally {
    controller = null;
  }
}

addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  // Worker dédié : seul le document qui l'a créé peut lui écrire, et `origin` y est vide. Tout message
  // portant une origine vient d'ailleurs : on l'ignore (contrôle d'origine explicite).
  if (event.origin !== '') return;
  const request = event.data;
  if (request.type === 'start') void start(request.file, request.options);
  else if (request.type === 'cancel') controller?.abort();
  else {
    void openWorkDir().then(() => {
      post({ type: 'cleaned' });
    });
  }
});
