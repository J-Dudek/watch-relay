import { csvCell } from './csv.js';
import { isHealthPath } from './health.js';

/**
 * Extraction des données de santé d'un export Garmin vers des CSV lisibles (optionnelle).
 *
 * Les formats JSON de Garmin varient selon les versions de l'export : aucun champ n'est supposé.
 * Chaque fichier est aplati tel quel (une ligne par enregistrement, colonnes = clés, objets imbriqués
 * aplatis avec `.`), et regroupé par catégorie déduite du nom de fichier. Les tableaux d'objets
 * (chronologies minute par minute…) sont ignorés pour garder des fichiers raisonnables.
 */

export type HealthCategory =
  | 'sommeil'
  | 'stress'
  | 'vfc'
  | 'frequence-cardiaque'
  | 'activite-quotidienne'
  | 'spo2'
  | 'respiration'
  | 'body-battery'
  | 'hydratation'
  | 'autre';

const CATEGORY_RULES: readonly [HealthCategory, RegExp][] = [
  ['sommeil', /sleep/i],
  ['vfc', /hrv/i],
  ['stress', /stress/i],
  ['spo2', /spo2|pulse.?ox/i],
  ['respiration', /respiration/i],
  ['body-battery', /body.?battery/i],
  ['hydratation', /hydration/i],
  ['frequence-cardiaque', /heart.?rate|resting/i],
  ['activite-quotidienne', /uds|daily|steps|summary/i],
];

export function healthCategory(path: string): HealthCategory {
  const name = path.split('/').pop() ?? path;
  return CATEGORY_RULES.find(([, re]) => re.test(name))?.[0] ?? 'autre';
}

/** Fichier JSON candidat à l'extraction : reconnu comme santé et de type JSON. */
export const isHealthJsonPath = (path: string): boolean =>
  /\.json$/i.test(path) && isHealthPath(path);

export type Scalar = string | number | boolean | null;
export type Row = Record<string, Scalar>;

const MAX_DEPTH = 3;
const MAX_KEYS_PER_ROW = 200;
const MAX_STRING = 1000;
const MAX_SCALAR_ARRAY = 20;
/** Plafond de lignes par catégorie (mémoire) : au-delà, on tronque et on le signale. */
export const MAX_ROWS_PER_CATEGORY = 200_000;

function flattenInto(out: Row, prefix: string, value: unknown, depth: number): void {
  if (Object.keys(out).length >= MAX_KEYS_PER_ROW) return;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    out[prefix] = value;
  } else if (typeof value === 'string') {
    out[prefix] = value.slice(0, MAX_STRING);
  } else if (Array.isArray(value)) {
    if (
      value.length <= MAX_SCALAR_ARRAY &&
      value.every((v) => v === null || typeof v !== 'object')
    ) {
      out[prefix] = value.map((v) => String(v)).join('|');
    } // tableaux d'objets ou trop longs : ignorés
  } else if (typeof value === 'object' && depth < MAX_DEPTH) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flattenInto(out, prefix === '' ? k : `${prefix}.${k}`, v, depth + 1);
    }
  }
}

/** Un JSON devient une liste d'enregistrements plats : tableau d'objets, ou objet seul. */
export function flattenJson(value: unknown): Row[] {
  const records = Array.isArray(value) ? value : [value];
  const rows: Row[] = [];
  for (const record of records) {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) continue;
    const row: Row = {};
    flattenInto(row, '', record, 0);
    if (Object.keys(row).length > 0) rows.push(row);
  }
  return rows;
}

export interface HealthExportStats {
  /** Fichiers JSON de santé lus avec succès. */
  readonly files: number;
  /** Fichiers JSON illisibles (JSON invalide, vide…). */
  readonly unreadable: number;
  readonly rows: number;
  readonly rowsByCategory: Readonly<Partial<Record<HealthCategory, number>>>;
  /** Vrai si au moins une catégorie a dépassé le plafond de lignes. */
  readonly truncated: boolean;
}

export interface HealthCsvFile {
  readonly name: string;
  readonly content: string;
}

const DATE_LIKE = /date|time|day|jour/i;

export class HealthCollector {
  private readonly byCategory = new Map<HealthCategory, { rows: Row[]; columns: Set<string> }>();
  private files = 0;
  private unreadable = 0;
  private truncated = false;

  /** Ajoute un fichier JSON (octets bruts) ; ne lève jamais. */
  add(path: string, bytes: Uint8Array): void {
    let rows: Row[];
    try {
      rows = flattenJson(JSON.parse(new TextDecoder('utf-8').decode(bytes)));
    } catch {
      this.unreadable++;
      return;
    }
    if (rows.length === 0) {
      this.unreadable++;
      return;
    }
    this.files++;
    const category = healthCategory(path);
    const bucket = this.byCategory.get(category) ?? { rows: [], columns: new Set<string>() };
    this.byCategory.set(category, bucket);
    for (const row of rows) {
      if (bucket.rows.length >= MAX_ROWS_PER_CATEGORY) {
        this.truncated = true;
        break;
      }
      for (const key of Object.keys(row)) bucket.columns.add(key);
      bucket.rows.push(row);
    }
  }

  get hasData(): boolean {
    return [...this.byCategory.values()].some((b) => b.rows.length > 0);
  }

  stats(): HealthExportStats {
    const rowsByCategory: Partial<Record<HealthCategory, number>> = {};
    let rows = 0;
    for (const [category, bucket] of this.byCategory) {
      rowsByCategory[category] = bucket.rows.length;
      rows += bucket.rows.length;
    }
    return {
      files: this.files,
      unreadable: this.unreadable,
      rows,
      rowsByCategory,
      truncated: this.truncated,
    };
  }

  /** Un CSV par catégorie : BOM UTF-8, séparateur `;`, formules neutralisées (comme le rapport). */
  toCsvFiles(): HealthCsvFile[] {
    const files: HealthCsvFile[] = [];
    for (const [category, { rows, columns }] of this.byCategory) {
      if (rows.length === 0) continue;
      const all = [...columns];
      const header = [
        ...all.filter((c) => DATE_LIKE.test(c)),
        ...all.filter((c) => !DATE_LIKE.test(c)),
      ];
      const lines = [header.map(csvCell).join(';')];
      for (const row of rows) {
        lines.push(
          header
            .map((col) => {
              const v = row[col];
              return csvCell(v === undefined || v === null ? '' : String(v));
            })
            .join(';'),
        );
      }
      files.push({ name: `sante-${category}.csv`, content: '﻿' + lines.join('\r\n') + '\r\n' });
    }
    return files;
  }
}
