/**
 * P12: Learning Service - Failure Pattern Learner
 * 
 * Analyzes historical failures to identify patterns, root causes,
 * and suggest preventive measures for improved system reliability.
 */

import { v4 as uuidv4 } from 'uuid'
import type { AgentRole } from '../../types'

// ============================================================================
// Failure Pattern Types
// ============================================================================

export interface FailureEvent {
  id: string
  timestamp: number
  taskId: string
  taskType: string
  subtaskId?: string
  responsibleRole?: AgentRole
  errorType: FailureErrorType
  errorMessage: string
  context: Record<string, unknown>
  severity: FailureSeverity
  resolved: boolean
  resolutionTime?: number
  rootCause?: string
  preventiveMeasures?: string[]
}

export type FailureErrorType =
  | 'timeout'
  | 'network_error'
  | 'rate_limit'
  | 'invalid_input'
  | 'dependency_failed'
  | 'resource_exhausted'
  | 'model_error'
  | 'unknown'

export type FailureSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface FailurePattern {
  id: string
  patternType: string
  description: string
  frequency: number
  occurrenceRate: number
  avgResolutionTime: number
  affectedTaskTypes: string[]
  affectedRoles: AgentRole[]
  firstOccurrence: number
  lastOccurrence: number
  rootCauses: string[]
  symptoms: string[]
  preventiveMeasures: string[]
  successRateOfMeasures: number
  confidence: number
  metadata: Record<string, unknown>
}

export interface PatternAnalysis {
  totalFailures: number
  uniquePatterns: number
  mostCommonPattern: FailurePattern | null
  mostSeverePattern: FailurePattern | null
  trend: 'increasing' | 'stable' | 'decreasing'
  estimatedLossTime: number
  recommendations: string[]
  newPatternsDetected: FailurePattern[]
}

export interface LearningConfig {
  minOccurrencesForPattern: number
  patternWindowMs: number
  decayFactor: number
  confidenceThreshold: number
  maxPatterns: number
}

export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  minOccurrencesForPattern: 3,
  patternWindowMs: 24 * 60 * 60 * 1000, // 24 hours
  decayFactor: 0.95,
  confidenceThreshold: 0.6,
  maxPatterns: 50,
}

// ============================================================================
// Error Type Mappings
// ============================================================================

const ERROR_TYPE_KEYWORDS: Record<FailureErrorType, string[]> = {
  timeout: ['timeout', 'timed out', '超时', '等待超时'],
  network_error: ['network', 'connection', '网络', '连接', '连接失败'],
  rate_limit: ['rate limit', 'rate_limit', '限流', '请求过多', '429'],
  invalid_input: ['invalid', 'malformed', '非法', '无效输入', '参数错误'],
  dependency_failed: ['dependency', 'depends on', '依赖', '前置任务失败'],
  resource_exhausted: ['memory', 'cpu', 'resource', '资源', '内存不足', 'oom'],
  model_error: ['model', 'ai', 'gpt', 'claude', '模型', 'AI响应'],
  unknown: ['unknown', 'error', '错误', '失败'],
}

const SEVERITY_WEIGHTS: Record<FailureSeverity, number> = {
  low: 1,
  medium: 2,
  high: 4,
  critical: 8,
}

// ============================================================================
// Failure Pattern Learner Implementation
// ============================================================================

export class FailurePatternLearner {
  private failures: Map<string, FailureEvent>
  private patterns: Map<string, FailurePattern>
  private config: LearningConfig
  private recentErrors: string[]

  constructor(config?: Partial<LearningConfig>) {
    this.failures = new Map()
    this.patterns = new Map()
    this.config = { ...DEFAULT_LEARNING_CONFIG, ...config }
    this.recentErrors = []
  }

