/**
 * Task Decomposer Engine
 * Breaks down high-level orchestration tasks into executable sub-tasks with DAG dependencies
 */

import { SubTask, OrchestrationTask, TaskStatus, AgentCapability } from './types';

/** Configuration for task decomposition */
export interface DecompositionConfig {
  maxDepth: number;
  minTaskGranularity: 'coarse' | 'medium' | 'fine';
  autoDetectDependencies: boolean;
  maxSubTasksPerTask: number;
}

/** Default decomposition configuration */
const DEFAULT_CONFIG: DecompositionConfig = {
  maxDepth: 5,
  minTaskGranularity: 'medium',
  autoDetectDependencies: true,
  maxSubTasksPerTask: 50,
};

/** Keywords that suggest task relationships */
const DEPENDENCY_KEYWORDS: Record<string, string[]> = {
  before: ['before', 'prior to', 'preceding'],
  after: ['after', 'following', 'then', 'once'],
  parallel: ['and', 'also', 'additionally', 'simultaneously'],
};

/**
 * Analyzes text description to detect potential dependencies between tasks
 */
function detectImplicitDependencies(description: string): string[] {
  const keywords: string[] = [];
  const lowerDesc = description.toLowerCase();
  
  for (const [relation, words] of Object.entries(DEPENDENCY_KEYWORDS)) {
    if (words.some(word => lowerDesc.includes(word))) {
      keywords.push(relation);
    }
  }
  
  return keywords;
}

/**
 * Determines appropriate agent capabilities for a task based on its description
 */
function inferCapabilities(description: string): AgentCapability[] {
  const lowerDesc = description.toLowerCase();
  const capabilities: AgentCapability[] = [AgentCapability.GENERAL];
  
  if (lowerDesc.includes('code') || lowerDesc.includes('function') || lowerDesc.includes('implement')) {
    capabilities.push(AgentCapability.CODE_GENERATION);
  }
  if (lowerDesc.includes('review') || lowerDesc.includes('check') || lowerDesc.includes('validate')) {
    capabilities.push(AgentCapability.CODE_REVIEW);
  }
  if (lowerDesc.includes('test') || lowerDesc.includes('spec')) {
    capabilities.push(AgentCapability.TESTING);
  }
  if (lowerDesc.includes('document') || lowerDesc.includes('readme')) {
    capabilities.push(AgentCapability.DOCUMENTATION);
  }
  if (lowerDesc.includes('analyze') || lowerDesc.includes('evaluate')) {
    capabilities.push(AgentCapability.ANALYSIS);
  }
  if (lowerDesc.includes('research') || lowerDesc.includes('find') || lowerDesc.includes('search')) {
    capabilities.push(AgentCapability.RESEARCH);
  }
  if (lowerDesc.includes('creative') || lowerDesc.includes('design') || lowerDesc.includes('generate')) {
    capabilities.push(AgentCapability.CREATIVE);
  }
  
  return Array.from(new Set(capabilities));
}

/**
 * Task Decomposer class for breaking down complex tasks
 */
export class TaskDecomposer {
  private config: DecompositionConfig;
  
