import { createWriteStream, openAsBlob } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import type { ArchiveSink } from '@watch-relay/engine';

/** Écrit les archives dans un dossier (créé au besoin), en flux : jamais en mémoire. */
export function createFileSink(dir: string): ArchiveSink {
  const root = resolve(dir);
  return {
    async open(name) {
      await mkdir(root, { recursive: true });
      const path = join(root, name);
      const stream = createWriteStream(path);
      return {
        writable: Writable.toWeb(stream) as WritableStream<Uint8Array>,
        close: () => openAsBlob(path, { type: 'application/zip' }),
        discard: () => rm(path, { force: true }),
      };
    },
  };
}
