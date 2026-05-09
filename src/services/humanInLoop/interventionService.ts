/**
 * Intervention Service - P13
 * 
 * Manages human interventions during AI agent execution.
 * Handles correction, guidance, and override actions from humans.
 */

import type { PersonaRole } from '../collaboration/types';

// ============================================================================
// Types
// ============================================================================

export type InterventionType = 
  | 'correction'      // Human corrects AI behavior
  | 'guidance'         // Human provides guidance for next step
  | 'override'         // Human overrides AI decision
  | 'escalation'       // Escalate to human expert
  | 'pause'            // Pause agent execution
  | 'resume'           // Resume paused execution
  | 'abort';           // Abort the current operation

export type InterventionStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'expired';

export interface InterventionContext {
  sessionId: string;
  taskId: string;
  subtaskId?: string;
  currentState: string;
  proposedAction?: string;
  reasoning?: string;
  confidence?: number;
}

export interface Intervention {
  id: string;
  type: InterventionType;
  sessionId: string;
  taskId: string;
  subtaskId?: string;
  requestingRole: PersonaRole;
  intervenorId?: string;
  title: string;
  description: string;
  context: InterventionContext;
  status: InterventionStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: number;
  activatedAt?: number;
  completedAt?: number;
  result?: InterventionResult;
}

export interface InterventionResult {
  action: string;
  description: string;
  modifiedOutput?: unknown;
  followUpRequired?: boolean;
  followUpId?: string;
}

export interface InterventionConfig {
  allowPause?: boolean;
  allowOverride?: boolean;
  allowAbort?: boolean;
  maxActiveInterventions?: number;
  autoExpireMs?: number;
}

// ============================================================================
// Storage Keys
// ============================================================================

const INTERVENTION_STORAGE_KEY = 'pixelpal_humaninloop_interventions';
const INTERVENTION_CONFIG_KEY = 'pixelpal_humaninloop_intervention_config';

// ============================================================================
// Config Management
// ============================================================================

const defaultConfig: Required<InterventionConfig> = {
  allowPause: true,
  allowOverride: true,
  allowAbort: true,
  maxActiveInterventions: 3,
  autoExpireMs: 60 * 60 * 1000, // 1 hour
};

