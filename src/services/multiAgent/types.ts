/**
 * P11: Multi-Agent Collaboration - Agent Types
 * 
 * Enhanced types for multi-agent collaboration system.
 */

import type { AgentConfig, AgentRole, SubAgent, SubTask, SubTaskResult, SubAgentResult } from '../../types'

// Agent state
export type CollaborationStatus = 'idle' | 'planning' | 'delegating' | 'working' | 'aggregating' | 'completed' | 'failed'

// Agent instance with runtime state
export interface AgentInstance {
  id: string
  config: AgentConfig
  status: CollaborationStatus
  currentTask?: string
  startTime?: number
  endTime?: number
  result?: AgentOutput
  error?: string
}

// Output from an agent
export interface AgentOutput {
  agentId: string
  role: AgentRole
  success: boolean
  content: string
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>
  results?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

// Collaboration session
export interface CollaborationSession {
  id: string
  name: string
  description?: string
  status: CollaborationStatus
  agents: Map<string, AgentInstance>
  tasks: CollaborationTask[]
  results: Map<string, AgentOutput>
  createdAt: number
  updatedAt: number
  completedAt?: number
}

// A task assigned to an agent
export interface CollaborationTask {
  id: string
  description: string
  assignedAgent?: string  // Agent ID
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed'
  dependencies: string[]  // Task IDs that must complete first
  result?: AgentOutput
  createdAt: number
  startedAt?: number
  completedAt?: number
}

// Orchestration plan
export interface OrchestrationPlan {
  sessionId: string
  tasks: CollaborationTask[]
  executionOrder: string[][]  // Groups of task IDs that can run in parallel
  estimatedDuration?: number
  createdAt: number
}

// Result aggregator
export interface AggregationResult {
  sessionId: string
  outputs: AgentOutput[]
  finalOutput: string
  summary: string
  metadata: Record<string, unknown>
}

// Agent communication message
export interface AgentMessage {
  id: string
  from: string  // Agent ID
  to?: string   // Agent ID (undefined for broadcast)
  type: 'task' | 'result' | 'status' | 'error' | 'ready'
  payload: unknown
  timestamp: number
}

// Collaboration events
export type CollaborationEventType = 
  | 'session_started'
  | 'agent_registered'
  | 'task_assigned'
  | 'task_completed'
  | 'agent_completed'
  | 'session_completed'
  | 'session_failed'

export interface CollaborationEvent {
  type: CollaborationEventType
  sessionId: string
  agentId?: string
  taskId?: string
  data?: unknown
  timestamp: number
}

// Event handler
export type CollaborationEventHandler = (event: CollaborationEvent) => void

// Built-in agent configurations
export const BUILT_IN_AGENTS: AgentConfig[] = [
  {
    id: 'orchestrator',
    name: 'Orchestrator',
    role: 'orchestrator',
    maxConcurrentTasks: 1,
    timeout: 300000,
    retryOnFailure: true
  },
  {
    id: 'code_reviewer',
    name: 'Code Reviewer',
    role: 'code_reviewer',
    maxConcurrentTasks: 3,
    timeout: 120000,
    retryOnFailure: true
  },
  {
    id: 'test_generator',
    name: 'Test Generator',
    role: 'test_generator',
    maxConcurrentTasks: 2,
    timeout: 180000,
    retryOnFailure: true
  },
  {
    id: 'refactorer',
    name: 'Refactorer',
    role: 'refactorer',
    maxConcurrentTasks: 2,
    timeout: 240000,
    retryOnFailure: true
  }
]