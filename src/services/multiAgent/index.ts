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