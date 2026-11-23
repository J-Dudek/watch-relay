import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { MAX_INPUT_BYTES, ProcessingService } from '../processing.service';
import { formatBytes } from '../format';

@Component({
  selector: 'app-drop-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>2. Déposer le fichier</h2>
    <p>Le fichier reste sur ton appareil : rien n’est envoyé sur Internet.</p>

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
      <span class="drop-title">Choisir le fichier ZIP Garmin</span>
      <span class="drop-sub">ou le glisser-déposer ici</span>
    </label>

    @if (error(); as message) {
      <p class="alert alert-error" role="alert">{{ message }}</p>
    }

    <div class="actions">
      <button type="button" class="btn" (click)="back.emit()">Retour</button>
    </div>
  `,
})
export class DropStep {
  private readonly processing = inject(ProcessingService);
  readonly back = output();
  readonly started = output();
  protected readonly over = signal(false);
  protected readonly error = signal<string | null>(null);

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
      this.error.set(
        'Ce fichier n’est pas un ZIP. Choisis l’archive reçue de Garmin, sans la décompresser.',
      );
    } else if (file.size > MAX_INPUT_BYTES) {
      this.error.set(
        `Ce fichier est trop volumineux (${formatBytes(file.size)}). La limite est de ${formatBytes(MAX_INPUT_BYTES)}.`,
      );
    } else {
      this.error.set(null);
      this.processing.start(file);
      this.started.emit();
    }
  }
}
