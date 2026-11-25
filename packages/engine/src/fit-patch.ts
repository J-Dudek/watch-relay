import { Profile } from '@garmin/fitsdk';
import { ParseError } from './fit.js';
import { fitSportName } from './fit-writer.js';

/**
 * Reclassement du sport d'un FIT d'origine SANS le réécrire : seuls les octets du sport (et du sous-sport,
 * remis à « generic », car l'ancien n'a plus de sens) sont modifiés sur place dans les messages `session`,
 * `lap` et `sport`, puis le CRC du fichier est recalculé. Tout le reste est conservé tel quel, et la taille
 * ne change pas (les deux passes du traitement concordent).
 *
 * Le fichier est parcouru selon sa structure (en-têtes, définitions, messages de données, champs de
 * développeur, fichiers chaînés) ; au moindre doute on lève `ParseError` et l'appelant garde le fichier tel quel.
 */

const MESG_SPORT = 12;
const MESG_SESSION = 18;
const MESG_LAP = 19;
/** Numéros de champ (sport, sous-sport) par message, d'après le profil FIT. */
const SPORT_FIELDS: Readonly<Record<number, readonly [sport: number, subSport: number]>> = {
  [MESG_SPORT]: [0, 1],
  [MESG_SESSION]: [5, 6],
  [MESG_LAP]: [25, 39],
};

const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401,
  0x5000, 0x9c01, 0x8801, 0x4400,
];

/** CRC-16 du format FIT (celui du SDK), sur `bytes[start, end)`. */
export function fitCrc(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    const byte = bytes[i] as number;
    let tmp = CRC_TABLE[crc & 0xf] as number;
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ (CRC_TABLE[byte & 0xf] as number);
    tmp = CRC_TABLE[crc & 0xf] as number;
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ (CRC_TABLE[(byte >> 4) & 0xf] as number);
  }
  return crc;
}

/** Valeur numérique de l'énumération `sport` du FIT pour un sport du moteur (`generic` si inconnu). */
export function fitSportValue(sport: string): number {
  const name = fitSportName(sport);
  const types = Profile.types.sport as Record<string, string>;
  const entry = Object.entries(types).find(([, v]) => v === name);
  return entry ? Number(entry[0]) : 0;
}

interface FieldDef {
  readonly num: number;
  readonly size: number;
  /** Décalage du champ dans le message de données. */
  readonly offset: number;
}
interface Definition {
  readonly globalNum: number;
  readonly fields: readonly FieldDef[];
  readonly size: number;
}

/**
 * Retourne une copie du FIT dont le sport est `sport`. Lève `ParseError` si la structure est inattendue
 * ou si aucun message de session n'a pu être modifié.
 */
export function patchFitSport(bytes: Uint8Array, sport: string): Uint8Array {
  const out = bytes.slice();
  const value = fitSportValue(sport);
  const len = out.length;
  let pos = 0;
  let patchedSessions = 0;

  while (pos < len) {
    const headerSize = out[pos];
    if (headerSize !== 12 && headerSize !== 14) throw new ParseError('FIT : en-tête inattendu');
    if (pos + headerSize + 2 > len) throw new ParseError('FIT tronqué');
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    const dataSize = view.getUint32(pos + 4, true);
    const end = pos + headerSize + dataSize + 2;
    if (end > len) throw new ParseError('FIT tronqué');

    const defs = new Map<number, Definition>();
    let at = pos + headerSize;
    const dataEnd = end - 2;
    while (at < dataEnd) {
      const header = out[at++] as number;
      if ((header & 0x80) !== 0) {
        // Message de données à horodatage compressé : type local sur les bits 5-6.
        const def = defs.get((header >> 5) & 0x3);
        if (!def) throw new ParseError('FIT : message sans définition');
        if (at + def.size > dataEnd) throw new ParseError('FIT tronqué');
        patchData(out, at, def);
        at += def.size;
        continue;
      }
      const local = header & 0x0f;
      if ((header & 0x40) !== 0) {
        // Définition : réservé, architecture, numéro global, champs, champs de développeur.
        if (at + 5 > dataEnd) throw new ParseError('FIT tronqué');
        const little = out[at + 1] === 0;
        const globalNum = view.getUint16(at + 2, little);
        const count = out[at + 4] as number;
        at += 5;
        const fields: FieldDef[] = [];
        let offset = 0;
        if (at + count * 3 > dataEnd) throw new ParseError('FIT tronqué');
        for (let i = 0; i < count; i++) {
          const size = out[at + 1] as number;
          fields.push({ num: out[at] as number, size, offset });
          offset += size;
          at += 3;
        }
        if ((header & 0x20) !== 0) {
          if (at >= dataEnd) throw new ParseError('FIT tronqué');
          const devCount = out[at++] as number;
          if (at + devCount * 3 > dataEnd) throw new ParseError('FIT tronqué');
          for (let i = 0; i < devCount; i++) {
            offset += out[at + 1] as number;
            at += 3;
          }
        }
        defs.set(local, { globalNum, fields, size: offset });
      } else {
        const def = defs.get(local);
        if (!def) throw new ParseError('FIT : message sans définition');
        if (at + def.size > dataEnd) throw new ParseError('FIT tronqué');
        patchData(out, at, def);
        at += def.size;
      }
    }
    if (at !== dataEnd) throw new ParseError('FIT : taille de données incohérente');

    // CRC du fichier (en-tête compris), écrit en petit-boutiste dans les deux derniers octets.
    const crc = fitCrc(out, pos, dataEnd);
    out[dataEnd] = crc & 0xff;
    out[dataEnd + 1] = (crc >> 8) & 0xff;
    pos = end;
  }

  function patchData(buf: Uint8Array, start: number, def: Definition): void {
    const fields = SPORT_FIELDS[def.globalNum];
    if (!fields) return;
    const sportField = def.fields.find((f) => f.num === fields[0]);
    if (!sportField || sportField.size !== 1) return;
    buf[start + sportField.offset] = value;
    const sub = def.fields.find((f) => f.num === fields[1]);
    if (sub?.size === 1) buf[start + sub.offset] = 0;
    if (def.globalNum === MESG_SESSION) patchedSessions++;
  }

  if (patchedSessions === 0) throw new ParseError('FIT : aucune session à reclasser');
  return out;
}
