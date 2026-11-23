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
  if (!session) throw new ParseError('Aucune session dans le FIT');

  const start = session.startTime;
  if (!(start instanceof Date) || Number.isNaN(start.getTime()))
    throw new ParseError('Date absente');
  const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const sport = str(session.sport)?.toLowerCase() ?? 'generic';
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
