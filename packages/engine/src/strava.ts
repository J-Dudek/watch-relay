import type { Candidate } from './types.js';
import { tcxSportName } from './tcx-writer.js';

/**
 * Métadonnées de l'export Strava : `activities.csv` donne, pour chaque activité, son type et le nom de son
 * fichier. Les GPX Strava n'indiquent pas toujours le sport ; le type du CSV permet de le retrouver.
 *
 * Les en-têtes sont localisés selon la langue du compte : les colonnes sont donc reconnues par leur
 * contenu (chemins `activities/…`, types d'activité connus) autant que par leur titre.
 */

const MAX_ROWS = 200_000;
const MAX_FIELD = 2_000;

/** CSV (RFC 4180) : guillemets, virgules et sauts de ligne dans les champs. Temps linéaire, plafonné. */
export function parseCsv(text: string, maxRows = MAX_ROWS): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endField = (): void => {
    row.push(field.slice(0, MAX_FIELD));
    field = '';
  };
  const endRow = (): void => {
    endField();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const c = text[i] as string;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') endField();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow();
      if (rows.length >= maxRows) return rows;
    } else field += c;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Type d'activité Strava (EN et FR) → sport du moteur. Les types inconnus ne sont pas devinés. */
const TYPE_TO_SPORT: ReadonlyMap<string, string> = new Map(
  Object.entries({
    running: ['run', 'trail run', 'virtual run', 'course a pied', 'course'],
    cycling: [
      'ride',
      'virtual ride',
      'e bike ride',
      'ebike ride',
      'emountain bike ride',
      'mountain bike ride',
      'gravel ride',
      'handcycle',
      'velo',
      'velo virtuel',
      'sortie velo',
    ],
    swimming: ['swim', 'natation'],
    walking: ['walk', 'marche'],
    hiking: ['hike', 'randonnee'],
    rowing: ['rowing', 'virtual row', 'aviron'],
    cross_country_skiing: ['nordic ski', 'ski de fond'],
    alpine_skiing: ['alpine ski', 'ski alpin'],
    snowboarding: ['snowboard'],
    training: ['workout', 'weight training', 'crossfit', 'hiit', 'yoga', 'pilates', 'musculation'],
    fitness_equipment: ['elliptical', 'stair stepper', 'velo elliptique'],
  }).flatMap(([sport, types]) => types.map((t) => [t, sport] as const)),
);

/** Sport du moteur pour un type d'activité Strava, ou `undefined` s'il n'est pas reconnu. */
export function stravaSport(type: string): string | undefined {
  return TYPE_TO_SPORT.get(normalize(type));
}

const FILENAME_HEADERS = new Set(
  [
    'filename',
    'file name',
    'nom du fichier',
    'nom de fichier',
    'dateiname',
    'nombre del archivo',
  ].map(normalize),
);
const TYPE_HEADERS = new Set(
  ['activity type', "type d'activite", 'type d activite', 'aktivitatstyp', 'tipo de actividad'].map(
    normalize,
  ),
);

export interface StravaMetadata {
  /** Nom de fichier (sans dossier) → sport du moteur. */
  readonly sports: ReadonlyMap<string, string>;
  /** Activités listées sans fichier (saisies manuelles) : non transférables. */
  readonly withoutFile: number;
  /** Activités listées dans le CSV. */
  readonly rows: number;
}

const baseOf = (path: string): string => (path.split('/').pop() ?? path).trim();

/** Colonne dont l'en-tête est connu ; sinon celle dont le plus de valeurs satisfont `looksRight`. */
function findColumn(
  rows: readonly string[][],
  known: ReadonlySet<string>,
  looksRight: (v: string) => boolean,
): number {
  const header = rows[0] ?? [];
  const byTitle = header.findIndex((h) => known.has(normalize(h)));
  if (byTitle !== -1) return byTitle;
  let best = -1;
  let bestCount = 0;
  const width = header.length;
  for (let col = 0; col < width; col++) {
    let count = 0;
    for (let r = 1; r < Math.min(rows.length, 501); r++) {
      if (looksRight(rows[r]?.[col] ?? '')) count++;
    }
    if (count > bestCount) {
      best = col;
      bestCount = count;
    }
  }
  return best;
}

/** Lit `activities.csv`. Ne lève jamais : un CSV illisible donne simplement des métadonnées vides. */
export function parseStravaCsv(bytes: Uint8Array): StravaMetadata {
  const empty: StravaMetadata = { sports: new Map(), withoutFile: 0, rows: 0 };
  let rows: string[][];
  try {
    rows = parseCsv(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return empty;
  }
  if (rows.length < 2) return empty;
  const fileCol = findColumn(rows, FILENAME_HEADERS, (v) => /^activities\/[^/]+$/i.test(v.trim()));
  const typeCol = findColumn(rows, TYPE_HEADERS, (v) => stravaSport(v) !== undefined);
  if (fileCol === -1) return { ...empty, rows: rows.length - 1 };
  const sports = new Map<string, string>();
  let withoutFile = 0;
  for (const row of rows.slice(1)) {
    const file = (row[fileCol] ?? '').trim();
    if (file === '') {
      withoutFile++;
      continue;
    }
    const sport = typeCol === -1 ? undefined : stravaSport(row[typeCol] ?? '');
    if (sport) sports.set(baseOf(file), sport);
  }
  return { sports, withoutFile, rows: rows.length - 1 };
}

/** Nom de fichier d'origine d'un candidat (identifiant = chemin, éventuellement suffixé `#n`). */
const candidateBase = (id: string): string => baseOf(id).replace(/#\d+$/, '');

/**
 * Applique le sport du CSV aux candidats dont le fichier ne dit rien d'utile (`generic`, `unknown`).
 * Un sport lu dans le fichier lui-même n'est jamais écrasé. Pour un GPX converti, la taille du TCX
 * suit le libellé de sport écrit (`Running`, `Biking`, `Other`), pour que les deux passes concordent.
 */
export function applySportHints(
  candidates: readonly Candidate[],
  sports: ReadonlyMap<string, string>,
): Candidate[] {
  if (sports.size === 0) return [...candidates];
  return candidates.map((c) => {
    const hint = sports.get(candidateBase(c.id));
    if (hint === undefined || hint === c.meta.sport) return c;
    if (c.meta.sport !== 'generic' && c.meta.sport !== 'unknown') return c;
    const delta =
      c.convertedFrom === 'gpx' ? tcxSportName(hint).length - tcxSportName(c.meta.sport).length : 0;
    return { ...c, size: c.size + delta, meta: { ...c.meta, sport: hint } };
  });
}
