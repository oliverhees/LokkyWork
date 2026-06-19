/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reusable step-configuration form fields (LOKYY-8). Renders the editable
 * fields of a single workflow step — name, backend, model, skills, input mode
 * and prompt — and reports changes via {@link onChange}. Both the create/edit
 * dialog ({@link CreateWorkflowDialog}) and the visual canvas editor
 * ({@link WorkflowEditorPage}) embed this so the fields stay DRY.
 *
 * The data model is a LINEAR chain ({@link IWorkflowStep} `order`); this panel
 * only edits a single step's attributes — `order` is derived from chain
 * position by the caller, never by this component.
 */

import type { IWorkflowStep, TWorkflowInputMode, TWorkflowStepBackend } from '@/common/types/workflow/workflowTypes';
import { ipcBridge } from '@/common';
import { Input, Select } from '@arco-design/web-react';
import { useModelProviderList } from '@renderer/hooks/agent/useModelProviderList';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

const TextArea = Input.TextArea;
const Option = Select.Option;

/** Draft step shape — same as IWorkflowStep but `order` is derived on save. */
export type DraftStep = Omit<IWorkflowStep, 'order'>;

/** Backend kinds a step can run on. Mirrors {@link TWorkflowStepBackend}. */
export const BACKEND_OPTIONS: TWorkflowStepBackend[] = ['acp', 'gemini', 'codex', 'aionrs', 'openclaw', 'nanobot'];
/** Supported upstream-input modes. Mirrors {@link TWorkflowInputMode}. */
export const INPUT_MODE_OPTIONS: TWorkflowInputMode[] = ['none', 'append', 'template'];

type StepConfigPanelProps = {
  /** The step being edited. */
  step: DraftStep;
  /** Patch the step with the given partial change. */
  onChange: (patch: Partial<DraftStep>) => void;
};

/**
 * Editable fields for a single workflow step. Stateless — the parent owns the
 * step state and applies patches via {@link onChange}.
 */
const StepConfigPanel: React.FC<StepConfigPanelProps> = ({ step, onChange }) => {
  const { t } = useTranslation();

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
  const { data: availableSkills } = useSWR('workflow-available-skills', () =>
    ipcBridge.fs.listAvailableSkills.invoke()
  );
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

  return (
    <div className='grid gap-x-12px gap-y-10px md:grid-cols-2'>
      <div className='min-w-0'>
        <label className='mb-6px block text-12px font-medium text-t-secondary'>{t('workflow.form.step.name')}</label>
        <Input
          size='small'
          value={step.name}
          placeholder={t('workflow.form.step.namePlaceholder')}
          onChange={(value) => onChange({ name: value })}
        />
      </div>
      <div className='min-w-0'>
        <label className='mb-6px block text-12px font-medium text-t-secondary'>{t('workflow.form.step.backend')}</label>
        <Select
          size='small'
          value={step.backend}
          onChange={(value) => onChange({ backend: value as TWorkflowStepBackend })}
        >
          {BACKEND_OPTIONS.map((backend) => (
            <Option key={backend} value={backend}>
              {backend}
            </Option>
          ))}
        </Select>
      </div>
      <div className='min-w-0'>
        <label className='mb-6px block text-12px font-medium text-t-secondary'>{t('workflow.form.step.model')}</label>
        <Select
          size='small'
          showSearch
          allowClear
          value={step.model ?? undefined}
          placeholder={t('workflow.form.step.modelPlaceholder')}
          notFoundContent={t('workflow.form.step.noModels')}
          onChange={(value) => onChange({ model: (value as string | undefined) || undefined })}
        >
          {modelOptions.map((modelName) => (
            <Option key={modelName} value={modelName}>
              {modelName}
            </Option>
          ))}
        </Select>
      </div>
      <div className='min-w-0'>
        <label className='mb-6px block text-12px font-medium text-t-secondary'>
          {t('workflow.form.step.inputMode')}
        </label>
        <Select
          size='small'
          value={step.input_mode}
          onChange={(value) => onChange({ input_mode: value as TWorkflowInputMode })}
        >
          {INPUT_MODE_OPTIONS.map((mode) => (
            <Option key={mode} value={mode}>
              {t(`workflow.form.inputMode.${mode}`)}
            </Option>
          ))}
        </Select>
      </div>
      <div className='min-w-0 md:col-span-2'>
        <label className='mb-6px block text-12px font-medium text-t-secondary'>{t('workflow.form.step.skills')}</label>
        <Select
          size='small'
          mode='multiple'
          showSearch
          allowClear
          placeholder={t('workflow.form.step.skillsPlaceholder')}
          notFoundContent={t('workflow.form.step.noSkills')}
          value={step.skills ?? []}
          onChange={(value) => onChange({ skills: ((value as string[]) ?? []).filter(Boolean) })}
        >
          {skillOptions.map((skill) => (
            <Option key={skill.value} value={skill.value}>
              {skill.label}
            </Option>
          ))}
        </Select>
      </div>
      <div className='min-w-0 md:col-span-2'>
        <label className='mb-6px block text-12px font-medium text-t-secondary'>{t('workflow.form.step.prompt')}</label>
        <TextArea
          value={step.prompt_template}
          placeholder={t('workflow.form.step.promptPlaceholder')}
          autoSize={{ minRows: 2, maxRows: 6 }}
          onChange={(value) => onChange({ prompt_template: value })}
        />
      </div>
    </div>
  );
};

export default StepConfigPanel;
