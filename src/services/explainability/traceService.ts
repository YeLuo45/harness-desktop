/**
 * Trace Service - P14
 * 
 * Provides execution tracing and audit logging for AI decisions.
 * Records decision paths, reasoning steps, and action sequences for debugging and explainability.
 */

import type { PersonaRole } from '../collaboration/types';

// ============================================================================
// Types
// ============================================================================

export type TraceLevel = 'minimal' | 'standard' | 'verbose' | 'debug';
export type TraceStatus = 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface TraceSpan {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  level: TraceLevel;
  metadata?: Record<string, unknown>;
  annotations?: TraceAnnotation[];
  children?: string[];  // Child span IDs
  parentId?: string;    // Parent span ID
}

export interface TraceAnnotation {
  timestamp: number;
  type: 'info' | 'warning' | 'error' | 'decision' | 'action' | 'result';
  message: string;
  data?: Record<string, unknown>;
}

export interface Trace {
  id: string;
  traceId: string;         // Group ID for related traces
  name: string;
  description?: string;
  status: TraceStatus;
  level: TraceLevel;
  role: PersonaRole;
  agentId: string;
  sessionId?: string;
  taskId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  spans: Map<string, TraceSpan>;
  rootSpanId?: string;
  metadata?: Record<string, unknown>;
  annotations: TraceAnnotation[];
  error?: TraceError;
  createdAt: number;
}

export interface TraceError {
  message: string;
  stack?: string;
  code?: string;
  data?: Record<string, unknown>;
}

export interface TraceQuery {
  sessionId?: string;
  taskId?: string;
  role?: PersonaRole;
  agentId?: string;
  status?: TraceStatus;
  level?: TraceLevel;
  startDate?: number;
  endDate?: number;
  limit?: number;
}

export interface TraceConfig {
  defaultLevel?: TraceLevel;
  maxTraces?: number;
  traceRetentionDays?: number;
  enableAutoRecording?: boolean;
  enablePerformanceTracking?: boolean;
  maxSpanDepth?: number;
}

// ============================================================================
// Storage Keys
// ============================================================================

const TRACE_STORAGE_KEY = 'pixelpal_explainability_traces';
const TRACE_CONFIG_KEY = 'pixelpal_explainability_trace_config';

// ============================================================================
// Config Management
// ============================================================================

const defaultConfig: Required<TraceConfig> = {
  defaultLevel: 'standard',
  maxTraces: 1000,
  traceRetentionDays: 30,
  enableAutoRecording: true,
  enablePerformanceTracking: true,
  maxSpanDepth: 10,
};

