/**
 * Task Scheduler with DAG Topological Sort
 * Schedules tasks based on their dependencies using Kahn's algorithm
 */

import { SubTask, DAGNode, TaskStatus, SchedulerEvent } from './types';

/** Scheduler configuration */
export interface SchedulerConfig {
  maxConcurrentTasks: number;
  enablePriorityScheduling: boolean;
  respectDependencyOrder: boolean;
}

/** Default scheduler configuration */
const DEFAULT_CONFIG: SchedulerConfig = {
  maxConcurrentTasks: 5,
  enablePriorityScheduling: true,
  respectDependencyOrder: true,
};

/**
 * Topological sort result
 */
export interface TopologicalSortResult {
  order: string[];
  hasCycle: boolean;
  cycleNodes?: string[];
}

/**
 * Task Scheduler implementing DAG-based topological scheduling
 */
export class TaskScheduler {
  private config: SchedulerConfig;
  private dag: Map<string, DAGNode> = new Map();
  private events: SchedulerEvent[] = [];
  private runningTasks: Set<string> = new Set();
  private completedTasks: Set<string> = new Set();
  
  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Builds a DAG from sub-tasks
   */
  buildDAG(subTasks: SubTask[]): Map<string, DAGNode> {
    this.dag.clear();
    
    // Initialize nodes
    for (const task of subTasks) {
      this.dag.set(task.id, {
        taskId: task.id,
        dependencies: [...task.dependencies],
        dependents: [],
        inDegree: 0,
      });
    }
    
    // Build edges and calculate in-degrees
    this.dag.forEach((node, taskId) => {
      for (const depId of node.dependencies) {
        const depNode = this.dag.get(depId);
        if (depNode) {
          depNode.dependents.push(taskId);
        } else {
          console.warn(`Dependency ${depId} not found for task ${taskId}`);
        }
      }
      node.inDegree = node.dependencies.length;
    });
    
    return this.dag;
  }
  
  /**
   * Performs topological sort using Kahn's algorithm
   */
  topologicalSort(): TopologicalSortResult {
    if (this.dag.size === 0) {
      return { order: [], hasCycle: false };
    }
    
    const result: string[] = [];
    const queue: string[] = [];
    const inDegreeCopy = new Map<string, number>();
    
    // Initialize with nodes that have no dependencies
    this.dag.forEach((node, taskId) => {
      inDegreeCopy.set(taskId, node.inDegree);
      if (node.inDegree === 0) {
        queue.push(taskId);
      }
    });
    
    // Sort queue by priority if enabled
    if (this.config.enablePriorityScheduling) {
      queue.sort((a, b) => {
        const nodeA = this.dag.get(a);
        const nodeB = this.dag.get(b);
        return (nodeB?.inDegree || 0) - (nodeA?.inDegree || 0);
      });
    }
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      const node = this.dag.get(current);
      if (!node) continue;
      
      for (const dependentId of node.dependents) {
        const newDegree = (inDegreeCopy.get(dependentId) || 0) - 1;
        inDegreeCopy.set(dependentId, newDegree);
        
        if (newDegree === 0) {
          queue.push(dependentId);
          
          // Sort by priority if enabled
          if (this.config.enablePriorityScheduling) {
            queue.sort((a, b) => {
              const inDegA = inDegreeCopy.get(a) || 0;
              const inDegB = inDegreeCopy.get(b) || 0;
              return inDegB - inDegA;
            });
          }
        }
      }
    }
    
    // Check for cycle
    if (result.length !== this.dag.size) {
      const cycleNodes = Array.from(this.dag.keys()).filter(id => !result.includes(id));
      this.emitEvent('dag_cycle_detected', '', { cycleNodes });
      return { order: result, hasCycle: true, cycleNodes };
    }
    
