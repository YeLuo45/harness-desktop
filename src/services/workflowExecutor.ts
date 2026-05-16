// src/services/workflowExecutor.ts
import { Workflow, PhaseType, PhaseNodeData } from '../types/workflow';
import { PipelineOrchestrator } from './pipeline/pipelineOrchestrator';

/**
 * WorkflowExecutor - converts a visual workflow to PipelineOrchestrator execution
 * 
 * Reads workflow.nodes and workflow.edges, orders them by topological sort,
 * and executes each phase via the pipeline orchestrator.
 */
export interface ExecutionResult {
  success: boolean;
  results: Array<{
    nodeId: string;
    phaseType: PhaseType;
    label: string;
    success: boolean;
    error?: string;
  }>;
}

// Singleton orchestrator for execution
let orchestrator: PipelineOrchestrator | null = null;

function getOrchestrator(): PipelineOrchestrator {
  if (!orchestrator) {
    orchestrator = new PipelineOrchestrator({ unattended: true });
  }
  return orchestrator;
}

export const workflowExecutor = {
  /**
   * Execute a workflow from start to finish
   */
  async start(workflow: Workflow): Promise<ExecutionResult> {
    console.log('[WorkflowExecutor] Starting workflow:', workflow.name);
    
    const results: ExecutionResult['results'] = [];
    const orch = getOrchestrator();
    
    // Topological sort to order nodes by dependencies
    const sortedNodes = topologicalSort(workflow.nodes, workflow.edges);
    
    console.log('[WorkflowExecutor] Executing nodes in order:', sortedNodes.map(n => n.id));
    
    for (const node of sortedNodes) {
      const phaseData = node.data as PhaseNodeData;
      console.log(`[WorkflowExecutor] Executing node: ${node.id} (${phaseData.phaseType}) - ${phaseData.label}`);
      
      try {
        // Start a pipeline for this node
        const taskId = `wf_${node.id}_${Date.now()}`;
        const ctx = orch.startPipeline(taskId);
        
        console.log(`[WorkflowExecutor] Pipeline started: ${taskId}, initial phase: ${ctx.currentPhase}`);
        
        // Simulate phase execution based on phaseType
        const result = await simulatePhaseExecution(phaseData, orch, taskId);
        
        results.push({
          nodeId: node.id,
          phaseType: phaseData.phaseType,
          label: phaseData.label,
          success: result.success,
          error: result.error,
        });
        
        // Complete the pipeline
        orch.complete(taskId);
        
        if (!result.success) {
          console.error(`[WorkflowExecutor] Node ${node.id} failed:`, result.error);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({
          nodeId: node.id,
          phaseType: phaseData.phaseType,
          label: phaseData.label,
          success: false,
          error: errorMsg,
        });
      }
    }
    
    const allSuccess = results.every(r => r.success);
    console.log('[WorkflowExecutor] Workflow complete. All success:', allSuccess);
    
    return { success: allSuccess, results };
  },

  /**
   * Validate workflow structure before execution
   */
  validate(workflow: Workflow): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push('Workflow has no nodes');
    }
    
    // Check for orphaned nodes (no edges but also not entry points)
    const connectedNodes = new Set<string>();
    workflow.edges.forEach(e => {
      connectedNodes.add(e.source);
      connectedNodes.add(e.target);
    });
    
    workflow.nodes.forEach(n => {
      if (n.type === 'phase' && !connectedNodes.has(n.id)) {
        // Could be an entry point - check if it has no incoming edges
        const hasIncoming = workflow.edges.some(e => e.target === n.id);
        if (!hasIncoming && workflow.nodes.length > 1) {
          errors.push(`Node "${n.data.label}" has no connections`);
        }
      }
    });
    
    // Check for cycles using DFS
    if (hasCycle(workflow.nodes, workflow.edges)) {
      errors.push('Workflow contains a cycle');
    }
    
    return { valid: errors.length === 0, errors };
  },
};

/**
 * Simulate phase execution via PipelineOrchestrator
 */
async function simulatePhaseExecution(
  data: PhaseNodeData,
  orch: PipelineOrchestrator,
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the current phase config
    const phase = data.phaseType as PhaseType;
    
    // For custom phase, just simulate success without phase config
    if (phase === 'custom') {
      const timeout = data.timeout || 5000;
      await new Promise(resolve => setTimeout(resolve, Math.min(timeout, 2000)));
      return { success: true };
    }
    
    const phaseConfig = orch.getPhaseConfig(phase as any);
    
    if (!phaseConfig) {
      // Unknown phase, just simulate success
      console.log(`[WorkflowExecutor] Unknown phase ${phase}, simulating success`);
      return { success: true };
    }
    
    // Can we advance in this phase?
    if (orch.canAdvance(taskId)) {
      const nextPhase = orch.advance(taskId);
      console.log(`[WorkflowExecutor] Advanced to phase: ${nextPhase}`);
    }
    
    // Simulate actual work based on phase type
    const timeout = data.timeout || phaseConfig.timeout || 5000;
    await new Promise(resolve => setTimeout(resolve, Math.min(timeout, 2000))); // Cap at 2s for simulation
    
    // For standard phases, simulate success
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Topological sort of nodes based on edges
 */
function topologicalSort(
  nodes: Workflow['nodes'],
  edges: Workflow['edges']
): Workflow['nodes'] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  
  // Initialize
  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  });
  
  // Build graph
  edges.forEach(e => {
    adjacency.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  });
  
  // Kahn's algorithm
  const queue: string[] = [];
  inDegree.forEach((degree, id) => {
    if (degree === 0) queue.push(id);
  });
  
  const sorted: Workflow['nodes'] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) sorted.push(node);
    
    adjacency.get(id)?.forEach(target => {
      const newDegree = (inDegree.get(target) || 0) - 1;
      inDegree.set(target, newDegree);
      if (newDegree === 0) queue.push(target);
    });
  }
  
  return sorted;
}

/**
 * Check if the workflow graph has a cycle
 */
function hasCycle(
  nodes: Workflow['nodes'],
  edges: Workflow['edges']
): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  const adjacency = new Map<string, string[]>();
  nodes.forEach(n => adjacency.set(n.id, []));
  edges.forEach(e => adjacency.get(e.source)?.push(e.target));
  
  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    for (const neighbor of adjacency.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  }
  
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }
  
  return false;
}