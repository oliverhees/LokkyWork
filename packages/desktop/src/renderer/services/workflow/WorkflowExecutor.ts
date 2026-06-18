/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client-side workflow executor (LOKYY-4) — the core orchestration engine.
 *
 * Drives an {@link IWorkflow} through its ordered chain of steps using the
 * existing `ipcBridge.conversation.*` REST/WS API. Each step runs as a real
 * conversation so its full chat stays viewable afterwards. Orchestration is
 * fully CLIENT-SIDE — no aioncore changes are required.
 *
 * Per step the executor:
 *  1. builds {@link ICreateConversationParams} from the step's backend/model/
 *     skills (via {@link buildAgentConversationParams}) and creates a
 *     conversation;
 *  2. renders the prompt according to the step's `input_mode`;
 *  3. subscribes to the `responseStream` to accumulate the assistant's text;
 *  4. sends the prompt via `sendMessage`;
 *  5. awaits the matching `turn.completed` event, then extracts the final
 *     text output (accumulated stream first, `last_message.content` fallback).
 *
 * Step N+1 only starts once step N has completed. Any step error aborts the
 * run with `execution.status = 'error'`. Callers observe progress through the
 * `onUpdate` callback, which fires on every state transition.
 */

import { ipcBridge } from '@/common';
import type { IConversationTurnCompletedEvent, IResponseMessage } from '@/common/adapter/ipcBridge';
import type { TProviderWithModel } from '@/common/config/storage';
import type { IWorkflow, IWorkflowExecution, IWorkflowStep, IWorkflowStepResult } from '@/common/types/workflow/workflowTypes';
import { buildAgentConversationParams } from '@/common/utils/buildAgentConversationParams';
import { uuid } from '@/common/utils';

/**
 * Resolves a step's stored model id into a full {@link TProviderWithModel}.
 * The workflow step only persists a model id string, while conversation
 * creation needs the full provider record — the caller (UI) owns model config
 * and supplies this resolver. Returning `undefined` means "no explicit model";
 * the executor then falls back to {@link WorkflowExecutorOptions.defaultModel}.
 */
export type WorkflowModelResolver = (step: IWorkflowStep) => TProviderWithModel | undefined | Promise<TProviderWithModel | undefined>;

export type WorkflowExecutorOptions = {
  /** Resolves the {@link TProviderWithModel} for a step. */
  resolveModel: WorkflowModelResolver;
  /** Fallback model when {@link resolveModel} returns `undefined`. */
  defaultModel?: TProviderWithModel;
  /** Workspace passed to every step's conversation. */
  workspace?: string;
  /** Fires on every execution state transition with a fresh snapshot. */
  onUpdate?: (execution: IWorkflowExecution) => void;
  /** Abort signal — when aborted, the run stops and status becomes 'cancelled'. */
  signal?: AbortSignal;
};

/** Placeholder for the immediately-preceding step's output. */
const INPUT_PLACEHOLDER = /\{\{\s*input\s*\}\}/g;
/** Placeholder for any step's output by id, e.g. `{{steps.<id>.output}}`. */
const STEP_OUTPUT_PLACEHOLDER = /\{\{\s*steps\.([^.}\s]+)\.output\s*\}\}/g;

/** Extract a printable text chunk from a stream message's `data` payload. */
function extractChunk(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data !== null && typeof data === 'object' && 'content' in data) {
    const content = (data as { content?: unknown }).content;
    if (typeof content === 'string') return content;
  }
  return '';
}

/** Extract a printable text output from a turn.completed `last_message`. */
function extractTurnOutput(event: IConversationTurnCompletedEvent): string {
  const content = event.last_message?.content;
  if (typeof content === 'string') return content;
  if (content !== null && typeof content === 'object' && 'content' in content) {
    const inner = (content as { content?: unknown }).content;
    if (typeof inner === 'string') return inner;
  }
  return '';
}

/**
 * Render a step's prompt for the given upstream context.
 * - `none`: the template is used verbatim.
 * - `append`: the previous step's output is appended below the template.
 * - `template`: `{{input}}` and `{{steps.<id>.output}}` placeholders are
 *   substituted; unknown placeholders collapse to an empty string.
 */
function buildPrompt(step: IWorkflowStep, previousOutput: string, outputsByStepId: Map<string, string>): string {
  switch (step.input_mode) {
    case 'none':
      return step.prompt_template;
    case 'append':
      return previousOutput ? `${step.prompt_template}\n\n${previousOutput}` : step.prompt_template;
    case 'template':
      return step.prompt_template.replace(INPUT_PLACEHOLDER, previousOutput).replace(STEP_OUTPUT_PLACEHOLDER, (_match, stepId: string) => outputsByStepId.get(stepId) ?? '');
    default:
      return step.prompt_template;
  }
}

/** Wait for the `turn.completed` event of a specific conversation. */
function waitForTurnCompleted(conversationId: string, signal?: AbortSignal): Promise<IConversationTurnCompletedEvent> {
  return new Promise<IConversationTurnCompletedEvent>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const cleanup = () => {
      removeListener();
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const removeListener = ipcBridge.conversation.turnCompleted.on((event: IConversationTurnCompletedEvent) => {
      if (event.session_id !== conversationId) return;
      if (event.status === 'finished' || event.state === 'error' || event.state === 'stopped') {
        cleanup();
        resolve(event);
      }
    });
    if (signal) signal.addEventListener('abort', onAbort);
  });
}

