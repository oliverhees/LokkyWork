/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * React client-API for running a workflow (LOKYY-5).
 *
 * Wraps the client-side {@link executeWorkflow} engine (LOKYY-4): it owns the
 * `AbortController` and `onUpdate` subscription so callers get a live
 * {@link IWorkflowExecution} React state plus simple `start()` / `cancel()`
 * controls. The executor resolves no models itself — the caller supplies a
 * {@link WorkflowModelResolver} (and optional `defaultModel`); the companion
 * {@link useWorkflowModelResolver} hook builds one from the provider list.
 */

import type { TProviderWithModel } from '@/common/config/storage';
import type { IWorkflow, IWorkflowExecution, IWorkflowStep } from '@/common/types/workflow/workflowTypes';
import { useProvidersQuery } from '@renderer/hooks/agent/useModelProviderList';
import type { WorkflowModelResolver } from '@renderer/services/workflow/WorkflowExecutor';
import { executeWorkflow } from '@renderer/services/workflow/WorkflowExecutor';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type UseWorkflowExecutionOptions = {
  /** Resolves a step's stored model id into a full provider/model record. */
  resolveModel: WorkflowModelResolver;
  /** Fallback model when {@link resolveModel} returns `undefined`. */
  defaultModel?: TProviderWithModel;
  /** Workspace passed to every step's conversation. */
  workspace?: string;
};

export type UseWorkflowExecutionResult = {
  /** Live execution snapshot, or `null` before the first run. */
  execution: IWorkflowExecution | null;
  /** True while a run is in flight. */
  running: boolean;
  /** Last run error (engine-level), or `null`. */
  error: Error | null;
  /** Start a run for the given workflow. No-op while one is already running. */
  start: (workflow: IWorkflow) => Promise<IWorkflowExecution | undefined>;
  /** Abort the in-flight run, if any. */
  cancel: () => void;
};

/**
 * Run a single workflow at a time, exposing its live execution state.
 */
export function useWorkflowExecution(options: UseWorkflowExecutionOptions): UseWorkflowExecutionResult {
  const { resolveModel, defaultModel, workspace } = options;
  const [execution, setExecution] = useState<IWorkflowExecution | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the latest option values without forcing `start` to change identity.
  const optionsRef = useRef({ resolveModel, defaultModel, workspace });
  optionsRef.current = { resolveModel, defaultModel, workspace };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const start = useCallback(async (workflow: IWorkflow) => {
    if (abortRef.current) {
      return undefined;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    setExecution(null);

    const { resolveModel: resolve, defaultModel: fallback, workspace: ws } = optionsRef.current;

    try {
      const result = await executeWorkflow(workflow, {
        resolveModel: resolve,
        defaultModel: fallback,
        workspace: ws,
        onUpdate: setExecution,
        signal: controller.signal,
      });
      setExecution(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Workflow execution failed'));
      return undefined;
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return useMemo(
    () => ({
      execution,
      running,
      error,
      start,
      cancel,
    }),
    [execution, running, error, start, cancel]
  );
}

/**
 * Build a {@link WorkflowModelResolver} from the configured provider list.
 *
 * A step persists only a model name string ({@link IWorkflowStep.model}); the
 * executor needs a full {@link TProviderWithModel}. This resolver scans the
 * provider list for a provider that offers the step's model and returns it as
 * `{ ...provider, use_model }`. Returns `undefined` when the step has no model
 * or no provider offers it (the executor then falls back to `defaultModel`).
 */
export function useWorkflowModelResolver(): WorkflowModelResolver {
  const { data: providers } = useProvidersQuery();
  const providersRef = useRef(providers);
  providersRef.current = providers;

  return useCallback((step: IWorkflowStep): TProviderWithModel | undefined => {
    const modelName = step.model;
    if (!modelName) return undefined;
    const list = providersRef.current ?? [];
    const provider = list.find((p) => p.id && p.models?.includes(modelName));
    if (!provider) return undefined;
    const { models: _models, ...rest } = provider;
    return { ...rest, use_model: modelName };
  }, []);
}

export default useWorkflowExecution;
