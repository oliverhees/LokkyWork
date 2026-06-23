/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Header action (CODE-53): save the WHOLE chat into the Second-Brain vault as one
 * note. Uses the 🧠 emoji (deliberately distinct from the per-message `Brain`
 * outline icon). Only rendered when a write-capable vault is connected.
 *
 * On click it fetches the conversation's messages, builds a Markdown transcript
 * ({@link buildChatTranscript}), and opens the shared {@link SaveToVaultModal}
 * pre-filled for a whole chat (title = conversation name, type = note).
 */

import { ipcBridge } from '@/common';
import { Button, Tooltip } from '@arco-design/web-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SaveToVaultModal from './SaveToVaultModal';
import { useVaultServer } from './useVaultServer';
import { deriveNoteTitle } from './vaultParse';
import { buildChatTranscript, extractTranscriptEntries, firstUserText } from './vaultTranscript';

const SaveChatToVaultButton: React.FC<{
  conversation_id: string;
  conversationName?: string;
  assistantName?: string;
}> = ({ conversation_id, conversationName, assistantName }) => {
  const { t } = useTranslation();
  const vaultServer = useVaultServer();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [defaultTitle, setDefaultTitle] = useState('');

  // Only offer this when the vault can actually be written to.
  if (!vaultServer?.createTool) return null;

  const handleOpen = async () => {
    setLoading(true);
    const userLabel = t('conversation.vault.save.roleUser', { defaultValue: 'Du' });
    const assistantLabel =
      assistantName?.trim() || t('conversation.vault.save.roleAssistant', { defaultValue: 'Assistent' });
    const fallbackTitle = t('conversation.vault.save.chatUntitled', { defaultValue: 'Chat-Notiz' });
    try {
      const result = await ipcBridge.database.getConversationMessages.invoke({
        conversation_id,
        page: 0,
        page_size: 10000,
      });
      const entries = extractTranscriptEntries(result?.items ?? [], conversation_id);
      setContent(buildChatTranscript(entries, { userLabel, assistantLabel }));
      setDefaultTitle(conversationName?.trim() || deriveNoteTitle(firstUserText(entries), 60, fallbackTitle));
    } catch {
      setContent('');
      setDefaultTitle(conversationName?.trim() || fallbackTitle);
    }
    setLoading(false);
    setVisible(true);
  };

  return (
    <>
      <Tooltip
        content={t('conversation.vault.save.chatAction', { defaultValue: 'Ganzen Chat im Second Brain merken' })}
      >
        <Button size='mini' loading={loading} onClick={() => void handleOpen()}>
          <span className='text-14px leading-none'>🧠</span>
        </Button>
      </Tooltip>
      <SaveToVaultModal
        visible={visible}
        server={vaultServer}
        content={content}
        defaultTitle={defaultTitle}
        defaultType='wiki-article'
        onClose={() => setVisible(false)}
      />
    </>
  );
};

export default SaveChatToVaultButton;
