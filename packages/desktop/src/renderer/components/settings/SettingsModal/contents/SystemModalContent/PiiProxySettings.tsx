/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Button, Message, Modal, Switch } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { configService } from '@/common/config/configService';
import { ipcBridge } from '@/common';
import { buildProxyBaseUrl, decodeProxyBaseUrl, isProxyBaseUrl } from '@/common/pii/piiProxyShared';
import { createPiiMapping, scrubText } from '@/common/pii/piiScrubber';

type ElectronApiWithProxy = {
  syncPiiProxy?: (enabled: boolean) => Promise<{ ok: boolean; error?: string }>;
  runPiiSelfTest?: () => Promise<{ ok: boolean; error?: string; result?: unknown }>;
};

function getProxyApi(): ElectronApiWithProxy | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { electronAPI?: ElectronApiWithProxy }).electronAPI;
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

const SELF_TEST_INPUT =
  'Hallo, ich bin Max Mustermann. Meine IBAN ist DE89 3704 0044 0532 0130 00, ' +
  'erreichbar unter max@example.de oder +49 170 1234567. ' +
  'USt-IdNr DE123456789, Kreditkarte 4111 1111 1111 1111.';

type DetectedItem = { kind: string; value: string; placeholder: string };
type TestResult = {
  mode: 'e2e' | 'local';
  input: string;
  sentToProvider: string;
  modelReply?: string;
  restoredReply?: string;
  detected: DetectedItem[];
};

