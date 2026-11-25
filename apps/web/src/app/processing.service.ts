import { Injectable, computed, signal } from '@angular/core';
import { clearDirectory, WORK_DIR } from '@watch-relay/engine';
import type {
  ArchiveInfo,
  DirectoryLike,
  ErrorCode,
  ProcessProgress,
  Report,
  Target,
  WorkerRequest,
  WorkerResponse,
} from '@watch-relay/engine';

/** Plateformes : Garmin et COROS en source et en destination ; Polar et Strava seulement en source. */
export type Platform = 'garmin' | 'coros' | 'polar' | 'strava';
export const PLATFORM_NAMES: Record<Platform, string> = {
  garmin: 'Garmin',
  coros: 'COROS',
  polar: 'Polar',
  strava: 'Strava',
};

/** Destinations possibles pour une source donnée (Polar et Strava ne peuvent pas être une destination). */
export function validTargets(source: Platform): Target[] {
  return (['coros', 'garmin'] as const).filter((p) => p !== source);
}

export type Status = 'idle' | 'running' | 'done' | 'error';

export interface Failure {
  readonly code: ErrorCode;
  readonly message: string;
}

/** Garde-fou immédiat côté interface (le moteur applique la même limite, T2.3). */
export const MAX_INPUT_BYTES = 10 * 1024 ** 3;

@Injectable({ providedIn: 'root' })
export class ProcessingService {
  /** Plateforme d'origine de l'export déposé. */
  readonly source = signal<Platform>('garmin');
  /** Destination de l'import : COROS ou Garmin (jamais Polar ni Strava, sources seulement). */
  readonly target = signal<Target>('coros');
  /** Extraire aussi les données de santé en CSV (opt-in : données sensibles, lues sur demande). */
  readonly healthExport = signal(false);
  /** Reclassements de sport choisis (`{ golf: 'walking' }`) : appliqués au prochain traitement. */
  readonly sportMap = signal<Readonly<Record<string, string>>>({});
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

  constructor() {
    // Fermeture de l'onglet : purge au mieux (la page peut mourir avant la fin, d'où aussi le
    // nettoyage au démarrage du worker). `persisted` = page mise en cache arrière/avant : on garde.
    addEventListener('pagehide', (event) => {
      if (event.persisted) return;
      this.worker?.terminate();
      void this.clearStorage();
    });
  }

  private worker: Worker | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private readonly guard = (event: BeforeUnloadEvent): void => {
    event.preventDefault(); // T3.12
  };

  /** Dernier fichier déposé, gardé pour relancer l'analyse avec d'autres choix (jamais envoyé nulle part). */
  private sourceFile: File | null = null;

  start(file: File, sportMap: Readonly<Record<string, string>> = {}): void {
    this.reset();
    this.sourceFile = file;
    this.sportMap.set(sportMap);
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
        message: 'Worker crashed',
      });
    };
    this.send({
      type: 'start',
      file,
      options: {
        target: this.target(),
        healthExport: this.healthExport() && this.source() === 'garmin',
        polarSessions: this.source() === 'polar',
        stravaMetadata: this.source() === 'strava',
        ...(Object.keys(sportMap).length > 0 ? { sportMap } : {}),
      },
    });
  }

  /**
   * Relance l'analyse du même fichier en traitant certains sports comme d'autres (au lieu de les écarter).
   * Les choix précédents sont conservés.
   */
  reprocess(choices: Readonly<Record<string, string>>): void {
    const file = this.sourceFile;
    if (file) this.start(file, { ...this.sportMap(), ...choices });
  }

  cancel(): void {
    this.send({ type: 'cancel' });
  }

  /** Revient à l'accueil et libère le stockage temporaire (T1.24). */
  reset(): void {
    // Le worker d'abord : il détient les poignées d'écriture OPFS, sans quoi la purge échoue.
    this.worker?.terminate();
    this.worker = null;
    void this.clearStorage();
    this.release();
    this.sourceFile = null;
    this.sportMap.set({});
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
    void this.clearStorage(); // aucun résidu sur disque après un échec
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
