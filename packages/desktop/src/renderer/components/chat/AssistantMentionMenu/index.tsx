/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AssistantMentionSource } from '@/renderer/utils/chat/assistantMentionQuery';
import { slugifyAssistantName } from '@/renderer/utils/chat/assistantMentionQuery';
import { Robot } from '@icon-park/react';
import React from 'react';

type AssistantMentionMenuProps = {
  activeIndex: number;
  emptyText: string;
  items: AssistantMentionSource[];
  label: string;
  onHoverItem: (index: number) => void;
  onSelectItem: (item: AssistantMentionSource) => void;
};

/**
 * Dropdown for `@`-mentioning a preset assistant in the running chat (CODE-37).
 * Mirrors AtFileMenu's styling for a consistent look; selecting an item inserts
 * `@slug` into the input.
 */
const AssistantMentionMenu: React.FC<AssistantMentionMenuProps> = ({
  activeIndex,
  emptyText,
  items,
  label,
  onHoverItem,
  onSelectItem,
}) => {
  return (
    <div
      className='rounded-14px border border-solid overflow-hidden p-6px flex flex-col gap-2px'
      style={{
        borderColor: 'var(--color-border-2)',
        background: 'color-mix(in srgb, var(--color-bg-1) 94%, transparent)',
        backdropFilter: 'blur(14px) saturate(1.05)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.05)',
      }}
      role='listbox'
      aria-label={label}
    >
      {items.length === 0 ? (
        <div className='px-12px py-10px text-12px text-t-secondary'>{emptyText}</div>
      ) : (
        items.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={item.id}
              role='option'
              aria-selected={isActive}
              className='flex items-center gap-8px px-12px py-8px rounded-10px cursor-pointer transition-colors'
              style={{ background: isActive ? 'var(--color-fill-2)' : 'transparent' }}
              onMouseEnter={() => onHoverItem(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelectItem(item);
              }}
            >
              <span className='flex size-22px shrink-0 items-center justify-center rounded-6px bg-fill-3 text-t-secondary'>
                <Robot theme='outline' size={14} fill='currentColor' />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block text-13px font-medium text-t-primary truncate'>{item.name}</span>
                <span className='block text-12px text-t-secondary truncate'>@{slugifyAssistantName(item.name)}</span>
              </span>
            </div>
          );
        })
      )}
    </div>
  );
};

export default AssistantMentionMenu;
