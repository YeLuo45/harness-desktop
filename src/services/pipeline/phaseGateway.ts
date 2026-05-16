/**
 * Phase Gateway Service
 * 
 * Phase-gated pipeline for multi-agent workflow orchestration.
 * Each phase (planning→development→review→execution→deployment) has
 * configurable approval gates with unattended mode auto-approval.
 */

export type Phase = 'planning' | 'development' | 'review' | 'execution' | 'deployment'

export interface PhaseConfig {
  phase: Phase
  name: string
  description: string
  requiredRoles: string[]        // Roles that must complete this phase
  exitCondition?: (ctx: PipelineContext) => boolean  // Auto-continue if true
  manualApprovalRequired: boolean
  timeout?: number              // ms before auto-fail
}

export interface PipelineContext {
  taskId: string
  currentPhase: Phase
  phaseHistory: PhaseHistory[]
  metadata: Record<string, unknown>
}

export interface PhaseHistory {
  phase: Phase
  enteredAt: number
  exitedAt?: number
  outcome: 'approved' | 'rejected' | 'timeout' | 'skipped' | 'pending'
  approver?: string
  notes?: string
}

export class PhaseGateway {
  private phases: PhaseConfig[]
  
  constructor() {
    this.phases = this.buildPhases()
  }
  
  private buildPhases(): PhaseConfig[] {
    return [
      {
        phase: 'planning',
        name: 'Planning',
        description: 'Planner creates task breakdown',
        requiredRoles: ['planner'],
        manualApprovalRequired: false,  // Auto-approve in unattended mode
        timeout: 60000,
      },
      {
        phase: 'development',
        name: 'Development', 
        description: 'Coder implements solution',
        requiredRoles: ['coder'],
        manualApprovalRequired: false,
        timeout: 300000,
      },
      {
        phase: 'review',
        name: 'Review',
        description: 'Reviewer validates output',
        requiredRoles: ['reviewer'],
        manualApprovalRequired: false,
        timeout: 120000,
      },
      {
        phase: 'execution',
        name: 'Execution',
        description: 'Executor runs verification',
        requiredRoles: ['executor'],
        manualApprovalRequired: false,
        timeout: 120000,
      },
      {
        phase: 'deployment',
        name: 'Deployment',
        description: 'Deploy to target environment',
        requiredRoles: ['executor'],
        manualApprovalRequired: false,
        timeout: 60000,
      },
    ]
  }
  
  /**
   * Check if current phase is complete and can advance
   */
  canAdvance(ctx: PipelineContext): boolean {
    const currentPhase = this.phases.find(p => p.phase === ctx.currentPhase)
    if (!currentPhase) return false
    
    // In unattended mode, always auto-approve if no manual approval required
    if (!currentPhase.manualApprovalRequired) {
      return true
    }
    
    // Check exit condition if defined
    if (currentPhase.exitCondition) {
      return currentPhase.exitCondition(ctx)
    }
    
    return false
  }
  
  /**
   * Get next phase
   */
  getNextPhase(ctx: PipelineContext): Phase | null {
    const currentIndex = this.phases.findIndex(p => p.phase === ctx.currentPhase)
    if (currentIndex === -1 || currentIndex >= this.phases.length - 1) {
      return null
    }
    return this.phases[currentIndex + 1].phase
  }
  
  /**
   * Advance to next phase
   */
  advancePhase(ctx: PipelineContext): Phase | null {
    if (!this.canAdvance(ctx)) return null
    
    const now = Date.now()
    const currentPhaseEntry = ctx.phaseHistory.find(p => p.phase === ctx.currentPhase && !p.exitedAt)
    if (currentPhaseEntry) {
      currentPhaseEntry.exitedAt = now
      currentPhaseEntry.outcome = 'approved'
    }
    
    const nextPhase = this.getNextPhase(ctx)
    if (nextPhase) {
      ctx.currentPhase = nextPhase
      ctx.phaseHistory.push({
        phase: nextPhase,
        enteredAt: now,
        outcome: 'pending'
      })
    }
    
    return nextPhase
  }
  
  getPhaseConfig(phase: Phase): PhaseConfig | undefined {
    return this.phases.find(p => p.phase === phase)
  }
  
  /**
   * Get all phases
   */
  getPhases(): PhaseConfig[] {
    return [...this.phases]
  }
}