const PiiProxySettings: React.FC = () => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testVisible, setTestVisible] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    setEnabled(configService.get('pii.proxyEnabled') ?? false);
  }, []);

  const handleToggle = async (next: boolean) => {
    setLoading(true);
    try {
      const sync = getProxyApi()?.syncPiiProxy;
      if (next) {
        const res = await sync?.(true);
        if (res && !res.ok) throw new Error(res.error || 'proxy start failed');
        await rewriteProviderBaseUrls(true);
      } else {
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

  const localFallbackResult = (): TestResult => {
    const mapping = createPiiMapping();
    const sentToProvider = scrubText(SELF_TEST_INPUT, mapping);
    const detected: DetectedItem[] = [...mapping.byPlaceholder.entries()].map(([placeholder, value]) => ({
      kind: placeholder.match(/\[([A-Z]+)_/)?.[1] ?? '?',
      value,
      placeholder,
    }));
    return { mode: 'local', input: SELF_TEST_INPUT, sentToProvider, detected };
  };

  const runSelfTest = async () => {
    setTesting(true);
    try {
      // Prefer the real end-to-end test through the running proxy.
      const res = await getProxyApi()?.runPiiSelfTest?.();
      if (res?.ok && res.result) {
        const r = res.result as Omit<TestResult, 'mode'>;
        setTestResult({ mode: 'e2e', ...r });
      } else {
        // Proxy off (or unavailable) — fall back to a local detection check.
        setTestResult(localFallbackResult());
      }
      setTestVisible(true);
    } catch {
      setTestResult(localFallbackResult());
      setTestVisible(true);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className='flex items-start justify-between gap-16px'>
      <div className='flex-1'>
        <div className='text-14px text-2'>
          {t('settings.pii.title', { defaultValue: 'PII-Schutz (Anonymisierung)' })}
        </div>
        <div className='text-12px text-[var(--color-text-3)] mt-4px'>
          {t('settings.pii.description', {
            defaultValue:
              'Erkennt sensible Daten (IBAN, E-Mail, Telefon …) und ersetzt sie lokal durch Platzhalter, bevor deine Nachricht an ein KI-Modell geht. Die Antwort wird automatisch zurückübersetzt.',
          })}
        </div>
        <div className='flex items-start gap-8px mt-8px px-10px py-8px rd-6px bg-[var(--color-warning-light-1)] border border-solid border-[var(--color-warning-light-3)]'>
          <span className='text-13px shrink-0 leading-tight'>⚠️</span>
          <div className='text-11px text-2 leading-relaxed'>
            {t('settings.pii.disclaimer', {
              defaultValue:
                'Hinweis: Die Erkennung erfolgt automatisch nach bestem Wissen und kann keine vollständige Anonymisierung garantieren — z. B. werden Namen, Adressen oder Daten in Anhängen nicht zwingend erkannt. Prüfe besonders sensible Inhalte vor dem Senden selbst. Dies ist keine Rechts- oder Datenschutzberatung; die Verantwortung für gesendete Daten bleibt bei dir.',
            })}
          </div>
        </div>
        <Button type='secondary' loading={testing} className='mt-10px' onClick={runSelfTest}>
          {t('settings.pii.selfTest', { defaultValue: '🔍 Schutz testen' })}
        </Button>
      </div>
      <Switch checked={enabled} loading={loading} onChange={handleToggle} />

      <Modal
        title={t('settings.pii.selfTestTitle', { defaultValue: 'PII-Schutz — Selbsttest' })}
        visible={testVisible}
        onCancel={() => setTestVisible(false)}
        footer={
          <Button type='primary' onClick={() => setTestVisible(false)}>
            {t('common.close', { defaultValue: 'Schließen' })}
          </Button>
        }
        style={{ width: 660 }}
      >
        {testResult && (
          <div className='flex flex-col gap-12px text-13px'>
            <div
              className={`px-10px py-6px rd-6px text-12px font-medium ${
                testResult.mode === 'e2e'
                  ? 'bg-[var(--color-success-light-1)] text-[var(--color-success-6)]'
                  : 'bg-[var(--color-warning-light-1)] text-[var(--color-warning-6)]'
              }`}
            >
              {testResult.mode === 'e2e'
                ? t('settings.pii.selfTestE2e', {
                    defaultValue: '✅ End-to-End durch den aktiven Proxy — die ganze Kette läuft.',
                  })
                : t('settings.pii.selfTestLocal', {
                    defaultValue: 'ℹ️ PII-Schutz ist AUS — nur die Erkennung wurde lokal getestet.',
                  })}
            </div>

            <div>
              <div className='text-12px text-[var(--color-text-3)] mb-4px'>
                {t('settings.pii.selfTestInputLabel', { defaultValue: 'Beispiel-Eingabe' })}
              </div>
              <div className='p-8px rd-6px bg-[var(--color-fill-2)] whitespace-pre-wrap'>{testResult.input}</div>
            </div>

            <div>
              <div className='text-12px text-[var(--color-text-3)] mb-4px'>
                {t('settings.pii.selfTestOutputLabel', { defaultValue: 'Das sieht der KI-Anbieter (anonymisiert)' })}
              </div>
              <div className='p-8px rd-6px bg-[var(--color-success-light-1)] text-[var(--color-text-1)] whitespace-pre-wrap'>
                {testResult.sentToProvider}
              </div>
            </div>

            {testResult.mode === 'e2e' && testResult.restoredReply && (
              <div>
                <div className='text-12px text-[var(--color-text-3)] mb-4px'>
                  {t('settings.pii.selfTestRestoredLabel', {
                    defaultValue: 'Antwort zurück bei dir (zurückübersetzt)',
                  })}
                </div>
                <div className='p-8px rd-6px bg-[var(--color-fill-2)] whitespace-pre-wrap'>
                  {testResult.restoredReply}
                </div>
              </div>
            )}

            <div>
              <div className='text-12px text-[var(--color-text-3)] mb-6px'>
                {t('settings.pii.selfTestDetectedLabel', {
                  defaultValue: '{{count}} sensible Werte erkannt und ersetzt',
                  count: testResult.detected.length,
                })}
              </div>
              <div className='flex flex-col gap-4px'>
                {testResult.detected.map((d) => (
                  <div key={d.placeholder} className='flex items-center gap-8px'>
                    <span className='shrink-0 px-6px py-1px rd-4px text-11px font-medium bg-[var(--color-success-light-2)] text-[var(--color-success-6)]'>
                      {d.kind}
                    </span>
                    <span className='font-mono text-12px text-[var(--color-text-2)] truncate'>{d.value}</span>
                    <span className='text-[var(--color-text-3)]'>→</span>
                    <span className='font-mono text-12px text-[var(--color-success-6)]'>{d.placeholder}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PiiProxySettings;
