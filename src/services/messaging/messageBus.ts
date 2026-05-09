/**
 * Message Bus - P16 Messaging Service
 * 
 * Implements a publish-subscribe message bus with topic filtering,
 * middleware support, and handler management.
 */

import type {
  Message,
  MessageHandler,
  MessageHandlerType,
  MessageResult,
  MessageBusConfig,
  PubSubTopic,
  MiddlewareContext,
  MessagingEvent,
  MessagingEventType,
} from './messageTypes';
import { DEFAULT_MESSAGE_BUS_CONFIG } from './messageTypes';

// ============================================================================
// Topic Manager
// ============================================================================

interface TopicSubscription {
  topic: string;
  handler: (message: Message) => void;
  filter?: (message: Message) => boolean;
  messageTypes?: string[];
}

class TopicManager {
  private topics: Map<string, PubSubTopic> = new Map();

  createTopic(name: string, messageTypes: string[] = []): PubSubTopic {
    if (this.topics.has(name)) {
      return this.topics.get(name)!;
    }
    
    const topic: PubSubTopic = {
      name,
      subscribers: new Set(),
      messageTypes,
    };
    
    this.topics.set(name, topic);
    return topic;
  }

  getTopic(name: string): PubSubTopic | undefined {
    return this.topics.get(name);
  }

  hasTopic(name: string): boolean {
    return this.topics.has(name);
  }

  deleteTopic(name: string): boolean {
    return this.topics.delete(name);
  }

  subscribe(topicName: string, handler: (message: Message) => void): boolean {
    let topic = this.topics.get(topicName);
    
    if (!topic) {
      topic = this.createTopic(topicName);
    }
    
    topic.subscribers.add(handler);
    return true;
  }

  unsubscribe(topicName: string, handler: (message: Message) => void): boolean {
    const topic = this.topics.get(topicName);
    
    if (!topic) return false;
    
    return topic.subscribers.delete(handler);
  }

  publish(topicName: string, message: Message): void {
    const topic = this.topics.get(topicName);
    
    if (!topic) return;

    // Filter by message type if specified
    const subscribers = Array.from(topic.subscribers);
    
    subscribers.forEach(handler => {
      // Check if message type matches topic filter
      if (topic.messageTypes.length > 0) {
        if (topic.messageTypes.includes(message.content.type)) {
          handler(message);
        }
      } else {
        handler(message);
      }
    });
  }

  getTopicNames(): string[] {
    return Array.from(this.topics.keys());
  }

  getSubscriberCount(topicName: string): number {
    return this.topics.get(topicName)?.subscribers.size ?? 0;
  }

  clear(): void {
    this.topics.clear();
  }
}

// ============================================================================
// Middleware Manager
// ============================================================================

type Middleware = (context: MiddlewareContext, next: () => Promise<void>) => Promise<void>;

class MiddlewareManager {
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  async execute(context: MiddlewareContext): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware(context, next);
      }
    };

    await next();
  }

  clear(): void {
    this.middlewares = [];
  }
}

// ============================================================================
// Message Bus Class
// ============================================================================

export class MessageBus {
  private config: MessageBusConfig;
  private handlers: Map<MessageHandlerType, MessageHandler[]> = new Map();
  private topicManager: TopicManager;
  private middlewareManager: MiddlewareManager;
  private eventListeners: Map<MessagingEventType, Set<(event: MessagingEvent) => void>> = new Map();
  private messageHistory: Message[] = [];
  private maxHistorySize: number = 1000;

  constructor(config: Partial<MessageBusConfig> = {}) {
    this.config = { ...DEFAULT_MESSAGE_BUS_CONFIG, ...config };
    this.topicManager = new TopicManager();
    this.middlewareManager = new MiddlewareManager();
    
    this.initializeHandlers();
  }

  /**
   * Initialize default handlers
   */
  private initializeHandlers(): void {
    const handlerTypes: MessageHandlerType[] = ['text', 'media', 'system', 'notification', 'command', 'fallback'];
    
    handlerTypes.forEach(type => {
      this.handlers.set(type, []);
    });
  }

  /**
   * Register a message handler
   */
  registerHandler(handler: MessageHandler): boolean {
    const handlers = this.handlers.get(handler.type);
    
    if (!handlers) {
      // Create new handler type slot
      this.handlers.set(handler.type, [handler]);
      return true;
    }

    // Check if handler already registered
    if (handlers.some(h => h === handler)) {
      return false;
    }

    // Check max handlers limit
    if (handlers.length >= this.config.maxHandlers) {
      return false;
    }

    handlers.push(handler);
    return true;
  }

  /**
   * Unregister a message handler
   */
  unregisterHandler(handler: MessageHandler): boolean {
    const handlers = this.handlers.get(handler.type);
    
    if (!handlers) return false;
    
    const index = handlers.findIndex(h => h === handler);
    
    if (index === -1) return false;
    
    handlers.splice(index, 1);
    return true;
  }

  /**
   * Get handlers for a specific type
   */
  getHandlers(type: MessageHandlerType): MessageHandler[] {
    return this.handlers.get(type) ?? [];
  }

  // ---- Pub/Sub Methods ----

  /**
   * Create a new topic
   */
  createTopic(name: string, messageTypes?: string[]): boolean {
    this.topicManager.createTopic(name, messageTypes);
    return true;
  }

