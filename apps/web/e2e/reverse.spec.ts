import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { buildExport } from './helpers';

// Sens COROS → Garmin : destination Garmin, règles et consignes propres à Garmin.
test('COROS → Garmin : parcours complet avec les règles Garmin', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'COROS → Garmin' }).click();
  await expect(page.getByRole('heading', { name: 'Migration COROS → Garmin' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Récupérer ton export COROS/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'COROS Training Hub' })).toHaveAttribute(
    'href',
    'https://t.coros.com',
  );

  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await expect(page.getByText('Choisir le fichier ZIP COROS')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({
    name: 'coros-export.zip',
    mimeType: 'application/zip',
    buffer: await buildExport(),
  });

  // Garmin : pas de liste de sports (le golf reste), un doublon est écarté → 3 activités.
  await expect(page.locator('.summary')).toContainText('3', { timeout: 30_000 });
  await expect(page.getByText('Sports non pris en charge')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(
    page.getByRole('heading', { name: '4. Importer dans Garmin Connect' }),
  ).toBeVisible();
  await expect(page.getByText(/garmin-import-01-2022-01_2022-01\.zip/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'connect.garmin.com' })).toHaveAttribute(
    'href',
    'https://connect.garmin.com',
  );
  await expect(page.getByText(/Garmin n’accepte pas les ZIP/)).toBeVisible();
});

test('le sens par défaut reste Garmin → COROS', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Garmin → COROS' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'COROS → Garmin' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('le sens suit la langue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'COROS → Garmin' }).click();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('heading', { name: 'COROS → Garmin migration' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Get your COROS export/ })).toBeVisible();
});

async function audit(page: Page, tags: string[]): Promise<string[]> {
  // Laisse finir les transitions (boutons) : axe mesurerait sinon des couleurs intermédiaires.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
      new Promise((resolve) => setTimeout(resolve, 500)), // animations infinies : on n'attend pas
    ]),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  return violations.map(
    (v) =>
      `${v.id}: ${v.nodes
        .map((n) => `${n.target.join(' ')} → ${n.any.map((a) => a.message).join(' / ')}`)
        .join(' | ')}`,
  );
}

test('COROS → Garmin : 0 violation d’accessibilité (guide et import)', async ({ page }) => {
  // Sans animation : axe mesurerait sinon des couleurs intermédiaires pendant les transitions des boutons.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
  await page.goto('/');
  await page.getByRole('button', { name: 'COROS → Garmin' }).click();
  expect(await audit(page, tags)).toEqual([]);

  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'coros-export.zip',
    mimeType: 'application/zip',
    buffer: await buildExport(),
  });
  await expect(page.locator('.summary')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(
    page.getByRole('heading', { name: '4. Importer dans Garmin Connect' }),
  ).toBeVisible();
  expect(await audit(page, tags)).toEqual([]);
});
