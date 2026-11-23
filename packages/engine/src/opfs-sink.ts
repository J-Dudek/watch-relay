import type { ArchiveSink } from './sink.js';

/** Sous-ensemble structurel de l'API OPFS (testable sans navigateur). */
export interface SyncAccessHandleLike {
  write(buffer: Uint8Array, options?: { at: number }): number;
  truncate(size: number): void;
  flush(): void;
  close(): void;
}
export interface FileHandleLike {
  createSyncAccessHandle(): Promise<SyncAccessHandleLike>;
  getFile(): Promise<File>;
}
export interface DirectoryLike {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
  removeEntry(name: string): Promise<void>;
  keys(): AsyncIterable<string>;
}

/**
 * Écriture en flux vers OPFS via `createSyncAccessHandle`, disponible dans les workers
 * de tous les navigateurs (Safari compris, contrairement à `createWritable`).
 */
export function createOpfsSink(dir: DirectoryLike): ArchiveSink {
  return {
    async open(name) {
      const file = await dir.getFileHandle(name, { create: true });
      const handle = await file.createSyncAccessHandle();
      handle.truncate(0); // jamais d'octets résiduels d'une session précédente
      let position = 0;
      let open = true;
      const closeHandle = (): void => {
        if (!open) return;
        open = false;
        handle.close();
      };
      return {
        writable: new WritableStream<Uint8Array>({
          write(chunk) {
            let offset = 0;
            while (offset < chunk.byteLength) {
              const n = handle.write(chunk.subarray(offset), { at: position });
              if (n <= 0) throw new Error('Écriture OPFS impossible (espace disque ?)');
              offset += n;
              position += n;
            }
          },
        }),
        async close() {
          handle.flush();
          closeHandle();
          return file.getFile();
        },
        async discard() {
          closeHandle();
          await dir.removeEntry(name).catch(() => undefined);
        },
      };
    },
  };
}

/** Vide le répertoire de travail (démarrage, annulation, après téléchargement : T1.24). */
export async function clearDirectory(dir: DirectoryLike): Promise<void> {
  const names: string[] = [];
  for await (const name of dir.keys()) names.push(name);
  await Promise.all(names.map((n) => dir.removeEntry(n).catch(() => undefined)));
}
