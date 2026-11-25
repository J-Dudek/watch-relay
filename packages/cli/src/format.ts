import type { OutputArchive, Report } from '@watch-relay/engine';

const MB = 1024 ** 2;
export const mb = (n: number): string =>
  n >= 1024 * MB ? `${(n / 1024 / MB).toFixed(1)} Go` : `${(n / MB).toFixed(1)} Mo`;

const REASON_TITLES: Record<string, string> = {
  TOO_SMALL: 'Fichiers trop petits',
  TOO_LARGE: 'Fichiers trop volumineux',
  TOO_MANY_POINTS: 'Fichiers trop détaillés',
  UNSUPPORTED_SPORT: 'Sports non pris en charge',
  DUPLICATE: 'Doublons',
  CORRUPTED: 'Fichiers illisibles',
  OUT_OF_RANGE: 'Hors de la période choisie',
};

export interface TextReportInput {
  readonly report: Report;
  readonly archives: readonly (OutputArchive & { readonly path?: string })[];
  readonly source: string;
  readonly target: string;
  readonly inputBytes: number;
  readonly seconds: number;
  readonly verbose: boolean;
  readonly dryRun: boolean;
}

/** Rapport lisible : mêmes informations que l'écran d'analyse (comptes, sports, doublons, fichiers). */
export function formatReport(i: TextReportInput): string {
  const { report: r } = i;
  const lines: string[] = [];
  const rejected = r.rejected.length;
  lines.push(`watch-relay · ${i.source} → ${i.target}`);
  lines.push(`Export : ${mb(i.inputBytes)} · durée : ${i.seconds.toFixed(1)} s`);
  lines.push('');
  lines.push(
    `${String(r.kept)} activité(s) prête(s) · ${String(rejected)} écartée(s) · ${String(r.ignored.length)} fichier(s) ignoré(s)`,
  );

  if (r.reclassified) {
    lines.push(
      `Reclassé(s) : ${r.reclassified.map((x) => `${x.from} → ${x.to} (${String(x.count)})`).join(', ')}`,
    );
  }
  if (r.stravaWithoutFile) {
    lines.push(
      `${String(r.stravaWithoutFile)} activité(s) Strava sans fichier (saisies manuelles) : non transférables.`,
    );
  }
  if (r.convertedGpx > 0) {
    lines.push(
      `${String(r.convertedGpx)} GPX converti(s) (${String(r.convertedGpxFit)} en FIT, ${String(r.convertedGpx - r.convertedGpxFit)} en TCX).`,
    );
  }
  if (r.convertedPolar > 0) lines.push(`${String(r.convertedPolar)} séance(s) Polar convertie(s).`);
  if (r.healthExport) {
    lines.push(
      `Santé : ${String(r.healthExport.rows)} ligne(s) extraites de ${String(r.healthExport.files)} fichier(s) (CSV, non importables).`,
    );
  } else if (r.health > 0) {
    lines.push(`${String(r.health)} fichier(s) de santé détecté(s), non inclus (voir --health).`);
  }

  const byReason = Object.entries(r.rejectedByReason);
  for (const [reason, count] of byReason) {
    lines.push('', `${REASON_TITLES[reason] ?? reason} (${String(count)})`);
    const items = r.rejected.filter((x) => x.reason === reason);
    if (reason === 'UNSUPPORTED_SPORT') {
      const bySport = new Map<string, number>();
      for (const x of items) bySport.set(x.detail ?? '?', (bySport.get(x.detail ?? '?') ?? 0) + 1);
      const sports = [...bySport.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      lines.push(`  Sports : ${sports.map(([s, n]) => `${s} (${String(n)})`).join(', ')}`);
      lines.push('  Pour les importer quand même : --reclassify <sport>=<sport accepté>');
    }
    const shown = i.verbose ? items : items.slice(0, 10);
    for (const x of shown) {
      lines.push(
        `  - ${x.id}${reason === 'DUPLICATE' && x.detail ? ` (conservé : ${x.detail})` : ''}`,
      );
    }
    if (shown.length < items.length) {
      lines.push(`  … et ${String(items.length - shown.length)} autre(s) (--verbose ou --report)`);
    }
  }

  const sports = Object.entries(r.bySport).sort((a, b) => b[1] - a[1]);
  if (sports.length > 0) {
    lines.push('', `Par sport : ${sports.map(([s, n]) => `${s} ${String(n)}`).join(', ')}`);
    lines.push(
      `Par année : ${Object.entries(r.byYear)
        .map(([y, n]) => `${y} ${String(n)}`)
        .join(', ')}`,
    );
  }

  if (r.kept === 0 && !r.healthExport) lines.push('', 'Aucune activité importable.');
  lines.push('', i.dryRun ? 'Archives (simulation, non conservées) :' : 'Archives :');
  for (const a of i.archives) {
    lines.push(
      `  ${i.dryRun ? a.name : (a.path ?? a.name)} · ${String(a.fileCount)} fichier(s) · ${mb(a.blob.size)}`,
    );
  }
  return lines.join('\n') + '\n';
}
