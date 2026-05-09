/**
 * P12: Learning Service - Trajectory Scorer
 * 
 * Evaluates and scores execution trajectories to assess decision quality,
 * path efficiency, and outcome quality for continuous improvement.
 */

import { v4 as uuidv4 } from 'uuid'
import type { SubTask, SubTaskResult, AgentRole } from '../../types'

// ============================================================================
// Trajectory Types
// ============================================================================

export interface TrajectoryStep {
  stepIndex: number
  taskId: string
  action: string
  state: Record<string, unknown>
  duration: number        // Time spent on this step in ms
  confidence: number      // Confidence of the step outcome 0-1
  result?: unknown
  error?: string
}

export interface Trajectory {
  id: string
  taskId: string
  userRequest: string
  steps: TrajectoryStep[]
  totalDuration: number
  completedAt: number
  success: boolean
  finalResult?: unknown
  error?: string
}

export interface TrajectoryScore {
  trajectoryId: string
  overallScore: number          // 0-100
  efficiencyScore: number       // 0-100 Time/resource efficiency
  qualityScore: number          // 0-100 Output quality
  coherenceScore: number        // 0-100 Decision coherence
  adaptabilityScore: number     // 0-100 Adaptability to failures
  breakdown: ScoreBreakdown
  recommendations: string[]
  timestamp: number
}

export interface ScoreBreakdown {
  optimalPathLength: number
  actualPathLength: number
  redundantSteps: number
  failedSteps: number
  retryCount: number
  avgStepConfidence: number
  parallelizationGain: number   // Time saved by parallel execution
}

export interface ScoringWeights {
  efficiency: number      // Default: 0.25
  quality: number         // Default: 0.30
  coherence: number       // Default: 0.20
  adaptability: number    // Default: 0.25
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  efficiency: 0.25,
  quality: 0.30,
  coherence: 0.20,
  adaptability: 0.25,
}

// ============================================================================
// Score Thresholds
// ============================================================================

const SCORE_THRESHOLDS = {
  EXCELLENT: 85,
  GOOD: 70,
  FAIR: 50,
  POOR: 30,
}

// ============================================================================
// Trajectory Scorer Implementation
// ============================================================================

export class TrajectoryScorer {
  private weights: ScoringWeights
  private historicalScores: Map<string, TrajectoryScore>

  constructor(weights?: Partial<ScoringWeights>) {
    this.weights = { ...DEFAULT_SCORING_WEIGHTS, ...weights }
    this.historicalScores = new Map()
  }

  /**
   * Score a completed trajectory
   */
  async score(trajectory: Trajectory): Promise<TrajectoryScore> {
    const breakdown = this.calculateBreakdown(trajectory)
    
    const efficiencyScore = this.calculateEfficiencyScore(breakdown)
    const qualityScore = this.calculateQualityScore(trajectory, breakdown)
    const coherenceScore = this.calculateCoherenceScore(trajectory)
    const adaptabilityScore = this.calculateAdaptabilityScore(breakdown)
    
    const overallScore = Math.round(
      efficiencyScore * this.weights.efficiency +
      qualityScore * this.weights.quality +
      coherenceScore * this.weights.coherence +
      adaptabilityScore * this.weights.adaptability
    )

    const score: TrajectoryScore = {
      trajectoryId: trajectory.id,
      overallScore,
      efficiencyScore: Math.round(efficiencyScore),
      qualityScore: Math.round(qualityScore),
      coherenceScore: Math.round(coherenceScore),
      adaptabilityScore: Math.round(adaptabilityScore),
      breakdown,
      recommendations: this.generateRecommendations(breakdown, overallScore),
      timestamp: Date.now(),
    }

    this.historicalScores.set(trajectory.id, score)
    return score
  }

  /**
   * Calculate breakdown metrics from trajectory
   */
  private calculateBreakdown(trajectory: Trajectory): ScoreBreakdown {
    const steps = trajectory.steps
    const optimalPathLength = this.estimateOptimalPathLength(trajectory)
    const actualPathLength = steps.length
    
    let redundantSteps = 0
    let failedSteps = 0
    let retryCount = 0
    let totalConfidence = 0
    
    const seenActions = new Set<string>()
    
    for (const step of steps) {
      if (step.error) {
        failedSteps++
      }
      
      if (seenActions.has(step.action)) {
        redundantSteps++
      } else {
        seenActions.add(step.action)
      }
      
      if (step.result && typeof step.result === 'object' && 
          (step.result as Record<string, unknown>).retryCount !== undefined) {
        retryCount += (step.result as Record<string, unknown>).retryCount as number
      }
      
      totalConfidence += step.confidence
    }
    
    // Calculate parallelization gain (estimate)
    const sequentialTime = steps.reduce((sum, s) => sum + s.duration, 0)
    const parallelizationGain = Math.max(0, sequentialTime - trajectory.totalDuration)
    
    return {
      optimalPathLength,
      actualPathLength,
      redundantSteps,
      failedSteps,
      retryCount,
      avgStepConfidence: steps.length > 0 ? totalConfidence / steps.length : 0,
      parallelizationGain,
    }
  }

