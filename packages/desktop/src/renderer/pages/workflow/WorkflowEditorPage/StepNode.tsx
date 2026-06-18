/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TWorkflowStepBackend, TWorkflowStepStatus } from '@/common/types/workflow/workflowTypes';
import { Button, Tag } from '@arco-design/web-react';
import { Right } from '@icon-park/react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/** Arco tag colors per step status — semantic, no hardcoded hex. */
const STATUS_COLOR: Record<TWorkflowStepStatus, 'gray' | 'arcoblue' | 'green' | 'red' | 'orange'> = {
  pending: 'gray',
  running: 'arcoblue',
  completed: 'green',
  error: 'red',
  skipped: 'orange',
};

/** Max characters of step output shown inline on a node. */
const OUTPUT_PREVIEW_LIMIT = 160;

/** Data carried by a workflow step node on the canvas. */
export type StepNodeData = {
  label: string;
  backend: TWorkflowStepBackend;
  order: number;
  /** Live execution status of this step, when a run is in flight/finished. */
  status?: TWorkflowStepStatus;
  /** True when this is the step currently executing (current_step_index). */
  active?: boolean;
  /** Latest output produced by the step, for an inline preview. */
  output?: string;
  /** Conversation produced by this step's run, if it has started. */
  conversationId?: string;
  /** Opens the step's conversation; only meaningful with a conversationId. */
  onViewChat?: () => void;
};

/**
 * A single workflow step rendered as a react-flow node. Shows the step order,
 * name and backend. Handles wire it into the linear chain (target on top,
 * source on bottom) so the order is visible as a vertical connection.
 *
 * During an execution (LOKYY-9) the node mirrors its live step status: a status
 * tag is shown, the currently running step is ring-highlighted, and a truncated
 * preview of the step output appears below.
 *
 * Once a step has produced a conversation (LOKYY-10) a "View Chat" link opens it;
 * a step that has run but has no conversation yet shows a short hint instead.
 */
const StepNode: React.FC<NodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const { label, backend, order, status, active, output, conversationId, onViewChat } = data as StepNodeData;

  const preview = output?.trim();
  const truncated = preview && preview.length > OUTPUT_PREVIEW_LIMIT ? `${preview.slice(0, OUTPUT_PREVIEW_LIMIT)}…` : preview;

  const ringClass = active ? 'border-[var(--color-primary-6)] shadow-md' : status === 'completed' ? 'border-[var(--color-success-6)]' : status === 'error' ? 'border-[var(--color-danger-6)]' : 'border-[var(--color-border-2)]';

  return (
    <div className={`min-w-200px max-w-260px rounded-12px border border-solid bg-fill-1 px-14px py-12px shadow-sm ${ringClass}`}>
      <Handle type='target' position={Position.Top} />
      <div className='flex items-center gap-8px'>
        <span className='inline-flex size-22px shrink-0 items-center justify-center rounded-full bg-fill-3 text-12px font-medium text-t-secondary'>{order}</span>
        <span className='min-w-0 flex-1 truncate text-14px font-medium text-t-primary'>{label}</span>
        {status ? (
          <Tag size='small' color={STATUS_COLOR[status]}>
            {t(`workflow.execution.stepStatus.${status}`)}
          </Tag>
        ) : null}
      </div>
      <div className='mt-8px flex items-center gap-6px'>
        <span className='text-12px text-t-tertiary'>{t('workflow.editor.node.backend')}</span>
        <Tag size='small' color='arcoblue'>
          {backend}
        </Tag>
      </div>
      {truncated ? <div className='mt-8px max-h-60px overflow-hidden border-0 border-t border-solid border-[var(--color-border-2)] pt-8px text-12px leading-18px text-t-secondary'>{truncated}</div> : null}
      {conversationId ? (
        <div className='nodrag mt-8px'>
          <Button type='text' size='mini' icon={<Right size='14' />} onClick={onViewChat}>
            {t('workflow.actions.viewChat')}
          </Button>
        </div>
      ) : status && status !== 'pending' ? (
        <div className='mt-8px text-12px text-t-tertiary'>{t('workflow.editor.node.noConversation')}</div>
      ) : null}
      <Handle type='source' position={Position.Bottom} />
    </div>
  );
};

export default StepNode;
