/**
 * Transparency Service - P14
 * 
 * Manages transparency reports and disclosures for AI operations.
 * Provides audit trails and disclosure management for accountability.
 */

import type { PersonaRole } from '../collaboration/types';

// ============================================================================
// Types
// ============================================================================

export type DisclosureType = 
  | 'capability'       // AI capability disclosure
  | 'limitation'       // AI limitation disclosure
  | 'uncertainty'      // Uncertainty acknowledgment
  | 'error'            // Error/failure disclosure
  | 'conflict'         // Interest conflict disclosure
  | 'bias'             // Potential bias disclosure
  | 'data_usage'       // Data usage disclosure
  | 'confidence';      // Confidence level disclosure

export type DisclosureStatus = 'draft' | 'published' | 'superseded' | 'archived';

export interface DisclosureContext {
  sessionId?: string;
  taskId?: string;
  relatedDisclosureIds?: string[];
  evidence?: string[];
  severity?: 'info' | 'warning' | 'critical';
}

export interface Disclosure {
  id: string;
  type: DisclosureType;
  title: string;
  summary: string;
  fullText: string;
  context: DisclosureContext;
  status: DisclosureStatus;
  publishedAt?: number;
  expiresAt?: number;
  supersededBy?: string;
  role: PersonaRole;
  agentId: string;
  createdAt: number;
  viewCount: number;
  acknowledgedBy?: string[];
}

export interface TransparencyReport {
  id: string;
  title: string;
  period: {
    start: number;
    end: number;
  };
  summary: string;
  sections: ReportSection[];
  disclosures: string[];  // Disclosure IDs
  metrics: ReportMetrics;
  createdAt: number;
  role: PersonaRole;
}

export interface ReportSection {
  title: string;
  content: string;
  subsections?: ReportSection[];
}

export interface ReportMetrics {
  totalInteractions: number;
  decisionsExplained: number;
  disclosuresMade: number;
  acknowledgments: number;
  confidenceAverage: number;
  errorRate?: number;
}

export interface TransparencyConfig {
  autoPublishDisclosures?: boolean;
  disclosureRetentionDays?: number;
  requireAcknowledgment?: boolean;
  publishTransparencyReports?: boolean;
  reportFrequencyDays?: number;
}

// ============================================================================
// Storage Keys
// ============================================================================

const DISCLOSURE_STORAGE_KEY = 'pixelpal_explainability_disclosures';
const REPORT_STORAGE_KEY = 'pixelpal_explainability_reports';
const TRANSPARENCY_CONFIG_KEY = 'pixelpal_explainability_transparency_config';

// ============================================================================
// Config Management
// ============================================================================

const defaultConfig: Required<TransparencyConfig> = {
  autoPublishDisclosures: true,
  disclosureRetentionDays: 90,
  requireAcknowledgment: false,
  publishTransparencyReports: true,
  reportFrequencyDays: 7,
};

