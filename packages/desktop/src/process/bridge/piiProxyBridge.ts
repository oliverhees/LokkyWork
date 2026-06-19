/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * IPC bridge for the runtime PII-proxy toggle (CODE-33). The renderer settings
 * switch calls `window.electronAPI.syncPiiProxy(enabled)`, which routes here and
 * starts/stops the local proxy without an app restart. Registered via a
 * side-effect import in index.ts (same pattern as feedbackBridge).
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { syncPiiProxy } from '../services/piiProxyLifecycle';

export type PiiProxySyncResult = { ok: boolean; error?: string };

ipcMain.handle('pii-proxy:sync', async (_event, enabled: unknown): Promise<PiiProxySyncResult> => {
  try {
    await syncPiiProxy(enabled === true);
    return { ok: true };
  } catch (error) {
    log.error('[pii-proxy] sync failed:', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});
