/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Thin renderer-side wrapper around the Main-process MCP tool call exposed at
 * `window.electronAPI.callMcpTool` (CODE-49). The renderer can't reach the
 * remote vault directly (CORS), so every vault tool call routes through the
 * Main process. The Bearer token rides in the server's transport `headers` and
 * is never logged here.
 */

import type { VaultServer } from './vaultDetect';
import { extractToolError } from './vaultParse';

type CallMcpToolResult = { ok: true; result: unknown } | { ok: false; error: string };
type VaultApi = {
  callMcpTool?: (params: {
    url: string;
    headers?: Record<string, string>;
    name: string;
    args?: Record<string, unknown>;
  }) => Promise<CallMcpToolResult>;
};

/** Loose result shape so callers don't need discriminant narrowing. */
export type VaultCallResult = { ok: boolean; result?: unknown; error?: string };

function getVaultApi(): VaultApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { electronAPI?: VaultApi }).electronAPI;
}

/**
 * Call a tool on the given vault server. `desktopOnlyMessage` is returned as the
 * error when the bridge is unavailable (e.g. the web build, where there is no
 * Main process to proxy the request).
 *
 * Honestly evaluates the result: a transport-level success can still carry a
 * tool-level failure (the vault returns `{ "error": … }` in its content WITHOUT
 * setting `isError`), so {@link extractToolError} is consulted — only a genuinely
 * clean result reports `ok: true`.
 */
export async function callVaultTool(
  server: VaultServer,
  name: string,
  args: Record<string, unknown>,
  desktopOnlyMessage: string
): Promise<VaultCallResult> {
  const api = getVaultApi();
  if (!api?.callMcpTool) {
    return { ok: false, error: desktopOnlyMessage };
  }
  const res = await api.callMcpTool({ url: server.url, headers: server.headers, name, args });
  if (!res.ok) return res;
  const toolError = extractToolError(res.result);
  if (toolError) return { ok: false, error: toolError };
  return { ok: true, result: res.result };
}
