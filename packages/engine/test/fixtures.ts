import { Encoder, Profile } from '@garmin/fitsdk';
import type { Mesg } from '@garmin/fitsdk';
import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js';

const mesgNum = (name: string): number => Profile.MesgNum[name] as number;

export interface FitOptions {
  sport?: string;
  start?: Date;
  /** Taille minimale en octets (ajoute des messages RECORD) : COROS rejette < 20 Ko. */
  minSize?: number;
}

/** FIT synthétique valide, généré avec l'encodeur officiel. */
export function makeFit({
  sport = 'running',
  start = new Date(Date.UTC(2023, 4, 14, 7, 32, 10)),
  minSize = 0,
}: FitOptions = {}): Uint8Array {
  const enc = new Encoder();
  enc.onMesg(mesgNum('FILE_ID'), <Mesg>{
    type: 'activity',
    manufacturer: 'development',
    product: 1,
    timeCreated: start,
    serialNumber: 1234,
  });
  for (let i = 0; i * 16 < minSize; i++) {
    enc.onMesg(mesgNum('RECORD'), <Mesg>{
      timestamp: new Date(start.getTime() + i * 1000),
      heartRate: 100 + (i % 60),
      distance: i * 3,
    });
  }
  enc.onMesg(mesgNum('SESSION'), <Mesg>{
    timestamp: new Date(start.getTime() + 3_600_000),
    startTime: start,
    totalElapsedTime: 3600,
    totalDistance: 10_000,
    sport,
    subSport: 'generic',
  });
  return enc.close();
}

export type ZipItem = [name: string, content: Uint8Array | string];

export async function makeZip(items: ZipItem[]): Promise<Blob> {
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  for (const [name, content] of items) {
    await writer.add(
      name,
      typeof content === 'string' ? new TextReader(content) : new Uint8ArrayReader(content),
    );
  }
  return writer.close();
}

export async function blobBytes(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await b.arrayBuffer());
}

/** ZIP dont une entrée porte un nom hostile (zip.js refuse d'écrire `../`, on patche les octets). */
export async function makeZipWithRawName(hostile: string, content: Uint8Array): Promise<Blob> {
  const placeholder = 'x'.repeat(hostile.length);
  const bytes = await blobBytes(await makeZip([[placeholder, content]]));
  const needle = new TextEncoder().encode(placeholder);
  const repl = new TextEncoder().encode(hostile);
  for (let i = 0; i + needle.length <= bytes.length; i++) {
    if (needle.every((b, j) => bytes[i + j] === b)) bytes.set(repl, i);
  }
  return new Blob([bytes as Uint8Array<ArrayBuffer>]);
}

/** FIT valide sans session, d'un type donné (ex. `monitoringDaily`, `settings`) : pas une activité. */
export function makeFitOfType(type: string | number): Uint8Array {
  const enc = new Encoder();
  enc.onMesg(mesgNum('FILE_ID'), <Mesg>{
    type,
    manufacturer: 'development',
    product: 1,
    timeCreated: new Date(Date.UTC(2023, 4, 14)),
    serialNumber: 1234,
  });
  return enc.close();
}
