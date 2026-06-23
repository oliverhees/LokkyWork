/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lifecycle wrapper around the local PII anonymization proxy (CODE-33), kept out
 * of index.ts so the main-process entrypoint only needs start/stop calls. Holds
 * the single running handle and is safe to call repeatedly (idempotent), so the
 * same `syncPiiProxy` serves both app startup and the runtime toggle.
 */

import log from 'electron-log';
import { startPiiProxyServer, type PiiProxyHandle } from './piiProxyServer';
import { PII_PROXY_PORT } from '@/common/pii/piiProxyShared';

let handle: PiiProxyHandle | null = null;

export function isPiiProxyRunning(): boolean {
  return handle !== null;
}

export function getPiiProxyPort(): number | null {
  return handle?.port ?? null;
}

export async function startPiiProxy(): Promise<void> {
  if (handle) return;
  handle = await startPiiProxyServer(PII_PROXY_PORT);
  log.info(`[pii-proxy] listening on 127.0.0.1:${handle.port}`);
}

export async function stopPiiProxy(): Promise<void> {
  if (!handle) return;
  const current = handle;
  handle = null;
  await current.stop();
  log.info('[pii-proxy] stopped');
}

/** Start or stop the proxy to match `enabled`. Idempotent. */
export async function syncPiiProxy(enabled: boolean): Promise<void> {
  if (enabled) {
    await startPiiProxy();
  } else {
    await stopPiiProxy();
  }
}
