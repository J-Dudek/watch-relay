import { TestBed } from '@angular/core/testing';
import { I18n } from './i18n';
import { Router } from './router';
import { App } from './app';

/** Le rendu suppose les textes chargés (en production : initialiseur d'application). */
async function setup() {
  await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  await TestBed.inject(I18n).init();
  return TestBed.createComponent(App);
}

describe('App', () => {
  beforeEach(() => {
    localStorage.setItem('watch-relay.lang', 'fr');
  });

  it('bascule en anglais et revient', async () => {
    const fixture = await setup();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const select = el.querySelector<HTMLSelectElement>('.language-select');
    if (select) {
      select.value = 'en';
      select.dispatchEvent(new Event('change'));
    }
    // Le changement de langue charge le chunk de textes : on attend qu'il soit affiché.
    for (let i = 0; i < 100 && !el.textContent.includes('Get your Garmin export'); i++) {
      await new Promise((r) => setTimeout(r, 20));
      await fixture.whenStable();
    }
    expect(el.querySelector('h2')?.textContent).toContain('Get your Garmin export');
    expect(el.textContent).toContain('not affiliated with Garmin, COROS or Polar');
  });

  it('affiche le parcours en 4 étapes et démarre sur le guide Garmin', async () => {
    const fixture = await setup();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.j6n-stepper li')).toHaveLength(4);
    expect(el.querySelector('h2')?.textContent).toContain('Récupérer ton export Garmin');
    expect(el.querySelector('[aria-current="step"]')?.textContent).toContain('Export Garmin');
  });

  it('mentionne la non-affiliation', async () => {
    const fixture = await setup();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'non affilié à Garmin, COROS ni Polar',
    );
  });

  it('affiche la FAQ (chunk chargé à la demande) via le hash et revient à l’outil', async () => {
    const fixture = await setup();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const until = async (check: () => boolean): Promise<void> => {
      for (let i = 0; i < 100 && !check(); i++) {
        await new Promise((r) => setTimeout(r, 20));
        await fixture.whenStable();
      }
    };
    try {
      TestBed.inject(Router).navigate('faq');
      await until(
        () => el.querySelector('h2')?.textContent.includes('Questions fréquentes') === true,
      );
      expect(el.querySelector('h2')?.textContent).toContain('Questions fréquentes');
    } finally {
      TestBed.inject(Router).navigate('home');
    }
    await until(() => el.querySelector('h2')?.textContent.includes('Récupérer') === true);
    expect(el.querySelector('h2')?.textContent).toContain('Récupérer ton export Garmin');
  });

  it('propose les deux sens de transfert, Garmin → COROS par défaut', async () => {
    const fixture = await setup();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const from = el.querySelector<HTMLSelectElement>('#platform-from');
    const to = el.querySelector<HTMLSelectElement>('#platform-to');
    expect([from?.value, to?.value]).toEqual(['garmin', 'coros']);
    if (from) {
      from.value = 'coros';
      from.dispatchEvent(new Event('change'));
    }
    await fixture.whenStable();
    expect(to?.value).toBe('garmin');
    expect(el.querySelector('h1')?.textContent).toContain('COROS → Garmin');
    expect(el.querySelector('h2')?.textContent).toContain('export COROS');
  });
});