export function getTraceConfig(): Required<TraceConfig> {
  try {
    const stored = localStorage.getItem(TRACE_CONFIG_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return defaultConfig;
}

export function setTraceConfig(config: TraceConfig): void {
  const current = getTraceConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(TRACE_CONFIG_KEY, JSON.stringify(updated));
}

// ============================================================================
// Storage Functions
// ============================================================================

interface StoredTrace {
  id: string;
  traceId: string;
  name: string;
  description?: string;
  status: TraceStatus;
  level: TraceLevel;
  role: PersonaRole;
  agentId: string;
  sessionId?: string;
  taskId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  spans: [string, TraceSpan][];  // Map serialized as array
  rootSpanId?: string;
  metadata?: Record<string, unknown>;
  annotations: TraceAnnotation[];
  error?: TraceError;
  createdAt: number;
}

function loadTraces(): StoredTrace[] {
  try {
    const raw = localStorage.getItem(TRACE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveTraces(traces: StoredTrace[]): void {
  localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(traces));
}

// ============================================================================
// TraceService Implementation
// ============================================================================

class TraceServiceImpl {
  private traceCache: Map<string, Trace> = new Map();
  private activeTraces: Map<string, Trace> = new Map();
  private listeners: Set<(trace: Trace) => void> = new Set();
  private config: Required<TraceConfig>;

  constructor() {
    this.config = getTraceConfig();
    this.loadTraces();
  }

  private loadTraces(): void {
    const stored = loadTraces();
    for (const t of stored) {
      const trace: Trace = {
        ...t,
        spans: new Map(t.spans),
      };
      this.traceCache.set(trace.id, trace);
      if (trace.status === 'active' || trace.status === 'pending') {
        this.activeTraces.set(trace.id, trace);
      }
    }
  }

  private persistTraces(): void {
    const stored: StoredTrace[] = [];
    for (const trace of this.traceCache.values()) {
      stored.push({
        ...trace,
        spans: ArrayFromMap(trace.spans),
      });
    }
    // Keep only recent traces up to max limit
    if (stored.length > this.config.maxTraces) {
      stored.sort((a, b) => b.startTime - a.startTime);
      stored.splice(this.config.maxTraces);
    }
    saveTraces(stored);
  }

  private notifyListeners(trace: Trace): void {
    for (const listener of this.listeners) {
      try {
        listener(trace);
      } catch {
        // ignore listener errors
      }
    }
  }

  /**
   * Start a new trace
   */
  startTrace(params: {
    name: string;
    description?: string;
    traceId?: string;
    level?: TraceLevel;
    role: PersonaRole;
    agentId: string;
    sessionId?: string;
    taskId?: string;
    metadata?: Record<string, unknown>;
  }): Trace {
    const trace: Trace = {
      id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      traceId: params.traceId ?? `trace_${Date.now()}`,
      name: params.name,
      description: params.description,
      status: 'active',
      level: params.level ?? this.config.defaultLevel,
      role: params.role,
      agentId: params.agentId,
      sessionId: params.sessionId,
      taskId: params.taskId,
      startTime: Date.now(),
      spans: new Map(),
      annotations: [],
      metadata: params.metadata,
      createdAt: Date.now(),
    };

    this.traceCache.set(trace.id, trace);
    this.activeTraces.set(trace.id, trace);
    this.persistTraces();
    this.notifyListeners(trace);
    
    return trace;
  }

  /**
   * Start a span within a trace
   */
  startSpan(params: {
    traceId: string;
    name: string;
    parentSpanId?: string;
    level?: TraceLevel;
    metadata?: Record<string, unknown>;
  }): TraceSpan | undefined {
    const trace = this.traceCache.get(params.traceId);
    if (!trace) return undefined;

    const span: TraceSpan = {
      id: `span_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: params.name,
      startTime: Date.now(),
      level: params.level ?? trace.level,
      metadata: params.metadata,
      annotations: [],
      children: [],
      parentId: params.parentSpanId,
    };

    if (params.parentSpanId) {
      const parent = trace.spans.get(params.parentSpanId);
      if (parent) {
        parent.children = [...(parent.children ?? []), span.id];
      }
    } else if (!trace.rootSpanId) {
      trace.rootSpanId = span.id;
    }

    trace.spans.set(span.id, span);
    this.persistTraces();
    
    return span;
  }

  /**
   * End a span
   */
  endSpan(traceId: string, spanId: string, metadata?: Record<string, unknown>): void {
    const trace = this.traceCache.get(traceId);
    if (!trace) return;

    const span = trace.spans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata };
    }

    this.persistTraces();
  }

  /**
   * Add annotation to trace
   */
  annotate(traceId: string, annotation: Omit<TraceAnnotation, 'timestamp'>): void {
    const trace = this.traceCache.get(traceId);
    if (!trace) return;

    trace.annotations.push({
      ...annotation,
      timestamp: Date.now(),
    });

    this.persistTraces();
  }

  /**
   * Add annotation to span
   */
  annotateSpan(traceId: string, spanId: string, annotation: Omit<TraceAnnotation, 'timestamp'>): void {
    const trace = this.traceCache.get(traceId);
    if (!trace) return;

    const span = trace.spans.get(spanId);
    if (!span) return;

    span.annotations = [...(span.annotations ?? []), {
      ...annotation,
      timestamp: Date.now(),
    }];

    this.persistTraces();
  }

  /**
   * Complete a trace
   */
  completeTrace(traceId: string, metadata?: Record<string, unknown>): void {
    const trace = this.traceCache.get(traceId);
    if (!trace) return;

    trace.status = 'completed';
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    if (metadata) {
      trace.metadata = { ...trace.metadata, ...metadata };
    }

    this.activeTraces.delete(traceId);
    this.persistTraces();
    this.notifyListeners(trace);
  }

  /**
   * Fail a trace
   */
  failTrace(traceId: string, error: TraceError): void {
    const trace = this.traceCache.get(traceId);
    if (!trace) return;

    trace.status = 'failed';
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.error = error;

    this.activeTraces.delete(traceId);
    this.persistTraces();
    this.notifyListeners(trace);
  }

  /**
   * Cancel a trace
   */
  cancelTrace(traceId: string): void {
    const trace = this.traceCache.get(traceId);
    if (!trace) return;

    trace.status = 'cancelled';
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;

    this.activeTraces.delete(traceId);
    this.persistTraces();
    this.notifyListeners(trace);
  }

  /**
   * Get trace by ID
   */
  getTrace(id: string): Trace | undefined {
    return this.traceCache.get(id);
  }

  /**
   * Get trace by traceId (group ID)
   */
  getTraceByGroupId(traceId: string): Trace[] {
    const results: Trace[] = [];
    for (const trace of this.traceCache.values()) {
      if (trace.traceId === traceId) {
        results.push(trace);
      }
    }
    return results;
  }

  /**
   * Get all traces
   */
  getAllTraces(): Trace[] {
    return Array.from(this.traceCache.values());
  }

  /**
   * Get active traces
   */
  getActiveTraces(): Trace[] {
    return Array.from(this.activeTraces.values());
  }

  /**
   * Query traces
   */
  queryTraces(query: TraceQuery): Trace[] {
    let results = Array.from(this.traceCache.values());

    if (query.sessionId) {
      results = results.filter(t => t.sessionId === query.sessionId);
    }
    if (query.taskId) {
      results = results.filter(t => t.taskId === query.taskId);
    }
    if (query.role) {
      results = results.filter(t => t.role === query.role);
    }
    if (query.agentId) {
      results = results.filter(t => t.agentId === query.agentId);
    }
    if (query.status) {
      results = results.filter(t => t.status === query.status);
    }
    if (query.level) {
      results = results.filter(t => t.level === query.level);
    }
    if (query.startDate) {
      results = results.filter(t => t.startTime >= query.startDate);
    }
    if (query.endDate) {
      results = results.filter(t => t.startTime <= query.endDate);
    }

    // Sort by start time descending
    results.sort((a, b) => b.startTime - a.startTime);

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get recent traces
   */
  getRecentTraces(limit = 50): Trace[] {
    const sorted = [...this.traceCache.values()].sort((a, b) => b.startTime - a.startTime);
    return sorted.slice(0, limit);
  }

  /**
   * Get traces for session
   */
  getTracesForSession(sessionId: string): Trace[] {
    return this.queryTraces({ sessionId });
  }

  /**
   * Get traces for task
   */
  getTracesForTask(taskId: string): Trace[] {
    return this.queryTraces({ taskId });
  }

  /**
   * Get span by ID
   */
  getSpan(traceId: string, spanId: string): TraceSpan | undefined {
    const trace = this.traceCache.get(traceId);
    return trace?.spans.get(spanId);
  }

  /**
   * Get trace tree (nested structure)
   */
  getTraceTree(traceId: string): TraceTreeNode | undefined {
    const trace = this.traceCache.get(traceId);
    if (!trace || !trace.rootSpanId) return undefined;

    const buildNode = (spanId: string): TraceTreeNode => {
      const span = trace.spans.get(spanId);
      if (!span) throw new Error(`Span not found: ${spanId}`);
      
      return {
        span,
        children: (span.children ?? []).map(childId => buildNode(childId)),
      };
    };

    return buildNode(trace.rootSpanId);
  }

  /**
   * Get trace statistics
   */
  getStats(): {
    total: number;
    active: number;
    completed: number;
    failed: number;
    cancelled: number;
    byLevel: Record<TraceLevel, number>;
    averageDuration: number;
    totalAnnotations: number;
  } {
    const traces = Array.from(this.traceCache.values());
    
    const byLevel: Record<TraceLevel, number> = {
      minimal: 0,
      standard: 0,
      verbose: 0,
      debug: 0,
    };

    let totalDuration = 0;
    let durationCount = 0;
    let totalAnnotations = 0;

    for (const trace of traces) {
      byLevel[trace.level]++;
      if (trace.duration !== undefined) {
        totalDuration += trace.duration;
        durationCount++;
      }
      totalAnnotations += trace.annotations.length;
      for (const span of trace.spans.values()) {
        totalAnnotations += span.annotations?.length ?? 0;
      }
    }

    return {
      total: traces.length,
      active: traces.filter(t => t.status === 'active').length,
      completed: traces.filter(t => t.status === 'completed').length,
      failed: traces.filter(t => t.status === 'failed').length,
      cancelled: traces.filter(t => t.status === 'cancelled').length,
      byLevel,
      averageDuration: durationCount > 0 ? totalDuration / durationCount : 0,
      totalAnnotations,
    };
  }

  /**
   * Clear old traces
   */
  clearOldTraces(daysOld = 30): number {
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let removed = 0;

    for (const [id, trace] of this.traceCache.entries()) {
      if (trace.startTime < cutoff && trace.status !== 'active') {
        this.traceCache.delete(id);
        this.activeTraces.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      this.persistTraces();
    }

    return removed;
  }

  /**
   * Subscribe to trace updates
   */
  subscribe(listener: (trace: Trace) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all traces (admin use)
   */
  clearAllTraces(): void {
    this.traceCache.clear();
    this.activeTraces.clear();
    this.persistTraces();
  }
}

// Helper to convert Map to Array for JSON serialization
function ArrayFromMap<K, V>(map: Map<K, V>): [K, V][] {
  return Array.from(map.entries());
}

// Trace tree node type
export interface TraceTreeNode {
  span: TraceSpan;
  children: TraceTreeNode[];
}

// Singleton instance
export const traceService = new TraceServiceImpl();
