/**
 * P12: Learning Service - Barrel Export
 * 
 * Learning services for continuous improvement through:
 * - Trajectory scoring and evaluation
 * - Strategy selection and management
 * - Failure pattern analysis and learning
 */

export * from './trajectoryScorer'
export * from './strategyLibrary'
export * from './failurePatternLearner'

// Re-export types for convenience
export type {
  TrajectoryStep,
  Trajectory,
  TrajectoryScore,
  ScoreBreakdown,
  ScoringWeights,
} from './trajectoryScorer'

export type {
  StrategyCondition,
  StrategyContext,
  ExecutionStrategy,
  StrategyConfig,
  RoleAssignment,
  RetryPolicy,
  ExecutionOrder,
  StrategyResult,
} from './strategyLibrary'

export type {
  FailureEvent,
  FailureErrorType,
  FailureSeverity,
  FailurePattern,
  PatternAnalysis,
  LearningConfig,
} from './failurePatternLearner'

import { TrajectoryScorer, createTrajectoryScorer, getTrajectoryScorer } from './trajectoryScorer'
import { StrategyLibrary, createStrategyLibrary, getStrategyLibrary, STRATEGY_TEMPLATES } from './strategyLibrary'
import { FailurePatternLearner, createFailurePatternLearner, getFailurePatternLearner } from './failurePatternLearner'

// Default export for convenience
export default {
  scorer: {
    getInstance: getTrajectoryScorer,
    create: createTrajectoryScorer,
  },
  strategy: {
    getInstance: getStrategyLibrary,
    create: createStrategyLibrary,
    templates: STRATEGY_TEMPLATES,
  },
  failureLearner: {
    getInstance: getFailurePatternLearner,
    create: createFailurePatternLearner,
  },
}