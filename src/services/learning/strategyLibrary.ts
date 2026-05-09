/**
 * P12: Learning Service - Strategy Library
 * 
 * Repository of reusable execution strategies that define how to handle
 * different task types and failure scenarios.
 */

import { v4 as uuidv4 } from 'uuid'
import type { SubTask, AgentRole } from '../../types'

// ============================================================================
// Strategy Types
// ============================================================================

export interface StrategyCondition {
  taskTypes?: string[]
  keywords?: string[]
  roles?: AgentRole[]
  minComplexity?: number
  maxComplexity?: number
  customCheck?: (context: StrategyContext) => boolean
}

export interface StrategyContext {
  userRequest: string
  taskTypes: string[]
  detectedEntities: string[]
  complexity: number
  availableRoles: AgentRole[]
  previousFailures?: string[]
  timeConstraint?: number
}

export interface ExecutionStrategy {
  id: string
  name: string
  description: string
  version: string
  conditions: StrategyCondition
  config: StrategyConfig
  priority: number
  successRate?: number
  avgDuration?: number
  lastUsed?: number
  useCount: number
}

export interface StrategyConfig {
  maxConcurrentSubtasks: number
  taskTimeout: number
  enableParallelExecution: boolean
  enableCaching: boolean
  retryPolicy: RetryPolicy
  fallbackStrategyId?: string
  roleAssignments: Map<AgentRole, RoleAssignment>
  executionOrder: ExecutionOrder
}

export interface RoleAssignment {
  role: AgentRole
  taskTypes: string[]
  maxConcurrent: number
  priority: number
  timeout: number
}

export interface RetryPolicy {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableErrors: string[]
}

export interface ExecutionOrder {
  type: 'sequential' | 'parallel' | 'dependency_based' | 'priority_based'
  parallelGroups?: SubTask[][]
}

export interface StrategyResult {
  strategyId: string
  selectedStrategy: ExecutionStrategy
  estimatedDuration: number
  confidence: number
  warnings: string[]
}

// ============================================================================
// Built-in Strategy Templates
// ============================================================================

const STRATEGY_TEMPLATES = {
  QUICK_RESPONSE: 'quick_response',
  THOROUGH_REVIEW: 'thorough_review',
  TEST_DRIVEN: 'test_driven',
  REFACTOR_HEAVY: 'refactor_heavy',
  CONSERVATIVE: 'conservative',
  AGGRESSIVE: 'aggressive',
}

// ============================================================================
// Default Strategies
// ============================================================================

function createDefaultRetryPolicy(): RetryPolicy {
  return {
    maxRetries: 2,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['timeout', 'network_error', 'rate_limit'],
  }
}

function createRoleAssignment(role: AgentRole, taskTypes: string[], priority: number): RoleAssignment {
  return {
    role,
    taskTypes,
    maxConcurrent: role === 'orchestrator' ? 1 : 3,
    priority,
    timeout: 30000,
  }
}

// ============================================================================
// Strategy Library Implementation
// ============================================================================

export class StrategyLibrary {
  private strategies: Map<string, ExecutionStrategy>
  private defaultStrategyId: string
  private performanceHistory: Map<string, { success: boolean; duration: number }[]>

  constructor() {
    this.strategies = new Map()
    this.defaultStrategyId = STRATEGY_TEMPLATES.QUICK_RESPONSE
    this.performanceHistory = new Map()
    
    this.registerBuiltInStrategies()
  }

