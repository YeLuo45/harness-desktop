// src/components/designer/WorkflowCanvas.tsx
import { useCallback, useState, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  addEdge,
  NodeChange,
  EdgeChange,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import PhaseNode from './PhaseNode';
import NodeConfigPanel from './NodeConfigPanel';
import NodePalette from './NodePalette';
import { Workflow, WorkflowNode, WorkflowEdge, PhaseType, PhaseNodeData, PHASE_TYPE_META } from '../../types/workflow';
import { v4 as uuidv4 } from 'uuid';

const nodeTypes = {
  phase: PhaseNode,
};

interface WorkflowCanvasProps {
  workflow: Workflow;
  onNodesChange: (nodes: Node[], edges: Edge[]) => void;
  onExecute: () => void;
}

export default function WorkflowCanvas({ workflow, onNodesChange, onExecute }: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChangeHandler] = useNodesState(
    workflow.nodes as Node[]
  );
  const [edges, setEdges, onEdgesChangeHandler] = useEdgesState(
    workflow.edges as Edge[]
  );
  const [selectedNode, setSelectedNode] = useState<{ id: string; data: PhaseNodeData } | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<any>(null);

  // Sync external workflow changes
  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeHandler(changes);
      // Also sync to parent
      setNodes(currentNodes => {
        const updated = applyNodeChanges(currentNodes, changes);
        return updated;
      });
    },
    [onNodesChangeHandler, onNodesChangeHandler]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChangeHandler(changes);
    },
    [onEdgesChangeHandler]
  );

  // Auto-sync to parent on every change
  const syncToParent = useCallback(() => {
    onNodesChange(nodes, edges);
  }, [nodes, edges, onNodesChange]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges(eds => addEdge({ ...connection, id: uuidv4() }, eds));
      // Small delay to ensure state is updated
      setTimeout(syncToParent, 0);
    },
    [setEdges, syncToParent]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode({ id: node.id, data: node.data as PhaseNodeData });
  }, []);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode({ id: node.id, data: node.data as PhaseNodeData });
  }, []);

  const onUpdateNode = useCallback(
    (nodeId: string, data: Partial<PhaseNodeData>) => {
      setNodes(nds =>
        nds.map(node =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        )
      );
      setTimeout(syncToParent, 0);
    },
    [setNodes, syncToParent]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const phaseType = event.dataTransfer.getData('application/reactflow') as PhaseType;
      if (!phaseType) return;

      const position = rfInstance?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const meta = PHASE_TYPE_META[phaseType];
      const newNode: Node = {
        id: uuidv4(),
        type: 'phase',
        position: position || { x: 100, y: 100 },
        data: {
          label: `${meta.label} Phase`,
          phaseType,
          timeout: undefined,
          retryCount: 0,
        },
      };

      setNodes(nds => [...nds, newNode]);
      setTimeout(syncToParent, 0);
    },
    [rfInstance, setNodes, syncToParent]
  );

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onInit={setRfInstance}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        style={{ background: '#1A1A1A' }}
        defaultEdgeOptions={{
          style: { stroke: '#555', strokeWidth: 2 },
          animated: false,
        }}
      >
        <Controls
          style={{
            background: '#252525',
            border: '1px solid #3A3A3A',
            borderRadius: '6px',
          }}
        />
        <MiniMap
          style={{
            background: '#252525',
            border: '1px solid #3A3A3A',
            borderRadius: '6px',
          }}
          nodeColor={node => {
            const data = node.data as PhaseNodeData;
            return PHASE_TYPE_META[data?.phaseType]?.color || '#555';
          }}
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#333"
        />
      </ReactFlow>

      {/* Left: Node Palette */}
      <NodePalette onDragStart={() => {}} />

      {/* Right: Node Config Panel */}
      {selectedNode && (
        <NodeConfigPanel
          nodeId={selectedNode.id}
          data={selectedNode.data}
          onUpdate={onUpdateNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

// Helper to apply node changes (from ReactFlow)
function applyNodeChanges(nodes: Node[], changes: NodeChange[]): Node[] {
  return nodes.map(node => {
    changes.forEach(change => {
      if (change.type === 'position' && change.position && change.id === node.id) {
        node.position = change.position;
      }
      if (change.type === 'remove' && change.id === node.id) {
        node.hidden = true;
      }
    });
    return node;
  });
}