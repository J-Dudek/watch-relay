import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { formatBytes } from '../format';
import { I18n } from '../i18n';
import { ProcessingService } from '../processing.service';
import type { RejectReason } from '@watch-relay/engine';

@Component({
  selector: 'app-analyze-step',
  imports: [KeyValuePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = t().analyze;
    <h2>{{ a.title }}</h2>

    @switch (processing.status()) {
      @case ('running') {
        <p>
          {{ a.analyzing }} <strong>{{ processing.fileName() }}</strong>…
        </p>
        <progress
          class="bar"
          max="100"
          [value]="processing.percent()"
          [attr.aria-label]="a.progress"
        ></progress>
        @if (processing.progress(); as p) {
          <p role="status" aria-live="polite">
            {{ a.processed(p.processed, p.phase, bytes(p.bytesRead)) }}
          </p>
        }
        <p class="note">{{ a.keepOpen }}</p>
        <div class="actions">
          <button type="button" class="btn" (click)="processing.cancel()">{{ a.cancel }}</button>
        </div>
      }
      @case ('error') {
        @if (processing.failure(); as f) {
          <p class="alert alert-error" role="alert">{{ errorText(f.code) }}</p>
        }
        <div class="actions">
          <button type="button" class="btn btn-primary" (click)="restart.emit()">
            {{ t().restart }}
          </button>
        </div>
      }
      @case ('done') {
        @if (report(); as r) {
          <p class="summary">
            <strong>{{ r.kept }}</strong> {{ a.ready }} · <strong>{{ rejectedTotal() }}</strong>
            {{ a.rejected }} · <strong>{{ r.ignored.length }}</strong> {{ a.ignored }}
          </p>

          @if (r.kept === 0) {
            <p class="alert alert-warn" role="alert">
              {{ a.nothing }}
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
              <summary>{{ a.breakdown }}</summary>
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
          <button type="button" class="btn" (click)="restart.emit()">{{ t().restart }}</button>
          @if ((report()?.kept ?? 0) > 0) {
            <button type="button" class="btn btn-primary" (click)="next.emit()">
              {{ a.continue }}
            </button>
          }
        </div>
      }
    }
  `,
})
export class AnalyzeStep {
  protected readonly processing = inject(ProcessingService);
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  readonly next = output();
  readonly restart = output();
  protected readonly report = this.processing.report;
  protected readonly bytes = (n: number): string => formatBytes(n, this.t());

  protected readonly rejectedTotal = computed(() =>
    Object.values(this.report()?.rejectedByReason ?? {}).reduce((a, b) => a + b, 0),
  );

  protected readonly reasons = computed(() =>
    (Object.entries(this.report()?.rejectedByReason ?? {}) as [RejectReason, number][]).map(
      ([reason, count]) => ({ reason, count, ...this.i18n.flow().reject[reason] }),
    ),
  );

  protected errorText(code: string): string {
    const e = this.t().errors;
    switch (code) {
      case 'ABORTED':
        return e.ABORTED;
      case 'INPUT_TOO_LARGE':
        return e.INPUT_TOO_LARGE;
      case 'INVALID_ARCHIVE':
        return e.INVALID_ARCHIVE;
      case 'TOTAL_TOO_LARGE':
      case 'TOO_MANY_ENTRIES':
      case 'TOO_DEEP':
        return e.LIMITS;
      default:
        return e.UNKNOWN;
    }
  }
}