  /**
   * Register built-in strategies
   */
  private registerBuiltInStrategies(): void {
    // Quick Response Strategy
    this.register({
      id: STRATEGY_TEMPLATES.QUICK_RESPONSE,
      name: 'Quick Response Strategy',
      description: 'For simple queries, return results quickly without unnecessary decomposition',
      version: '1.0.0',
      conditions: {
        keywords: ['what is', 'how to', 'show', 'list', '什么是', '如何'],
        maxComplexity: 3,
      },
      config: {
        maxConcurrentSubtasks: 2,
        taskTimeout: 15000,
        enableParallelExecution: false,
        enableCaching: true,
        retryPolicy: { ...createDefaultRetryPolicy(), maxRetries: 1 },
        roleAssignments: new Map([
          ['orchestrator', createRoleAssignment('orchestrator', ['simple'], 1)],
        ]),
        executionOrder: { type: 'sequential' },
      },
      priority: 10,
      useCount: 0,
    })

    // Thorough Review Strategy
    this.register({
      id: STRATEGY_TEMPLATES.THOROUGH_REVIEW,
      name: 'Thorough Review Strategy',
      description: 'For complex review tasks, full verification and validation',
      version: '1.0.0',
      conditions: {
        keywords: ['review', 'analyze', '检查', '分析', 'audit'],
        minComplexity: 4,
      },
      config: {
        maxConcurrentSubtasks: 3,
        taskTimeout: 60000,
        enableParallelExecution: true,
        enableCaching: true,
        retryPolicy: createDefaultRetryPolicy(),
        roleAssignments: new Map([
          ['code_reviewer', createRoleAssignment('code_reviewer', ['review'], 1)],
          ['orchestrator', createRoleAssignment('orchestrator', ['review'], 2)],
        ]),
        executionOrder: { type: 'dependency_based' },
      },
      priority: 5,
      useCount: 0,
    })

    // Test Driven Strategy
    this.register({
      id: STRATEGY_TEMPLATES.TEST_DRIVEN,
      name: 'Test Driven Strategy',
      description: 'For test generation tasks, write tests first then implement',
      version: '1.0.0',
      conditions: {
        keywords: ['test', '测试', 'spec', 'specification'],
      },
      config: {
        maxConcurrentSubtasks: 3,
        taskTimeout: 90000,
        enableParallelExecution: true,
        enableCaching: false,
        retryPolicy: { ...createDefaultRetryPolicy(), maxRetries: 3 },
        roleAssignments: new Map([
          ['test_generator', createRoleAssignment('test_generator', ['generate'], 1)],
          ['code_reviewer', createRoleAssignment('code_reviewer', ['review'], 2)],
          ['orchestrator', createRoleAssignment('orchestrator', ['coordinate'], 3)],
        ]),
        executionOrder: { type: 'dependency_based' },
      },
      priority: 8,
      useCount: 0,
    })

    // Refactor Heavy Strategy
    this.register({
      id: STRATEGY_TEMPLATES.REFACTOR_HEAVY,
      name: 'Refactor Heavy Strategy',
      description: 'For refactoring tasks, careful analysis and incremental changes',
      version: '1.0.0',
      conditions: {
        keywords: ['refactor', '重构', 'restructure', 'reorganize'],
        minComplexity: 5,
      },
      config: {
        maxConcurrentSubtasks: 2,
        taskTimeout: 120000,
        enableParallelExecution: false,
        enableCaching: true,
        retryPolicy: { ...createDefaultRetryPolicy(), maxRetries: 4 },
        roleAssignments: new Map([
          ['refactorer', createRoleAssignment('refactorer', ['extract', 'inline', 'rename', 'move'], 1)],
          ['code_reviewer', createRoleAssignment('code_reviewer', ['review', 'approve'], 2)],
          ['test_generator', createRoleAssignment('test_generator', ['validate'], 3)],
        ]),
        executionOrder: { type: 'sequential' },
      },
      priority: 6,
      useCount: 0,
    })

    // Conservative Strategy
    this.register({
      id: STRATEGY_TEMPLATES.CONSERVATIVE,
      name: 'Conservative Strategy',
      description: 'High reliability strategy with extensive verification',
      version: '1.0.0',
      conditions: {
        maxComplexity: 10,
      },
      config: {
        maxConcurrentSubtasks: 2,
        taskTimeout: 180000,
        enableParallelExecution: false,
        enableCaching: true,
        retryPolicy: { ...createDefaultRetryPolicy(), maxRetries: 5 },
        roleAssignments: new Map([
          ['code_reviewer', createRoleAssignment('code_reviewer', ['review'], 1)],
          ['test_generator', createRoleAssignment('test_generator', ['validate'], 2)],
          ['refactorer', createRoleAssignment('refactorer', ['restructure'], 3)],
          ['orchestrator', createRoleAssignment('orchestrator', ['coordinate'], 4)],
        ]),
        executionOrder: { type: 'sequential' },
      },
      priority: 1,
      useCount: 0,
    })

    // Aggressive Strategy
    this.register({
      id: STRATEGY_TEMPLATES.AGGRESSIVE,
      name: 'Aggressive Strategy',
      description: 'Maximum parallelization,追求速度而非可靠性',
      version: '1.0.0',
      conditions: {
        maxComplexity: 4,
      },
      config: {
        maxConcurrentSubtasks: 6,
        taskTimeout: 10000,
        enableParallelExecution: true,
        enableCaching: false,
        retryPolicy: { ...createDefaultRetryPolicy(), maxRetries: 1 },
        roleAssignments: new Map([
          ['orchestrator', createRoleAssignment('orchestrator', ['coordinate'], 1)],
          ['code_reviewer', createRoleAssignment('code_reviewer', ['quick_review'], 2)],
        ]),
        executionOrder: { type: 'parallel' },
      },
      priority: 2,
      useCount: 0,
    })
  }

