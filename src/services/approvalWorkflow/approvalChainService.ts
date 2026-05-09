/**
 * Approval Chain Service - P15
 * 
 * Manages sequential and parallel approval chains for complex workflows.
 * Supports multi-stage approvals with conditional routing and escalation.
 */

import type { PersonaRole } from '../collaboration/types';

// ============================================================================
// Types
// ============================================================================

export type ChainStatus = 'active' | 'completed' | 'failed' | 'cancelled' | 'escalated';
export type ChainType = 'sequential' | 'parallel' | 'conditional' | 'escalation';
export type NodeStatus = 'pending' | 'approved' | 'rejected' | 'skipped' | 'timeout';

export interface ApprovalNode {
  id: string;
  step: number;
  role: PersonaRole;
  approverId?: string;
  status: NodeStatus;
  requestedAt?: number;
  decidedAt?: number;
  decidedBy?: string;
  reason?: string;
  isRequired: boolean;
}

export interface ApprovalChain {
  id: string;
  chainType: ChainType;
  name: string;
  description: string;
  status: ChainStatus;
  nodes: ApprovalNode[];
  currentStep: number;
  requesterId: string;
  sessionId: string;
  taskId: string;
  createdAt: number;
  completedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface ChainConfig {
  allowParallelApproval?: boolean;
  continueOnSkip?: boolean;
  autoStartNextStep?: boolean;
  maxSteps?: number;
  timeoutPerStep?: number;
}

export interface ChainResult {
  chainId: string;
  status: ChainStatus;
  totalSteps: number;
  completedSteps: number;
  approvedSteps: number;
  rejectedSteps: number;
  skippedSteps: number;
  duration: number;
  finalDecisions: Map<string, NodeStatus>;
}

// ============================================================================
// Storage Keys
// ============================================================================

const CHAIN_STORAGE_KEY = 'pixelpal_approvalworkflow_chains';
const CHAIN_CONFIG_KEY = 'pixelpal_approvalworkflow_chain_config';

// ============================================================================
// Config Management
// ============================================================================

const defaultConfig: Required<ChainConfig> = {
  allowParallelApproval: false,
  continueOnSkip: true,
  autoStartNextStep: true,
  maxSteps: 10,
  timeoutPerStep: 30 * 60 * 1000, // 30 minutes
};

export function getChainConfig(): Required<ChainConfig> {
  try {
    const stored = localStorage.getItem(CHAIN_CONFIG_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return defaultConfig;
}

export function setChainConfig(config: ChainConfig): void {
  const current = getChainConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(CHAIN_CONFIG_KEY, JSON.stringify(updated));
}

// ============================================================================
// Storage Functions
// ============================================================================

function loadChains(): ApprovalChain[] {
  try {
    const raw = localStorage.getItem(CHAIN_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveChains(chains: ApprovalChain[]): void {
  localStorage.setItem(CHAIN_STORAGE_KEY, JSON.stringify(chains));
}

// ============================================================================
// ApprovalChainService Implementation
// ============================================================================

class ApprovalChainServiceImpl {
  private activeChains: Map<string, ApprovalChain> = new Map();
  private chainConfig: Required<ChainConfig>;
  private listeners: Set<(chain: ApprovalChain) => void> = new Set();
  private timeoutIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.chainConfig = getChainConfig();
    this.loadActiveChains();
  }

  private loadActiveChains(): void {
    const chains = loadChains();
    for (const chain of chains) {
      if (chain.status === 'active') {
        this.activeChains.set(chain.id, chain);
        this.startExpirationTimers(chain);
      }
    }
  }

  /**
   * Create a new approval chain
   */
  async createChain(params: {
    chainType: ChainType;
    name: string;
    description: string;
    nodes: Array<{
      role: PersonaRole;
      approverId?: string;
      isRequired?: boolean;
    }>;
    requesterId: string;
    sessionId: string;
    taskId: string;
    metadata?: Record<string, unknown>;
  }): Promise<ApprovalChain> {
    const config = this.chainConfig;

    if (params.nodes.length > config.maxSteps) {
      throw new Error(`Maximum chain steps (${config.maxSteps}) exceeded`);
    }

    const chain: ApprovalChain = {
      id: `chain_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      chainType: params.chainType,
      name: params.name,
      description: params.description,
      status: 'active',
      nodes: params.nodes.map((node, index) => ({
        id: `node_${index}`,
        step: index,
        role: node.role,
        approverId: node.approverId,
        status: index === 0 ? 'pending' : 'pending',
        isRequired: node.isRequired ?? true,
      })),
      currentStep: 0,
      requesterId: params.requesterId,
      sessionId: params.sessionId,
      taskId: params.taskId,
      createdAt: Date.now(),
      metadata: params.metadata,
    };

    this.activeChains.set(chain.id, chain);
    this.saveChains();
    this.startExpirationTimers(chain);
    this.notifyListeners(chain);

    return chain;
  }

  /**
   * Get chain by ID
   */
  getChain(chainId: string): ApprovalChain | undefined {
    return this.activeChains.get(chainId);
  }

  /**
   * Get all active chains
   */
  getActiveChains(): ApprovalChain[] {
    return Array.from(this.activeChains.values()).filter(c => c.status === 'active');
  }

  /**
   * Get chains for a session
   */
  getChainsForSession(sessionId: string): ApprovalChain[] {
    return this.getActiveChains().filter(c => c.sessionId === sessionId);
  }

  /**
   * Get chains for a task
   */
  getChainsForTask(taskId: string): ApprovalChain[] {
    return this.getActiveChains().filter(c => c.taskId === taskId);
  }

  /**
   * Get pending approvals for a specific role
   */
  getPendingForRole(role: PersonaRole): Array<{ chain: ApprovalChain; node: ApprovalNode }> {
    const results: Array<{ chain: ApprovalChain; node: ApprovalNode }> = [];

    for (const chain of this.getActiveChains()) {
      // For sequential chains, only check current step
      if (chain.chainType === 'sequential') {
        const currentNode = chain.nodes[chain.currentStep];
        if (currentNode && currentNode.role === role && currentNode.status === 'pending') {
          results.push({ chain, node: currentNode });
        }
      } else {
        // For parallel/conditional chains, check all pending nodes
        for (const node of chain.nodes) {
          if (node.role === role && node.status === 'pending') {
            results.push({ chain, node });
          }
        }
      }
    }

    return results;
  }

  /**
   * Approve a node in the chain
   */
  async approveNode(
    chainId: string,
    nodeId: string,
    approverId: string,
    reason?: string
  ): Promise<ApprovalChain> {
    const chain = this.activeChains.get(chainId);
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`);
    }
    if (chain.status !== 'active') {
      throw new Error(`Chain is not active: ${chain.status}`);
    }

    const node = chain.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    if (node.status !== 'pending') {
      throw new Error(`Node is not pending: ${node.status}`);
    }

    node.status = 'approved';
    node.decidedAt = Date.now();
    node.decidedBy = approverId;
    node.reason = reason;

    this.clearNodeTimer(chainId, nodeId);

    // Move to next step if sequential
    if (chain.chainType === 'sequential') {
      chain.currentStep = this.findNextRequiredStep(chain, node.step + 1);
      
      if (chain.currentStep >= chain.nodes.length) {
        chain.status = 'completed';
        chain.completedAt = Date.now();
        this.clearAllTimers(chainId);
      }
    } else {
      // Check if all required nodes are complete for parallel chains
      const allRequiredComplete = chain.nodes
        .filter(n => n.isRequired)
        .every(n => n.status !== 'pending');
      
      if (allRequiredComplete) {
        const anyRejected = chain.nodes.some(n => n.status === 'rejected');
        chain.status = anyRejected ? 'failed' : 'completed';
        chain.completedAt = Date.now();
        this.clearAllTimers(chainId);
      }
    }

    this.saveChains();
    this.notifyListeners(chain);

    return chain;
  }

  /**
   * Reject a node in the chain
   */
  async rejectNode(
    chainId: string,
    nodeId: string,
    approverId: string,
    reason: string
  ): Promise<ApprovalChain> {
    const chain = this.activeChains.get(chainId);
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`);
    }
    if (chain.status !== 'active') {
      throw new Error(`Chain is not active: ${chain.status}`);
    }

    const node = chain.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    if (node.status !== 'pending') {
      throw new Error(`Node is not pending: ${node.status}`);
    }

    node.status = 'rejected';
    node.decidedAt = Date.now();
    node.decidedBy = approverId;
    node.reason = reason;

    this.clearNodeTimer(chainId, nodeId);

    // For sequential chains, fail the entire chain on rejection
    if (chain.chainType === 'sequential') {
      chain.status = 'failed';
      chain.completedAt = Date.now();
      this.clearAllTimers(chainId);
    } else {
      // For parallel chains, check if we should fail
      const allRequiredProcessed = chain.nodes
        .filter(n => n.isRequired)
        .every(n => n.status !== 'pending');
      
      if (allRequiredProcessed) {
        chain.status = 'failed';
        chain.completedAt = Date.now();
        this.clearAllTimers(chainId);
      }
    }

    this.saveChains();
    this.notifyListeners(chain);

    return chain;
  }

  /**
   * Skip a node (for optional nodes)
   */
  async skipNode(
    chainId: string,
    nodeId: string,
    skippedBy: string,
    reason?: string
  ): Promise<ApprovalChain> {
    const chain = this.activeChains.get(chainId);
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`);
    }
    if (chain.status !== 'active') {
      throw new Error(`Chain is not active: ${chain.status}`);
    }

    const node = chain.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    if (node.status !== 'pending') {
      throw new Error(`Node is not pending: ${node.status}`);
    }
    if (node.isRequired) {
      throw new Error('Cannot skip required nodes');
    }

    node.status = 'skipped';
    node.decidedAt = Date.now();
    node.decidedBy = skippedBy;
    node.reason = reason;

    this.clearNodeTimer(chainId, nodeId);

    if (chain.chainType === 'sequential') {
      chain.currentStep = this.findNextRequiredStep(chain, node.step + 1);
      
      if (chain.currentStep >= chain.nodes.length) {
        chain.status = 'completed';
        chain.completedAt = Date.now();
        this.clearAllTimers(chainId);
      }
    }

    this.saveChains();
    this.notifyListeners(chain);

    return chain;
  }

  /**
   * Escalate the chain to a higher authority
   */
  async escalateChain(
    chainId: string,
    reason: string,
    escalationRole?: PersonaRole
  ): Promise<ApprovalChain> {
    const chain = this.activeChains.get(chainId);
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`);
    }
    if (chain.status !== 'active') {
      throw new Error(`Chain is not active: ${chain.status}`);
    }

    chain.status = 'escalated';
    chain.completedAt = Date.now();
    this.clearAllTimers(chainId);
    this.saveChains();
    this.notifyListeners(chain);

    return chain;
  }

  /**
   * Cancel the chain
   */
  async cancelChain(chainId: string, cancelledBy: string, reason?: string): Promise<void> {
    const chain = this.activeChains.get(chainId);
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`);
    }
    if (chain.status !== 'active') {
      throw new Error(`Chain is not active: ${chain.status}`);
    }

    chain.status = 'cancelled';
    chain.completedAt = Date.now();
    this.clearAllTimers(chainId);
    this.saveChains();
    this.notifyListeners(chain);
  }