  /**
   * Record a new failure event
   */
  async recordFailure(
    taskId: string,
    taskType: string,
    error: Error | string,
    context: Record<string, unknown> = {},
    responsibleRole?: AgentRole,
    severity: FailureSeverity = 'medium'
  ): Promise<FailureEvent> {
    const errorType = this.classifyError(error)
    const errorMessage = typeof error === 'string' ? error : error.message
    
    const failureEvent: FailureEvent = {
      id: `failure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      taskId,
      taskType,
      errorType,
      errorMessage,
      context,
      severity,
      resolved: false,
    }

    if (responsibleRole) {
      failureEvent.responsibleRole = responsibleRole
    }

    this.failures.set(failureEvent.id, failureEvent)
    this.recentErrors.push(errorMessage)
    
    if (this.recentErrors.length > 100) {
      this.recentErrors.shift()
    }

    await this.learnPatterns()

    return failureEvent
  }

  /**
   * Resolve a failure event
   */
  resolveFailure(failureId: string, rootCause?: string, preventiveMeasures?: string[]): boolean {
    const failure = this.failures.get(failureId)
    if (!failure) return false

    failure.resolved = true
    failure.resolutionTime = Date.now() - failure.timestamp
    failure.rootCause = rootCause
    failure.preventiveMeasures = preventiveMeasures

    return true
  }

  /**
   * Classify error type from error message
   */
  private classifyError(error: Error | string): FailureErrorType {
    const message = typeof error === 'string' ? error.toLowerCase() : error.message.toLowerCase()

    for (const [type, keywords] of Object.entries(ERROR_TYPE_KEYWORDS)) {
      if (keywords.some(kw => message.includes(kw))) {
        return type as FailureErrorType
      }
    }

    return 'unknown'
  }

  /**
   * Learn patterns from recorded failures
   */
  private async learnPatterns(): Promise<void> {
    const recentFailures = this.getRecentFailures()
    
    const groups = this.groupFailuresBySimilarity(recentFailures)
    
    for (const group of groups) {
      if (group.length < this.config.minOccurrencesForPattern) {
        continue
      }

      const pattern = this.derivePattern(group)
      if (pattern.confidence >= this.config.confidenceThreshold) {
        this.updatePattern(pattern)
      }
    }

    this.prunePatterns()
  }

  /**
   * Get failures within the pattern window
   */
  private getRecentFailures(): FailureEvent[] {
    const cutoff = Date.now() - this.config.patternWindowMs
    
    return Array.from(this.failures.values())
      .filter(f => f.timestamp >= cutoff)
  }

  /**
   * Group failures by similarity
   */
  private groupFailuresBySimilarity(failures: FailureEvent[]): FailureEvent[][] {
    const groups: FailureEvent[][] = []
    const assigned = new Set<string>()

    for (const failure of failures) {
      if (assigned.has(failure.id)) continue

      const group: FailureEvent[] = [failure]
      assigned.add(failure.id)

      for (const other of failures) {
        if (assigned.has(other.id)) continue
        
        if (this.areSimilar(failure, other)) {
          group.push(other)
          assigned.add(other.id)
        }
      }

      groups.push(group)
    }

    return groups
  }

  /**
   * Check if two failures are similar
   */
  private areSimilar(a: FailureEvent, b: FailureEvent): boolean {
    if (a.errorType !== b.errorType) return false

    if (a.taskType !== b.taskType && a.responsibleRole !== b.responsibleRole) {
      return false
    }

    const wordsA = new Set(a.errorMessage.toLowerCase().split(/\s+/))
    const wordsB = new Set(b.errorMessage.toLowerCase().split(/\s+/))
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length
    const union = new Set([...wordsA, ...wordsB]).size
    
    const similarity = intersection / union
    return similarity >= 0.5
  }

  /**
   * Derive a pattern from a group of similar failures
   */
  private derivePattern(failures: FailureEvent[]): FailurePattern {
    const firstFailure = failures[0]
    const lastFailure = failures[failures.length - 1]
    
    const allTasks = new Set(failures.map(f => f.taskId))
    const totalTasks = this.failures.size
    const occurrenceRate = Math.min(1, failures.length / Math.max(1, totalTasks))

    const resolvedFailures = failures.filter(f => f.resolutionTime !== undefined)
    const avgResolutionTime = resolvedFailures.length > 0
      ? resolvedFailures.reduce((sum, f) => sum + (f.resolutionTime || 0), 0) / resolvedFailures.length
      : Date.now() - firstFailure.timestamp

    const rootCauses = [...new Set(
      failures
        .filter(f => f.rootCause)
        .map(f => f.rootCause!)
    )]

    const symptoms = this.extractSymptoms(failures)

    const affectedRoles = [...new Set(
      failures
        .filter(f => f.responsibleRole)
        .map(f => f.responsibleRole!)
    )]

    const patternType = this.generatePatternType(firstFailure)

    const consistency = this.calculateConsistency(failures)
    const confidence = Math.min(1, (failures.length / 10) * consistency)

    const preventiveMeasures = this.suggestPreventiveMeasures(failures)

    const successRateOfMeasures = this.calculateMeasureSuccessRate(preventiveMeasures)

    return {
      id: `pattern_${patternType}_${Date.now()}`,
      patternType,
      description: this.generatePatternDescription(failures),
      frequency: failures.length,
      occurrenceRate,
      avgResolutionTime,
      affectedTaskTypes: [...new Set(failures.map(f => f.taskType))],
      affectedRoles,
      firstOccurrence: firstFailure.timestamp,
      lastOccurrence: lastFailure.timestamp,
      rootCauses,
      symptoms,
      preventiveMeasures,
      successRateOfMeasures,
      confidence,
      metadata: {
        severity: this.getMostCommonSeverity(failures),
        avgContextSize: failures.reduce((sum, f) => sum + Object.keys(f.context).length, 0) / failures.length,
      },
    }
  }

  /**
   * Calculate consistency score for a group of failures
   */
  private calculateConsistency(failures: FailureEvent[]): number {
    if (failures.length < 2) return 1

    const errorMessages = failures.map(f => f.errorMessage.toLowerCase())
    const uniqueMessages = new Set(errorMessages).size
    const messageConsistency = 1 - (uniqueMessages / failures.length)

    const contextKeys = failures.map(f => Object.keys(f.context).sort().join(','))
    const uniqueContexts = new Set(contextKeys).size
    const contextConsistency = 1 - (uniqueContexts / failures.length)

    return (messageConsistency + contextConsistency) / 2
  }

  /**
   * Extract symptoms from error messages
   */
  private extractSymptoms(failures: FailureEvent[]): string[] {
    const symptoms: string[] = []
    const allWords: Map<string, number> = new Map()

    for (const failure of failures) {
      const words = failure.errorMessage.toLowerCase().split(/\s+/)
      for (const word of words) {
        if (word.length > 4) {
          allWords.set(word, (allWords.get(word) || 0) + 1)
        }
      }
    }

    const sortedWords = [...allWords.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    for (const [word, count] of sortedWords) {
      if (count >= failures.length * 0.3) {
        symptoms.push(word)
      }
    }

    return symptoms
  }

  /**
   * Generate pattern type identifier
   */
  private generatePatternType(failure: FailureEvent): string {
    const parts = [
      failure.errorType,
      failure.taskType,
      failure.responsibleRole || 'unknown',
    ]
    return parts.join('_')
  }

  /**
   * Generate human-readable pattern description
   */
  private generatePatternDescription(failures: FailureEvent[]): string {
    const errorType = failures[0].errorType
    const taskTypes = [...new Set(failures.map(f => f.taskType))]
    const roles = [...new Set(failures.filter(f => f.responsibleRole).map(f => f.responsibleRole!))]

    const parts: string[] = []
    
    if (errorType !== 'unknown') {
      parts.push(`${errorType} error`)
    }
    
    if (taskTypes.length === 1) {
      parts.push(`in ${taskTypes[0]} tasks`)
    } else if (taskTypes.length > 1) {
      parts.push(`in multiple task types (${taskTypes.length})`)
    }

    if (roles.length > 0) {
      parts.push(`involving ${roles.join(',')} roles`)
    }

    parts.push(`occurred ${failures.length} times`)

    return parts.join(' ')
  }

  /**
   * Suggest preventive measures based on error type
   */
  private suggestPreventiveMeasures(failures: FailureEvent[]): string[] {
    const errorType = failures[0].errorType
    const measures: string[] = []

    switch (errorType) {
      case 'timeout':
        measures.push('Increase timeout limits')
        measures.push('Add retry mechanism')
        measures.push('Optimize task execution efficiency')
        break
      case 'network_error':
        measures.push('Add network status checks')
        measures.push('Implement reconnection on disconnect')
        measures.push('Increase request buffering')
        break
      case 'rate_limit':
        measures.push('Implement request rate limiting')
        measures.push('Add request queue')
        measures.push('Use exponential backoff strategy')
        break
      case 'invalid_input':
        measures.push('Enhance input validation')
        measures.push('Add parameter type checking')
        measures.push('Provide clearer error messages')
        break
      case 'dependency_failed':
        measures.push('Add pre-task dependency checks')
        measures.push('Implement dependency health checks')
        measures.push('Add task dependency timeout')
        break
      case 'resource_exhausted':
        measures.push('Implement resource monitoring')
        measures.push('Add resource quota management')
        measures.push('Optimize memory usage')
        break
      case 'model_error':
        measures.push('Add model response validation')
        measures.push('Implement model degradation strategy')
        measures.push('Add backup models')
        break
      default:
        measures.push('Add detailed logging')
        measures.push('Implement exception handling')
        measures.push('Add monitoring alerts')
    }

    return [...new Set(measures)]
  }

  /**
   * Calculate success rate of measures
   */
  private calculateMeasureSuccessRate(measures: string[]): number {
    // Simplified: in real implementation, track which measures were applied and their success
    return 0.7 // Default 70% estimated success rate
  }

  /**
   * Get most common severity in a group of failures
   */
  private getMostCommonSeverity(failures: FailureEvent[]): FailureSeverity {
    const severityCounts: Record<FailureSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }

    for (const failure of failures) {
      severityCounts[failure.severity]++
    }

    let maxSeverity: FailureSeverity = 'low'
    let maxCount = 0

    for (const [severity, count] of Object.entries(severityCounts)) {
      if (count > maxCount) {
        maxCount = count
        maxSeverity = severity as FailureSeverity
      }
    }

    return maxSeverity
  }

  /**
   * Update an existing pattern or add new one
   */
  private updatePattern(pattern: FailurePattern): void {
    const existing = Array.from(this.patterns.values()).find(
      p => p.patternType === pattern.patternType
    )

    if (existing) {
      // Merge patterns with decay factor for older data
      existing.frequency += pattern.frequency
      existing.lastOccurrence = pattern.lastOccurrence
      existing.confidence = Math.min(1, (existing.confidence + pattern.confidence) / 2)
      
      // Update occurrence rate
      existing.occurrenceRate = Math.min(1, 
        (existing.occurrenceRate + pattern.occurrenceRate) / 2
      )
      
      // Merge root causes
      const allRootCauses = [...new Set([...existing.rootCauses, ...pattern.rootCauses])]
      existing.rootCauses = allRootCauses
      
      // Update preventive measures based on effectiveness
      if (pattern.successRateOfMeasures > existing.successRateOfMeasures) {
        existing.preventiveMeasures = pattern.preventiveMeasures
        existing.successRateOfMeasures = pattern.successRateOfMeasures
      }
    } else {
      this.patterns.set(pattern.id, pattern)
    }
  }

  /**
   * Prune old or low-confidence patterns
   */
  private prunePatterns(): void {
    const cutoff = Date.now() - this.config.patternWindowMs * 7 // 7 days
    const toDelete: string[] = []

    for (const [id, pattern] of this.patterns) {
      // Delete old patterns
      if (pattern.lastOccurrence < cutoff) {
        toDelete.push(id)
        continue
      }

      // Delete low confidence patterns
      if (pattern.confidence < this.config.confidenceThreshold * 0.5) {
        toDelete.push(id)
      }
    }

    for (const id of toDelete) {
      this.patterns.delete(id)
    }

    // If still too many patterns, keep most frequent ones
    if (this.patterns.size > this.config.maxPatterns) {
      const sorted = [...this.patterns.values()].sort((a, b) => b.frequency - a.frequency)
      const toRemove = sorted.slice(this.config.maxPatterns)
      for (const pattern of toRemove) {
        this.patterns.delete(pattern.id)
      }
    }
  }

  /**
   * Get all detected patterns
   */
  getPatterns(): FailurePattern[] {
    return Array.from(this.patterns.values())
  }

  /**
   * Get pattern by ID
   */
  getPattern(patternId: string): FailurePattern | undefined {
    return this.patterns.get(patternId)
  }

  /**
   * Analyze patterns and generate report
   */
  analyzePatterns(): PatternAnalysis {
    const patterns = this.getPatterns()
    const recentFailures = this.getRecentFailures()
    
    // Calculate trend
    const now = Date.now()
    const hourAgo = now - 3600000
    const twoHoursAgo = now - 7200000
    
    const recentCount = recentFailures.filter(f => f.timestamp > hourAgo).length
    const previousCount = recentFailures.filter(f => f.timestamp <= hourAgo && f.timestamp > twoHoursAgo).length
    
    let trend: 'increasing' | 'stable' | 'decreasing'
    if (recentCount > previousCount * 1.5) {
      trend = 'increasing'
    } else if (recentCount < previousCount * 0.5) {
      trend = 'decreasing'
    } else {
      trend = 'stable'
    }

    // Calculate estimated loss time
    const totalResolutionTime = recentFailures
      .filter(f => f.resolutionTime !== undefined)
      .reduce((sum, f) => sum + (f.resolutionTime || 0), 0)
    const unresolvedTime = recentFailures
      .filter(f => !f.resolved)
      .reduce((sum, f) => sum + (now - f.timestamp), 0)
    const estimatedLossTime = totalResolutionTime + unresolvedTime

    // Find most common and most severe patterns
    const sortedByFrequency = [...patterns].sort((a, b) => b.frequency - a.frequency)
    const sortedBySeverity = [...patterns].sort((a, b) => {
      const severityA = SEVERITY_WEIGHTS[a.metadata.severity as FailureSeverity] || 1
      const severityB = SEVERITY_WEIGHTS[b.metadata.severity as FailureSeverity] || 1
      return severityB - severityA
    })

    // Generate recommendations
    const recommendations: string[] = []
    if (trend === 'increasing') {
      recommendations.push('Failure rate is increasing, consider rolling back recent changes')
    }
    if (patterns.length > 10) {
      recommendations.push('Multiple patterns detected, consider systematic architecture review')
    }
    
    const highSeverityPatterns = patterns.filter(p => 
      (p.metadata.severity as FailureSeverity) === 'high' || 
      (p.metadata.severity as FailureSeverity) === 'critical'
    )
    if (highSeverityPatterns.length > 0) {
      recommendations.push(`${highSeverityPatterns.length} high-severity patterns require immediate attention`)
    }

    return {
      totalFailures: recentFailures.length,
      uniquePatterns: patterns.length,
      mostCommonPattern: sortedByFrequency[0] || null,
      mostSeverePattern: sortedBySeverity[0] || null,
      trend,
      estimatedLossTime,
      recommendations,
      newPatternsDetected: patterns.filter(p => 
        p.firstOccurrence > now - this.config.patternWindowMs
      ),
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(count: number = 10): string[] {
    return this.recentErrors.slice(-count)
  }

  /**
   * Get failure events by task ID
   */
  getFailuresByTask(taskId: string): FailureEvent[] {
    return Array.from(this.failures.values()).filter(f => f.taskId === taskId)
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(errorType: FailureErrorType): boolean {
    const retryableErrors: FailureErrorType[] = ['timeout', 'network_error', 'rate_limit']
    return retryableErrors.includes(errorType)
  }

  /**
   * Get error type severity
   */
  getErrorTypeSeverity(errorType: FailureErrorType): FailureSeverity {
    const severityMap: Record<FailureErrorType, FailureSeverity> = {
      timeout: 'medium',
      network_error: 'medium',
      rate_limit: 'low',
      invalid_input: 'medium',
      dependency_failed: 'high',
      resource_exhausted: 'high',
      model_error: 'high',
      unknown: 'medium',
    }
    return severityMap[errorType]
  }
}

// Singleton instance
let learnerInstance: FailurePatternLearner | null = null

export function getFailurePatternLearner(): FailurePatternLearner {
  if (!learnerInstance) {
    learnerInstance = new FailurePatternLearner()
  }
  return learnerInstance
}

export function createFailurePatternLearner(config?: Partial<LearningConfig>): FailurePatternLearner {
  learnerInstance = new FailurePatternLearner(config)
  return learnerInstance
}