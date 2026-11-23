import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { I18n } from '../i18n';
import { ProcessingService } from '../processing.service';

@Component({
  selector: 'app-guide-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = flow().guide;
    <div class="direction" role="group" [attr.aria-label]="t().direction.label">
      <button
        type="button"
        class="j6n-btn j6n-btn--secondary"
        [attr.aria-pressed]="target() === 'coros'"
        (click)="target.set('coros')"
      >
        {{ t().direction.toCoros }}
      </button>
      <button
        type="button"
        class="j6n-btn j6n-btn--secondary"
        [attr.aria-pressed]="target() === 'garmin'"
        (click)="target.set('garmin')"
      >
        {{ t().direction.toGarmin }}
      </button>
    </div>
    <h2>{{ g.title }}</h2>
    <ol class="steps">
      <li>
        {{ g.s1Before }}
        <a [href]="g.s1Href" target="_blank" rel="noopener noreferrer">{{ g.s1Link }}</a>
        {{ g.s1After }}
      </li>
      <li>
        {{ g.s2Before }} <strong>{{ g.s2Strong }}</strong>.
      </li>
      <li>
        {{ g.s3Before }} <strong>{{ g.s3Strong }}</strong>.
      </li>
      <li>{{ g.s4Before }} <code>.zip</code> {{ g.s4After }}</li>
    </ol>
    <p class="note">
      {{ g.noteBefore }} <strong>{{ g.noteStrong }}</strong>{{ g.noteAfter }}
    </p>
    <div class="actions">
      <button type="button" class="j6n-btn" (click)="next.emit()">
        {{ g.haveFile }}
      </button>
    </div>
  `,
})
export class GuideStep {
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  protected readonly flow = this.i18n.flow;
  protected readonly target = inject(ProcessingService).target;
  readonly next = output();
}
