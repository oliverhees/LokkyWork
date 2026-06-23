/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import type { TMessage, IMessageText } from '@/common/chat/chatLib';
import { isErrorTipMessage } from '@/common/chat/chatLib';
import type { TProviderWithModel } from '@/common/config/storage';
import { useLatestRef } from '@/renderer/hooks/ui/useLatestRef';
import { useAddOrUpdateMessage, useMessageList } from '@/renderer/pages/conversation/Messages/hooks';
import { resolveGuidAssistantDefaults } from '@/renderer/pages/guid/utils/assistantDefaults';
import { getAllAssistantMentions, type AssistantMentionSource } from '@/renderer/utils/chat/assistantMentionQuery';
import {
  buildMentionQuestion,
  MENTION_BLOCKS_EXTRA_KEY,
  parseGuestBlocks,
  upsertGuestBlock,
  type GuestBlock,
  type MentionContextMessage,
} from '@/renderer/utils/chat/assistantMentionOrchestration';
import { useCallback } from 'react';

/** An assistant that can be @-mentioned, with enough info to spawn a sub-conversation. */
export type MentionableAssistant = AssistantMentionSource & {
  /** Preset agent type, e.g. 'aionrs' | 'gemini' | 'claude' (ACP). Drives sub-conversation type. */
  preset_agent_type?: string;
  /** Short description (no longer injected — the real system prompt carries identity). */
  description?: string;
};

type UseAssistantMentionResponderOptions = {
  conversation_id: string;
  /** Baseline model for the sub-conversation (required by conversation.create). */
  model: TProviderWithModel | undefined;
  workspace?: string;
  localeKey: string;
  /** Localized labels for transient block states. */
  t: (key: string, options?: { defaultValue: string; name?: string }) => string;
};

/** How long to wait for the mentioned assistant's turn before giving up. */
const MENTION_TURN_TIMEOUT_MS = 60_000;

/** Build the lightweight transcript the sub-assistant sees as context. */
function toContextMessages(messages: TMessage[], conversation_id: string): MentionContextMessage[] {
  const result: MentionContextMessage[] = [];
  for (const message of messages) {
    if (message.conversation_id !== conversation_id) continue;
    if (message.type !== 'text' || message.hidden) continue;
    const text = (message as IMessageText).content?.content;
    if (typeof text !== 'string' || !text.trim()) continue;
    result.push({ role: message.position === 'right' ? 'user' : 'assistant', text });
  }
  return result;
}

/** Pull the text chunk out of a streamed response message (string or {content}). */
function extractChunk(message: IResponseMessage): string {
  const payload = (message as { data?: unknown }).data;
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object' && 'content' in payload) {
    const inner = (payload as { content?: unknown }).content;
    if (typeof inner === 'string') return inner;
  }
  return '';
}

/**
 * Run one real assistant turn in the (hidden) sub-conversation: send the question
 * and accumulate the streamed reply until `finish`/`error`/timeout. Mirrors the
 * stream handling in useAionrsMessage but headless, scoped to `subId`.
 */
function runAssistantTurn(
  subId: string,
  question: string,
  onPartial: (partial: string) => void
): Promise<{ ok: boolean; answer: string }> {
  return new Promise((resolve) => {
    let buffer = '';
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    let unsubscribe: () => void = () => undefined;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve({ ok: ok && buffer.trim().length > 0, answer: buffer.trim() });
    };

    unsubscribe = ipcBridge.conversation.responseStream.on((message) => {
      if (message.conversation_id !== subId) return;
      if (isErrorTipMessage(message) || message.type === 'error') {
        finish(false);
        return;
      }
      if (message.type === 'content' || message.type === 'text') {
        const chunk = extractChunk(message);
        if (chunk) {
          buffer += chunk;
          onPartial(buffer);
        }
        return;
      }
      if (message.type === 'finish') {
        finish(true);
      }
    });

    timer = setTimeout(() => finish(true), MENTION_TURN_TIMEOUT_MS);
    void ipcBridge.conversation.sendMessage
      .invoke({ input: question, conversation_id: subId, files: [] })
      .catch(() => finish(false));
  });
}

/**
 * Orchestrates @-mention sub-answers (CODE-46/47/48). Returns a `respond`
 * callback to invoke right after a message containing `@assistant` mentions is
 * sent. For each distinct mentioned assistant it shows a live guest block, runs
 * a REAL turn with that assistant in a throwaway sub-conversation (created the
 * same way GuidPage/useGuidSend does, so the assistant's own system prompt /
 * persona applies), streams the answer into the block, then persists it to the
 * main conversation's `extra` so it survives a reload.
 *
 * Backend (aioncore) is untouched — pure renderer orchestration over existing APIs.
 * aionrs-only for now; ACP-type assistants get a graceful fallback.
 */
