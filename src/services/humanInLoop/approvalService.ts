/**
 * Human-in-the-Loop Approval Service - P13
 * 
 * Handles approval workflows for critical AI decisions that require human confirmation.
 * Supports parallel and sequential approval chains.
 */

import type { PersonaRole } from '../collaboration/types';

// ============================================================================
// Types
// ============================================================================

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timeout' | 'cancelled';
export type ApprovalPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  taskId: string;
  title: string;
  description: string;
  proposedAction: string;
  responsibleRole: PersonaRole;
  requesterId: string;
  priority: ApprovalPriority;
  status: ApprovalStatus;
  createdAt: number;
  expiresAt?: number;
  decidedAt?: number;
  decidedBy?: string;
  decision?: 'approved' | 'rejected';
  reason?: string;
}

export interface ApprovalConfig {
  autoExpire?: boolean;
  defaultTimeoutMs?: number;
  requireReasonForRejection?: boolean;
  maxConcurrentApprovals?: number;
}

export interface ApprovalResult {
  requestId: string;
  decision: 'approved' | 'rejected';
  reason?: string;
  decidedBy?: string;
  decidedAt: number;
}

// ============================================================================
// Storage Keys
// ============================================================================

const APPROVAL_STORAGE_KEY = 'pixelpal_humaninloop_approvals';
const APPROVAL_CONFIG_KEY = 'pixelpal_humaninloop_approval_config';

// ============================================================================
// Config Management
// ============================================================================

const defaultConfig: Required<ApprovalConfig> = {
  autoExpire: true,
  defaultTimeoutMs: 30 * 60 * 1000, // 30 minutes
  requireReasonForRejection: true,
  maxConcurrentApprovals: 5,
};

