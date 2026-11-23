import { expect, test, type Page } from '@playwright/test';
import { buildExport } from './helpers';

// T3.21 : navigation complète au clavier, focus visible, ordre logique, aucun piège.

interface Stop {
  name: string;
  visible: boolean;
}

/** Élément ayant le focus, son nom, et s'il porte un indicateur de focus visible (WCAG 2.4.7). */
async function currentStop(page: Page): Promise<Stop> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { name: '(body)', visible: false };
    // Champs masqués visuellement : l'indicateur est porté par la zone (fichier) ou l'étiquette
    // voisine (boutons radio du sélecteur de thème).
    let target: HTMLElement = el;
    if (el.matches('input[type=file]')) target = el.closest('label') ?? el;
    else if (el.matches('input[type=checkbox]')) target = el.closest('label') ?? el;
    else if (el.matches('input[type=radio]'))
      target = el.nextElementSibling instanceof HTMLElement ? el.nextElementSibling : el;
    const s = getComputedStyle(target);
    // design-j6n : anneau en box-shadow (contour transparent pour le mode contraste élevé).
    const outline =
      (s.outlineStyle !== 'none' &&
        parseFloat(s.outlineWidth) >= 2 &&
        s.outlineColor !== 'rgba(0, 0, 0, 0)') ||
      s.boxShadow !== 'none';
    const name =
      el.getAttribute('aria-label') ??
      (el.textContent.trim() || el.getAttribute('type') || el.tagName.toLowerCase());
    return { name: name.replace(/\s+/g, ' ').slice(0, 60), visible: outline };
  });
}

/** Parcourt toute la page avec Tab ; échoue s'il y a un piège (le focus ne progresse plus). */
async function tabThrough(page: Page, max = 40): Promise<Stop[]> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  const stops: Stop[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const stop = await currentStop(page);
    if (stop.name === '(body)') break; // le focus est sorti vers l'interface du navigateur
    if (stops.length > 0 && stops.at(-1)?.name === stop.name && stops.length > 3) {
      // même élément deux fois de suite
      throw new Error(`Piège clavier sur « ${stop.name} »`);
    }
    stops.push(stop);
  }
  return stops;
}

test('guide : ordre logique et focus toujours visible', async ({ page }) => {
  await page.goto('/');
  const stops = await tabThrough(page);
  const names = stops.map((s) => s.name);
  expect(names[0]).toBe('Aller au contenu'); // lien d'évitement en premier
  expect(names).toContain('Langue');
  expect(names).toContain('Gestion des données de ton compte Garmin');
  expect(names.indexOf('J’ai mon fichier')).toBeGreaterThan(
    names.indexOf('Gestion des données de ton compte Garmin'),
  );
  // Les liens du pied de page viennent après le contenu.
  expect(names.indexOf('FAQ')).toBeGreaterThan(names.indexOf('J’ai mon fichier'));
  expect(names.slice(-5)).toEqual([
    'FAQ',
    'Confidentialité',
    'Mentions légales',
    'J6N',
    'design-j6n',
  ]);
  for (const s of stops) expect(s.visible, `focus invisible sur « ${s.name} »`).toBe(true);
});

test('parcours complet au clavier, du guide à l’import', async ({ page }) => {
  await page.goto('/');

  // Étape 1 → 2 : Entrée sur « J’ai mon fichier ».
  await page.getByRole('button', { name: 'J’ai mon fichier' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Déposer le fichier/ })).toBeVisible();
  // Le focus est replacé sur la zone principale (pas perdu sur un bouton disparu).
  await expect(page.locator('#main')).toBeFocused();

  // Étape 2 : l'option santé (case à cocher) puis le champ fichier. Safari ne place pas les cases à
  // cocher dans l'ordre de tabulation par défaut : on accepte qu'elle soit sautée, jamais le contraire.
  const stop = await (async () => {
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      const current = await currentStop(page);
      expect(current.visible, `focus invisible sur « ${current.name} »`).toBe(true);
      if (current.name === 'file') return current;
      expect(current.name).toBe('checkbox');
    }
    throw new Error('le champ fichier n’est pas atteint au clavier');
  })();
  expect(stop.name).toBe('file');
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Space');
  await (
    await chooser
  ).setFiles({
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: await buildExport(),
  });

  // Étape 3 : résultat, puis « Continuer » au clavier.
  await expect(page.locator('.summary')).toBeVisible({ timeout: 30_000 });
  const summaries = page.locator('details summary');
  await summaries.first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details').first()).toHaveJSProperty('open', true);
  await page.keyboard.press('Space');
  await expect(page.locator('details').first()).toHaveJSProperty('open', false);

  await page.getByRole('button', { name: 'Continuer' }).focus();
  await page.keyboard.press('Enter');

  // Étape 4 : coche « Importé » avec Espace, bouton Terminer avec Entrée.
  await expect(page.getByRole('heading', { name: '4. Importer dans COROS' })).toBeVisible();
  const check = page.getByRole('checkbox', { name: 'Importé' }).first();
  await check.focus();
  await page.keyboard.press('Space');
  await expect(check).toBeChecked();
  await expect(page.getByText('1 / 1 archive(s) importée(s)')).toBeVisible();
  await page.getByRole('button', { name: 'Terminer' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Déposer le fichier/ })).toBeVisible();
});

test('pages d’information : liens du pied de page au clavier et retour', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'FAQ' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Questions fréquentes' })).toBeVisible();
  await expect(page.locator('#main')).toBeFocused();

  // Chaque question se déplie au clavier.
  const first = page.locator('details summary').first();
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details').first()).toHaveJSProperty('open', true);

  const stops = await tabThrough(page);
  for (const s of stops) expect(s.visible, `focus invisible sur « ${s.name} »`).toBe(true);

  await page.getByRole('link', { name: /Retour à l’outil/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Récupérer ton export Garmin/ })).toBeVisible();
});

test('le sélecteur de langue s’utilise au clavier', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Langue' }).focus();
  await page.keyboard.press('ArrowDown'); // sélection au clavier : Français → English
  await expect(page.getByRole('heading', { name: /Get your Garmin export/ })).toBeVisible();
});

test('le skiplink amène au contenu sans changer de page', async ({ page }) => {
  await page.goto('/faq');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Questions fréquentes' })).toBeVisible();
});

test('le thème se choisit, se mémorise et revient en automatique', async ({ page }) => {
  await page.goto('/');
  await page.locator('label[for=theme-dark]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('label[for=theme-auto]').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
});
