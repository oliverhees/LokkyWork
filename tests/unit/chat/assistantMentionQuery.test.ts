/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  buildAssistantMentionInsertion,
  filterAssistantMentions,
  getActiveAssistantMention,
  getAllAssistantMentions,
  slugifyAssistantName,
} from '@renderer/utils/chat/assistantMentionQuery';

const assistants = [
  { id: 'a1', name: 'UI/UX Pro Max' },
  { id: 'a2', name: 'Word-Ersteller' },
  { id: 'a3', name: 'Beautiful Mermaid' },
];

describe('slugifyAssistantName', () => {
  it('lowercases and collapses non-alphanumeric runs to hyphens', () => {
    expect(slugifyAssistantName('UI/UX Pro Max')).toBe('ui-ux-pro-max');
    expect(slugifyAssistantName('Word-Ersteller')).toBe('word-ersteller');
  });

  it('strips accents and trims edge hyphens', () => {
    expect(slugifyAssistantName('  Über-Assistent!  ')).toBe('uber-assistent');
  });
});

describe('buildAssistantMentionInsertion', () => {
  it('prefixes the slug with @', () => {
    expect(buildAssistantMentionInsertion({ id: 'a1', name: 'UI/UX Pro Max' })).toBe('@ui-ux-pro-max');
  });
});

describe('getAllAssistantMentions', () => {
  it('resolves a slug token back to its assistant', () => {
    const matches = getAllAssistantMentions('Hey @ui-ux-pro-max wie sähe das aus?', assistants);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ assistantId: 'a1', name: 'UI/UX Pro Max', slug: 'ui-ux-pro-max' });
    expect('Hey @ui-ux-pro-max wie sähe das aus?'.slice(matches[0].start, matches[0].end)).toBe('@ui-ux-pro-max');
  });

  it('ignores @tokens that match no assistant (e.g. file paths)', () => {
    expect(getAllAssistantMentions('siehe @src/index.ts und @unknown', assistants)).toHaveLength(0);
  });

  it('finds multiple mentions', () => {
    const matches = getAllAssistantMentions('@word-ersteller dann @beautiful-mermaid', assistants);
    expect(matches.map((m) => m.assistantId)).toEqual(['a2', 'a3']);
  });

  it('requires a boundary before @ (no mid-word match)', () => {
    expect(getAllAssistantMentions('email@word-ersteller', assistants)).toHaveLength(0);
  });
});

describe('getActiveAssistantMention', () => {
  it('returns the token the caret sits in', () => {
    const text = 'Hallo @ui-ux';
    const active = getActiveAssistantMention(text, text.length);
    expect(active).toEqual({ start: 6, end: 12, query: 'ui-ux' });
  });

  it('returns null when caret is past a boundary', () => {
    const text = '@word-ersteller fertig';
    expect(getActiveAssistantMention(text, text.length)).toBeNull();
  });

  it('returns an empty query right after a lone @', () => {
    expect(getActiveAssistantMention('say @', 5)).toEqual({ start: 4, end: 5, query: '' });
  });
});

describe('filterAssistantMentions', () => {
  it('returns all on empty query', () => {
    expect(filterAssistantMentions(assistants, '')).toHaveLength(3);
  });

  it('matches by slug prefix and name substring', () => {
    expect(filterAssistantMentions(assistants, 'word').map((a) => a.id)).toEqual(['a2']);
    expect(filterAssistantMentions(assistants, 'mermaid').map((a) => a.id)).toEqual(['a3']);
  });
});
