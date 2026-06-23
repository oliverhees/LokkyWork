/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PII scrubbing for the anonymization proxy (CODE-34). Detects structured,
 * high-risk personal data with conservative DE/AT-focused regex and replaces it
 * with stable placeholders (e.g. `[IBAN_1]`), keeping a reversible mapping so the
 * model's response can be restored (CODE-35).
 *
 * Scope (MVP): structured PII only — IBAN, e-mail, USt-IdNr, credit card, phone.
 * These are deterministic and ~safe; free-form names/orgs need NER (later, GLiNER
 * via ONNX). Patterns are applied most-specific-first on the progressively
 * scrubbed text, so an already-replaced IBAN can't be re-matched as a card/phone.
 *
 * The mapping lives only for the lifetime of one request/response cycle (in
 * memory, never persisted), so no encryption is required at this stage.
 *
 * Pattern reference adapted from austrAI-privacyproxy (MIT).
 */

export type PiiKind = 'IBAN' | 'EMAIL' | 'VATID' | 'CARD' | 'PHONE';

export type PiiMapping = {
  counter: number;
  /** original value -> placeholder (for consistent re-use within a request) */
  byOriginal: Map<string, string>;
  /** placeholder -> original value (for restoring the response) */
  byPlaceholder: Map<string, string>;
};

export function createPiiMapping(): PiiMapping {
  return { counter: 0, byOriginal: new Map(), byPlaceholder: new Map() };
}

// Most-specific first. Applied sequentially on already-scrubbed text.
const PATTERNS: { kind: PiiKind; re: RegExp }[] = [
  // IBAN: 2 letters + 2 check digits + 11–30 alphanumerics (spaces allowed).
  { kind: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}/g },
  // E-mail.
  { kind: 'EMAIL', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  // German VAT id (USt-IdNr): DE + 9 digits.
  { kind: 'VATID', re: /\bDE\d{9}\b/g },
  // Credit card: 13–19 digits, optionally grouped by spaces/dashes.
  { kind: 'CARD', re: /\b(?:\d[ -]?){13,19}\b/g },
  // Phone (DE-focused, conservative): +49 or leading 0, then 8+ phone chars.
  // (?<!\w) instead of \b so +49 (non-word start) matches too.
  { kind: 'PHONE', re: /(?<!\w)(?:\+49|0)[\d ()/-]{8,}\d/g },
];

function placeholderFor(kind: PiiKind, original: string, mapping: PiiMapping): string {
  const existing = mapping.byOriginal.get(original);
  if (existing) return existing;
  const placeholder = `[${kind}_${++mapping.counter}]`;
  mapping.byOriginal.set(original, placeholder);
  mapping.byPlaceholder.set(placeholder, original);
  return placeholder;
}

/** Replace detected PII in `text` with placeholders, filling `mapping`. */
export function scrubText(text: string, mapping: PiiMapping): string {
  let result = text;
  for (const { kind, re } of PATTERNS) {
    result = result.replace(re, (match) => placeholderFor(kind, match, mapping));
  }
  return result;
}

/** Replace placeholders in `text` back with their original values. */
export function restoreText(text: string, mapping: PiiMapping): string {
  if (mapping.byPlaceholder.size === 0) return text;
  let result = text;
  for (const [placeholder, original] of mapping.byPlaceholder) {
    if (result.includes(placeholder)) result = result.split(placeholder).join(original);
  }
  return result;
}

/**
 * Scrub the `messages[].content` of an OpenAI-compatible chat request body.
 * Returns the rewritten JSON string, or null if the body isn't the expected
 * shape (caller then forwards it unchanged).
 */
export function scrubChatRequestBody(body: string, mapping: PiiMapping): string | null {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const messages = (json as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return null;

  let changed = false;
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const m = msg as { content?: unknown };
    if (typeof m.content === 'string') {
      const scrubbed = scrubText(m.content, mapping);
      if (scrubbed !== m.content) {
        m.content = scrubbed;
        changed = true;
      }
    } else if (Array.isArray(m.content)) {
      // Multimodal content: scrub text parts only.
      for (const part of m.content) {
        if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
          const p = part as { text: string };
          const scrubbed = scrubText(p.text, mapping);
          if (scrubbed !== p.text) {
            p.text = scrubbed;
            changed = true;
          }
        }
      }
    }
  }
  return changed ? JSON.stringify(json) : null;
}
