/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IWorkflow, IWorkflowStep, TWorkflowInputMode, TWorkflowStepBackend } from '@/common/types/workflow/workflowTypes';
import { ipcBridge } from '@/common';
import { uuid } from '@/common/utils';
import { Button, Form, Input, Message, Select } from '@arco-design/web-react';
import { ArrowDown, ArrowUp, Delete, Plus } from '@icon-park/react';
import ModalWrapper from '@renderer/components/base/ModalWrapper';
import { useModelProviderList } from '@renderer/hooks/agent/useModelProviderList';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

const FormItem = Form.Item;
const TextArea = Input.TextArea;
const Option = Select.Option;

/** Draft step shape — same as IWorkflowStep but `order` is derived on save. */
type DraftStep = Omit<IWorkflowStep, 'order'>;

const BACKEND_OPTIONS: TWorkflowStepBackend[] = ['acp', 'gemini', 'codex', 'aionrs', 'openclaw', 'nanobot'];
const INPUT_MODE_OPTIONS: TWorkflowInputMode[] = ['none', 'append', 'template'];

type CreateWorkflowDialogProps = {
  visible: boolean;
  onClose: () => void;
  /** Persist the workflow (create or update). */
  onSave: (workflow: IWorkflow) => Promise<unknown>;
  /** When set, the dialog edits this workflow instead of creating a new one. */
  editWorkflow?: IWorkflow;
};

function createDraftStep(): DraftStep {
  return {
    id: uuid(36),
    name: '',
    backend: 'acp',
    model: undefined,
    prompt_template: '',
    input_mode: 'append',
  };
}

