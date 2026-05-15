/**
 * P11: Multi-Agent Collaboration - MultiAgent Module
 * 
 * Export all multi-agent collaboration types and utilities.
 */

export {
  type AgentInstance,
  type AgentOutput,
  type CollaborationSession,
  type CollaborationTask,
  type OrchestrationPlan,
  type AggregationResult,
  type CollaborationEvent,
  type CollaborationEventHandler,
  BUILT_IN_AGENTS
} from './types'

export { CollaborationManager, collaborationManager } from './collaborationManager'

// Task Decomposer
export { TaskDecomposer, taskDecomposer, type DecomposedTask } from './taskDecomposer'
export type { SubTaskItem } from './taskDecomposer'

// Orchestrator
export { Orchestrator, orchestrator, type ExecutionPlan, type ExecutionStep } from './orchestrator'
export type { PlanMetadata } from './orchestrator'

// Result Aggregator
export { ResultAggregator, resultAggregator, type AggregationConfig } from './resultAggregator'
export type { ConflictResolution } from './resultAggregator'

// Agent Adapter
export { subAgentResultToAgentOutput, collaborationTaskToSubTasks, extractTaskDescriptions } from './agentAdapter'