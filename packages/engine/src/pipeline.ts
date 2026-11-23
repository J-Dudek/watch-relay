import type { Candidate, FileRule, PipelineResult, Rejection, SetRule } from './types.js';

/**
 * Moteur de règles (T1.14) : règles fichier d'abord (première qui rejette gagne),
 * puis règles d'ensemble sur les survivants. Ajouter une règle = un fichier + un test.
 */
export function runPipeline(
  candidates: readonly Candidate[],
  fileRules: readonly FileRule[],
  setRules: readonly SetRule[],
): PipelineResult {
  const rejected: Rejection[] = [];
  let kept: Candidate[] = [];

  for (const candidate of candidates) {
    let rejection: Rejection | null = null;
    for (const rule of fileRules) {
      rejection = rule.check(candidate);
      if (rejection) break;
    }
    if (rejection) rejected.push(rejection);
    else kept.push(candidate);
  }

  for (const rule of setRules) {
    const rejections = rule.check(kept);
    const ids = new Set(rejections.map((r) => r.candidate.id));
    rejected.push(...rejections);
    kept = kept.filter((c) => !ids.has(c.id));
  }

  kept.sort((a, b) => a.meta.startTime - b.meta.startTime || a.id.localeCompare(b.id));
  return { kept, rejected };
}