const CreateWorkflowDialog: React.FC<CreateWorkflowDialogProps> = ({ visible, onClose, onSave, editWorkflow }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isEditMode = !!editWorkflow;

  useEffect(() => {
    if (!visible) return;
    if (editWorkflow) {
      form.setFieldsValue({ name: editWorkflow.name, description: editWorkflow.description });
      const ordered = [...editWorkflow.steps].toSorted((a, b) => a.order - b.order);
      setSteps(ordered.map(({ order: _order, ...rest }) => rest));
    } else {
      form.resetFields();
      setSteps([createDraftStep()]);
    }
  }, [visible, editWorkflow, form]);

  const backendOptions = useMemo(() => BACKEND_OPTIONS, []);

  // Deduplicated list of real, configured model names. The step persists only
  // the model name; useWorkflowModelResolver matches it back against the
  // provider list, so a free-text value that no provider offers would make
  // every step fail with "No model configured". Selecting from this list keeps
  // the stored value resolvable.
  const { providers, getAvailableModels } = useModelProviderList();
  const modelOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: string[] = [];
    for (const provider of providers) {
      for (const modelName of getAvailableModels(provider)) {
        if (!seen.has(modelName)) {
          seen.add(modelName);
          opts.push(modelName);
        }
      }
    }
    return opts;
  }, [providers, getAvailableModels]);

  // Available skills for per-step selection. A step persists skill names
  // (string[]); the executor passes them through as extra.preset_enabled_skills.
  // Selecting from the real /api/skills index keeps the names valid.
  const { data: availableSkills } = useSWR('workflow-available-skills', () => ipcBridge.fs.listAvailableSkills.invoke());
  const skillOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const skill of availableSkills ?? []) {
      if (skill?.name && !seen.has(skill.name)) {
        seen.add(skill.name);
        opts.push({ value: skill.name, label: skill.name });
      }
    }
    return opts;
  }, [availableSkills]);

  const handleAddStep = () => {
    setSteps((prev) => [...prev, createDraftStep()]);
  };

  const handleRemoveStep = (id: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
  };

  const handleMoveStep = (index: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateStep = (id: string, patch: Partial<DraftStep>) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      if (steps.length === 0) {
        Message.error(t('workflow.form.stepRequired'));
        return;
      }
      setSubmitting(true);
      const now = Date.now();
      const orderedSteps: IWorkflowStep[] = steps.map((step, index) => ({
        ...step,
        order: index + 1,
        model: step.model?.trim() ? step.model.trim() : undefined,
      }));
      const workflow: IWorkflow = {
        id: editWorkflow?.id ?? uuid(36),
        name: values.name,
        description: values.description?.trim() ? values.description.trim() : undefined,
        steps: orderedSteps,
        created_at: editWorkflow?.created_at ?? now,
        updated_at: now,
      };
      await onSave(workflow);
      onClose();
    } catch {
      // Form validation failure or save error — keep the dialog open.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper
      title={isEditMode ? t('workflow.form.edit') : t('workflow.form.create')}
      visible={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText={t('workflow.form.save')}
      cancelText={t('workflow.form.cancel')}
      className='w-[min(640px,calc(100vw-32px))] max-w-640px rd-16px'
      unmountOnExit
    >
      <div className='overflow-y-auto px-24px pb-16px pr-18px max-h-[min(70vh,680px)]'>
        <Form form={form} layout='vertical'>
          <FormItem label={t('workflow.form.name')} field='name' rules={[{ required: true, message: t('workflow.form.nameRequired') }]}>
            <Input placeholder={t('workflow.form.namePlaceholder')} />
          </FormItem>

          <FormItem label={t('workflow.form.description')} field='description'>
            <Input placeholder={t('workflow.form.descriptionPlaceholder')} />
          </FormItem>
        </Form>

        <div className='mt-8px flex items-center justify-between'>
          <span className='text-14px font-medium text-t-primary'>{t('workflow.form.steps')}</span>
          <Button type='outline' size='small' shape='round' icon={<Plus size='14' />} onClick={handleAddStep}>
            {t('workflow.form.addStep')}
          </Button>
        </div>

        {steps.length === 0 ? (
          <p className='mt-12px text-13px leading-20px text-t-secondary'>{t('workflow.form.noSteps')}</p>
        ) : (
          <div className='mt-12px flex flex-col gap-12px'>
            {steps.map((step, index) => (
              <div key={step.id} className='rounded-12px border border-solid border-[var(--color-border-2)] bg-fill-1 px-14px py-12px'>
                <div className='mb-10px flex items-center justify-between gap-8px'>
                  <span className='text-13px font-medium text-t-primary'>{t('workflow.form.step.title', { index: index + 1 })}</span>
                  <div className='flex items-center gap-4px'>
                    <Button type='text' size='mini' disabled={index === 0} title={t('workflow.form.moveUp')} icon={<ArrowUp size='14' />} onClick={() => handleMoveStep(index, -1)} />
                    <Button type='text' size='mini' disabled={index === steps.length - 1} title={t('workflow.form.moveDown')} icon={<ArrowDown size='14' />} onClick={() => handleMoveStep(index, 1)} />
                    <Button type='text' size='mini' status='danger' title={t('workflow.form.removeStep')} icon={<Delete size='14' />} onClick={() => handleRemoveStep(step.id)} />
                  </div>
                </div>

                <div className='grid gap-x-12px gap-y-10px md:grid-cols-2'>
                  <div className='min-w-0'>
                    <label className='mb-6px block text-12px font-medium text-t-secondary'>{t('workflow.form.step.name')}</label>
                    <Input size='small' value={step.name} placeholder={t('workflow.form.step.namePlaceholder')} onChange={(value) => updateStep(step.id, { name: value })} />
                  </div>
                  <div className='min-w-0'>
                    <label className='mb-6px block text-12px font-medium text-t-secondary'>{t('workflow.form.step.backend')}</label>
                    <Select size='small' value={step.backend} onChange={(value) => updateStep(step.id, { backend: value as TWorkflowStepBackend })}>
                      {backendOptions.map((backend) => (
                        <Option key={backend} value={backend}>
                          {backend}
                        </Option>
                      ))}
                    </Select>
                  </div>
                  <div className='min-w-0'>
                    <label className='mb-6px block text-12px font-medium text-t-secondary'>{t('workflow.form.step.model')}</label>
                    <Select size='small' showSearch allowClear value={step.model ?? undefined} placeholder={t('workflow.form.step.modelPlaceholder')} notFoundContent={t('workflow.form.step.noModels')} onChange={(value) => updateStep(step.id, { model: (value as string | undefined) || undefined })}>
                      {modelOptions.map((modelName) => (
                        <Option key={modelName} value={modelName}>
                          {modelName}
                        </Option>
                      ))}
                    </Select>
                  </div>
                  <div className='min-w-0'>
                    <label className='mb-6px block text-12px font-medium text-t-secondary'>{t('workflow.form.step.inputMode')}</label>
                    <Select size='small' value={step.input_mode} onChange={(value) => updateStep(step.id, { input_mode: value as TWorkflowInputMode })}>
                      {INPUT_MODE_OPTIONS.map((mode) => (
                        <Option key={mode} value={mode}>
                          {t(`workflow.form.inputMode.${mode}`)}
                        </Option>
                      ))}
                    </Select>
                  </div>
                  <div className='min-w-0 md:col-span-2'>
                    <label className='mb-6px block text-12px font-medium text-t-secondary'>{t('workflow.form.step.skills')}</label>
                    <Select size='small' mode='multiple' showSearch allowClear placeholder={t('workflow.form.step.skillsPlaceholder')} notFoundContent={t('workflow.form.step.noSkills')} value={step.skills ?? []} onChange={(value) => updateStep(step.id, { skills: ((value as string[]) ?? []).filter(Boolean) })}>
                      {skillOptions.map((skill) => (
                        <Option key={skill.value} value={skill.value}>
                          {skill.label}
                        </Option>
                      ))}
                    </Select>
                  </div>
                  <div className='min-w-0 md:col-span-2'>
                    <label className='mb-6px block text-12px font-medium text-t-secondary'>{t('workflow.form.step.prompt')}</label>
                    <TextArea value={step.prompt_template} placeholder={t('workflow.form.step.promptPlaceholder')} autoSize={{ minRows: 2, maxRows: 6 }} onChange={(value) => updateStep(step.id, { prompt_template: value })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

export default CreateWorkflowDialog;
