/**
 * Visual check: the guid assistant selection list shows German (de-DE) builtin
 * assistant names/descriptions via the client-side de override layer.
 *
 * Screenshot: /tmp/workflow-shots/06-assistants-de.png
 */
import fs from 'fs';
import { test, expect } from '../../fixtures';
import { resetGuidLastSelectedAgent } from '../../helpers/navigation';

const SHOTS_DIR = '/tmp/workflow-shots';

async function ensureRendererReady(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => window.location.href !== 'about:blank' && typeof (window as unknown as { __backendPort?: number }).__backendPort === 'number', { timeout: 30_000 });
}

test.beforeAll(() => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
});

test('guid assistant list renders German builtin names', async ({ page }) => {
  await ensureRendererReady(page);
  const port = await page.evaluate(() => (window as unknown as { __backendPort?: number }).__backendPort);
  console.log(`[PROBE] backend port: ${port}`);

  // Report the active UI language (i18n locale) so we know the override applies.
  const lang = await page.evaluate(() => ({
    htmlLang: document.documentElement.lang,
    i18nLang: (window as unknown as { i18next?: { language?: string } }).i18next?.language ?? 'n/a',
    ls: (() => {
      try {
        return localStorage.getItem('i18nextLng') || localStorage.getItem('language') || 'n/a';
      } catch {
        return 'n/a';
      }
    })(),
  }));
  console.log('[PROBE] language:', JSON.stringify(lang));

  // Force the guid assistant-list view (clear persisted last-selected agent).
  await resetGuidLastSelectedAgent(page).catch((e) => console.log('[PROBE] reset failed:', String(e)));

  // Navigate to guid and reload so the list view renders fresh.
  await page.evaluate(() => window.location.assign('#/guid'));
  await page.reload();
  await ensureRendererReady(page);
  await page.waitForFunction(() => window.location.hash === '#/guid', { timeout: 10_000 }).catch(() => {});

  // Wait for at least one preset assistant pill to render.
  const pills = page.locator('[data-testid^="preset-pill-"]');
  await expect(pills.first()).toBeVisible({ timeout: 20_000 });
  const count = await pills.count();
  console.log(`[PROBE] preset pills rendered: ${count}`);

  // Dump the visible card names so we have textual proof of language.
  const names = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="preset-pill-"]')).map((el) => el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80)));
  console.log('[PROBE] card texts:', JSON.stringify(names));

  await page.screenshot({ path: `${SHOTS_DIR}/06-assistants-de.png` });

  // Assert specific German names are present (text-level, not just screenshot).
  const bodyText = await page.evaluate(() => document.body.textContent ?? '');
  const expectGerman = ['LokkyWork Butler', 'Excel-Ersteller', 'Finanzmodell-Ersteller', 'HUMAN 3.0 Coach'];
  const present = expectGerman.filter((n) => bodyText.includes(n));
  const oldEnglish = ['AionUi Butler', 'Excel Creator', 'Financial Model Creator'].filter((n) => bodyText.includes(n));
  console.log('[PROBE] german names present:', JSON.stringify(present));
  console.log('[PROBE] old english names still present:', JSON.stringify(oldEnglish));

  expect(bodyText.includes('LokkyWork Butler')).toBeTruthy();
  expect(bodyText.includes('AionUi Butler')).toBeFalsy();
});