  constructor(config: Partial<DecompositionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Decomposes an orchestration task into executable sub-tasks
   */
  decompose(task: OrchestrationTask): SubTask[] {
    const subTasks: SubTask[] = [];
    const existingIds = new Set<string>();
    
    // Generate unique ID
    const generateId = (prefix: string, index: number): string => {
      let id = `${task.id}-${prefix}-${index}`;
      let counter = 1;
      while (existingIds.has(id)) {
        id = `${task.id}-${prefix}-${index}-${counter}`;
        counter++;
      }
      existingIds.add(id);
      return id;
    };
    
    // If task already has sub-tasks, validate and return them
    if (task.subTasks && task.subTasks.length > 0) {
      return this.validateAndEnrichSubTasks(task.subTasks, existingIds);
    }
    
    // Otherwise, decompose the main description
    const mainSubTask: SubTask = {
      id: generateId('main', 0),
      description: task.description,
      status: TaskStatus.PENDING,
      dependencies: [],
      createdAt: new Date(),
      priority: 5,
      retryCount: 0,
      maxRetries: 3,
    };
    
    subTasks.push(mainSubTask);
    
    // Apply auto-dependency detection
    if (this.config.autoDetectDependencies) {
      const deps = detectImplicitDependencies(task.description);
      if (deps.includes('after') || deps.includes('before')) {
        // Tasks have sequential dependencies
        this.addSequentialDependencies(subTasks);
      }
    }
    
    return subTasks;
  }
  
  /**
   * Validates and enriches existing sub-tasks with missing metadata
   */
  private validateAndEnrichSubTasks(subTasks: SubTask[], existingIds: Set<string>): SubTask[] {
    return subTasks.map((task, index) => {
      existingIds.add(task.id);
      return {
        ...task,
        id: task.id || `subtask-${index}`,
        status: task.status || TaskStatus.PENDING,
        dependencies: task.dependencies || [],
        createdAt: task.createdAt || new Date(),
        priority: task.priority || 5,
        retryCount: task.retryCount || 0,
        maxRetries: task.maxRetries || 3,
      };
    });
  }
  
  /**
   * Adds sequential dependencies to sub-tasks (each depends on previous)
   */
  private addSequentialDependencies(subTasks: SubTask[]): void {
    for (let i = 1; i < subTasks.length; i++) {
      subTasks[i].dependencies.push(subTasks[i - 1].id);
    }
  }
  
  /**
   * Decomposes a single task description into multiple sub-tasks
   */
  decomposeDescription(description: string, parentId: string, depth: number = 0): SubTask[] {
    if (depth >= this.config.maxDepth) {
      return [];
    }
    
    const subTasks: SubTask[] = [];
    const segments = this.splitIntoSegments(description);
    
    segments.forEach((segment, index) => {
      const subTask: SubTask = {
        id: `${parentId}-decomp-${depth}-${index}`,
        description: segment.trim(),
        status: TaskStatus.PENDING,
        dependencies: index > 0 ? [`${parentId}-decomp-${depth}-${index - 1}`] : [],
        createdAt: new Date(),
        priority: 5,
        retryCount: 0,
        maxRetries: 3,
      };
      
      subTasks.push(subTask);
    });
    
    return subTasks;
  }
  
  /**
   * Splits a description into logical segments
   */
  private splitIntoSegments(description: string): string[] {
    // Split by common delimiters while preserving some structure
    const delimiters = /[;\n]|(?=\s+and\s+)|(?=\s+then\s+)|(?=\s+also\s+)/i;
    return description.split(delimiters).filter(s => s.trim().length > 10);
  }
  
  /**
   * Creates a DAG from sub-tasks based on dependencies
   */
  buildDAG(subTasks: SubTask[]): Map<string, string[]> {
    const dag = new Map<string, string[]>();
    
    subTasks.forEach(task => {
      dag.set(task.id, [...task.dependencies]);
    });
    
    return dag;
  }
  
  /**
   * Detects circular dependencies in the task graph
   */
  detectCycles(subTasks: SubTask[]): string[] | null {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cyclePath: string[] = [];
    
    const dfs = (taskId: string): boolean => {
      visited.add(taskId);
      recStack.add(taskId);
      cyclePath.push(taskId);
      
      const dependencies = subTasks.find(t => t.id === taskId)?.dependencies || [];
      
      for (const depId of dependencies) {
        if (!visited.has(depId)) {
          if (dfs(depId)) {
            return true;
          }
        } else if (recStack.has(depId)) {
          cyclePath.push(depId);
          return true;
        }
      }
      
      recStack.delete(taskId);
      cyclePath.pop();
      return false;
    };
    
    for (const task of subTasks) {
      if (!visited.has(task.id)) {
        if (dfs(task.id)) {
          return cyclePath;
        }
      }
    }
    
    return null;
  }
}

export default TaskDecomposer;
