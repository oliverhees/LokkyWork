/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Skill-Chaining / Workflow-Automation — shared data model (LOKYY-2).
 *
 * A workflow is an ordered chain of steps. Each step runs as a real
 * conversation (via the existing `ipcBridge.conversation.*` API), so its full
 * chat is viewable afterwards. Step N+1 only starts once step N has completed;
 * the previous step's output is fed into the next step via `input_mapping`.
 *
 * Orchestration is CLIENT-SIDE: the renderer drives the chain through the
 * existing aioncore REST/WS APIs — no aioncore changes required. Definitions
 * are persisted client-side (ConfigStorage); executions are runtime state.
 */

/** Backend/agent kind a step runs on — mirrors `TChatConversation['type']`. */
export type TWorkflowStepBackend = 'acp' | 'gemini' | 'codex' | 'aionrs' | 'openclaw' | 'nanobot';

/**
 * How a step receives the upstream output.
 * - `none`: step uses only its own prompt_template (e.g. the first step).
 * - `append`: previous step's output is appended to the prompt.
 * - `template`: prompt_template is rendered with placeholders, e.g.
 *   `{{input}}` (previous step output) and `{{steps.<stepId>.output}}`.
 */
export type TWorkflowInputMode = 'none' | 'append' | 'template';

export interface IWorkflowStep {
  /** Stable id, unique within the workflow. */
  id: string;
  /** 1-based position in the chain. */
  order: number;
  /** Human label shown in UI and used to title the step's conversation. */
  name: string;
  /** Backend the step's conversation runs on. */
  backend: TWorkflowStepBackend;
  /** Optional model id for the step's conversation. */
  model?: string;
  /**
   * Skills snapshot for this step's conversation — same semantics as
   * `TChatConversation.skills`. Authoritative list applied at run time.
   */
  skills?: string[];
  /** MCP server id snapshot applied to the step's conversation. */
  mcp_server_ids?: string[];
  /** Prompt sent to the step. May contain placeholders when input_mode='template'. */
  prompt_template: string;
  /** How the upstream output flows into this step. Defaults to 'append'. */
  input_mode: TWorkflowInputMode;
}

export interface IWorkflow {
  id: string;
  name: string;
  description?: string;
  /** Ordered chain. Persisted as the authoritative definition. */
  steps: IWorkflowStep[];
  created_at: number;
  updated_at: number;
}

/** Lifecycle status of a single step within one execution. */
export type TWorkflowStepStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

/** Lifecycle status of a whole execution. */
export type TWorkflowExecutionStatus = 'pending' | 'running' | 'completed' | 'error' | 'cancelled';

export interface IWorkflowStepResult {
  step_id: string;
  status: TWorkflowStepStatus;
  /** Conversation created for this step — entry point to view the full chat. */
  conversation_id?: string;
  /** Final text output of the step, fed into the next step's input. */
  output?: string;
  /** Error message when status === 'error'. */
  error?: string;
  started_at?: number;
  completed_at?: number;
}

export interface IWorkflowExecution {
  id: string;
  workflow_id: string;
  status: TWorkflowExecutionStatus;
  /** Per-step results, index-aligned with the workflow's ordered steps. */
  step_results: IWorkflowStepResult[];
  /** Index of the currently running step, or -1 when not running. */
  current_step_index: number;
  created_at: number;
  updated_at: number;
}
