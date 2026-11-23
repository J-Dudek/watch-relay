import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { REJECT_MESSAGES, formatBytes } from '../format';
import { ProcessingService } from '../processing.service';
import type { RejectReason } from '@watch-relay/engine';

@Component({
  selector: 'app-analyze-step',
  imports: [KeyValuePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>3. Analyse</h2>

    @switch (processing.status()) {
      @case ('running') {
        <p>
          Analyse de <strong>{{ processing.fileName() }}</strong>…
        </p>
        <progress
          class="bar"
          max="100"
          [value]="processing.percent()"
          aria-label="Progression"
        ></progress>
        @if (processing.progress(); as p) {
          <p role="status" aria-live="polite">
            {{ p.processed }} fichier(s) {{ p.phase === 'analyze' ? 'analysé(s)' : 'écrit(s)' }} ·
            {{ bytes(p.bytesRead) }} lus
          </p>
        }
        <p class="note">
          Garde cet onglet ouvert. Tu peux couper ton wifi : tout se passe sur ton appareil.
        </p>
        <div class="actions">
          <button type="button" class="btn" (click)="processing.cancel()">Annuler</button>
        </div>
      }
      @case ('error') {
        @if (processing.failure(); as f) {
          <p class="alert alert-error" role="alert">{{ errorText(f.code, f.message) }}</p>
        }
        <div class="actions">
          <button type="button" class="btn btn-primary" (click)="restart.emit()">
            Recommencer
          </button>
        </div>
      }
      @case ('done') {
        @if (report(); as r) {
          <p class="summary">
            <strong>{{ r.kept }}</strong> activité(s) prête(s) ·
            <strong>{{ rejectedTotal() }}</strong> écartée(s) ·
            <strong>{{ r.ignored.length }}</strong> fichier(s) ignoré(s)
          </p>

          @if (r.kept === 0) {
            <p class="alert alert-warn" role="alert">
              Aucune activité importable n’a été trouvée. Vérifie que tu as déposé l’export Garmin
              complet.
            </p>
          }

          @for (entry of reasons(); track entry.reason) {
            <details class="detail">
              <summary>{{ entry.title }} ({{ entry.count }})</summary>
              <p>{{ entry.hint }}</p>
            </details>
          }

          @if (r.kept > 0) {
            <details class="detail">
              <summary>Répartition par sport et par année</summary>
              <div class="cols">
                <ul>
                  @for (s of r.bySport | keyvalue; track s.key) {
                    <li>{{ s.key }} : {{ s.value }}</li>
                  }
                </ul>
                <ul>
                  @for (y of r.byYear | keyvalue; track y.key) {
                    <li>{{ y.key }} : {{ y.value }}</li>
                  }
                </ul>
              </div>
            </details>
          }
        }
        <div class="actions">
          <button type="button" class="btn" (click)="restart.emit()">Recommencer</button>
          @if ((report()?.kept ?? 0) > 0) {
            <button type="button" class="btn btn-primary" (click)="next.emit()">Continuer</button>
          }
        </div>
      }
    }
  `,
})
export class AnalyzeStep {
  protected readonly processing = inject(ProcessingService);
  readonly next = output();
  readonly restart = output();
  protected readonly report = this.processing.report;
  protected readonly bytes = formatBytes;

  protected readonly rejectedTotal = computed(() =>
    Object.values(this.report()?.rejectedByReason ?? {}).reduce((a, b) => a + b, 0),
  );

  protected readonly reasons = computed(() =>
    (Object.entries(this.report()?.rejectedByReason ?? {}) as [RejectReason, number][]).map(
      ([reason, count]) => ({ reason, count, ...REJECT_MESSAGES[reason] }),
    ),
  );

  protected errorText(code: string, message: string): string {
    switch (code) {
      case 'ABORTED':
        return 'Analyse annulée. Aucun fichier n’a été conservé.';
      case 'INPUT_TOO_LARGE':
        return 'Ce fichier est trop volumineux pour être traité ici.';
      case 'TOTAL_TOO_LARGE':
      case 'TOO_MANY_ENTRIES':
      case 'TOO_DEEP':
        return 'Cette archive dépasse les limites de sécurité (taille, nombre de fichiers ou imbrication). Elle n’a pas été traitée.';
      default:
        return message;
    }
  }
}
