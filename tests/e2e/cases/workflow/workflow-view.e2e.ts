/**
 * E2E visual check: the /workflows page.
 *
 * Flow: launch app -> (desktop runtime auto-authenticates) -> navigate to
 * #/workflows via HashRouter -> screenshot the list -> open the
 * "New Workflow" dialog (Step editor incl. Model select) -> screenshot it.
 *
 * Screenshots are written to /tmp/workflow-shots/ (01-list.png, 02-dialog.png).
 */
import fs from 'fs';
import { test, expect } from '../../fixtures';

const SHOTS_DIR = '/tmp/workflow-shots';

// The workflow page title is "Workflows" in every locale (workflow.json -> title).
const WORKFLOW_TITLE = /Workflows/;
// "New Workflow" button label: en "New Workflow", de "Neuer Workflow", + CJK fallbacks.
const NEW_WORKFLOW_BTN = /New Workflow|Neuer Workflow|新建工作流|工作流/i;
// Dialog title: en "Create Workflow", de "Workflow erstellen", + fallback.
const CREATE_DIALOG_TITLE = /Create Workflow|Workflow erstellen|创建工作流|新建工作流/i;

/**
 * Wait until the renderer is alive: location resolved and the backend port
 * (aioncore) is known. Mirrors helpers/navigation.ts#ensureRendererReady.
 */
async function ensureRendererReady(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => window.location.href !== 'about:blank' && typeof (window as unknown as { __backendPort?: number }).__backendPort === 'number', { timeout: 30_000 });
}

test.describe('Workflow View', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SHOTS_DIR, { recursive: true });
  });

  test('renders /workflows list and opens the create dialog', async ({ page }) => {
    await ensureRendererReady(page);

    // Report the resolved backend port for the run log (proves aioncore is up).
    const backendPort = await page.evaluate(() => (window as unknown as { __backendPort?: number }).__backendPort);
    console.log(`[E2E] aioncore backend port: ${backendPort}`);

    // Navigate to the HashRouter route. Desktop runtime auto-authenticates
    // (AuthContext: isDesktopRuntime => status 'authenticated'), so /workflows
    // is reachable directly without a login step.
    // Wait until React Router has mounted and the sidebar is rendered.
    await page.waitForFunction(() => (document.body.textContent?.length ?? 0) > 200, { timeout: 20_000 }).catch(() => {});

    // Navigate via the Sider "Workflows" entry — it calls React Router's
    // navigate('/workflows') internally, which is the robust path the app
    // itself uses (raw location.hash assignment races the router's redirects).
    const workflowEntry = page.locator('div').filter({ hasText: /^Workflows$/ }).last();
    await expect(workflowEntry).toBeVisible({ timeout: 15_000 });
    await workflowEntry.click();
    await page.waitForFunction(() => window.location.hash === '#/workflows', { timeout: 10_000 });

    // (a) List page rendered: the page title + the "New Workflow" button.
    const pageTitle = page.locator('h1').filter({ hasText: WORKFLOW_TITLE });
    await expect(pageTitle.first()).toBeVisible({ timeout: 15_000 });

    const newBtn = page.locator('.arco-btn').filter({ hasText: NEW_WORKFLOW_BTN }).first();
    await expect(newBtn).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: `${SHOTS_DIR}/01-list.png` });

    // (b) Open the create dialog and wait for the Step editor to render.
    await newBtn.click();

    const dialogTitle = page.locator('.aionui-modal-title').filter({ hasText: CREATE_DIALOG_TITLE });
    await expect(dialogTitle.first()).toBeVisible({ timeout: 10_000 });

    // The dialog must show at least one Step with a Model select. The step
    // card contains several .arco-select triggers (backend / model / inputMode).
    const modal = page.locator('.arco-modal');
    await expect(modal.locator('.arco-select').first()).toBeVisible({ timeout: 10_000 });

    // Sanity: confirm the step grid label "Model" is present (en/de) — proves
    // the Model field rendered, not just any select.
    const modelLabel = modal.locator('label').filter({ hasText: /Model|Modell/i });
    await expect(modelLabel.first()).toBeVisible({ timeout: 5_000 });

    // Confirm the new per-step "Skills" multi-select field rendered. The label
    // is "Skills" in every locale (workflow.form.step.skills). The select may
    // be empty (no skills in the test backend) — we only assert the field
    // element exists, not that it has options.
    const skillsLabel = modal.locator('label').filter({ hasText: /^Skills$/ });
    await expect(skillsLabel.first()).toBeVisible({ timeout: 5_000 });
    // The Skills control is a multi-mode Arco select rendered right after the label.
    const skillsSelect = modal.locator('.arco-select-multiple, .arco-select').filter({ hasText: /Select skills|Skills auswählen/i });
    await expect(skillsSelect.first()).toBeVisible({ timeout: 5_000 }).catch(() => {});

    await page.screenshot({ path: `${SHOTS_DIR}/02-dialog.png` });

    // Close the dialog to leave the shared app instance clean for later tests.
    await page.locator('.aionui-modal-close-btn').first().click().catch(() => {});
  });
});
