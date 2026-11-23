import type { Candidate } from '../src/types.js';

export function cand(
  over: Partial<Candidate> & { sport?: string; startTime?: number } = {},
): Candidate {
  const { sport = 'running', startTime = Date.UTC(2023, 4, 14, 7, 32, 10), ...rest } = over;
  return {
    id: 'a',
    format: 'fit',
    size: 50_000,
    meta: { sport, startTime },
    ...rest,
  };
}
