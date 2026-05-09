/**
 * Conversation Handler - P16 Messaging Service
 * 
 * Handles conversation flows, user interactions, and message lifecycle
 * with support for threading, replies, and conversation state management.
 */

import type {
  Message,
  MessageContent,
  MessageResult,
  Conversation,
  ConversationType,
} from './messageTypes';
import { ConversationManager } from './conversationManager';

// ============================================================================
// Handler Types
// ============================================================================

export interface HandlerConfig {
  enableThreading: boolean;
  maxThreadDepth: number;
  enableReplies: boolean;
  autoArchiveAfter?: number;  // Auto-archive inactive conversations after ms
}

export const DEFAULT_HANDLER_CONFIG: HandlerConfig = {
  enableThreading: true,
  maxThreadDepth: 10,
  enableReplies: true,
};

// ============================================================================
// Conversation Handler Class
// ============================================================================

export class ConversationHandler {
  private conversationManager: ConversationManager;
  private config: HandlerConfig;
  private activeConversations: Set<string> = new Set();
  private archivedConversations: Set<string> = new Set();
  private typingUsers: Map<string, Map<string, NodeJS.Timeout>> = new Map();

  constructor(
    conversationManager: ConversationManager,
    config: Partial<HandlerConfig> = {}
  ) {
    this.conversationManager = conversationManager;
    this.config = { ...DEFAULT_HANDLER_CONFIG, ...config };
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: MessageContent,
    replyTo?: string
  ): Promise<Message | undefined> {
    // Verify conversation is active
    if (this.archivedConversations.has(conversationId)) {
      // Reactivate archived conversation
      this.archivedConversations.delete(conversationId);
      this.activeConversations.add(conversationId);
    }

    // Add message to conversation
    const message = this.conversationManager.addMessage(
      conversationId,
      senderId,
      content,
      replyTo
    );

    if (message) {
      this.activeConversations.add(conversationId);
      
      // Set typing indicator timeout to clear later
      this.clearTypingIndicator(conversationId, senderId);
    }

    return message;
  }

  /**
   * Send a reply to an existing message
   */
  async sendReply(
    conversationId: string,
    senderId: string,
    content: MessageContent,
    replyToMessageId: string
  ): Promise<Message | undefined> {
    if (!this.config.enableReplies) {
      return undefined;
    }

    const parentMessage = this.conversationManager.getMessage(conversationId, replyToMessageId);
    
    if (!parentMessage) {
      return undefined;
    }

    // Check thread depth
    if (parentMessage.threadId) {
      const threadMessages = this.conversationManager.getThreadMessages(conversationId, parentMessage.threadId);
      
      if (threadMessages.length >= this.config.maxThreadDepth) {
        // Create new thread instead of deepening
        return this.sendMessage(conversationId, senderId, content, replyToMessageId);
      }
    }

    // Use parent's thread ID or create new one
    const threadId = parentMessage.threadId || parentMessage.id;

    return this.sendMessage(conversationId, senderId, content, replyToMessageId);
  }

  /**
   * Send a threaded message
   */
  async sendThreadMessage(
    conversationId: string,
    senderId: string,
    content: MessageContent,
    threadId: string
  ): Promise<Message | undefined> {
    if (!this.config.enableThreading) {
      return undefined;
    }

    // Verify thread exists
    const threadMessages = this.conversationManager.getThreadMessages(conversationId, threadId);
    
    if (threadMessages.length === 0) {
      return undefined;
    }

    // Check depth limit
    if (threadMessages.length >= this.config.maxThreadDepth) {
      return undefined;
    }

    return this.sendMessage(conversationId, senderId, content);
  }

