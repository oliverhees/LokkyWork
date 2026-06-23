/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import { resolveLocaleKey } from '@/common/utils';
import { applyAssistantDeOverrides } from '@renderer/utils/assistant/assistantDeOverrides';
import { resolveExtensionAssetUrl } from '@/renderer/utils/platform';
import { CUSTOM_AVATAR_IMAGE_MAP } from '@renderer/pages/guid/constants';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { Button, Empty, Input, Message, Popconfirm, Radio, Select, Spin } from '@arco-design/web-react';
import { Delete, Edit, Plus, Robot, Search } from '@icon-park/react';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR, { mutate as swrMutate } from 'swr';

type SourceTab = 'all' | 'builtin' | 'user';
type SortOrder = 'name-asc' | 'name-desc';

const localizedName = (assistant: Assistant, localeKey: string): string =>
  assistant.name_i18n?.[localeKey] || assistant.name;

const localizedDescription = (assistant: Assistant, localeKey: string): string =>
  assistant.description_i18n?.[localeKey] || assistant.description_i18n?.['en-US'] || assistant.description || '';

/** Mirror of the avatar resolution used in the Guid assistant cards. */
const resolveAvatar = (
  assistant: Assistant
): { kind: 'image'; value: string } | { kind: 'emoji'; value: string } | { kind: 'icon' } => {
  const avatarValue = assistant.avatar?.trim();
  if (!avatarValue) return { kind: 'icon' };
  const avatarImage = CUSTOM_AVATAR_IMAGE_MAP[avatarValue] || resolveExtensionAssetUrl(avatarValue);
  const isImageAvatar = Boolean(
    avatarImage &&
    (/\.(svg|png|jpe?g|webp|gif)$/i.test(avatarImage) || /^(https?:|file:\/\/|data:|\/)/i.test(avatarImage))
  );
  if (isImageAvatar && avatarImage) return { kind: 'image', value: avatarImage };
  return { kind: 'emoji', value: avatarValue };
};

