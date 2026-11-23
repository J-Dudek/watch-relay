import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { I18n } from './i18n';
import { ProcessingService } from './processing.service';
import { AnalyzeStep } from './steps/analyze-step';
import { DropStep } from './steps/drop-step';
import { GuideStep } from './steps/guide-step';
import { ImportStep } from './steps/import-step';

@Component({
  selector: 'app-root',
  imports: [GuideStep, DropStep, AnalyzeStep, ImportStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="header-top">
        <h1>{{ t().title }}</h1>
        <button
          type="button"
          class="btn btn-small"
          [attr.lang]="i18n.locale() === 'fr' ? 'en' : 'fr'"
          [attr.aria-label]="t().languageSwitchLabel"
          (click)="i18n.toggle()"
        >
          {{ t().languageSwitch }}
        </button>
      </div>
      <p class="muted">{{ t().tagline }}</p>
    </header>

    <nav [attr.aria-label]="t().stepsLabel">
      <ol class="stepper">
        @for (label of t().steps; track label; let i = $index) {
          <li
            [class.current]="i === step()"
            [class.done]="i < step()"
            [attr.aria-current]="i === step() ? 'step' : null"
          >
            <span class="stepper-num">{{ i + 1 }}</span>
            <span class="stepper-label">{{ label }}</span>
          </li>
        }
      </ol>
    </nav>

    <main id="main" class="card" tabindex="-1">
      @switch (step()) {
        @case (0) {
          <app-guide-step (next)="go(1)" />
        }
        @case (1) {
          <app-drop-step (back)="go(0)" (started)="go(2)" />
        }
        @case (2) {
          <app-analyze-step (next)="go(3)" (restart)="restart()" />
        }
        @case (3) {
          <app-import-step (back)="go(2)" (restart)="restart()" />
        }
      }
    </main>

    <footer class="footer">
      <p>{{ t().footer }}</p>
    </footer>
  `,
})
export class App {
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  protected readonly step = signal(0);
  private readonly processing = inject(ProcessingService);

  constructor() {
    this.i18n.applyToDocument();
    // Retour automatique à l'étape de dépôt si l'analyse est réinitialisée.
    effect(() => {
      if (this.processing.status() === 'idle' && this.step() >= 2) this.step.set(1);
    });
  }

  protected go(step: number): void {
    this.step.set(step);
    queueMicrotask(() => document.getElementById('main')?.focus());
  }

  protected restart(): void {
    this.processing.reset();
    this.go(1);
  }
}
