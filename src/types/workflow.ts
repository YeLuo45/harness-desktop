// src/types/workflow.ts

export type PhaseType = 'planning' | 'development' | 'review' | 'execution' | 'deployment' | 'custom';

export interface PhaseNodeData {
  label: string;
  phaseType: PhaseType;
  roleId?: string;
  timeout?: number;        // ms
  retryCount?: number;
  customConfig?: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: 'phase';
  position: { x: number; y: number };
  data: PhaseNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: number;
  updatedAt: number;
}

// Phase type metadata for UI
export const PHASE_TYPE_META: Record<PhaseType, { label: string; color: string; icon: string }> = {
  planning: { label: 'Planning', color: '#4A90D9', icon: '📋' },
  development: { label: 'Development', color: '#52c41a', icon: '💻' },
  review: { label: 'Review', color: '#FA8C16', icon: '🔍' },
  execution: { label: 'Execution', color: '#722ED1', icon: '⚡' },
  deployment: { label: 'Deployment', color: '#EB2F96', icon: '🚀' },
  custom: { label: 'Custom', color: '#8C8C8C', icon: '⚙️' },
};