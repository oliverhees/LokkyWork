/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IWorkflow } from '@/common/types/workflow/workflowTypes';
import { Button, Empty, Message, Spin } from '@arco-design/web-react';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import useWorkflows from '@renderer/pages/workflow/hooks/useWorkflows';
import { useWorkflowModelResolver } from '@renderer/pages/workflow/hooks/useWorkflowExecution';
import classNames from 'classnames';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CreateWorkflowDialog from './CreateWorkflowDialog';
import WorkflowRow from './WorkflowRow';

const WorkflowListPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const { workflows, loading, hasWorkflows, updateWorkflow, deleteWorkflow } = useWorkflows();
  const resolveModel = useWorkflowModelResolver();

  const [dialogVisible, setDialogVisible] = useState(false);
  const [editWorkflow, setEditWorkflow] = useState<IWorkflow | undefined>(undefined);

  const handleNew = useCallback(() => {
    setEditWorkflow(undefined);
    setDialogVisible(true);
  }, []);

  const handleEdit = useCallback((workflow: IWorkflow) => {
    setEditWorkflow(workflow);
    setDialogVisible(true);
  }, []);

  const handleSave = useCallback(
    async (workflow: IWorkflow) => {
      await updateWorkflow(workflow);
      Message.success(t('workflow.form.save'));
    },
    [updateWorkflow, t]
  );

  return (
    <div className={classNames('w-full min-h-full box-border overflow-y-auto', isMobile ? 'px-16px py-14px' : 'px-12px py-24px md:px-40px md:py-32px')}>
      <div className={classNames('mx-auto flex w-full max-w-800px box-border flex-col', isMobile ? 'gap-14px' : 'gap-16px')}>
        <div className={classNames('flex w-full flex-col', isMobile ? 'gap-6px' : 'gap-8px')}>
          <div className='flex w-full items-start justify-between gap-12px sm:gap-16px max-[520px]:flex-wrap'>
            <h1 className={classNames('m-0 min-w-0 flex-1 font-bold text-t-primary', isMobile ? 'text-24px leading-[1.2]' : 'text-28px leading-[1.15]')}>{t('workflow.title')}</h1>
            <Button type='primary' shape='round' className='shrink-0' onClick={handleNew}>
              {t('workflow.newWorkflow')}
            </Button>
          </div>
          <p className={classNames('m-0 w-full text-t-secondary', isMobile ? 'text-13px leading-20px' : 'text-14px leading-22px')}>{t('workflow.description')}</p>
        </div>

        {loading ? (
          <div className='flex min-h-220px items-center justify-center rounded-16px border border-dashed border-border-2 bg-fill-1'>
            <Spin />
          </div>
        ) : !hasWorkflows ? (
          <div className='flex min-h-220px items-center justify-center rounded-16px border border-dashed border-border-2 bg-fill-1'>
            <Empty description={t('workflow.empty')} />
          </div>
        ) : (
          <div className='flex w-full flex-col gap-12px'>
            {workflows.map((workflow) => (
              <WorkflowRow key={workflow.id} workflow={workflow} resolveModel={resolveModel} onEdit={handleEdit} onDelete={deleteWorkflow} />
            ))}
          </div>
        )}

        <CreateWorkflowDialog visible={dialogVisible} editWorkflow={editWorkflow} onClose={() => setDialogVisible(false)} onSave={handleSave} />
      </div>
    </div>
  );
};

export default WorkflowListPage;
