/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure logic for the @-mention sub-answer feature (CODE-46/47/48).
 *
 * The running chat is owned by aioncore (unchangeable backend), so a mentioned
 * assistant cannot natively post into it. Instead the renderer orchestrates a
 * sub-answer: it builds a context prompt from the recent transcript, asks the
 * mentioned assistant via a hidden sub-conversation (askSideQuestion), then
 * injects the answer as a teammate-style guest block and persists it into the
 * main conversation's `extra` so it survives a reload.
 *
 * This module holds only the deterministic pieces (prompt building, mention
 * stripping, guest-block (de)serialization); all I/O lives in the hook.
 */

import { getAllAssistantMentions, type AssistantMentionSource } from './assistantMentionQuery';

/** Minimal transcript entry used to build the context prompt. */
export type MentionContextMessage = {
  role: 'user' | 'assistant';
  text: string;
};

/** How many recent transcript messages to include as context. */
export const MENTION_CONTEXT_LIMIT = 12;
/** Hard cap per included message so the prompt stays bounded. */
const MENTION_MESSAGE_MAX_CHARS = 800;

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/** Remove resolved `@slug` assistant tokens from the user's text. */
export function stripAssistantMentionTokens(text: string, assistants: AssistantMentionSource[]): string {
  const matches = getAllAssistantMentions(text, assistants);
  if (matches.length === 0) return text.trim();
  let result = '';
  let cursor = 0;
  for (const match of matches) {
    result += text.slice(cursor, match.start);
    cursor = match.end;
  }
  result += text.slice(cursor);
  return result.replace(/\s{2,}/g, ' ').trim();
}

/** Identity of the mentioned assistant, injected so it answers in character. */
export type MentionPersona = {
  name: string;
  description?: string;
  /** The assistant's rules/system prompt (its role). */
  rules?: string;
};

/** Hard cap on injected rules so the side-question prompt stays bounded. */
const MENTION_RULES_MAX_CHARS = 4000;

/**
 * Build the prompt sent to a mentioned assistant. Because the throwaway
 * sub-conversation's `askSideQuestion` path does NOT apply the assistant's own
 * system prompt, we inject its identity (name + description + rules) here so it
 * answers in character. Followed by a short transcript of the recent
 * conversation and the user's question, with `@mention` tokens stripped
 * throughout so the assistant never sees the raw `@slug`.
 */
export function buildMentionQuestion(
  recent: MentionContextMessage[],
  userText: string,
  assistants: AssistantMentionSource[],
  persona?: MentionPersona
): string {
  const cleanedQuestion = stripAssistantMentionTokens(userText, assistants) || userText.trim();
  const transcript = recent
    .slice(-MENTION_CONTEXT_LIMIT)
    .map((message) => {
      const label = message.role === 'user' ? 'Nutzer' : 'Assistent';
      const text = stripAssistantMentionTokens(message.text, assistants) || message.text.trim();
      return `[${label}]: ${truncate(text, MENTION_MESSAGE_MAX_CHARS)}`;
    })
    .filter((line) => line.length > `[Nutzer]: `.length)
    .join('\n');

  const parts: string[] = [];
  if (persona) {
    const identity = persona.description
      ? `Du bist „${persona.name}" – ${persona.description.trim()}.`
      : `Du bist „${persona.name}".`;
    parts.push(`${identity} Bleibe konsequent in dieser Rolle und antworte aus ihrer Perspektive.`);
    const rules = persona.rules?.trim();
    if (rules) {
      parts.push('', 'Deine Rolle/Anweisungen:', truncate(rules, MENTION_RULES_MAX_CHARS));
    }
    parts.push('');
  }
  if (transcript) {
    parts.push('Kontext aus dem bisherigen Gespräch (du wurdest per @ um deine Sicht gebeten):', transcript, '');
  }
  // No persona and no transcript → just the bare question (keeps simple asks clean).
  if (parts.length === 0) {
    return cleanedQuestion;
  }
  parts.push(`Frage an dich: ${cleanedQuestion}`);
  return parts.join('\n').trim();
}

/** A guest answer persisted on the main conversation's `extra`. */
export type GuestBlock = {
  /** Stable unique id (also used as the message id/msg_id). */
  id: string;
  /** msg_id of the main-chat message this block should follow. */
  anchorMsgId: string | null;
  assistantId: string;
  senderName: string;
  /** Backend/agent type for fallback avatar resolution. */
  senderAgentType?: string;
  content: string;
  createdAt: number;
};

export const MENTION_BLOCKS_EXTRA_KEY = 'assistantMentionBlocks';

/** Type guard for a single persisted guest block (defensive against bad data). */
function isGuestBlock(value: unknown): value is GuestBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as Record<string, unknown>;
  return (
    typeof block.id === 'string' &&
    typeof block.assistantId === 'string' &&
    typeof block.senderName === 'string' &&
    typeof block.content === 'string'
  );
}

/** Read guest blocks from a conversation `extra` object, tolerating bad shapes. */
export function parseGuestBlocks(extra: unknown): GuestBlock[] {
  if (!extra || typeof extra !== 'object') return [];
  const raw = (extra as Record<string, unknown>)[MENTION_BLOCKS_EXTRA_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isGuestBlock).map((block) => ({
    id: block.id,
    anchorMsgId: typeof block.anchorMsgId === 'string' ? block.anchorMsgId : null,
    assistantId: block.assistantId,
    senderName: block.senderName,
    senderAgentType: typeof block.senderAgentType === 'string' ? block.senderAgentType : undefined,
    content: block.content,
    createdAt: typeof block.createdAt === 'number' ? block.createdAt : 0,
  }));
}

/** Merge a new/updated block into an existing list, ded0uped by id (newest wins). */
export function upsertGuestBlock(existing: GuestBlock[], block: GuestBlock): GuestBlock[] {
  const next = existing.filter((item) => item.id !== block.id);
  next.push(block);
  return next;
}
