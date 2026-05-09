/**
 * Review Service - P13
 * 
 * Manages human review workflows for AI outputs and decisions.
 * Supports queue management, priority handling, and review history.
 */

import type { PersonaRole } from '../collaboration/types';

// ============================================================================
// Types
// ============================================================================

export type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'revision_requested';
export type ReviewPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ReviewCategory = 
  | 'content_generation'
  | 'decision_making'
  | 'task_execution'
  | 'safety_check'
  | 'compliance_check'
  | 'quality_assurance';

export interface ReviewItem {
  id: string;
  sessionId: string;
  taskId: string;
  subtaskId?: string;
  category: ReviewCategory;
  title: string;
  description: string;
  content: unknown;          // The AI output to review
  proposedAction?: string;
  responsibleRole: PersonaRole;
  reviewerId?: string;
  status: ReviewStatus;
  priority: ReviewPriority;
  createdAt: number;
  reviewedAt?: number;
  reviewNotes?: string;
  revisionFeedback?: string;
  metadata?: Record<string, unknown>;
}

export interface ReviewResult {
  decision: 'approved' | 'rejected' | 'revision_requested';
  notes?: string;
  revisionFeedback?: string;
  reviewedBy?: string;
  reviewedAt: number;
}

export interface ReviewConfig {
  autoAssign?: boolean;
  defaultReviewerId?: string;
  maxConcurrentReviews?: number;
  requireNotesForRejection?: boolean;
}

// ============================================================================
// Storage Keys
// ============================================================================

const REVIEW_STORAGE_KEY = 'pixelpal_humaninloop_reviews';
const REVIEW_CONFIG_KEY = 'pixelpal_humaninloop_review_config';

// ============================================================================
// Config Management
// ============================================================================

const defaultConfig: Required<ReviewConfig> = {
  autoAssign: false,
  defaultReviewerId: '',
  maxConcurrentReviews: 10,
  requireNotesForRejection: true,
};

