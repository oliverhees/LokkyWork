/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import styles from '../index.module.css';
import type { AvailableAgent, EffectiveAgentInfo } from '../types';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import type { AssistantDetail } from '@/common/types/agent/assistantTypes';
import { Message } from '@arco-design/web-react';
import React, { useCallback, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

type AssistantSelectionAreaProps = {
  is_presetAgent: boolean;
  selectedAgentKey?: string;
  selectedAgentInfo: AvailableAgent | undefined;
  /**
   * Backend-merged preset catalog. Drives the selected-preset prompt examples.
   * The full assistant grid now lives on the dedicated /assistants overview
   * page (CODE-36); this component only renders the prompt hints for the
   * currently selected preset assistant.
   */
  assistants: Assistant[];
  selectedAssistantDetail?: AssistantDetail | null;
  localeKey: string;
  currentEffectiveAgentInfo: EffectiveAgentInfo;
  onSetInput: (text: string) => void;
  onFocusInput: () => void;
  onRegisterOpenDetails?: (openDetails: (() => void) | null) => void;
};

const resolveAssistantCandidateIds = (assistantId: string): string[] => {
  const stripped = assistantId.replace(/^builtin-/, '');
  return Array.from(new Set([assistantId, `builtin-${stripped}`, stripped]));
};

const OPEN_ASSISTANT_EDITOR_INTENT_KEY = 'guid.openAssistantEditorIntent';

const AssistantSelectionArea: React.FC<AssistantSelectionAreaProps> = ({
  is_presetAgent,
  selectedAgentKey,
  selectedAgentInfo,
  assistants,
  selectedAssistantDetail,
  localeKey,
  currentEffectiveAgentInfo,
  onSetInput,
  onFocusInput,
  onRegisterOpenDetails,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [agentMessage, agentMessageContext] = Message.useMessage({ maxCount: 10 });

  const resolveOpenAssistantId = (): string | null => {
    if (selectedAgentInfo?.custom_agent_id) return selectedAgentInfo.custom_agent_id;
    if (selectedAgentKey?.startsWith('custom:')) return selectedAgentKey.slice(7);
    return null;
  };

  const openAssistantDetails = useCallback(() => {
    const assistantId = resolveOpenAssistantId();
    if (!assistantId) {
      agentMessage.warning(
        t('common.failed', { defaultValue: 'Failed' }) +
          `: ${t('settings.editAssistant', { defaultValue: 'Assistant Details' })}`
      );
      return;
    }

    const candidates = resolveAssistantCandidateIds(assistantId);
    // `assistants` is the backend-merged catalog (builtin + user)
    // and is the only list that yields the Assistant shape the editor expects.
    const targetAssistant = assistants.find((assistant) => candidates.includes(assistant.id));
    if (!targetAssistant) {
      agentMessage.warning(
        t('common.failed', { defaultValue: 'Failed' }) +
          `: ${t('settings.editAssistant', { defaultValue: 'Assistant Details' })}`
      );
      return;
    }

    const intent = {
      assistantId: targetAssistant.id,
      openAssistantEditor: true,
    };

    try {
      sessionStorage.setItem(OPEN_ASSISTANT_EDITOR_INTENT_KEY, JSON.stringify(intent));
    } catch (error) {
      console.error('[AssistantSelectionArea] Failed to persist assistant open intent:', error);
    }

    navigate('/settings/assistants', {
      state: {
        openAssistantId: targetAssistant.id,
        openAssistantEditor: true,
      },
    });
  }, [agentMessage, assistants, navigate, selectedAgentInfo?.custom_agent_id, selectedAgentKey, t]);

  useLayoutEffect(() => {
    if (!onRegisterOpenDetails) return;
    onRegisterOpenDetails(openAssistantDetails);
  }, [onRegisterOpenDetails, openAssistantDetails]);

  // Render only the prompt hints, and only when a preset assistant is selected.
  // The assistant grid moved to the dedicated /assistants overview page (CODE-36).
  if (!assistants || assistants.length === 0) return null;
  if (!is_presetAgent || !selectedAgentInfo) return null;

  return (
    <div className='mt-20px w-full'>
      {agentMessageContext}
      <div className='flex flex-col w-full animate-fade-in'>
        {/* Main Agent Fallback Notice */}
        {currentEffectiveAgentInfo.isFallback && (
          <div
            className='mb-12px px-12px py-8px rd-8px text-12px flex items-center gap-8px'
            style={{
              background: 'rgb(var(--warning-1))',
              border: '1px solid rgb(var(--warning-3))',
              color: 'rgb(var(--warning-6))',
            }}
          >
            <span>
              {t('guid.agentFallbackNotice', {
                original:
                  currentEffectiveAgentInfo.originalType.charAt(0).toUpperCase() +
                  currentEffectiveAgentInfo.originalType.slice(1),
                fallback:
                  currentEffectiveAgentInfo.agent_type.charAt(0).toUpperCase() +
                  currentEffectiveAgentInfo.agent_type.slice(1),
                defaultValue: `${currentEffectiveAgentInfo.originalType.charAt(0).toUpperCase() + currentEffectiveAgentInfo.originalType.slice(1)} is unavailable, using ${currentEffectiveAgentInfo.agent_type.charAt(0).toUpperCase() + currentEffectiveAgentInfo.agent_type.slice(1)} instead.`,
              })}
            </span>
          </div>
        )}
        {/* Prompts Section */}
        {(() => {
          const agent = assistants.find((a) => a.id === selectedAgentInfo.custom_agent_id);
          const prompts =
            selectedAssistantDetail?.prompts.recommended_i18n?.[localeKey] ||
            selectedAssistantDetail?.prompts.recommended_i18n?.['en-US'] ||
            selectedAssistantDetail?.prompts.recommended ||
            agent?.prompts_i18n?.[localeKey] ||
            agent?.prompts_i18n?.['en-US'] ||
            agent?.prompts;
          if (prompts && prompts.length > 0) {
            return (
              <div className='mt-16px'>
                <div className={styles.assistantPromptHint}>
                  {t('guid.promptExamplesHint', { defaultValue: 'Try these example prompts:' })}
                </div>
                <div className='flex flex-wrap gap-8px mt-12px'>
                  {prompts.map((prompt: string, index: number) => (
                    <div
                      key={index}
                      className={`${styles.assistantPromptChip} px-12px py-6px text-2 text-13px rd-16px cursor-pointer transition-colors shadow-sm`}
                      onClick={() => {
                        onSetInput(prompt);
                        onFocusInput();
                      }}
                    >
                      {prompt}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
};

export default AssistantSelectionArea;
