import { formatBytes } from './format';
import { I18n } from './i18n';
import { TestBed } from '@angular/core/testing';

const FR = { units: ['o', 'Ko', 'Mo', 'Go'], numberLocale: 'fr-FR' };
const EN = { units: ['B', 'KB', 'MB', 'GB'], numberLocale: 'en-US' };

describe('formatBytes', () => {
  it('formate les tailles', () => {
    expect(formatBytes(0, FR)).toBe('0 o');
    expect(formatBytes(1536, FR)).toContain('1,5');
    expect(formatBytes(1536, FR)).toContain('Ko');
    expect(formatBytes(5 * 1024 ** 3, FR)).toContain('Go');
  });

  it('suit la langue', () => {
    expect(formatBytes(1536, EN)).toBe('1.5 KB');
    expect(formatBytes(1536, FR)).toBe('1,5 Ko');
  });
});

describe('I18n', () => {
  it('détecte la langue : FR par défaut, EN si le navigateur est en anglais', async () => {
    const { detectLocale } = await import('./i18n');
    expect(detectLocale(['fr-FR', 'en'])).toBe('fr');
    expect(detectLocale(['en-GB'])).toBe('en');
    expect(detectLocale(['de-DE'])).toBe('fr');
    expect(detectLocale([])).toBe('fr');
  });

  it('chaque motif de rejet a un titre et une action dans les deux langues', async () => {
    const i18n = TestBed.inject(I18n);
    for (const locale of ['fr', 'en'] as const) {
      await i18n.set(locale);
      for (const reason of [
        'TOO_SMALL',
        'TOO_LARGE',
        'UNSUPPORTED_SPORT',
        'DUPLICATE',
        'CORRUPTED',
        'OUT_OF_RANGE',
      ] as const) {
        expect(i18n.t().reject[reason].title.length).toBeGreaterThan(0);
        expect(i18n.t().reject[reason].hint.length).toBeGreaterThan(0);
      }
    }
  });

  it('met à jour <html lang> et le titre', async () => {
    const i18n = TestBed.inject(I18n);
    await i18n.set('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toContain('watch-relay');
    await i18n.set('fr');
    expect(document.documentElement.lang).toBe('fr');
  });
});
