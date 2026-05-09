/**
 * Approval Workflow Services - P15
 * 
 * Provides approval workflow orchestration and management features.
 * Includes approval chains, delegation, notifications, and analytics.
 * 
 * @example
 * import { 
 *   approvalChainService,
 *   delegationService,
 *   approvalNotificationService,
 *   approvalAnalyticsService,
 * } from '@/services/approvalWorkflow';
 */

// ============================================================================
// Approval Chain Service
// ============================================================================

export {
  approvalChainService,
  getChainConfig,
  setChainConfig,
} from './approvalChainService';

export type {
  ApprovalChain,
  ApprovalNode,
  ChainStatus,
  ChainType,
  ChainConfig,
  ChainResult,
  NodeStatus,
} from './approvalChainService';

// ============================================================================
// Delegation Service
// ============================================================================

export {
  delegationService,
  getDelegationConfig,
  setDelegationConfig,
} from './approvalDelegationService';

export type {
  DelegationRule,
  DelegationStatus,
  ProxyApproval,
  ProxyStatus,
  DelegationStats,
  DelegationConfig,
} from './approvalDelegationService';

// ============================================================================
// Notification Service
// ============================================================================

export {
  approvalNotificationService,
  getNotificationConfig,
  setNotificationConfig,
} from './approvalNotificationService';

export type {
  ApprovalNotification,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationTemplate,
  NotificationConfig,
} from './approvalNotificationService';

// ============================================================================
// Analytics Service
// ============================================================================

export {
  approvalAnalyticsService,
  getAnalyticsConfig,
  setAnalyticsConfig,
} from './approvalAnalyticsService';

export type {
  ApprovalMetrics,
  RoleMetrics,
  TrendData,
  AnalyticsReport,
  BottleneckAnalysis,
  AnalyticsConfig,
  MetricPeriod,
  TrendDirection,
} from './approvalAnalyticsService';

// ============================================================================
// Quick Start Example
// ============================================================================

/**
 * ```typescript
 * // 1. Create an approval chain for complex workflows
 * const chain = await approvalChainService.createChain({
 *   chainType: 'sequential',
 *   name: 'Email Campaign Approval',
 *   description: 'Multi-stage approval for marketing emails',
 *   nodes: [
 *     { role: 'Advisor', isRequired: true },
 *     { role: 'Curator', isRequired: true },
 *     { role: 'Guardian', isRequired: true },
 *   ],
 *   requesterId: 'user_001',
 *   sessionId: 'session_123',
 *   taskId: 'task_456',
 * });
 * 
 * // 2. Set up delegation for when you're unavailable
 * const delegation = await delegationService.createDelegation({
 *   delegatorId: 'user_001',
 *   delegateId: 'user_002',
 *   roles: ['Advisor', 'Curator'],
 *   validFrom: Date.now(),
 *   validUntil: Date.now() + (7 * 24 * 60 * 60 * 1000), // 1 week
 *   reason: 'On vacation',
 * });
 * 
 * // 3. Send notifications for approval events
 * await approvalNotificationService.notifyApprovalRequest({
 *   requestId: 'approval_123',
 *   title: 'Send Marketing Email',
 *   description: 'Approval needed to send weekly newsletter',
 *   requesterId: 'user_001',
 *   approverId: 'user_002',
 *   approverRole: 'Advisor',
 *   priority: 'high',
 * });
 * 
 * // 4. Track and analyze approval performance
 * const metrics = approvalAnalyticsService.getMetrics('day');
 * console.log(`Approval rate: ${metrics.approvalRate.toFixed(1)}%`);
 * console.log(`Avg response time: ${(metrics.averageResponseTime / 1000 / 60).toFixed(1)} min`);
 * 
 * const bottlenecks = approvalAnalyticsService.analyzeBottlenecks('day');
 * if (bottlenecks.length > 0) {
 *   console.log('Bottlenecks detected:', bottlenecks);
 * }
 * 
 * const report = approvalAnalyticsService.generateReport({
 *   name: 'Weekly Approval Report',
 *   type: 'detailed',
 *   period: 'week',
 * });
 * console.log('Insights:', report.insights);
 * 
 * // 5. Record decisions for future analytics
 * await approvalAnalyticsService.recordDecision({
 *   requestId: 'approval_123',
 *   role: 'Advisor',
 *   status: 'approved',
 *   responseTime: 5 * 60 * 1000, // 5 minutes
 *   queueTime: 2 * 60 * 1000,   // 2 minutes
 *   priority: 'high',
 *   chainId: chain.id,
 * });
 * ```
 */
