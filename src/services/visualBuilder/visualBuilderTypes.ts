// Visual Builder Types

export enum AgentNodeType {
  TRIGGER = 'trigger',
  AGENT = 'agent',
  CONDITION = 'condition',
  PARALLEL = 'parallel',
  MERGE = 'merge',
  OUTPUT = 'output'
}

export interface Position {
  x: number
  y: number
}

export interface Port {
  id: string
  name: string
  type: 'number' | 'string' | 'boolean' | 'object'
  required?: boolean
}

export interface NodeData {
  label: string
  description?: string
  config: Record<string, unknown>
  inputs?: Port[]
  outputs?: Port[]
}

export interface CanvasNode {
  id: string
  type: AgentNodeType
  position: Position
  data: NodeData
}

export interface Edge {
  id: string
  source: string
  sourcePort: string
  target: string
  targetPort: string
}

export interface ExecutionPath {
  nodes: string[]
  edges: string[]
}

export interface ExecutionStep {
  nodeId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: number
  endTime?: number
  output?: unknown
  error?: string
}

export interface ExecutionResult {
  success: boolean
  steps: ExecutionStep[]
  duration: number
  output?: unknown
}

export interface EditorState {
  nodes: CanvasNode[]
  edges: Edge[]
  selectedNodeId?: string
  scale: number
  offset: Position
  isExecuting: boolean
  executionSteps: ExecutionStep[]
}

export interface NodeDefinition {
  type: AgentNodeType
  label: string
  description: string
  defaultData: Partial<NodeData>
  inputs: Port[]
  outputs: Port[]
}

export const defaultNodeDefinitions: NodeDefinition[] = [
  {
    type: AgentNodeType.TRIGGER,
    label: 'Trigger',
    description: 'Workflow starting point',
    defaultData: { label: 'Trigger', config: {} },
    inputs: [],
    outputs: [{ id: 'out', name: 'output', type: 'object' }]
  },
  {
    type: AgentNodeType.AGENT,
    label: 'Agent',
    description: 'AI Agent node',
    defaultData: { label: 'Agent', config: { model: 'default' } },
    inputs: [{ id: 'in', name: 'input', type: 'object', required: true }],
    outputs: [{ id: 'out', name: 'output', type: 'object' }]
  },
  {
    type: AgentNodeType.CONDITION,
    label: 'Condition',
    description: 'Branch based on condition',
    defaultData: { label: 'Condition', config: { expression: '' } },
    inputs: [{ id: 'in', name: 'input', type: 'object', required: true }],
    outputs: [
      { id: 'true', name: 'true', type: 'boolean' },
      { id: 'false', name: 'false', type: 'boolean' }
    ]
  },
  {
    type: AgentNodeType.PARALLEL,
    label: 'Parallel',
    description: 'Execute multiple nodes in parallel',
    defaultData: { label: 'Parallel', config: { maxConcurrency: 3 } },
    inputs: [{ id: 'in', name: 'input', type: 'object', required: true }],
    outputs: [{ id: 'out', name: 'output', type: 'object' }]
  },
  {
    type: AgentNodeType.MERGE,
    label: 'Merge',
    description: 'Merge multiple inputs',
    defaultData: { label: 'Merge', config: {} },
    inputs: [
      { id: 'in1', name: 'input1', type: 'object', required: true },
      { id: 'in2', name: 'input2', type: 'object', required: true }
    ],
    outputs: [{ id: 'out', name: 'output', type: 'object' }]
  },
  {
    type: AgentNodeType.OUTPUT,
    label: 'Output',
    description: 'Workflow output',
    defaultData: { label: 'Output', config: {} },
    inputs: [{ id: 'in', name: 'input', type: 'object', required: true }],
    outputs: []
  }
]
