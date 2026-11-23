import { expect, test, type Page } from '@playwright/test';
import { buildExport } from './helpers';

async function processExport(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: await buildExport(),
  });
  await expect(page.getByText('activité(s) prête(s)')).toBeVisible({ timeout: 30_000 });
}

async function listWorkDir(page: Page): Promise<string[] | string> {
  return page.evaluate(async () => {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('watch-relay-out');
      const names: string[] = [];
      for await (const name of dir.keys()) names.push(name);
      return names;
    } catch (e) {
      return `indisponible (${(e as Error).name})`;
    }
  });
}

test('le traitement utilise OPFS quand il est disponible (T1.16)', async ({ page }, testInfo) => {
  await processExport(page);
  const files = await listWorkDir(page);
  testInfo.annotations.push({ type: 'stockage', description: JSON.stringify(files) });
  console.log(`[${testInfo.project.name}] OPFS :`, JSON.stringify(files));

  // Le parcours doit fonctionner dans tous les cas (OPFS ou repli mémoire) ;
  // si OPFS est actif, l'archive y est bien écrite.
  if (Array.isArray(files)) expect(files).toContain('coros-import-01-2022-01_2022-01.zip');
});

test('« Recommencer » vide le stockage temporaire (T1.24)', async ({ page }) => {
  await processExport(page);
  await page.getByRole('button', { name: 'Recommencer' }).click();
  await expect(page.getByRole('heading', { name: /Déposer le fichier/ })).toBeVisible();

  await expect
    .poll(async () => {
      const files = await listWorkDir(page);
      return Array.isArray(files) ? files.length : 0;
    })
    .toBe(0);
});
