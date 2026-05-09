/**
 * Approval Delegation Service - P15
 * 
 * Manages approval delegation, substitution rules, and proxy approvals.
 * Allows authorized delegates to act on behalf of others.
 */

import type { PersonaRole } from '../collaboration/types';

// ============================================================================
// Types
// ============================================================================

export type DelegationStatus = 'active' | 'expired' | 'revoked' | 'completed';
export type ProxyStatus = 'active' | 'exhausted' | 'expired' | 'revoked';

export interface DelegationRule {
  id: string;
  delegatorId: string;
  delegateId: string;
  roles: PersonaRole[];           // Roles that can be delegated
  conditions?: {
    maxApprovals?: number;         // Max approvals per period
    timeWindow?: number;           // Time window in ms
    specificTasks?: string[];     // Only for specific task IDs
    excludeTasks?: string[];      // Exclude specific task IDs
  };
  validFrom: number;
  validUntil: number;
  status: DelegationStatus;
  createdAt: number;
  revokedAt?: number;
  revokedBy?: string;
  reason?: string;
}

export interface ProxyApproval {
  id: string;
  delegationId: string;
  originalApproverId: string;
  delegateId: string;
  requestId: string;
  action: 'approved' | 'rejected';
  reason?: string;
  performedAt: number;
  wasProxy: boolean;
}

export interface DelegationStats {
  totalDelegations: number;
  activeDelegations: number;
  totalProxyApprovals: number;
  byRole: Record<PersonaRole, number>;
  averageDelegationDuration: number;
}

export interface DelegationConfig {
  allowMultiDelegation?: boolean;        // Can delegate to multiple people
  allowChainDelegation?: boolean;         // Can delegate further
  maxDelegationDepth?: number;            // Max chain depth
  requireDelegationReason?: boolean;
  autoExpireDelegation?: boolean;
  defaultDelegationHours?: number;
}

// ============================================================================
// Storage Keys
// ============================================================================

const DELEGATION_STORAGE_KEY = 'pixelpal_approvalworkflow_delegations';
const PROXY_STORAGE_KEY = 'pixelpal_approvalworkflow_proxies';
const DELEGATION_CONFIG_KEY = 'pixelpal_approvalworkflow_delegation_config';

// ============================================================================
// Config Management
// ============================================================================

const defaultConfig: Required<DelegationConfig> = {
  allowMultiDelegation: false,
  allowChainDelegation: false,
  maxDelegationDepth: 3,
  requireDelegationReason: true,
  autoExpireDelegation: true,
  defaultDelegationHours: 24 * 7, // 1 week
};

