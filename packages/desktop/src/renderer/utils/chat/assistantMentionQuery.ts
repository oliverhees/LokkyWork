/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Assistant @-mention parsing for the in-chat SendBox (CODE-37 / CODE-45).
 *
 * The `@` trigger is shared with file mentions (see `atFileQuery.ts`). File
 * mentions only activate when the conversation has a workspace; assistant
 * mentions match the `@token` against the names of known preset assistants.
 *
 * Assistant names can contain spaces and punctuation (e.g. "UI/UX Pro Max"),
 * but the `@token` is bounded by whitespace/punctuation, so a mention uses a
 * URL-safe *slug* of the name (e.g. `@ui-ux-pro-max`). The dropdown inserts the
 * slug; parsing resolves the slug back to the assistant id.
 */

export type AssistantMentionSource = {
  id: string;
  /** Display name, e.g. "UI/UX Pro Max". */
  name: string;
};

export type AssistantMentionMatch = {
  assistantId: string;
  name: string;
  slug: string;
  /** Index of the `@` in the text. */
  start: number;
  /** Index just past the slug token. */
  end: number;
  /** The matched `@slug` substring. */
  token: string;
};

const AT_BOUNDARY_RE = /[\s,;!?()[\]{}]/;

function isBoundaryChar(char: string): boolean {
  return AT_BOUNDARY_RE.test(char);
}

/** Lowercase, non-alphanumeric runs collapsed to single hyphens, trimmed. */
export function slugifyAssistantName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The text to insert for a chosen assistant, e.g. `@ui-ux-pro-max`. */
export function buildAssistantMentionInsertion(assistant: AssistantMentionSource): string {
  return `@${slugifyAssistantName(assistant.name)}`;
}

/**
 * Build a slug → assistant lookup. When two assistants slugify to the same
 * value, the first one wins (stable by input order).
 */
function buildSlugIndex(assistants: AssistantMentionSource[]): Map<string, AssistantMentionSource> {
  const index = new Map<string, AssistantMentionSource>();
  for (const assistant of assistants) {
    const slug = slugifyAssistantName(assistant.name);
    if (slug && !index.has(slug)) index.set(slug, assistant);
  }
  return index;
}

/** Scan the raw `@token` boundaries (mirrors atFileQuery's boundary rules). */
function findAtTokenBounds(value: string): Array<{ start: number; end: number; raw: string }> {
  const tokens: Array<{ start: number; end: number; raw: string }> = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '@') continue;
    const prev = index > 0 ? value[index - 1] : '';
    if (prev && !isBoundaryChar(prev)) continue;
    let end = value.length;
    for (let cursor = index + 1; cursor < value.length; cursor += 1) {
      if (isBoundaryChar(value[cursor])) {
        end = cursor;
        break;
      }
    }
    tokens.push({ start: index, end, raw: value.slice(index + 1, end) });
    index = end - 1;
  }
  return tokens;
}

/**
 * All resolved assistant mentions in `text`. A `@token` resolves when its slug
 * exactly matches a known assistant slug; unmatched `@tokens` (e.g. file paths)
 * are ignored.
 */
export function getAllAssistantMentions(text: string, assistants: AssistantMentionSource[]): AssistantMentionMatch[] {
  if (!text || assistants.length === 0) return [];
  const slugIndex = buildSlugIndex(assistants);
  const matches: AssistantMentionMatch[] = [];
  for (const token of findAtTokenBounds(text)) {
    const slug = token.raw.toLowerCase();
    const assistant = slugIndex.get(slug);
    if (!assistant) continue;
    matches.push({
      assistantId: assistant.id,
      name: assistant.name,
      slug,
      start: token.start,
      end: token.end,
      token: text.slice(token.start, token.end),
    });
  }
  return matches;
}

export type ActiveAssistantMention = {
  start: number;
  end: number;
  /** The partial slug the user has typed after `@` (may be empty). */
  query: string;
};

/**
 * The `@token` the caret currently sits in (for driving the dropdown), or null.
 * Mirrors `getActiveAtFileQuery` boundary handling but without path escaping —
 * assistant slugs never contain escaped characters.
 */
export function getActiveAssistantMention(value: string, caretPosition: number): ActiveAssistantMention | null {
  if (!value) return null;
  const caret = Math.max(0, Math.min(caretPosition, value.length));
  let atIndex = -1;
  for (let index = caret - 1; index >= 0; index -= 1) {
    const char = value[index];
    if (char === '@') {
      const prev = index > 0 ? value[index - 1] : '';
      if (!prev || isBoundaryChar(prev)) {
        atIndex = index;
        break;
      }
    }
    if (isBoundaryChar(char)) return null;
  }
  if (atIndex === -1) return null;

  let end = value.length;
  for (let index = atIndex + 1; index < value.length; index += 1) {
    if (isBoundaryChar(value[index])) {
      end = index;
      break;
    }
  }
  if (caret < atIndex || caret > end) return null;
  return { start: atIndex, end, query: value.slice(atIndex + 1, end).toLowerCase() };
}

/** Filter assistants whose slug starts with the active query (empty → all). */
export function filterAssistantMentions(assistants: AssistantMentionSource[], query: string): AssistantMentionSource[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return assistants;
  return assistants.filter((assistant) => {
    const slug = slugifyAssistantName(assistant.name);
    return slug.startsWith(needle) || assistant.name.toLowerCase().includes(needle);
  });
}