  /**
   * Estimate optimal path length based on task type
   */
  private estimateOptimalPathLength(trajectory: Trajectory): number {
    const request = trajectory.userRequest.toLowerCase()
    
    if (request.includes('分析') || request.includes('review') || request.includes('analyze')) {
      return 3
    }
    if (request.includes('test') || request.includes('测试')) {
      return 4
    }
    if (request.includes('refactor') || request.includes('重构')) {
      return 5
    }
    
    return Math.ceil(trajectory.steps.length * 0.6)
  }

  /**
   * Calculate efficiency score based on path length and time
   */
  private calculateEfficiencyScore(breakdown: ScoreBreakdown): number {
    const { optimalPathLength, actualPathLength, redundantSteps } = breakdown
    
    // Path efficiency: credit for staying close to optimal
    const pathEfficiency = optimalPathLength > 0 
      ? Math.min(100, (optimalPathLength / actualPathLength) * 100)
      : 100
    
    // Penalty for redundant steps
    const redundancyPenalty = Math.min(30, redundantSteps * 10)
    
    // Time efficiency
    const optimalTime = optimalPathLength * 3000
    const timeEfficiency = optimalTime > 0
      ? Math.min(100, (optimalTime / (optimalTime + breakdown.parallelizationGain + 1000)) * 100)
      : 100
    
    return pathEfficiency * 0.6 + timeEfficiency * 0.4 - redundancyPenalty
  }

  /**
   * Calculate quality score based on confidence and success
   */
  private calculateQualityScore(trajectory: Trajectory, breakdown: ScoreBreakdown): number {
    const { avgStepConfidence, failedSteps } = breakdown
    
    let quality = avgStepConfidence * 100
    
    // Penalty for failed steps
    const failurePenalty = (failedSteps / Math.max(1, trajectory.steps.length)) * 40
    quality -= failurePenalty
    
    // Bonus for successful completion
    if (trajectory.success) {
      quality = Math.min(100, quality + 10)
    }
    
    // Check result quality if available
    if (trajectory.finalResult) {
      const resultQuality = this.assessResultQuality(trajectory.finalResult)
      quality = quality * 0.7 + resultQuality * 0.3
    }
    
    return Math.max(0, Math.min(100, quality))
  }

  /**
   * Assess the quality of a final result
   */
  private assessResultQuality(result: unknown): number {
    if (!result) return 0
    
    if (typeof result === 'object' && result !== null) {
      const record = result as Record<string, unknown>
      if (typeof record.confidence === 'number') {
        return record.confidence * 100
      }
      if (typeof record.quality === 'number') {
        return record.quality * 100
      }
      if (Array.isArray(record.entities) && record.entities.length > 0) {
        return 70
      }
      if (typeof record.summary === 'string' && record.summary.length > 50) {
        return 75
      }
    }
    
    return 60
  }

  /**
   * Calculate coherence score based on decision logic flow
   */
  private calculateCoherenceScore(trajectory: Trajectory): number {
    const steps = trajectory.steps
    if (steps.length <= 1) return 100
    
    let coherentTransitions = 0
    let totalTransitions = steps.length - 1
    
    for (let i = 1; i < steps.length; i++) {
      const prevStep = steps[i - 1]
      const currStep = steps[i]
      
      if (this.isLogicalTransition(prevStep, currStep)) {
        coherentTransitions++
      }
    }
    
    const transitionScore = totalTransitions > 0
      ? (coherentTransitions / totalTransitions) * 100
      : 100
    
    const dependencyViolations = this.countDependencyViolations(steps)
    const violationPenalty = Math.min(30, dependencyViolations * 15)
    
    return Math.max(0, transitionScore - violationPenalty)
  }

  /**
   * Check if a transition between steps is logical
   */
  private isLogicalTransition(prevStep: TrajectoryStep, currStep: TrajectoryStep): boolean {
    const prevAction = prevStep.action.toLowerCase()
    const currAction = currStep.action.toLowerCase()
    
    // Review should come after implementation
    if (currAction.includes('review') || currAction.includes('检查')) {
      if (prevAction.includes('implement') || prevAction.includes('write') || 
          prevAction.includes('实现') || prevAction.includes('编写')) {
        return true
      }
    }
    
    // Test should come after implementation
    if (currAction.includes('test') || currAction.includes('测试')) {
      if (prevAction.includes('implement') || prevAction.includes('review') || 
          prevAction.includes('实现') || prevAction.includes('检查')) {
        return true
      }
    }
    
    // Steps of same type are acceptable sequentially
    if (prevAction.split('_')[0] === currAction.split('_')[0]) {
      return true
    }
    
    return true
  }

  /**
   * Count dependency violations in the trajectory
   */
  private countDependencyViolations(steps: TrajectoryStep[]): number {
    return steps.filter(s => s.error).length
  }