  /**
   * Register a new strategy
   */
  register(strategy: ExecutionStrategy): void {
    this.strategies.set(strategy.id, { ...strategy, useCount: 0 })
  }

  /**
   * Unregister a strategy
   */
  unregister(strategyId: string): boolean {
    if (strategyId === this.defaultStrategyId) {
      return false
    }
    return this.strategies.delete(strategyId)
  }

  /**
   * Get a strategy by ID
   */
  get(strategyId: string): ExecutionStrategy | undefined {
    return this.strategies.get(strategyId)
  }

  /**
   * Get all registered strategies
   */
  getAll(): ExecutionStrategy[] {
    return Array.from(this.strategies.values())
  }

  /**
   * Select the best strategy for given context
   */
  select(context: StrategyContext): StrategyResult {
    const matchedStrategies = this.matchStrategies(context)
    
    if (matchedStrategies.length === 0) {
      const defaultStrategy = this.strategies.get(this.defaultStrategyId)!
      return this.createStrategyResult(defaultStrategy, context, 'medium')
    }

    matchedStrategies.sort((a, b) => {
      const scoreA = this.calculateStrategyScore(a, context)
      const scoreB = this.calculateStrategyScore(b, context)
      return scoreB - scoreA
    })

    const selected = matchedStrategies[0]
    const confidence = this.calculateStrategyScore(selected, context) / 100
    
    selected.useCount++
    selected.lastUsed = Date.now()

    const warnings: string[] = []
    
    if (context.previousFailures && context.previousFailures.length > 0) {
      warnings.push('Historical failures detected, consider using a more conservative strategy')
    }
    
    if (context.timeConstraint && selected.config.taskTimeout > context.timeConstraint) {
      warnings.push('Strategy timeout may exceed time constraint')
    }

    return this.createStrategyResult(selected, context, confidence, warnings)
  }

  /**
   * Match strategies against context conditions
   */
  private matchStrategies(context: StrategyContext): ExecutionStrategy[] {
    const matched: ExecutionStrategy[] = []

    for (const strategy of this.strategies.values()) {
      if (this.matchesConditions(strategy, context)) {
        matched.push(strategy)
      }
    }

    return matched
  }

  /**
   * Check if context matches strategy conditions
   */
  private matchesConditions(strategy: ExecutionStrategy, context: StrategyContext): boolean {
    const conditions = strategy.conditions

    // Check task types
    if (conditions.taskTypes && conditions.taskTypes.length > 0) {
      const hasMatch = conditions.taskTypes.some(tt => context.taskTypes.includes(tt))
      if (!hasMatch) return false
    }

    // Check keywords
    if (conditions.keywords && conditions.keywords.length > 0) {
      const requestLower = context.userRequest.toLowerCase()
      const hasMatch = conditions.keywords.some(kw => requestLower.includes(kw.toLowerCase()))
      if (!hasMatch) return false
    }

    // Check complexity
    if (conditions.minComplexity !== undefined && context.complexity < conditions.minComplexity) {
      return false
    }
    if (conditions.maxComplexity !== undefined && context.complexity > conditions.maxComplexity) {
      return false
    }

    // Check custom condition
    if (conditions.customCheck && !conditions.customCheck(context)) {
      return false
    }

    return true
  }