  /**
   * Get chain result
   */
  getChainResult(chainId: string): ChainResult | undefined {
    const chain = this.activeChains.get(chainId) ?? loadChains().find(c => c.id === chainId);
    if (!chain) return undefined;

    return {
      chainId: chain.id,
      status: chain.status,
      totalSteps: chain.nodes.length,
      completedSteps: chain.nodes.filter(n => n.decidedAt).length,
      approvedSteps: chain.nodes.filter(n => n.status === 'approved').length,
      rejectedSteps: chain.nodes.filter(n => n.status === 'rejected').length,
      skippedSteps: chain.nodes.filter(n => n.status === 'skipped').length,
      duration: (chain.completedAt ?? Date.now()) - chain.createdAt,
      finalDecisions: new Map(
        chain.nodes
          .filter(n => n.status === 'approved' || n.status === 'rejected' || n.status === 'skipped')
          .map(n => [n.id, n.status])
      ),
    };
  }

  /**
   * Subscribe to chain updates
   */
  subscribe(listener: (chain: ApprovalChain) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get chain statistics
   */
  getStats(): {
    active: number;
    completed: number;
    failed: number;
    cancelled: number;
    escalated: number;
    averageDuration: number;
  } {
    const all = loadChains();
    const completed = all.filter(c => c.status === 'completed');
    const completedWithDuration = completed.filter(c => c.completedAt);

    return {
      active: all.filter(c => c.status === 'active').length,
      completed: completed.length,
      failed: all.filter(c => c.status === 'failed').length,
      cancelled: all.filter(c => c.status === 'cancelled').length,
      escalated: all.filter(c => c.status === 'escalated').length,
      averageDuration: completedWithDuration.length > 0
        ? completedWithDuration.reduce((sum, c) => sum + ((c.completedAt ?? 0) - c.createdAt), 0) / completedWithDuration.length
        : 0,
    };
  }

  private findNextRequiredStep(chain: ApprovalChain, fromStep: number): number {
    for (let i = fromStep; i < chain.nodes.length; i++) {
      if (chain.nodes[i].isRequired) {
        return i;
      }
    }
    return chain.nodes.length;
  }

  private startExpirationTimers(chain: ApprovalChain): void {
    const config = this.chainConfig;
    if (!config.timeoutPerStep) return;

    for (const node of chain.nodes) {
      if (node.status === 'pending') {
        const timeout = config.timeoutPerStep;
        const timer = setTimeout(() => {
          this.handleNodeTimeout(chain.id, node.id);
        }, timeout);
        this.timeoutIntervals.set(`${chain.id}:${node.id}`, timer);
      }
    }
  }

  private clearNodeTimer(chainId: string, nodeId: string): void {
    const key = `${chainId}:${nodeId}`;
    const timer = this.timeoutIntervals.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timeoutIntervals.delete(key);
    }
  }

