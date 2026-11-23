/** Destination d'une archive en cours d'écriture. */
export interface ArchiveTarget {
  readonly writable: WritableStream<Uint8Array>;
  /** Termine l'écriture et renvoie le contenu. */
  close(): Promise<Blob>;
  /** Supprime tout ce qui a été écrit (annulation, erreur). */
  discard(): Promise<void>;
}

/** Fabrique de destinations. OPFS côté navigateur (T1.16), mémoire en repli et en test. */
export interface ArchiveSink {
  open(name: string): Promise<ArchiveTarget>;
}

export function createMemorySink(): ArchiveSink {
  return {
    open() {
      let chunks: Uint8Array<ArrayBuffer>[] = [];
      return Promise.resolve({
        writable: new WritableStream<Uint8Array>({
          write(chunk) {
            chunks.push(new Uint8Array(chunk));
          },
        }),
        close: () => Promise.resolve(new Blob(chunks, { type: 'application/zip' })),
        discard() {
          chunks = [];
          return Promise.resolve();
        },
      });
    },
  };
}