  /**
   * Calculate adaptability score based on failure recovery
   */
  private calculateAdaptabilityScore(breakdown: ScoreBreakdown): number {
    const { failedSteps, retryCount } = breakdown
    
    let adaptability = 100
    
    adaptability -= failedSteps * 15
    adaptability += Math.min(20, retryCount * 5)
    
    if (failedSteps === 0) {
      adaptability = Math.min(100, adaptability + 10)
    }
    
    return Math.max(0, Math.min(100, adaptability))
  }

  /**
   * Generate recommendations based on score and breakdown
   */
  private generateRecommendations(breakdown: ScoreBreakdown, overallScore: number): string[] {
    const recommendations: string[] = []
    
    if (overallScore >= SCORE_THRESHOLDS.EXCELLENT) {
      recommendations.push('Trajectory performance is excellent, maintain current strategy')
      return recommendations
    }
    
    if (breakdown.redundantSteps > 0) {
      recommendations.push(`Found ${breakdown.redundantSteps} redundant steps, consider optimizing task decomposition`)
    }
    
    if (breakdown.failedSteps > 0) {
      recommendations.push(`Found ${breakdown.failedSteps} failed steps, analyze failure causes and add error handling`)
    }
    
    if (breakdown.actualPathLength > breakdown.optimalPathLength * 1.5) {
      recommendations.push('Path length significantly exceeds optimal, consider redesigning task decomposition strategy')
    }
    
    if (breakdown.avgStepConfidence < 0.6) {
      recommendations.push('Average confidence is low, consider improving retrieval quality or adding verification steps')
    }
    
    if (breakdown.retryCount > 3) {
      recommendations.push('Too many retries, consider adding precondition checks to reduce failure likelihood')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Overall performance is acceptable, optimize specific weak points')
    }
    
    return recommendations
  }

  /**
   * Compare two trajectories
   */
  compare(trajectoryA: Trajectory, trajectoryB: Trajectory): {
    winner: 'A' | 'B' | 'tie'
    scoreDiff: number
    dimensionDiffs: {
      efficiency: number
      quality: number
      coherence: number
      adaptability: number
    }
  } {
    const scoreA = this.historicalScores.get(trajectoryA.id) 
      || { efficiencyScore: 70, qualityScore: 70, coherenceScore: 70, adaptabilityScore: 70, overallScore: 70 }
    const scoreB = this.historicalScores.get(trajectoryB.id)
      || { efficiencyScore: 70, qualityScore: 70, coherenceScore: 70, adaptabilityScore: 70, overallScore: 70 }
    
    const efficiencyDiff = scoreA.efficiencyScore - scoreB.efficiencyScore
    const qualityDiff = scoreA.qualityScore - scoreB.qualityScore
    const coherenceDiff = scoreA.coherenceScore - scoreB.coherenceScore
    const adaptabilityDiff = scoreA.adaptabilityScore - scoreB.adaptabilityScore
    const totalDiff = scoreA.overallScore - scoreB.overallScore
    
    let winner: 'A' | 'B' | 'tie'
    if (totalDiff > 5) winner = 'A'
    else if (totalDiff < -5) winner = 'B'
    else winner = 'tie'
    
    return {
      winner,
      scoreDiff: Math.round(totalDiff),
      dimensionDiffs: {
        efficiency: Math.round(efficiencyDiff),
        quality: Math.round(qualityDiff),
        coherence: Math.round(coherenceDiff),
        adaptability: Math.round(adaptabilityDiff),
      },
    }
  }

  /**
   * Get historical scores
   */
  getHistoricalScore(trajectoryId: string): TrajectoryScore | undefined {
    return this.historicalScores.get(trajectoryId)
  }

  /**
   * Get average scores across all scored trajectories
   */
  getAverageScores(): Omit<TrajectoryScore, 'trajectoryId' | 'breakdown' | 'recommendations' | 'timestamp'> {
    if (this.historicalScores.size === 0) {
      return {
        overallScore: 0,
        efficiencyScore: 0,
        qualityScore: 0,
        coherenceScore: 0,
        adaptabilityScore: 0,
      }
    }

    let totalOverall = 0
    let totalEfficiency = 0
    let totalQuality = 0
    let totalCoherence = 0
    let totalAdaptability = 0

    for (const score of this.historicalScores.values()) {
      totalOverall += score.overallScore
      totalEfficiency += score.efficiencyScore
      totalQuality += score.qualityScore
      totalCoherence += score.coherenceScore
      totalAdaptability += score.adaptabilityScore
    }

    const count = this.historicalScores.size
    return {
      overallScore: Math.round(totalOverall / count),
      efficiencyScore: Math.round(totalEfficiency / count),
      qualityScore: Math.round(totalQuality / count),
      coherenceScore: Math.round(totalCoherence / count),
      adaptabilityScore: Math.round(totalAdaptability / count),
    }
  }
}

// Singleton instance
let scorerInstance: TrajectoryScorer | null = null

export function getTrajectoryScorer(): TrajectoryScorer {
  if (!scorerInstance) {
    scorerInstance = new TrajectoryScorer()
  }
  return scorerInstance
}

export function createTrajectoryScorer(weights?: Partial<ScoringWeights>): TrajectoryScorer {
  scorerInstance = new TrajectoryScorer(weights)
  return scorerInstance
}