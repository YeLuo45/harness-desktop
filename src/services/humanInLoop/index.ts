/**
 * Human-in-the-Loop Services - P13
 * 
 * Provides human oversight and control for AI agent collaboration workflows.
 * Includes approval, feedback, intervention, and review services.
 * 
 * @example
 * import { 
 *   approvalService,
 *   feedbackService,
 *   interventionService,
 *   reviewService,
 * } from '@/services/humanInLoop';
 */

// ============================================================================
// Approval Service
// ============================================================================

export {
  approvalService,
  getApprovalConfig,
  setApprovalConfig,
} from './approvalService';

export type {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalPriority,
  ApprovalConfig,
  ApprovalResult,
} from './approvalService';

// ============================================================================
// Feedback Service
// ============================================================================

export {
  feedbackService,
  DEFAULT_FEEDBACK_TAGS,
} from './feedbackService';

export type {
  HumanFeedback,
  FeedbackRating,
  FeedbackCategory,
  FeedbackTag,
  FeedbackSummary,
} from './feedbackService';

// ============================================================================
// Intervention Service
// ============================================================================

export {
  interventionService,
  getInterventionConfig,
  setInterventionConfig,
} from './interventionService';

export type {
  Intervention,
  InterventionType,
  InterventionStatus,
  InterventionContext,
  InterventionResult,
  InterventionConfig,
} from './interventionService';

// ============================================================================
// Review Service
// ============================================================================

export {
  reviewService,
  getReviewConfig,
  setReviewConfig,
} from './reviewService';

export type {
  ReviewItem,
  ReviewStatus,
  ReviewPriority,
  ReviewCategory,
  ReviewResult,
  ReviewConfig,
} from './reviewService';

// ============================================================================
// Quick Start Example
// ============================================================================

/**
 * ```typescript
 * // 1. Request approval for a critical AI action
 * const approval = await approvalService.requestApproval({
 *   sessionId: 'session_123',
 *   taskId: 'task_456',
 *   title: '发送重要邮件',
 *   description: 'AI建议发送一封重要邮件给客户',
 *   proposedAction: 'sendEmail(to: client@example.com, content: ...)',
 *   responsibleRole: 'Advisor',
 *   requesterId: 'agent_001',
 *   priority: 'high',
 * });
 * 
 * // 2. Collect user feedback on AI performance
 * await feedbackService.submitFeedback({
 *   sessionId: 'session_123',
 *   role: 'Advisor',
 *   agentId: 'pixelpal',
 *   rating: 5,
 *   categories: ['helpfulness', 'relevance'],
 *   tags: ['helpful', 'friendly'],
 *   comment: '建议很有用！',
 * });
 * 
 * // 3. Request human intervention when AI is uncertain
 * const intervention = await interventionService.requestIntervention({
 *   type: 'guidance',
 *   sessionId: 'session_123',
 *   taskId: 'task_456',
 *   requestingRole: 'Advisor',
 *   title: '需要人工指导',
 *   description: 'AI在选择下一步行动时遇到困难',
 *   context: {
 *     sessionId: 'session_123',
 *     taskId: 'task_456',
 *     currentState: 'analyzing_options',
 *     confidence: 0.4,
 *   },
 * });
 * 
 * // 4. Submit AI output for human review before executing
 * const review = await reviewService.submitForReview({
 *   sessionId: 'session_123',
 *   taskId: 'task_456',
 *   category: 'content_generation',
 *   title: '邮件内容待审核',
 *   description: '生成的邮件内容需要人工审核',
 *   content: { to: 'client@example.com', subject: '...', body: '...' },
 *   proposedAction: 'sendEmail',
 *   responsibleRole: 'Advisor',
 *   priority: 'high',
 * });
 * ```
 */
