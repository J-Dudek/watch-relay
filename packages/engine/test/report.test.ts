import { describe, expect, it } from 'vitest';
import { buildReport, csvCell, reportToCsv } from '../src/index.js';
import { cand } from './helpers.js';

describe('rapport', () => {
  const report = buildReport(
    [cand({ id: 'a' }), cand({ id: 'b', sport: 'cycling', startTime: Date.UTC(2020, 0, 1) })],
    [{ candidate: cand({ id: 'x' }), reason: 'UNSUPPORTED_SPORT', detail: 'golf' }],
    [{ path: 'wellness/sleep.json', note: 'non-activité' }],
  );
  it('agrège par motif, sport et année', () => {
    expect(report.kept).toBe(2);
    expect(report.rejectedByReason).toEqual({ UNSUPPORTED_SPORT: 1 });
    expect(report.bySport).toEqual({ running: 1, cycling: 1 });
    expect(report.byYear).toEqual({ '2023': 1, '2020': 1 });
  });
  it('CSV : BOM, séparateur ;, CRLF', () => {
    const csv = reportToCsv(report);
    expect(csv.startsWith('\uFEFFstatut;fichier;motif;detail\r\n')).toBe(true);
    expect(csv).toContain('rejeté;x;UNSUPPORTED_SPORT;golf');
    expect(csv).toContain('ignoré;wellness/sleep.json;;non-activité');
  });
  it.each(['=1+1', '+SUM(A1)', '-2', '@cmd', '\tx'])('neutralise la formule %j', (v) => {
    expect(csvCell(v).replace(/^"/, '').startsWith("'")).toBe(true);
  });
  it('échappe guillemets et séparateurs', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
});