  /**
   * Subscribe to a topic
   */
  subscribe(topic: string, handler: (message: Message) => void, filter?: (message: Message) => boolean): boolean {
    const success = this.topicManager.subscribe(topic, handler);
    
    if (success) {
      this.emit({
        type: 'topic_subscribed',
        data: { topic },
        timestamp: Date.now(),
      });
    }
    
    return success;
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string, handler: (message: Message) => void): boolean {
    const success = this.topicManager.unsubscribe(topic, handler);
    
    if (success) {
      this.emit({
        type: 'topic_unsubscribed',
        data: { topic },
        timestamp: Date.now(),
      });
    }
    
    return success;
  }

  /**
   * Publish a message to a topic
   */
  publishToTopic(topic: string, message: Message): void {
    this.topicManager.publish(topic, message);
  }

  /**
   * Check if topic exists
   */
  hasTopic(topic: string): boolean {
    return this.topicManager.hasTopic(topic);
  }

  /**
   * Get all topic names
   */
  getTopics(): string[] {
    return this.topicManager.getTopicNames();
  }

  // ---- Middleware Methods ----

  /**
   * Add middleware
   */
  useMiddleware(middleware: (context: MiddlewareContext, next: () => Promise<void>) => Promise<void>): void {
    this.middlewareManager.use(middleware);
  }

  /**
   * Clear all middleware
   */
  clearMiddleware(): void {
    this.middlewareManager.clear();
  }

  // ---- Message Processing ----

  /**
   * Process a message through the bus
   */
  async process(message: Message): Promise<MessageResult[]> {
    const results: MessageResult[] = [];
    const startTime = Date.now();

    // Store in history
    this.addToHistory(message);

    // Emit message created event
    this.emit({
      type: 'message_created',
      messageId: message.id,
      timestamp: Date.now(),
    });

    // Build middleware context
    const context: MiddlewareContext = {
      message,
      conversation: message as unknown as import('./messageTypes').Conversation,
      handlers: this.getAllHandlers(),
      startTime,
    };

    // Execute middleware if enabled
    if (this.config.enableMiddleware) {
      await this.middlewareManager.execute(context);
    }

    // Find appropriate handlers
    const applicableHandlers = this.findHandlers(message);

    // Process with handlers
    for (const handler of applicableHandlers) {
      try {
        const result = await handler.handle(message);
        results.push(result);

        if (result.success) {
          this.emit({
            type: 'message_sent',
            messageId: message.id,
            data: result,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        results.push({
          success: false,
          messageId: message.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // If no handlers, use fallback
    if (applicableHandlers.length === 0) {
      const fallbackHandlers = this.handlers.get('fallback') ?? [];
      
      for (const handler of fallbackHandlers) {
        try {
          const result = await handler.handle(message);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            messageId: message.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return results;
  }

  /**
   * Route a message to appropriate handlers based on type
   */
  async route(message: Message): Promise<MessageResult[]> {
    return this.process(message);
  }

  // ---- Event System ----

  /**
   * Subscribe to messaging events
   */
  onEvent(type: MessagingEventType, listener: (event: MessagingEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  /**
   * Unsubscribe from messaging events
   */
  offEvent(type: MessagingEventType, listener: (event: MessagingEvent) => void): void {
    this.eventListeners.get(type)?.delete(listener);
  }

  /**
   * Emit a messaging event
   */
  private emit(event: MessagingEvent): void {
    const listeners = this.eventListeners.get(event.type);
    
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  // ---- History Management ----

  /**
   * Add message to history
   */
  private addToHistory(message: Message): void {
    this.messageHistory.push(message);
    
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }
  }

  /**
   * Get message history
   */
  getHistory(conversationId?: string, limit?: number): Message[] {
    let messages = this.messageHistory;
    
    if (conversationId) {
      messages = messages.filter(m => m.conversationId === conversationId);
    }
    
    if (limit) {
      messages = messages.slice(-limit);
    }
    
    return messages;
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  // ---- Helper Methods ----

  /**
   * Find handlers that can process a message
   */
  private findHandlers(message: Message): MessageHandler[] {
    const type = message.content.type as MessageHandlerType;
    const handlers = this.handlers.get(type) ?? [];
    
    return handlers.filter(handler => handler.canHandle(message));
  }

  /**
   * Get all registered handlers
   */
  private getAllHandlers(): MessageHandler[] {
    const allHandlers: MessageHandler[] = [];
    
    this.handlers.forEach((handlers) => {
      allHandlers.push(...handlers);
    });
    
    return allHandlers;
  }

  /**
   * Get bus statistics
   */
  getStats(): {
    handlerCount: number;
    topicCount: number;
    historySize: number;
    eventListenerCount: number;
  } {
    let handlerCount = 0;
    this.handlers.forEach(h => handlerCount += h.length);

    return {
      handlerCount,
      topicCount: this.topicManager.getTopicNames().length,
      historySize: this.messageHistory.length,
      eventListenerCount: Array.from(this.eventListeners.values()).reduce((sum, set) => sum + set.size, 0),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMessageBus(config?: Partial<MessageBusConfig>): MessageBus {
  return new MessageBus(config);
}

export default MessageBus;