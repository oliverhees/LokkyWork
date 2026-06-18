/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Visual workflow editor (LOKYY-7/LOKYY-8) — renders and edits a workflow's
 * linear step chain on a react-flow canvas. The data model is a LINEAR chain
 * ({@link IWorkflowStep} `order`); nodes are steps and edges encode the order.
 *
 * Editing is array-driven: the authoritative state is an ordered
 * {@link DraftStep}[] (the chain). Nodes and edges are derived from it, so the
 * linear invariant cannot be violated — `order` is always re-assigned from the
 * chain position on save, and edges always connect consecutive steps. There is
 * no DAG: no branching, no multi-input edges.
 *
 * Clicking a node opens an inspector panel ({@link StepConfigPanel}) to edit
 * that step. "Add step" appends to the chain, deleting a node removes it, and
 * "Save" persists via {@link saveWorkflow}.
 */

import type { IWorkflow, IWorkflowExecution, IWorkflowStep } from '@/common/types/workflow/workflowTypes';
import { uuid } from '@/common/utils';
import useWorkflowExecution, { useWorkflowModelResolver } from '@renderer/pages/workflow/hooks/useWorkflowExecution';
import { getWorkflow, saveWorkflow } from '@renderer/services/workflow/workflowStore';
import { Button, Empty, Message, Spin } from '@arco-design/web-react';
import { Delete, Left, Pause, Play, Plus, Save } from '@icon-park/react';
import type { Edge, Node, NodeTypes } from '@xyflow/react';
import { Background, Controls, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import type { DraftStep } from './StepConfigPanel';
import StepConfigPanel from './StepConfigPanel';
import type { StepNodeData } from './StepNode';
import StepNode from './StepNode';

/** Vertical spacing between consecutive step nodes, in px. */
const NODE_VERTICAL_GAP = 140;
/** Horizontal offset of the node column from the canvas origin, in px. */
const NODE_COLUMN_X = 40;

const NODE_TYPES: NodeTypes = { workflowStep: StepNode };

/** Create a fresh draft step (order is derived from chain position on save). */
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

/** Build react-flow nodes from the ordered draft-step chain (linear). */
function buildNodes(steps: DraftStep[], fallbackLabel: (index: number) => string, execution: IWorkflowExecution | null, onViewChat: (conversationId: string) => void): Node[] {
  // step_results are index-aligned with the ordered chain; resolve by step_id
  // first (robust), falling back to position.
  const resultById = new Map(execution?.step_results.map((r) => [r.step_id, r]) ?? []);
  return steps.map((step, index) => {
    const result = resultById.get(step.id) ?? execution?.step_results[index];
    const conversationId = result?.conversation_id;
    const data: StepNodeData = {
      label: step.name?.trim() || fallbackLabel(index + 1),
      backend: step.backend,
      order: index + 1,
      status: result?.status,
      active: execution?.status === 'running' && execution.current_step_index === index,
      output: result?.output,
      conversationId,
      onViewChat: conversationId ? () => onViewChat(conversationId) : undefined,
    };
    return {
      id: step.id,
      type: 'workflowStep',
      position: { x: NODE_COLUMN_X, y: index * NODE_VERTICAL_GAP },
      data: data as unknown as Record<string, unknown>,
    };
  });
}

/** Build edges connecting each step to the next in chain order (linear). */
function buildEdges(steps: DraftStep[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const source = steps[i];
    const target = steps[i + 1];
    edges.push({ id: `${source.id}->${target.id}`, source: source.id, target: target.id });
  }
  return edges;
}

const WorkflowEditorPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [workflow, setWorkflow] = useState<IWorkflow | undefined>(undefined);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Reuse the existing execution engine/hooks — no second run logic.
  const resolveModel = useWorkflowModelResolver();
  const { execution, running, error: runError, start, cancel } = useWorkflowExecution({ resolveModel });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const result = id ? await getWorkflow(id) : undefined;
      if (cancelled) return;
      setWorkflow(result);
      if (result) {
        const ordered = [...result.steps].toSorted((a, b) => a.order - b.order);
        setSteps(ordered.map(({ order: _order, ...rest }) => rest));
      } else {
        setSteps([]);
      }
      setSelectedStepId(undefined);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const fallbackLabel = useMemo(() => (index: number) => t('workflow.form.step.title', { index }), [t]);

  // Open a step's conversation — same target as WorkflowExecutionPanel's link.
  const handleViewChat = useCallback((conversationId: string) => navigate(`/conversation/${conversationId}`), [navigate]);

  // Derive nodes/edges from the linear chain. Reusing the react-flow state
  // setters keeps user-driven drag positions until the chain itself changes.
  useEffect(() => {
    setNodes(buildNodes(steps, fallbackLabel, execution, handleViewChat));
    setEdges(buildEdges(steps));
  }, [steps, fallbackLabel, execution, handleViewChat, setNodes, setEdges]);

  const selectedStep = useMemo(() => steps.find((step) => step.id === selectedStepId), [steps, selectedStepId]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedStepId(node.id);
  }, []);

  const updateStep = useCallback((stepId: string, patch: Partial<DraftStep>) => {
    setSteps((prev) => prev.map((step) => (step.id === stepId ? { ...step, ...patch } : step)));
  }, []);

  const handleAddStep = useCallback(() => {
    const next = createDraftStep();
    setSteps((prev) => [...prev, next]);
    setSelectedStepId(next.id);
  }, []);

  const handleRemoveStep = useCallback((stepId: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== stepId));
    setSelectedStepId((current) => (current === stepId ? undefined : current));
  }, []);

  const handleSave = useCallback(async () => {
    if (!workflow) return;
    setSaving(true);
    try {
      const orderedSteps: IWorkflowStep[] = steps.map((step, index) => ({
        ...step,
        order: index + 1,
        model: step.model?.trim() ? step.model.trim() : undefined,
      }));
      const next: IWorkflow = { ...workflow, steps: orderedSteps, updated_at: Date.now() };
      const saved = await saveWorkflow(next);
      setWorkflow(saved);
      Message.success(t('workflow.editor.saved'));
    } catch {
      Message.error(t('workflow.editor.saveError'));
    } finally {
      setSaving(false);
    }
  }, [workflow, steps, t]);

  // Run the persisted workflow definition. Unsaved chain edits aren't executed,
  // so persist first to keep the run aligned with what's on the canvas.
  const handleRun = useCallback(async () => {
    if (!workflow || running || steps.length === 0) return;
    const orderedSteps: IWorkflowStep[] = steps.map((step, index) => ({
      ...step,
      order: index + 1,
      model: step.model?.trim() ? step.model.trim() : undefined,
    }));
    const next: IWorkflow = { ...workflow, steps: orderedSteps, updated_at: Date.now() };
    try {
      const saved = await saveWorkflow(next);
      setWorkflow(saved);
      void start(saved);
    } catch {
      Message.error(t('workflow.editor.saveError'));
    }
  }, [workflow, running, steps, start, t]);

  const editingLocked = running;

  return (
    <div className='flex size-full min-h-0 flex-col'>
      <div className='flex shrink-0 items-center gap-12px border-0 border-b border-solid border-[var(--color-border-2)] px-20px py-14px'>
        <Button type='text' size='small' icon={<Left size='16' />} onClick={() => navigate('/workflows')}>
          {t('workflow.editor.back')}
        </Button>
        <div className='min-w-0 flex-1 truncate text-16px font-medium text-t-primary'>{workflow ? workflow.name || workflow.id : t('workflow.editor.title')}</div>
        {workflow ? (
          <div className='flex shrink-0 items-center gap-8px'>
            <Button type='outline' size='small' shape='round' icon={<Plus size='14' />} disabled={editingLocked} onClick={handleAddStep}>
              {t('workflow.editor.addStep')}
            </Button>
            <Button type='outline' size='small' shape='round' icon={<Save size='14' />} loading={saving} disabled={editingLocked} onClick={() => void handleSave()}>
              {t('workflow.editor.save')}
            </Button>
            {running ? (
              <Button size='small' shape='round' icon={<Pause size='14' />} onClick={cancel}>
                {t('workflow.editor.cancel')}
              </Button>
            ) : (
              <Button type='primary' size='small' shape='round' icon={<Play size='14' />} disabled={steps.length === 0} onClick={() => void handleRun()}>
                {t('workflow.editor.run')}
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <div className='relative flex min-h-0 flex-1'>
        {loading ? (
          <div className='flex size-full items-center justify-center'>
            <Spin />
          </div>
        ) : !workflow ? (
          <div className='flex size-full items-center justify-center'>
            <Empty description={t('workflow.editor.notFound')} />
          </div>
        ) : (
          <>
            <div className='relative min-h-0 flex-1'>
              {runError ? <div className='absolute inset-x-0 top-0 z-10 bg-fill-2 px-16px py-8px text-13px text-[var(--color-danger-6)]'>{t('workflow.runError')}</div> : null}
              {steps.length === 0 ? (
                <div className='flex size-full items-center justify-center'>
                  <Empty description={t('workflow.editor.noSteps')} />
                </div>
              ) : (
                <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={handleNodeClick} nodeTypes={NODE_TYPES} nodesDraggable={!editingLocked} fitView proOptions={{ hideAttribution: true }}>
                  <Background />
                  <Controls />
                </ReactFlow>
              )}
            </div>

            {selectedStep ? (
              <div className='flex w-[min(360px,calc(100vw-32px))] shrink-0 flex-col border-0 border-l border-solid border-[var(--color-border-2)] bg-fill-1'>
                <div className='flex shrink-0 items-center justify-between gap-8px border-0 border-b border-solid border-[var(--color-border-2)] px-16px py-12px'>
                  <span className='min-w-0 flex-1 truncate text-14px font-medium text-t-primary'>{t('workflow.editor.inspector.title')}</span>
                  <Button type='text' size='mini' status='danger' title={t('workflow.form.removeStep')} disabled={editingLocked} icon={<Delete size='14' />} onClick={() => handleRemoveStep(selectedStep.id)} />
                </div>
                <div className='min-h-0 flex-1 overflow-y-auto px-16px py-14px'>
                  <StepConfigPanel step={selectedStep} onChange={(patch) => updateStep(selectedStep.id, patch)} />
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default WorkflowEditorPage;
