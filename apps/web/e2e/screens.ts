import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { buildExport } from './helpers';

/** Les écrans de l'app, atteints par l'interface, pour les tests responsive et visuels. */
export const SCREENS = ['guide', 'drop', 'analyze', 'import', 'faq', 'legal'] as const;
export type Screen = (typeof SCREENS)[number];

export async function openScreen(page: Page, screen: Screen): Promise<void> {
  if (screen === 'faq' || screen === 'legal') {
    await page.goto(`/${screen}`);
    await expect(page.locator('main h2')).toBeVisible();
    return;
  }
  await page.goto('/');
  if (screen === 'guide') return;
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  if (screen === 'drop') return;
  await page.locator('input[type=file]').setInputFiles({
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: await buildExport(),
  });
  await expect(page.locator('.summary')).toBeVisible({ timeout: 30_000 });
  if (screen === 'analyze') return;
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { name: '4. Importer dans COROS' })).toBeVisible();
}
