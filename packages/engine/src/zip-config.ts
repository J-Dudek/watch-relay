import { configure } from '@zip.js/zip.js';

/**
 * À appeler en tête d'un Web Worker : on y est déjà hors du thread principal, et créer des
 * sous-workers (blob:) serait bloqué par Trusted Types et inutile.
 */
export function configureZipForWorker(): void {
  configure({ useWebWorkers: false });
}
