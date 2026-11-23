import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { reportToCsv, type ArchiveInfo } from '@watch-relay/engine';
import { download, formatBytes, isMobileDevice } from '../format';
import { ProcessingService } from '../processing.service';

@Component({
  selector: 'app-import-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>4. Importer dans COROS</h2>

    @if (mobile) {
      <p class="alert alert-warn" role="note">
        Tu peux préparer les fichiers ici, mais
        <strong>l’import COROS se fait depuis un ordinateur</strong>.
        @if (canShare()) {
          Envoie les ZIP vers Fichiers ou Drive pour les récupérer ensuite sur ton ordinateur.
        }
      </p>
    }

    <h3>Tes fichiers</h3>
    <ul class="files">
      @for (a of archives(); track a.name) {
        <li class="file">
          <div>
            <strong>{{ a.name }}</strong><br />
            <span class="muted">{{ a.fileCount }} activité(s) · {{ size(a.size) }}</span>
          </div>
          <div class="file-actions">
            <button type="button" class="btn btn-primary" (click)="save(a)">Télécharger</button>
            @if (mobile && canShare()) {
              <button type="button" class="btn" (click)="share(a)">Envoyer vers…</button>
            }
            <label class="check">
              <input type="checkbox" [checked]="isDone(a.name)" (change)="toggle(a.name)" />
              Importé
            </label>
          </div>
        </li>
      }
    </ul>

    <div class="actions">
      @if (!mobile && archives().length > 1) {
        <button type="button" class="btn" (click)="saveAll()">Tout télécharger</button>
      }
      <button type="button" class="btn" (click)="saveCsv()">Rapport (CSV)</button>
    </div>

    <h3>Importer dans COROS Training Hub</h3>
    <ol class="steps">
      <li>
        Depuis un ordinateur, ouvre
        <a href="https://t.coros.com" target="_blank" rel="noopener noreferrer">t.coros.com</a> et
        connecte-toi.
      </li>
      <li>Va dans <strong>Activity List</strong>, puis <strong>Import Data</strong>.</li>
      <li>
        Sélectionne un ZIP, lance l’import et attends la confirmation. Fais-le
        <strong>un ZIP à la fois</strong>.
      </li>
      <li>Coche « Importé » ci-dessus pour suivre ta progression.</li>
    </ol>
    <p class="muted">{{ doneCount() }} / {{ archives().length }} archive(s) importée(s)</p>

    <div class="actions">
      <button type="button" class="btn" (click)="back.emit()">Retour</button>
      <button type="button" class="btn" (click)="restart.emit()">Terminer</button>
    </div>
  `,
})
export class ImportStep {
  private readonly processing = inject(ProcessingService);
  readonly back = output();
  readonly restart = output();
  protected readonly archives = this.processing.archives;
  protected readonly mobile = isMobileDevice();
  protected readonly size = formatBytes;
  private readonly done = signal<ReadonlySet<string>>(new Set());
  protected readonly doneCount = computed(() => this.done().size);
  protected readonly canShare = signal(
    typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [new File([], 'x.zip', { type: 'application/zip' })] }),
  );

  protected isDone(name: string): boolean {
    return this.done().has(name);
  }

  protected toggle(name: string): void {
    const next = new Set(this.done());
    if (!next.delete(name)) next.add(name);
    this.done.set(next);
  }

  protected save(a: ArchiveInfo): void {
    download(a.blob, a.name);
  }

  /** Téléchargements espacés : les navigateurs bloquent les rafales. */
  protected async saveAll(): Promise<void> {
    for (const a of this.archives()) {
      download(a.blob, a.name);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  protected async share(a: ArchiveInfo): Promise<void> {
    const file = new File([a.blob], a.name, { type: 'application/zip' });
    try {
      await navigator.share({ files: [file] });
    } catch {
      /* partage annulé */
    }
  }

  protected saveCsv(): void {
    const report = this.processing.report();
    if (report)
      download(
        new Blob([reportToCsv(report)], { type: 'text/csv;charset=utf-8' }),
        'rapport-import.csv',
      );
  }
}