/**
 * Execute a workflow end-to-end. Resolves with the final {@link IWorkflowExecution}
 * (status `completed`, `error`, or `cancelled`). Never rejects for step-level
 * failures — those are recorded on the execution; it only rejects for
 * programmer errors outside the step loop.
 */
export async function executeWorkflow(workflow: IWorkflow, options: WorkflowExecutorOptions): Promise<IWorkflowExecution> {
  const { resolveModel, defaultModel, workspace, onUpdate, signal } = options;
  const steps = [...workflow.steps].toSorted((a, b) => a.order - b.order);
  const now = Date.now();

  const execution: IWorkflowExecution = {
    id: uuid(36),
    workflow_id: workflow.id,
    status: 'pending',
    step_results: steps.map<IWorkflowStepResult>((step) => ({ step_id: step.id, status: 'pending' })),
    current_step_index: -1,
    created_at: now,
    updated_at: now,
  };

  const emit = () => {
    execution.updated_at = Date.now();
    onUpdate?.({ ...execution, step_results: execution.step_results.map((r) => ({ ...r })) });
  };

  const fail = (index: number, message: string) => {
    const result = execution.step_results[index];
    result.status = 'error';
    result.error = message;
    result.completed_at = Date.now();
    execution.status = 'error';
    emit();
  };

  if (steps.length === 0) {
    execution.status = 'completed';
    execution.current_step_index = -1;
    emit();
    return execution;
  }

  execution.status = 'running';
  emit();

  const outputsByStepId = new Map<string, string>();
  let previousOutput = '';

  for (let index = 0; index < steps.length; index += 1) {
    if (signal?.aborted) {
      execution.status = 'cancelled';
      execution.current_step_index = -1;
      emit();
      return execution;
    }

    const step = steps[index];
    const result = execution.step_results[index];
    execution.current_step_index = index;
    result.status = 'running';
    result.started_at = Date.now();
    emit();

    // 1. Resolve the model for this step.
    let model: TProviderWithModel | undefined;
    try {
      model = (await resolveModel(step)) ?? defaultModel;
    } catch (error) {
      fail(index, `Failed to resolve model: ${(error as Error)?.message ?? String(error)}`);
      execution.current_step_index = -1;
      return execution;
    }
    if (!model) {
      fail(index, 'No model configured for this step.');
      execution.current_step_index = -1;
      return execution;
    }

    // 2. Create the conversation for this step.
    let conversationId: string;
    try {
      const params = buildAgentConversationParams({
        backend: step.backend,
        name: step.name || workflow.name,
        workspace: workspace ?? '',
        model,
        extra: {
          // MCP server selection is a first-class extra field; skills snapshots
          // are forwarded as opt-in preset skills (consumed by the create
          // handler). Both are no-ops when the step omits them.
          ...(step.mcp_server_ids?.length ? { selected_mcp_server_ids: step.mcp_server_ids } : {}),
          ...(step.skills?.length ? { preset_enabled_skills: step.skills } : {}),
        },
      });
      const conversation = await ipcBridge.conversation.create.invoke(params);
      if (!conversation?.id) {
        fail(index, 'Conversation creation returned no id.');
        execution.current_step_index = -1;
        return execution;
      }
      conversationId = conversation.id;
      result.conversation_id = conversationId;
      emit();
    } catch (error) {
      fail(index, `Failed to create conversation: ${(error as Error)?.message ?? String(error)}`);
      execution.current_step_index = -1;
      return execution;
    }

    // 3. Subscribe to the response stream to accumulate this step's text.
    let streamedOutput = '';
    const removeStreamListener = ipcBridge.conversation.responseStream.on((message: IResponseMessage) => {
      if (message.conversation_id !== conversationId) return;
      if (message.type === 'content' || message.type === 'text') {
        streamedOutput += extractChunk(message.data);
      }
    });

    // 4. Send the prompt and 5. await turn completion.
    try {
      const prompt = buildPrompt(step, previousOutput, outputsByStepId);
      const completion = waitForTurnCompleted(conversationId, signal);
      await ipcBridge.conversation.sendMessage.invoke({ input: prompt, conversation_id: conversationId });
      const event = await completion;

      if (event.state === 'error') {
        removeStreamListener();
        fail(index, event.detail || 'Step conversation reported an error.');
        execution.current_step_index = -1;
        return execution;
      }

      const output = streamedOutput.trim() || extractTurnOutput(event).trim();
      removeStreamListener();

      result.status = 'completed';
      result.output = output;
      result.completed_at = Date.now();
      previousOutput = output;
      outputsByStepId.set(step.id, output);
      emit();
    } catch (error) {
      removeStreamListener();
      if (signal?.aborted || (error as Error)?.name === 'AbortError') {
        result.status = 'pending';
        result.error = undefined;
        execution.status = 'cancelled';
        execution.current_step_index = -1;
        emit();
        return execution;
      }
      fail(index, `Step failed: ${(error as Error)?.message ?? String(error)}`);
      execution.current_step_index = -1;
      return execution;
    }
  }

  execution.status = 'completed';
  execution.current_step_index = -1;
  emit();
  return execution;
}
