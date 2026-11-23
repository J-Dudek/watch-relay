import type { FileRule } from '../types.js';

export interface Period {
  /** Borne basse incluse, ms epoch. */
  readonly from?: number;
  /** Borne haute incluse, ms epoch. */
  readonly to?: number;
}

export function createPeriodRule({ from, to }: Period): FileRule {
  return {
    id: 'period',
    check: (candidate) => {
      const t = candidate.meta.startTime;
      return (from !== undefined && t < from) || (to !== undefined && t > to)
        ? { candidate, reason: 'OUT_OF_RANGE' }
        : null;
    },
  };
}
