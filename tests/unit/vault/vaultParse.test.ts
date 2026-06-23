/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  basename,
  buildTreeFromPaths,
  deriveNoteTitle,
  extractToolError,
  extractToolText,
  parseNote,
  parseVaultTree,
  pickNamedArg,
  pickPathArgKey,
  type VaultNode,
} from '@/renderer/pages/conversation/Workspace/vault/vaultParse';

describe('basename', () => {
  it('returns the last path segment', () => {
    expect(basename('a/b/c.md')).toBe('c.md');
    expect(basename('note.md')).toBe('note.md');
  });

  it('handles backslashes and trailing slashes', () => {
    expect(basename('a\\b\\c.md')).toBe('c.md');
    expect(basename('a/b/')).toBe('b');
  });

  it('falls back to the input when empty', () => {
    expect(basename('')).toBe('');
  });
});

describe('extractToolText', () => {
  it('returns a plain string as-is', () => {
    expect(extractToolText('hello')).toBe('hello');
  });

  it('concatenates text items from MCP content arrays', () => {
    const result = {
      content: [
        { type: 'text', text: '# Note' },
        { type: 'text', text: 'body' },
      ],
    };
    expect(extractToolText(result)).toBe('# Note\nbody');
  });

  it('reads a top-level text field', () => {
    expect(extractToolText({ text: 'just text' })).toBe('just text');
  });

  it('falls back to a JSON dump for unknown shapes', () => {
    expect(extractToolText({ foo: 1 })).toContain('"foo": 1');
  });
});

describe('parseVaultTree', () => {
  it('parses nested node objects', () => {
    const result = {
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            {
              name: 'Projects',
              path: 'Projects',
              type: 'dir',
              children: [{ name: 'a.md', path: 'Projects/a.md', type: 'file' }],
            },
            { name: 'root.md', path: 'root.md', type: 'file' },
          ]),
        },
      ],
    };
    const tree = parseVaultTree(result);
    expect(tree).not.toBeNull();
    expect(tree).toHaveLength(2);
    const [projects, root] = tree as VaultNode[];
    expect(projects.isFile).toBe(false);
    expect(projects.children?.[0]).toMatchObject({ name: 'a.md', path: 'Projects/a.md', isFile: true });
    expect(root.isFile).toBe(true);
  });

  it('builds a hierarchy from a flat list of path strings', () => {
    const result = { content: [{ type: 'text', text: JSON.stringify(['Area/note1.md', 'Area/note2.md', 'top.md']) }] };
    const tree = parseVaultTree(result);
    expect(tree).not.toBeNull();
    const area = (tree as VaultNode[]).find((n) => n.name === 'Area');
    expect(area?.isFile).toBe(false);
    expect(area?.children?.map((c) => c.name)).toEqual(['note1.md', 'note2.md']);
    expect((tree as VaultNode[]).some((n) => n.name === 'top.md' && n.isFile)).toBe(true);
  });

  it('unwraps a { tree: [...] } envelope', () => {
    const result = { content: [{ type: 'text', text: JSON.stringify({ tree: ['x.md'] }) }] };
    const tree = parseVaultTree(result);
    expect(tree).toEqual([{ name: 'x.md', path: 'x.md', isFile: true }]);
  });

  it('reads structuredContent when present', () => {
    const result = { structuredContent: [{ name: 'b.md', path: 'b.md', type: 'file' }], content: [] };
    const tree = parseVaultTree(result);
    expect(tree).toEqual([{ name: 'b.md', path: 'b.md', isFile: true }]);
  });

  it('returns null for non-JSON text so the caller can render raw', () => {
    expect(parseVaultTree({ content: [{ type: 'text', text: 'just a sentence' }] })).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(parseVaultTree({ content: [{ type: 'text', text: '[]' }] })).toBeNull();
  });
});

describe('buildTreeFromPaths', () => {
  it('nests shared directories and dedupes intermediate folders', () => {
    const tree = buildTreeFromPaths(['a/b/c.md', 'a/b/d.md', 'a/e.md']);
    expect(tree).toHaveLength(1);
    const a = tree[0];
    expect(a).toMatchObject({ name: 'a', isFile: false });
    const b = a.children?.find((n) => n.name === 'b');
    expect(b?.children?.map((c) => c.name)).toEqual(['c.md', 'd.md']);
    expect(a.children?.some((n) => n.name === 'e.md' && n.isFile)).toBe(true);
  });

  it('ignores empty and leading-slash segments', () => {
    const tree = buildTreeFromPaths(['/x.md', '', 'y.md']);
    expect(tree.map((n) => n.name).toSorted()).toEqual(['x.md', 'y.md']);
  });
});

describe('pickPathArgKey', () => {
  it('prefers a conventional path-like property', () => {
    const schema = { type: 'object', properties: { path: { type: 'string' }, format: { type: 'string' } } };
    expect(pickPathArgKey(schema)).toBe('path');
  });

  it('honours alternative naming like note_path', () => {
    const schema = { type: 'object', properties: { note_path: { type: 'string' } } };
    expect(pickPathArgKey(schema)).toBe('note_path');
  });

  it('falls back to the first required string property', () => {
    const schema = {
      type: 'object',
      properties: { slug: { type: 'string' }, depth: { type: 'number' } },
      required: ['slug'],
    };
    expect(pickPathArgKey(schema)).toBe('slug');
  });

  it('defaults to "path" when the schema is unusable', () => {
    expect(pickPathArgKey(undefined)).toBe('path');
    expect(pickPathArgKey({})).toBe('path');
  });
});

