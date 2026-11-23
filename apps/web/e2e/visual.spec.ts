import { expect, test } from '@playwright/test';
import { openScreen, SCREENS } from './screens';

// T4.13 : régression visuelle sur 3 tailles d'écran. Références générées sous Linux/Chromium
// (`npm run e2e:update -w @watch-relay/web`) ; seule cette combinaison est comparée, car le rendu
// du texte varie selon le système.
test.skip(
  ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
  'références Chromium bureau',
);

const SIZES = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablette', width: 768, height: 1024 },
  { name: 'bureau', width: 1280, height: 800 },
];

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height }, colorScheme: 'light' });

    for (const screen of SCREENS) {
      test(screen, async ({ page }) => {
        await openScreen(page, screen);
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`${screen}-${size.name}.png`, {
          fullPage: true,
          animations: 'disabled',
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  });
}

test.describe('thème sombre (mobile)', () => {
  test.use({ viewport: { width: 375, height: 667 }, colorScheme: 'dark' });
  for (const screen of ['guide', 'analyze'] as const) {
    test(screen, async ({ page }) => {
      await openScreen(page, screen);
      await expect(page).toHaveScreenshot(`${screen}-mobile-sombre.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
