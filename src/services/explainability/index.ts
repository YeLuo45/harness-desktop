/**
 * Explainability Services - P14
 * 
 * Provides AI decision transparency and explainability features.
 * Includes explanation generation, transparency disclosures, and execution tracing.
 * 
 * @example
 * import { 
 *   explanationService,
 *   transparencyService,
 *   traceService,
 * } from '@/services/explainability';
 */

// ============================================================================
// Explanation Service
// ============================================================================

export {
  explanationService,
  getExplanationConfig,
  setExplanationConfig,
} from './explanationService';

export type {
  ExplanationType,
  ExplanationLevel,
  ExplanationContext,
  Explanation,
  ExplanationRequest,
  ExplanationConfig,
} from './explanationService';

// ============================================================================
// Transparency Service
// ============================================================================

export {
  transparencyService,
  getTransparencyConfig,
  setTransparencyConfig,
} from './transparencyService';

export type {
  DisclosureType,
  DisclosureStatus,
  DisclosureContext,
  Disclosure,
  TransparencyReport,
  ReportSection,
  ReportMetrics,
  TransparencyConfig,
} from './transparencyService';

// ============================================================================
// Trace Service
// ============================================================================

export {
  traceService,
  getTraceConfig,
  setTraceConfig,
} from './traceService';

export type {
  TraceLevel,
  TraceStatus,
  TraceSpan,
  TraceAnnotation,
  Trace,
  TraceError,
  TraceQuery,
  TraceConfig,
  TraceTreeNode,
} from './traceService';

// ============================================================================
// Quick Start Example
// ============================================================================

/**
 * ```typescript
 * // 1. Generate an explanation for AI decision
 * const explanation = await explanationService.generateExplanation({
 *   type: 'decision',
 *   query: 'Should I recommend this product to the user?',
 *   response: 'Yes, I recommend product X because it matches user preferences.',
 *   reasoningChain: [
 *     'User has indicated interest in category A',
 *     'Product X belongs to category A',
 *     'Product X has high rating',
 *   ],
 *   context: {
 *     sessionId: 'session_123',
 *     confidence: 0.85,
 *     alternatives: ['Product Y', 'Product Z'],
 *   },
 *   role: 'Advisor',
 *   agentId: 'pixelpal',
 * });
 * 
 * // 2. Create a transparency disclosure
 * const disclosure = await transparencyService.createDisclosure({
 *   type: 'confidence',
 *   fullText: 'I am 85% confident in this recommendation based on available data.',
 *   context: {
 *     sessionId: 'session_123',
 *     severity: 'info',
 *   },
 *   role: 'Advisor',
 *   agentId: 'pixelpal',
 * });
 * 
 * // 3. Start a trace for execution tracking
 * const trace = traceService.startTrace({
 *   name: 'Product Recommendation Flow',
 *   description: 'Tracing the recommendation generation process',
 *   sessionId: 'session_123',
 *   taskId: 'task_456',
 *   role: 'Advisor',
 *   agentId: 'pixelpal',
 * });
 * 
 * // Add spans for different stages
 * const span1 = traceService.startSpan({
 *   traceId: trace.id,
 *   name: 'Data Collection',
 * });
 * 
 * traceService.annotate(trace.id, {
 *   type: 'info',
 *   message: 'Collected user preferences',
 * });
 * 
 * traceService.endSpan(trace.id, span1.id);
 * 
 * const span2 = traceService.startSpan({
 *   traceId: trace.id,
 *   name: 'Recommendation Generation',
 *   parentSpanId: span1.id,
 * });
 * 
 * traceService.annotateSpan(trace.id, span2.id, {
 *   type: 'decision',
 *   message: 'Selected Product X based on scoring',
 * });
 * 
 * traceService.endSpan(trace.id, span2.id);
 * traceService.completeTrace(trace.id);
 * 
 * // 4. Query traces for debugging
 * const traces = traceService.queryTraces({
 *   sessionId: 'session_123',
 *   status: 'completed',
 *   limit: 10,
 * });
 * 
 * // 5. Get explanation statistics
 * const stats = explanationService.getStats();
 * console.log(`Total explanations: ${stats.total}`);
 * console.log(`Average confidence: ${stats.averageConfidence}`);
 * ```
 */