export function getInterventionConfig(): Required<InterventionConfig> {
  try {
    const stored = localStorage.getItem(INTERVENTION_CONFIG_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return defaultConfig;
}

export function setInterventionConfig(config: InterventionConfig): void {
  const current = getInterventionConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(INTERVENTION_CONFIG_KEY, JSON.stringify(updated));
}

// ============================================================================
// Storage Functions
// ============================================================================

function loadInterventions(): Intervention[] {
  try {
    const raw = localStorage.getItem(INTERVENTION_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveInterventions(interventions: Intervention[]): void {
  localStorage.setItem(INTERVENTION_STORAGE_KEY, JSON.stringify(interventions));
}

// ============================================================================
// InterventionService Implementation
// ============================================================================

class InterventionServiceImpl {
  private activeInterventions: Map<string, Intervention> = new Map();
  private listeners: Set<(intervention: Intervention) => void> = new Set();
  private config: Required<InterventionConfig>;
  private pausedSessions: Set<string> = new Set();

  constructor() {
    this.config = getInterventionConfig();
    this.loadActiveInterventions();
  }

  private loadActiveInterventions(): void {
    const interventions = loadInterventions();
    for (const intervention of interventions) {
      if (intervention.status === 'active' || intervention.status === 'pending') {
        this.activeInterventions.set(intervention.id, intervention);
      }
    }
  }

  /**
   * Request an intervention
   */
  async requestIntervention(params: {
    type: InterventionType;
    sessionId: string;
    taskId: string;
    subtaskId?: string;
    requestingRole: PersonaRole;
    title: string;
    description: string;
    context: InterventionContext;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }): Promise<Intervention> {
    if (this.activeInterventions.size >= this.config.maxActiveInterventions) {
      throw new Error(`Maximum active interventions (${this.config.maxActiveInterventions}) reached`);
    }

    const intervention: Intervention = {
      id: `intervention_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: params.type,
      sessionId: params.sessionId,
      taskId: params.taskId,
      subtaskId: params.subtaskId,
      requestingRole: params.requestingRole,
      title: params.title,
      description: params.description,
      context: params.context,
      status: 'pending',
      priority: params.priority ?? 'normal',
      createdAt: Date.now(),
    };

    this.activeInterventions.set(intervention.id, intervention);
    this.saveInterventions();
    this.notifyListeners(intervention);

    return intervention;
  }

  /**
   * Activate an intervention (human takes action)
   */
  async activate(interventionId: string, intervenorId: string): Promise<Intervention> {
    const intervention = this.activeInterventions.get(interventionId);
    if (!intervention) {
      throw new Error(`Intervention not found: ${interventionId}`);
    }
    if (intervention.status !== 'pending') {
      throw new Error(`Intervention is not pending: ${intervention.status}`);
    }

    intervention.status = 'active';
    intervention.activatedAt = Date.now();
    intervention.intervenorId = intervenorId;

    this.saveInterventions();
    this.notifyListeners(intervention);

    return intervention;
  }

  /**
   * Complete an intervention with result
   */
  async complete(
    interventionId: string,
    result: InterventionResult
  ): Promise<Intervention> {
    const intervention = this.activeInterventions.get(interventionId);
    if (!intervention) {
      throw new Error(`Intervention not found: ${interventionId}`);
    }
    if (intervention.status !== 'active') {
      throw new Error(`Intervention is not active: ${intervention.status}`);
    }

    intervention.status = 'completed';
    intervention.completedAt = Date.now();
    intervention.result = result;

    this.activeInterventions.delete(interventionId);
    this.saveInterventions();
    this.notifyListeners(intervention);

    return intervention;
  }

  /**
   * Cancel an intervention
   */
  async cancel(interventionId: string, reason?: string): Promise<void> {
    const intervention = this.activeInterventions.get(interventionId);
    if (!intervention) {
      throw new Error(`Intervention not found: ${interventionId}`);
    }

    intervention.status = 'cancelled';
    intervention.completedAt = Date.now();
    if (reason) {
      intervention.description += `\n[Cancelled: ${reason}]`;
    }

    this.activeInterventions.delete(interventionId);
    this.saveInterventions();
    this.notifyListeners(intervention);
  }

  /**
   * Get an intervention by ID
   */
  getIntervention(id: string): Intervention | undefined {
    return this.activeInterventions.get(id);
  }

  /**
   * Get all active interventions
   */
  getActiveInterventions(): Intervention[] {
    return Array.from(this.activeInterventions.values())
      .filter(i => i.status === 'active' || i.status === 'pending');
  }

  /**
   * Get interventions for a session
   */
  getInterventionsForSession(sessionId: string): Intervention[] {
    return this.getActiveInterventions().filter(i => i.sessionId === sessionId);
  }

  /**
   * Get interventions for a task
   */
  getInterventionsForTask(taskId: string): Intervention[] {
    return this.getActiveInterventions().filter(i => i.taskId === taskId);
  }

  /**
   * Check if a session is paused
   */
  isSessionPaused(sessionId: string): boolean {
    return this.pausedSessions.has(sessionId);
  }

  /**
   * Pause a session
   */
  pauseSession(sessionId: string): void {
    if (!this.config.allowPause) {
      throw new Error('Pause is not allowed by configuration');
    }
    this.pausedSessions.add(sessionId);
  }

  /**
   * Resume a paused session
   */
  resumeSession(sessionId: string): void {
    this.pausedSessions.delete(sessionId);
  }

  /**
   * Subscribe to intervention changes
   */
  subscribe(listener: (intervention: Intervention) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get intervention statistics
   */
  getStats(): {
    active: number;
    pending: number;
    completed: number;
    cancelled: number;
    pausedSessions: number;
  } {
    const all = loadInterventions();
    const pausedCount = this.pausedSessions.size;

    return {
      active: all.filter(i => i.status === 'active').length,
      pending: all.filter(i => i.status === 'pending').length,
      completed: all.filter(i => i.status === 'completed').length,
      cancelled: all.filter(i => i.status === 'cancelled').length,
      pausedSessions: pausedCount,
    };
  }

  /**
   * Create correction intervention
   */
  async correct(params: {
    sessionId: string;
    taskId: string;
    subtaskId?: string;
    requestingRole: PersonaRole;
    title: string;
    description: string;
    context: InterventionContext;
    correctedOutput: unknown;
  }): Promise<Intervention> {
    return this.requestIntervention({
      type: 'correction',
      ...params,
    });
  }

  /**
   * Create guidance intervention
   */
  async guide(params: {
    sessionId: string;
    taskId: string;
    subtaskId?: string;
    requestingRole: PersonaRole;
    title: string;
    description: string;
    context: InterventionContext;
    guidance: string;
  }): Promise<Intervention> {
    return this.requestIntervention({
      type: 'guidance',
      ...params,
    });
  }

  /**
   * Create escalation intervention
   */
  async escalate(params: {
    sessionId: string;
    taskId: string;
    subtaskId?: string;
    requestingRole: PersonaRole;
    title: string;
    description: string;
    context: InterventionContext;
    reason: string;
  }): Promise<Intervention> {
    return this.requestIntervention({
      type: 'escalation',
      priority: 'high',
      ...params,
    });
  }

  private saveInterventions(): void {
    const all = [
      ...Array.from(this.activeInterventions.values()),
      ...loadInterventions().filter(
        i => i.status !== 'active' && i.status !== 'pending'
      ),
    ];
    saveInterventions(all);
  }

  private notifyListeners(intervention: Intervention): void {
    for (const listener of this.listeners) {
      try {
        listener(intervention);
      } catch {
        // ignore listener errors
      }
    }
  }
}

// Singleton instance
export const interventionService = new InterventionServiceImpl();