    return { order: result, hasCycle: false };
  }
  
  /**
   * Gets tasks that are ready to execute (all dependencies completed)
   */
  getReadyTasks(completedTaskIds: Set<string>): SubTask[] {
    const readyTasks: SubTask[] = [];
    
    this.dag.forEach((node, taskId) => {
      if (this.completedTasks.has(taskId) || this.runningTasks.has(taskId)) {
        return;
      }
      
      // Check if all dependencies are met
      const depsMet = node.dependencies.every(depId => completedTaskIds.has(depId));
      
      if (depsMet) {
        readyTasks.push({
          id: taskId,
          description: '',
          status: TaskStatus.PENDING,
          dependencies: node.dependencies,
          createdAt: new Date(),
          priority: 5,
          retryCount: 0,
          maxRetries: 3,
        });
      }
    });
    
    // Sort by priority
    if (this.config.enablePriorityScheduling) {
      readyTasks.sort((a, b) => b.priority - a.priority);
    }
    
    // Limit concurrent tasks
    const maxAllowed = this.config.maxConcurrentTasks - this.runningTasks.size;
    return readyTasks.slice(0, maxAllowed > 0 ? maxAllowed : 0);
  }
  
  /**
   * Marks a task as started
   */
  markTaskStarted(taskId: string): boolean {
    if (!this.dag.has(taskId)) {
      console.error(`Task ${taskId} not found in DAG`);
      return false;
    }
    
    if (this.runningTasks.has(taskId)) {
      console.error(`Task ${taskId} already running`);
      return false;
    }
    
    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      console.error(`Max concurrent tasks (${this.config.maxConcurrentTasks}) reached`);
      return false;
    }
    
    this.runningTasks.add(taskId);
    this.emitEvent('task_started', taskId);
    return true;
  }
  
  /**
   * Marks a task as completed
   */
  markTaskCompleted(taskId: string): boolean {
    if (!this.runningTasks.has(taskId)) {
      console.error(`Task ${taskId} not running`);
      return false;
    }
    
    this.runningTasks.delete(taskId);
    this.completedTasks.add(taskId);
    this.emitEvent('task_completed', taskId);
    return true;
  }
  
  /**
   * Marks a task as failed
   */
  markTaskFailed(taskId: string): boolean {
    if (!this.runningTasks.has(taskId)) {
      return false;
    }
    
    this.runningTasks.delete(taskId);
    this.emitEvent('task_failed', taskId);
    return true;
  }
  
  /**
   * Resets the scheduler state
   */
  reset(): void {
    this.runningTasks.clear();
    this.completedTasks.clear();
    this.events = [];
  }
  
  /**
   * Gets current scheduler state
   */
  getState(): {
    pendingCount: number;
    runningCount: number;
    completedCount: number;
    maxConcurrent: number;
  } {
    return {
      pendingCount: this.dag.size - this.runningTasks.size - this.completedTasks.size,
      runningCount: this.runningTasks.size,
      completedCount: this.completedTasks.size,
      maxConcurrent: this.config.maxConcurrentTasks,
    };
  }
  
  /**
   * Checks if all tasks are complete
   */
  isComplete(): boolean {
    return this.completedTasks.size === this.dag.size && this.runningTasks.size === 0;
  }
  
  /**
   * Gets events history
   */
  getEvents(): SchedulerEvent[] {
    return [...this.events];
  }
  
  /**
   * Emits a scheduler event
   */
  private emitEvent(type: SchedulerEvent['type'], taskId: string, details?: Record<string, unknown>): void {
    this.events.push({
      type,
      taskId,
      timestamp: new Date(),
      details,
    });
  }
  
  /**
   * Gets the execution order (topological sort result)
   */
  getExecutionOrder(): string[] {
    return this.topologicalSort().order;
  }
  
  /**
   * Validates that a task can be scheduled (dependencies exist and no cycle)
   */
  validateTask(taskId: string): { valid: boolean; missingDependencies: string[] } {
    const node = this.dag.get(taskId);
    if (!node) {
      return { valid: false, missingDependencies: [] };
    }
    
    const missing = node.dependencies.filter(depId => !this.dag.has(depId));
    return {
      valid: missing.length === 0,
      missingDependencies: missing,
    };
  }
}

export default TaskScheduler;
