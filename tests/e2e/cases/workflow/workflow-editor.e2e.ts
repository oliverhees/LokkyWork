/**
 * E2E visual check: the react-flow visual workflow editor (P2).
 *
 * Flow: launch app -> /workflows -> "New Workflow" dialog (name "Test", step
 * "Recherche", save) -> list row "Edit" -> /workflow/<id> react-flow canvas ->
 * screenshot canvas -> click the step node -> StepConfigPanel inspector ->
 * screenshot inspector.
 *
 * Screenshots: /tmp/workflow-shots/03-canvas.png, 04-inspector.png.
 */
import fs from 'fs';
import { test, expect } from '../../fixtures';

const SHOTS_DIR = '/tmp/workflow-shots';

const NEW_WORKFLOW_BTN = /New Workflow|Neuer Workflow|新建工作流|工作流/i;
const CREATE_DIALOG_TITLE = /Create Workflow|Workflow erstellen|创建工作流|新建工作流/i;
const SAVE_BTN = /^(Save|Speichern|保存)$/i;
const EDIT_BTN = /^(Edit|Bearbeiten|编辑)$/i;
const INSPECTOR_TITLE = /Edit step|Schritt bearbeiten|编辑步骤/i;

const WF_NAME = 'Test';
const STEP_NAME = 'Recherche';

async function ensureRendererReady(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => window.location.href !== 'about:blank' && typeof (window as unknown as { __backendPort?: number }).__backendPort === 'number', { timeout: 30_000 });
}

test.describe('Workflow Editor (visual canvas)', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SHOTS_DIR, { recursive: true });
  });

  test('create + save a workflow, open the canvas editor, inspect a step', async ({ page }) => {
    await ensureRendererReady(page);
    const backendPort = await page.evaluate(() => (window as unknown as { __backendPort?: number }).__backendPort);
    console.log(`[E2E] aioncore backend port: ${backendPort}`);

    // Wait for the router + sidebar, then navigate to /workflows via the Sider
    // entry (it uses React Router's navigate, the robust path).
    await page.waitForFunction(() => (document.body.textContent?.length ?? 0) > 200, { timeout: 20_000 }).catch(() => {});
    const workflowEntry = page.locator('div').filter({ hasText: /^Workflows$/ }).last();
    await expect(workflowEntry).toBeVisible({ timeout: 15_000 });
    await workflowEntry.click();
    await page.waitForFunction(() => window.location.hash === '#/workflows', { timeout: 10_000 });

    // ── (a) Create + save a workflow ────────────────────────────────────────
    const newBtn = page.locator('.arco-btn').filter({ hasText: NEW_WORKFLOW_BTN }).first();
    await expect(newBtn).toBeVisible({ timeout: 10_000 });
    await newBtn.click();

    const dialog = page.locator('.arco-modal');
    await expect(page.locator('.aionui-modal-title').filter({ hasText: CREATE_DIALOG_TITLE }).first()).toBeVisible({ timeout: 10_000 });

    // Workflow name: the first textbox in the Form (Name field).
    const nameInput = dialog.locator('input.arco-input').first();
    await nameInput.fill(WF_NAME);

    // The dialog seeds one step. Fill the step's "name" field — it's the small
    // Input directly under the step's "Step name" label. Use the step-name
    // placeholder to target it precisely (en "e.g. Draft" / de "z. B. Entwurf").
    const stepNameInput = dialog.locator('input[placeholder*="Draft"], input[placeholder*="Entwurf"], input[placeholder*="草稿"]').first();
    await expect(stepNameInput).toBeVisible({ timeout: 5_000 });
    await stepNameInput.fill(STEP_NAME);

    // Save (dialog's primary OK button).
    const dialogSave = dialog.locator('.arco-btn-primary').filter({ hasText: SAVE_BTN }).first();
    await expect(dialogSave).toBeVisible({ timeout: 5_000 });
    await dialogSave.click();
    await expect(page.locator('.arco-modal')).toBeHidden({ timeout: 10_000 });

    // The new workflow card should appear in the list.
    const card = page.locator('text=' + WF_NAME);
    await expect(card.first()).toBeVisible({ timeout: 10_000 });

    // ── (b) Edit -> navigate to /workflow/<id> ──────────────────────────────
    const editBtn = page.locator('.arco-btn').filter({ hasText: EDIT_BTN }).first();
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();
    await page.waitForFunction(() => /#\/workflow\/[^/]+$/.test(window.location.hash), { timeout: 10_000 });

    // ── (c) react-flow canvas + at least one step node ──────────────────────
    const canvas = page.locator('.react-flow');
    await expect(canvas.first()).toBeVisible({ timeout: 15_000 });
    const node = page.locator('.react-flow__node');
    await expect(node.first()).toBeVisible({ timeout: 15_000 });
    // The node should carry the step label we set.
    await expect(page.locator('.react-flow__node').filter({ hasText: STEP_NAME }).first()).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: `${SHOTS_DIR}/03-canvas.png` });

    // ── (d) Click the node -> StepConfigPanel inspector ─────────────────────
    await node.first().click();
    const inspectorHeader = page.locator('span').filter({ hasText: INSPECTOR_TITLE });
    await expect(inspectorHeader.first()).toBeVisible({ timeout: 10_000 });

    // Confirm the inspector renders the step fields (labels are locale-stable
    // enough via en/de). Backend, Model, Skills, input mode, Prompt.
    const panelRegion = page.locator('.react-flow').locator('xpath=ancestor::div[1]'); // editor root
    // Simpler: assert key labels are visible anywhere in the inspector column.
    await expect(page.locator('label').filter({ hasText: /Model|Modell/i }).last()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('label').filter({ hasText: /^Skills$/ }).last()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('label').filter({ hasText: /Backend/i }).last()).toBeVisible({ timeout: 5_000 });
    void panelRegion;

    await page.screenshot({ path: `${SHOTS_DIR}/04-inspector.png` });

    // ── Cleanup: go back and delete the "Test" workflow ─────────────────────
    const back = page.locator('.arco-btn').filter({ hasText: /^(Back|Zurück|返回)$/i }).first();
    await back.click().catch(() => {});
    await page.waitForFunction(() => window.location.hash === '#/workflows', { timeout: 10_000 }).catch(() => {});
    const delBtn = page.locator('.arco-btn').filter({ hasText: /^(Delete|Löschen|删除)$/i }).first();
    if (await delBtn.isVisible().catch(() => false)) {
      await delBtn.click();
      const confirm = page.locator('.arco-popconfirm .arco-btn-primary, .arco-popover .arco-btn-primary').first();
      await confirm.click({ timeout: 5_000 }).catch(() => {});
    }
  });
});
