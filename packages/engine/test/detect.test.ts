import { describe, expect, it } from 'vitest';
import { detectFormat } from '../src/detect.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function fitHeader(size = 14): Uint8Array {
  const b = new Uint8Array(14);
  b[0] = size;
  b.set([0x2e, 0x46, 0x49, 0x54], 8);
  return b;
}

describe('detectFormat', () => {
  it('reconnaît un header FIT (12 et 14 octets)', () => {
    expect(detectFormat(fitHeader(14))).toBe('fit');
    expect(detectFormat(fitHeader(12))).toBe('fit');
  });
  it('rejette un faux FIT (signature absente ou taille de header invalide)', () => {
    const fake = fitHeader();
    fake[9] = 0;
    expect(detectFormat(fake)).toBeNull();
    expect(detectFormat(fitHeader(13))).toBeNull();
    expect(detectFormat(new Uint8Array(4))).toBeNull();
  });
  it('reconnaît un TCX, avec ou sans BOM / espaces', () => {
    const xml =
      '<?xml version="1.0"?>\n<TrainingCenterDatabase xmlns="x"></TrainingCenterDatabase>';
    expect(detectFormat(enc(xml))).toBe('tcx');
    expect(detectFormat(enc('\uFEFF  \n' + xml))).toBe('tcx');
  });
  it('rejette un XML quelconque et du texte', () => {
    expect(detectFormat(enc('<?xml version="1.0"?><gpx></gpx>'))).toBeNull();
    expect(detectFormat(enc('hello'))).toBeNull();
    expect(detectFormat(enc('{"wellness":1}'))).toBeNull();
  });
});
