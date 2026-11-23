import type { LimitCode } from './limits.js';
import type { ProcessProgress } from './process.js';
import type { Period } from './rules/period.js';
import type { Report } from './report.js';

/** Répertoire OPFS de travail (nettoyé au démarrage et à la réinitialisation, T1.24). */
export const WORK_DIR = 'watch-relay-out';

/** Contrat typé partagé entre l'interface et le worker (T1.21). */
export interface StartOptions {
  readonly period?: Period;
}

export type WorkerRequest =
  | { readonly type: 'start'; readonly file: File; readonly options?: StartOptions }
  | { readonly type: 'cancel' }
  | { readonly type: 'cleanup' };

export interface ArchiveInfo {
  readonly name: string;
  readonly size: number;
  readonly fileCount: number;
  /** Contenu (adossé au disque quand le stockage est OPFS). */
  readonly blob: Blob;
}

export type ErrorCode = LimitCode | 'INVALID_ARCHIVE' | 'ABORTED' | 'UNKNOWN';

export type WorkerResponse =
  | { readonly type: 'progress'; readonly progress: ProcessProgress }
  | {
      readonly type: 'result';
      readonly report: Report;
      readonly archives: readonly ArchiveInfo[];
      readonly storage: 'opfs' | 'memory';
    }
  | { readonly type: 'error'; readonly code: ErrorCode; readonly message: string }
  | { readonly type: 'cleaned' };
