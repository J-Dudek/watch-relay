import type { Candidate, RejectReason, Rejection } from './types.js';

export interface IgnoredEntry {
  /** Chemin d'origine, affiché uniquement dans le rapport (jamais utilisé en écriture). */
  readonly path: string;
  readonly note?: string;
  /** `health` : données de santé reconnues ; `other` : autre fichier valide qui n'est pas une activité. */
  readonly kind?: 'health' | 'other';
}

export interface Report {
  readonly kept: number;
  readonly rejected: readonly { id: string; reason: RejectReason; detail?: string }[];
  readonly ignored: readonly IgnoredEntry[];
  /** Nombre de fichiers de santé reconnus parmi les ignorés (non importables par cet outil). */
  readonly health: number;
  readonly rejectedByReason: Readonly<Partial<Record<RejectReason, number>>>;
  readonly bySport: Readonly<Record<string, number>>;
  readonly byYear: Readonly<Record<string, number>>;
}

export function buildReport(
  kept: readonly Candidate[],
  rejected: readonly Rejection[],
  ignored: readonly IgnoredEntry[] = [],
): Report {
  const bySport: Record<string, number> = {};
  const byYear: Record<string, number> = {};
  for (const c of kept) {
    bySport[c.meta.sport] = (bySport[c.meta.sport] ?? 0) + 1;
    const year = String(new Date(c.meta.startTime).getUTCFullYear());
    byYear[year] = (byYear[year] ?? 0) + 1;
  }
  const rejectedByReason: Partial<Record<RejectReason, number>> = {};
  for (const r of rejected) rejectedByReason[r.reason] = (rejectedByReason[r.reason] ?? 0) + 1;

  return {
    kept: kept.length,
    rejected: rejected.map((r) => ({
      id: r.candidate.id,
      reason: r.reason,
      ...(r.detail === undefined ? {} : { detail: r.detail }),
    })),
    ignored,
    health: ignored.filter((i) => i.kind === 'health').length,
    rejectedByReason,
    bySport,
    byYear,
  };
}
