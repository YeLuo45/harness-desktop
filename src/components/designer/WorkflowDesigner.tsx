// src/components/designer/WorkflowDesigner.tsx
import { useState, useCallback, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

import WorkflowCanvas from './WorkflowCanvas';
import WorkflowToolbar from './WorkflowToolbar';
import WorkflowList from './WorkflowList';
import { Workflow, PhaseNodeData } from '../../types/workflow';
import { workflowStore } from '../../store/workflowStore';
import { workflowExecutor } from '../../services/workflowExecutor';

interface WorkflowDesignerProps {
  onBack: () => void;
}

const emptyWorkflow: Workflow = {
  id: '',
  name: 'Untitled Workflow',
  nodes: [],
  edges: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export default function WorkflowDesigner({ onBack }: WorkflowDesignerProps) {
  const [workflow, setWorkflow] = useState<Workflow>(emptyWorkflow);
  const [showList, setShowList] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string>('');

  // Convert nodes/edges from ReactFlow format to our Workflow format
  const handleNodesChange = useCallback((nodes: Node[], edges: Edge[]) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: nodes.map(n => ({
        id: n.id,
        type: 'phase' as const,
        position: n.position,
        data: n.data as PhaseNodeData,
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label as string | undefined,
      })),
      updatedAt: Date.now(),
    }));
  }, []);

  const handleSave = useCallback((name: string) => {
    const toSave: Workflow = {
      ...workflow,
      name,
      updatedAt: Date.now(),
    };
    const saved = workflowStore.save(toSave);
    setWorkflow(saved);
    setExecutionResult(`Saved: ${saved.name}`);
    setTimeout(() => setExecutionResult(''), 2000);
  }, [workflow]);

  const handleNew = useCallback(() => {
    if (workflow.nodes.length > 0) {
      if (!confirm('Clear current workflow?')) return;
    }
    setWorkflow({ ...emptyWorkflow, id: '' });
  }, [workflow.nodes.length]);

  const handleLoad = useCallback((id: string) => {
    const loaded = workflowStore.getById(id);
    if (loaded) {
      setWorkflow(loaded);
      setShowList(false);
      setExecutionResult(`Loaded: ${loaded.name}`);
      setTimeout(() => setExecutionResult(''), 2000);
    }
  }, []);

  const handleExecute = useCallback(async () => {
    if (workflow.nodes.length === 0) {
      setExecutionResult('No nodes to execute');
      setTimeout(() => setExecutionResult(''), 2000);
      return;
    }

    // Validate first
    const validation = workflowExecutor.validate(workflow);
    if (!validation.valid) {
      setExecutionResult(`Validation failed: ${validation.errors.join(', ')}`);
      setTimeout(() => setExecutionResult(''), 4000);
      return;
    }

    setIsExecuting(true);
    setExecutionResult('Executing workflow...');

    try {
      const result = await workflowExecutor.start(workflow);
      if (result.success) {
        setExecutionResult(`✓ Workflow completed successfully (${result.results.length} nodes)`);
      } else {
        const failedCount = result.results.filter(r => !r.success).length;
        setExecutionResult(`⚠ Workflow completed with ${failedCount} failure(s)`);
      }
    } catch (err) {
      setExecutionResult(`Execution error: ${err instanceof Error ? err.message : String(err)}`);
    }

    setIsExecuting(false);
    setTimeout(() => setExecutionResult(''), 4000);
  }, [workflow]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#1A1A1A',
      }}
    >
      {/* Toolbar */}
      <WorkflowToolbar
        workflowName={workflow.name}
        onNew={handleNew}
        onSave={handleSave}
        onExecute={handleExecute}
        onShowList={() => setShowList(true)}
        isExecuting={isExecuting}
      />

      {/* Execution Result Toast */}
      {executionResult && (
        <div
          style={{
            position: 'absolute',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: executionResult.startsWith('✓')
              ? '#52c41a'
              : executionResult.startsWith('⚠')
              ? '#FA8C16'
              : '#4A90D9',
            color: '#FFF',
            padding: '10px 20px',
            borderRadius: '6px',
            fontSize: '14px',
            zIndex: 1001,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {executionResult}
        </div>
      )}

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <WorkflowCanvas
          workflow={workflow}
          onNodesChange={handleNodesChange}
          onExecute={handleExecute}
        />
      </div>

      {/* Workflow List Modal */}
      {showList && (
        <WorkflowList
          onSelect={handleLoad}
          onClose={() => setShowList(false)}
        />
      )}
    </div>
  );
}