export function getReviewConfig(): Required<ReviewConfig> {
  try {
    const stored = localStorage.getItem(REVIEW_CONFIG_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return defaultConfig;
}

export function setReviewConfig(config: ReviewConfig): void {
  const current = getReviewConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(REVIEW_CONFIG_KEY, JSON.stringify(updated));
}

// ============================================================================
// Storage Functions
// ============================================================================

function loadReviews(): ReviewItem[] {
  try {
    const raw = localStorage.getItem(REVIEW_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveReviews(reviews: ReviewItem[]): void {
  localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews));
}

// ============================================================================
// ReviewService Implementation
// ============================================================================

class ReviewServiceImpl {
  private pendingReviews: Map<string, ReviewItem> = new Map();
  private inReviewItems: Map<string, ReviewItem> = new Map();
  private listeners: Set<(item: ReviewItem) => void> = new Set();
  private config: Required<ReviewConfig>;

  constructor() {
    this.config = getReviewConfig();
    this.loadPendingReviews();
  }

  private loadPendingReviews(): void {
    const reviews = loadReviews();
    for (const review of reviews) {
      if (review.status === 'pending') {
        this.pendingReviews.set(review.id, review);
      } else if (review.status === 'in_review') {
        this.inReviewItems.set(review.id, review);
      }
    }
  }

  /**
   * Submit an item for review
   */
  async submitForReview(params: {
    sessionId: string;
    taskId: string;
    subtaskId?: string;
    category: ReviewCategory;
    title: string;
    description: string;
    content: unknown;
    proposedAction?: string;
    responsibleRole: PersonaRole;
    priority?: ReviewPriority;
    metadata?: Record<string, unknown>;
  }): Promise<ReviewItem> {
    if (this.pendingReviews.size >= this.config.maxConcurrentReviews) {
      throw new Error(`Maximum concurrent reviews (${this.config.maxConcurrentReviews}) reached`);
    }

    const item: ReviewItem = {
      id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      sessionId: params.sessionId,
      taskId: params.taskId,
      subtaskId: params.subtaskId,
      category: params.category,
      title: params.title,
      description: params.description,
      content: params.content,
      proposedAction: params.proposedAction,
      responsibleRole: params.responsibleRole,
      status: 'pending',
      priority: params.priority ?? 'normal',
      createdAt: Date.now(),
      metadata: params.metadata,
    };

    this.pendingReviews.set(item.id, item);
    this.saveReviews();
    this.notifyListeners(item);

    return item;
  }

  /**
   * Assign a reviewer to an item
   */
  async assignReviewer(reviewId: string, reviewerId: string): Promise<ReviewItem> {
    const item = this.pendingReviews.get(reviewId) ?? this.inReviewItems.get(reviewId);
    if (!item) {
      throw new Error(`Review item not found: ${reviewId}`);
    }

    if (item.status === 'pending') {
      item.status = 'in_review';
      item.reviewerId = reviewerId;
      this.pendingReviews.delete(reviewId);
      this.inReviewItems.set(reviewId, item);
    } else if (item.status === 'in_review' && !item.reviewerId) {
      item.reviewerId = reviewerId;
    } else {
      throw new Error(`Item is not in a state that can be assigned: ${item.status}`);
    }

    this.saveReviews();
    this.notifyListeners(item);
    return item;
  }

  /**
   * Start reviewing an item
   */
  async startReview(reviewId: string, reviewerId: string): Promise<ReviewItem> {
    const item = this.pendingReviews.get(reviewId) ?? this.inReviewItems.get(reviewId);
    if (!item) {
      throw new Error(`Review item not found: ${reviewId}`);
    }

    if (item.status !== 'pending' && item.status !== 'in_review') {
      throw new Error(`Item is not pending review: ${item.status}`);
    }

    item.status = 'in_review';
    item.reviewerId = reviewerId;
    this.pendingReviews.delete(reviewId);
    this.inReviewItems.set(reviewId, item);
    this.saveReviews();
    this.notifyListeners(item);

    return item;
  }

  /**
   * Complete a review with decision
   */
  async completeReview(
    reviewId: string,
    result: ReviewResult
  ): Promise<ReviewItem> {
    const item = this.inReviewItems.get(reviewId);
    if (!item) {
      throw new Error(`Review item not found or not in review: ${reviewId}`);
    }

    if (item.status !== 'in_review') {
      throw new Error(`Item is not in review: ${item.status}`);
    }

    const config = this.config;
    if (result.decision === 'rejected' && config.requireNotesForRejection && !result.notes) {
      throw new Error('Notes are required for rejection');
    }

    item.status = result.decision;
    item.reviewedAt = Date.now();
    item.reviewNotes = result.notes;
    item.revisionFeedback = result.revisionFeedback;

    if (result.reviewedBy) {
      item.reviewerId = result.reviewedBy;
    }

    this.inReviewItems.delete(reviewId);
    this.saveReviews();
    this.notifyListeners(item);

    return item;
  }

  /**
   * Request revision on an item
   */
  async requestRevision(
    reviewId: string,
    feedback: string,
    reviewerId: string
  ): Promise<ReviewItem> {
    const item = this.inReviewItems.get(reviewId);
    if (!item) {
      throw new Error(`Review item not found: ${reviewId}`);
    }

    item.status = 'revision_requested';
    item.revisionFeedback = feedback;
    item.reviewerId = reviewerId;
    item.reviewedAt = Date.now();

    this.inReviewItems.delete(reviewId);
    this.saveReviews();
    this.notifyListeners(item);

    return item;
  }

  /**
   * Resubmit an item for review (after revision)
   */
  async resubmitForReview(reviewId: string): Promise<ReviewItem> {
    const all = loadReviews();
    const item = all.find(r => r.id === reviewId);
    
    if (!item) {
      throw new Error(`Review item not found: ${reviewId}`);
    }

    if (item.status !== 'revision_requested' && item.status !== 'rejected') {
      throw new Error(`Item cannot be resubmitted from status: ${item.status}`);
    }

    item.status = 'pending';
    item.reviewedAt = undefined;
    item.reviewerId = undefined;
    item.reviewNotes = undefined;

    this.pendingReviews.set(item.id, item);
    this.saveReviews();
    this.notifyListeners(item);

    return item;
  }

  /**
   * Get a review item by ID
   */
  getReviewItem(id: string): ReviewItem | undefined {
    return this.pendingReviews.get(id) 
      ?? this.inReviewItems.get(id)
      ?? loadReviews().find(r => r.id === id);
  }

  /**
   * Get all pending review items
   */
  getPendingReviews(): ReviewItem[] {
    return Array.from(this.pendingReviews.values());
  }

  /**
   * Get all items currently in review
   */
  getInReviewItems(): ReviewItem[] {
    return Array.from(this.inReviewItems.values());
  }

  /**
   * Get reviews for a session
   */
  getReviewsForSession(sessionId: string): ReviewItem[] {
    return loadReviews().filter(r => r.sessionId === sessionId);
  }

  /**
   * Get reviews for a task
   */
  getReviewsForTask(taskId: string): ReviewItem[] {
    return loadReviews().filter(r => r.taskId === taskId);
  }

  /**
   * Get reviews by category
   */
  getReviewsByCategory(category: ReviewCategory): ReviewItem[] {
    return this.getPendingReviews().filter(r => r.category === category);
  }

  /**
   * Get reviews by priority
   */
  getReviewsByPriority(priority: ReviewPriority): ReviewItem[] {
    return this.getPendingReviews().filter(r => r.priority === priority);
  }

  /**
   * Subscribe to review changes
   */
  subscribe(listener: (item: ReviewItem) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get review statistics
   */
  getStats(): {
    pending: number;
    inReview: number;
    approved: number;
    rejected: number;
    revisionRequested: number;
    totalReviews: number;
  } {
    const all = loadReviews();
    return {
      pending: all.filter(r => r.status === 'pending').length,
      inReview: all.filter(r => r.status === 'in_review').length,
      approved: all.filter(r => r.status === 'approved').length,
      rejected: all.filter(r => r.status === 'rejected').length,
      revisionRequested: all.filter(r => r.status === 'revision_requested').length,
      totalReviews: all.length,
    };
  }

  /**
   * Get average review time (in ms)
   */
  getAverageReviewTime(): number {
    const completed = loadReviews().filter(
      r => r.reviewedAt && r.status !== 'revision_requested'
    );
    
    if (completed.length === 0) return 0;

    const totalTime = completed.reduce((sum, r) => {
      return sum + ((r.reviewedAt ?? 0) - r.createdAt);
    }, 0);

    return totalTime / completed.length;
  }

  /**
   * Get approval rate
   */
  getApprovalRate(): number {
    const all = loadReviews();
    const completed = all.filter(
      r => r.status === 'approved' || r.status === 'rejected'
    );
    
    if (completed.length === 0) return 0;

    const approved = completed.filter(r => r.status === 'approved').length;
    return approved / completed.length;
  }

  /**
   * Clear completed reviews older than specified days
   */
  clearOldReviews(daysOld = 30): void {
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const all = loadReviews();
    const filtered = all.filter(
      r => r.status === 'pending' || r.status === 'in_review' || r.createdAt > cutoff
    );
    saveReviews(filtered);
  }

  private saveReviews(): void {
    const all = [
      ...Array.from(this.pendingReviews.values()),
      ...Array.from(this.inReviewItems.values()),
      ...loadReviews().filter(
        r => r.status !== 'pending' && r.status !== 'in_review'
      ),
    ];
    saveReviews(all);
  }

  private notifyListeners(item: ReviewItem): void {
    for (const listener of this.listeners) {
      try {
        listener(item);
      } catch {
        // ignore listener errors
      }
    }
  }
}

// Singleton instance
export const reviewService = new ReviewServiceImpl();
