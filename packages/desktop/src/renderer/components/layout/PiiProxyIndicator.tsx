/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { configService } from '@/common/config/configService';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';

/**
 * Global PII-proxy status badge shown whenever the PII proxy is active (CODE-26).
 * Rendered inline in the Titlebar toolbar (just before the feedback button), so it
 * never overlays the chat content the way the previous centered absolute overlay did.
 * Clicking it jumps to the system settings to manage/disable it. Stays in sync via
 * configService.subscribe — the settings toggle's `set` notifies subscribers.
 * On mobile the label collapses to the shield glyph alone to keep the toolbar compact.
 */
const PiiProxyIndicator: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const [active, setActive] = useState<boolean>(() => configService.get('pii.proxyEnabled') ?? false);

  useEffect(() => {
    setActive(configService.get('pii.proxyEnabled') ?? false);
    return configService.subscribe('pii.proxyEnabled', (value) => setActive(value === true));
  }, []);

  if (!active) return null;

  const goToSettings = () => navigate('/settings/system');

  return (
    <div
      role='button'
      tabIndex={0}
      onClick={goToSettings}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToSettings();
        }
      }}
      title={t('settings.pii.indicatorTooltip', {
        defaultValue: 'PII-Schutz ist aktiv — klicken, um ihn zu verwalten',
      })}
      className='inline-flex items-center shrink-0 cursor-pointer select-none'
    >
      <div className='flex items-center gap-4px pl-8px pr-10px py-3px rd-full text-12px font-medium leading-none transition-opacity duration-150 hover:opacity-90 bg-[var(--color-success-light-1)] text-white border border-solid border-[var(--color-success-light-3)]'>
        <span className='text-13px leading-none'>🛡️</span>
        {!isMobile && <span>{t('settings.pii.indicatorLabel', { defaultValue: 'PII-Schutz aktiv' })}</span>}
      </div>
    </div>
  );
};

export default PiiProxyIndicator;