export function getDelegationConfig(): Required<DelegationConfig> {
  try {
    const stored = localStorage.getItem(DELEGATION_CONFIG_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return defaultConfig;
}

export function setDelegationConfig(config: DelegationConfig): void {
  const current = getDelegationConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(DELEGATION_CONFIG_KEY, JSON.stringify(updated));
}

// ============================================================================
// Storage Functions
// ============================================================================

function loadDelegations(): DelegationRule[] {
  try {
    const raw = localStorage.getItem(DELEGATION_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveDelegations(delegations: DelegationRule[]): void {
  localStorage.setItem(DELEGATION_STORAGE_KEY, JSON.stringify(delegations));
}

function loadProxies(): ProxyApproval[] {
  try {
    const raw = localStorage.getItem(PROXY_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveProxies(proxies: ProxyApproval[]): void {
  localStorage.setItem(PROXY_STORAGE_KEY, JSON.stringify(proxies));
}

// ============================================================================
// DelegationService Implementation
// ============================================================================

class DelegationServiceImpl {
  private delegations: Map<string, DelegationRule> = new Map();
  private proxies: Map<string, ProxyApproval> = new Map();
  private config: Required<DelegationConfig>;
  private listeners: Set<(delegation: DelegationRule) => void> = new Set();
  private expirationIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.config = getDelegationConfig();
    this.loadDelegations();
    this.startExpirationChecker();
  }

  private loadDelegations(): void {
    const delegations = loadDelegations();
    const now = Date.now();

    for (const delegation of delegations) {
      if (delegation.status === 'active' && delegation.validUntil > now) {
        this.delegations.set(delegation.id, delegation);
        this.scheduleExpiration(delegation);
      }
    }

    const proxies = loadProxies();
    for (const proxy of proxies) {
      this.proxies.set(proxy.id, proxy);
    }
  }

  /**
   * Create a delegation rule
   */
  async createDelegation(params: {
    delegatorId: string;
    delegateId: string;
    roles: PersonaRole[];
    conditions?: DelegationRule['conditions'];
    validFrom?: number;
    validUntil?: number;
    reason?: string;
  }): Promise<DelegationRule> {
    const config = this.config;
    const now = Date.now();

    // Check if delegator already has active delegation (if multi-delegation disabled)
    if (!config.allowMultiDelegation) {
      const existing = this.getActiveDelegationsForDelegator(params.delegatorId);
      if (existing.length > 0) {
        throw new Error('Delegator already has an active delegation. Multi-delegation is disabled.');
      }
    }

    // Check for chain delegation depth if chain delegation disabled
    if (!config.allowChainDelegation && params.delegateId !== params.delegatorId) {
      const delegateChainLength = this.getDelegationChainLength(params.delegateId);
      if (delegateChainLength >= config.maxDelegationDepth) {
        throw new Error('Maximum delegation chain depth exceeded');
      }
    }

    const validFrom = params.validFrom ?? now;
    const validUntil = params.validUntil ?? (now + config.defaultDelegationHours * 60 * 60 * 1000);

    const delegation: DelegationRule = {
      id: `delg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      delegatorId: params.delegatorId,
      delegateId: params.delegateId,
      roles: params.roles,
      conditions: params.conditions,
      validFrom,
      validUntil,
      status: 'active',
      createdAt: now,
      reason: params.reason,
    };

    this.delegations.set(delegation.id, delegation);
    this.saveDelegations();
    this.scheduleExpiration(delegation);
    this.notifyListeners(delegation);

    return delegation;
  }

  /**
   * Revoke a delegation
   */
  async revokeDelegation(delegationId: string, revokedBy: string, reason?: string): Promise<void> {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) {
      throw new Error(`Delegation not found: ${delegationId}`);
    }
    if (delegation.status !== 'active') {
      throw new Error(`Delegation is not active: ${delegation.status}`);
    }
    if (delegation.delegatorId !== revokedBy) {
      throw new Error('Only the delegator can revoke their delegation');
    }

    delegation.status = 'revoked';
    delegation.revokedAt = Date.now();
    delegation.revokedBy = revokedBy;
    delegation.reason = reason ?? delegation.reason;

    this.clearExpiration(delegationId);
    this.saveDelegations();
    this.notifyListeners(delegation);
  }

  /**
   * Get active delegation for a delegator
   */
  getActiveDelegationsForDelegator(delegatorId: string): DelegationRule[] {
    const now = Date.now();
    return Array.from(this.delegations.values()).filter(
      d => d.delegatorId === delegatorId && d.status === 'active' && d.validUntil > now
    );
  }

  /**
   * Get all delegations where someone is a delegate
   */
  getActiveDelegationsForDelegate(delegateId: string): DelegationRule[] {
    const now = Date.now();
    return Array.from(this.delegations.values()).filter(
      d => d.delegateId === delegateId && d.status === 'active' && d.validUntil > now
    );
  }

  /**
   * Check if a delegate can act for a specific role
   */
  canDelegate(delegateId: string, role: PersonaRole, taskId?: string): DelegationRule | undefined {
    const now = Date.now();
    
    // Find active delegation that covers this role
    for (const delegation of this.delegations.values()) {
      if (
        delegation.delegateId === delegateId &&
        delegation.status === 'active' &&
        delegation.validFrom <= now &&
        delegation.validUntil > now &&
        delegation.roles.includes(role)
      ) {
        // Check conditions
        if (delegation.conditions) {
          // Check time window
          if (delegation.conditions.timeWindow) {
            const approvalsInWindow = this.getProxyApprovalsInWindow(
              delegation.id,
              delegation.conditions.timeWindow
            );
            if (
              delegation.conditions.maxApprovals &&
              approvalsInWindow.length >= delegation.conditions.maxApprovals
            ) {
              continue; // Condition not met
            }
          }

          // Check specific tasks
          if (delegation.conditions.specificTasks && taskId) {
            if (!delegation.conditions.specificTasks.includes(taskId)) {
              continue; // Task not in allowed list
            }
          }

          // Check excluded tasks
          if (delegation.conditions.excludeTasks && taskId) {
            if (delegation.conditions.excludeTasks.includes(taskId)) {
              continue; // Task is excluded
            }
          }
        }

        return delegation;
      }
    }

    return undefined;
  }

  /**
   * Record a proxy approval
   */
  async recordProxyApproval(params: {
    delegationId: string;
    originalApproverId: string;
    delegateId: string;
    requestId: string;
    action: 'approved' | 'rejected';
    reason?: string;
  }): Promise<ProxyApproval> {
    const proxy: ProxyApproval = {
      id: `proxy_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      delegationId: params.delegationId,
      originalApproverId: params.originalApproverId,
      delegateId: params.delegateId,
      requestId: params.requestId,
      action: params.action,
      reason: params.reason,
      performedAt: Date.now(),
      wasProxy: true,
    };

    this.proxies.set(proxy.id, proxy);
    this.saveProxies();
    return proxy;
  }

  /**
   * Get proxy approvals for a delegation
   */
  getProxyApprovals(delegationId: string): ProxyApproval[] {
    return Array.from(this.proxies.values()).filter(p => p.delegationId === delegationId);
  }

  /**
   * Get proxy approvals within a time window
   */
  getProxyApprovalsInWindow(delegationId: string, windowMs: number): ProxyApproval[] {
    const cutoff = Date.now() - windowMs;
    return Array.from(this.proxies.values()).filter(
      p => p.delegationId === delegationId && p.performedAt > cutoff
    );
  }

  /**
   * Get proxy approvals performed by a delegate
   */
  getProxyApprovalsByDelegate(delegateId: string): ProxyApproval[] {
    return Array.from(this.proxies.values()).filter(p => p.delegateId === delegateId);
  }

  /**
   * Get delegation by ID
   */
  getDelegation(delegationId: string): DelegationRule | undefined {
    return this.delegations.get(delegationId);
  }

  /**
   * Get all delegations
   */
  getAllDelegations(): DelegationRule[] {
    return Array.from(this.delegations.values());
  }

  /**
   * Get delegation statistics
   */
  getStats(): DelegationStats {
    const all = Array.from(this.delegations.values());
    const active = all.filter(d => d.status === 'active');
    const proxies = Array.from(this.proxies.values());

    const byRole: Record<PersonaRole, number> = {
      MemoryExpert: 0,
      EmotionAnalyst: 0,
      Advisor: 0,
      Researcher: 0,
      Coder: 0,
    };

    for (const delegation of active) {
      for (const role of delegation.roles) {
        byRole[role]++;
      }
    }

    const durations = active
      .filter(d => d.validUntil > Date.now())
      .map(d => d.validUntil - d.validFrom);

    return {
      totalDelegations: all.length,
      activeDelegations: active.length,
      totalProxyApprovals: proxies.length,
      byRole,
      averageDelegationDuration: durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0,
    };
  }

  /**
   * Subscribe to delegation changes
   */
  subscribe(listener: (delegation: DelegationRule) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private getDelegationChainLength(delegatorId: string): number {
    let depth = 0;
    let currentId = delegatorId;
    const visited = new Set<string>();

    while (depth < this.config.maxDelegationDepth) {
      const delegations = this.getActiveDelegationsForDelegator(currentId);
      if (delegations.length === 0) break;

      const delegation = delegations[0]; // Follow first delegation chain
      if (visited.has(delegation.delegateId)) break; // Avoid cycles

      visited.add(delegation.delegateId);
      currentId = delegation.delegateId;
      depth++;
    }

    return depth;
  }

  private scheduleExpiration(delegation: DelegationRule): void {
    const timeout = delegation.validUntil - Date.now();
    if (timeout <= 0) {
      this.handleExpiration(delegation.id);
      return;
    }

    const timer = setTimeout(() => {
      this.handleExpiration(delegation.id);
    }, timeout);

    this.expirationIntervals.set(delegation.id, timer);
  }

  private clearExpiration(delegationId: string): void {
    const timer = this.expirationIntervals.get(delegationId);
    if (timer) {
      clearTimeout(timer);
      this.expirationIntervals.delete(delegationId);
    }
  }

  private handleExpiration(delegationId: string): void {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) return;

    delegation.status = 'expired';
    this.saveDelegations();
    this.notifyListeners(delegation);
  }

  private startExpirationChecker(): void {
    // Check every minute for delegations that need to be expired
    setInterval(() => {
      const now = Date.now();
      for (const [id, delegation] of this.delegations.entries()) {
        if (delegation.status === 'active' && delegation.validUntil <= now) {
          this.handleExpiration(id);
        }
      }
    }, 60000);
  }

  private saveDelegations(): void {
    const all = Array.from(this.delegations.values());
    const stored = loadDelegations();
    
    // Merge with stored delegations
    const merged = [...all];
    for (const s of stored) {
      if (!merged.find(d => d.id === s.id)) {
        merged.push(s);
      }
    }
    
    saveDelegations(merged);
  }

  private saveProxies(): void {
    const all = Array.from(this.proxies.values());
    const stored = loadProxies();
    
    const merged = [...all];
    for (const s of stored) {
      if (!merged.find(p => p.id === s.id)) {
        merged.push(s);
      }
    }
    
    saveProxies(merged);
  }

  private notifyListeners(delegation: DelegationRule): void {
    for (const listener of this.listeners) {
      try {
        listener(delegation);
      } catch {
        // ignore listener errors
      }
    }
  }
}

// Singleton instance
export const delegationService = new DelegationServiceImpl();
