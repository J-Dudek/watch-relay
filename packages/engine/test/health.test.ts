import { describe, expect, it } from 'vitest';
import {
  analyzeFile,
  createMemorySink,
  isHealthPath,
  processArchive,
  reportToCsv,
} from '../src/index.js';
import { makeFit, makeFitOfType, makeZip } from './fixtures.js';

describe('FIT qui n’est pas une activité', () => {
  it.each(['monitoringDaily', 'monitoringA', 'monitoringB', 'weight', 'bloodPressure'])(
    '%s : donnée de santé, pas un fichier corrompu',
    (type) => {
      const out = analyzeFile('x', 'fit', makeFitOfType(type));
      expect(out.ok).toBe(false);
      expect(out).toMatchObject({ skipped: { kind: 'health' } });
    },
  );

  it.each(['settings', 'course', 'workout', 'device'])(
    '%s : autre fichier valide (ni santé, ni activité)',
    (type) => {
      expect(analyzeFile('x', 'fit', makeFitOfType(type))).toMatchObject({
        skipped: { kind: 'other' },
      });
    },
  );

  // Types récents que le SDK décode en nombre (constatés sur un vrai export) : sleep, hrv_status, metrics.
  it.each([49, 68, 44])('type numérique %i (inconnu du SDK) : santé, pas corrompu', (type) => {
    expect(analyzeFile('x', 'fit', makeFitOfType(type))).toMatchObject({
      skipped: { kind: 'health' },
    });
  });

  it('type numérique inconnu : autre fichier valide', () => {
    expect(analyzeFile('x', 'fit', makeFitOfType(41))).toMatchObject({
      skipped: { kind: 'other' },
    });
  });

  it('un FIT « activity » sans session reste CORRUPTED', () => {
    expect(analyzeFile('x', 'fit', makeFitOfType('activity'))).toMatchObject({
      rejection: { reason: 'CORRUPTED' },
    });
  });
});

describe('isHealthPath', () => {
  it.each([
    'DI_CONNECT/DI-Connect-Wellness/2023_sleepData.json',
    'x/DI-Connect-Wellness/anything.json',
    'a/2023-01-01_hrvStatus.json',
    'a/UDSFile_2023.json',
    'b/restingHeartRate.csv',
  ])('reconnaît %s', (p) => {
    expect(isHealthPath(p)).toBe(true);
  });

  it.each([
    'readme.txt',
    'DI_CONNECT/DI-Connect-User/user_profile.json',
    'a/photo.jpg',
    'notes.json',
  ])('ne confond pas %s avec de la santé', (p) => {
    expect(isHealthPath(p)).toBe(false);
  });
});

describe('rapport : données de santé', () => {
  it('les compte, ne les range pas parmi les fichiers illisibles et les nomme dans le CSV', async () => {
    const zip = await makeZip([
      ['run.fit', makeFit({ minSize: 40_000 })],
      ['monitoring.fit', makeFitOfType('monitoringDaily')],
      ['DI_CONNECT/DI-Connect-Wellness/2023_sleepData.json', '{"sleep":[]}'],
      ['DI_CONNECT/DI-Connect-User/profile.json', '{}'],
    ]);
    const { report } = await processArchive(zip, createMemorySink());
    expect(report.kept).toBe(1);
    expect(report.health).toBe(2);
    expect(report.rejectedByReason.CORRUPTED).toBeUndefined();
    expect(report.ignored).toHaveLength(3);
    const csv = reportToCsv(report);
    expect(csv.match(/SANTE/g)).toHaveLength(2);
  });
});
