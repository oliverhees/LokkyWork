/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mcpService } from '@/common/adapter/ipcBridge';
import { useEffect, useState } from 'react';
import { detectVaultServer, type VaultServer } from './vaultDetect';

/**
 * Detect a connected Second-Brain vault MCP server (CODE-49). Returns the first
 * server exposing the vault tools (see {@link detectVaultServer}), or null —
 * which drives both the Vault tab and the per-message "Merken" action.
 *
 * The detection result is cached at module scope for a short TTL so that many
 * simultaneous consumers (e.g. one `MessageText` per chat message, all mounting
 * at once) share a single `listServers` round-trip instead of each firing their
 * own. The TTL keeps it fresh enough that a newly-connected vault appears within
 * seconds; the behaviour for any single consumer is unchanged.
 */

const CACHE_TTL_MS = 15_000;
let cached: { at: number; promise: Promise<VaultServer | null> } | null = null;

function loadVaultServer(): Promise<VaultServer | null> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.promise;
  const promise = (async () => {
    try {
      return detectVaultServer(await mcpService.listServers.invoke());
    } catch {
      return null;
    }
  })();
  cached = { at: now, promise };
  return promise;
}

export function useVaultServer(): VaultServer | null {
  const [server, setServer] = useState<VaultServer | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadVaultServer().then((result) => {
      if (!cancelled) setServer(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return server;
}
