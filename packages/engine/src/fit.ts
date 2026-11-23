import { Decoder, Stream } from '@garmin/fitsdk';
import type { ActivityMeta } from './types.js';

export class ParseError extends Error {
  readonly code: 'CORRUPTED';
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
    this.code = 'CORRUPTED';
  }
}

/** Types de fichier FIT qui portent des données de santé (pas des activités). */
const HEALTH_FIT_TYPES = new Set([
  'monitoringA',
  'monitoringB',
  'monitoringDaily',
  'weight',
  'bloodPressure',
]);
/**
 * Types récents, inconnus du SDK (le décodeur les rend sous forme de nombre) : 44 `metrics`, 49 `sleep`,
 * 68 `hrv_status`. Constatés dans un vrai export Garmin ; correspondance issue du profil FIT, à confirmer.
 */
const HEALTH_FIT_TYPE_NUMBERS = new Set([44, 49, 68]);

/**
 * Fichier FIT valide mais qui n'est pas une activité (suivi quotidien, poids, réglages, parcours…) :
 * ni importable, ni corrompu. `kind: 'health'` pour les données de santé.
 */
export class NotActivityError extends Error {
  readonly kind: 'health' | 'other';
  constructor(kind: 'health' | 'other', fitType: string) {
    super(`FIT de type « ${fitType} » : pas une activité`);
    this.name = 'NotActivityError';
    this.kind = kind;
  }
}

/**
 * Le SDK rend les énumérations en camelCase (`alpineSkiing`) ; la liste des sports et les noms de
 * fichiers sont en snake_case (`alpine_skiing`). Sans cette conversion, tout sport composé était
 * écarté à tort (constaté sur un vrai export : ski alpin, ski de fond).
 */
export function snakeCase(value: string | undefined): string | undefined {
  return value?.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

const SESSION_MESG = 18;
const RECORD_MESG = 20;

/** Extrait les métadonnées d'un FIT ; CRC invalide ou fichier tronqué → `ParseError` (T1.5, T1.7). */
export function parseFit(bytes: Uint8Array): ActivityMeta {
  let session: Record<string, unknown> | undefined;
  let fileId: Record<string, unknown> | undefined;
  let points = 0;
  try {
    const decoder = new Decoder(Stream.fromByteArray(bytes));
    if (!decoder.isFIT() || !decoder.checkIntegrity()) throw new ParseError('FIT invalide (CRC)');
    const { errors } = decoder.read({
      mesgListener: (num, mesg) => {
        if (num === RECORD_MESG) points++;
        else if (num === SESSION_MESG && !session) session = mesg as Record<string, unknown>;
        else if (num === 0 && !fileId) fileId = mesg as Record<string, unknown>;
      },
    });
    if (errors.length > 0 && !session) throw new ParseError('FIT illisible');
  } catch (e) {
    throw e instanceof ParseError ? e : new ParseError('FIT illisible');
  }
  if (!session) {
    // Sans session : un fichier de santé ou de configuration valide n'est pas « corrompu ».
    // CRC valide + `file_id` d'un type autre qu'« activity » : un fichier légitime qui n'est pas une
    // activité. Le type peut être un nombre quand le SDK ne connaît pas encore la valeur.
    const raw = fileId?.type;
    if (raw !== undefined && raw !== 'activity') {
      const isHealth =
        typeof raw === 'string'
          ? HEALTH_FIT_TYPES.has(raw)
          : typeof raw === 'number' && HEALTH_FIT_TYPE_NUMBERS.has(raw);
      const label = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : 'inconnu';
      throw new NotActivityError(isHealth ? 'health' : 'other', label);
    }
    throw new ParseError('Aucune session dans le FIT');
  }

  const start = session.startTime;
  if (!(start instanceof Date) || Number.isNaN(start.getTime()))
    throw new ParseError('Date absente');
  const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const sport = snakeCase(str(session.sport)) ?? 'generic';
  const subSport = str(session.subSport);
  const durationS = num(session.totalElapsedTime);
  const distanceM = num(session.totalDistance);
  const device = [str(fileId?.manufacturer), str(fileId?.productName) ?? num(fileId?.product)]
    .filter((x) => x !== undefined)
    .join(' ');

  return {
    sport,
    startTime: start.getTime(),
    points,
    ...(subSport === undefined ? {} : { subSport }),
    ...(durationS === undefined ? {} : { durationS }),
    ...(distanceM === undefined ? {} : { distanceM }),
    ...(device === '' ? {} : { device }),
  };
}
