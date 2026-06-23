/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { TMessage } from '@/common/chat/chatLib';
import { AIONUI_FILES_MARKER } from '@/common/config/constants';
import {
  buildChatTranscript,
  extractTranscriptEntries,
  firstUserText,
} from '@/renderer/pages/conversation/Workspace/vault/vaultTranscript';

type MsgOverride = Partial<{
  conversation_id: string;
  type: string;
  position: 'left' | 'right';
  hidden: boolean;
  content: { content: unknown };
}>;

const msg = (over: MsgOverride): TMessage =>
  ({
    id: 'id',
    conversation_id: 'c1',
    type: 'text',
    position: 'left',
    content: { content: 'hi' },
    ...over,
  }) as unknown as TMessage;

describe('extractTranscriptEntries', () => {
  it('keeps visible text messages and maps roles by position', () => {
    const entries = extractTranscriptEntries(
      [
        msg({ position: 'right', content: { content: 'Frage' } }),
        msg({ position: 'left', content: { content: 'Antwort' } }),
      ],
      'c1'
    );
    expect(entries).toEqual([
      { role: 'user', text: 'Frage' },
      { role: 'assistant', text: 'Antwort' },
    ]);
  });

  it('drops hidden, non-text, foreign-conversation and empty messages', () => {
    const entries = extractTranscriptEntries(
      [
        msg({ hidden: true, content: { content: 'versteckt' } }),
        msg({ type: 'tool_call', content: { content: 'tool' } }),
        msg({ conversation_id: 'other', content: { content: 'fremd' } }),
        msg({ content: { content: '   ' } }),
        msg({ content: { content: 42 } }),
        msg({ content: { content: 'sichtbar' } }),
      ],
      'c1'
    );
    expect(entries).toEqual([{ role: 'assistant', text: 'sichtbar' }]);
  });

  it('strips the file marker and everything after it', () => {
    const entries = extractTranscriptEntries(
      [msg({ content: { content: `Text\n${AIONUI_FILES_MARKER}\n/path/file.png` } })],
      'c1'
    );
    expect(entries).toEqual([{ role: 'assistant', text: 'Text' }]);
  });
});

describe('buildChatTranscript', () => {
  it('renders role-labelled Markdown blocks separated by blank lines', () => {
    const transcript = buildChatTranscript(
      [
        { role: 'user', text: 'Hallo' },
        { role: 'assistant', text: 'Hi!' },
      ],
      { userLabel: 'Du', assistantLabel: 'Peter' }
    );
    expect(transcript).toBe('**Du:**\n\nHallo\n\n**Peter:**\n\nHi!');
  });

  it('returns an empty string for no entries', () => {
    expect(buildChatTranscript([], { userLabel: 'Du', assistantLabel: 'KI' })).toBe('');
  });
});

describe('firstUserText', () => {
  it('returns the first user entry text', () => {
    expect(
      firstUserText([
        { role: 'assistant', text: 'a' },
        { role: 'user', text: 'erste Frage' },
        { role: 'user', text: 'zweite' },
      ])
    ).toBe('erste Frage');
  });

  it('returns empty string when there is no user entry', () => {
    expect(firstUserText([{ role: 'assistant', text: 'a' }])).toBe('');
  });
});