type AssistantCardProps = {
  assistant: Assistant;
  localeKey: string;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

const AssistantCard: React.FC<AssistantCardProps> = ({ assistant, localeKey, onClick, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const avatar = resolveAvatar(assistant);
  const description = localizedDescription(assistant, localeKey);
  const editable = Boolean(onEdit || onDelete);
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <div
      data-testid={`assistant-card-${assistant.id}`}
      className='group box-border flex h-full cursor-pointer flex-col gap-10px rounded-12px border border-solid border-border-2 bg-fill-1 p-14px transition-all hover:border-primary-5 hover:shadow-md'
      onClick={onClick}
    >
      <div className='flex items-center gap-10px'>
        <div className='flex size-40px shrink-0 items-center justify-center overflow-hidden rounded-10px bg-fill-3 text-t-primary'>
          {avatar.kind === 'image' ? (
            <img src={avatar.value} alt='' className='size-full object-contain' />
          ) : avatar.kind === 'emoji' ? (
            <span className='text-22px leading-none'>{avatar.value}</span>
          ) : (
            <Robot theme='outline' size={20} fill='currentColor' />
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='truncate text-14px font-[600] text-t-primary'>{localizedName(assistant, localeKey)}</div>
        </div>
      </div>
      {description ? <div className='line-clamp-2 text-12px leading-18px text-t-secondary'>{description}</div> : null}
      {editable ? (
        <div className='mt-auto flex items-center justify-end gap-2px pt-4px'>
          {onEdit ? (
            <Button
              type='text'
              size='mini'
              icon={<Edit size='14' />}
              onClick={(e) => {
                stop(e);
                onEdit();
              }}
            >
              {t('common.edit', { defaultValue: 'Bearbeiten' })}
            </Button>
          ) : null}
          {onDelete ? (
            <Popconfirm
              title={t('assistants.overview.deleteConfirm', { defaultValue: 'Diesen Assistenten wirklich löschen?' })}
              onOk={onDelete}
            >
              <Button type='text' size='mini' status='danger' icon={<Delete size='14' />} onClick={stop}>
                {t('common.delete', { defaultValue: 'Löschen' })}
              </Button>
            </Popconfirm>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const AssistantsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const localeKey = resolveLocaleKey(i18n.language);

  const [tab, setTab] = useState<SourceTab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('name-asc');

  const { data, isLoading } = useSWR('assistants.list', async () => {
    try {
      return applyAssistantDeOverrides(await ipcBridge.assistants.list.invoke());
    } catch (error) {
      console.error('[AssistantsPage] Failed to load assistants:', error);
      return [] as Assistant[];
    }
  });

  // Click an assistant → open the start screen with that assistant preselected.
  // This is the proven flow: the personalized start screen loads the assistant's
  // full setup (rules/skills/model) and the first message creates the conversation
  // with its persona applied — exactly like selecting it on the start screen.
  const startChat = (assistant: Assistant) => {
    navigate('/guid', { state: { selectedAgentKey: `custom:${assistant.id}` } });
  };

  const createAssistant = () => {
    navigate('/settings/assistants', { state: { createAssistant: true } });
  };

  const editAssistant = (assistant: Assistant) => {
    navigate('/settings/assistants', { state: { openAssistantId: assistant.id, openAssistantEditor: true } });
  };

  const deleteAssistant = async (assistant: Assistant) => {
    try {
      await ipcBridge.assistants.delete.invoke({ id: assistant.id });
      await swrMutate('assistants.list');
      Message.success(t('assistants.overview.deleteSuccess', { defaultValue: 'Assistent gelöscht.' }));
    } catch (error) {
      Message.error(t('common.failed', { defaultValue: 'Fehlgeschlagen' }) + `: ${String(error)}`);
    }
  };

  const filtered = useMemo(() => {
    const all = (data ?? []).filter((a) => a.enabled !== false);
    const needle = query.trim().toLowerCase();
    const matches = (a: Assistant) => {
      if (tab !== 'all' && a.source !== tab) return false;
      if (!needle) return true;
      return (
        localizedName(a, localeKey).toLowerCase().includes(needle) ||
        localizedDescription(a, localeKey).toLowerCase().includes(needle)
      );
    };
    const sorter = (a: Assistant, b: Assistant) => {
      const cmp = localizedName(a, localeKey).localeCompare(localizedName(b, localeKey));
      return sort === 'name-asc' ? cmp : -cmp;
    };
    const list = all.filter(matches).toSorted(sorter);
    return {
      builtin: list.filter((a) => a.source === 'builtin'),
      user: list.filter((a) => a.source === 'user'),
      total: list.length,
    };
  }, [data, tab, query, sort, localeKey]);

  const renderGroup = (title: string, items: Assistant[], editable: boolean) => {
    if (items.length === 0) return null;
    return (
      <div className='flex w-full flex-col gap-12px'>
        <div className='text-13px font-[600] text-t-secondary'>
          {title} <span className='font-[400] text-t-tertiary'>({items.length})</span>
        </div>
        <div className='grid gap-12px grid-cols-[repeat(auto-fill,minmax(220px,1fr))]'>
          {items.map((assistant) => (
            <AssistantCard
              key={assistant.id}
              assistant={assistant}
              localeKey={localeKey}
              onClick={() => startChat(assistant)}
              onEdit={editable ? () => editAssistant(assistant) : undefined}
              onDelete={editable ? () => void deleteAssistant(assistant) : undefined}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={classNames(
        'w-full min-h-full box-border overflow-y-auto',
        isMobile ? 'px-16px py-14px' : 'px-12px py-24px md:px-40px md:py-32px'
      )}
    >
      <div
        className={classNames(
          'mx-auto flex w-full max-w-900px box-border flex-col',
          isMobile ? 'gap-14px' : 'gap-20px'
        )}
      >
        {/* Header */}
        <div className={classNames('flex w-full flex-col', isMobile ? 'gap-6px' : 'gap-8px')}>
          <div className='flex w-full items-start justify-between gap-12px max-[520px]:flex-wrap'>
            <h1
              className={classNames(
                'm-0 min-w-0 flex-1 font-bold text-t-primary',
                isMobile ? 'text-24px leading-[1.2]' : 'text-28px leading-[1.15]'
              )}
            >
              {t('assistants.overview.title', { defaultValue: 'Assistenten' })}
            </h1>
            <Button
              type='primary'
              shape='round'
              className='shrink-0'
              icon={<Plus theme='outline' size={14} />}
              onClick={createAssistant}
            >
              {t('assistants.overview.newAssistant', { defaultValue: 'Neuer Assistent' })}
            </Button>
          </div>
          <p
            className={classNames(
              'm-0 w-full text-t-secondary',
              isMobile ? 'text-13px leading-20px' : 'text-14px leading-22px'
            )}
          >
            {t('assistants.overview.description', {
              defaultValue: 'Wähle einen Assistenten, um direkt einen Chat zu starten.',
            })}
          </p>
        </div>

        {/* Controls */}
        <div className='flex w-full flex-wrap items-center gap-12px'>
          <Radio.Group
            type='button'
            value={tab}
            onChange={(value) => setTab(value as SourceTab)}
            className='shrink-0 overflow-hidden !rounded-8px'
          >
            <Radio value='all'>{t('assistants.overview.tabAll', { defaultValue: 'Alle' })}</Radio>
            <Radio value='builtin'>{t('assistants.overview.tabSystem', { defaultValue: 'System' })}</Radio>
            <Radio value='user'>{t('assistants.overview.tabMine', { defaultValue: 'Meine' })}</Radio>
          </Radio.Group>
          <Input
            allowClear
            value={query}
            onChange={setQuery}
            prefix={<Search theme='outline' size={14} fill='currentColor' />}
            placeholder={t('assistants.overview.searchPlaceholder', { defaultValue: 'Assistenten suchen …' })}
            className='min-w-180px max-w-280px flex-1 overflow-hidden !rounded-8px'
          />
          <Select
            value={sort}
            onChange={(value) => setSort(value as SortOrder)}
            className='w-160px shrink-0 overflow-hidden !rounded-8px'
          >
            <Select.Option value='name-asc'>
              {t('assistants.overview.sortNameAsc', { defaultValue: 'Name (A–Z)' })}
            </Select.Option>
            <Select.Option value='name-desc'>
              {t('assistants.overview.sortNameDesc', { defaultValue: 'Name (Z–A)' })}
            </Select.Option>
          </Select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className='flex min-h-220px items-center justify-center rounded-16px border border-dashed border-border-2 bg-fill-1'>
            <Spin />
          </div>
        ) : filtered.total === 0 ? (
          <div className='flex min-h-220px items-center justify-center rounded-16px border border-dashed border-border-2 bg-fill-1'>
            <Empty description={t('assistants.overview.empty', { defaultValue: 'Keine Assistenten gefunden.' })} />
          </div>
        ) : (
          <div className='flex w-full flex-col gap-24px'>
            {tab !== 'user' &&
              renderGroup(
                t('assistants.overview.groupSystem', { defaultValue: 'System-Assistenten' }),
                filtered.builtin,
                false
              )}
            {tab !== 'builtin' &&
              renderGroup(
                t('assistants.overview.groupMine', { defaultValue: 'Meine Assistenten' }),
                filtered.user,
                true
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssistantsPage;
