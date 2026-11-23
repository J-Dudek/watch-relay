import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { MAX_INPUT_BYTES, ProcessingService } from '../processing.service';
import { formatBytes } from '../format';
import { I18n } from '../i18n';

@Component({
  selector: 'app-drop-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let d = flow().drop;
    <h2>{{ d.title }}</h2>
    <p>{{ d.intro }}</p>

    @if (target() === 'coros') {
      <label class="check health-option">
        <input
          type="checkbox"
          [checked]="processing.healthExport()"
          (change)="processing.healthExport.set(!processing.healthExport())"
        />
        {{ d.healthOption }}
      </label>
      <p class="note">{{ d.healthHint }}</p>
    }

    <label
      class="drop"
      [class.drop-over]="over()"
      (dragover)="onDragOver($event)"
      (dragleave)="over.set(false)"
      (drop)="onDrop($event)"
    >
      <input
        class="visually-hidden"
        type="file"
        accept=".zip,application/zip"
        (change)="onPick($event)"
      />
      <span class="drop-title">{{ d.choose }}</span>
      <span class="drop-sub">{{ d.orDrag }}</span>
    </label>

    @if (errorText(); as message) {
      <p class="j6n-alert j6n-alert--danger" role="alert">{{ message }}</p>
    }

    <div class="actions">
      <button type="button" class="j6n-btn j6n-btn--secondary" (click)="back.emit()">
        {{ t().back }}
      </button>
    </div>
  `,
})
export class DropStep {
  protected readonly processing = inject(ProcessingService);
  protected readonly target = this.processing.target;
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  protected readonly flow = this.i18n.flow;
  readonly back = output();
  readonly started = output();
  protected readonly over = signal(false);
  private readonly error = signal<{ kind: 'notZip' } | { kind: 'tooLarge'; size: number } | null>(
    null,
  );
  protected readonly errorText = computed(() => {
    const e = this.error();
    const t = this.t();
    if (!e) return null;
    return e.kind === 'notZip'
      ? this.flow().drop.notZip
      : t.drop.tooLarge(formatBytes(e.size, t), formatBytes(MAX_INPUT_BYTES, t));
  });

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.over.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.accept(file);
  }

  protected onPick(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.accept(file);
  }

  private accept(file: File): void {
    if (!/\.zip$/i.test(file.name)) {
      this.error.set({ kind: 'notZip' });
    } else if (file.size > MAX_INPUT_BYTES) {
      this.error.set({ kind: 'tooLarge', size: file.size });
    } else {
      this.error.set(null);
      this.processing.start(file);
      this.started.emit();
    }
  }
}
