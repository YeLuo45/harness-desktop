/**
 * Pipeline Orchestrator Service
 * 
 * Orchestrates phase-gated pipelines for multi-agent workflows.
 * Publishes phase change events via message bus.
 */

import { PhaseGateway, type Phase, type PipelineContext, type PhaseHistory } from './phaseGateway'
import { getMessageBus, type AgentMessage } from '../messageBus'

export interface PipelineOptions {
  unattended?: boolean  // If true, auto-approve all gates
}

export class PipelineOrchestrator {
  private gateway: PhaseGateway
  private contexts: Map<string, PipelineContext> = new Map()
  private unattended: boolean
  private messageBus = getMessageBus()
  
  constructor(options: PipelineOptions = {}) {
    this.gateway = new PhaseGateway()
    this.unattended = options.unattended ?? true  // Default to unattended
  }
  
  /**
   * Start a new pipeline for a task
   */
  startPipeline(taskId: string): PipelineContext {
    const ctx: PipelineContext = {
      taskId,
      currentPhase: 'planning',
      phaseHistory: [{
        phase: 'planning',
        enteredAt: Date.now(),
        outcome: 'pending'
      }],
      metadata: {}
    }
    this.contexts.set(taskId, ctx)
    return ctx
  }
  
  /**
   * Check if pipeline can advance
   */
  canAdvance(taskId: string): boolean {
    const ctx = this.contexts.get(taskId)
    if (!ctx) return false
    
    if (this.unattended) {
      // In unattended mode, auto-advance after completion signal
      return true
    }
    
    return this.gateway.canAdvance(ctx)
  }
  
  /**
   * Advance pipeline to next phase
   */
  advance(taskId: string): Phase | null {
    const ctx = this.contexts.get(taskId)
    if (!ctx) return null
    
    const previousPhase = ctx.currentPhase
    const nextPhase = this.gateway.advancePhase(ctx)
    
    if (nextPhase) {
      // Publish phase change to messageBus
      const msg: AgentMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'phase_change',
        fromRole: 'pipeline',
        toRole: 'all',
        payload: {
          taskId,
          previousPhase,
          currentPhase: nextPhase,
          phaseHistory: ctx.phaseHistory
        },
        priority: 'high',
        deliveryMode: 'reliable',
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 0,
        status: 'pending'
      }
      this.messageBus.publish('all', 'phase_change', msg)
    }
    
    return nextPhase
  }
  
  /**
   * Get pipeline status
   */
  getStatus(taskId: string): PipelineContext | null {
    return this.contexts.get(taskId) || null
  }
  
  /**
   * Complete the pipeline
   */
  complete(taskId: string): PhaseHistory[] | null {
    const ctx = this.contexts.get(taskId)
    if (!ctx) return null
    
    const history = ctx.phaseHistory
    this.contexts.delete(taskId)
    return history
  }
  
  /**
   * Get phase configuration
   */
  getPhaseConfig(phase: Phase) {
    return this.gateway.getPhaseConfig(phase)
  }
  
  /**
   * Check if task is in specific phase
   */
  isInPhase(taskId: string, phase: Phase): boolean {
    const ctx = this.contexts.get(taskId)
    return ctx?.currentPhase === phase
  }
}