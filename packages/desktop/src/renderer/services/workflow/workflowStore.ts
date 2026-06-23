/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client-side persistence for workflow definitions (LOKYY-3).
 *
 * CRUD helpers over {@link ConfigStorage} for the `workflows` key. Orchestration
 * is client-side; only workflow DEFINITIONS ({@link IWorkflow}) are persisted
 * here. Executions ({@link IWorkflowExecution}) are runtime state and are not
 * stored by this module.
 */

import { ConfigStorage } from '@/common/config/storage';
import type { IWorkflow } from '@/common/types/workflow/workflowTypes';
import { uuid } from '@/common/utils';

/** Read all persisted workflow definitions (empty array when none). */
export async function listWorkflows(): Promise<IWorkflow[]> {
  const workflows = await ConfigStorage.get('workflows');
  return workflows ?? [];
}

/** Read a single workflow by id, or `undefined` when not found. */
export async function getWorkflow(id: string): Promise<IWorkflow | undefined> {
  const workflows = await listWorkflows();
  return workflows.find((wf) => wf.id === id);
}

/**
 * Persist a workflow definition. Inserts when new, replaces in place when an
 * entry with the same id already exists. Bumps `updated_at` on save.
 */
export async function saveWorkflow(workflow: IWorkflow): Promise<IWorkflow> {
  const workflows = await listWorkflows();
  const next: IWorkflow = { ...workflow, updated_at: Date.now() };
  const index = workflows.findIndex((wf) => wf.id === next.id);
  if (index >= 0) {
    workflows[index] = next;
  } else {
    workflows.push(next);
  }
  await ConfigStorage.set('workflows', workflows);
  return next;
}

/** Delete a workflow definition by id. No-op when the id does not exist. */
export async function deleteWorkflow(id: string): Promise<void> {
  const workflows = await listWorkflows();
  const filtered = workflows.filter((wf) => wf.id !== id);
  if (filtered.length !== workflows.length) {
    await ConfigStorage.set('workflows', filtered);
  }
}

/**
 * Build a fresh {@link IWorkflow} from a partial definition, assigning a new id
 * and timestamps. Does not persist — callers pass the result to
 * {@link saveWorkflow}.
 */
export function createWorkflow(partial: Partial<IWorkflow> = {}): IWorkflow {
  const now = Date.now();
  return {
    id: partial.id ?? uuid(36),
    name: partial.name ?? '',
    description: partial.description,
    steps: partial.steps ?? [],
    created_at: partial.created_at ?? now,
    updated_at: now,
  };
}
