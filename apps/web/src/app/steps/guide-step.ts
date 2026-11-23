import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { I18n } from '../i18n';

@Component({
  selector: 'app-guide-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = t().guide;
    <h2>{{ g.title }}</h2>
    <ol class="steps">
      <li>
        {{ g.s1Before }}
        <a
          href="https://www.garmin.com/account/datamanagement/"
          target="_blank"
          rel="noopener noreferrer"
          >{{ g.s1Link }}</a
        >
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
      <button type="button" class="btn btn-primary" (click)="next.emit()">
        {{ g.haveFile }}
      </button>
    </div>
  `,
})
export class GuideStep {
  protected readonly t = inject(I18n).t;
  readonly next = output();
}
