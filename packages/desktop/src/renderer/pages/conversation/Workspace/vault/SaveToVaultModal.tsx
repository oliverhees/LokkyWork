/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * "Merken" modal (CODE-53): save content into the Second-Brain vault as a managed
 * note via `create_managed_note`, routed through the Main-process MCP bridge
 * ({@link callVaultTool}). Read-only preview plus an editable title, a note-type
 * select, and optional comma-separated tags.
 *
 * Generic over what gets saved: callers pass arbitrary `content` plus an optional
 * `defaultTitle`/`defaultType`. Used both for a single chat message (per-message
 * "Merken") and for a whole-chat transcript (header "🧠"). The chat rendering is
 * untouched. The Bearer token never surfaces (it stays in the server transport).
 */

import MarkdownView from '@/renderer/components/Markdown';
import { Input, Message, Modal, Select } from '@arco-design/web-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VAULT_CREATE_TOOL, type VaultServer } from './vaultDetect';
import { deriveNoteTitle, pickNamedArg } from './vaultParse';
import { callVaultTool } from './vaultClient';

/**
 * Note types accepted by `create_managed_note`. These are the server's REQUIRED
 * `type` enum — the vault maps each to its canonical folder internally. They must
 * match the live schema exactly; sending anything else fails with `invalid-type`.
 */
export const NOTE_TYPES = ['raw-source', 'wiki-article', 'frage-report'] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

const SaveToVaultModal: React.FC<{
  visible: boolean;
  server: VaultServer;
  /** The text that becomes the note body. */
  content: string;
  /** Pre-filled title; falls back to a title derived from `content`. */
  defaultTitle?: string;
  /** Pre-selected note type (defaults to `raw-source`). */
  defaultType?: NoteType;
  onClose: () => void;
}> = ({ visible, server, content, defaultTitle, defaultType = 'raw-source', onClose }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<NoteType>(defaultType);
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset the form to sensible defaults each time the modal opens.
  useEffect(() => {
    if (visible) {
      const fallback = t('conversation.vault.save.untitled', { defaultValue: 'Notiz' });
      setTitle(defaultTitle?.trim() || deriveNoteTitle(content, 60, fallback));
      setType(defaultType);
      setTagsInput('');
    }
  }, [visible, content, defaultTitle, defaultType, t]);

  const typeLabels: Record<NoteType, string> = {
    'raw-source': t('conversation.vault.save.typeRawSource', { defaultValue: 'Rohnotiz / Quelle' }),
    'wiki-article': t('conversation.vault.save.typeWikiArticle', { defaultValue: 'Wiki-Artikel' }),
    'frage-report': t('conversation.vault.save.typeFrageReport', { defaultValue: 'Frage-Report' }),
  };

  const handleSave = async () => {
    if (!server.createTool) return;
    setSaving(true);
    const schema = server.createTool.input_schema;
    const finalTitle =
      title.trim() || deriveNoteTitle(content, 60, t('conversation.vault.save.untitled', { defaultValue: 'Notiz' }));
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const args: Record<string, unknown> = {
      [pickNamedArg(schema, ['title', 'name', 'heading'], 'title')]: finalTitle,
      [pickNamedArg(schema, ['type', 'category', 'kind', 'folder'], 'type')]: type,
      [pickNamedArg(schema, ['body', 'content', 'text', 'markdown', 'note'], 'body')]: content,
    };
    if (tags.length) {
      args[pickNamedArg(schema, ['tags', 'labels', 'keywords'], 'tags')] = tags;
    }

    const res = await callVaultTool(
      server,
      VAULT_CREATE_TOOL,
      args,
      t('conversation.workspace.vault.desktopOnly', { defaultValue: 'Nur in der Desktop-App verfügbar.' })
    );
    setSaving(false);
    if (res.ok) {
      Message.success(t('conversation.vault.save.success', { defaultValue: 'Im Second Brain gespeichert' }));
      onClose();
    } else {
      Message.error(res.error || t('conversation.vault.save.error', { defaultValue: 'Speichern fehlgeschlagen' }));
    }
  };

  return (
    <Modal
      visible={visible}
      title={t('conversation.vault.save.title', { defaultValue: 'Im Second Brain merken' })}
      onCancel={onClose}
      onOk={() => void handleSave()}
      confirmLoading={saving}
      okText={t('conversation.vault.save.confirm', { defaultValue: 'Speichern' })}
      cancelText={t('common.cancel', { defaultValue: 'Abbrechen' })}
      autoFocus={false}
      unmountOnExit
    >
      <div className='flex flex-col gap-12px'>
        <label className='flex flex-col gap-4px'>
          <span className='text-12px text-t-secondary'>
            {t('conversation.vault.save.titleLabel', { defaultValue: 'Titel' })}
          </span>
          <Input value={title} onChange={setTitle} maxLength={200} showWordLimit />
        </label>

        <label className='flex flex-col gap-4px'>
          <span className='text-12px text-t-secondary'>
            {t('conversation.vault.save.typeLabel', { defaultValue: 'Typ' })}
          </span>
          <Select value={type} onChange={(value) => setType(value as NoteType)}>
            {NOTE_TYPES.map((noteType) => (
              <Select.Option key={noteType} value={noteType}>
                {typeLabels[noteType]}
              </Select.Option>
            ))}
          </Select>
        </label>

        <label className='flex flex-col gap-4px'>
          <span className='text-12px text-t-secondary'>
            {t('conversation.vault.save.tagsLabel', { defaultValue: 'Tags (kommagetrennt, optional)' })}
          </span>
          <Input
            value={tagsInput}
            onChange={setTagsInput}
            placeholder={t('conversation.vault.save.tagsPlaceholder', { defaultValue: 'z. B. idee, projekt-x' })}
          />
        </label>

        <div className='flex flex-col gap-4px'>
          <span className='text-12px text-t-secondary'>
            {t('conversation.vault.save.previewLabel', { defaultValue: 'Vorschau' })}
          </span>
          <div className='max-h-200px overflow-auto rounded-6px border border-border-2 px-12px py-8px text-13px leading-22px text-t-secondary bg-2'>
            <MarkdownView hiddenCodeCopyButton>{content}</MarkdownView>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SaveToVaultModal;
