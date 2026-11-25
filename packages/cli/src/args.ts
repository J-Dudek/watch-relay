import { parseArgs } from 'node:util';
import { DEFAULT_SUPPORTED_SPORTS, type Period, type Target } from '@watch-relay/engine';

export type Source = 'garmin' | 'coros' | 'polar' | 'strava';
const SOURCES: readonly Source[] = ['garmin', 'coros', 'polar', 'strava'];
const TARGETS: readonly Target[] = ['coros', 'garmin'];

export interface CliOptions {
  readonly input: string;
  readonly source: Source;
  readonly target: Target;
  readonly out: string;
  readonly dryRun: boolean;
  readonly period?: Period;
  readonly sportMap: Readonly<Record<string, string>>;
  readonly health: boolean;
  readonly json: boolean;
  readonly reportCsv?: string;
  readonly verbose: boolean;
}

export type ParsedArgs =
  | { readonly kind: 'run'; readonly options: CliOptions }
  | { readonly kind: 'help' }
  | { readonly kind: 'version' }
  | { readonly kind: 'error'; readonly message: string };

export const USAGE = `watch-relay : prépare ton historique d'activités pour un import ailleurs, en local.

Usage :
  watch-relay <export.zip> [options]

Options :
  --from <plateforme>      Origine de l'export : garmin (défaut), coros, polar, strava
  --to <plateforme>        Destination : coros (défaut, garmin si --from coros) ou garmin
  -o, --out <dossier>      Dossier des archives produites (défaut : ./watch-relay-out)
  --dry-run                Analyse et rapport seulement : aucune archive n'est conservée
  --since <AAAA-MM-JJ>     Ne garde que les activités à partir de cette date (incluse)
  --until <AAAA-MM-JJ>     Ne garde que les activités jusqu'à cette date (incluse)
  --reclassify <a=b>       Traite le sport « a » comme le sport accepté « b » (répétable)
  --health                 Extrait aussi les données de santé Garmin en CSV (archive à part)
  --report <fichier.csv>   Écrit le rapport détaillé (motifs, fichiers) en CSV
  --json                   Affiche le rapport en JSON sur la sortie standard
  --verbose                Liste tous les fichiers écartés (10 par motif sinon)
  -h, --help               Affiche cette aide
  -v, --version            Affiche la version

Codes de sortie : 0 succès, 1 erreur de traitement, 2 usage incorrect, 3 aucune activité importable,
130 interrompu.

Rien n'est envoyé nulle part : le traitement se fait entièrement sur cette machine.`;

/** `AAAA-MM-JJ` strict (jour réel), en ms UTC ; `undefined` sinon. */
function parseDay(value: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d
    ? ms
    : undefined;
}

export function parseCli(argv: readonly string[]): ParsedArgs {
  let values: ReturnType<typeof parse>['values'];
  let positionals: string[];
  try {
    ({ values, positionals } = parse(argv));
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : 'Arguments invalides.' };
  }
  if (values.help) return { kind: 'help' };
  if (values.version) return { kind: 'version' };
  if (positionals.length !== 1 || positionals[0] === undefined) {
    return {
      kind: 'error',
      message:
        positionals.length === 0
          ? "Indique l'archive d'export à traiter."
          : 'Une seule archive à la fois.',
    };
  }

  const source = (values.from ?? 'garmin') as Source;
  if (!SOURCES.includes(source)) {
    return { kind: 'error', message: `--from : « ${source} » inconnu (${SOURCES.join(', ')}).` };
  }
  const target = (values.to ?? (source === 'coros' ? 'garmin' : 'coros')) as Target;
  if (!TARGETS.includes(target)) {
    return {
      kind: 'error',
      message: `--to : « ${target} » inconnu (${TARGETS.join(', ')}). Polar et Strava ne sont que des sources.`,
    };
  }
  if ((target as string) === source) {
    return { kind: 'error', message: "La destination doit différer de l'origine." };
  }

  const since = values.since === undefined ? undefined : parseDay(values.since);
  const until = values.until === undefined ? undefined : parseDay(values.until);
  if (values.since !== undefined && since === undefined) {
    return { kind: 'error', message: '--since : date attendue au format AAAA-MM-JJ.' };
  }
  if (values.until !== undefined && until === undefined) {
    return { kind: 'error', message: '--until : date attendue au format AAAA-MM-JJ.' };
  }
  if (since !== undefined && until !== undefined && since > until) {
    return { kind: 'error', message: '--since doit précéder --until.' };
  }

  const sportMap: Record<string, string> = {};
  for (const item of values.reclassify ?? []) {
    const m = /^([a-z0-9_]+)=([a-z0-9_]+)$/.exec(item);
    if (!m) {
      return { kind: 'error', message: `--reclassify : « ${item} » (attendu : sport=sport).` };
    }
    const [, from = '', to = ''] = m;
    if (!DEFAULT_SUPPORTED_SPORTS.has(to)) {
      return {
        kind: 'error',
        message: `--reclassify : « ${to} » n'est pas un sport accepté (${[...DEFAULT_SUPPORTED_SPORTS].sort().join(', ')}).`,
      };
    }
    sportMap[from] = to;
  }
  if (values.health && source !== 'garmin') {
    return { kind: 'error', message: '--health ne concerne que les exports Garmin.' };
  }

  const period: Period | undefined =
    since === undefined && until === undefined
      ? undefined
      : {
          ...(since === undefined ? {} : { from: since }),
          ...(until === undefined ? {} : { to: until + 24 * 3600 * 1000 - 1 }),
        };
  return {
    kind: 'run',
    options: {
      input: positionals[0],
      source,
      target,
      out: values.out ?? 'watch-relay-out',
      dryRun: values['dry-run'] === true,
      ...(period ? { period } : {}),
      sportMap,
      health: values.health === true,
      json: values.json === true,
      ...(values.report === undefined ? {} : { reportCsv: values.report }),
      verbose: values.verbose === true,
    },
  };
}

function parse(argv: readonly string[]) {
  return parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      out: { type: 'string', short: 'o' },
      'dry-run': { type: 'boolean' },
      since: { type: 'string' },
      until: { type: 'string' },
      reclassify: { type: 'string', multiple: true },
      health: { type: 'boolean' },
      report: { type: 'string' },
      json: { type: 'boolean' },
      verbose: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
}
