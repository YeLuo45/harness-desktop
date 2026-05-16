/**
 * Message Bus Service
 * 
 * Pub/sub messaging system for inter-role communication.
 * Used by the multi-agent engine for role-to-role messaging.
 */

import { v4 as uuidv4 } from 'uuid'

export type MessagePriority = 'high' | 'normal' | 'low'
export type DeliveryMode = 'reliable' | 'express' | 'batch'

export interface AgentMessage {
  id: string
  type: string
  fromRole: string
  fromAgentId?: string
  toRole: string
  toAgentId?: string
  payload: unknown
  priority: MessagePriority
  deliveryMode: DeliveryMode
  timestamp: number
  expiresAt?: number
  correlationId?: string
  replyTo?: string
  headers?: Record<string, string>
  retryCount: number
  maxRetries: number
  status: 'pending' | 'delivered' | 'failed' | 'expired'
}

export interface Subscription {
  id: string
  role?: string
  agentId?: string
  messageType?: string
  callback: (message: AgentMessage) => void | Promise<void>
  filter?: (message: AgentMessage) => boolean
}

export interface MessageBusStats {
  totalSubscriptions: number
  totalMessagesSent: number
  totalMessagesDelivered: number
  totalMessagesFailed: number
  messagesByRole: Record<string, number>
}

export interface PublishOptions {
  priority?: MessagePriority
  deliveryMode?: DeliveryMode
  expiresAt?: number
  correlationId?: string
  replyTo?: string
  headers?: Record<string, string>
  maxRetries?: number
}

export class MessageBus {
  private subscriptions: Map<string, Subscription[]> = new Map()
  private messageHistory: AgentMessage[] = []
  private maxHistorySize: number
  private stats: MessageBusStats = {
    totalSubscriptions: 0,
    totalMessagesSent: 0,
    totalMessagesDelivered: 0,
    totalMessagesFailed: 0,
    messagesByRole: {}
  }
  private deadLetterQueue: AgentMessage[] = []
  private maxDeadLetterSize: number

  constructor(options?: {
    maxHistorySize?: number
    maxDeadLetterSize?: number
  }) {
    this.maxHistorySize = options?.maxHistorySize || 1000
    this.maxDeadLetterSize = options?.maxDeadLetterSize || 100
  }

  /**
   * Generate unique message ID
   */
  private generateId(): string {
    return `msg-${uuidv4()}`
  }

  /**
   * Create subscription key
   */
  private createSubKey(role?: string, agentId?: string, messageType?: string): string {
    if (agentId) return `agent:${agentId}`
    if (role && messageType) return `role:${role}:type:${messageType}`
    if (role) return `role:${role}`
    if (messageType) return `type:${messageType}`
    return 'global'
  }

  /**
   * Subscribe to messages
   */
  subscribe(
    callback: (message: AgentMessage) => void | Promise<void>,
    options?: {
      role?: string
      agentId?: string
      messageType?: string
      filter?: (message: AgentMessage) => boolean
    }
  ): string {
    const id = `sub-${uuidv4()}`
    const subscription: Subscription = {
      id,
      role: options?.role,
      agentId: options?.agentId,
      messageType: options?.messageType,
      callback,
      filter: options?.filter
    }

    const key = this.createSubKey(options?.role, options?.agentId, options?.messageType)
    const existing = this.subscriptions.get(key) || []
    existing.push(subscription)
    this.subscriptions.set(key, existing)

    this.stats.totalSubscriptions++

    return id
  }

  /**
   * Unsubscribe
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [key, subs] of this.subscriptions.entries()) {
      const initialLength = subs.length
      this.subscriptions.set(key, subs.filter(s => s.id !== subscriptionId))
      if (this.subscriptions.get(key)!.length < initialLength) {
        this.stats.totalSubscriptions--
        return true
      }
    }
    return false
  }

  /**
   * Publish a message to a role
   */
  publish(
    toRole: string,
    messageType: string,
    payload: unknown,
    options?: PublishOptions
  ): string {
    return this.sendMessage({
      type: messageType,
      fromRole: '',
      toRole,
      payload,
      priority: options?.priority || 'normal',
      deliveryMode: options?.deliveryMode || 'reliable',
      expiresAt: options?.expiresAt,
      correlationId: options?.correlationId,
      replyTo: options?.replyTo,
      headers: options?.headers,
      maxRetries: options?.maxRetries || 3
    })
  }

  /**
   * Send a direct message
   */
  send(
    toRole: string,
    toAgentId: string | undefined,
    messageType: string,
    payload: unknown,
    options?: PublishOptions
  ): string {
    return this.sendMessage({
      type: messageType,
      fromRole: '',
      toRole,
      toAgentId,
      payload,
      priority: options?.priority || 'normal',
      deliveryMode: options?.deliveryMode || 'reliable',
      expiresAt: options?.expiresAt,
      correlationId: options?.correlationId,
      replyTo: options?.replyTo,
      headers: options?.headers,
      maxRetries: options?.maxRetries || 3
    })
  }

