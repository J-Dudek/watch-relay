import type { Batch } from './batching.js';
import type { Candidate } from './types.js';

const pad = (n: number): string => String(n).padStart(2, '0');

function utcStamp(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCFullYear())}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}`;
}

/** Ne garde que [a-z0-9_] : ni `/`, ni `..`, ni caractères de contrôle (T1.18). */
function safeSport(sport: string): string {
  const s = sport
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s === '' ? 'unknown' : s.slice(0, 40);
}

/**
 * Nom d'entrée normalisé, ex. `2023-05-14T07-32-10_running.fit`.
 * `taken` garantit l'unicité dans l'archive (suffixe `-2`, `-3`…).
 */
export function entryName(candidate: Candidate, taken: Set<string>): string {
  const base = `${utcStamp(candidate.meta.startTime)}_${safeSport(candidate.meta.sport)}`;
  let name = `${base}.${candidate.format}`;
  for (let n = 2; taken.has(name); n++) name = `${base}-${String(n)}.${candidate.format}`;
  taken.add(name);
  return name;
}

/** Nom d'archive généré, ex. `coros-import-01-2019-03_2021-07.zip` (T1.17). */
export function archiveName(batch: Batch, index: number): string {
  const first = batch.items[0];
  const last = batch.items.at(-1);
  const ym = (ms: number): string => {
    const d = new Date(ms);
    return `${String(d.getUTCFullYear())}-${pad(d.getUTCMonth() + 1)}`;
  };
  const range = first && last ? `-${ym(first.meta.startTime)}_${ym(last.meta.startTime)}` : '';
  return `coros-import-${pad(index + 1)}${range}.zip`;
}
