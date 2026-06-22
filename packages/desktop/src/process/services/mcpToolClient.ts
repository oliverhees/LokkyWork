/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal Main-process MCP client for the Second-Brain vault browser (CODE-49).
 *
 * The renderer cannot call a remote MCP server directly (CORS), and aioncore
 * exposes no generic "call this MCP tool" endpoint — only server CRUD / test /
 * OAuth. So the UI calls a tool here, in the Main process (no CORS), using the
 * official MCP SDK over Streamable HTTP. The renderer passes the server's URL +
 * headers (Bearer token) — already available to it via `mcp.listServers`.
 *
 * Connect → call → close per request: simple and robust for a browse panel; no
 * connection lifecycle to leak. The Bearer token is never logged.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export type CallMcpToolParams = {
  /** Remote MCP endpoint, e.g. https://lokyy-brain.kimiboca.de/mcp */
  url: string;
  /** Request headers incl. `Authorization: Bearer …`. */
  headers?: Record<string, string>;
  /** Tool name, e.g. 'list_tree' / 'read_note'. */
  name: string;
  /** Tool arguments. */
  args?: Record<string, unknown>;
};

export type CallMcpToolResult = { ok: true; result: unknown } | { ok: false; error: string };

export type ListMcpToolsParams = {
  /** Remote MCP endpoint, e.g. https://lokyy-brain.kimiboca.de/mcp */
  url: string;
  /** Request headers incl. `Authorization: Bearer …`. */
  headers?: Record<string, string>;
};

export type McpToolInfo = { name: string; description?: string };
export type ListMcpToolsResult = { ok: true; tools: McpToolInfo[] } | { ok: false; error: string };

/**
 * Connect to a remote (Streamable HTTP) MCP server and list its tools WITHOUT
 * calling any — used by the "Second Brain verbinden" form to test a connection
 * before saving (LOKYY-51). Same connect→close lifecycle as {@link callMcpTool};
 * the Bearer token in `headers` is never logged.
 */
export async function listMcpTools(params: ListMcpToolsParams): Promise<ListMcpToolsResult> {
  let client: Client | undefined;
  try {
    const transport = new StreamableHTTPClientTransport(new URL(params.url), {
      requestInit: { headers: params.headers ?? {} },
    });
    client = new Client({ name: 'lokkywork-vault-connect', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    const result = await client.listTools();
    const tools: McpToolInfo[] = (result.tools ?? []).map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
    return { ok: true, tools };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    try {
      await client?.close();
    } catch {
      /* ignore close errors */
    }
  }
}

/** Call a single tool on a remote (Streamable HTTP) MCP server and return its raw result. */
export async function callMcpTool(params: CallMcpToolParams): Promise<CallMcpToolResult> {
  let client: Client | undefined;
  try {
    const transport = new StreamableHTTPClientTransport(new URL(params.url), {
      requestInit: { headers: params.headers ?? {} },
    });
    client = new Client({ name: 'lokkywork-vault-browser', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    const result = await client.callTool({ name: params.name, arguments: params.args ?? {} });
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    try {
      await client?.close();
    } catch {
      /* ignore close errors */
    }
  }
}