  /**
   * Edit an existing message
   */
  async editMessage(
    conversationId: string,
    messageId: string,
    senderId: string,
    newContent: MessageContent
  ): Promise<Message | undefined> {
    const message = this.conversationManager.getMessage(conversationId, messageId);
    
    if (!message) return undefined;

    // Only sender can edit their own message
    if (message.senderId !== senderId) return undefined;

    // Update content
    message.content = newContent;

    return message;
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(
    conversationId: string,
    messageId: string,
    senderId: string
  ): Promise<boolean> {
    const message = this.conversationManager.getMessage(conversationId, messageId);
    
    if (!message) return false;

    // Only sender can delete their own message
    if (message.senderId !== senderId) return false;

    // Mark as system message with deleted content
    message.content = {
      type: 'system',
      text: '[Message deleted]',
    };
    message.status = 'deleted' as never;

    return true;
  }

  // ============================================================================
  // Conversation Management
  // ============================================================================

  /**
   * Start a new conversation
   */
  startConversation(
    type: ConversationType,
    participants: string[],
    name?: string
  ): Conversation {
    const conversation = this.conversationManager.createConversation(
      type,
      participants,
      name
    );
    
    this.activeConversations.add(conversation.id);
    
    return conversation;
  }

  /**
   * Archive an inactive conversation
   */
  archiveConversation(conversationId: string): boolean {
    const conversation = this.conversationManager.getConversation(conversationId);
    
    if (!conversation) return false;

    this.activeConversations.delete(conversationId);
    this.archivedConversations.add(conversationId);

    return true;
  }

  /**
   * Get active conversations
   */
  getActiveConversations(): Conversation[] {
    return Array.from(this.activeConversations)
      .map(id => this.conversationManager.getConversation(id))
      .filter((c): c is Conversation => c !== undefined);
  }

  /**
   * Get archived conversations
   */
  getArchivedConversations(): Conversation[] {
    return Array.from(this.archivedConversations)
      .map(id => this.conversationManager.getConversation(id))
      .filter((c): c is Conversation => c !== undefined);
  }

  /**
   * Reactivate an archived conversation
   */
  reactivateConversation(conversationId: string): boolean {
    if (!this.archivedConversations.has(conversationId)) {
      return false;
    }

    this.archivedConversations.delete(conversationId);
    this.activeConversations.add(conversationId);

    return true;
  }

  // ============================================================================
  // Typing Indicators
  // ============================================================================

  /**
   * Set typing indicator for a user
   */
  setTyping(conversationId: string, userId: string, duration: number = 3000): void {
    // Clear existing timeout
    this.clearTypingIndicator(conversationId, userId);

    // Create new timeout
    if (!this.typingUsers.has(conversationId)) {
      this.typingUsers.set(conversationId, new Map());
    }

    const timeout = setTimeout(() => {
      this.clearTypingIndicator(conversationId, userId);
    }, duration);

    this.typingUsers.get(conversationId)!.set(userId, timeout);
  }

  /**
   * Clear typing indicator
   */
  clearTypingIndicator(conversationId: string, userId: string): void {
    const conversationTyping = this.typingUsers.get(conversationId);
    
    if (conversationTyping?.has(userId)) {
      clearTimeout(conversationTyping.get(userId)!);
      conversationTyping.delete(userId);
    }
  }

  /**
   * Get users currently typing in a conversation
   */
  getTypingUsers(conversationId: string): string[] {
    const conversationTyping = this.typingUsers.get(conversationId);
    return conversationTyping ? Array.from(conversationTyping.keys()) : [];
  }

  // ============================================================================
  // Read Status & Notifications
  // ============================================================================

  /**
   * Mark conversation as read for a user
   */
  markAsRead(conversationId: string, userId: string): void {
    this.conversationManager.markAsRead(conversationId, userId);
  }

  /**
   * Get unread count for a user
   */
  getUnreadCount(conversationId: string, userId: string): number {
    return this.conversationManager.getUnreadCount(conversationId, userId);
  }

  /**
   * Get total unread count across all conversations
   */
  getTotalUnreadCount(userId: string): number {
    const conversations = this.conversationManager.getConversationsForParticipant(userId);
    
    return conversations.reduce((total, conv) => {
      return total + this.conversationManager.getUnreadCount(conv.id, userId);
    }, 0);
  }

  // ============================================================================
  // Search & Lookup
  // ============================================================================

  /**
   * Find direct conversation with another user
   */
  findDirectConversation(userId1: string, userId2: string): Conversation | undefined {
    return this.conversationManager.findOrCreateDirectConversation(userId1, userId2);
  }

  /**
   * Search conversations
   */
  searchConversations(query: string, userId?: string): Conversation[] {
    return this.conversationManager.searchConversations(query, userId);
  }

  /**
   * Get conversation by ID
   */
  getConversation(conversationId: string): Conversation | undefined {
    return this.conversationManager.getConversation(conversationId);
  }

  /**
   * Get messages from a conversation
   */
  getMessages(conversationId: string, limit?: number): Message[] {
    return this.conversationManager.getMessages(conversationId, limit);
  }

  /**
   * Get a specific message
   */
  getMessage(conversationId: string, messageId: string): Message | undefined {
    return this.conversationManager.getMessage(conversationId, messageId);
  }

  /**
   * Get thread messages
   */
  getThreadMessages(conversationId: string, threadId: string): Message[] {
    return this.conversationManager.getThreadMessages(conversationId, threadId);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get handler statistics
   */
  getStats(): {
    activeConversations: number;
    archivedConversations: number;
    typingUsers: number;
  } {
    let totalTyping = 0;
    this.typingUsers.forEach(map => {
      totalTyping += map.size;
    });

    return {
      activeConversations: this.activeConversations.size,
      archivedConversations: this.archivedConversations.size,
      typingUsers: totalTyping,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createConversationHandler(
  conversationManager?: ConversationManager,
  config?: Partial<HandlerConfig>
): ConversationHandler {
  const manager = conversationManager ?? new ConversationManager();
  return new ConversationHandler(manager, config);
}

export default ConversationHandler;