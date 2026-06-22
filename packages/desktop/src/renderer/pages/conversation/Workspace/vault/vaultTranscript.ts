/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Build a Markdown transcript of a whole conversation for the "Merken" action
 * (CODE-53). Mirrors the visibility rules of `toContextMessages`: only visible
 * text messages count — hidden, non-text, tool-result and empty messages are
 * dropped. Each kept message is cleaned (think tags, skill-suggest blocks and
 * the file marker stripped) and rendered with a role label. Pure string work,
 * no React/IO — unit-testable.
 */

import type { IMessageText, TMessage } from '@/common/chat/chatLib';
import { AIONUI_FILES_MARKER } from '@/common/config/constants';
import { hasThinkTags, stripThinkTags } from '@/renderer/utils/chat/thinkTagFilter';
import { hasSkillSuggest, stripSkillSuggest } from '@/renderer/utils/chat/skillSuggestParser';

export type TranscriptEntry = { role: 'user' | 'assistant'; text: string };

/** Strip the file marker, think tags and skill-suggest blocks from a message. */
function cleanMessageText(raw: string): string {
  let text = raw;
  const markerIndex = text.indexOf(AIONUI_FILES_MARKER);
  if (markerIndex !== -1) text = text.slice(0, markerIndex);
  if (hasThinkTags(text)) text = stripThinkTags(text);
  if (hasSkillSuggest(text)) text = stripSkillSuggest(text);
  return text.trim();
}

/**
 * Reduce a raw message list to ordered, cleaned transcript entries. Same filter
 * as the @-mention context builder so what gets saved matches what the user
 * sees: only this conversation's visible, non-empty text messages.
 */
export function extractTranscriptEntries(messages: TMessage[], conversation_id: string): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  for (const message of messages) {
    if (message.conversation_id !== conversation_id) continue;
    if (message.type !== 'text' || message.hidden) continue;
    const raw = (message as IMessageText).content?.content;
    if (typeof raw !== 'string') continue;
    const text = cleanMessageText(raw);
    if (!text) continue;
    entries.push({ role: message.position === 'right' ? 'user' : 'assistant', text });
  }
  return entries;
}

/** Render transcript entries as Markdown, each prefixed with a bold role label. */
export function buildChatTranscript(
  entries: TranscriptEntry[],
  labels: { userLabel: string; assistantLabel: string }
): string {
  return entries
    .map((entry) => `**${entry.role === 'user' ? labels.userLabel : labels.assistantLabel}:**\n\n${entry.text}`)
    .join('\n\n');
}

/** First user message text, used to derive a default note title when needed. */
export function firstUserText(entries: TranscriptEntry[]): string {
  return entries.find((entry) => entry.role === 'user')?.text ?? '';
}
