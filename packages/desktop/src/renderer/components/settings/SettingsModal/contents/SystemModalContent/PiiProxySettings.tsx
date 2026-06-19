/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Message, Switch } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { configService } from '@/common/config/configService';
import { ipcBridge } from '@/common';
import { buildProxyBaseUrl, decodeProxyBaseUrl, isProxyBaseUrl } from '@/common/pii/piiProxyShared';

type ElectronApiWithProxy = {
  syncPiiProxy?: (enabled: boolean) => Promise<{ ok: boolean; error?: string }>;
};

function getSyncPiiProxy(): ElectronApiWithProxy['syncPiiProxy'] | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { electronAPI?: ElectronApiWithProxy }).electronAPI?.syncPiiProxy;
}

/**
 * Rewrite every provider's base_url to (or from) the local PII proxy. The proxy
 * encodes the real URL into its path, so toggling off is fully reversible.
 */
async function rewriteProviderBaseUrls(enable: boolean): Promise<void> {
  const providers = (await ipcBridge.mode.listProviders.invoke()) ?? [];
  for (const provider of providers) {
    const baseUrl = provider.base_url;
    if (!baseUrl) continue; // native providers without a base_url
    if (enable) {
      if (isProxyBaseUrl(baseUrl) || !/^https?:\/\//.test(baseUrl)) continue;
      await ipcBridge.mode.updateProvider.invoke({ id: provider.id, base_url: buildProxyBaseUrl(baseUrl) });
    } else {
      const real = decodeProxyBaseUrl(baseUrl);
      if (real) await ipcBridge.mode.updateProvider.invoke({ id: provider.id, base_url: real });
    }
  }
}

const PiiProxySettings: React.FC = () => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEnabled(configService.get('pii.proxyEnabled') ?? false);
  }, []);

  const handleToggle = async (next: boolean) => {
    setLoading(true);
    try {
      const sync = getSyncPiiProxy();
      if (next) {
        // Start the proxy first, then point providers at it.
        const res = await sync?.(true);
        if (res && !res.ok) throw new Error(res.error || 'proxy start failed');
        await rewriteProviderBaseUrls(true);
      } else {
        // Restore real base_urls first, then stop the proxy.
        await rewriteProviderBaseUrls(false);
        await sync?.(false);
      }
      configService.set('pii.proxyEnabled', next);
      setEnabled(next);
      Message.success(
        next
          ? t('settings.pii.enabledToast', {
              defaultValue: 'PII-Schutz aktiviert — sensible Daten werden vor dem Versand anonymisiert.',
            })
          : t('settings.pii.disabledToast', { defaultValue: 'PII-Schutz deaktiviert.' })
      );
    } catch (error) {
      Message.error(
        t('settings.pii.toggleError', { defaultValue: 'PII-Schutz konnte nicht umgeschaltet werden.' }) +
          ` (${String(error)})`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex items-start justify-between gap-16px'>
      <div className='flex-1'>
        <div className='font-medium'>{t('settings.pii.title', { defaultValue: 'PII-Schutz (Anonymisierung)' })}</div>
        <div className='text-12px text-[var(--color-text-3)] mt-4px'>
          {t('settings.pii.description', {
            defaultValue:
              'Erkennt sensible Daten (IBAN, E-Mail, Telefon …) und ersetzt sie lokal durch Platzhalter, bevor deine Nachricht an ein KI-Modell geht. Die Antwort wird automatisch zurückübersetzt.',
          })}
        </div>
      </div>
      <Switch checked={enabled} loading={loading} onChange={handleToggle} />
    </div>
  );
};

export default PiiProxySettings;
