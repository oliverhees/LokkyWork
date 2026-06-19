/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * React client-API for workflow definitions (LOKYY-5).
 *
 * Orchestration is fully CLIENT-SIDE, so there is no `ipcBridge.workflow.*`
 * layer. Instead this hook exposes CRUD over the {@link workflowStore} helpers
 * (LOKYY-3) backed by ConfigStorage, keeping a local React state copy in sync.
 *
 * Mirrors the shape of {@link useCronJobs} (loading/error/refetch + actions),
 * but since definitions live in ConfigStorage rather than behind a live event
 * stream, mutations refresh the local list optimistically after persisting.
 */

import type { IWorkflow } from '@/common/types/workflow/workflowTypes';
import {
  createWorkflow as createWorkflowDefinition,
  deleteWorkflow as deleteWorkflowFromStore,
  listWorkflows,
  saveWorkflow,
} from '@renderer/services/workflow/workflowStore';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type UseWorkflowsResult = {
  /** All persisted workflow definitions. */
  workflows: IWorkflow[];
  /** True while the initial (or a manual) fetch is in flight. */
  loading: boolean;
  /** Last error from a fetch or mutation, or `null`. */
  error: Error | null;
  /** Whether at least one workflow exists. */
  hasWorkflows: boolean;
  /** Re-read all definitions from storage. */
  refetch: () => Promise<void>;
  /**
   * Create and persist a new workflow from a partial definition. Returns the
   * persisted workflow (with generated id and timestamps).
   */
  createWorkflow: (partial?: Partial<IWorkflow>) => Promise<IWorkflow>;
  /** Persist an existing workflow (upsert). Returns the saved workflow. */
  updateWorkflow: (workflow: IWorkflow) => Promise<IWorkflow>;
  /** Delete a workflow definition by id. */
  deleteWorkflow: (id: string) => Promise<void>;
};

/**
 * Manage all workflow definitions for the current user.
 */
export function useWorkflows(): UseWorkflowsResult {
  const [workflows, setWorkflows] = useState<IWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listWorkflows();
      setWorkflows(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load workflows'));
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createWorkflow = useCallback(async (partial: Partial<IWorkflow> = {}) => {
    setError(null);
    try {
      const saved = await saveWorkflow(createWorkflowDefinition(partial));
      setWorkflows((prev) =>
        prev.some((wf) => wf.id === saved.id) ? prev.map((wf) => (wf.id === saved.id ? saved : wf)) : [...prev, saved]
      );
      return saved;
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error('Failed to create workflow');
      setError(wrapped);
      throw wrapped;
    }
  }, []);

  const updateWorkflow = useCallback(async (workflow: IWorkflow) => {
    setError(null);
    try {
      const saved = await saveWorkflow(workflow);
      setWorkflows((prev) =>
        prev.some((wf) => wf.id === saved.id) ? prev.map((wf) => (wf.id === saved.id ? saved : wf)) : [...prev, saved]
      );
      return saved;
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error('Failed to update workflow');
      setError(wrapped);
      throw wrapped;
    }
  }, []);

  const deleteWorkflow = useCallback(async (id: string) => {
    setError(null);
    try {
      await deleteWorkflowFromStore(id);
      setWorkflows((prev) => prev.filter((wf) => wf.id !== id));
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error('Failed to delete workflow');
      setError(wrapped);
      throw wrapped;
    }
  }, []);

  const hasWorkflows = workflows.length > 0;

  return useMemo(
    () => ({
      workflows,
      loading,
      error,
      hasWorkflows,
      refetch,
      createWorkflow,
      updateWorkflow,
      deleteWorkflow,
    }),
    [workflows, loading, error, hasWorkflows, refetch, createWorkflow, updateWorkflow, deleteWorkflow]
  );
}

export default useWorkflows;
