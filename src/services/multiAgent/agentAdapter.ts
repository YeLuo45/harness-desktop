/**
 * P11: Multi-Agent Collaboration - Agent Adapter
 * 
 * Bridges CollaborationManager's collaboration types with SubAgentManager's agent types.
 */

import type { CollaborationTask, AgentOutput } from './types'
import type { SubAgentResult, SubTask } from '../../types'

/**
 * Convert a CollaborationTask to SubTask[] for SubAgentManager
 */
export function collaborationTaskToSubTasks(
  collaborationTask: CollaborationTask,
  agentId: string
): Partial<SubTask>[] {
  // Each collaboration task becomes one subtask for the sub-agent
  return [{
    id: collaborationTask.id,
    description: collaborationTask.description,
    toolCalls: [],  // Populated by agent's LLM
    status: 'idle',
    dependencies: collaborationTask.dependencies,
    createdAt: collaborationTask.createdAt
  }]
}

/**
 * Convert SubAgentResult to AgentOutput for collaboration layer
 */
export function subAgentResultToAgentOutput(
  result: SubAgentResult,
  taskId: string
): AgentOutput {
  // Aggregate subtask results into a single output
  const outputs = result.tasks.map(t => t.output).filter(Boolean)
  const aggregatedContent = outputs.length > 0 
    ? outputs.join('\n---\n') 
    : result.aggregatedOutput || ''

  return {
    agentId: result.agentId,
    role: 'orchestrator',  // Default role for converted results
    success: result.success,
    content: aggregatedContent || (result.success ? 'Task completed' : `Error: ${result.error}`),
    metadata: {
      taskId,
      kvCacheSnapshot: result.kvCacheSnapshot,
      subtaskCount: result.tasks.length
    }
  }
}

/**
 * Extract all task descriptions from a collaboration session for planning
 */
export function extractTaskDescriptions(tasks: CollaborationTask[]): string {
  return tasks.map(t => t.description).join('\n')
}