export function getApprovalConfig(): Required<ApprovalConfig> {
  try {
    const stored = localStorage.getItem(APPROVAL_CONFIG_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return defaultConfig;
}

export function setApprovalConfig(config: ApprovalConfig): void {
  const current = getApprovalConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(APPROVAL_CONFIG_KEY, JSON.stringify(updated));
}

// ============================================================================
// Approval Storage
// ============================================================================

function loadApprovals(): ApprovalRequest[] {
  try {
    const raw = localStorage.getItem(APPROVAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveApprovals(approvals: ApprovalRequest[]): void {
  localStorage.setItem(APPROVAL_STORAGE_KEY, JSON.stringify(approvals));
}

// ============================================================================
// ApprovalService Implementation
// ============================================================================

class ApprovalServiceImpl {
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private approvalConfig: Required<ApprovalConfig>;
  private listeners: Set<(request: ApprovalRequest) => void> = new Set();
  private timeoutIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.approvalConfig = getApprovalConfig();
    this.loadPendingApprovals();
  }

  private loadPendingApprovals(): void {
    const approvals = loadApprovals();
    for (const approval of approvals) {
      if (approval.status === 'pending') {
        this.pendingApprovals.set(approval.id, approval);
        this.startExpirationTimer(approval);
      }
    }
  }

  /**
   * Create a new approval request
   */
  async requestApproval(params: {
    sessionId: string;
    taskId: string;
    title: string;
    description: string;
    proposedAction: string;
    responsibleRole: PersonaRole;
    requesterId: string;
    priority?: ApprovalPriority;
    timeoutMs?: number;
  }): Promise<ApprovalRequest> {
    const config = this.approvalConfig;
    
    // Check concurrent approval limit
    if (this.pendingApprovals.size >= config.maxConcurrentApprovals) {
      throw new Error(`Maximum concurrent approvals (${config.maxConcurrentApprovals}) reached`);
    }

    const request: ApprovalRequest = {
      id: `approval_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      sessionId: params.sessionId,
      taskId: params.taskId,
      title: params.title,
      description: params.description,
      proposedAction: params.proposedAction,
      responsibleRole: params.responsibleRole,
      requesterId: params.requesterId,
      priority: params.priority ?? 'normal',
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: params.timeoutMs
        ? Date.now() + params.timeoutMs
        : config.autoExpire
          ? Date.now() + config.defaultTimeoutMs
          : undefined,
    };

    this.pendingApprovals.set(request.id, request);
    this.saveApprovals();
    this.startExpirationTimer(request);
    this.notifyListeners(request);

    return request;
  }

  /**
   * Get a pending approval request by ID
   */
  getApproval(requestId: string): ApprovalRequest | undefined {
    return this.pendingApprovals.get(requestId);
  }

  /**
   * Get all pending approval requests
   */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).filter(a => a.status === 'pending');
  }

  /**
   * Get pending approvals for a specific role
   */
  getPendingApprovalsForRole(role: PersonaRole): ApprovalRequest[] {
    return this.getPendingApprovals().filter(a => a.responsibleRole === role);
  }

  /**
   * Get pending approvals for a specific session
   */
  getPendingApprovalsForSession(sessionId: string): ApprovalRequest[] {
    return this.getPendingApprovals().filter(a => a.sessionId === sessionId);
  }

  /**
   * Approve a request
   */
  async approve(requestId: string, approverId: string, reason?: string): Promise<ApprovalResult> {
    const request = this.pendingApprovals.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }
    if (request.status !== 'pending') {
      throw new Error(`Approval request is not pending: ${request.status}`);
    }

    request.status = 'approved';
    request.decision = 'approved';
    request.decidedBy = approverId;
    request.decidedAt = Date.now();
    request.reason = reason;

    this.pendingApprovals.delete(requestId);
    this.clearExpirationTimer(requestId);
    this.saveApprovals();
    this.notifyListeners(request);

    return {
      requestId,
      decision: 'approved',
      reason,
      decidedBy: approverId,
      decidedAt: request.decidedAt,
    };
  }

  /**
   * Reject a request
   */
  async reject(requestId: string, approverId: string, reason: string): Promise<ApprovalResult> {
    const request = this.pendingApprovals.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }
    if (request.status !== 'pending') {
      throw new Error(`Approval request is not pending: ${request.status}`);
    }

    const config = this.approvalConfig;
    if (config.requireReasonForRejection && !reason) {
      throw new Error('Reason is required for rejection');
    }

    request.status = 'rejected';
    request.decision = 'rejected';
    request.decidedBy = approverId;
    request.decidedAt = Date.now();
    request.reason = reason;

    this.pendingApprovals.delete(requestId);
    this.clearExpirationTimer(requestId);
    this.saveApprovals();
    this.notifyListeners(request);

    return {
      requestId,
      decision: 'rejected',
      reason,
      decidedBy: approverId,
      decidedAt: request.decidedAt,
    };
  }

  /**
   * Cancel a pending request (by requester)
   */
  async cancel(requestId: string, requesterId: string): Promise<void> {
    const request = this.pendingApprovals.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }
    if (request.requesterId !== requesterId) {
      throw new Error('Only the requester can cancel their own approval request');
    }
    if (request.status !== 'pending') {
      throw new Error(`Approval request is not pending: ${request.status}`);
    }

    request.status = 'cancelled';
    this.pendingApprovals.delete(requestId);
    this.clearExpirationTimer(requestId);
    this.saveApprovals();
    this.notifyListeners(request);
  }

  /**
   * Subscribe to approval request changes
   */
  subscribe(listener: (request: ApprovalRequest) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get pending approval count
   */
  getPendingCount(): number {
    return this.pendingApprovals.size;
  }

  /**
   * Get approval statistics
   */
  getStats(): {
    pending: number;
    approved: number;
    rejected: number;
    timeout: number;
  } {
    const all = loadApprovals();
    return {
      pending: all.filter(a => a.status === 'pending').length,
      approved: all.filter(a => a.status === 'approved').length,
      rejected: all.filter(a => a.status === 'rejected').length,
      timeout: all.filter(a => a.status === 'timeout').length,
    };
  }

  private startExpirationTimer(request: ApprovalRequest): void {
    if (!request.expiresAt) return;

    const timeout = request.expiresAt - Date.now();
    if (timeout <= 0) {
      this.handleExpiration(request.id);
      return;
    }

    const timer = setTimeout(() => {
      this.handleExpiration(request.id);
    }, timeout);

    this.timeoutIntervals.set(request.id, timer);
  }

  private clearExpirationTimer(requestId: string): void {
    const timer = this.timeoutIntervals.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutIntervals.delete(requestId);
    }
  }

  private async handleExpiration(requestId: string): Promise<void> {
    const request = this.pendingApprovals.get(requestId);
    if (!request || request.status !== 'pending') return;

    request.status = 'timeout';
    request.decidedAt = Date.now();
    this.pendingApprovals.delete(requestId);
    this.saveApprovals();
    this.notifyListeners(request);
  }

  private saveApprovals(): void {
    const all = [
      ...Array.from(this.pendingApprovals.values()),
      ...loadApprovals().filter(a => a.status !== 'pending'),
    ];
    saveApprovals(all);
  }

  private notifyListeners(request: ApprovalRequest): void {
    for (const listener of this.listeners) {
      try {
        listener(request);
      } catch {
        // ignore listener errors
      }
    }
  }
}

// Singleton instance
export const approvalService = new ApprovalServiceImpl();
