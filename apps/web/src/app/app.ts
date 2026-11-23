import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { I18n } from './i18n';
import { ProcessingService } from './processing.service';
import { AnalyzeStep } from './steps/analyze-step';
import { DropStep } from './steps/drop-step';
import { InfoPage, type InfoPageId } from './steps/info-page';
import { GuideStep } from './steps/guide-step';
import { ImportStep } from './steps/import-step';

function routeFromHash(hash: string): 'home' | InfoPageId {
  const id = hash.replace(/^#\/?/, '');
  return id === 'faq' || id === 'privacy' || id === 'legal' ? id : 'home';
}

@Component({
  selector: 'app-root',
  imports: [GuideStep, DropStep, AnalyzeStep, ImportStep, InfoPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="header-top">
        <h1>{{ flow().title }}</h1>
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

    @if (infoPage(); as info) {
      <main id="main" class="card" tabindex="-1">
        <app-info-page [page]="info" />
      </main>
    } @else {
      <nav [attr.aria-label]="t().stepsLabel">
        <ol class="stepper">
          @for (label of flow().steps; track label; let i = $index) {
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
    }

    <footer class="footer">
      <nav [attr.aria-label]="t().pages.nav.label" class="footer-nav">
        <a href="#/faq">{{ t().pages.nav.faq }}</a>
        <a href="#/privacy">{{ t().pages.nav.privacy }}</a>
        <a href="#/legal">{{ t().pages.nav.legal }}</a>
      </nav>
      <p>{{ t().footer }}</p>
    </footer>
  `,
})
export class App {
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  protected readonly flow = this.i18n.flow;
  private readonly injector = inject(Injector);
  protected readonly step = signal(0);
  protected readonly route = signal<'home' | InfoPageId>(routeFromHash(location.hash));
  protected readonly infoPage = computed(() => {
    const r = this.route();
    return r === 'home' ? null : r;
  });
  private readonly processing = inject(ProcessingService);

  constructor() {
    this.i18n.applyToDocument();
    // Navigation par hash : l'état du traitement vit dans ProcessingService et survit au changement de page.
    addEventListener('hashchange', () => {
      this.route.set(routeFromHash(location.hash));
      scrollTo(0, 0);
      // Le <main> est recréé par le changement de page : on attend le prochain rendu.
      afterNextRender(() => document.getElementById('main')?.focus(), { injector: this.injector });
    });
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
