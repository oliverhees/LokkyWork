/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { openExternalUrl } from '@/renderer/utils/platform';
import { Right } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FeedEntry } from './homeFeedData';
import { CHANGELOG, NEWS } from './homeFeedData';

const FeedItem: React.FC<{ entry: FeedEntry }> = ({ entry }) => {
  const clickable = Boolean(entry.href);
  const open = () => {
    if (entry.href) void openExternalUrl(entry.href).catch((error) => console.error('Failed to open link:', error));
  };
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? open : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
              }
            }
          : undefined
      }
      className={`group flex flex-col gap-2px rounded-8px px-10px py-8px transition-colors ${
        clickable ? 'cursor-pointer hover:bg-fill-2' : ''
      }`}
    >
      <div className='flex items-center gap-6px'>
        {entry.tag ? (
          <span className='shrink-0 rounded-4px bg-fill-3 px-6px py-1px text-10px font-[500] text-t-secondary'>
            {entry.tag}
          </span>
        ) : null}
        <span className='min-w-0 flex-1 truncate text-13px font-[600] text-t-primary'>{entry.title}</span>
        {entry.date ? <span className='shrink-0 text-11px text-t-tertiary'>{entry.date}</span> : null}
        {clickable ? (
          <Right
            theme='outline'
            size={13}
            fill='currentColor'
            className='shrink-0 text-t-tertiary transition-transform group-hover:translate-x-1px'
          />
        ) : null}
      </div>
      {entry.description ? <div className='text-12px leading-18px text-t-secondary'>{entry.description}</div> : null}
    </div>
  );
};

const FeedColumn: React.FC<{ title: string; entries: FeedEntry[] }> = ({ title, entries }) => (
  <div className='flex min-w-0 flex-1 flex-col rounded-12px border border-solid border-border-2 bg-fill-1 p-14px'>
    <div className='mb-8px text-13px font-[600] text-t-secondary'>{title}</div>
    <div className='flex flex-col gap-2px'>
      {entries.map((entry) => (
        <FeedItem key={entry.id} entry={entry} />
      ))}
    </div>
  </div>
);

/**
 * Two-column start-screen feed shown under the input card when no preset
 * assistant is selected: changelog (left) and community news (right).
 */
const HomeFeed: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className='mt-28px flex w-full flex-col gap-12px md:flex-row'>
      <FeedColumn
        title={t('guid.homeFeed.changelogTitle', { defaultValue: '✨ Neu in LokkyWork' })}
        entries={CHANGELOG}
      />
      <FeedColumn title={t('guid.homeFeed.newsTitle', { defaultValue: '📣 Community & News' })} entries={NEWS} />
    </div>
  );
};

export default HomeFeed;
