import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { I18n } from '../i18n';
import {
  PLATFORM_NAMES,
  ProcessingService,
  validTargets,
  type Platform,
} from '../processing.service';

@Component({
  selector: 'app-guide-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = flow().guide;
    <div class="direction" role="group" [attr.aria-label]="t().direction.label">
      <div class="platform-field">
        <label for="platform-from">{{ t().direction.from }}</label>
        <select id="platform-from" class="j6n-select" (change)="setSource($event)">
          @for (p of platforms; track p) {
            <option [value]="p" [selected]="source() === p">{{ names[p] }}</option>
          }
        </select>
      </div>
      <div class="platform-field">
        <label for="platform-to">{{ t().direction.to }}</label>
        <select id="platform-to" class="j6n-select" (change)="setTarget($event)">
          @for (p of platforms; track p) {
            <option [value]="p" [selected]="target() === p" [disabled]="!canTarget(p)">
              {{ names[p] }}{{ isSourceOnly(p) ? ' (' + t().direction.unavailable + ')' : '' }}
            </option>
          }
        </select>
      </div>
    </div>
    <p class="note">{{ t().direction.polarNote }}</p>
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
  private readonly processing = inject(ProcessingService);
  protected readonly source = this.processing.source;
  protected readonly target = this.processing.target;
  protected readonly names = PLATFORM_NAMES;
  protected readonly platforms: readonly Platform[] = ['garmin', 'coros', 'polar', 'strava'];

  /** Polar et Strava n'importent pas d'historique : sources seulement. */
  protected isSourceOnly(p: Platform): boolean {
    return p === 'polar' || p === 'strava';
  }

  protected canTarget(p: Platform): boolean {
    return (validTargets(this.source()) as Platform[]).includes(p);
  }

  protected setSource(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as Platform;
    this.source.set(value);
    // La destination courante peut devenir invalide (même plateforme, Polar ou Strava) : on prend la première valide.
    const targets = validTargets(value);
    if (!targets.includes(this.target())) this.target.set(targets[0] ?? 'coros');
  }

  protected setTarget(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as Platform;
    if (this.canTarget(value) && (value === 'coros' || value === 'garmin')) this.target.set(value);
  }
  readonly next = output();
}
