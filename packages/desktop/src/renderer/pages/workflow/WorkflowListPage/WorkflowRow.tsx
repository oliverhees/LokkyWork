/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IWorkflow } from '@/common/types/workflow/workflowTypes';
import { Button, Message, Popconfirm } from '@arco-design/web-react';
import { Delete, Edit, Play } from '@icon-park/react';
import type { WorkflowModelResolver } from '@renderer/services/workflow/WorkflowExecutor';
import useWorkflowExecution from '@renderer/pages/workflow/hooks/useWorkflowExecution';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import WorkflowExecutionPanel from './WorkflowExecutionPanel';

type WorkflowRowProps = {
  workflow: IWorkflow;
  resolveModel: WorkflowModelResolver;
  onDelete: (id: string) => Promise<void>;
};

/**
 * A single workflow card. Owns its own {@link useWorkflowExecution} instance so
 * each workflow can run independently (single concurrent run per row).
 */
const WorkflowRow: React.FC<WorkflowRowProps> = ({ workflow, resolveModel, onDelete }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { execution, running, error, start, cancel } = useWorkflowExecution({ resolveModel });

  const handleEdit = useCallback(() => {
    navigate(`/workflow/${workflow.id}`);
  }, [navigate, workflow.id]);

  const handleRun = useCallback(() => {
    void start(workflow);
  }, [start, workflow]);

  const handleDelete = useCallback(async () => {
    try {
      await onDelete(workflow.id);
      Message.success(t('workflow.deleteSuccess'));
    } catch (err) {
      Message.error(String(err));
    }
  }, [onDelete, workflow.id, t]);

  return (
    <div className='flex w-full flex-col rounded-12px border border-solid border-[var(--color-border-2)] bg-fill-1 px-18px py-16px'>
      <div className='flex items-start justify-between gap-12px'>
        <div className='min-w-0 flex-1'>
          <div className='truncate text-15px font-medium text-t-primary'>{workflow.name || workflow.id}</div>
          <div className='mt-2px text-13px text-t-secondary'>{t('workflow.stepCount', { count: workflow.steps.length })}</div>
          {workflow.description ? <div className='mt-6px break-words text-13px leading-20px text-t-secondary'>{workflow.description}</div> : null}
        </div>
        <div className='flex shrink-0 items-center gap-6px'>
          {running ? (
            <Button size='small' shape='round' onClick={cancel}>
              {t('workflow.execution.cancel')}
            </Button>
          ) : (
            <Button type='primary' size='small' shape='round' icon={<Play size='14' />} disabled={workflow.steps.length === 0} onClick={handleRun}>
              {t('workflow.actions.run')}
            </Button>
          )}
          <Button type='text' size='small' icon={<Edit size='14' />} onClick={handleEdit}>
            {t('workflow.actions.edit')}
          </Button>
          <Popconfirm title={t('workflow.deleteConfirm')} onOk={handleDelete}>
            <Button type='text' size='small' status='danger' icon={<Delete size='14' />}>
              {t('workflow.actions.delete')}
            </Button>
          </Popconfirm>
        </div>
      </div>

      {error ? <div className='mt-8px text-13px text-[var(--color-danger-6)]'>{t('workflow.runError')}</div> : null}

      <WorkflowExecutionPanel workflow={workflow} execution={execution} />
    </div>
  );
};

export default WorkflowRow;
