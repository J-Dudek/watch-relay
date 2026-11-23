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
import { I18n } from '../i18n';
import { ProcessingService } from '../processing.service';

@Component({
  selector: 'app-import-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let i = flow().import;
    <h2>{{ i.title }}</h2>

    @if (mobile) {
      <p class="j6n-alert j6n-alert--warning" role="note">
        {{ i.mobileBefore }} <strong>{{ i.mobileStrong }}</strong>.
        @if (canShare()) {
          {{ i.mobileShare }}
        }
      </p>
    }

    <h3>{{ i.yourFiles }}</h3>
    <ul class="files">
      @for (a of archives(); track a.name) {
        <li class="file">
          <div>
            <strong>{{ a.name }}</strong><br />
            <span class="j6n-muted">{{ i.activities(a.fileCount) }} · {{ size(a.size) }}</span>
          </div>
          <div class="file-actions">
            <button type="button" class="j6n-btn" (click)="save(a)">
              {{ i.download }}
            </button>
            @if (mobile && canShare()) {
              <button type="button" class="j6n-btn j6n-btn--secondary" (click)="share(a)">
                {{ i.shareTo }}
              </button>
            }
            <label class="check">
              <input type="checkbox" [checked]="isDone(a.name)" (change)="toggle(a.name)" />
              {{ i.imported }}
            </label>
          </div>
        </li>
      }
    </ul>

    <div class="actions">
      @if (!mobile && archives().length > 1) {
        <button type="button" class="j6n-btn j6n-btn--secondary" (click)="saveAll()">
          {{ i.downloadAll }}
        </button>
      }
      <button type="button" class="j6n-btn j6n-btn--secondary" (click)="saveCsv()">
        {{ i.csv }}
      </button>
    </div>

    <h3>{{ i.howTo }}</h3>
    <ol class="steps">
      <li>
        {{ i.h1Before }}
        <a [href]="i.h1Href" target="_blank" rel="noopener noreferrer">{{ i.h1Link }}</a>
        {{ i.h1After }}
      </li>
      <li>
        {{ i.h2Before }} <strong>Activity List</strong>{{ i.h2Mid }} <strong>Import Data</strong>.
      </li>
      <li>
        {{ i.h3Before }} <strong>{{ i.h3Strong }}</strong>.
      </li>
      <li>{{ i.h4 }}</li>
    </ol>
    <p class="j6n-muted">{{ i.progress(doneCount(), archives().length) }}</p>

    <div class="actions">
      <button type="button" class="j6n-btn j6n-btn--secondary" (click)="back.emit()">
        {{ t().back }}
      </button>
      <button type="button" class="j6n-btn j6n-btn--secondary" (click)="restart.emit()">
        {{ i.finish }}
      </button>
    </div>
  `,
})
export class ImportStep {
  private readonly processing = inject(ProcessingService);
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  protected readonly flow = this.i18n.flow;
  readonly back = output();
  readonly restart = output();
  protected readonly archives = this.processing.archives;
  protected readonly mobile = isMobileDevice();
  protected readonly size = (n: number): string => formatBytes(n, this.t());
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
        this.flow().import.csvFileName,
      );
  }
}
