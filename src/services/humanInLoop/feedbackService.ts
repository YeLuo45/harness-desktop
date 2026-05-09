/**
 * Human Feedback Collection Service - P13
 * 
 * Collects, analyzes, and stores human feedback for AI behavior improvement.
 * Supports rating, tagging, and free-text feedback.
 */

import type { PersonaRole } from '../collaboration/types';

// ============================================================================
// Types
// ============================================================================

export type FeedbackRating = 1 | 2 | 3 | 4 | 5;

export type FeedbackCategory = 
  | 'accuracy'
  | 'helpfulness'
  | 'relevance'
  | 'tone'
  | 'creativity'
  | 'safety'
  | 'other';

export interface FeedbackTag {
  id: string;
  label: string;
  category: FeedbackCategory;
}

export interface HumanFeedback {
  id: string;
  sessionId?: string;
  taskId?: string;
  role: PersonaRole;
  agentId: string;
  rating: FeedbackRating;
  categories: FeedbackCategory[];
  tags: string[];
  comment?: string;
  improvementSuggestions?: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface FeedbackSummary {
  totalFeedback: number;
  averageRating: number;
  categoryBreakdown: Record<FeedbackCategory, number>;
  recentTrends: {
    period: string;
    averageRating: number;
    count: number;
  }[];
  topTags: { tag: string; count: number }[];
}

// ============================================================================
// Storage Keys
// ============================================================================

const FEEDBACK_STORAGE_KEY = 'pixelpal_humaninloop_feedback';
const FEEDBACK_TAGS_KEY = 'pixelpal_humaninloop_feedback_tags';

// ============================================================================
// Default Feedback Tags
// ============================================================================

export const DEFAULT_FEEDBACK_TAGS: FeedbackTag[] = [
  { id: 'tag_accuracy', label: '准确', category: 'accuracy' },
  { id: 'tag_inaccurate', label: '不准确', category: 'accuracy' },
  { id: 'tag_helpful', label: '有帮助', category: 'helpfulness' },
  { id: 'tag_not_helpful', label: '没帮助', category: 'helpfulness' },
  { id: 'tag_relevant', label: '相关', category: 'relevance' },
  { id: 'tag_irrelevant', label: '不相关', category: 'relevance' },
  { id: 'tag_friendly', label: '友好', category: 'tone' },
  { id: 'tag_cold', label: '冷淡', category: 'tone' },
  { id: 'tag_creative', label: '有创意', category: 'creativity' },
  { id: 'tag_boring', label: '无聊', category: 'creativity' },
  { id: 'tag_safe', label: '安全', category: 'safety' },
  { id: 'tag_unsafe', label: '不安全', category: 'safety' },
];

// ============================================================================
// Storage Functions
// ============================================================================

function loadFeedback(): HumanFeedback[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveFeedback(feedback: HumanFeedback[]): void {
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(feedback));
}

function loadTags(): FeedbackTag[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_TAGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return DEFAULT_FEEDBACK_TAGS;
}

function saveTags(tags: FeedbackTag[]): void {
  localStorage.setItem(FEEDBACK_TAGS_KEY, JSON.stringify(tags));
}

// ============================================================================
// FeedbackService Implementation
// ============================================================================

class FeedbackServiceImpl {
  private feedbackCache: HumanFeedback[] | null = null;

  constructor() {}

  private getFeedback(): HumanFeedback[] {
    if (!this.feedbackCache) {
      this.feedbackCache = loadFeedback();
    }
    return this.feedbackCache;
  }

  /**
   * Submit new feedback
   */
  async submitFeedback(params: {
    sessionId?: string;
    taskId?: string;
    role: PersonaRole;
    agentId: string;
    rating: FeedbackRating;
    categories?: FeedbackCategory[];
    tags?: string[];
    comment?: string;
    improvementSuggestions?: string;
    metadata?: Record<string, unknown>;
  }): Promise<HumanFeedback> {
    const feedback: HumanFeedback = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      sessionId: params.sessionId,
      taskId: params.taskId,
      role: params.role,
      agentId: params.agentId,
      rating: params.rating,
      categories: params.categories ?? [],
      tags: params.tags ?? [],
      comment: params.comment,
      improvementSuggestions: params.improvementSuggestions,
      createdAt: Date.now(),
      metadata: params.metadata,
    };

    const all = this.getFeedback();
    all.push(feedback);
    this.feedbackCache = all;
    saveFeedback(all);

    return feedback;
  }

