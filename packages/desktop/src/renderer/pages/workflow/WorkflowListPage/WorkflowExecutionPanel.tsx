/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IWorkflow, IWorkflowExecution, TWorkflowStepStatus } from '@/common/types/workflow/workflowTypes';
import { Button, Tag } from '@arco-design/web-react';
import { Right } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

type StatusColor = 'gray' | 'arcoblue' | 'green' | 'red' | 'orange';

const STEP_STATUS_COLOR: Record<TWorkflowStepStatus, StatusColor> = {
  pending: 'gray',
  running: 'arcoblue',
  completed: 'green',
  error: 'red',
  skipped: 'orange',
};

type WorkflowExecutionPanelProps = {
  workflow: IWorkflow;
  execution: IWorkflowExecution | null;
};

/**
 * Renders the live per-step status of a running/finished execution plus a
 * "View Chat" link to each step's conversation once it exists.
 */
const WorkflowExecutionPanel: React.FC<WorkflowExecutionPanelProps> = ({ workflow, execution }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!execution) return null;

  const orderedSteps = [...workflow.steps].toSorted((a, b) => a.order - b.order);

  return (
    <div className='mt-12px rounded-12px border border-solid border-[var(--color-border-2)] bg-fill-2 px-14px py-12px'>
      <div className='mb-10px flex items-center gap-8px'>
        <span className='text-13px font-medium text-t-primary'>{t('workflow.execution.title')}</span>
        <Tag
          size='small'
          color={execution.status === 'error' ? 'red' : execution.status === 'completed' ? 'green' : 'arcoblue'}
        >
          {t(`workflow.execution.status.${execution.status}`)}
        </Tag>
      </div>

      <div className='flex flex-col gap-8px'>
        {execution.step_results.map((result, index) => {
          const step = orderedSteps[index];
          const label = step?.name?.trim() || t('workflow.form.step.title', { index: index + 1 });
          return (
            <div key={result.step_id} className='flex items-center justify-between gap-10px'>
              <div className='flex min-w-0 items-center gap-8px'>
                <Tag size='small' color={STEP_STATUS_COLOR[result.status]}>
                  {t(`workflow.execution.stepStatus.${result.status}`)}
                </Tag>
                <span className='min-w-0 truncate text-13px text-t-primary'>{label}</span>
              </div>
              {result.conversation_id ? (
                <Button
                  type='text'
                  size='mini'
                  icon={<Right size='14' />}
                  onClick={() => navigate(`/conversation/${result.conversation_id}`)}
                >
                  {t('workflow.actions.viewChat')}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowExecutionPanel;
