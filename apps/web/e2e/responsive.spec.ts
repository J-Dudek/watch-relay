import { expect, test } from '@playwright/test';
import { openScreen, SCREENS } from './screens';

// T3.18–T3.20 : pas de défilement horizontal, cibles tactiles ≥ 44 px, de 320 px à un grand écran.
// Le viewport est piloté par le test : un seul projet suffit.
test.skip(
  ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
  'viewports pilotés par le test',
);

const VIEWPORTS = [
  { name: '320', width: 320, height: 640 },
  { name: '375', width: 375, height: 667 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
];

const TARGETS =
  'button, select, summary, a.j6n-btn, .footer-nav a, label.check, label.drop, .j6n-segmented label, .j6n-skiplink';

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const screen of SCREENS) {
      test(`${screen} : pas de défilement horizontal et cibles ≥ 44 px`, async ({ page }) => {
        await openScreen(page, screen);
        // Laisse finir les transitions avant de mesurer.
        await page.evaluate(() =>
          Promise.race([
            Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
            new Promise((resolve) => setTimeout(resolve, 500)),
          ]),
        );
        await page.evaluate(() => {
          document.querySelectorAll('details').forEach((d) => {
            d.open = true;
          });
        });

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, 'défilement horizontal de la page').toBeLessThanOrEqual(0);

        const tooSmall = await page.evaluate((selector) => {
          return [...document.querySelectorAll<HTMLElement>(selector)]
            .map((el) => ({ el, r: el.getBoundingClientRect() }))
            .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44))
            .map(
              ({ el, r }) =>
                `${el.tagName.toLowerCase()} « ${el.textContent.trim().slice(0, 30)} » ${String(Math.round(r.width))}×${String(Math.round(r.height))}`,
            );
        }, TARGETS);
        expect(tooSmall, 'cibles tactiles trop petites').toEqual([]);

        // Aucun élément ne dépasse de la fenêtre à droite.
        const overflowing = await page.evaluate(() => {
          const w = document.documentElement.clientWidth;
          return [...document.querySelectorAll<HTMLElement>('main *, header *, footer *')]
            .filter(
              (el) =>
                el.getBoundingClientRect().right > w + 1 &&
                getComputedStyle(el).position !== 'absolute',
            )
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
        });
        expect(overflowing, 'éléments hors de la fenêtre').toEqual([]);
      });
    }
  });
}
