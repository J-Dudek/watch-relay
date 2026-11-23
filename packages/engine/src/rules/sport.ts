import { DEFAULT_SUPPORTED_SPORTS } from '../sports.js';
import type { FileRule } from '../types.js';

export function createSportRule(
  supported: ReadonlySet<string> = DEFAULT_SUPPORTED_SPORTS,
): FileRule {
  return {
    id: 'unsupported-sport',
    check: (candidate) =>
      supported.has(candidate.meta.sport)
        ? null
        : { candidate, reason: 'UNSUPPORTED_SPORT', detail: candidate.meta.sport },
  };
}
