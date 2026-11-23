import { Injectable, computed, signal } from '@angular/core';
import { clearDirectory, WORK_DIR } from '@watch-relay/engine';
import type {
  ArchiveInfo,
  DirectoryLike,
  ErrorCode,
  ProcessProgress,
  Report,
  WorkerRequest,
  WorkerResponse,
} from '@watch-relay/engine';

export type Status = 'idle' | 'running' | 'done' | 'error';

export interface Failure {
  readonly code: ErrorCode;
  readonly message: string;
}

/** Garde-fou immédiat côté interface (le moteur applique la même limite, T2.3). */
export const MAX_INPUT_BYTES = 10 * 1024 ** 3;

@Injectable({ providedIn: 'root' })
export class ProcessingService {
  readonly status = signal<Status>('idle');
  readonly progress = signal<ProcessProgress | null>(null);
  readonly report = signal<Report | null>(null);
  readonly archives = signal<readonly ArchiveInfo[]>([]);
  readonly failure = signal<Failure | null>(null);
  readonly fileName = signal<string | null>(null);
  readonly startedAt = signal(0);

  readonly percent = computed(() => {
    const p = this.progress();
    return p?.phase === 'write' && p.total ? Math.round((p.processed / p.total) * 100) : null;
  });

  private worker: Worker | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private readonly guard = (event: BeforeUnloadEvent): void => {
    event.preventDefault(); // T3.12
  };

  start(file: File): void {
    this.reset();
    this.fileName.set(file.name);
    this.status.set('running');
    this.startedAt.set(Date.now());
    addEventListener('beforeunload', this.guard);
    void this.acquireWakeLock();

    const worker = new Worker(new URL('./processing.worker', import.meta.url), { type: 'module' });
    this.worker = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.onMessage(event.data);
    };
    worker.onerror = () => {
      this.fail({
        code: 'UNKNOWN',
        message: 'Le traitement s’est interrompu de façon inattendue.',
      });
    };
    this.send({ type: 'start', file });
  }

  cancel(): void {
    this.send({ type: 'cancel' });
  }

  /** Revient à l'accueil et libère le stockage temporaire (T1.24). */
  reset(): void {
    void this.clearStorage();
    this.worker?.terminate();
    this.worker = null;
    this.release();
    this.status.set('idle');
    this.progress.set(null);
    this.report.set(null);
    this.archives.set([]);
    this.failure.set(null);
    this.fileName.set(null);
  }

  private async clearStorage(): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle(WORK_DIR);
      await clearDirectory(dir as unknown as DirectoryLike);
    } catch {
      /* rien à nettoyer ou OPFS indisponible */
    }
  }

  private send(request: WorkerRequest): void {
    this.worker?.postMessage(request);
  }

  private onMessage(message: WorkerResponse): void {
    switch (message.type) {
      case 'progress':
        this.progress.set(message.progress);
        break;
      case 'result':
        this.report.set(message.report);
        this.archives.set(message.archives);
        this.status.set('done');
        this.release();
        break;
      case 'error':
        this.fail({ code: message.code, message: message.message });
        break;
      case 'cleaned':
        break;
    }
  }

  private fail(failure: Failure): void {
    this.failure.set(failure);
    this.status.set('error');
    this.worker?.terminate();
    this.worker = null;
    this.release();
  }

  private release(): void {
    removeEventListener('beforeunload', this.guard);
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }

  private async acquireWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) this.wakeLock = await navigator.wakeLock.request('screen'); // T3.11
    } catch {
      this.wakeLock = null;
    }
  }
}
