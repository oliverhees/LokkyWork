/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import type { TMessage, IMessageText } from '@/common/chat/chatLib';
import { applyAssistantDeOverrides } from '@renderer/utils/assistant/assistantDeOverrides';
import { useMessageListLoading, useUpdateMessageList } from '@/renderer/pages/conversation/Messages/hooks';
import { parseGuestBlocks, type GuestBlock } from '@/renderer/utils/chat/assistantMentionOrchestration';
import type { MentionableAssistant } from './useAssistantMentionResponder';
import { useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';

/**
 * Loads the preset-assistant catalog and maps it to the @-mention source list,
 * excluding the chat's own assistant (you don't mention yourself). Shares the
 * `assistants.list` SWR cache with the rest of the app.
 */
export function useMentionableAssistants(localeKey: string, excludeAssistantId?: string): MentionableAssistant[] {
  const { data } = useSWR('assistants.list', async () => {
    try {
      return applyAssistantDeOverrides(await ipcBridge.assistants.list.invoke());
    } catch (error) {
      console.error('[assistantMention] Failed to load assistants:', error);
      return [] as Assistant[];
    }
  });

  return useMemo(() => {
    const stripBuiltin = (id: string) => id.replace(/^builtin-/, '');
    const excluded = excludeAssistantId ? new Set([excludeAssistantId, stripBuiltin(excludeAssistantId)]) : null;
    return (data ?? [])
      .filter((assistant) => assistant.enabled !== false)
      .filter((assistant) => !excluded || (!excluded.has(assistant.id) && !excluded.has(stripBuiltin(assistant.id))))
      .map((assistant) => ({
        id: assistant.id,
        name: assistant.name_i18n?.[localeKey] || assistant.name,
        preset_agent_type: assistant.preset_agent_type,
        description: assistant.description_i18n?.[localeKey] || assistant.description || undefined,
      }));
  }, [data, excludeAssistantId, localeKey]);
}

const guestBlockToMessage = (block: GuestBlock): IMessageText => ({
  id: block.id,
  msg_id: block.id,
  conversation_id: '',
  type: 'text',
  position: 'left',
  status: 'finish',
  created_at: block.createdAt,
  content: {
    content: block.content,
    teammateMessage: true,
    senderName: block.senderName,
    senderAgentType: block.senderAgentType,
  },
});

/**
 * Re-injects persisted @-mention guest blocks (CODE-48) after the conversation
 * history loads. aioncore doesn't store these blocks, so we read them from the
 * conversation `extra` and splice each one in right after its anchor message.
 * Runs once per conversation load; blocks already present (live session) are skipped.
 */
export function useReinjectGuestBlocks(conversation_id: string): void {
  const loading = useMessageListLoading();
  const update = useUpdateMessageList();
  const reinjectedRef = useRef<string | null>(null);

  useEffect(() => {
    reinjectedRef.current = null;
  }, [conversation_id]);

  useEffect(() => {
    if (!conversation_id || loading) return;
    if (reinjectedRef.current === conversation_id) return;
    reinjectedRef.current = conversation_id;

    let cancelled = false;
    void ipcBridge.conversation.get
      .invoke({ id: conversation_id })
      .then((conversation) => {
        if (cancelled) return;
        const blocks = parseGuestBlocks(conversation?.extra).toSorted((a, b) => a.createdAt - b.createdAt);
        if (blocks.length === 0) return;
        update((list) => {
          const present = new Set(list.map((message) => message.id));
          let next = list;
          for (const block of blocks) {
            if (present.has(block.id)) continue;
            const message = { ...guestBlockToMessage(block), conversation_id } as TMessage;
            const anchorIndex = block.anchorMsgId ? next.findIndex((item) => item.msg_id === block.anchorMsgId) : -1;
            if (anchorIndex >= 0) {
              next = [...next.slice(0, anchorIndex + 1), message, ...next.slice(anchorIndex + 1)];
            } else {
              next = [...next, message];
            }
            present.add(block.id);
          }
          return next;
        });
      })
      .catch((error) => {
        if (!cancelled) console.warn('[assistantMention] Failed to re-inject guest blocks:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [conversation_id, loading, update]);
}
