/**
 * Main Orchestrator
 * Coordinates task decomposition, agent selection, scheduling, and result aggregation
 */

import { 
  OrchestrationTask, 
  SubTask, 
  SubTaskResult, 
  OrchestrationResult,
  AgentCapability,
  TaskStatus,
  AgentSpec
} from './types';
import { TaskDecomposer } from './taskDecomposer';
import { AgentPool } from './agentPool';
import { TaskScheduler, TopologicalSortResult } from './taskScheduler';
import { ResultAggregator } from './resultAggregator';

/** Orchestrator configuration */
export interface OrchestratorConfig {
  maxConcurrentTasks: number;
  enablePriorityScheduling: boolean;
  loadBalancingStrategy: 'round_robin' | 'least_load' | 'capability_match';
  resultMergeStrategy: 'first_wins' | 'last_wins' | 'combine' | 'custom';
  maxTaskRetries: number;
}

/** Default orchestrator configuration */
const DEFAULT_CONFIG: OrchestratorConfig = {
  maxConcurrentTasks: 5,
  enablePriorityScheduling: true,
  loadBalancingStrategy: 'least_load',
  resultMergeStrategy: 'combine',
  maxTaskRetries: 3,
};

/**
 * Main Orchestrator class
 */
export class Orchestrator {
  private config: OrchestratorConfig;
  private decomposer: TaskDecomposer;
  private agentPool: AgentPool;
  private scheduler: TaskScheduler;
  private aggregator: ResultAggregator;
  private taskResults: Map<string, SubTaskResult> = new Map();
  
  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.decomposer = new TaskDecomposer();
    this.agentPool = new AgentPool({
      maxAgents: this.config.maxConcurrentTasks * 2,
      loadBalancingStrategy: this.config.loadBalancingStrategy,
    });
    this.scheduler = new TaskScheduler({
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      enablePriorityScheduling: this.config.enablePriorityScheduling,
    });
    this.aggregator = new ResultAggregator({
      mergeStrategy: this.config.resultMergeStrategy,
    });
  }
  
  /**
   * Registers an agent with the orchestrator
   */
  registerAgent(spec: AgentSpec): boolean {
    return this.agentPool.registerAgent(spec);
  }
  
  /**
   * Removes an agent from the orchestrator
   */
  removeAgent(agentId: string): boolean {
    return this.agentPool.removeAgent(agentId);
  }
  
  /**
   * Executes an orchestration task
   */
  async execute(task: OrchestrationTask): Promise<OrchestrationResult> {
    const startTime = new Date();
    
    // Reset state
    this.taskResults.clear();
    
    // Step 1: Decompose task into sub-tasks
    const subTasks = this.decomposer.decompose(task);
    
    // Step 2: Build DAG and validate
    this.scheduler.buildDAG(subTasks);
    const sortResult = this.scheduler.topologicalSort();
    
    if (sortResult.hasCycle) {
      return this.createErrorResult(task.id, startTime, `Circular dependency detected: ${sortResult.cycleNodes?.join(' -> ')}`);
    }
    
    // Step 3: Execute tasks in topological order
    const completedTaskIds = new Set<string>();
    
    while (!this.scheduler.isComplete()) {
      const readyTasks = this.scheduler.getReadyTasks(completedTaskIds);
      
      if (readyTasks.length === 0 && !this.scheduler.isComplete()) {
        // Deadlock or all tasks blocked
        break;
      }
      
      // Execute ready tasks
      const executionPromises = readyTasks.map(subTask => 
        this.executeSubTask(subTask, completedTaskIds)
      );
      
      await Promise.all(executionPromises);
    }
    
    // Step 4: Aggregate results
    const results = Array.from(this.taskResults.values());
    return this.aggregator.aggregate(task.id, results, startTime);
  }
  
  /**
   * Executes a single sub-task
   */
  private async executeSubTask(subTask: SubTask, completedTaskIds: Set<string>): Promise<void> {
    const taskStartTime = Date.now();
    
    // Mark task as started
    if (!this.scheduler.markTaskStarted(subTask.id)) {
      return;
    }
    
    // Get available agent
    const agent = this.agentPool.getAvailableAgent([AgentCapability.GENERAL]);
    
    if (!agent) {
      this.scheduler.markTaskFailed(subTask.id);
      this.taskResults.set(subTask.id, {
        taskId: subTask.id,
        success: false,
        error: 'No available agent',
        executionTimeMs: Date.now() - taskStartTime,
        agentId: '',
      });
      return;
    }
    
    // Assign task to agent
    const assigned = this.agentPool.assignTask(agent.id, subTask.id);
    
    if (!assigned) {
      this.scheduler.markTaskFailed(subTask.id);
      this.taskResults.set(subTask.id, {
        taskId: subTask.id,
        success: false,
        error: 'Failed to assign task to agent',
        executionTimeMs: Date.now() - taskStartTime,
        agentId: agent.id,
      });
      return;
    }
    
    try {
      // Simulate task execution (in real implementation, this would call the agent)
      const result = await this.simulateTaskExecution(subTask);
      
      // Record result
      const executionTime = Date.now() - taskStartTime;
      this.taskResults.set(subTask.id, {
        taskId: subTask.id,
        success: true,
        data: result,
        executionTimeMs: executionTime,
        agentId: agent.id,
      });
      
      completedTaskIds.add(subTask.id);
      this.scheduler.markTaskCompleted(subTask.id);
      
    } catch (error) {
      const executionTime = Date.now() - taskStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Retry logic
      if (subTask.retryCount < subTask.maxRetries) {
        subTask.retryCount++;
        console.log(`Retrying task ${subTask.id} (${subTask.retryCount}/${subTask.maxRetries})`);
        // Would re-queue for retry
      } else {
        this.taskResults.set(subTask.id, {
          taskId: subTask.id,
          success: false,
          error: errorMessage,
          executionTimeMs: executionTime,
          agentId: agent.id,
        });
        completedTaskIds.add(subTask.id);
        this.scheduler.markTaskFailed(subTask.id);
      }
      
    } finally {
      this.agentPool.releaseTask(agent.id, subTask.id);
    }
  }
  
  /**
   * Simulates task execution (placeholder for actual agent execution)
   */
  private async simulateTaskExecution(subTask: SubTask): Promise<unknown> {
    // Simulate async execution
    await new Promise(resolve => setTimeout(resolve, 10));
    return { taskId: subTask.id, result: 'completed' };
  }
  
  /**
   * Creates an error result
   */
  private createErrorResult(taskId: string, startTime: Date, error: string): OrchestrationResult {
    return {
      taskId,
      success: false,
      subTaskResults: [],
      aggregatedData: null,
      totalExecutionTimeMs: Date.now() - startTime.getTime(),
      completedAt: new Date(),
    };
  }
  
  /**
   * Gets the current status of an orchestration task
   */
  getStatus(): {
    agentPoolStats: ReturnType<AgentPool['getStats']>;
    schedulerState: ReturnType<TaskScheduler['getState']>;
    pendingResults: number;
  } {
    return {
      agentPoolStats: this.agentPool.getStats(),
      schedulerState: this.scheduler.getState(),
      pendingResults: this.taskResults.size,
    };
  }
  
  /**
   * Cancels a running task
   */
  cancelTask(taskId: string): boolean {
    const result = this.taskResults.get(taskId);
    if (result) {
      // Mark as cancelled would require additional state tracking
      return true;
    }
    return false;
  }
  
  /**
   * Gets execution order for a set of tasks
   */
  getExecutionOrder(subTasks: SubTask[]): TopologicalSortResult {
    this.scheduler.buildDAG(subTasks);
    return this.scheduler.topologicalSort();
  }
}

export default Orchestrator;
