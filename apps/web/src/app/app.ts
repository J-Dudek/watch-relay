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
import { THEME_MODES, applyTheme, readTheme, storeTheme, type ThemeMode } from './theme';
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
    <a class="j6n-skiplink" href="#main" (click)="skipToContent($event)">{{ t().skipLink }}</a>
    <header class="header">
      <div class="header-top">
        <img class="logo" src="icons/logo-256.png" width="64" height="64" [alt]="t().logoAlt" />
        <h1>{{ flow().title }}</h1>
      </div>
      <p class="j6n-muted">{{ t().tagline }}</p>
      <div class="header-tools">
        <div class="j6n-segmented" role="radiogroup" [attr.aria-label]="t().theme.label">
          @for (m of themeModes; track m) {
            <input
              type="radio"
              name="theme"
              [id]="'theme-' + m"
              [value]="m"
              [checked]="theme() === m"
              (change)="setTheme(m)"
            />
            <label [for]="'theme-' + m">{{ t().theme[m] }}</label>
          }
        </div>
        <button
          type="button"
          class="j6n-btn j6n-btn--secondary"
          [attr.lang]="i18n.locale() === 'fr' ? 'en' : 'fr'"
          [attr.aria-label]="t().languageSwitchLabel"
          (click)="toggle()"
        >
          {{ t().languageSwitch }}
        </button>
      </div>
    </header>

    @if (infoPage(); as info) {
      <main id="main" class="j6n-card" tabindex="-1">
        <app-info-page [page]="info" />
      </main>
    } @else {
      <nav [attr.aria-label]="t().stepsLabel">
        <ol class="j6n-stepper">
          @for (label of flow().steps; track label; let i = $index) {
            <li
              class="j6n-stepper__step"
              [class.is-current]="i === step()"
              [class.is-done]="i < step()"
              [attr.aria-current]="i === step() ? 'step' : null"
            >
              <span class="j6n-stepper__num">{{ i + 1 }}</span>
              <span class="j6n-stepper__label"
                >{{ label }}
                <span class="j6n-sr-only">{{
                  i < step()
                    ? t().stepState.done
                    : i === step()
                      ? t().stepState.current
                      : t().stepState.todo
                }}</span></span
              >
            </li>
          }
        </ol>
      </nav>

      <main id="main" class="j6n-card" tabindex="-1">
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

    <footer class="j6n-footer j6n-mt-6 j6n-py-5 app-footer">
      <nav [attr.aria-label]="t().pagesNav.label" class="footer-nav">
        <a href="#/faq">{{ t().pagesNav.faq }}</a>
        <a href="#/privacy">{{ t().pagesNav.privacy }}</a>
        <a href="#/legal">{{ t().pagesNav.legal }}</a>
      </nav>
      <p>{{ t().footer }}</p>
      <p class="signature">
        {{ t().signature.before }}
        <a [href]="t().signature.href" target="_blank" rel="noopener">{{ t().signature.name }}</a>
        ·
        {{ t().design.before }}
        <a [href]="t().design.href" target="_blank" rel="noopener">{{ t().design.name }}</a>
      </p>
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

  protected readonly themeModes = THEME_MODES;
  protected readonly theme = signal<ThemeMode>(readTheme());

  protected setTheme(mode: ThemeMode): void {
    this.theme.set(mode);
    applyTheme(mode);
    storeTheme(mode);
  }

  /** Le lien d'évitement ne passe pas par `#main` : le hash sert à la navigation de l'app. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    document.getElementById('main')?.focus();
  }

  protected toggle(): void {
    void this.i18n.toggle();
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
