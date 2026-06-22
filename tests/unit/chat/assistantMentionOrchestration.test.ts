/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  buildMentionQuestion,
  MENTION_BLOCKS_EXTRA_KEY,
  parseGuestBlocks,
  stripAssistantMentionTokens,
  upsertGuestBlock,
  type GuestBlock,
} from '@renderer/utils/chat/assistantMentionOrchestration';

const assistants = [
  { id: 'a1', name: 'UI/UX Pro Max' },
  { id: 'a2', name: 'Word-Ersteller' },
];

describe('stripAssistantMentionTokens', () => {
  it('removes resolved @slug tokens and collapses whitespace', () => {
    expect(stripAssistantMentionTokens('@ui-ux-pro-max wie sähe das UI aus?', assistants)).toBe('wie sähe das UI aus?');
  });

  it('leaves unmatched @tokens untouched', () => {
    expect(stripAssistantMentionTokens('siehe @src/index.ts', assistants)).toBe('siehe @src/index.ts');
  });
});

describe('buildMentionQuestion', () => {
  it('includes a transcript and the cleaned question', () => {
    const prompt = buildMentionQuestion(
      [
        { role: 'user', text: 'Schreib mir einen Werbetext.' },
        { role: 'assistant', text: 'Hier dein Werbetext: ...' },
      ],
      '@ui-ux-pro-max wie sähe das UI aus?',
      assistants
    );
    expect(prompt).toContain('[Nutzer]: Schreib mir einen Werbetext.');
    expect(prompt).toContain('[Assistent]: Hier dein Werbetext: ...');
    expect(prompt).toContain('Frage an dich: wie sähe das UI aus?');
  });

  it('returns just the cleaned question when there is no transcript', () => {
    expect(buildMentionQuestion([], '@word-ersteller hilf mir', assistants)).toBe('hilf mir');
  });

  it('injects the persona identity, description and rules so it answers in character', () => {
    const prompt = buildMentionQuestion([], '@word-ersteller hilf mir', assistants, {
      name: 'Word-Ersteller',
      description: 'erstellt Word-Dokumente',
      rules: 'Du formatierst sauber.',
    });
    expect(prompt).toContain('Du bist „Word-Ersteller" – erstellt Word-Dokumente.');
    expect(prompt).toContain('Deine Rolle/Anweisungen:');
    expect(prompt).toContain('Du formatierst sauber.');
    expect(prompt).toContain('Frage an dich: hilf mir');
  });

  it('strips @mention tokens from transcript context too', () => {
    const prompt = buildMentionQuestion(
      [{ role: 'user', text: '@word-ersteller was kannst du?' }],
      '@word-ersteller leg los',
      assistants
    );
    expect(prompt).not.toContain('@word-ersteller');
    expect(prompt).toContain('was kannst du?');
  });

  it('caps the transcript to the most recent messages', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: 'user' as const, text: `m${i}` }));
    const prompt = buildMentionQuestion(many, 'frage', assistants);
    expect(prompt).toContain('m29');
    expect(prompt).not.toContain('[Nutzer]: m0\n');
  });
});

describe('guest block persistence', () => {
  const block: GuestBlock = {
    id: 'b1',
    anchorMsgId: 'm1',
    assistantId: 'a1',
    senderName: 'UI/UX Pro Max',
    senderAgentType: 'aionrs',
    content: 'Vorschlag …',
    createdAt: 1,
  };

  it('round-trips through extra', () => {
    const extra = { [MENTION_BLOCKS_EXTRA_KEY]: [block] };
    expect(parseGuestBlocks(extra)).toEqual([block]);
  });

  it('tolerates missing / malformed extra', () => {
    expect(parseGuestBlocks(undefined)).toEqual([]);
    expect(parseGuestBlocks({})).toEqual([]);
    expect(parseGuestBlocks({ [MENTION_BLOCKS_EXTRA_KEY]: [{ nope: true }, block] })).toEqual([block]);
  });

  it('upserts by id (newest wins, order preserved at end)', () => {
    const updated = { ...block, content: 'neu' };
    const result = upsertGuestBlock([block], updated);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('neu');
  });
});
