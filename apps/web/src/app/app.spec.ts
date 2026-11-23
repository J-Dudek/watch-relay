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
});