export function getTransparencyConfig(): Required<TransparencyConfig> {
  try {
    const stored = localStorage.getItem(TRANSPARENCY_CONFIG_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return defaultConfig;
}

export function setTransparencyConfig(config: TransparencyConfig): void {
  const current = getTransparencyConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(TRANSPARENCY_CONFIG_KEY, JSON.stringify(updated));
}

// ============================================================================
// Storage Functions
// ============================================================================

function loadDisclosures(): Disclosure[] {
  try {
    const raw = localStorage.getItem(DISCLOSURE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveDisclosures(disclosures: Disclosure[]): void {
  localStorage.setItem(DISCLOSURE_STORAGE_KEY, JSON.stringify(disclosures));
}

function loadReports(): TransparencyReport[] {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveReports(reports: TransparencyReport[]): void {
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
}

// ============================================================================
// Disclosure Templates
// ============================================================================

const DISCLOSURE_TEMPLATES: Record<DisclosureType, { title: string; summary: string; template: string }> = {
  capability: {
    title: 'AI Capability Disclosure',
    summary: 'Information about AI capabilities used in this interaction',
    template: 'In this interaction, I utilized {capability} to assist you.',
  },
  limitation: {
    title: 'AI Limitation Acknowledgment',
    summary: 'Acknowledgment of limitations in this interaction',
    template: 'I should note that my {limitation_type} may affect the results.',
  },
  uncertainty: {
    title: 'Uncertainty Disclosure',
    summary: 'Acknowledgment of uncertainty in AI response',
    template: 'I am {confidence}% confident in this response. The uncertainty stems from {factors}.',
  },
  error: {
    title: 'Error Disclosure',
    summary: 'Disclosure of errors or mistakes',
    template: 'I encountered an issue: {error_description}. I handled this by {handling}.',
  },
  conflict: {
    title: 'Potential Conflict of Interest',
    summary: 'Disclosure of potential competing interests',
    template: 'Please note that {conflict_description} may influence my recommendation.',
  },
  bias: {
    title: 'Potential Bias Notice',
    summary: 'Acknowledgment of potential bias',
    template: 'My response may reflect {bias_type} bias based on {factors}.',
  },
  data_usage: {
    title: 'Data Usage Disclosure',
    summary: 'Information about how data was used',
    template: 'In this interaction, I processed {data_description} to generate my response.',
  },
  confidence: {
    title: 'Confidence Level Disclosure',
    summary: 'Statement of confidence in the response',
    template: 'Confidence level: {confidence}%. {context_note}',
  },
};

// ============================================================================
// TransparencyService Implementation
// ============================================================================

class TransparencyServiceImpl {
  private disclosureCache: Disclosure[] | null = null;
  private reportCache: TransparencyReport[] | null = null;
  private listeners: Set<(disclosure: Disclosure) => void> = new Set();
  private config: Required<TransparencyConfig>;

  constructor() {
    this.config = getTransparencyConfig();
  }

  private getDisclosures(): Disclosure[] {
    if (!this.disclosureCache) {
      this.disclosureCache = loadDisclosures();
    }
    return this.disclosureCache;
  }

  private getReports(): TransparencyReport[] {
    if (!this.reportCache) {
      this.reportCache = loadReports();
    }
    return this.reportCache;
  }

  private notifyListeners(disclosure: Disclosure): void {
    for (const listener of this.listeners) {
      try {
        listener(disclosure);
      } catch {
        // ignore listener errors
      }
    }
  }

  /**
   * Create a new disclosure
   */
  async createDisclosure(params: {
    type: DisclosureType;
    title?: string;
    summary?: string;
    fullText: string;
    context?: Partial<DisclosureContext>;
    role: PersonaRole;
    agentId: string;
    expiresAt?: number;
  }): Promise<Disclosure> {
    const template = DISCLOSURE_TEMPLATES[params.type];
    
    const disclosure: Disclosure = {
      id: `disclosure_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: params.type,
      title: params.title ?? template.title,
      summary: params.summary ?? template.summary,
      fullText: params.fullText,
      context: {
        sessionId: params.context?.sessionId,
        taskId: params.context?.taskId,
        relatedDisclosureIds: params.context?.relatedDisclosureIds,
        evidence: params.context?.evidence,
        severity: params.context?.severity,
      },
      status: this.config.autoPublishDisclosures ? 'published' : 'draft',
      publishedAt: this.config.autoPublishDisclosures ? Date.now() : undefined,
      expiresAt: params.expiresAt ?? (
        this.config.disclosureRetentionDays 
          ? Date.now() + (this.config.disclosureRetentionDays * 24 * 60 * 60 * 1000)
          : undefined
      ),
      role: params.role,
      agentId: params.agentId,
      createdAt: Date.now(),
      viewCount: 0,
      acknowledgedBy: [],
    };

    const all = this.getDisclosures();
    all.push(disclosure);
    this.disclosureCache = all;
    saveDisclosures(all);
    
    this.notifyListeners(disclosure);
    return disclosure;
  }

  /**
   * Publish a draft disclosure
   */
  async publishDisclosure(id: string): Promise<Disclosure> {
    const disclosures = this.getDisclosures();
    const disclosure = disclosures.find(d => d.id === id);
    
    if (!disclosure) {
      throw new Error(`Disclosure not found: ${id}`);
    }
    
    if (disclosure.status !== 'draft') {
      throw new Error(`Disclosure is not a draft: ${disclosure.status}`);
    }

    disclosure.status = 'published';
    disclosure.publishedAt = Date.now();
    
    saveDisclosures(disclosures);
    this.notifyListeners(disclosure);
    
    return disclosure;
  }

  /**
   * Supersede a disclosure with a new one
   */
  async supersedeDisclosure(id: string, supersededById: string): Promise<void> {
    const disclosures = this.getDisclosures();
    const disclosure = disclosures.find(d => d.id === id);
    
    if (!disclosure) {
      throw new Error(`Disclosure not found: ${id}`);
    }

    disclosure.status = 'superseded';
    disclosure.supersededBy = supersededById;
    
    saveDisclosures(disclosures);
  }

  /**
   * Archive a disclosure
   */
  async archiveDisclosure(id: string): Promise<void> {
    const disclosures = this.getDisclosures();
    const disclosure = disclosures.find(d => d.id === id);
    
    if (!disclosure) {
      throw new Error(`Disclosure not found: ${id}`);
    }

    disclosure.status = 'archived';
    saveDisclosures(disclosures);
  }

  /**
   * Acknowledge a disclosure
   */
  async acknowledgeDisclosure(id: string, userId: string): Promise<void> {
    const disclosures = this.getDisclosures();
    const disclosure = disclosures.find(d => d.id === id);
    
    if (!disclosure) {
      throw new Error(`Disclosure not found: ${id}`);
    }

    if (!disclosure.acknowledgedBy?.includes(userId)) {
      disclosure.acknowledgedBy = [...(disclosure.acknowledgedBy ?? []), userId];
      saveDisclosures(disclosures);
    }
  }

  /**
   * Get disclosure by ID
   */
  getDisclosure(id: string): Disclosure | undefined {
    return this.getDisclosures().find(d => d.id === id);
  }

  /**
   * Get all disclosures
   */
  getAllDisclosures(): Disclosure[] {
    return this.getDisclosures();
  }

  /**
   * Get published disclosures
   */
  getPublishedDisclosures(): Disclosure[] {
    return this.getDisclosures().filter(d => d.status === 'published');
  }

  /**
   * Get disclosures for session
   */
  getDisclosuresForSession(sessionId: string): Disclosure[] {
    return this.getDisclosures().filter(d => d.context.sessionId === sessionId);
  }

  /**
   * Get disclosures by type
   */
  getDisclosuresByType(type: DisclosureType): Disclosure[] {
    return this.getDisclosures().filter(d => d.type === type && d.status === 'published');
  }

  /**
   * Increment view count
   */
  recordView(id: string): void {
    const disclosures = this.getDisclosures();
    const disclosure = disclosures.find(d => d.id === id);
    if (disclosure) {
      disclosure.viewCount++;
      saveDisclosures(disclosures);
    }
  }

  /**
   * Create a transparency report
   */
  async createReport(params: {
    title: string;
    period: { start: number; end: number };
    summary: string;
    sections: ReportSection[];
    disclosures: string[];
    metrics: ReportMetrics;
    role: PersonaRole;
  }): Promise<TransparencyReport> {
    const report: TransparencyReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      title: params.title,
      period: params.period,
      summary: params.summary,
      sections: params.sections,
      disclosures: params.disclosures,
      metrics: params.metrics,
      createdAt: Date.now(),
      role: params.role,
    };

    const all = this.getReports();
    all.push(report);
    this.reportCache = all;
    saveReports(all);

    return report;
  }

  /**
   * Get report by ID
   */
  getReport(id: string): TransparencyReport | undefined {
    return this.getReports().find(r => r.id === id);
  }

  /**
   * Get all reports
   */
  getAllReports(): TransparencyReport[] {
    return this.getReports();
  }

  /**
   * Get recent reports
   */
  getRecentReports(limit = 10): TransparencyReport[] {
    const sorted = [...this.getReports()].sort((a, b) => b.createdAt - a.createdAt);
    return sorted.slice(0, limit);
  }

  /**
   * Get reports by period
   */
  getReportsByPeriod(start: number, end: number): TransparencyReport[] {
    return this.getReports().filter(
      r => r.period.start >= start && r.period.end <= end
    );
  }

  /**
   * Clear expired disclosures
   */
  clearExpired(): number {
    const now = Date.now();
    const disclosures = this.getDisclosures();
    const initialCount = disclosures.length;
    
    const filtered = disclosures.filter(d => !d.expiresAt || d.expiresAt > now);
    const removed = initialCount - filtered.length;
    
    if (removed > 0) {
      this.disclosureCache = filtered;
      saveDisclosures(filtered);
    }
    
    return removed;
  }

  /**
   * Get disclosure statistics
   */
  getStats(): {
    total: number;
    published: number;
    draft: number;
    byType: Record<DisclosureType, number>;
    totalViews: number;
    acknowledgmentRate: number;
  } {
    const disclosures = this.getDisclosures();
    
    const byType: Record<DisclosureType, number> = {
      capability: 0, limitation: 0, uncertainty: 0, error: 0,
      conflict: 0, bias: 0, data_usage: 0, confidence: 0,
    };

    let totalViews = 0;
    let acknowledgedCount = 0;

    for (const d of disclosures) {
      if (d.status === 'published') {
        byType[d.type]++;
      }
      totalViews += d.viewCount;
      acknowledgedCount += d.acknowledgedBy?.length ?? 0;
    }

    const publishedCount = disclosures.filter(d => d.status === 'published').length;

    return {
      total: disclosures.length,
      published: publishedCount,
      draft: disclosures.filter(d => d.status === 'draft').length,
      byType,
      totalViews,
      acknowledgmentRate: publishedCount > 0 ? acknowledgedCount / publishedCount : 0,
    };
  }

  /**
   * Subscribe to new disclosures
   */
  subscribe(listener: (disclosure: Disclosure) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// Singleton instance
export const transparencyService = new TransparencyServiceImpl();
