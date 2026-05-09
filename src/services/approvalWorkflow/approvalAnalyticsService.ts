/**
 * Approval Analytics Service - P15
 * 
 * Provides metrics, reporting, and insights for approval workflows.
 * Tracks performance, identifies bottlenecks, and generates analytics.
 */

import type { PersonaRole } from '../collaboration/types';

// ============================================================================
// Types
// ============================================================================

export type MetricPeriod = 'hour' | 'day' | 'week' | 'month' | 'quarter';
export type TrendDirection = 'up' | 'down' | 'stable';

export interface ApprovalMetrics {
  totalRequests: number;
  approved: number;
  rejected: number;
  pending: number;
  timeout: number;
  cancelled: number;
  approvalRate: number;           // Percentage of approved vs total
  averageResponseTime: number;    // ms
  medianResponseTime: number;     // ms
  p95ResponseTime: number;        // ms
  averageQueueTime: number;       // ms
}

export interface RoleMetrics {
  role: PersonaRole;
  totalAssigned: number;
  approved: number;
  rejected: number;
  pending: number;
  averageResponseTime: number;
  workload: number;               // Relative workload compared to others
}

export interface TrendData {
  period: string;
  value: number;
  change: number;                // Percentage change from previous
  direction: TrendDirection;
}

export interface AnalyticsReport {
  id: string;
  name: string;
  type: 'summary' | 'detailed' | 'role_analysis' | 'trend' | 'bottleneck';
  period: MetricPeriod;
  startDate: number;
  endDate: number;
  generatedAt: number;
  metrics: ApprovalMetrics;
  roleMetrics?: RoleMetrics[];
  trends?: TrendData[];
  insights?: string[];
}

export interface BottleneckAnalysis {
  role: PersonaRole;
  severity: 'low' | 'medium' | 'high' | 'critical';
  averageWaitTime: number;
  queueDepth: number;
  trend: TrendDirection;
  recommendation: string;
}

export interface AnalyticsConfig {
  retentionDays?: number;
  autoGenerateReports?: boolean;
  reportScheduleInterval?: number;
  enableRealTimeMetrics?: boolean;
}

// ============================================================================
// Storage Keys
// ============================================================================

const ANALYTICS_STORAGE_KEY = 'pixelpal_approvalworkflow_analytics';
const HISTORICAL_STORAGE_KEY = 'pixelpal_approvalworkflow_history';
const ANALYTICS_CONFIG_KEY = 'pixelpal_approvalworkflow_analytics_config';

// ============================================================================
// Config Management
// ============================================================================

const defaultConfig: Required<AnalyticsConfig> = {
  retentionDays: 90,
  autoGenerateReports: true,
  reportScheduleInterval: 60 * 60 * 1000, // 1 hour
  enableRealTimeMetrics: true,
};

