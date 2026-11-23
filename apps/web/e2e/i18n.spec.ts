import { expect, test } from '@playwright/test';

test.describe('langue anglaise du navigateur', () => {
  test.use({ locale: 'en-GB' });

  test('l’app démarre en anglais et <html lang> suit (T3.14)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Get your Garmin export/ })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle(/Garmin to COROS/);
  });
});

test.describe('langue allemande du navigateur', () => {
  test.use({ locale: 'de-DE' });

  test('repli sur le français', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Récupérer ton export Garmin/ })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });
});

test('le sélecteur change la langue et la mémorise', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('heading', { name: /Get your Garmin export/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.getByRole('heading', { name: /Get your Garmin export/ })).toBeVisible();
  await page.getByRole('button', { name: 'Passer en français' }).click();
  await expect(page.getByRole('heading', { name: /Récupérer ton export Garmin/ })).toBeVisible();
});
