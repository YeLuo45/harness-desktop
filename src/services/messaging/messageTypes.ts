/**
 * Messaging Types - P16 Messaging Service
 * 
 * Core type definitions for the messaging system:
 * - Message types and statuses
 * - Conversation types
 * - Message queue types
 * - Handler types
 */

// ============================================================================
// Message Types
// ============================================================================

export type MessageStatus = 
  | 'pending'      // Message created, not yet sent
  | 'queued'       // Message in queue, waiting to be processed
  | 'processing'   // Message is being processed
  | 'sent'         // Message sent successfully
  | 'delivered'    // Message delivered to recipient
  | 'read'         // Message read by recipient
  | 'failed';      // Message failed to send

export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

export type MessageType = 
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'file'
  | 'system'
  | 'notification'
  | 'command';

export interface MessageContent {
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Message Interface
// ============================================================================

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: MessageContent;
  status: MessageStatus;
  priority: MessagePriority;
  timestamp: number;
  expiresAt?: number;
  retryCount: number;
  error?: string;
  replyTo?: string;
  threadId?: string;
}

// ============================================================================
// Conversation Types
// ============================================================================

export type ConversationType = 
  | 'direct'        // One-on-one conversation
  | 'group'         // Group conversation
  | 'channel'       // Broadcast channel
  | 'thread';       // Thread within a conversation

export interface Conversation {
  id: string;
  type: ConversationType;
  participants: string[];
  name?: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
  unreadCount: Map<string, number>;  // userId -> unread count
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Message Queue Types
// ============================================================================

export interface QueuedMessage {
  message: Message;
  enqueuedAt: number;
  processAfter: number;
  attempts: number;
}

export interface QueueConfig {
  maxQueueSize: number;
  maxRetries: number;
  retryDelay: number;        // Base delay in ms
  backoffMultiplier: number; // Multiplier for exponential backoff
  processInterval: number;  // How often to process queue (ms)
}

// ============================================================================
// Message Handler Types
// ============================================================================

export type MessageHandlerType = 
  | 'text'
  | 'media'
  | 'system'
  | 'notification'
  | 'command'
  | 'fallback';

export interface MessageHandler {
  type: MessageHandlerType;
  canHandle(message: Message): boolean;
  handle(message: Message): Promise<MessageResult>;
}

export interface MessageResult {
  success: boolean;
  messageId: string;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Message Bus Types
// ============================================================================

export interface MessageBusConfig {
  enablePubSub: boolean;
  enableMiddleware: boolean;
  maxHandlers: number;
}

export interface PubSubTopic {
  name: string;
  subscribers: Set<(message: Message) => void>;
  messageTypes: MessageType[];
}

export interface MiddlewareContext {
  message: Message;
  conversation: Conversation;
  handlers: MessageHandler[];
  startTime: number;
}

// ============================================================================
// Event Types
// ============================================================================

export type MessagingEventType =
  | 'message_created'
  | 'message_queued'
  | 'message_sent'
  | 'message_delivered'
  | 'message_read'
  | 'message_failed'
  | 'conversation_started'
  | 'conversation_updated'
  | 'topic_subscribed'
  | 'topic_unsubscribed';

export interface MessagingEvent {
  type: MessagingEventType;
  messageId?: string;
  conversationId?: string;
  data?: unknown;
  timestamp: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxQueueSize: 1000,
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  processInterval: 100,
};

export const DEFAULT_MESSAGE_BUS_CONFIG: MessageBusConfig = {
  enablePubSub: true,
  enableMiddleware: false,
  maxHandlers: 10,
};