/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { createPiiMapping, restoreText, scrubChatRequestBody, scrubText } from '@/common/pii/piiScrubber';

describe('piiScrubber.scrubText', () => {
  it('detects and replaces IBAN, e-mail, USt-IdNr and phone', () => {
    const m = createPiiMapping();
    const out = scrubText(
      'IBAN DE89 3704 0044 0532 0130 00, mail max@example.de, Tel +49 170 1234567, USt DE123456789',
      m
    );
    expect(out).not.toMatch(/DE89|max@example\.de|DE123456789/);
    expect(out).toMatch(/\[IBAN_\d+\]/);
    expect(out).toMatch(/\[EMAIL_\d+\]/);
    expect(out).toMatch(/\[VATID_\d+\]/);
    expect(out).toMatch(/\[PHONE_\d+\]/);
  });

  it('is a faithful round-trip (restore yields the original)', () => {
    const original = 'Kunde: IBAN DE89 3704 0044 0532 0130 00, erreichbar unter a@b.de und 0170 9876543.';
    const m = createPiiMapping();
    expect(restoreText(scrubText(original, m), m)).toBe(original);
  });

  it('reuses the same placeholder for the same value (consistency)', () => {
    const m = createPiiMapping();
    const out = scrubText('mail a@b.de und nochmal a@b.de', m);
    const matches = out.match(/\[EMAIL_\d+\]/g) ?? [];
    expect(matches).toHaveLength(2);
    expect(matches[0]).toBe(matches[1]);
  });

  it('does not flag harmless short numbers or plain text', () => {
    const m = createPiiMapping();
    const text = 'Bestellung 42 mit 3 Artikeln, Version 2.1.21, Seite 7.';
    expect(scrubText(text, m)).toBe(text);
    expect(m.byPlaceholder.size).toBe(0);
  });
});

describe('piiScrubber.restoreText', () => {
  it('returns input unchanged when the mapping is empty', () => {
    const m = createPiiMapping();
    expect(restoreText('no placeholders here', m)).toBe('no placeholders here');
  });
});

describe('piiScrubber.scrubChatRequestBody', () => {
  it('scrubs messages[].content and keeps the JSON shape', () => {
    const m = createPiiMapping();
    const body = JSON.stringify({
      model: 'x',
      stream: true,
      messages: [{ role: 'user', content: 'IBAN DE89 3704 0044 0532 0130 00' }],
    });
    const out = scrubChatRequestBody(body, m);
    expect(out).not.toBeNull();
    const parsed = JSON.parse(out as string);
    expect(parsed.model).toBe('x');
    expect(parsed.stream).toBe(true);
    expect(parsed.messages[0].content).toMatch(/\[IBAN_\d+\]/);
    expect(parsed.messages[0].content).not.toMatch(/DE89/);
  });

  it('returns null for non-chat bodies (e.g. no messages array)', () => {
    const m = createPiiMapping();
    expect(scrubChatRequestBody(JSON.stringify({ foo: 'bar' }), m)).toBeNull();
    expect(scrubChatRequestBody('not json', m)).toBeNull();
  });

  it('returns null when there is no PII to scrub (no needless rewrite)', () => {
    const m = createPiiMapping();
    const body = JSON.stringify({ messages: [{ role: 'user', content: 'Hallo, wie geht es dir?' }] });
    expect(scrubChatRequestBody(body, m)).toBeNull();
  });
});