export function useAssistantMentionResponder({
  conversation_id,
  model,
  workspace,
  localeKey,
  t,
}: UseAssistantMentionResponderOptions) {
  const addOrUpdateMessage = useAddOrUpdateMessage();
  const messageList = useMessageList();
  const messageListRef = useLatestRef(messageList);

  const persistBlock = useCallback(
    async (block: GuestBlock) => {
      try {
        const current = await ipcBridge.conversation.get.invoke({ id: conversation_id });
        const existing = parseGuestBlocks(current?.extra);
        const next = upsertGuestBlock(existing, block);
        await ipcBridge.conversation.update.invoke({
          id: conversation_id,
          updates: { extra: { [MENTION_BLOCKS_EXTRA_KEY]: next } as Record<string, unknown> },
          merge_extra: true,
        });
      } catch (error) {
        console.warn('[assistantMention] Failed to persist guest block:', error);
      }
    },
    [conversation_id]
  );

  const runOne = useCallback(
    async (assistant: MentionableAssistant, userText: string) => {
      if (!model?.use_model) {
        return;
      }
      const blockId = `mention-${conversation_id}-${assistant.id}-${messageListRef.current.length}-${Math.round(performance.now())}`;
      const anchorMsgId =
        [...messageListRef.current].toReversed().find((m) => m.conversation_id === conversation_id && m.msg_id)
          ?.msg_id ?? null;

      const baseContent = {
        teammateMessage: true as const,
        senderName: assistant.name,
        senderAgentType: assistant.preset_agent_type,
      };
      const makeBlock = (content: string, status: 'pending' | 'finish' | 'error'): IMessageText => ({
        id: blockId,
        msg_id: blockId,
        conversation_id,
        type: 'text',
        position: 'left',
        status,
        created_at: Date.now(),
        content: { ...baseContent, content },
      });

      // Empty pending block → MessageText renders a typing indicator until the
      // first streamed token arrives (then onPartial fills in the real text).
      addOrUpdateMessage(makeBlock('', 'pending') as TMessage, true);

      // ACP-type assistants run on an external engine; the headless aionrs sub-turn
      // doesn't cover them yet → graceful fallback instead of a generic answer.
      if ((assistant.preset_agent_type ?? 'aionrs') !== 'aionrs') {
        addOrUpdateMessage(
          makeBlock(
            t('conversation.assistantMention.externalEngine', {
              defaultValue:
                'Dieser Assistent läuft über eine externe Engine — sprich ihn am besten in einem eigenen Chat an.',
            }),
            'error'
          ) as TMessage,
          false
        );
        return;
      }

      const recent = toContextMessages(messageListRef.current, conversation_id);
      const question = buildMentionQuestion(recent, userText, [assistant]);

      let subId: string | null = null;
      let ok = false;
      let answer = '';
      try {
        // Create the sub-conversation exactly like useGuidSend's aionrs path so
        // aioncore applies the assistant's own rules/persona (conversation_overrides
        // + extra.preset_assistant_id are what the bare create was missing).
        const detail = await ipcBridge.assistants.get
          .invoke({ id: assistant.id, locale: localeKey })
          .catch((): null => null);
        const defaults = resolveGuidAssistantDefaults(detail);
        const conversation_overrides = {
          model: defaults.modelId || model.use_model,
          permission: defaults.permissionMode,
          skill_ids: defaults.skillIds,
          disabled_builtin_skill_ids: defaults.disabledBuiltinSkillIds,
          mcp_ids: defaults.mcpIds,
        };
        const sub = await ipcBridge.conversation.create.invoke({
          type: 'aionrs',
          name: `@${assistant.name}`,
          model,
          assistant: { id: assistant.id, locale: localeKey, conversation_overrides },
          extra: { workspace, preset_assistant_id: assistant.id, session_mode: defaults.permissionMode },
        });
        subId = sub?.id ?? null;
        if (subId) {
          // Warm up the sub-conversation first — this is how the normal chat UI
          // builds the agent WITH the assistant's loaded config (rules/skills)
          // before the first turn. Headless sendMessage alone skipped it, which
          // left the persona unapplied (generic base-agent answer).
          await ipcBridge.conversation.warmup.invoke({ conversation_id: subId }).catch((): void => undefined);
          const result = await runAssistantTurn(subId, question, (partial) => {
            addOrUpdateMessage(makeBlock(partial, 'pending') as TMessage, false);
          });
          ok = result.ok;
          answer = result.answer;
        }
      } catch (error) {
        console.warn('[assistantMention] Sub-answer failed:', error);
      } finally {
        if (subId) {
          // Throwaway sub-conversation: remove so it never clutters history.
          void ipcBridge.conversation.remove.invoke({ id: subId }).catch((): void => undefined);
        }
      }

      if (!answer) {
        answer = t('conversation.assistantMention.noAnswer', {
          defaultValue: 'Keine Antwort erhalten. Versuch es in einem eigenen Chat mit diesem Assistenten.',
        });
      }
      addOrUpdateMessage(makeBlock(answer, ok ? 'finish' : 'error') as TMessage, false);
      void persistBlock({
        id: blockId,
        anchorMsgId,
        assistantId: assistant.id,
        senderName: assistant.name,
        senderAgentType: assistant.preset_agent_type,
        content: answer,
        createdAt: Date.now(),
      });
    },
    [addOrUpdateMessage, conversation_id, localeKey, messageListRef, model, persistBlock, t, workspace]
  );

  return useCallback(
    async (userText: string, assistants: MentionableAssistant[]) => {
      const mentions = getAllAssistantMentions(userText, assistants);
      if (mentions.length === 0) return;
      const seen = new Set<string>();
      for (const mention of mentions) {
        if (seen.has(mention.assistantId)) continue;
        seen.add(mention.assistantId);
        const assistant = assistants.find((item) => item.id === mention.assistantId);
        if (assistant) {
          await runOne(assistant, userText);
        }
      }
    },
    [runOne]
  );
}