  /**
   * Send message (internal)
   */
  private sendMessage(partial: Omit<AgentMessage, 'id' | 'timestamp' | 'retryCount' | 'status'>): string {
    const id = this.generateId()
    const message: AgentMessage = {
      ...partial,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    } as AgentMessage

    // Store in history
    this.messageHistory.push(message)
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift()
    }

    this.stats.totalMessagesSent++

    // Update role stats
    this.stats.messagesByRole[message.toRole] = (this.stats.messagesByRole[message.toRole] || 0) + 1

    // Deliver message
    this.deliverMessage(message)

    return id
  }

  /**
   * Deliver message to matching subscriptions
   */
  private deliverMessage(message: AgentMessage): void {
    const matchingKeys = [
      `agent:${message.toAgentId}`,
      `role:${message.toRole}:type:${message.type}`,
      `role:${message.toRole}`,
      `type:${message.type}`,
      'global'
    ]

    const delivered = new Set<string>()

    for (const key of matchingKeys) {
      const subs = this.subscriptions.get(key)
      if (!subs) continue

      for (const sub of subs) {
        if (delivered.has(sub.id)) continue

        // Apply custom filter if present
        if (sub.filter && !sub.filter(message)) continue

        try {
          const result = sub.callback(message)
          if (result instanceof Promise) {
            result.catch(err => {
              console.error(`[MessageBus] Async callback error for ${message.id}:`, err)
            })
          }
          delivered.add(sub.id)
          this.stats.totalMessagesDelivered++
          message.status = 'delivered'
        } catch (error) {
          console.error(`[MessageBus] Callback error for ${message.id}:`, error)
          this.handleDeliveryFailure(message)
        }
      }
    }

    // If no subscriptions matched, message is considered delivered
    if (delivered.size === 0 && message.deliveryMode !== 'express') {
      // Could add to dead letter queue or retry
    }
  }

  /**
   * Handle delivery failure
   */
  private handleDeliveryFailure(message: AgentMessage): void {
    message.retryCount++

    if (message.retryCount < message.maxRetries) {
      // Retry after delay based on priority
      const delay = message.priority === 'high' ? 100 : message.priority === 'normal' ? 500 : 1000
      setTimeout(() => this.deliverMessage(message), delay)
    } else {
      message.status = 'failed'
      this.stats.totalMessagesFailed++
      this.addToDeadLetter(message)
    }
  }

  /**
   * Add to dead letter queue
   */
  private addToDeadLetter(message: AgentMessage): void {
    this.deadLetterQueue.push(message)
    if (this.deadLetterQueue.length > this.maxDeadLetterSize) {
      this.deadLetterQueue.shift()
    }
  }

  /**
   * Reply to a message
   */
  reply(originalMessage: AgentMessage, payload: unknown): string {
    if (!originalMessage.replyTo && !originalMessage.correlationId) {
      throw new Error('Original message has no replyTo or correlationId')
    }

    return this.sendMessage({
      type: 'reply',
      fromRole: originalMessage.toRole,
      fromAgentId: originalMessage.toAgentId,
      toRole: originalMessage.fromRole,
      toAgentId: originalMessage.fromAgentId,
      payload,
      priority: 'normal',
      deliveryMode: 'reliable',
      correlationId: originalMessage.correlationId,
      replyTo: originalMessage.id,
      maxRetries: 3
    })
  }

  /**
   * Broadcast to all subscriptions of a role
   */
  broadcast(toRole: string, messageType: string, payload: unknown): string {
    return this.publish(toRole, messageType, payload, { deliveryMode: 'batch' })
  }

  /**
   * Get message by ID
   */
  getMessage(messageId: string): AgentMessage | undefined {
    return this.messageHistory.find(m => m.id === messageId)
  }

  /**
   * Get messages by role
   */
  getMessagesByRole(role: string, limit?: number): AgentMessage[] {
    const messages = this.messageHistory
      .filter(m => m.toRole === role || m.fromRole === role)
      .sort((a, b) => b.timestamp - a.timestamp)
    
    return limit ? messages.slice(0, limit) : messages
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): AgentMessage[] {
    return [...this.deadLetterQueue]
  }

  /**
   * Retry dead letter message
   */
  retryDeadLetter(messageId: string): boolean {
    const index = this.deadLetterQueue.findIndex(m => m.id === messageId)
    if (index === -1) return false

    const message = this.deadLetterQueue.splice(index, 1)[0]
    message.retryCount = 0
    message.status = 'pending'
    this.deliverMessage(message)
    return true
  }

  /**
   * Get statistics
   */
  getStats(): MessageBusStats {
    return { ...this.stats }
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = []
  }

  /**
   * Check if there are subscribers for a role
   */
  hasSubscribers(role: string): boolean {
    return (
      this.subscriptions.has(`role:${role}`) ||
      this.subscriptions.has(`role:${role}:type:*`) ||
      this.subscriptions.has('global')
    )
  }
}

// Singleton instance
let messageBusInstance: MessageBus | null = null

export function getMessageBus(): MessageBus {
  if (!messageBusInstance) {
    messageBusInstance = new MessageBus()
  }
  return messageBusInstance
}

export function initMessageBus(options?: {
  maxHistorySize?: number
  maxDeadLetterSize?: number
}): MessageBus {
  messageBusInstance = new MessageBus(options)
  return messageBusInstance
}