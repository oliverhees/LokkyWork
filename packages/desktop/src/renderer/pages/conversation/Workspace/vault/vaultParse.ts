/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure parsing helpers for the Second-Brain vault browser (CODE-49).
 *
 * The vault is browsed over MCP: `list_tree` returns the note hierarchy and
 * `read_note` returns one note's content. MCP tool results are loosely typed
 * (`{ content: [{ type, text }], structuredContent? }`), and different vault
 * servers shape `list_tree` differently — nested node objects, a flat list of
 * paths, or already-rendered text. These helpers normalise the common shapes
 * into a tree and always degrade gracefully: when nothing parses, the caller
 * renders the raw text instead. No React, no IO — trivially unit-testable.
 */

/** One entry in the browsable vault tree. */
export type VaultNode = {
  /** Display label (file/folder name). */
  name: string;
  /** Identifier passed back to `read_note` (usually the vault-relative path). */
  path: string;
  /** A note (leaf) vs. a folder. */
  isFile: boolean;
  /** Child entries for folders. */
  children?: VaultNode[];
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;

/** Last path segment, e.g. `a/b/c.md` → `c.md`. Falls back to the input. */
export function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

/**
 * Pull the human/text payload out of an MCP `callTool` result. Prefers the
 * concatenated `content[].text`, then a raw string, else a JSON dump. Used for
 * `read_note` (the note body) and as the source for tree parsing.
 */
export function extractToolText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (!isRecord(result)) return String(result ?? '');

  const content = result.content;
  if (Array.isArray(content)) {
    const text = content
      .map((item) => (isRecord(item) && typeof item.text === 'string' ? item.text : ''))
      .filter(Boolean)
      .join('\n');
    if (text) return text;
  }
  if (typeof result.text === 'string') return result.text;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

/** Best-effort JSON parse; returns undefined instead of throwing. */
function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

const FILE_TYPES = new Set(['file', 'note', 'document', 'leaf']);
const DIR_TYPES = new Set(['dir', 'directory', 'folder', 'tree', 'group']);

/** Heuristic: does this entry look like a leaf note rather than a folder? */
function inferIsFile(obj: UnknownRecord, hasChildren: boolean): boolean {
  if (hasChildren) return false;
  if (typeof obj.isFile === 'boolean') return obj.isFile;
  if (typeof obj.is_file === 'boolean') return obj.is_file;
  const type = typeof obj.type === 'string' ? obj.type.toLowerCase() : '';
  if (FILE_TYPES.has(type)) return true;
  if (DIR_TYPES.has(type)) return false;
  const path = typeof obj.path === 'string' ? obj.path : typeof obj.name === 'string' ? obj.name : '';
  // No type hint and no children: treat anything with a file extension as a note.
  return /\.[A-Za-z0-9]+$/.test(path);
}

/** Normalise one loosely-typed node object into a {@link VaultNode}. */
function toNode(value: unknown): VaultNode | null {
  if (typeof value === 'string') {
    return { name: basename(value), path: value, isFile: /\.[A-Za-z0-9]+$/.test(value) };
  }
  if (!isRecord(value)) return null;

  const rawChildren = value.children ?? value.entries ?? value.items;
  const children = Array.isArray(rawChildren)
    ? rawChildren.map(toNode).filter((n): n is VaultNode => n !== null)
    : undefined;

  const path =
    (typeof value.path === 'string' && value.path) ||
    (typeof value.id === 'string' && value.id) ||
    (typeof value.name === 'string' && value.name) ||
    (typeof value.title === 'string' && value.title) ||
    '';
  const name =
    (typeof value.name === 'string' && value.name) ||
    (typeof value.title === 'string' && value.title) ||
    (path ? basename(path) : '');
  if (!name && !path) return null;

  const hasChildren = Array.isArray(children) && children.length > 0;
  const node: VaultNode = {
    name: name || basename(path),
    path: path || name,
    isFile: inferIsFile(value, hasChildren),
  };
  if (hasChildren) node.children = children;
  return node;
}

/** Build a nested tree from a flat list of vault-relative paths. */
export function buildTreeFromPaths(paths: string[]): VaultNode[] {
  const roots: VaultNode[] = [];
  const dirIndex = new Map<string, VaultNode>();

  for (const raw of paths) {
    const clean = raw.replace(/^[\\/]+/, '');
    if (!clean) continue;
    const segments = clean.split(/[\\/]/).filter(Boolean);
    let parentChildren = roots;
    let prefix = '';

    segments.forEach((segment, index) => {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      const isLeaf = index === segments.length - 1;
      if (isLeaf) {
        if (!parentChildren.some((n) => n.path === prefix)) {
          parentChildren.push({ name: segment, path: prefix, isFile: true });
        }
        return;
      }
      let dir = dirIndex.get(prefix);
      if (!dir) {
        dir = { name: segment, path: prefix, isFile: false, children: [] };
        dirIndex.set(prefix, dir);
        parentChildren.push(dir);
      }
      if (!dir.children) dir.children = [];
      parentChildren = dir.children;
    });
  }
  return roots;
}

/** Locate the first array of entries inside a wrapper object (e.g. `{ tree: [...] }`). */
function findEntryArray(obj: UnknownRecord): unknown[] | null {
  for (const key of ['tree', 'entries', 'files', 'items', 'nodes', 'notes', 'children', 'data', 'result']) {
    const candidate = obj[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return null;
}

/**
 * Parse an MCP `list_tree` result into a browsable tree. Handles nested node
 * objects, a flat array of path strings, and `{ tree: [...] }`-style wrappers.
 * Returns null when the shape is unrecognised so the caller can fall back to
 * rendering the raw text.
 */
export function parseVaultTree(result: unknown): VaultNode[] | null {
  const structured = isRecord(result) ? result.structuredContent : undefined;
  const value = structured !== undefined ? structured : (tryParseJson(extractToolText(result)) ?? structured);
  if (value === undefined) return null;

  let entries: unknown[] | null = null;
  if (Array.isArray(value)) entries = value;
  else if (isRecord(value)) entries = findEntryArray(value) ?? (value.name || value.path ? [value] : null);
  if (!entries || entries.length === 0) return null;

  // A flat list of plain path strings is common — build the hierarchy from it.
  if (entries.every((e) => typeof e === 'string')) {
    return buildTreeFromPaths(entries as string[]);
  }

  const nodes = entries.map(toNode).filter((n): n is VaultNode => n !== null);
  return nodes.length ? nodes : null;
}

/**
 * Determine which argument name `read_note` expects for the note path, by
 * inspecting its JSON-Schema `input_schema`. Vault servers vary
 * (`path` / `note_path` / `id` / …); we pick the first required string
 * property, then the first string property, defaulting to `path`.
 */
export function pickPathArgKey(inputSchema: unknown, fallback = 'path'): string {
  if (!isRecord(inputSchema)) return fallback;
  const properties = isRecord(inputSchema.properties) ? inputSchema.properties : undefined;
  if (!properties) return fallback;
  const keys = Object.keys(properties);
  if (keys.length === 0) return fallback;

  const required = Array.isArray(inputSchema.required)
    ? inputSchema.required.filter((k): k is string => typeof k === 'string')
    : [];
  const isStringProp = (key: string): boolean => {
    const prop = properties[key];
    return isRecord(prop) && (prop.type === 'string' || prop.type === undefined);
  };

  const preferred = ['path', 'note_path', 'notePath', 'note', 'id', 'note_id', 'noteId', 'file', 'filename'];
  for (const name of preferred) {
    if (keys.includes(name) && isStringProp(name)) return name;
  }
  const requiredString = required.find((k) => keys.includes(k) && isStringProp(k));
  if (requiredString) return requiredString;
  const firstString = keys.find(isStringProp);
  return firstString ?? keys[0];
}

/** A note parsed from a `read_note` result, ready to render as Markdown. */
export type ParsedNote = {
  /** Note title (from JSON `title` or frontmatter), if any. */
  title?: string;
  /** Note kind (e.g. `wiki-article`), if any. */
  type?: string;
  /** Tags from JSON or frontmatter. */
  tags: string[];
  /** The Markdown body with any leading YAML frontmatter stripped. */
  body: string;
};

const stripQuotes = (value: string): string => value.replace(/^['"]|['"]$/g, '').trim();

/** Split an inline list like `[a, b]` or `a, b` into trimmed, unquoted items. */
function parseInlineList(value: string): string[] {
  return value
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((item) => stripQuotes(item.trim()))
    .filter(Boolean);
}

/** Coerce a JSON `tags` field (array or string) into a string list. */
function coerceTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((t): t is string => typeof t === 'string').map((t) => t.trim());
  if (typeof value === 'string') return parseInlineList(value);
  return [];
}

type Frontmatter = { title?: string; type?: string; tags: string[] };

/**
 * Split a leading YAML frontmatter block (`---\n…\n---`) off a Markdown string.
 * Returns the remaining body plus a best-effort parse of title/type/tags. When
 * there is no frontmatter, the input is returned unchanged with empty meta.
 */
function splitFrontmatter(markdown: string): { body: string; frontmatter: Frontmatter } {
  const empty: Frontmatter = { tags: [] };
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/);
  if (!match) return { body: markdown, frontmatter: empty };

  const fm: Frontmatter = { tags: [] };
  let collectingTags = false;
  for (const line of match[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s*-\s+(.*\S)\s*$/);
    if (collectingTags && listItem) {
      fm.tags.push(stripQuotes(listItem[1]));
      continue;
    }
    collectingTags = false;
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    const value = kv[2].trim();
    if (key === 'tags') {
      if (value) fm.tags.push(...parseInlineList(value));
      else collectingTags = true; // YAML block list follows on indented `- ` lines
      continue;
    }
    if (key === 'title') fm.title = stripQuotes(value);
    else if (key === 'type') fm.type = stripQuotes(value);
  }
  return { body: markdown.slice(match[0].length), frontmatter: fm };
}

/**
 * Parse a `read_note` MCP result into renderable note data. Vault servers return
 * a JSON object `{ id, path, title, body }` where `body` is the actual Markdown
 * (often itself prefixed with YAML frontmatter). This extracts `body`, strips
 * that frontmatter, and surfaces title/type/tags. Falls back to treating the
 * whole text payload as the body when no `body` field is present — defensive by
 * design, never throws.
 */
export function parseNote(result: unknown): ParsedNote {
  const structured = isRecord(result) ? result.structuredContent : undefined;
  const text = extractToolText(result);
  const json = structured !== undefined ? structured : tryParseJson(text);

  let rawBody = text;
  let jsonTitle: string | undefined;
  let jsonType: string | undefined;
  let jsonTags: string[] = [];
  if (isRecord(json) && typeof json.body === 'string') {
    rawBody = json.body;
    if (typeof json.title === 'string') jsonTitle = json.title;
    if (typeof json.type === 'string') jsonType = json.type;
    jsonTags = coerceTags(json.tags);
  }

  const { body, frontmatter } = splitFrontmatter(rawBody);
  return {
    title: jsonTitle ?? frontmatter.title,
    type: jsonType ?? frontmatter.type,
    tags: jsonTags.length ? jsonTags : frontmatter.tags,
    body: body.trim() ? body : rawBody,
  };
}

/**
 * Resolve a tool argument name defensively: returns the first of `candidates`
 * actually present in the tool's `input_schema.properties`, else `fallback`.
 * Unlike {@link pickPathArgKey} it never falls back to "first property" — for
 * multi-argument tools (like `create_managed_note`) that could mis-map a value,
 * so an absent/unknown schema simply yields the standard `fallback` name.
 */
export function pickNamedArg(inputSchema: unknown, candidates: string[], fallback: string): string {
  if (!isRecord(inputSchema)) return fallback;
  const properties = isRecord(inputSchema.properties) ? inputSchema.properties : undefined;
  if (!properties) return fallback;
  return candidates.find((name) => Object.prototype.hasOwnProperty.call(properties, name)) ?? fallback;
}

/**
 * Derive a default note title from a message body: the first non-empty line,
 * stripped of leading Markdown heading markers, truncated to ~`maxLength` chars.
 * Returns a generic fallback when the body has no usable text.
 */
export function deriveNoteTitle(body: string, maxLength = 60, fallback = 'Notiz'): string {
  const firstLine = body
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}\s+/, '').trim())
    .find((line) => line.length > 0);
  if (!firstLine) return fallback;
  if (firstLine.length <= maxLength) return firstLine;
  return `${firstLine.slice(0, maxLength).trimEnd()}…`;
}

