/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * IPC bridge for direct MCP tool calls from the UI (CODE-49, Second-Brain vault
 * browser). The renderer calls `window.electronAPI.callMcpTool({ url, headers,
 * name, args })`; the Main process performs the call (no CORS). Registered via a
 * side-effect import in index.ts. The Bearer token in `headers` is never logged.
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import {
  callMcpTool,
  listMcpTools,
  type CallMcpToolParams,
  type CallMcpToolResult,
  type ListMcpToolsParams,
  type ListMcpToolsResult,
} from '../services/mcpToolClient';

function isCallParams(value: unknown): value is CallMcpToolParams {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.url === 'string' && typeof v.name === 'string';
}

function isListParams(value: unknown): value is ListMcpToolsParams {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as Record<string, unknown>).url === 'string';
}

ipcMain.handle('mcp:call-tool', async (_event, params: unknown): Promise<CallMcpToolResult> => {
  if (!isCallParams(params)) {
    return { ok: false, error: 'invalid params' };
  }
  try {
    return await callMcpTool(params);
  } catch (error) {
    // Never include `headers` (Bearer token) in logs.
    log.error('[mcp:call-tool] failed for tool', params.name, error instanceof Error ? error.message : String(error));
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:list-tools', async (_event, params: unknown): Promise<ListMcpToolsResult> => {
  if (!isListParams(params)) {
    return { ok: false, error: 'invalid params' };
  }
  try {
    return await listMcpTools(params);
  } catch (error) {
    // Never include `headers` (Bearer token) in logs.
    log.error('[mcp:list-tools] failed', error instanceof Error ? error.message : String(error));
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});
