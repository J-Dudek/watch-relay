import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(() => {
    localStorage.setItem('watch-relay.lang', 'fr');
  });

  it('bascule en anglais et revient', async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.header-top button')?.click();
    await fixture.whenStable();
    expect(el.querySelector('h2')?.textContent).toContain('Get your Garmin export');
    expect(el.textContent).toContain('not affiliated with Garmin or COROS');
  });

  it('affiche le parcours en 4 étapes et démarre sur le guide Garmin', async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.stepper li')).toHaveLength(4);
    expect(el.querySelector('h2')?.textContent).toContain('Récupérer ton export Garmin');
    expect(el.querySelector('[aria-current="step"]')?.textContent).toContain('Export Garmin');
  });

  it('mentionne la non-affiliation', async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'non affilié à Garmin ni à COROS',
    );
  });

  it('affiche la FAQ (chunk chargé à la demande) via le hash et revient à l’outil', async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const until = async (check: () => boolean): Promise<void> => {
      for (let i = 0; i < 100 && !check(); i++) {
        await new Promise((r) => setTimeout(r, 20));
        await fixture.whenStable();
      }
    };
    try {
      location.hash = '#/faq';
      await until(
        () => el.querySelector('h2')?.textContent.includes('Questions fréquentes') === true,
      );
      expect(el.querySelector('h2')?.textContent).toContain('Questions fréquentes');
    } finally {
      location.hash = '#/';
    }
    await until(() => el.querySelector('h2')?.textContent.includes('Récupérer') === true);
    expect(el.querySelector('h2')?.textContent).toContain('Récupérer ton export Garmin');
  });

  it('propose les deux sens de transfert, Garmin → COROS par défaut', async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.direction button')];
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    buttons[1]?.click();
    await fixture.whenStable();
    expect(el.querySelector('h1')?.textContent).toContain('COROS → Garmin');
    expect(el.querySelector('h2')?.textContent).toContain('export COROS');
  });
});