  /**
   * Get feedback by ID
   */
  getFeedbackById(id: string): HumanFeedback | undefined {
    return this.getFeedback().find(f => f.id === id);
  }

  /**
   * Get all feedback
   */
  getAllFeedback(): HumanFeedback[] {
    return this.getFeedback();
  }

  /**
   * Get feedback for a specific session
   */
  getFeedbackForSession(sessionId: string): HumanFeedback[] {
    return this.getFeedback().filter(f => f.sessionId === sessionId);
  }

  /**
   * Get feedback for a specific role
   */
  getFeedbackForRole(role: PersonaRole): HumanFeedback[] {
    return this.getFeedback().filter(f => f.role === role);
  }

  /**
   * Get feedback within a date range
   */
  getFeedbackByDateRange(startDate: number, endDate: number): HumanFeedback[] {
    return this.getFeedback().filter(
      f => f.createdAt >= startDate && f.createdAt <= endDate
    );
  }

  /**
   * Get recent feedback (last N items)
   */
  getRecentFeedback(limit = 10): HumanFeedback[] {
    const sorted = [...this.getFeedback()].sort((a, b) => b.createdAt - a.createdAt);
    return sorted.slice(0, limit);
  }

  /**
   * Delete feedback by ID
   */
  deleteFeedback(id: string): boolean {
    const all = this.getFeedback();
    const index = all.findIndex(f => f.id === id);
    if (index === -1) return false;

    all.splice(index, 1);
    this.feedbackCache = all;
    saveFeedback(all);
    return true;
  }

  /**
   * Get available tags
   */
  getTags(): FeedbackTag[] {
    return loadTags();
  }

  /**
   * Add custom tag
   */
  addTag(tag: Omit<FeedbackTag, 'id'>): FeedbackTag {
    const newTag: FeedbackTag = {
      ...tag,
      id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };

    const tags = loadTags();
    tags.push(newTag);
    saveTags(tags);

    return newTag;
  }

  /**
   * Get feedback summary statistics
   */
  getSummary(periodDays = 7): FeedbackSummary {
    const all = this.getFeedback();
    const now = Date.now();
    const periodMs = periodDays * 24 * 60 * 60 * 1000;
    const cutoff = now - periodMs;

    const recentFeedback = all.filter(f => f.createdAt >= cutoff);

    // Calculate average rating
    const totalRating = recentFeedback.reduce((sum, f) => sum + f.rating, 0);
    const averageRating = recentFeedback.length > 0
      ? totalRating / recentFeedback.length
      : 0;

    // Category breakdown
    const categoryBreakdown: Record<FeedbackCategory, number> = {
      accuracy: 0,
      helpfulness: 0,
      relevance: 0,
      tone: 0,
      creativity: 0,
      safety: 0,
      other: 0,
    };

    for (const feedback of recentFeedback) {
      for (const category of feedback.categories) {
        if (category in categoryBreakdown) {
          categoryBreakdown[category]++;
        }
      }
    }

    // Recent trends (by day)
    const dailyMap = new Map<string, { total: number; count: number }>();
    for (const feedback of recentFeedback) {
      const date = new Date(feedback.createdAt).toISOString().split('T')[0];
      const existing = dailyMap.get(date) ?? { total: 0, count: 0 };
      existing.total += feedback.rating;
      existing.count++;
      dailyMap.set(date, existing);
    }

    const recentTrends = Array.from(dailyMap.entries())
      .map(([period, data]) => ({
        period,
        averageRating: data.total / data.count,
        count: data.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    // Top tags
    const tagCounts = new Map<string, number>();
    for (const feedback of recentFeedback) {
      for (const tag of feedback.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalFeedback: recentFeedback.length,
      averageRating,
      categoryBreakdown,
      recentTrends,
      topTags,
    };
  }

  /**
   * Get rating distribution
   */
  getRatingDistribution(): Record<FeedbackRating, number> {
    const distribution: Record<FeedbackRating, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    for (const feedback of this.getFeedback()) {
      distribution[feedback.rating]++;
    }

    return distribution;
  }

  /**
   * Clear all feedback (admin use)
   */
  clearAllFeedback(): void {
    this.feedbackCache = [];
    saveFeedback([]);
  }

  /**
   * Export feedback as JSON
   */
  exportFeedback(): string {
    return JSON.stringify(this.getFeedback(), null, 2);
  }
}

// Singleton instance
export const feedbackService = new FeedbackServiceImpl();
