/**
 * Approval Notification Service - P15
 * 
 * Manages notifications for approval workflow events including
 * pending approvals, reminders, escalations, and completion notices.
 */

import type { PersonaRole } from '../collaboration/types';

// ============================================================================
// Types
// ============================================================================

export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ApprovalNotification {
  id: string;
  type: 'approval_request' | 'approval_reminder' | 'approval_decided' | 
        'chain_progress' | 'chain_completed' | 'delegation_created' | 
        'delegation_expiring' | 'escalation' | 'timeout';
  title: string;
  message: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  status: NotificationStatus;
  recipientId: string;
  recipientRole?: PersonaRole;
  referenceId?: string;           // Related approval request or chain ID
  referenceType?: 'request' | 'chain' | 'delegation';
  createdAt: number;
  sentAt?: number;
  deliveredAt?: number;
  readAt?: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface NotificationTemplate {
  id: string;
  type: ApprovalNotification['type'];
  title: string;
  message: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
}

export interface NotificationConfig {
  enableInApp?: boolean;
  enableEmail?: boolean;
  enablePush?: boolean;
  enableSms?: boolean;
  reminderInterval?: number;       // ms between reminders
  maxReminders?: number;
  batchNotifications?: boolean;
  batchInterval?: number;
}

// ============================================================================
// Storage Keys
// ============================================================================

const NOTIFICATION_STORAGE_KEY = 'pixelpal_approvalworkflow_notifications';
const NOTIFICATION_CONFIG_KEY = 'pixelpal_approvalworkflow_notification_config';
const TEMPLATE_STORAGE_KEY = 'pixelpal_approvalworkflow_notification_templates';

// ============================================================================
// Default Templates
// ============================================================================

const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'tpl_approval_request',
    type: 'approval_request',
    title: 'Approval Required',
    message: 'You have a new approval request: {title}. Please review and respond.',
    channels: ['in_app', 'email'],
    priority: 'high',
  },
  {
    id: 'tpl_approval_reminder',
    type: 'approval_reminder',
    title: 'Approval Reminder',
    message: 'Reminder: You still have a pending approval request for "{title}".',
    channels: ['in_app'],
    priority: 'normal',
  },
  {
    id: 'tpl_approval_decided',
    type: 'approval_decided',
    title: 'Approval {decision}',
    message: 'Your approval request "{title}" has been {decision} by {decidedBy}.',
    channels: ['in_app', 'email'],
    priority: 'normal',
  },
  {
    id: 'tpl_chain_progress',
    type: 'chain_progress',
    title: 'Chain Step Completed',
    message: 'Step {step} of your approval chain "{chainName}" has been {status}.',
    channels: ['in_app'],
    priority: 'normal',
  },
  {
    id: 'tpl_chain_completed',
    type: 'chain_completed',
    title: 'Approval Chain Completed',
    message: 'Your approval chain "{chainName}" has completed with status: {chainStatus}.',
    channels: ['in_app', 'email'],
    priority: 'high',
  },
  {
    id: 'tpl_delegation_created',
    type: 'delegation_created',
    title: 'Delegation Created',
    message: '{delegatorName} has delegated their approval authority to you.',
    channels: ['in_app', 'email'],
    priority: 'normal',
  },
  {
    id: 'tpl_delegation_expiring',
    type: 'delegation_expiring',
    title: 'Delegation Expiring Soon',
    message: 'Your delegation to {delegateName} will expire in {timeRemaining}.',
    channels: ['in_app', 'email'],
    priority: 'high',
  },
  {
    id: 'tpl_escalation',
    type: 'escalation',
    title: 'Approval Escalated',
    message: 'Approval request "{title}" has been escalated. Reason: {reason}.',
    channels: ['in_app', 'email', 'push'],
    priority: 'urgent',
  },
  {
    id: 'tpl_timeout',
    type: 'timeout',
    title: 'Approval Timed Out',
    message: 'Approval request "{title}" has timed out without a decision.',
    channels: ['in_app', 'email'],
    priority: 'high',
  },
];

// ============================================================================
// Config Management
// ============================================================================

const defaultConfig: Required<NotificationConfig> = {
  enableInApp: true,
  enableEmail: true,
  enablePush: false,
  enableSms: false,
  reminderInterval: 30 * 60 * 1000, // 30 minutes
  maxReminders: 3,
  batchNotifications: true,
  batchInterval: 60 * 1000, // 1 minute
};

