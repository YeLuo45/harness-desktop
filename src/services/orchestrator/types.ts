/**
 * Orchestrator Type Definitions
 * Core types for task orchestration, agent pooling, and result aggregation
 */

/** Task status enumeration */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/** Agent capability types */
export enum AgentCapability {
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  ANALYSIS = 'analysis',
  CREATIVE = 'creative',
  RESEARCH = 'research',
  GENERAL = 'general',
}

/** Agent specification defining agent capabilities and configuration */
export interface AgentSpec {
  id: string;
  name: string;
  capabilities: AgentCapability[];
  maxConcurrentTasks: number;
  currentLoad: number;
  isAvailable: boolean;
  metadata?: Record<string, unknown>;
}

/** A single atomic unit of work */
export interface SubTask {
  id: string;
  description: string;
  status: TaskStatus;
  assignedAgentId?: string;
  dependencies: string[]; // IDs of tasks that must complete before this one
  result?: unknown;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  priority: number; // 1-10, higher = more important
  retryCount: number;
  maxRetries: number;
}

/** A high-level orchestration task composed of multiple sub-tasks */
export interface OrchestrationTask {
  id: string;
  name: string;
  description: string;
  subTasks: SubTask[];
  status: TaskStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  parentTaskId?: string; // For nested task hierarchies
  metadata?: Record<string, unknown>;
}

/** Result from a completed sub-task */
export interface SubTaskResult {
  taskId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
  agentId: string;
}

/** Aggregated result from an orchestration task */
export interface OrchestrationResult {
  taskId: string;
  success: boolean;
  subTaskResults: SubTaskResult[];
  aggregatedData?: unknown;
  totalExecutionTimeMs: number;
  completedAt: Date;
}

/** DAG node for topological scheduling */
export interface DAGNode {
  taskId: string;
  dependencies: string[];
  dependents: string[]; // Tasks that depend on this one
  inDegree: number;
}

/** Agent pool configuration */
export interface AgentPoolConfig {
  minAgents: number;
  maxAgents: number;
  agentSpecs: AgentSpec[];
  loadBalancingStrategy: 'round_robin' | 'least_load' | 'capability_match';
}

/** Task scheduler events for monitoring */
export interface SchedulerEvent {
  type: 'task_scheduled' | 'task_started' | 'task_completed' | 'task_failed' | 'dag_cycle_detected';
  taskId: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/** Result aggregator configuration */
export interface AggregatorConfig {
  mergeStrategy: 'first_wins' | 'last_wins' | 'combine' | 'custom';
  customMergeFn?: (results: SubTaskResult[]) => unknown;
}
