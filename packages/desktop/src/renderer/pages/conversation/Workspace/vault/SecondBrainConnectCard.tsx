/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Friendly "Second Brain verbinden" card (LOKYY-51). Replaces raw MCP-JSON paste
 * with two fields (URL + access token) for connecting a knowledge-vault MCP over
 * Streamable HTTP + Bearer. Test connects via the Main-process MCP path
 * (`listMcpTools`) and reports tool count + vault-capability; Connect/Update goes
 * through the SAME persistence path the manual add/import uses (no bespoke
 * storage). When a vault MCP already exists, the card shows a "connected" state
 * with Update + Disconnect.
 *
 * Token security: entered only via Arco `Input.Password` (masked), never logged,
 * never rendered in plaintext. In the connected state the field starts empty
 * ("leave unchanged") — the stored token is never read back into the UI.
 */

import type { IMcpServer } from '@/common/config/storage';
import { Button, Input, Message, Popconfirm, Tag } from '@arco-design/web-react';
import { Brain } from '@icon-park/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildSecondBrainServerData,
  buildSecondBrainServerDataKeepingToken,
  DEFAULT_SECOND_BRAIN_NAME,
  findVaultCapableServer,
  normalizeServerUrl,
  serverIsVaultCapable,
} from './vaultDetect';

type ServerData = Omit<IMcpServer, 'id' | 'created_at' | 'updated_at'>;
type Props = {
  servers: IMcpServer[];
  onConnect: (serverData: ServerData) => Promise<void> | void;
  onUpdate: (server: IMcpServer, serverData: ServerData) => Promise<void> | void;
  onDisconnect: (serverId: string) => Promise<void> | void;
};

type ListMcpToolsApi = {
  listMcpTools?: (params: {
    url: string;
    headers?: Record<string, string>;
  }) => Promise<{ ok: true; tools: Array<{ name: string; description?: string }> } | { ok: false; error: string }>;
};

function getConnectApi(): ListMcpToolsApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { electronAPI?: ListMcpToolsApi }).electronAPI;
}

/** url + headers off an existing (non-stdio) server. */
function httpEndpointOf(server: IMcpServer | undefined): { url: string; headers?: Record<string, string> } {
  if (server && server.transport.type !== 'stdio') {
    return { url: server.transport.url, headers: server.transport.headers };
  }
  return { url: '' };
}