/** Compose a compact, language-neutral message from a vault error envelope. */
function formatToolError(error: UnknownRecord): string {
  const parts = [String(error.error)];
  if ('got' in error) parts.push(`got: ${JSON.stringify(error.got)}`);
  if (Array.isArray(error.allowed)) parts.push(`allowed: ${error.allowed.join(', ')}`);
  if (typeof error.message === 'string') parts.push(error.message);
  if (typeof error.detail === 'string') parts.push(error.detail);
  return parts.filter(Boolean).join(' — ');
}

/**
 * Honestly evaluate an MCP `CallToolResult`. A tool can signal failure two ways:
 * the spec's `isError === true`, OR — as this vault server does — by returning a
 * normal result whose content is an error-shaped JSON object (`{ "error": … }`,
 * e.g. `invalid-type`) with NO `isError` flag. Both are treated as failures.
 * Returns the human-readable error string, or null when the call truly succeeded.
 */
export function extractToolError(result: unknown): string | null {
  const text = extractToolText(result);
  const structured = isRecord(result) ? result.structuredContent : undefined;
  const payload = structured !== undefined ? structured : tryParseJson(text);
  if (isRecord(payload) && typeof payload.error === 'string' && payload.error) {
    return formatToolError(payload);
  }
  if (isRecord(result) && result.isError === true) {
    return text || 'tool-error';
  }
  return null;
}
