/**
 * Message Queue - P16 Messaging Service
 * 
 * Implements a priority message queue with retry logic,
 * exponential backoff, and persistent queue processing.
 */

import type { 
  Message, 
  QueuedMessage, 
  QueueConfig,
  MessageStatus 
} from './messageTypes';
import { DEFAULT_QUEUE_CONFIG } from './messageTypes';

const { maxQueueSize, maxRetries, retryDelay, backoffMultiplier } = DEFAULT_QUEUE_CONFIG;

// ============================================================================
// Priority Queue Implementation
// ============================================================================

interface PriorityQueue<T> {
  enqueue(item: T, priority: number): void;
  dequeue(): T | undefined;
  peek(): T | undefined;
  size(): number;
  clear(): void;
}

class PriorityQueueImpl<T> implements PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  enqueue(item: T, priority: number): void {
    const queueItem = { item, priority };
    let added = false;
    
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].priority > priority) {
        this.items.splice(i, 0, queueItem);
        added = true;
        break;
      }
    }
    
    if (!added) {
      this.items.push(queueItem);
    }
  }

  dequeue(): T | undefined {
    return this.items.shift()?.item;
  }

  peek(): T | undefined {
    return this.items[0]?.item;
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  getItems(): Array<{ item: T; priority: number }> {
    return [...this.items];
  }
}

// ============================================================================
// MessageQueue Class
// ============================================================================

export class MessageQueue {
  private queue: PriorityQueueImpl<QueuedMessage>;
  private config: QueueConfig;
  private processing: boolean = false;
  private processCallback?: (message: Message) => Promise<void>;
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private eventListeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
    this.queue = new PriorityQueueImpl();
  }

  /**
   * Set the message processing callback
   */
  setProcessCallback(callback: (message: Message) => Promise<void>): void {
    this.processCallback = callback;
  }

  /**
   * Start processing the queue
   */
  start(): void {
    if (this.processing) return;
    this.processing = true;
    this.processQueue();
  }

  /**
   * Stop processing the queue
   */
  stop(): void {
    this.processing = false;
  }

  /**
   * Add a message to the queue
   */
  enqueue(message: Message, priority?: number): boolean {
    // Check queue size limit
    if (this.queue.size() >= this.config.maxQueueSize) {
      this.emit('queue_full', { messageId: message.id });
      return false;
    }

    // Update message status
    message.status = 'queued';

    const queuedMessage: QueuedMessage = {
      message,
      enqueuedAt: Date.now(),
      processAfter: message.timestamp,
      attempts: 0,
    };

    // Calculate priority based on message priority
    const queuePriority = this.calculatePriority(message, priority);
    this.queue.enqueue(queuedMessage, queuePriority);

    this.emit('message_queued', { messageId: message.id });
    return true;
  }

  /**
   * Remove a message from the queue
   */
  dequeue(messageId: string): boolean {
    const items = this.queue.getItems();
    const index = items.findIndex(qm => qm.item.message.id === messageId);
    
    if (index === -1) return false;
    
    // Create new queue without the message
    this.queue.clear();
    items.splice(index, 1);
    items.forEach(({ item, priority }) => this.queue.enqueue(item, priority));
    
    return true;
  }

  /**
   * Get message by ID from queue
   */
  getMessage(messageId: string): Message | undefined {
    const items = this.queue.getItems();
    const found = items.find(qm => qm.item.message.id === messageId);
    return found?.item.message;
  }

  /**
   * Peek at the next message without removing it
   */
  peek(): Message | undefined {
    return this.queue.peek()?.message;
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.size();
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.size() === 0;
  }

  /**
   * Clear all messages from the queue
   */
  clear(): void {
    this.queue.clear();
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  /**
   * Get all queued messages
   */
  getAllMessages(): Message[] {
    return this.queue.getItems().map(qm => qm.message);
  }

  /**
   * Retry a failed message
   */
  retry(messageId: string): boolean {
    const items = this.queue.getItems();
    const queuedMessage = items.find(qm => qm.item.message.id === messageId);
    
    if (!queuedMessage) return false;

    const { message } = queuedMessage.item;
    
    if (message.retryCount >= this.config.maxRetries) {
      message.status = 'failed';
      this.emit('message_failed', { messageId, error: 'Max retries exceeded' });
      return false;
    }

    // Calculate backoff delay
    const delay = this.calculateBackoff(message.retryCount);
    message.retryCount++;

    // Schedule retry
    const timeout = setTimeout(() => {
      this.emit('retry_scheduled', { messageId, attempt: message.retryCount });
    }, delay);

    this.retryTimeouts.set(messageId, timeout);
    return true;
  }

  // ---- Private Methods ----

  private async processQueue(): Promise<void> {
    while (this.processing && !this.isEmpty()) {
      const queuedMessage = this.queue.peek();
      
      if (!queuedMessage) break;

      const now = Date.now();
      
      // Check if message is ready to be processed
      if (queuedMessage.processAfter > now) {
        const waitTime = queuedMessage.processAfter - now;
        await this.sleep(Math.min(waitTime, this.config.processInterval));
        continue;
      }

      const message = this.queue.dequeue()?.message;
      if (!message) break;

      // Clear any existing retry timeout
      const existingTimeout = this.retryTimeouts.get(message.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.retryTimeouts.delete(message.id);
      }

      try {
        message.status = 'processing';
        this.emit('message_processing', { messageId: message.id });

        if (this.processCallback) {
          await this.processCallback(message);
        }

        message.status = 'sent';
        this.emit('message_sent', { messageId: message.id });
      } catch (error) {
        message.status = 'failed';
        message.error = error instanceof Error ? error.message : String(error);
        this.emit('message_failed', { messageId: message.id, error: message.error });
        
        // Schedule retry if possible
        if (message.retryCount < this.config.maxRetries) {
          const delay = this.calculateBackoff(message.retryCount);
          message.processAfter = Date.now() + delay;
          message.retryCount++;
          this.queue.enqueue({ message, enqueuedAt: Date.now(), processAfter: message.processAfter, attempts: message.retryCount }, this.getMessagePriority(message));
        }
      }
    }

    // Continue processing if still active
    if (this.processing && !this.isEmpty()) {
      setTimeout(() => this.processQueue(), this.config.processInterval);
    }
  }

  private calculatePriority(message: Message, overridePriority?: number): number {
    const priorityMap: Record<MessagePriority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    const base = overridePriority ?? priorityMap[message.priority];

    // Adjust based on retry count (higher retry = lower priority)
    return base + (message.retryCount * 0.1);
  }

  private getMessagePriority(message: Message): number {
    const priorityMap: Record<MessagePriority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };
    return priorityMap[message.priority];
  }

  private calculateBackoff(retryCount: number): number {
    return this.config.retryDelay * Math.pow(this.config.backoffMultiplier, retryCount);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---- Event System ----

  on(event: string, listener: (data: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: string, listener: (data: unknown) => void): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  private emit(event: string, data: unknown): void {
    this.eventListeners.get(event)?.forEach(listener => listener(data));
  }
}

// ============================================================================
// Queue Factory
// ============================================================================

export function createMessageQueue(config?: Partial<QueueConfig>): MessageQueue {
  return new MessageQueue(config);
}

export default MessageQueue;