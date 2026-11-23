import type { Report } from './report.js';

/** Neutralise l'injection de formules et échappe pour CSV `;` (T1.20). */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV avec BOM UTF-8 et séparateur `;`, ouvrable dans Excel et LibreOffice. */
export function reportToCsv(report: Report): string {
  const rows: string[][] = [['statut', 'fichier', 'motif', 'detail']];
  for (const r of report.rejected) rows.push(['rejeté', r.id, r.reason, r.detail ?? '']);
  for (const i of report.ignored) rows.push(['ignoré', i.path, '', i.note ?? '']);
  return '﻿' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