describe('parseNote', () => {
  it('extracts the body field and strips its frontmatter', () => {
    const body = [
      '---',
      'id: abc',
      'type: wiki-article',
      'title: Mein Artikel',
      'tags: [alpha, beta]',
      '---',
      '# Mein Artikel',
      '',
      'Inhalt hier.',
    ].join('\n');
    const result = {
      content: [{ type: 'text', text: JSON.stringify({ id: 'abc', path: 'wiki/a.md', title: 'Mein Artikel', body }) }],
    };
    const note = parseNote(result);
    expect(note.title).toBe('Mein Artikel');
    expect(note.type).toBe('wiki-article');
    expect(note.tags).toEqual(['alpha', 'beta']);
    expect(note.body.startsWith('# Mein Artikel')).toBe(true);
    expect(note.body).not.toContain('---');
    expect(note.body).not.toContain('type: wiki-article');
  });

  it('prefers JSON-level title/tags over frontmatter', () => {
    const body = ['---', 'title: FM Title', 'tags: [x]', '---', 'Body'].join('\n');
    const note = parseNote({
      content: [{ type: 'text', text: JSON.stringify({ title: 'JSON Title', tags: ['y', 'z'], body }) }],
    });
    expect(note.title).toBe('JSON Title');
    expect(note.tags).toEqual(['y', 'z']);
  });

  it('parses a YAML block-list of tags in frontmatter', () => {
    const body = ['---', 'tags:', '  - one', '  - two', '---', 'Text'].join('\n');
    const note = parseNote({ content: [{ type: 'text', text: JSON.stringify({ body }) }] });
    expect(note.tags).toEqual(['one', 'two']);
    expect(note.body).toBe('Text');
  });

  it('renders a note without frontmatter as-is', () => {
    const note = parseNote({
      content: [{ type: 'text', text: JSON.stringify({ body: '# Just markdown\n\nNo frontmatter.' }) }],
    });
    expect(note.body).toBe('# Just markdown\n\nNo frontmatter.');
    expect(note.tags).toEqual([]);
    expect(note.title).toBeUndefined();
  });

  it('falls back to the raw text when there is no body field', () => {
    const note = parseNote({ content: [{ type: 'text', text: 'plain note text' }] });
    expect(note.body).toBe('plain note text');
    expect(note.tags).toEqual([]);
  });

  it('reads a note object from structuredContent', () => {
    const note = parseNote({ structuredContent: { title: 'S', body: 'structured body' }, content: [] });
    expect(note.title).toBe('S');
    expect(note.body).toBe('structured body');
  });
});

describe('pickNamedArg', () => {
  it('returns the first candidate present in the schema', () => {
    const schema = { type: 'object', properties: { content: { type: 'string' }, heading: { type: 'string' } } };
    expect(pickNamedArg(schema, ['body', 'content', 'text'], 'body')).toBe('content');
    expect(pickNamedArg(schema, ['title', 'name', 'heading'], 'title')).toBe('heading');
  });

  it('falls back to the standard name when no candidate matches', () => {
    const schema = { type: 'object', properties: { foo: { type: 'string' } } };
    expect(pickNamedArg(schema, ['body', 'content'], 'body')).toBe('body');
  });

  it('falls back when the schema is unusable (never guesses first property)', () => {
    expect(pickNamedArg(undefined, ['body'], 'body')).toBe('body');
    expect(pickNamedArg({}, ['title'], 'title')).toBe('title');
    expect(pickNamedArg({ properties: { onlyprop: {} } }, ['body', 'content'], 'body')).toBe('body');
  });
});

describe('deriveNoteTitle', () => {
  it('uses the first non-empty line', () => {
    expect(deriveNoteTitle('\n\nErste Zeile\nzweite')).toBe('Erste Zeile');
  });

  it('strips leading Markdown heading markers', () => {
    expect(deriveNoteTitle('## Mein Titel\n\nText')).toBe('Mein Titel');
  });

  it('truncates long first lines with an ellipsis', () => {
    const long = 'a'.repeat(80);
    const result = deriveNoteTitle(long, 60);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(61);
  });

  it('returns the fallback for empty/whitespace bodies', () => {
    expect(deriveNoteTitle('   \n\n', 60, 'Notiz')).toBe('Notiz');
  });
});

describe('extractToolError', () => {
  it('detects an error-shaped content payload that has NO isError flag', () => {
    // This is exactly what create_managed_note returned for a bad type.
    const result = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'invalid-type',
            got: 'note',
            allowed: ['raw-source', 'wiki-article', 'frage-report'],
          }),
        },
      ],
    };
    const error = extractToolError(result);
    expect(error).toContain('invalid-type');
    expect(error).toContain('got: "note"');
    expect(error).toContain('allowed: raw-source, wiki-article, frage-report');
  });

  it('honours the spec isError flag', () => {
    expect(extractToolError({ isError: true, content: [{ type: 'text', text: 'boom' }] })).toBe('boom');
  });

  it('reads an error envelope from structuredContent', () => {
    expect(
      extractToolError({ structuredContent: { error: 'forbidden', message: 'no access' }, content: [] })
    ).toContain('forbidden');
  });

  it('returns null for a genuine success result', () => {
    const ok = { content: [{ type: 'text', text: JSON.stringify({ created: { id: 'RAW/x', path: 'RAW/x.md' } }) }] };
    expect(extractToolError(ok)).toBeNull();
  });

  it('returns null for non-JSON / plain content', () => {
    expect(extractToolError({ content: [{ type: 'text', text: 'all good' }] })).toBeNull();
  });
});