export function getNotificationConfig(): Required<NotificationConfig> {
  try {
    const stored = localStorage.getItem(NOTIFICATION_CONFIG_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return defaultConfig;
}

export function setNotificationConfig(config: NotificationConfig): void {
  const current = getNotificationConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(NOTIFICATION_CONFIG_KEY, JSON.stringify(updated));
}

// ============================================================================
// Storage Functions
// ============================================================================

function loadNotifications(): ApprovalNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveNotifications(notifications: ApprovalNotification[]): void {
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
}

function loadTemplates(): NotificationTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return DEFAULT_TEMPLATES;
}

function saveTemplates(templates: NotificationTemplate[]): void {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

// ============================================================================
// NotificationService Implementation
// ============================================================================

class ApprovalNotificationServiceImpl {
  private notifications: Map<string, ApprovalNotification> = new Map();
  private pendingBatch: ApprovalNotification[] = [];
  private config: Required<NotificationConfig>;
  private templates: Map<string, NotificationTemplate> = new Map();
  private listeners: Set<(notification: ApprovalNotification) => void> = new Set();
  private reminderIntervals: Map<string, NodeJS.Timeout> = new Map();
  private batchInterval: NodeJS.Timeout | null = null;
  private unreadCount: Map<string, number> = new Map();

  constructor() {
    this.config = getNotificationConfig();
    this.loadNotifications();
    this.loadTemplates();
    this.startBatchProcessor();
  }

  private loadNotifications(): void {
    const notifications = loadNotifications();
    for (const notification of notifications) {
      this.notifications.set(notification.id, notification);
      if (notification.status === 'pending' && notification.expiresAt && notification.expiresAt < Date.now()) {
        notification.status = 'failed';
      }
      if (notification.status !== 'read') {
        const count = this.unreadCount.get(notification.recipientId) ?? 0;
        this.unreadCount.set(notification.recipientId, count + 1);
      }
    }
  }

  private loadTemplates(): void {
    const templates = loadTemplates();
    for (const template of templates) {
      this.templates.set(template.id, template);
    }
  }

  private startBatchProcessor(): void {
    if (!this.config.batchNotifications) return;

    this.batchInterval = setInterval(() => {
      if (this.pendingBatch.length > 0) {
        this.flushBatch();
      }
    }, this.config.batchInterval);
  }

  /**
   * Create a notification
   */
  async createNotification(params: {
    type: ApprovalNotification['type'];
    title: string;
    message: string;
    recipientId: string;
    recipientRole?: PersonaRole;
    channels?: NotificationChannel[];
    priority?: NotificationPriority;
    referenceId?: string;
    referenceType?: 'request' | 'chain' | 'delegation';
    expiresIn?: number;
    metadata?: Record<string, unknown>;
    variables?: Record<string, string>;
  }): Promise<ApprovalNotification> {
    // Find template if exists and apply variables
    let title = params.title;
    let message = params.message;
    
    for (const template of this.templates.values()) {
      if (template.type === params.type) {
        title = this.interpolate(template.title, params.variables ?? {});
        message = this.interpolate(template.message, params.variables ?? {});
        break;
      }
    }

    const channels = params.channels ?? this.getDefaultChannels();

    const notification: ApprovalNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: params.type,
      title,
      message,
      channels,
      priority: params.priority ?? 'normal',
      status: 'pending',
      recipientId: params.recipientId,
      recipientRole: params.recipientRole,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      createdAt: Date.now(),
      expiresAt: params.expiresIn ? Date.now() + params.expiresIn : undefined,
      metadata: params.metadata,
    };

    this.notifications.set(notification.id, notification);

    if (this.config.batchNotifications && params.priority !== 'urgent') {
      this.pendingBatch.push(notification);
    } else {
      await this.sendNotification(notification);
    }

    this.saveNotifications();
    return notification;
  }

  /**
   * Send notification through configured channels
   */
  private async sendNotification(notification: ApprovalNotification): Promise<void> {
    notification.status = 'sent';
    notification.sentAt = Date.now();

    // In-app notification (always simulated)
    if (notification.channels.includes('in_app') && this.config.enableInApp) {
      this.notifyListeners(notification);
      this.incrementUnread(notification.recipientId);
    }

    // Email notification (simulated)
    if (notification.channels.includes('email') && this.config.enableEmail) {
      // In a real app, this would integrate with an email service
      notification.status = 'delivered';
      notification.deliveredAt = Date.now();
    }

    // Push notification (simulated)
    if (notification.channels.includes('push') && this.config.enablePush) {
      // In a real app, this would integrate with a push notification service
    }

    // SMS notification (simulated)
    if (notification.channels.includes('sms') && this.config.enableSms) {
      // In a real app, this would integrate with an SMS service
    }

    // Schedule reminder if applicable
    if (notification.type === 'approval_request') {
      this.scheduleReminder(notification);
    }
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (!notification) return;

    if (notification.status !== 'read') {
      notification.readAt = Date.now();
      notification.status = 'read';
      this.decrementUnread(notification.recipientId);
      this.clearReminder(notificationId);
      this.saveNotifications();
    }
  }

  /**
   * Mark all notifications as read for a recipient
   */
  markAllAsRead(recipientId: string): void {
    for (const notification of this.notifications.values()) {
      if (notification.recipientId === recipientId && notification.status !== 'read') {
        notification.readAt = Date.now();
        notification.status = 'read';
        this.clearReminder(notification.id);
      }
    }
    this.unreadCount.set(recipientId, 0);
    this.saveNotifications();
  }

  /**
   * Delete a notification
   */
  deleteNotification(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (!notification) return false;

    if (notification.status !== 'read') {
      this.decrementUnread(notification.recipientId);
    }
    this.clearReminder(notificationId);
    this.notifications.delete(notificationId);
    this.saveNotifications();
    return true;
  }

  /**
   * Get notification by ID
   */
  getNotification(notificationId: string): ApprovalNotification | undefined {
    return this.notifications.get(notificationId);
  }

  /**
   * Get notifications for a recipient
   */
  getNotificationsForRecipient(recipientId: string, limit = 50): ApprovalNotification[] {
    return Array.from(this.notifications.values())
      .filter(n => n.recipientId === recipientId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get unread notifications for a recipient
   */
  getUnreadNotifications(recipientId: string): ApprovalNotification[] {
    return Array.from(this.notifications.values())
      .filter(n => n.recipientId === recipientId && n.status !== 'read');
  }

  /**
   * Get unread count for a recipient
   */
  getUnreadCount(recipientId: string): number {
    return this.unreadCount.get(recipientId) ?? 0;
  }

  /**
   * Get notifications by reference
   */
  getNotificationsByReference(referenceId: string): ApprovalNotification[] {
    return Array.from(this.notifications.values())
      .filter(n => n.referenceId === referenceId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Send approval request notification
   */
  async notifyApprovalRequest(params: {
    requestId: string;
    title: string;
    description: string;
    requesterId: string;
    approverId: string;
    approverRole: PersonaRole;
    priority?: NotificationPriority;
  }): Promise<ApprovalNotification> {
    return this.createNotification({
      type: 'approval_request',
      title: 'Approval Required',
      message: `New approval request: ${params.title}. ${params.description}`,
      recipientId: params.approverId,
      recipientRole: params.approverRole,
      referenceId: params.requestId,
      referenceType: 'request',
      priority: params.priority ?? 'high',
      variables: { title: params.title },
    });
  }

  /**
   * Send approval decided notification
   */
  async notifyApprovalDecision(params: {
    requestId: string;
    title: string;
    decision: 'approved' | 'rejected';
    decidedBy: string;
    reason?: string;
    requesterId: string;
  }): Promise<ApprovalNotification> {
    return this.createNotification({
      type: 'approval_decided',
      title: `Approval ${params.decision === 'approved' ? 'Approved' : 'Rejected'}`,
      message: `Your request "${params.title}" has been ${params.decision}.`,
      recipientId: params.requesterId,
      referenceId: params.requestId,
      referenceType: 'request',
      priority: 'normal',
      variables: {
        title: params.title,
        decision: params.decision,
        decidedBy: params.decidedBy,
      },
    });
  }

  /**
   * Send chain progress notification
   */
  async notifyChainProgress(params: {
    chainId: string;
    chainName: string;
    step: number;
    totalSteps: number;
    status: 'approved' | 'rejected' | 'skipped';
    recipientId: string;
  }): Promise<ApprovalNotification> {
    return this.createNotification({
      type: 'chain_progress',
      title: 'Chain Step Completed',
      message: `Step ${params.step} of "${params.chainName}" has been ${params.status}.`,
      recipientId: params.recipientId,
      referenceId: params.chainId,
      referenceType: 'chain',
      priority: 'normal',
      variables: {
        step: params.step.toString(),
        chainName: params.chainName,
        status: params.status,
      },
    });
  }

  /**
   * Send timeout notification
   */
  async notifyTimeout(params: {
    requestId: string;
    title: string;
    approverId: string;
  }): Promise<ApprovalNotification> {
    return this.createNotification({
      type: 'timeout',
      title: 'Approval Timed Out',
      message: `Approval request "${params.title}" has timed out.`,
      recipientId: params.approverId,
      referenceId: params.requestId,
      referenceType: 'request',
      priority: 'high',
      variables: { title: params.title },
    });
  }

  /**
   * Subscribe to new notifications
   */
  subscribe(listener: (notification: ApprovalNotification) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get notification statistics
   */
  getStats(): {
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    read: number;
    byType: Record<string, number>;
  } {
    const all = Array.from(this.notifications.values());
    
    const byType: Record<string, number> = {};
    for (const n of all) {
      byType[n.type] = (byType[n.type] ?? 0) + 1;
    }

    return {
      total: all.length,
      pending: all.filter(n => n.status === 'pending').length,
      sent: all.filter(n => n.status === 'sent').length,
      delivered: all.filter(n => n.status === 'delivered').length,
      read: all.filter(n => n.status === 'read').length,
      byType,
    };
  }

  /**
   * Clear expired notifications
   */
  clearExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [id, notification] of this.notifications.entries()) {
      if (notification.expiresAt && notification.expiresAt < now) {
        this.notifications.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      this.saveNotifications();
    }

    return removed;
  }

  private getDefaultChannels(): NotificationChannel[] {
    const channels: NotificationChannel[] = [];
    if (this.config.enableInApp) channels.push('in_app');
    if (this.config.enableEmail) channels.push('email');
    if (this.config.enablePush) channels.push('push');
    if (this.config.enableSms) channels.push('sms');
    return channels;
  }

  private interpolate(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }

  private incrementUnread(recipientId: string): void {
    const count = this.unreadCount.get(recipientId) ?? 0;
    this.unreadCount.set(recipientId, count + 1);
  }

  private decrementUnread(recipientId: string): void {
    const count = this.unreadCount.get(recipientId) ?? 0;
    if (count > 0) {
      this.unreadCount.set(recipientId, count - 1);
    }
  }

  private scheduleReminder(notification: ApprovalNotification): void {
    if (!this.config.reminderInterval || !this.config.maxReminders) return;

    const reminderKey = `${notification.id}_reminder`;
    const existingReminders = Array.from(this.reminderIntervals.keys())
      .filter(k => k.startsWith(notification.id));

    if (existingReminders.length >= this.config.maxReminders) return;

    const timer = setTimeout(() => {
      const updated = this.notifications.get(notification.id);
      if (updated && updated.status !== 'read') {
        this.createNotification({
          type: 'approval_reminder',
          title: 'Approval Reminder',
          message: `Reminder: ${notification.title}`,
          recipientId: notification.recipientId,
          recipientRole: notification.recipientRole,
          referenceId: notification.referenceId,
          referenceType: notification.referenceType,
          priority: 'normal',
          variables: { title: notification.title },
        });
      }
      this.reminderIntervals.delete(reminderKey);
    }, this.config.reminderInterval);

    this.reminderIntervals.set(reminderKey, timer);
  }

  private clearReminder(notificationId: string): void {
    for (const [key, timer] of this.reminderIntervals.entries()) {
      if (key.startsWith(notificationId)) {
        clearTimeout(timer);
        this.reminderIntervals.delete(key);
      }
    }
  }

  private async flushBatch(): Promise<void> {
    const batch = this.pendingBatch.splice(0);
    for (const notification of batch) {
      await this.sendNotification(notification);
    }
    this.saveNotifications();
  }

  private saveNotifications(): void {
    const all = Array.from(this.notifications.values());
    saveNotifications(all);
  }

  private notifyListeners(notification: ApprovalNotification): void {
    for (const listener of this.listeners) {
      try {
        listener(notification);
      } catch {
        // ignore listener errors
      }
    }
  }
}

// Singleton instance
export const approvalNotificationService = new ApprovalNotificationServiceImpl();
