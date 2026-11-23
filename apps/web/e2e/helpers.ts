import type { Page } from '@playwright/test';
import { blobBytes, makeFit, makeZip } from '../../../packages/engine/test/fixtures';

const day = (d: number): Date => new Date(Date.UTC(2022, 0, d, 8));

/** Export Garmin synthétique : 2 activités valides, 1 doublon, 1 sport non supporté, 1 JSON. */
export async function buildExport(): Promise<Buffer> {
  const fit = (sport: string, d: number): Uint8Array =>
    makeFit({ sport, start: day(d), minSize: 40_000 });
  const inner = await makeZip([
    ['run1.fit', fit('running', 1)],
    ['run1-copy.fit', fit('running', 1)],
    ['golf.fit', fit('golf', 4)],
    ['wellness.json', '{}'],
  ]);
  const outer = await makeZip([
    ['DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_0.zip', await blobBytes(inner)],
    ['bike.fit', fit('cycling', 3)],
  ]);
  return Buffer.from(await blobBytes(outer));
}

/** Collecte les violations CSP / Trusted Types vues par la page et par ses workers. */
export function watchViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (/Content Security Policy|Trusted ?Type|TrustedScript|violates the following/i.test(text)) {
      violations.push(`console: ${text}`);
    }
  });
  page.on('pageerror', (err) => {
    if (/Trusted ?Type|Content Security Policy/i.test(err.message))
      violations.push(`pageerror: ${err.message}`);
  });
  void page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`Content Security Policy violation: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return violations;
}
