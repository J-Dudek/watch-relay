import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { I18n } from '../i18n';
import type { PagesMessages, Section } from '../pages-content';

export type InfoPageId = 'faq' | 'privacy' | 'legal';

/**
 * Le contenu (FAQ, confidentialité, mentions légales) est un chunk séparé, chargé à la première
 * consultation : il n'alourdit pas le chargement initial. Il est précaché par le service worker,
 * donc disponible hors ligne.
 */
let contentModule: Promise<typeof import('../pages-content')> | undefined;
const loadContent = (): Promise<typeof import('../pages-content')> =>
  (contentModule ??= import('../pages-content'));

@Component({
  selector: 'app-info-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (content(); as c) {
      <h2>{{ title() }}</h2>
      @if (page() === 'faq') {
        @for (item of c.faq.items; track item.q) {
          <details class="detail">
            <summary>{{ item.q }}</summary>
            @for (para of item.a; track para) {
              <p>{{ para }}</p>
            }
          </details>
        }
      } @else {
        @for (section of sections(); track section.h) {
          <h3>{{ section.h }}</h3>
          @for (para of section.p; track para) {
            <p>{{ para }}</p>
          }
        }
      }
    } @else {
      <p role="status" class="muted">{{ t().loading }}</p>
    }
    <div class="actions">
      <a class="btn" href="#/">{{ t().pagesNav.backToTool }}</a>
    </div>
  `,
})
export class InfoPage {
  readonly page = input.required<InfoPageId>();
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  private readonly loaded = signal<typeof import('../pages-content') | null>(null);

  protected readonly content = computed<PagesMessages | null>(() => {
    const m = this.loaded();
    return m ? (this.i18n.locale() === 'fr' ? m.PAGES_FR : m.PAGES_EN) : null;
  });
  protected readonly title = computed(() => this.content()?.[this.page()].title ?? '');
  protected readonly sections = computed<readonly Section[]>(() => {
    const p = this.page();
    return p === 'faq' ? [] : (this.content()?.[p].sections ?? []);
  });

  constructor() {
    void loadContent().then((m) => {
      this.loaded.set(m);
    });
  }
}
