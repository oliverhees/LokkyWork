/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * IPC bridge for the PII proxy (CODE-33/34). The renderer settings switch calls
 * `window.electronAPI.syncPiiProxy(enabled)` to start/stop the proxy at runtime,
 * and `window.electronAPI.runPiiSelfTest()` to run the end-to-end self-test
 * through the running proxy. Registered via a side-effect import in index.ts.
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { syncPiiProxy } from '../services/piiProxyLifecycle';
import { PII_PROXY_PORT } from '@/common/pii/piiProxyShared';

export type PiiProxySyncResult = { ok: boolean; error?: string };
export type PiiSelfTestResult = { ok: boolean; error?: string; result?: unknown };

ipcMain.handle('pii-proxy:sync', async (_event, enabled: unknown): Promise<PiiProxySyncResult> => {
  try {
    await syncPiiProxy(enabled === true);
    return { ok: true };
  } catch (error) {
    log.error('[pii-proxy] sync failed:', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('pii-proxy:selftest', async (): Promise<PiiSelfTestResult> => {
  try {
    const resp = await fetch(`http://127.0.0.1:${PII_PROXY_PORT}/__pii-proxy/selftest`);
    if (!resp.ok) return { ok: false, error: `proxy responded ${resp.status}` };
    return { ok: true, result: await resp.json() };
  } catch (error) {
    // fetch throws when nothing is listening — i.e. the proxy isn't running.
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});
