/**
 * Conversation Manager - P16 Messaging Service
 * 
 * Manages conversations, participants, and message threads
 * with support for direct, group, and channel conversations.
 */

import type {
  Conversation,
  ConversationType,
  Message,
  MessageContent,
  MessagingEvent,
  MessagingEventType,
} from './messageTypes';

// ============================================================================
// Conversation Manager Class
// ============================================================================

export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private participantConversations: Map<string, Set<string>> = new Map();
  private eventListeners: Map<MessagingEventType, Set<(event: MessagingEvent) => void>> = new Map();

  constructor() {
    // Initialize with empty listener map for common event types
    const eventTypes: MessagingEventType[] = [
      'message_created',
      'message_sent',
      'conversation_started',
      'conversation_updated',
    ];
    
    eventTypes.forEach(type => {
      this.eventListeners.set(type, new Set());
    });
  }

  // ============================================================================
  // Conversation CRUD
  // ============================================================================

  /**
   * Create a new conversation
   */
  createConversation(
    type: ConversationType,
    participants: string[],
    name?: string,
    metadata?: Record<string, unknown>
  ): Conversation {
    const conversation: Conversation = {
      id: this.generateId(),
      type,
      participants,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessageAt: undefined,
      unreadCount: new Map(),
      metadata,
    };

    // Initialize unread counts for all participants
    participants.forEach(p => {
      conversation.unreadCount.set(p, 0);
    });

    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);

    // Update participant -> conversation mappings
    participants.forEach(participantId => {
      if (!this.participantConversations.has(participantId)) {
        this.participantConversations.set(participantId, new Set());
      }
      this.participantConversations.get(participantId)!.add(conversation.id);
    });

    this.emit({
      type: 'conversation_started',
      conversationId: conversation.id,
      data: { type, participants, name },
      timestamp: Date.now(),
    });

    return conversation;
  }

  /**
   * Get conversation by ID
   */
  getConversation(conversationId: string): Conversation | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Get all conversations
   */
  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values());
  }

  /**
   * Get conversations for a participant
   */
  getConversationsForParticipant(participantId: string): Conversation[] {
    const conversationIds = this.participantConversations.get(participantId);
    
    if (!conversationIds) return [];
    
    return Array.from(conversationIds)
      .map(id => this.conversations.get(id))
      .filter((c): c is Conversation => c !== undefined);
  }

  /**
   * Update a conversation
   */
  updateConversation(
    conversationId: string,
    updates: Partial<Pick<Conversation, 'name' | 'metadata'>>
  ): Conversation | undefined {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) return undefined;

    if (updates.name !== undefined) {
      conversation.name = updates.name;
    }
    
    if (updates.metadata !== undefined) {
      conversation.metadata = { ...conversation.metadata, ...updates.metadata };
    }

    conversation.updatedAt = Date.now();

    this.emit({
      type: 'conversation_updated',
      conversationId,
      data: updates,
      timestamp: Date.now(),
    });

    return conversation;
  }

  /**
   * Delete a conversation
   */
  deleteConversation(conversationId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) return false;

    // Remove participant mappings
    conversation.participants.forEach(participantId => {
      this.participantConversations.get(participantId)?.delete(conversationId);
    });

    // Delete conversation and its messages
    this.messages.delete(conversationId);
    this.conversations.delete(conversationId);

    return true;
  }

  /**
   * Add a participant to a conversation
   */
  addParticipant(conversationId: string, participantId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) return false;

    if (!conversation.participants.includes(participantId)) {
      conversation.participants.push(participantId);
      conversation.unreadCount.set(participantId, 0);
      conversation.updatedAt = Date.now();

      // Update participant mapping
      if (!this.participantConversations.has(participantId)) {
        this.participantConversations.set(participantId, new Set());
      }
      this.participantConversations.get(participantId)!.add(conversationId);

      this.emit({
        type: 'conversation_updated',
        conversationId,
        data: { action: 'participant_added', participantId },
        timestamp: Date.now(),
      });
    }

    return true;
  }

  /**
   * Remove a participant from a conversation
   */
  removeParticipant(conversationId: string, participantId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) return false;

    const index = conversation.participants.indexOf(participantId);
    
    if (index === -1) return false;

    conversation.participants.splice(index, 1);
    conversation.unreadCount.delete(participantId);
    conversation.updatedAt = Date.now();

    // Update participant mapping
    this.participantConversations.get(participantId)?.delete(conversationId);

    this.emit({
      type: 'conversation_updated',
      conversationId,
      data: { action: 'participant_removed', participantId },
      timestamp: Date.now(),
    });

    return true;
  }

  // ============================================================================
  // Message Management
  // ============================================================================

  /**
   * Add a message to a conversation
   */
  addMessage(
    conversationId: string,
    senderId: string,
    content: MessageContent,
    replyTo?: string,
    threadId?: string
  ): Message | undefined {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) return undefined;

    // Verify sender is a participant
    if (!conversation.participants.includes(senderId)) {
      return undefined;
    }

    const message: Message = {
      id: this.generateId(),
      conversationId,
      senderId,
      recipientId: this.getRecipientId(conversation, senderId),
      content,
      status: 'pending',
      priority: 'normal',
      timestamp: Date.now(),
      retryCount: 0,
      replyTo,
      threadId,
    };

    // Add to messages
    const conversationMessages = this.messages.get(conversationId) ?? [];
    conversationMessages.push(message);
    this.messages.set(conversationId, conversationMessages);

    // Update conversation
    conversation.lastMessageAt = message.timestamp;
    conversation.updatedAt = Date.now();

    // Increment unread count for other participants
    conversation.participants.forEach(p => {
      if (p !== senderId) {
        const current = conversation.unreadCount.get(p) ?? 0;
        conversation.unreadCount.set(p, current + 1);
      }
    });

    this.emit({
      type: 'message_created',
      messageId: message.id,
      conversationId,
      data: { senderId, contentType: content.type },
      timestamp: Date.now(),
    });

    return message;
  }

  /**
   * Get messages for a conversation
   */
  getMessages(conversationId: string, limit?: number, before?: number): Message[] {
    let messages = this.messages.get(conversationId) ?? [];
    
    if (before) {
      messages = messages.filter(m => m.timestamp < before);
    }
    
    if (limit) {
      return messages.slice(-limit);
    }
    
    return messages;
  }

  /**
   * Get a specific message
   */
  getMessage(conversationId: string, messageId: string): Message | undefined {
    const messages = this.messages.get(conversationId);
    return messages?.find(m => m.id === messageId);
  }

  /**
   * Get thread messages
   */
  getThreadMessages(conversationId: string, threadId: string): Message[] {
    const messages = this.messages.get(conversationId) ?? [];
    return messages.filter(m => m.threadId === threadId);
  }

  /**
   * Update message status
   */
  updateMessageStatus(messageId: string, status: Message['status'], error?: string): boolean {
    for (const messages of this.messages.values()) {
      const message = messages.find(m => m.id === messageId);
      
      if (message) {
        message.status = status;
        if (error) message.error = error;
        return true;
      }
    }
    
    return false;
  }

  /**
   * Mark messages as read for a participant
   */
  markAsRead(conversationId: string, participantId: string): void {
    const conversation = this.conversations.get(conversationId);
    
    if (conversation) {
      conversation.unreadCount.set(participantId, 0);
      conversation.updatedAt = Date.now();

      this.emit({
        type: 'message_read',
        conversationId,
        data: { participantId },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get unread count for a participant
   */
  getUnreadCount(conversationId: string, participantId: string): number {
    const conversation = this.conversations.get(conversationId);
    return conversation?.unreadCount.get(participantId) ?? 0;
  }

  /**
   * Get total unread count for a participant across all conversations
   */
  getTotalUnreadCount(participantId: string): number {
    const conversations = this.getConversationsForParticipant(participantId);
    
    return conversations.reduce((total, conv) => {
      return total + (conv.unreadCount.get(participantId) ?? 0);
    }, 0);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Find or create a direct conversation between two participants
   */
  findOrCreateDirectConversation(userId1: string, userId2: string): Conversation | undefined {
    // Look for existing direct conversation
    const conversations = this.getConversationsForParticipant(userId1);
    
    const existing = conversations.find(c => 
      c.type === 'direct' && 
      c.participants.includes(userId2)
    );

    if (existing) return existing;

    // Create new direct conversation
    return this.createConversation('direct', [userId1, userId2]);
  }

  /**
   * Search conversations by name
   */
  searchConversations(query: string, participantId?: string): Conversation[] {
    const lowerQuery = query.toLowerCase();
    
    let conversations = Array.from(this.conversations.values());
    
    if (participantId) {
      const conversationIds = this.participantConversations.get(participantId);
      
      if (!conversationIds) return [];
      
      conversations = Array.from(conversationIds)
        .map(id => this.conversations.get(id))
        .filter((c): c is Conversation => c !== undefined);
    }

    return conversations.filter(c => 
      c.name?.toLowerCase().includes(lowerQuery) ||
      c.participants.some(p => p.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    totalConversations: number;
    totalMessages: number;
    byType: Record<ConversationType, number>;
    mostActiveConversation: string | null;
  } {
    const byType: Record<ConversationType, number> = {
      direct: 0,
      group: 0,
      channel: 0,
      thread: 0,
    };

    let totalMessages = 0;
    let mostActiveConversation: string | null = null;
    let maxMessages = 0;

    this.conversations.forEach((conv, id) => {
      byType[conv.type]++;
      const msgCount = this.messages.get(id)?.length ?? 0;
      totalMessages += msgCount;
      
      if (msgCount > maxMessages) {
        maxMessages = msgCount;
        mostActiveConversation = id;
      }
    });

    return {
      totalConversations: this.conversations.size,
      totalMessages,
      byType,
      mostActiveConversation,
    };
  }

  // ============================================================================
  // Event System
  // ============================================================================

  /**
   * Subscribe to events
   */
  on(type: MessagingEventType, listener: (event: MessagingEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  /**
   * Unsubscribe from events
   */
  off(type: MessagingEventType, listener: (event: MessagingEvent) => void): void {
    this.eventListeners.get(type)?.delete(listener);
  }

  /**
   * Emit an event
   */
  private emit(event: MessagingEvent): void {
    this.eventListeners.get(event.type)?.forEach(listener => listener(event));
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recipient ID for direct messages
   */
  private getRecipientId(conversation: Conversation, senderId: string): string {
    if (conversation.type !== 'direct') {
      return ''; // No single recipient for group/channel
    }
    
    return conversation.participants.find(p => p !== senderId) ?? '';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createConversationManager(): ConversationManager {
  return new ConversationManager();
}

export default ConversationManager;