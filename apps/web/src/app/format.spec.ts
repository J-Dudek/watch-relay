import { REJECT_MESSAGES, formatBytes } from './format';

describe('formatBytes', () => {
  it('formate les tailles', () => {
    expect(formatBytes(0)).toBe('0 o');
    expect(formatBytes(1536)).toContain('1,5');
    expect(formatBytes(1536)).toContain('Ko');
    expect(formatBytes(5 * 1024 ** 3)).toContain('Go');
  });
});

describe('REJECT_MESSAGES', () => {
  it('chaque motif a un titre et une action possible', () => {
    for (const reason of [
      'TOO_SMALL',
      'TOO_LARGE',
      'UNSUPPORTED_SPORT',
      'DUPLICATE',
      'CORRUPTED',
      'OUT_OF_RANGE',
    ] as const) {
      expect(REJECT_MESSAGES[reason].title.length).toBeGreaterThan(0);
      expect(REJECT_MESSAGES[reason].hint.length).toBeGreaterThan(0);
    }
  });
});
