/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Second-Brain vault browser (CODE-49). Read-only v1: the sidebar browses the
 * vault tree via `list_tree`; clicking a note loads it via `read_note` and opens
 * it in the SAME central preview pane that local files use (`openPreview`), so
 * notes get the full Markdown viewer / source toggle / "open externally" UX.
 *
 * The note is opened as an in-memory virtual Markdown document (no `file_path`),
 * which keeps it read-only — no accidental save-back, no mtime polling against a
 * path that doesn't exist on disk. Writing/editing from here is a follow-up.
 *
 * Calls the remote MCP server through the Main process (`callMcpTool`) because
 * the renderer can't reach it directly (CORS). The Bearer token rides in the
 * server's transport headers and is never surfaced here.
 */

import MarkdownView from '@/renderer/components/Markdown';
import { usePreviewContext } from '@/renderer/pages/conversation/Preview';
import { Button, Empty, Spin, Tree } from '@arco-design/web-react';
import { FileText, FolderClose, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { extractToolText, parseNote, parseVaultTree, pickPathArgKey, type VaultNode } from './vaultParse';
import { VAULT_LIST_TOOL, VAULT_READ_TOOL, type VaultServer } from './vaultDetect';

type CallMcpToolResult = { ok: true; result: unknown } | { ok: false; error: string };
type VaultApi = {
  callMcpTool?: (params: {
    url: string;
    headers?: Record<string, string>;
    name: string;
    args?: Record<string, unknown>;
  }) => Promise<CallMcpToolResult>;
};

/** Loose shape used internally so the wrapper's local error branch needs no discriminant narrowing. */
type VaultCallResult = { ok: boolean; result?: unknown; error?: string };

function getVaultApi(): VaultApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { electronAPI?: VaultApi }).electronAPI;
}

/** Assemble the Markdown shown in the preview: optional meta caption + body. */
function buildNoteMarkdown(body: string, tags: string[]): string {
  const caption = tags.length ? `*Tags: ${tags.join(', ')}*\n\n` : '';
  return caption + body;
}

const VaultBrowser: React.FC<{ server: VaultServer }> = ({ server }) => {
  const { t } = useTranslation();
  const { openPreview } = usePreviewContext();

  const [tree, setTree] = useState<VaultNode[] | null>(null);
  const [rawTree, setRawTree] = useState<string>('');
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  // The note opens in the central preview pane; here we only track which note is
  // active (highlight), which one is mid-load (spinner), and any open error.
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const call = useCallback(
    async (name: string, args?: Record<string, unknown>): Promise<VaultCallResult> => {
      const api = getVaultApi();
      if (!api?.callMcpTool) {
        return {
          ok: false,
          error: t('conversation.workspace.vault.desktopOnly', { defaultValue: 'Nur in der Desktop-App verfügbar.' }),
        };
      }
      return api.callMcpTool({ url: server.url, headers: server.headers, name, args });
    },
    [server.url, server.headers, t]
  );

  const loadTree = useCallback(async () => {
    setTreeLoading(true);
    setTreeError(null);
    const res = await call(VAULT_LIST_TOOL);
    if (res.ok) {
      const parsed = parseVaultTree(res.result);
      setTree(parsed);
      setRawTree(parsed ? '' : extractToolText(res.result));
    } else {
      setTree(null);
      setRawTree('');
      setTreeError(res.error ?? null);
    }
    setTreeLoading(false);
  }, [call]);

  // Load the tree on mount and whenever the detected vault server changes.
  useEffect(() => {
    setSelectedPath(null);
    void loadTree();
  }, [loadTree, server.id]);

  const openNote = useCallback(
    async (node: VaultNode) => {
      setOpenError(null);
      setSelectedPath(node.path);
      setOpeningPath(node.path);
      const argKey = pickPathArgKey(server.readTool.input_schema);
      const res = await call(VAULT_READ_TOOL, { [argKey]: node.path });
      if (res.ok) {
        const note = parseNote(res.result);
        const content = buildNoteMarkdown(note.body, note.tags);
        // Reuse the active preview tab (browse mode), like clicking files in the
        // file tree. No file_path → read-only, no save-back, no mtime polling.
        openPreview(
          content,
          'markdown',
          { file_name: note.title || node.name, title: `vault:${node.path}`, editable: false },
          { replace: true }
        );
      } else {
        setOpenError(res.error ?? null);
      }
      setOpeningPath(null);
    },
    [call, server.readTool, openPreview]
  );

  return (
    <div className='size-full flex flex-col'>
      <div className='flex items-center justify-between px-12px py-8px border-b border-border-2'>
        <span className='text-12px text-t-tertiary truncate'>{server.name}</span>
        <Button
          type='text'
          size='mini'
          icon={<Refresh theme='outline' size={14} />}
          loading={treeLoading}
          onClick={() => void loadTree()}
        >
          {t('common.refresh', { defaultValue: 'Aktualisieren' })}
        </Button>
      </div>

      {openError && <div className='px-12px py-6px text-12px text-danger-6 border-b border-border-2'>{openError}</div>}

      <div className='flex-1 overflow-auto'>
        {treeLoading ? (
          <div className='flex items-center justify-center py-24px'>
            <Spin />
          </div>
        ) : treeError ? (
          <div className='px-12px py-24px text-center text-t-tertiary text-13px'>{treeError}</div>
        ) : tree && tree.length > 0 ? (
          <Tree
            className='!pl-12px !pr-12px py-8px'
            blockNode
            selectedKeys={selectedPath ? [selectedPath] : []}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys)}
            treeData={tree}
            fieldNames={{ children: 'children', title: 'name', key: 'path', isLeaf: 'isFile' }}
            renderTitle={(node) => {
              const data = node.dataRef as unknown as VaultNode;
              const isOpening = openingPath === data.path;
              return (
                <span
                  className='flex items-center gap-6px min-w-0'
                  onClick={() => {
                    if (data.isFile) void openNote(data);
                  }}
                >
                  {isOpening ? (
                    <Spin size={14} className='shrink-0' />
                  ) : data.isFile ? (
                    <FileText theme='outline' size={14} className='shrink-0 text-t-tertiary' />
                  ) : (
                    <FolderClose theme='outline' size={14} className='shrink-0 text-t-tertiary' />
                  )}
                  <span className='overflow-hidden text-ellipsis whitespace-nowrap'>{data.name}</span>
                </span>
              );
            }}
          />
        ) : rawTree ? (
          <div className='px-14px py-12px text-13px leading-22px text-t-secondary'>
            <MarkdownView hiddenCodeCopyButton>{rawTree}</MarkdownView>
          </div>
        ) : (
          <div className='flex-1 size-full flex items-center justify-center px-12px py-24px'>
            <Empty description={t('conversation.workspace.vault.empty', { defaultValue: 'Der Vault ist leer.' })} />
          </div>
        )}
      </div>
    </div>
  );
};

export default VaultBrowser;
