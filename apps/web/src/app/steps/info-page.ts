import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18n } from '../i18n';
import type { Section } from '../pages-content';

export type InfoPageId = 'faq' | 'privacy' | 'legal';

@Component({
  selector: 'app-info-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>{{ title() }}</h2>
    @if (page() === 'faq') {
      @for (item of t().pages.faq.items; track item.q) {
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
    <div class="actions">
      <a class="btn" href="#/">{{ t().pages.nav.backToTool }}</a>
    </div>
  `,
})
export class InfoPage {
  readonly page = input.required<InfoPageId>();
  protected readonly t = inject(I18n).t;
  protected readonly title = computed(() => this.t().pages[this.page()].title);
  protected readonly sections = computed<readonly Section[]>(() => {
    const p = this.page();
    return p === 'faq' ? [] : this.t().pages[p].sections;
  });
}
