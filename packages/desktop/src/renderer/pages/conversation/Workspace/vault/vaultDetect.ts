/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generic detection of a "Second Brain" vault MCP server (CODE-49).
 *
 * A server qualifies — regardless of its name — when its advertised tools
 * include BOTH `list_tree` (browse) and `read_note` (open). This keeps the tab
 * vendor-neutral: any knowledge-vault MCP exposing those two tools lights it up,
 * not just one hardcoded server. Only HTTP-family transports carry a URL we can
 * call from the Main process, so stdio servers are ignored.
 */

import type { IMcpServer, IMcpServerTransportHTTP, IMcpServerTransportSSE, IMcpTool } from '@/common/config/storage';

/** Tool names that mark a server as a browsable vault. */
export const VAULT_LIST_TOOL = 'list_tree';
export const VAULT_READ_TOOL = 'read_note';
/** Tool that writes a new note into the vault (powers the "Merken" action). */
export const VAULT_CREATE_TOOL = 'create_managed_note';

/** Default display name for a Second-Brain connection created via the form. */
export const DEFAULT_SECOND_BRAIN_NAME = 'Second Brain';

/** A detected vault server, reduced to what the browser needs to call it. */
export type VaultServer = {
  id: string;
  name: string;
  /** Remote MCP endpoint. */
  url: string;
  /** Request headers (incl. Authorization: Bearer …). */
  headers?: Record<string, string>;
  /** The `read_note` tool, kept for its `input_schema` (path arg name). */
  readTool: IMcpTool;
  /**
   * The `create_managed_note` tool when the vault supports writing. Present only
   * if the server advertises it — the "Merken" action is gated on this.
   */
  createTool?: IMcpTool;
};

const findTool = (tools: IMcpTool[] | undefined, name: string): IMcpTool | undefined =>
  tools?.find((tool) => tool.name === name);

/**
 * Pure capability check: does this tool set qualify the server as a vault? Shared
 * by {@link detectVaultServer} (browser/Merken) and the assistant editor (gating
 * the system-prompt nudge) so both use ONE definition of "vault-capable" — the
 * same `list_tree` + `read_note` requirement, no duplicate/divergent logic.
 */
export function serverIsVaultCapable(tools: IMcpTool[] | undefined): boolean {
  return Boolean(findTool(tools, VAULT_LIST_TOOL) && findTool(tools, VAULT_READ_TOOL));
}

/** Read url + headers off any HTTP-family transport (stdio has none). */
function getHttpEndpoint(server: IMcpServer): { url: string; headers?: Record<string, string> } | null {
  const transport = server.transport;
  if (transport.type === 'stdio') return null;
  if (!transport.url) return null;
  return { url: transport.url, headers: transport.headers };
}

/**
 * Find the first configured server that is a browsable vault. Returns null when
 * none qualifies (then the Vault tab simply isn't shown).
 */
export function detectVaultServer(servers: IMcpServer[] | null | undefined): VaultServer | null {
  if (!servers?.length) return null;
  for (const server of servers) {
    if (!serverIsVaultCapable(server.tools)) continue;
    const readTool = findTool(server.tools, VAULT_READ_TOOL);
    if (!readTool) continue;
    const endpoint = getHttpEndpoint(server);
    if (!endpoint) continue;
    return {
      id: server.id,
      name: server.name,
      url: endpoint.url,
      headers: endpoint.headers,
      readTool,
      createTool: findTool(server.tools, VAULT_CREATE_TOOL),
    };
  }
  return null;
}

/** First configured server that is vault-capable (for the "connected" form state). */
export function findVaultCapableServer(servers: IMcpServer[] | null | undefined): IMcpServer | undefined {
  return servers?.find((server) => server.transport.type !== 'stdio' && serverIsVaultCapable(server.tools));
}

/** Trim a user-entered MCP server URL. */
export function normalizeServerUrl(url: string): string {
  return url.trim();
}

/** Build an HTTP-family transport with the given headers, mirroring `parseTransport`. */
function buildVaultTransport(
  url: string,
  headers: Record<string, string> | undefined
): IMcpServerTransportHTTP | IMcpServerTransportSSE {
  const normalizedUrl = normalizeServerUrl(url);
  return normalizedUrl.includes('/sse')
    ? { type: 'sse', url: normalizedUrl, headers }
    : { type: 'http', url: normalizedUrl, headers };
}

/**
 * Build the HTTP-family transport for a Second-Brain connection, exactly like
 * the proven JSON import (`parseTransport`): `/sse` URLs → `sse`, otherwise
 * `http` (Streamable HTTP, which aioncore connects end-to-end), with the token
 * carried as `Authorization: Bearer …`.
 */
export function buildSecondBrainTransport(
  url: string,
  token: string
): IMcpServerTransportHTTP | IMcpServerTransportSSE {
  return buildVaultTransport(url, { Authorization: `Bearer ${token.trim()}` });
}

type VaultServerData = Omit<IMcpServer, 'id' | 'created_at' | 'updated_at'>;

/** Shared assembly: transport + Claude-Desktop-style `original_json` from headers. */
function buildVaultServerData(name: string, url: string, headers: Record<string, string> | undefined): VaultServerData {
  const finalName = name.trim() || DEFAULT_SECOND_BRAIN_NAME;
  const transport = buildVaultTransport(url, headers);
  const original_json = JSON.stringify({ mcpServers: { [finalName]: { url: transport.url, headers } } }, null, 2);
  return { name: finalName, enabled: true, transport, original_json };
}

/**
 * Assemble the create/update payload for a Second-Brain MCP server. Mirrors the
 * JSON-import shape (incl. Claude-Desktop-style `original_json`) so it flows
 * through the SAME persistence path as manual add/import — no bespoke storage.
 * The token lives in the transport headers (required for the connection) and in
 * `original_json`; it is never logged or shown in plaintext by the UI.
 */
export function buildSecondBrainServerData(params: { name: string; url: string; token: string }): VaultServerData {
  return buildVaultServerData(params.name, params.url, { Authorization: `Bearer ${params.token.trim()}` });
}

/**
 * Update payload that KEEPS the existing token: reuses the already-stored headers
 * (e.g. when the user changes only the URL/name and leaves the token field blank).
 */
export function buildSecondBrainServerDataKeepingToken(params: {
  name: string;
  url: string;
  headers: Record<string, string> | undefined;
}): VaultServerData {
  return buildVaultServerData(params.name, params.url, params.headers);
}
