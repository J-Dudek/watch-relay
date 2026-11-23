import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { buildExport } from './helpers';

// T4.12 / T3.23 : 0 violation WCAG 2.2 AA sur chaque écran, dans les deux langues et les deux thèmes.
// Le viewport vient du projet Playwright (desktop, Pixel 7, iPhone 15).
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function audit(page: Page, screen: string): Promise<void> {
  // Ouvre tous les <details> pour auditer aussi leur contenu.
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => {
      d.open = true;
    });
  });
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact ?? '?'}) : ${v.help}\n` +
      v.nodes.map((n) => `    ${n.target.join(' ')}\n    ${n.failureSummary ?? ''}`).join('\n'),
  );
  expect(summary, `Violations axe sur « ${screen} »`).toEqual([]);
}

async function upload(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.getByRole('button', { name: /J’ai mon fichier|I have my file/ }).click();
  await page.locator('input[type=file]').setInputFiles(file);
}

const SCHEMES = ['light', 'dark'] as const;
const LANGS = [
  { lang: 'fr', locale: 'fr-FR' },
  { lang: 'en', locale: 'en-GB' },
] as const;

for (const scheme of SCHEMES) {
  for (const { lang, locale } of LANGS) {
    test.describe(`${lang} / ${scheme}`, () => {
      test.use({ locale, colorScheme: scheme });

      test('guide et dépôt', async ({ page }) => {
        await page.goto('/');
        await audit(page, 'guide');
        await page.getByRole('button', { name: /J’ai mon fichier|I have my file/ }).click();
        await audit(page, 'dépôt');
        await page.locator('input[type=file]').setInputFiles({
          name: 'notes.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('x'),
        });
        await expect(page.getByRole('alert')).toBeVisible();
        await audit(page, 'dépôt avec erreur');
      });

      test('analyse et import', async ({ page }) => {
        await page.goto('/');
        await upload(page, {
          name: 'export.zip',
          mimeType: 'application/zip',
          buffer: await buildExport(),
        });
        await expect(page.locator('.summary')).toBeVisible({ timeout: 30_000 });
        await audit(page, 'analyse terminée');
        await page.getByRole('button', { name: /Continuer|Continue/ }).click();
        await audit(page, 'import');
      });

      test('analyse en erreur', async ({ page }) => {
        await page.goto('/');
        await upload(page, {
          name: 'broken.zip',
          mimeType: 'application/zip',
          buffer: Buffer.from('ceci n’est pas un zip'),
        });
        await expect(page.locator('.summary, .alert-error')).toBeVisible({ timeout: 30_000 });
        await audit(page, 'analyse en erreur ou vide');
      });

      for (const id of ['faq', 'privacy', 'legal']) {
        test(`page ${id}`, async ({ page }) => {
          await page.goto(`/#/${id}`);
          await expect(page.locator('main h2')).toBeVisible();
          await audit(page, id);
        });
      }
    });
  }
}
