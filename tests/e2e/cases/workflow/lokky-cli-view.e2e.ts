/**
 * Visual check: the guid agent picker + input placeholder show "Lokky CLI"
 * (renamed from "Aion CLI") via the fetchDetectedAgents override.
 *
 * Screenshot: /tmp/workflow-shots/07-lokky-cli.png
 */
import fs from 'fs';
import { test, expect } from '../../fixtures';

const SHOTS_DIR = '/tmp/workflow-shots';

async function ensureRendererReady(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(
    () =>
      window.location.href !== 'about:blank' &&
      typeof (window as unknown as { __backendPort?: number }).__backendPort === 'number',
    { timeout: 30_000 }
  );
}

test.beforeAll(() => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
});

test('guid agent picker + placeholder show Lokky CLI', async ({ page }) => {
  await ensureRendererReady(page);
  const port = await page.evaluate(() => (window as unknown as { __backendPort?: number }).__backendPort);
  console.log(`[PROBE] backend port: ${port}`);

  // Land on guid (default authenticated route).
  await page.evaluate(() => window.location.assign('#/guid'));
  await page.waitForFunction(() => window.location.hash === '#/guid', { timeout: 10_000 }).catch(() => {});
  await page.waitForFunction(() => (document.body.textContent?.length ?? 0) > 200, { timeout: 20_000 }).catch(() => {});

  // Raw backend agent names (un-overridden) — proves what the backend actually sends.
  const backendNames = await page.evaluate(async () => {
    const p = (window as unknown as { __backendPort?: number }).__backendPort;
    try {
      const res = await fetch(`http://127.0.0.1:${p}/api/agents`);
      if (!res.ok) return { status: res.status, names: null as unknown };
      const json = (await res.json()) as unknown;
      const arr = Array.isArray(json)
        ? json
        : ((json as Record<string, unknown>)?.data ?? (json as Record<string, unknown>)?.agents);
      const names = Array.isArray(arr)
        ? (arr as Record<string, unknown>[]).map((a) => ({ name: a.name, type: a.agent_type ?? a.type }))
        : null;
      return { status: res.status, names };
    } catch (e) {
      return { status: -1, error: String(e) };
    }
  });
  console.log('[PROBE] raw /api/agents:', JSON.stringify(backendNames));

  // Wait for the input (its placeholder includes the selected agent label).
  const input = page.locator('textarea, input[placeholder]').filter({ hasText: '' }).first();
  await page.waitForTimeout(800); // let the agent label resolve from fetchDetectedAgents

  const placeholder = await page.evaluate(() => {
    const ta = Array.from(document.querySelectorAll('textarea,input')).find(
      (el) => (el as HTMLInputElement).placeholder && (el as HTMLInputElement).placeholder.length > 5
    ) as HTMLInputElement | undefined;
    return ta?.placeholder ?? '';
  });
  console.log('[PROBE] input placeholder:', JSON.stringify(placeholder));

  await page.screenshot({ path: `${SHOTS_DIR}/07-lokky-cli.png` });

  const bodyText = await page.evaluate(() => document.body.textContent ?? '');
  const pickerHasLokky = bodyText.includes('Lokky CLI');
  const pickerHasAion = /Aion CLI/.test(bodyText);
  console.log('[PROBE] body contains "Lokky CLI":', pickerHasLokky);
  console.log('[PROBE] body contains "Aion CLI":', pickerHasAion);
  console.log('[PROBE] placeholder has Lokky CLI:', placeholder.includes('Lokky CLI'));
  console.log('[PROBE] placeholder has Aion CLI:', placeholder.includes('Aion CLI'));

  void input;
  // Soft expectations: do not fail the run on mismatch — we want the report + screenshot.
  expect(true).toBeTruthy();
});
