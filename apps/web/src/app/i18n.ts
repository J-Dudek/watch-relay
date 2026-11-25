import { Injectable, computed, inject, signal } from '@angular/core';
import { PLATFORM_NAMES, ProcessingService } from './processing.service';
import { withRetry } from './retry';
import type { FlowMessages, Messages } from './messages/fr';

export type { FlowMessages, Messages };
export type Locale = 'fr' | 'en';
export const LOCALES: readonly Locale[] = ['fr', 'en'];
const STORAGE_KEY = 'watch-relay.lang';

/** Une seule langue est chargée : l'autre reste un chunk à part, précaché pour le hors ligne. */
const LOADERS: Record<Locale, () => Promise<Messages>> = {
  fr: () => import('./messages/fr').then((m) => m.MESSAGES_FR),
  en: () => import('./messages/en').then((m) => m.MESSAGES_EN),
};

/** FR par défaut ; EN si la première langue du navigateur est l'anglais. */
export function detectLocale(languages: readonly string[]): Locale {
  const first = languages[0]?.toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'fr';
}

function readStored(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'fr' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class I18n {
  /** Langue dont les textes sont actuellement affichés. */
  readonly locale = signal<Locale>(readStored() ?? detectLocale(navigator.languages));
  private readonly messages = signal<Messages | undefined>(undefined);
  readonly t = computed<Messages>(() => {
    const m = this.messages();
    if (!m) throw new Error('Textes non chargés : I18n.init() doit précéder le rendu.');
    return m;
  });
  private readonly processing = inject(ProcessingService);
  /** Textes du couple source → destination courant (Garmin → COROS par défaut). */
  readonly flow = computed<FlowMessages>(() => {
    const t = this.t();
    const source = this.processing.source();
    const target = this.processing.target();
    const from = PLATFORM_NAMES[source];
    const to = PLATFORM_NAMES[target];
    const origin =
      source === 'garmin'
        ? { guide: t.guide, drop: t.drop }
        : source === 'coros'
          ? { guide: t.reverse.guide, drop: t.reverse.drop }
          : source === 'strava'
            ? { guide: t.strava.guide, drop: { ...t.drop, ...t.strava.drop } }
            : { guide: t.polar.guide, drop: { ...t.drop, ...t.polar.drop } };
    const destination =
      target === 'coros'
        ? { import: t.import, reject: t.reject }
        : { import: t.reverse.import, reject: t.reverse.reject };
    return {
      title: t.titleFor(from, to),
      steps: [t.stepExport(from), ...t.stepMiddle, t.stepImport(to)],
      ...origin,
      ...destination,
    };
  });

  /** Charge la langue initiale ; exécuté avant le premier rendu (initialiseur d'application). */
  async init(): Promise<void> {
    this.messages.set(await withRetry(LOADERS[this.locale()]));
    this.applyToDocument();
  }

  /** Change de langue : l'ancienne reste affichée jusqu'à ce que la nouvelle soit chargée. */
  async set(locale: Locale): Promise<void> {
    const messages = await withRetry(LOADERS[locale]);
    this.messages.set(messages);
    this.locale.set(locale);
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
    this.applyToDocument();
  }

  toggle(): Promise<void> {
    return this.set(this.locale() === 'fr' ? 'en' : 'fr');
  }

  /** Met à jour <html lang>, le titre et la description. */
  applyToDocument(): void {
    const t = this.t();
    document.documentElement.lang = this.locale();
    document.title = t.htmlTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.htmlDescription);
  }
}