  private clearAllTimers(chainId: string): void {
    for (const [key, timer] of this.timeoutIntervals.entries()) {
      if (key.startsWith(`${chainId}:`)) {
        clearTimeout(timer);
        this.timeoutIntervals.delete(key);
      }
    }
  }

  private async handleNodeTimeout(chainId: string, nodeId: string): Promise<void> {
    const chain = this.activeChains.get(chainId);
    if (!chain) return;

    const node = chain.nodes.find(n => n.id === nodeId);
    if (!node || node.status !== 'pending') return;

    node.status = 'timeout';
    node.decidedAt = Date.now();

    // For sequential chains, move to next step or fail
    if (chain.chainType === 'sequential') {
      if (node.isRequired) {
        chain.status = 'failed';
      } else {
        chain.currentStep = this.findNextRequiredStep(chain, node.step + 1);
        if (chain.currentStep >= chain.nodes.length) {
          chain.status = 'completed';
        }
      }
    } else {
      const allRequiredProcessed = chain.nodes
        .filter(n => n.isRequired)
        .every(n => n.status !== 'pending');
      
      if (allRequiredProcessed) {
        chain.status = node.isRequired ? 'failed' : 'completed';
      }
    }

    if (chain.status !== 'active') {
      chain.completedAt = Date.now();
    }

    this.saveChains();
    this.notifyListeners(chain);
  }

  private saveChains(): void {
    const all = [
      ...Array.from(this.activeChains.values()),
      ...loadChains().filter(c => c.status === 'active'),
    ];
    // Deduplicate by ID
    const unique = Array.from(new Map(all.map(c => [c.id, c])).values());
    saveChains(unique);
  }

  private notifyListeners(chain: ApprovalChain): void {
    for (const listener of this.listeners) {
      try {
        listener(chain);
      } catch {
        // ignore listener errors
      }
    }
  }
}

// Singleton instance
export const approvalChainService = new ApprovalChainServiceImpl();
