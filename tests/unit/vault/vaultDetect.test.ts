/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { IMcpServer, IMcpTool } from '@/common/config/storage';
import {
  buildSecondBrainServerData,
  buildSecondBrainTransport,
  detectVaultServer,
  findVaultCapableServer,
  normalizeServerUrl,
  serverIsVaultCapable,
} from '@/renderer/pages/conversation/Workspace/vault/vaultDetect';

const tool = (name: string): IMcpTool => ({ name });
const VAULT_TOOLS = [tool('list_tree'), tool('read_note'), tool('search_vault'), tool('create_managed_note')];

const httpServer = (over: Partial<IMcpServer> = {}): IMcpServer =>
  ({
    id: 's1',
    name: 'lokyy-brain',
    enabled: true,
    transport: { type: 'http', url: 'https://vault.example/mcp', headers: { Authorization: 'Bearer x' } },
    tools: VAULT_TOOLS,
    created_at: 0,
    updated_at: 0,
    original_json: '{}',
    ...over,
  }) as IMcpServer;

describe('serverIsVaultCapable', () => {
  it('is true when both list_tree and read_note are present', () => {
    expect(serverIsVaultCapable([tool('list_tree'), tool('read_note')])).toBe(true);
    expect(serverIsVaultCapable(VAULT_TOOLS)).toBe(true);
  });

  it('is false when either required tool is missing', () => {
    expect(serverIsVaultCapable([tool('list_tree')])).toBe(false);
    expect(serverIsVaultCapable([tool('read_note')])).toBe(false);
    expect(serverIsVaultCapable([tool('search_vault'), tool('create_managed_note')])).toBe(false);
  });

  it('is false for an empty or missing tool list', () => {
    expect(serverIsVaultCapable([])).toBe(false);
    expect(serverIsVaultCapable(undefined)).toBe(false);
  });
});

describe('detectVaultServer', () => {
  it('detects a vault HTTP server and captures the create tool', () => {
    const detected = detectVaultServer([httpServer()]);
    expect(detected).not.toBeNull();
    expect(detected?.id).toBe('s1');
    expect(detected?.url).toBe('https://vault.example/mcp');
    expect(detected?.createTool?.name).toBe('create_managed_note');
  });

  it('leaves createTool undefined for a read-only vault', () => {
    const detected = detectVaultServer([httpServer({ tools: [tool('list_tree'), tool('read_note')] })]);
    expect(detected?.createTool).toBeUndefined();
  });

  it('ignores stdio transports (no callable URL) and non-vault servers', () => {
    const stdio = httpServer({ transport: { type: 'stdio', command: 'x' } as IMcpServer['transport'] });
    const nonVault = httpServer({ id: 's2', tools: [tool('something_else')] });
    expect(detectVaultServer([stdio])).toBeNull();
    expect(detectVaultServer([nonVault])).toBeNull();
    expect(detectVaultServer([])).toBeNull();
  });
});

describe('findVaultCapableServer', () => {
  it('returns the first vault-capable non-stdio server', () => {
    const found = findVaultCapableServer([httpServer({ id: 's2', tools: [tool('x')] }), httpServer()]);
    expect(found?.id).toBe('s1');
  });

  it('returns undefined when none qualifies', () => {
    expect(findVaultCapableServer([httpServer({ tools: [tool('x')] })])).toBeUndefined();
    expect(findVaultCapableServer([])).toBeUndefined();
    expect(findVaultCapableServer(undefined)).toBeUndefined();
  });
});

describe('normalizeServerUrl', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeServerUrl('  https://v/mcp \n')).toBe('https://v/mcp');
  });
});

describe('buildSecondBrainTransport', () => {
  it('builds an http transport with a Bearer header for a /mcp URL', () => {
    const transport = buildSecondBrainTransport('https://vault.example/mcp', 'secret');
    expect(transport).toEqual({
      type: 'http',
      url: 'https://vault.example/mcp',
      headers: { Authorization: 'Bearer secret' },
    });
  });

  it('selects sse for /sse URLs and trims url + token', () => {
    const transport = buildSecondBrainTransport('  https://vault.example/sse  ', '  tok  ');
    expect(transport.type).toBe('sse');
    expect(transport).toMatchObject({ url: 'https://vault.example/sse', headers: { Authorization: 'Bearer tok' } });
  });
});

describe('buildSecondBrainServerData', () => {
  it('produces a CRUD-ready payload mirroring the JSON-import shape', () => {
    const data = buildSecondBrainServerData({ name: 'Mein Vault', url: 'https://vault.example/mcp', token: 'secret' });
    expect(data.name).toBe('Mein Vault');
    expect(data.enabled).toBe(true);
    expect(data.transport).toEqual({
      type: 'http',
      url: 'https://vault.example/mcp',
      headers: { Authorization: 'Bearer secret' },
    });
    const parsed = JSON.parse(data.original_json);
    expect(parsed.mcpServers['Mein Vault']).toEqual({
      url: 'https://vault.example/mcp',
      headers: { Authorization: 'Bearer secret' },
    });
  });

  it('falls back to the default name when blank', () => {
    const data = buildSecondBrainServerData({ name: '   ', url: 'https://v/mcp', token: 't' });
    expect(data.name).toBe('Second Brain');
  });
});