  /**
   * Calculate strategy score based on context fit and performance
   */
  private calculateStrategyScore(strategy: ExecutionStrategy, context: StrategyContext): number {
    let score = 50

    // Priority boost
    score += strategy.priority * 3

    // Performance boost
    if (strategy.successRate !== undefined) {
      score += strategy.successRate * 0.3
    }

    // Recency boost
    if (strategy.lastUsed) {
      const hoursSinceUsed = (Date.now() - strategy.lastUsed) / (1000 * 60 * 60)
      if (hoursSinceUsed < 24) {
        score += 10
      } else if (hoursSinceUsed < 72) {
        score += 5
      }
    }

    // Keyword match bonus
    if (strategy.conditions.keywords) {
      const requestLower = context.userRequest.toLowerCase()
      const matchCount = strategy.conditions.keywords.filter(
        kw => requestLower.includes(kw.toLowerCase())
      ).length
      score += matchCount * 5
    }

    // Complexity fit bonus
    if (strategy.conditions.minComplexity !== undefined || strategy.conditions.maxComplexity !== undefined) {
      const minC = strategy.conditions.minComplexity || 0
      const maxC = strategy.conditions.maxComplexity || 10
      if (context.complexity >= minC && context.complexity <= maxC) {
        score += 10
      }
    }

    // Usage count bonus (well-tested strategies)
    if (strategy.useCount > 10) {
      score += 5
    } else if (strategy.useCount > 5) {
      score += 3
    }

    return score
  }

  /**
   * Create strategy result
   */
  private createStrategyResult(
    strategy: ExecutionStrategy,
    context: StrategyContext,
    confidence: number,
    warnings: string[] = []
  ): StrategyResult {
    // Calculate estimated duration
    const baseTime = strategy.config.taskTimeout
    const taskCount = context.taskTypes.length || 1
    const estimatedDuration = baseTime * taskCount * (strategy.config.enableParallelExecution ? 0.7 : 1)

    return {
      strategyId: strategy.id,
      selectedStrategy: strategy,
      estimatedDuration,
      confidence,
      warnings,
    }
  }

  /**
   * Record performance for a strategy
   */
  recordPerformance(strategyId: string, success: boolean, duration: number): void {
    const history = this.performanceHistory.get(strategyId) || []
    history.push({ success, duration })
    
    // Keep last 100 records
    if (history.length > 100) {
      history.shift()
    }
    
    this.performanceHistory.set(strategyId, history)
    
    // Update strategy success rate
    const strategy = this.strategies.get(strategyId)
    if (strategy) {
      const successfulRuns = history.filter(h => h.success).length
      strategy.successRate = (successfulRuns / history.length) * 100
      
      // Update average duration
      strategy.avgDuration = history.reduce((sum, h) => sum + h.duration, 0) / history.length
    }
  }

  /**
   * Get strategy performance stats
   */
  getStrategyStats(strategyId: string): { successRate: number; avgDuration: number; totalRuns: number } | null {
    const strategy = this.strategies.get(strategyId)
    const history = this.performanceHistory.get(strategyId)
    
    if (!strategy || !history || history.length === 0) {
      return null
    }
    
    return {
      successRate: strategy.successRate || 0,
      avgDuration: strategy.avgDuration || 0,
      totalRuns: history.length,
    }
  }
}

// Singleton instance
let libraryInstance: StrategyLibrary | null = null

export function getStrategyLibrary(): StrategyLibrary {
  if (!libraryInstance) {
    libraryInstance = new StrategyLibrary()
  }
  return libraryInstance
}

export function createStrategyLibrary(): StrategyLibrary {
  libraryInstance = new StrategyLibrary()
  return libraryInstance
}

export { STRATEGY_TEMPLATES }