/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tag } from '@arco-design/web-react';
import { configService } from '@/common/config/configService';

/**
 * Global, always-visible badge shown whenever the PII proxy is active (CODE-26).
 * Clicking it jumps to the system settings to manage/disable it. Stays in sync via
 * configService.subscribe — the settings toggle's `set` notifies subscribers.
 */
const PiiProxyIndicator: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
      className='fixed top-40px left-1/2 -translate-x-1/2 z-1000 cursor-pointer select-none'
    >
      <Tag color='green' bordered>
        🛡️ {t('settings.pii.indicatorLabel', { defaultValue: 'PII-Schutz aktiv' })}
      </Tag>
    </div>
  );
};

export default PiiProxyIndicator;
