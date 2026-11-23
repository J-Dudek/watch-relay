import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { I18n } from '../i18n';
import { withRetry } from '../retry';
import type { PagesMessages, Section } from '../pages-types';

export type InfoPageId = 'faq' | 'privacy' | 'legal';

/**
 * Le contenu (FAQ, confidentialité, mentions légales) est un chunk par langue, chargé à la première
 * consultation : il n'alourdit pas le chargement initial. Précaché par le service worker.
 */
const LOADERS: Record<'fr' | 'en', () => Promise<PagesMessages>> = {
  fr: () => import('../pages-fr').then((m) => m.PAGES_FR),
  en: () => import('../pages-en').then((m) => m.PAGES_EN),
};

@Component({
  selector: 'app-info-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (content(); as c) {
      <h2>{{ title() }}</h2>
      @if (page() === 'faq') {
        <div class="j6n-accordion">
          @for (item of c.faq.items; track item.q) {
            <details class="j6n-accordion__item">
              <summary class="j6n-accordion__trigger">{{ item.q }}</summary>
              <div class="j6n-accordion__panel">
                @for (para of item.a; track para) {
                  <p>{{ para }}</p>
                }
              </div>
            </details>
          }
        </div>
      } @else {
        @for (section of sections(); track section.h) {
          <h3>{{ section.h }}</h3>
          @for (para of section.p; track para) {
            <p>{{ para }}</p>
          }
        }
      }
    } @else {
      <p role="status" class="j6n-muted">{{ t().loading }}</p>
    }
    <div class="actions">
      <a class="j6n-btn j6n-btn--secondary" href="#/">{{ t().pagesNav.backToTool }}</a>
    </div>
  `,
})
export class InfoPage {
  readonly page = input.required<InfoPageId>();
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  private readonly loaded = signal<{ pages: PagesMessages } | null>(null);

  protected readonly content = computed<PagesMessages | null>(() => {
    return this.loaded()?.pages ?? null; // l'ancienne langue reste affichée pendant le chargement
  });
  protected readonly title = computed(() => this.content()?.[this.page()].title ?? '');
  protected readonly sections = computed<readonly Section[]>(() => {
    const p = this.page();
    return p === 'faq' ? [] : (this.content()?.[p].sections ?? []);
  });

  constructor() {
    // Recharge quand la langue change (la précédente reste affichée le temps du chargement).
    effect(() => {
      const locale = this.i18n.locale();
      void withRetry(LOADERS[locale]).then((pages) => {
        this.loaded.set({ pages });
      });
    });
  }
}