export function getAnalyticsConfig(): Required<AnalyticsConfig> {
  try {
    const stored = localStorage.getItem(ANALYTICS_CONFIG_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return defaultConfig;
}

export function setAnalyticsConfig(config: AnalyticsConfig): void {
  const current = getAnalyticsConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(ANALYTICS_CONFIG_KEY, JSON.stringify(updated));
}

// ============================================================================
// Historical Data Types (for trend analysis)
// ============================================================================

interface HistoricalRecord {
  id: string;
  timestamp: number;
  role: PersonaRole;
  status: 'approved' | 'rejected' | 'timeout';
  responseTime: number;          // ms from request to decision
  queueTime: number;             // ms spent waiting in queue
  priority: 'low' | 'normal' | 'high' | 'critical';
  chainId?: string;
  metadata?: Record<string, unknown>;
}

interface DailyAggregate {
  date: string;                  // YYYY-MM-DD
  totalRequests: number;
  approved: number;
  rejected: number;
  timeout: number;
  averageResponseTime: number;
  averageQueueTime: number;
  byRole: Partial<Record<PersonaRole, {
    count: number;
    approved: number;
    rejected: number;
    avgResponseTime: number;
  }>>;
}

// ============================================================================
// Storage Functions
// ============================================================================

function loadHistoricalRecords(): HistoricalRecord[] {
  try {
    const raw = localStorage.getItem(HISTORICAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveHistoricalRecords(records: HistoricalRecord[]): void {
  localStorage.setItem(HISTORICAL_STORAGE_KEY, JSON.stringify(records));
}

function loadDailyAggregates(): DailyAggregate[] {
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveDailyAggregates(aggregates: DailyAggregate[]): void {
  localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(aggregates));
}

// ============================================================================
// ApprovalAnalyticsService Implementation
// ============================================================================

class ApprovalAnalyticsServiceImpl {
  private config: Required<AnalyticsConfig>;
  private listeners: Set<(metrics: ApprovalMetrics) => void> = new Set();
  private cachedMetrics: ApprovalMetrics | null = null;
  private lastCalculation: number = 0;
  private calculationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = getAnalyticsConfig();
    this.startPeriodicCalculation();
  }

  private startPeriodicCalculation(): void {
    if (!this.config.enableRealTimeMetrics) return;

    this.calculationInterval = setInterval(() => {
      this.calculateMetrics();
    }, this.config.reportScheduleInterval);
  }

  /**
   * Record an approval decision for analytics
   */
  async recordDecision(params: {
    requestId: string;
    role: PersonaRole;
    status: 'approved' | 'rejected' | 'timeout';
    responseTime: number;
    queueTime: number;
    priority: 'low' | 'normal' | 'high' | 'critical';
    chainId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const record: HistoricalRecord = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      role: params.role,
      status: params.status,
      responseTime: params.responseTime,
      queueTime: params.queueTime,
      priority: params.priority,
      chainId: params.chainId,
      metadata: params.metadata,
    };

    const records = loadHistoricalRecords();
    records.push(record);

    // Apply retention policy
    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    const filtered = records.filter(r => r.timestamp > cutoff);

    saveHistoricalRecords(filtered);
    this.invalidateCache();
  }

  /**
   * Calculate current metrics
   */
  calculateMetrics(period?: MetricPeriod): ApprovalMetrics {
    const now = Date.now();
    const periodMs = this.getPeriodMs(period);
    const cutoff = now - periodMs;

    const records = loadHistoricalRecords().filter(r => r.timestamp > cutoff);
    
    if (records.length === 0) {
      return {
        totalRequests: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
        timeout: 0,
        cancelled: 0,
        approvalRate: 0,
        averageResponseTime: 0,
        medianResponseTime: 0,
        p95ResponseTime: 0,
        averageQueueTime: 0,
      };
    }

    const approved = records.filter(r => r.status === 'approved').length;
    const rejected = records.filter(r => r.status === 'rejected').length;
    const timeout = records.filter(r => r.status === 'timeout').length;

    const responseTimes = records.map(r => r.responseTime).sort((a, b) => a - b);
    const queueTimes = records.map(r => r.queueTime).sort((a, b) => a - b);

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr: number[]) => (arr.length > 0 ? sum(arr) / arr.length : 0);
    const median = (arr: number[]) => {
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    };
    const p95 = (arr: number[]) => {
      const index = Math.ceil(arr.length * 0.95) - 1;
      return arr[Math.max(0, index)];
    };

    return {
      totalRequests: records.length,
      approved,
      rejected,
      pending: 0, // Not tracked in historical records
      timeout,
      cancelled: 0,
      approvalRate: (approved / records.length) * 100,
      averageResponseTime: avg(responseTimes),
      medianResponseTime: median(responseTimes),
      p95ResponseTime: p95(responseTimes),
      averageQueueTime: avg(queueTimes),
    };
  }

  /**
   * Get metrics for a specific period
   */
  getMetrics(period: MetricPeriod = 'day'): ApprovalMetrics {
    const now = Date.now();
    const cacheKey = `metrics_${period}`;
    
    // Return cached if valid (within 1 minute)
    if (
      this.cachedMetrics &&
      now - this.lastCalculation < 60000
    ) {
      return this.cachedMetrics;
    }

    const metrics = this.calculateMetrics(period);
    this.cachedMetrics = metrics;
    this.lastCalculation = now;
    return metrics;
  }

  /**
   * Get role-based metrics
   */
  getRoleMetrics(period?: MetricPeriod): RoleMetrics[] {
    const now = Date.now();
    const periodMs = this.getPeriodMs(period);
    const cutoff = now - periodMs;

    const records = loadHistoricalRecords().filter(r => r.timestamp > cutoff);

    const roles: PersonaRole[] = ['MemoryExpert', 'EmotionAnalyst', 'Advisor', 'Researcher', 'Coder'];
    const roleMetrics: RoleMetrics[] = [];

    for (const role of roles) {
      const roleRecords = records.filter(r => r.role === role);
      if (roleRecords.length === 0) {
        roleMetrics.push({
          role,
          totalAssigned: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          averageResponseTime: 0,
          workload: 0,
        });
        continue;
      }

      const approved = roleRecords.filter(r => r.status === 'approved').length;
      const rejected = roleRecords.filter(r => r.status === 'rejected').length;
      const responseTimes = roleRecords.map(r => r.responseTime);
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

      roleMetrics.push({
        role,
        totalAssigned: roleRecords.length,
        approved,
        rejected,
        pending: 0,
        averageResponseTime: avgResponseTime,
        workload: roleRecords.length / records.length, // Relative workload
      });
    }

    return roleMetrics;
  }

  /**
   * Get trend data for a metric
   */
  getTrendData(
    metric: 'approvalRate' | 'averageResponseTime' | 'totalRequests' | 'timeoutRate',
    period: MetricPeriod = 'day',
    points = 7
  ): TrendData[] {
    const trends: TrendData[] = [];
    const now = Date.now();

    for (let i = points - 1; i >= 0; i--) {
      const periodStart = now - this.getPeriodMs(period) * (i + 1);
      const periodEnd = now - this.getPeriodMs(period) * i;

      const records = loadHistoricalRecords().filter(
        r => r.timestamp >= periodStart && r.timestamp < periodEnd
      );

      let value: number;
      switch (metric) {
        case 'approvalRate':
          value = records.length > 0
            ? (records.filter(r => r.status === 'approved').length / records.length) * 100
            : 0;
          break;
        case 'averageResponseTime':
          value = records.length > 0
            ? records.reduce((sum, r) => sum + r.responseTime, 0) / records.length
            : 0;
          break;
        case 'totalRequests':
          value = records.length;
          break;
        case 'timeoutRate':
          value = records.length > 0
            ? (records.filter(r => r.status === 'timeout').length / records.length) * 100
            : 0;
          break;
      }

      trends.push({
        period: this.formatPeriod(periodStart, period),
        value,
        change: 0, // Calculated below
        direction: 'stable',
      });
    }

    // Calculate changes
    for (let i = 1; i < trends.length; i++) {
      const prev = trends[i - 1].value;
      const curr = trends[i].value;
      if (prev === 0) {
        trends[i].change = 0;
        trends[i].direction = 'stable';
      } else {
        trends[i].change = ((curr - prev) / prev) * 100;
        trends[i].direction = curr > prev ? 'up' : curr < prev ? 'down' : 'stable';
      }
    }

    return trends;
  }

  /**
   * Identify bottlenecks in approval workflow
   */
  analyzeBottlenecks(period: MetricPeriod = 'day'): BottleneckAnalysis[] {
    const roleMetrics = this.getRoleMetrics(period);
    const bottlenecks: BottleneckAnalysis[] = [];

    // Calculate average metrics across all roles
    const avgQueueTime = roleMetrics.reduce((sum, r) => sum + r.averageResponseTime, 0) / roleMetrics.length;
    const avgWorkload = roleMetrics.reduce((sum, r) => sum + r.workload, 0) / roleMetrics.length;

    for (const metrics of roleMetrics) {
      if (metrics.totalAssigned === 0) continue;

      // Calculate severity based on queue time and workload relative to average
      const queueTimeRatio = metrics.averageResponseTime / avgQueueTime;
      const workloadRatio = metrics.workload / avgWorkload;

      let severity: BottleneckAnalysis['severity'] = 'low';
      let recommendation = '';

      if (queueTimeRatio > 1.5 || workloadRatio > 1.5) {
        severity = 'critical';
        recommendation = `Critical bottleneck: ${metrics.role} is significantly overloaded. Consider redistributing approval tasks or adding additional approvers.`;
      } else if (queueTimeRatio > 1.25 || workloadRatio > 1.25) {
        severity = 'high';
        recommendation = `High load on ${metrics.role}. Monitor queue depth and consider temporary delegation or workload balancing.`;
      } else if (queueTimeRatio > 1.1 || workloadRatio > 1.1) {
        severity = 'medium';
        recommendation = `Moderate load detected on ${metrics.role}. Keep under observation.`;
      }

      if (severity !== 'low') {
        bottlenecks.push({
          role: metrics.role,
          severity,
          averageWaitTime: metrics.averageResponseTime,
          queueDepth: metrics.totalAssigned,
          trend: this.calculateTrendDirection(metrics.role, 'averageResponseTime'),
          recommendation,
        });
      }
    }

    return bottlenecks.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });
  }

  /**
   * Generate a comprehensive analytics report
   */
  generateReport(params: {
    name: string;
    type: AnalyticsReport['type'];
    period: MetricPeriod;
  }): AnalyticsReport {
    const now = Date.now();
    const startDate = now - this.getPeriodMs(params.period);

    const metrics = this.calculateMetrics(params.period);
    const roleMetrics = this.getRoleMetrics(params.period);
    const trends = [
      this.getTrendData('approvalRate', params.period, 7),
      this.getTrendData('averageResponseTime', params.period, 7),
      this.getTrendData('totalRequests', params.period, 7),
    ];

    // Generate insights
    const insights: string[] = [];

    if (metrics.approvalRate > 80) {
      insights.push('High approval rate indicates well-qualified requests or lenient approval criteria.');
    } else if (metrics.approvalRate < 50) {
      insights.push('Low approval rate may indicate unclear request guidelines or overly restrictive approval criteria.');
    }

    if (metrics.averageResponseTime > 30 * 60 * 1000) {
      insights.push('Average response time exceeds 30 minutes. Consider adding more approvers or implementing delegation.');
    }

    const bottlenecks = this.analyzeBottlenecks(params.period);
    if (bottlenecks.length > 0) {
      insights.push(`${bottlenecks.length} role(s) identified as potential bottlenecks requiring attention.`);
    }

    const approvalTrend = trends[0];
    if (approvalTrend.length >= 2) {
      const lastChange = approvalTrend[approvalTrend.length - 1].change;
      if (lastChange > 10) {
        insights.push('Approval rate is trending upward significantly.');
      } else if (lastChange < -10) {
        insights.push('Approval rate is declining. Review recent changes to request patterns.');
      }
    }

    return {
      id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: params.name,
      type: params.type,
      period: params.period,
      startDate,
      endDate: now,
      generatedAt: now,
      metrics,
      roleMetrics,
      trends: trends.flat(),
      insights,
    };
  }

  /**
   * Get daily aggregates for charting
   */
  getDailyAggregates(days = 30): DailyAggregate[] {
    const aggregates = loadDailyAggregates();
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    return aggregates
      .filter(a => new Date(a.date).getTime() > cutoff)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Update daily aggregates (called periodically)
   */
  updateDailyAggregates(): void {
    const records = loadHistoricalRecords();
    const today = new Date().toISOString().split('T')[0];

    // Group records by day
    const byDate = new Map<string, HistoricalRecord[]>();
    for (const record of records) {
      const date = new Date(record.timestamp).toISOString().split('T')[0];
      if (!byDate.has(date)) {
        byDate.set(date, []);
      }
      byDate.get(date)!.push(record);
    }

    const aggregates = loadDailyAggregates();
    const existingIndex = new Map(aggregates.map(a => [a.date, a]));

    for (const [date, dateRecords] of byDate.entries()) {
      const approved = dateRecords.filter(r => r.status === 'approved');
      const rejected = dateRecords.filter(r => r.status === 'rejected');

      const byRole: DailyAggregate['byRole'] = {
        MemoryExpert: { count: 0, approved: 0, rejected: 0, avgResponseTime: 0 },
        EmotionAnalyst: { count: 0, approved: 0, rejected: 0, avgResponseTime: 0 },
        Advisor: { count: 0, approved: 0, rejected: 0, avgResponseTime: 0 },
        Researcher: { count: 0, approved: 0, rejected: 0, avgResponseTime: 0 },
        Coder: { count: 0, approved: 0, rejected: 0, avgResponseTime: 0 },
      };

      for (const record of dateRecords) {
        const roleData = byRole[record.role];
        if (roleData) {
          roleData.count++;
          if (record.status === 'approved') roleData.approved++;
          if (record.status === 'rejected') roleData.rejected++;
          roleData.avgResponseTime += record.responseTime;
        }
      }

      // Average the response times
      for (const role of Object.keys(byRole) as PersonaRole[]) {
        const roleData = byRole[role];
        if (roleData && roleData.count > 0) {
          roleData.avgResponseTime /= roleData.count;
        }
      }

      existingIndex.set(date, {
        date,
        totalRequests: dateRecords.length,
        approved: approved.length,
        rejected: rejected.length,
        timeout: dateRecords.filter(r => r.status === 'timeout').length,
        averageResponseTime: dateRecords.reduce((sum, r) => sum + r.responseTime, 0) / dateRecords.length,
        averageQueueTime: dateRecords.reduce((sum, r) => sum + r.queueTime, 0) / dateRecords.length,
        byRole,
      });
    }

    saveDailyAggregates(Array.from(existingIndex.values()));
  }

  /**
   * Subscribe to metrics updates
   */
  subscribe(listener: (metrics: ApprovalMetrics) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalDecisions: number;
    averageApprovalRate: number;
    averageResponseTime: number;
    mostActiveRole: PersonaRole;
    bottleneckCount: number;
  } {
    const allRecords = loadHistoricalRecords();
    const metrics = this.calculateMetrics('month');

    // Find most active role
    const roleCounts = new Map<PersonaRole, number>();
    for (const record of allRecords) {
      const count = roleCounts.get(record.role) ?? 0;
      roleCounts.set(record.role, count + 1);
    }

    let mostActiveRole: PersonaRole = 'Advisor';
    let maxCount = 0;
    for (const [role, count] of roleCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostActiveRole = role;
      }
    }

    return {
      totalDecisions: allRecords.length,
      averageApprovalRate: metrics.approvalRate,
      averageResponseTime: metrics.averageResponseTime,
      mostActiveRole,
      bottleneckCount: this.analyzeBottlenecks('day').filter(b => b.severity === 'high' || b.severity === 'critical').length,
    };
  }

  /**
   * Clear old historical data (admin use)
   */
  clearOldData(daysToKeep?: number): number {
    const days = daysToKeep ?? this.config.retentionDays;
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const records = loadHistoricalRecords();
    const filtered = records.filter(r => r.timestamp > cutoff);
    const removed = records.length - filtered.length;

    if (removed > 0) {
      saveHistoricalRecords(filtered);
      this.invalidateCache();
    }

    return removed;
  }

  private getPeriodMs(period?: MetricPeriod): number {
    switch (period) {
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      case 'month': return 30 * 24 * 60 * 60 * 1000;
      case 'quarter': return 90 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  private formatPeriod(timestamp: number, period: MetricPeriod): string {
    const date = new Date(timestamp);
    switch (period) {
      case 'hour':
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case 'day':
        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      case 'week':
        return `Week ${Math.ceil(date.getDate() / 7)}`;
      case 'month':
        return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
      case 'quarter':
        const quarter = Math.ceil((date.getMonth() + 1) / 3);
        return `Q${quarter} ${date.getFullYear()}`;
      default:
        return date.toISOString();
    }
  }

  private calculateTrendDirection(role: PersonaRole, metric: 'averageResponseTime'): TrendDirection {
    const trend = this.getTrendData('averageResponseTime', 'day', 3);
    if (trend.length < 2) return 'stable';

    // Compare recent average to older average
    const recent = trend.slice(-2).reduce((sum, t) => sum + t.value, 0) / 2;
    const older = trend.slice(0, 2).reduce((sum, t) => sum + t.value, 0) / 2;

    if (recent > older * 1.1) return 'up';
    if (recent < older * 0.9) return 'down';
    return 'stable';
  }

  private invalidateCache(): void {
    this.cachedMetrics = null;
    this.lastCalculation = 0;
  }
}

// Singleton instance
export const approvalAnalyticsService = new ApprovalAnalyticsServiceImpl();