const SecondBrainConnectCard: React.FC<Props> = ({ servers, onConnect, onUpdate, onDisconnect }) => {
  const { t } = useTranslation();
  const existing = useMemo(() => findVaultCapableServer(servers), [servers]);
  const existingEndpoint = httpEndpointOf(existing);

  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [name, setName] = useState(DEFAULT_SECOND_BRAIN_NAME);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Sync the form to the connected server (URL + name; token stays blank).
  useEffect(() => {
    if (existing) {
      setUrl(existingEndpoint.url);
      setName(existing.name || DEFAULT_SECOND_BRAIN_NAME);
      setToken('');
      setTestState(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const handleTest = async () => {
    const api = getConnectApi();
    if (!api?.listMcpTools) {
      setTestState({
        tone: 'error',
        text: t('settings.secondBrain.desktopOnly', {
          defaultValue: 'Verbindungstest nur in der Desktop-App verfügbar.',
        }),
      });
      return;
    }
    const targetUrl = normalizeServerUrl(url) || existingEndpoint.url;
    if (!targetUrl) {
      setTestState({
        tone: 'error',
        text: t('settings.secondBrain.urlRequired', { defaultValue: 'Bitte eine Server-URL angeben.' }),
      });
      return;
    }
    // Use the freshly entered token; in connected state with a blank field, fall
    // back to the stored headers so the user can re-test without re-typing.
    const headers = token.trim() ? { Authorization: `Bearer ${token.trim()}` } : existingEndpoint.headers;
    if (!headers) {
      setTestState({
        tone: 'error',
        text: t('settings.secondBrain.tokenRequired', { defaultValue: 'Bitte ein Zugriffs-Token angeben.' }),
      });
      return;
    }

    setTesting(true);
    setTestState(null);
    const res = await api.listMcpTools({ url: targetUrl, headers });
    setTesting(false);
    if (res.ok) {
      const vaultCapable = serverIsVaultCapable(res.tools);
      setTestState({
        tone: vaultCapable ? 'success' : 'error',
        text: vaultCapable
          ? t('settings.secondBrain.testOkVault', {
              defaultValue: 'Verbunden — {{count}} Tools gefunden, Second-Brain-fähig.',
              count: res.tools.length,
            })
          : t('settings.secondBrain.testOkNoVault', {
              defaultValue: 'Verbunden ({{count}} Tools), aber kein Second-Brain-MCP (list_tree/read_note fehlen).',
              count: res.tools.length,
            }),
      });
    } else {
      const error = 'error' in res ? res.error : '';
      setTestState({
        tone: 'error',
        text: error || t('settings.secondBrain.testFailed', { defaultValue: 'Verbindung fehlgeschlagen.' }),
      });
    }
  };

  const handleSave = async () => {
    const targetUrl = normalizeServerUrl(url) || existingEndpoint.url;
    if (!targetUrl) {
      Message.error(t('settings.secondBrain.urlRequired', { defaultValue: 'Bitte eine Server-URL angeben.' }));
      return;
    }
    const finalName = name.trim() || DEFAULT_SECOND_BRAIN_NAME;
    setSaving(true);
    try {
      if (existing && !token.trim()) {
        // Update without changing the token: keep the stored headers.
        await onUpdate(
          existing,
          buildSecondBrainServerDataKeepingToken({ name: finalName, url: targetUrl, headers: existingEndpoint.headers })
        );
      } else if (!token.trim()) {
        Message.error(t('settings.secondBrain.tokenRequired', { defaultValue: 'Bitte ein Zugriffs-Token angeben.' }));
        setSaving(false);
        return;
      } else {
        const serverData = buildSecondBrainServerData({ name: finalName, url: targetUrl, token });
        if (existing) await onUpdate(existing, serverData);
        else await onConnect(serverData);
      }
      setToken('');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!existing) return;
    await onDisconnect(existing.id);
    setTestState(null);
  };

  return (
    <div className='rounded-12px border border-border-2 bg-2 px-16px py-14px'>
      <div className='flex items-center gap-8px mb-4px'>
        <Brain theme='outline' size={16} className='text-primary-6' />
        <span className='text-14px font-500 text-t-primary'>
          {t('settings.secondBrain.title', { defaultValue: 'Second Brain verbinden' })}
        </span>
        {existing ? (
          <Tag size='small' color='green'>
            {t('settings.secondBrain.connected', { defaultValue: 'Verbunden' })}
          </Tag>
        ) : null}
      </div>
      <div className='text-12px text-t-tertiary mb-12px'>
        {t('settings.secondBrain.description', {
          defaultValue: 'Verbinde deinen Wissensvault über zwei Felder — kein JSON nötig.',
        })}
      </div>

      <div className='flex flex-col gap-10px'>
        <label className='flex flex-col gap-4px'>
          <span className='text-12px text-t-secondary'>
            {t('settings.secondBrain.urlLabel', { defaultValue: 'Server-URL' })}
          </span>
          <Input value={url} onChange={setUrl} placeholder='https://…/mcp' />
        </label>

        <label className='flex flex-col gap-4px'>
          <span className='text-12px text-t-secondary'>
            {t('settings.secondBrain.tokenLabel', { defaultValue: 'Zugriffs-Token' })}
          </span>
          <Input.Password
            value={token}
            onChange={setToken}
            placeholder={
              existing
                ? t('settings.secondBrain.tokenKeepPlaceholder', { defaultValue: 'Leer lassen = unverändert' })
                : t('settings.secondBrain.tokenPlaceholder', { defaultValue: 'Bearer-Token einfügen' })
            }
            autoComplete='off'
          />
        </label>

        <label className='flex flex-col gap-4px'>
          <span className='text-12px text-t-secondary'>
            {t('settings.secondBrain.nameLabel', { defaultValue: 'Anzeigename (optional)' })}
          </span>
          <Input value={name} onChange={setName} placeholder={DEFAULT_SECOND_BRAIN_NAME} />
        </label>

        {testState ? (
          <div className={`text-12px ${testState.tone === 'success' ? 'text-success-6' : 'text-danger-6'}`}>
            {testState.text}
          </div>
        ) : null}

        <div className='flex items-center gap-8px mt-2px'>
          <Button size='small' loading={testing} onClick={() => void handleTest()}>
            {t('settings.secondBrain.test', { defaultValue: 'Verbindung testen' })}
          </Button>
          <Button type='primary' size='small' loading={saving} onClick={() => void handleSave()}>
            {existing
              ? t('settings.secondBrain.update', { defaultValue: 'Aktualisieren' })
              : t('settings.secondBrain.connect', { defaultValue: 'Verbinden' })}
          </Button>
          {existing ? (
            <Popconfirm
              title={t('settings.secondBrain.disconnectConfirm', { defaultValue: 'Second Brain wirklich trennen?' })}
              onOk={() => void handleDisconnect()}
              okText={t('settings.secondBrain.disconnect', { defaultValue: 'Trennen' })}
              cancelText={t('common.cancel', { defaultValue: 'Abbrechen' })}
            >
              <Button status='danger' size='small'>
                {t('settings.secondBrain.disconnect', { defaultValue: 'Trennen' })}
              </Button>
            </Popconfirm>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SecondBrainConnectCard;
